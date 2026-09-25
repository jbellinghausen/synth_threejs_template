// The smallest useful song: only the three required methods. Kick on the
// beat, an eighth-note bass alternating root and fifth, and blips on a
// euclidean rhythm walking a minor pentatonic scale.

import { STEPS_PER_BAR } from '../../hardware.js';
import { SCALES, euclid, scaleNotes } from '../../framework/music/theory.js';
import { VOICE } from './config.js';

const ROOT = 2; // D
const BLIPS = euclid(5, STEPS_PER_BAR);
const PATH = [0, 2, 1, 3, 2, 4, 3, 1]; // positions in the blip pool, one per blip

export class PulseSong {
  resetPosition() {
    this.bar = 0;
  }

  advanceBar() {
    this.bar += 1;
    return {};
  }

  eventsAt(abs) {
    const step = abs % STEPS_PER_BAR;
    const events = [];
    if (step % 4 === 0) events.push({ voice: 'kick' });
    if (step % 2 === 0) {
      const [lo] = VOICE.bass.range;
      const root = lo + ((ROOT - lo) % 12 + 12) % 12; // lowest D in range
      events.push({ voice: 'bass', note: step % 8 === 4 ? root - 5 : root, steps: 2 }); // the fifth below
    }
    if (BLIPS[step]) {
      const pool = scaleNotes(ROOT, SCALES.minorPent.intervals, ...VOICE.blip.range);
      const nth = BLIPS.slice(0, step).filter(Boolean).length + this.bar * 5; // which blip overall
      events.push({ voice: 'blip', note: pool[PATH[nth % PATH.length] % pool.length], steps: 1 });
    }
    return events;
  }
}
