import { useToy } from '../src/framework/toy.js';
import { TOYS, loadToy } from '../src/toys/index.js';

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

/** Every toy in the registry, loaded: [{ entry, toy }]. */
export async function allToys() {
  return Promise.all(TOYS.map(async (entry) => ({ entry, toy: await loadToy(entry.id) })));
}

/** Load a toy and make it the active one (the framework reads its voices). */
export async function activate(id) {
  const toy = await loadToy(id);
  useToy(toy);
  return toy;
}
