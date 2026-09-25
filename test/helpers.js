// A stand-in for SynthLink that records what would be sent.
export function fakeSynth() {
  const sent = [];
  return {
    sent,
    playCv: (slot, note, ms) => sent.push({ op: 'play', slot, note, ms }),
    holdCv: (slot, note) => (sent.push({ op: 'hold', slot, note }), true),
    gateOff: (slot) => sent.push({ op: 'off', slot }),
    panic: () => sent.push({ op: 'panic' }),
  };
}
