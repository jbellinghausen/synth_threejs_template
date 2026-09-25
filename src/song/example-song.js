// An example song, to replace. It shows the whole song interface in as little
// music as possible: a kick and hat, an offbeat bass, a held pad and a lead
// arpeggio over a four-chord loop, in three sections.
//
// The only hard requirements are resetPosition(), advanceBar() and
// eventsAt(abs) (see src/framework/engine/conductor.js). Everything else here
// is optional and switches on part of the UI (see src/framework/app.js).

import { TRANSPORT, VOICE } from '../config.js';
import {
  NOTE_NAMES, SCALES, chordPcs, degreeOffset, euclid, fitRange, mulberry32,
} from '../framework/music/theory.js';

const { STEPS_PER_BAR } = TRANSPORT;
const SECTION_BARS = 8;
const PROGRESSION = [0, 5, 3, 4]; // scale degrees, one chord per bar

/** Which voices play in each section. LFOs aren't listed: the framework runs them. */
const SECTIONS = [
  { name: 'INTRO', layers: ['pad', 'lead'] },
  { name: 'GROOVE', layers: ['pad', 'lead', 'kick', 'hat', 'bass'] },
  { name: 'BREAK', layers: ['pad', 'lead', 'hat'] },
];

export class ExampleSong {
  constructor() {
    this.rootPc = 9; // A
    this.scaleKey = 'minor';
    this.sections = SECTIONS;
    this.sectionIndex = 0;
    this.pendingSection = null;
    this.evolve = true;
    this.lfoRate = 1;
    this.resetPosition();
    this.regenerate();
  }

  // --- required ---------------------------------------------------------------

  /** Called on Play. */
  resetPosition() {
    this.bar = 0;
    this.barInSection = 0;
  }

  /** Called at the top of every bar except the first. The return value is passed to onBar. */
  advanceBar() {
    this.bar += 1;
    this.barInSection += 1;
    let sectionChanged = false;
    if (this.pendingSection != null) {
      this.sectionIndex = this.pendingSection;
      this.pendingSection = null;
      this.barInSection = 0;
      sectionChanged = true;
    } else if (this.barInSection >= SECTION_BARS) {
      this.barInSection = 0;
      if (this.evolve) {
        this.sectionIndex = (this.sectionIndex + 1) % SECTIONS.length;
        sectionChanged = true;
      }
    }
    return { sectionChanged };
  }

  /**
   * Events starting on absolute step `abs`. The conductor asks for all 16
   * steps of a bar at its start (that's how the tracker shows the bar before
   * it plays), so this depends only on state that's fixed for the bar.
   */
  eventsAt(abs) {
    const step = abs % STEPS_PER_BAR;
    const degree = PROGRESSION[this.bar % PROGRESSION.length];
    const intervals = SCALES[this.scaleKey].intervals;
    const root = this.rootPc + degreeOffset(intervals, degree);
    const events = [];
    const add = (event) => {
      if (this.plays(event.voice)) events.push(event);
    };

    // Drums: `accent` raises the drum's CV to its accentNote.
    if (step % 4 === 0) add({ voice: 'kick', note: VOICE.kick.note, accent: step === 0 });
    if (this.hatRhythm[step]) {
      const accent = step % 4 === 2;
      add({ voice: 'hat', note: accent ? VOICE.hat.accentNote : VOICE.hat.note, accent, ghost: !accent });
    }

    // Synths: `steps` is the note length in 16ths; the gate is held for
    // that × the voice's `gate` fraction from config.js.
    if (step % 4 === 2) add({ voice: 'bass', note: fitRange(root, ...VOICE.bass.range), steps: 2 });
    if (step === 0) add({ voice: 'pad', note: fitRange(root, ...VOICE.pad.range), steps: STEPS_PER_BAR });

    // Lead: an arpeggio over the chord's tones, in the order this seed picked.
    if (step % 2 === 0) {
      const pcs = chordPcs(this.rootPc, intervals, degree, 3);
      const [lo, hi] = VOICE.lead.range;
      const tones = [];
      for (let n = lo; n <= hi; n += 1) if (pcs.includes(n % 12)) tones.push(n);
      const note = tones[this.arpOrder[(step / 2) % this.arpOrder.length] % tones.length];
      add({ voice: 'lead', note, steps: 2 });
    }
    return events;
  }

  // --- optional: each switches on part of the UI --------------------------------

  /** Whether a voice is in the arrangement right now (dims it in the UI and visual). */
  plays(id) {
    return SECTIONS[this.sectionIndex].layers.includes(id);
  }

  /** The New button: new arp order and hat rhythm. */
  regenerate(seed = Math.floor(Math.random() * 2 ** 31)) {
    const rng = mulberry32(seed);
    this.arpOrder = Array.from({ length: 8 }, () => Math.floor(rng() * 6));
    this.hatRhythm = euclid(5 + Math.floor(rng() * 4), STEPS_PER_BAR, Math.floor(rng() * STEPS_PER_BAR));
  }

  /** The root and scale menus. */
  setKey(rootPc, scaleKey) {
    this.rootPc = rootPc;
    this.scaleKey = scaleKey;
  }

  /** The section menu and 1-9 keys: jump at the next bar line. */
  queueSection(index) {
    this.pendingSection = index;
  }

  /** Shown above the slots: the title flashes when it changes. */
  get caption() {
    const intervals = SCALES[this.scaleKey].intervals;
    const degree = PROGRESSION[this.bar % PROGRESSION.length];
    return {
      title: SECTIONS[this.sectionIndex].name,
      subtitle: `${NOTE_NAMES[(this.rootPc + degreeOffset(intervals, degree)) % 12]} ${SCALES[this.scaleKey].label}`,
    };
  }
}
