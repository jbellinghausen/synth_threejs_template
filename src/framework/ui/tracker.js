import { STEPS_PER_BAR, jackLabel } from '../../hardware.js';
import { voices } from '../toy.js';
import { trackerName } from '../music/theory.js';

const ROW_H = 17;
const COL_W = 40;
const ROWNUM_W = 26;
const HEADER_H = 34;
const FONT = '11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const COLORS = {
  bg: 'rgba(8, 10, 22, 0.66)',
  grid: 'rgba(214, 170, 90, 0.08)',
  beat: 'rgba(214, 170, 90, 0.05)',
  row: 'rgba(244, 197, 90, 0.2)',
  text: '#eadfc8',
  dim: 'rgba(234, 223, 200, 0.28)',
  empty: 'rgba(234, 223, 200, 0.14)',
  drum: '#f4c55a',
  accent: '#ff8f7a',
  lfo: '#4fe0a8',
  header: '#ffffff',
};

const isPitched = (voice) => voice.kind === 'synth' || (voice.kind === 'drum' && voice.range);

/**
 * Tracker-style pattern view: one column per voice, one row per step of the
 * current bar. Synths and pitched drums show note names, other drums show
 * hits (### accent, =o= hit, -o- ghost), LFO columns show the live output as
 * a level meter. Silent (muted / not soloed) columns are dimmed.
 */
export class Tracker {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.events = Array.from({ length: STEPS_PER_BAR }, () => []);
    this.row = -1;
    this.lfos = [];
    this.isSilent = () => false;
    this.dirty = true;
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = ROWNUM_W + COL_W * voices().length + 8;
    const h = HEADER_H + ROW_H * STEPS_PER_BAR + 8;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
    this.dirty = true;
  }

  /** The current bar: one array of events per step. */
  setBar(events) {
    this.events = events;
    this.dirty = true;
  }

  setRow(row) {
    this.row = row;
    this.dirty = true;
  }

  setLfos(lfos) {
    this.lfos = lfos;
    this.dirty = true;
  }

  /** `isSilent(id)` → true for voices to draw dimmed. */
  setSilence(isSilent) {
    this.isSilent = isSilent;
    this.dirty = true;
  }

  /** Redraws only when something changed; call every frame. */
  draw() {
    if (!this.dirty || this.canvas.getClientRects().length === 0) return; // skip while hidden; stays dirty
    this.dirty = false;
    const { ctx, width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.font = FONT;
    ctx.textBaseline = 'middle';

    voices().forEach((voice, c) => {
      const x = ROWNUM_W + c * COL_W;
      const silent = this.isSilent(voice.id);
      ctx.fillStyle = silent ? COLORS.dim : COLORS.header;
      ctx.fillText(jackLabel(voice.slot), x + 4, 10);
      ctx.fillStyle = silent ? COLORS.dim : voice.kind === 'lfo' ? COLORS.lfo : voice.kind === 'drum' ? COLORS.drum : COLORS.text;
      ctx.fillText(voice.label.slice(0, 5), x + 4, 24);
    });

    for (let r = 0; r < STEPS_PER_BAR; r += 1) {
      const y = HEADER_H + r * ROW_H;
      if (r % 4 === 0) {
        ctx.fillStyle = COLORS.beat;
        ctx.fillRect(0, y, w, ROW_H);
      }
      if (r === this.row) {
        ctx.fillStyle = COLORS.row;
        ctx.fillRect(0, y, w, ROW_H);
      }
      ctx.fillStyle = r === this.row ? COLORS.header : COLORS.dim;
      ctx.fillText(r.toString(16).toUpperCase().padStart(2, '0'), 5, y + ROW_H / 2);

      const byVoice = new Map((this.events[r] ?? []).map((e) => [e.voice, e]));
      voices().forEach((voice, c) => {
        if (voice.kind === 'lfo') return;
        const x = ROWNUM_W + c * COL_W + 4;
        const e = byVoice.get(voice.id);
        const silent = this.isSilent(voice.id);
        if (!e) {
          ctx.fillStyle = COLORS.empty;
          ctx.fillText('···', x, y + ROW_H / 2);
          return;
        }
        let label;
        if (isPitched(voice) && e.note != null) {
          label = trackerName(e.note);
          ctx.fillStyle = silent ? COLORS.dim : voice.kind === 'drum' ? COLORS.drum : COLORS.text;
        } else {
          label = e.ghost ? '-o-' : e.accent ? '###' : '=o=';
          ctx.fillStyle = silent ? COLORS.dim : e.accent ? COLORS.accent : COLORS.drum;
        }
        ctx.fillText(label, x, y + ROW_H / 2);
      });
    }

    // LFO columns: a live meter the full height of the pattern
    const top = HEADER_H;
    const height = ROW_H * STEPS_PER_BAR;
    for (const l of this.lfos) {
      const c = voices().indexOf(l.voice);
      const x = ROWNUM_W + c * COL_W + 6;
      const silent = this.isSilent(l.voice.id);
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(x, top, COL_W - 14, height);
      const level = l.value * height;
      ctx.fillStyle = silent ? COLORS.dim : COLORS.lfo;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, top + height - level, COL_W - 14, level);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.header;
      ctx.fillText(trackerName(l.note), x - 2, top + height - Math.max(level, 10) + 8);
    }
  }
}
