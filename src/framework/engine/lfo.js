import { VOICES } from '../../config.js';
import { hash } from '../music/theory.js';

const TAU = Math.PI * 2;

/** Unipolar shapes, 0..1, each starting at 0 on phase 0. */
const SHAPES = {
  sine: (ph) => 0.5 - 0.5 * Math.cos(ph * TAU),
  triangle: (ph) => (ph < 0.5 ? ph * 2 : 2 - ph * 2),
  saw: (ph) => ph,
  square: (ph) => (ph < 0.5 ? 1 : 0),
};

/**
 * Tempo-synced LFOs on CV slots. Phase advances with song position, so they
 * stay locked to the beat and follow tempo changes.
 *
 * Pitch CV only takes whole notes, so each LFO moves in 1/12 V steps; values
 * are sent only when the quantised note changes, which keeps I2C traffic on
 * the Pi down to a few writes per second per LFO.
 */
export class LfoBank {
  constructor(synth) {
    this.synth = synth;
    this.rate = 1;
    this.seed = 1;
    this.muted = new Set();
    this.lfos = VOICES.filter((v) => v.kind === 'lfo').map((voice) => ({
      voice, cycles: voice.phase ?? 0, value: 0, note: voice.range[0], sent: null, sample: -1, fresh: false,
    }));
    this.lastPos = null;
  }

  setRate(rate) {
    this.rate = rate;
  }

  reset() {
    this.lastPos = null;
    this.seed = Math.floor(Math.random() * 2 ** 31);
    for (const l of this.lfos) Object.assign(l, { cycles: l.voice.phase ?? 0, sent: null, sample: -1 });
  }

  /** Forget what was sent, so every output is re-sent (after reconnect/unmute). */
  resend() {
    for (const l of this.lfos) l.sent = null;
  }

  update(pos) {
    const dPos = this.lastPos == null ? 0 : Math.max(0, pos - this.lastPos);
    this.lastPos = pos;

    for (const l of this.lfos) {
      const { voice } = l;
      l.cycles += (dPos * this.rate) / voice.cycleSteps;
      l.fresh = false;

      if (voice.shape === 'sh') {
        const index = Math.floor(l.cycles);
        if (index !== l.sample) {
          l.sample = index;
          l.value = hash(this.seed, index, voice.slot);
          l.fresh = true;
        }
      } else {
        l.value = SHAPES[voice.shape](l.cycles % 1);
      }

      const [lo, hi] = voice.range;
      l.note = Math.round(lo + l.value * (hi - lo));
      if (this.muted.has(voice.id)) continue;

      if (voice.gateMode === 'trigger') {
        if (l.fresh || l.sent == null) {
          this.synth.playCv(voice.slot, l.note, voice.trigMs);
          l.sent = l.note;
        }
      } else if (l.note !== l.sent && this.synth.holdCv(voice.slot, l.note)) {
        l.sent = l.note;
      }
    }
  }
}
