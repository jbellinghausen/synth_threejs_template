import { CV_NOTE_MIN, CV_SLOTS, TRANSPORT, VOICES, jackLabel } from '../../config.js';
import { trackerName } from '../music/theory.js';

const volts = (note) => ((note - CV_NOTE_MIN) / 12).toFixed(2);
const noteName = (note) => trackerName(note).replace('-', '');
const bars = (steps) => {
  const n = steps / TRANSPORT.STEPS_PER_BAR;
  return n >= 1 ? `${n} bar${n === 1 ? '' : 's'}` : `${steps} 16ths`;
};
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Gate and CV columns, worked out from config so they match what's sent. */
export function describe(voice) {
  if (voice.kind === 'drum') {
    const cv = voice.range
      ? `pitched ${noteName(voice.range[0])}–${noteName(voice.range[1])} (${volts(voice.range[0])}–${volts(voice.range[1])} V)`
      : voice.accentNote != null && voice.accentNote !== voice.note
        ? `${volts(voice.note)} V, ${volts(voice.accentNote)} V on accents`
        : `fixed ${volts(voice.note)} V`;
    return { gate: `${voice.trigMs} ms trigger`, cv };
  }
  const [lo, hi] = voice.range;
  if (voice.kind === 'lfo') {
    const offset = voice.phase ? `, ${voice.phase * 360}° out of phase` : '';
    const shape = voice.shape === 'sh' ? 'sample & hold' : voice.shape;
    const gate = voice.gateMode === 'trigger' ? `${voice.trigMs} ms trigger per sample` : 'held high while playing';
    return { gate, cv: `${shape}, ${bars(voice.cycleSteps)}${offset}, ${volts(lo)}–${volts(hi)} V` };
  }
  return {
    gate: `${Math.round(voice.gate * 100)}% of each note`,
    cv: `V/oct ${noteName(lo)}–${noteName(hi)} (${volts(lo)}–${volts(hi)} V)`,
  };
}

/**
 * The wiring card: a dialog listing every jack with its gate behaviour, CV
 * range and the `patch` suggestion from config.js. Jacks no voice uses are
 * listed as free.
 */
export class Wiring {
  constructor({ dialog, rows, openButton, closeButton }) {
    this.dialog = dialog;
    this.openButton = openButton;
    this.closeButton = closeButton;
    rows.innerHTML = this.#rows();
    openButton.addEventListener('click', () => this.setOpen(true));
    closeButton.addEventListener('click', () => this.setOpen(false));
    // A click on the backdrop (outside the card) closes it.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.setOpen(false);
    });
  }

  get open() {
    return !this.dialog.hidden;
  }

  setOpen(open) {
    this.dialog.hidden = !open;
    (open ? this.closeButton : this.openButton).focus();
  }

  toggle() {
    this.setOpen(!this.open);
  }

  #rows() {
    const out = [];
    for (let slot = 0; slot < CV_SLOTS; slot += 1) {
      const voice = VOICES.find((v) => v.slot === slot);
      if (!voice) {
        out.push(`<tr class="is-unused"><td class="wiring__jack">${jackLabel(slot)}</td>`
          + '<td class="wiring__voice">—</td><td></td><td></td><td class="wiring__patch">Unused: free for your own patching.</td></tr>');
        continue;
      }
      const { gate, cv } = describe(voice);
      out.push(`<tr class="is-${voice.kind}"><td class="wiring__jack">${jackLabel(slot)}</td>`
        + `<td class="wiring__voice">${esc(voice.label)}</td><td class="wiring__gate">${esc(gate)}</td>`
        + `<td class="wiring__cv">${esc(cv)}</td><td class="wiring__patch">${esc(voice.patch ?? '')}</td></tr>`);
    }
    return out.join('');
  }
}
