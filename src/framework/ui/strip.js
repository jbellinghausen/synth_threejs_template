import { CV_NOTE_MAX, CV_NOTE_MIN, VOICES, jackLabel } from '../../config.js';
import { trackerName } from '../music/theory.js';

/**
 * The row of slot cells along the bottom: jack number, label, the note being
 * sent and its voltage, an activity light, mute (click) and solo (the S
 * button, or shift-click). LFOs have no solo: solo leaves them running.
 */
export class Strip {
  constructor(container, conductor, { onChange = () => {} } = {}) {
    this.conductor = conductor;
    this.onChange = onChange;
    this.cells = new Map(); // voice id -> { root, main, solo, led, noteEl, level, hold, note }

    for (const voice of VOICES) {
      const root = document.createElement('div');
      root.className = `slot slot--${voice.kind}`;

      const main = document.createElement('button');
      main.className = 'slot__main';
      main.setAttribute('aria-pressed', 'false');
      main.title = `Jack ${jackLabel(voice.slot)} (protocol slot ${voice.slot}): ${voice.label}. `
        + (voice.kind === 'lfo' ? 'Click to mute.' : 'Click to mute, shift-click to solo.');
      main.innerHTML = `<span class="slot__num">${jackLabel(voice.slot)}</span>`
        + `<span class="slot__label">${voice.label}</span><span class="slot__note">–</span>`
        + '<span class="slot__led"></span>';
      root.append(main);

      let solo = null;
      if (voice.kind !== 'lfo') {
        solo = document.createElement('button');
        solo.className = 'slot__solo';
        solo.textContent = 'S';
        solo.title = `Solo ${voice.label}`;
        solo.setAttribute('aria-pressed', 'false');
        solo.addEventListener('click', () => this.#toggleSolo(voice.id));
        root.append(solo);
      }

      main.addEventListener('click', (event) => {
        if (event.shiftKey && solo) this.#toggleSolo(voice.id);
        else this.#toggleMute(voice.id);
      });

      container.append(root);
      this.cells.set(voice.id, {
        root, main, solo,
        led: main.querySelector('.slot__led'),
        noteEl: main.querySelector('.slot__note'),
        level: 0,
        hold: voice.gateMode === 'hold', // held LFOs show their level; everything else flashes
        note: null,
      });
    }
    container.style.setProperty('--slots', String(VOICES.length));
  }

  #toggleMute(id) {
    this.conductor.setMuted(id, !this.conductor.muted.has(id));
    this.refresh();
  }

  #toggleSolo(id) {
    this.conductor.setSoloed(id, !this.conductor.soloed.has(id));
    this.refresh();
  }

  /** Re-read mute / solo state from the conductor. */
  refresh() {
    for (const [id, cell] of this.cells) {
      cell.main.setAttribute('aria-pressed', String(this.conductor.muted.has(id)));
      cell.solo?.setAttribute('aria-pressed', String(this.conductor.soloed.has(id)));
      cell.root.classList.toggle('is-silent', !this.conductor.isAudible(id));
    }
    this.onChange();
  }

  hit(event) {
    const cell = this.cells.get(event.voice);
    if (!cell) return;
    cell.level = event.ghost ? 0.4 : 1;
    if (event.note != null) this.showNote(event.voice, event.note);
  }

  setLfos(lfos) {
    for (const l of lfos) {
      const cell = this.cells.get(l.voice.id);
      if (!cell) continue;
      if (cell.hold) cell.level = l.value;
      else if (l.fresh) cell.level = 1;
      this.showNote(l.voice.id, l.note);
    }
  }

  /**
   * Show the note a slot is being sent, and its voltage. This is the note as
   * generated, before it is clamped to the DAC range, so anything the
   * hardware can't reach shows up red.
   */
  showNote(id, note) {
    const cell = this.cells.get(id);
    if (!cell || cell.note === note) return;
    cell.note = note;
    const clamped = note < CV_NOTE_MIN || note > CV_NOTE_MAX;
    const volts = Math.max(0, Math.min(3.3, (note - CV_NOTE_MIN) / 12));
    cell.noteEl.textContent = `${trackerName(note).replace('-', '')} ${volts.toFixed(2)}V`;
    cell.noteEl.classList.toggle('is-clamped', clamped);
    cell.noteEl.title = clamped
      ? `Note ${note} is outside ${CV_NOTE_MIN}-${CV_NOTE_MAX}: the DAC clamps it to ${volts.toFixed(2)} V`
      : `MIDI note ${note}`;
  }

  /** Per frame: fade the activity lights. */
  update(dt) {
    for (const cell of this.cells.values()) {
      if (!cell.hold) cell.level *= Math.exp(-dt / 0.15);
      cell.led.style.opacity = cell.level.toFixed(3);
    }
  }
}
