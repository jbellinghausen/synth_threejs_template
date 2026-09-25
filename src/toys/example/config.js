// This toy's settings: its slot map, tempo and visual defaults.
// Shared hardware settings (the Pi, CV limits) are in src/hardware.js.

/**
 * The slot map: one entry per jack this toy uses. Jacks not listed stay silent
 * and show as free in the wiring card.
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

export const TRANSPORT = { BPM_MIN: 60, BPM_MAX: 180, BPM_DEFAULT: 120 };

/** Overrides for the framework's visual defaults (see src/framework/toy.js). */
export const VISUALS = { TILT_DEFAULT: 55 };
