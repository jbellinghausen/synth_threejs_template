// Music helpers for songs: scales, note names, chords, seeded randomness.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  minor:     { label: 'Aeolian (minor)',  intervals: [0, 2, 3, 5, 7, 8, 10] },
  major:     { label: 'Ionian (major)',   intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian:    { label: 'Dorian',           intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian:  { label: 'Phrygian',         intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian:    { label: 'Lydian',           intervals: [0, 2, 4, 6, 7, 9, 11] },
  harmonic:  { label: 'Harmonic minor',   intervals: [0, 2, 3, 5, 7, 8, 11] },
  majorPent: { label: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  minorPent: { label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  pelog:     { label: 'Pelog (approx.)',  intervals: [0, 1, 3, 7, 8] },
};

/** Tracker-style name: note 24 is C-1, 48 is C-3. */
export function trackerName(note) {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  return (name.length === 1 ? `${name}-` : name) + (Math.floor(note / 12) - 1);
}

/** Semitone offset of a (possibly negative or >7) scale degree. */
export function degreeOffset(intervals, degree) {
  const n = intervals.length;
  const octave = Math.floor(degree / n);
  return intervals[((degree % n) + n) % n] + 12 * octave;
}

/** Shift `note` by octaves until it sits in [lo, hi] (or as close as it can). */
export function fitRange(note, lo, hi) {
  let n = note;
  while (n < lo) n += 12;
  while (n > hi && n - 12 >= lo) n -= 12;
  return n;
}

/** Every note of the scale inside [lo, hi], ascending. */
export function scaleNotes(rootPc, intervals, lo, hi) {
  const out = [];
  for (let n = lo; n <= hi; n += 1) {
    if (intervals.includes((((n - rootPc) % 12) + 12) % 12)) out.push(n);
  }
  return out;
}

/**
 * Pitch classes (0-11) of the chord on `degree`, stacking every other scale
 * degree. In a 7-note scale that's a 7th chord; in a pentatonic it's an open,
 * quartal voicing.
 */
export function chordPcs(rootPc, intervals, degree, size = 4) {
  return Array.from({ length: size }, (_, k) => (rootPc + degreeOffset(intervals, degree + 2 * k)) % 12);
}

// --- Deterministic randomness ------------------------------------------------
// Seeded, so a song can be a pure function of (seed, bar, step): the tracker
// can then show a bar before it is heard.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash any integers to [0, 1). */
export function hash(...values) {
  let h = 0x811c9dc5;
  for (const v of values) {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Euclidean rhythm: `hits` spread over `steps`, rotated by `rotate`. */
export function euclid(hits, steps, rotate = 0) {
  const out = new Array(steps).fill(0);
  for (let i = 0; i < steps; i += 1) {
    if (Math.floor(((i + rotate) * hits) / steps) !== Math.floor(((i + rotate - 1) * hits) / steps)) out[i] = 1;
  }
  return out;
}
