// A second, minimal toy: it shows a different slot map and a song with none
// of the optional features, so the panel shows only the basics.

export const VOICES = [
  { id: 'blip', slot: 0, kind: 'synth', label: 'BLIP', range: [48, 60], gate: 0.3,
    patch: 'A short, bright blip: fast attack, very short decay.' },
  { id: 'kick', slot: 1, kind: 'drum', label: 'KICK', note: 36, trigMs: 15,
    patch: 'Trigger on the gate.' },
  { id: 'bass', slot: 6, kind: 'synth', label: 'BASS', range: [28, 40], gate: 0.5,
    patch: 'An eighth-note bass pulse. A punchy bass voice with some filter envelope.' },
  { id: 'sweep', slot: 11, kind: 'lfo', label: 'SWEEP', shape: 'triangle', cycleSteps: 128, range: [24, 63], gateMode: 'hold',
    patch: 'An 8-bar rise and fall: to the bass filter cutoff.' },
];

export const VOICE = Object.fromEntries(VOICES.map((v) => [v.id, v]));

export const TRANSPORT = { BPM_MIN: 100, BPM_MAX: 150, BPM_DEFAULT: 126 };
