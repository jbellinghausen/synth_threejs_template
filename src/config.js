// Everything a toy configures: its name, the slot map, tempo and network.
// The framework reads this file; songs and visuals read it too.

export const APP = {
  NAME: 'SYNTH TOY',
  /** localStorage keys are prefixed with this, so toys don't share settings. */
  STORAGE_PREFIX: 'synth-toy',
};

export const NETWORK = {
  DEFAULT_HOST: 'raspberrypi.local',
  FALLBACK_HOST: '192.168.1.234',
  PORT: 9743,
  RETRY_MS: 2000,
  PING_INTERVAL_MS: 3000,
};

/** Hardware limit: 1 V/oct, note 24 = 0 V, clamping at 3.3 V (note 63 = 3.25 V). */
export const CV_NOTE_MIN = 24;
export const CV_NOTE_MAX = 63;
export const CV_SLOTS = 12;

/**
 * The panel labels its jacks 1-12, the protocol numbers slots 0-11. The UI
 * shows panel numbers; every `slot` in this file is a protocol slot
 * (jack - 1). Set to 0 to show protocol numbers instead.
 */
export const JACK_OFFSET = 1;
export const jackLabel = (slot) => String(slot + JACK_OFFSET).padStart(2, '0');

/**
 * One entry per slot the toy uses. Slots not listed stay silent and show as
 * unused in the wiring card.
 *
 * Common fields: id (what songs emit), slot (protocol slot 0-11), kind,
 * label (UI, up to ~7 chars), patch (the wiring card's suggestion).
 *
 * kind 'synth' — CV is V/oct, gate held for `gate` × the note's length.
 *                `range` is the note window the song should stay inside.
 * kind 'drum'  — gate is a trigger of `trigMs`. CV holds `note`, or
 *                `accentNote` on accented hits (for a tune/decay/accent input).
 *                Set `range` instead for a pitched drum whose CV follows the
 *                song's notes; the tracker then shows note names for it.
 * kind 'lfo'   — CV is modulation, run by the framework's LFO bank, not the
 *                song. The protocol only carries whole notes, so it moves in
 *                1/12 V (83 mV) steps across `range`. `shape`: sine, triangle,
 *                saw, square or sh (sample & hold). `cycleSteps`: period in
 *                16ths. `phase`: offset 0-1 (0.5 on a copy = a crossfade
 *                partner). gateMode 'hold' keeps the gate high while playing;
 *                'trigger' pulses it for `trigMs` on each new S&H sample.
 */
export const VOICES = [
  { id: 'lead', slot: 0, kind: 'synth', label: 'LEAD', range: [48, 60], gate: 0.5,
    patch: 'The arpeggio. A bright pluck: fast attack, short decay.' },
  { id: 'kick', slot: 1, kind: 'drum', label: 'KICK', note: 36, accentNote: 36, trigMs: 15,
    patch: 'Trigger on the gate. CV to the tune input if it has one.' },
  { id: 'hat', slot: 3, kind: 'drum', label: 'HAT', note: 36, accentNote: 48, trigMs: 10,
    patch: 'Trigger on the gate. CV rises on accents: patch it to decay or level if the hat has an input.' },
  { id: 'bass', slot: 6, kind: 'synth', label: 'BASS', range: [28, 40], gate: 0.7,
    patch: 'Chord roots on the offbeat. A round bass voice.' },
  { id: 'pad', slot: 8, kind: 'synth', label: 'PAD', range: [36, 48], gate: 0.95,
    patch: 'One held note per chord. A slow pad: long attack and release.' },
  { id: 'lfoA', slot: 9, kind: 'lfo', label: 'LFO A', shape: 'sine', cycleSteps: 64, phase: 0, range: [24, 63], gateMode: 'hold',
    patch: 'Slow sine, 4 bars. With LFO B: to two VCAs for a crossfade, or to a filter.' },
  { id: 'lfoB', slot: 10, kind: 'lfo', label: 'LFO B', shape: 'sine', cycleSteps: 64, phase: 0.5, range: [24, 63], gateMode: 'hold',
    patch: 'LFO A half a cycle later: A + B always add up to full scale.' },
  { id: 'snh', slot: 11, kind: 'lfo', label: 'S&H', shape: 'sh', cycleSteps: 4, range: [24, 63], gateMode: 'trigger', trigMs: 10,
    patch: 'A new random voltage every beat, with a trigger on the gate: to a filter, or clock something from the gate.' },
];

export const VOICE = Object.fromEntries(VOICES.map((v) => [v.id, v]));

export const TRANSPORT = {
  STEPS_PER_BAR: 16,
  BPM_MIN: 60,
  BPM_MAX: 180,
  BPM_DEFAULT: 120,
};

/**
 * Tune mode: every CV slot to one note (48 = C3 = 2.0 V), gates held high on
 * the synth voices so their oscillators sound.
 */
export const TUNE = { NOTE: 48 };

export const LFO = {
  /** How often LFO outputs are recomputed. Values are only sent on change. */
  TICK_MS: 20,
};

export const VISUALS = {
  /** Render scale as a fraction of the screen's pixels; drops (never above 1) to hold the frame rate. */
  RENDER_SCALE: 1,
  RENDER_SCALE_MIN: 0.4,
  RENDER_SCALE_MAX: 1,
  /** Frame-time band the adaptive resolution aims for, in ms. */
  TARGET_FRAME_MS: [12, 19],
  /** Default camera tilt for the View slider, degrees above the horizon. */
  TILT_DEFAULT: 55,
};

export function stepMsFor(bpm) {
  return 60000 / bpm / 4;
}
