import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LfoBank } from '../src/framework/engine/lfo.js';
import { useToy } from '../src/framework/toy.js';
import { allToys, fakeSynth } from './helpers.js';

const toys = await allToys();

for (const { toy } of toys) {
test(`${toy.id}: LFOs half a cycle apart are complementary (a crossfade)`, (t) => {
  useToy(toy);
  const VOICES = toy.voices;
  const pair = VOICES.filter((v) => v.kind === 'lfo' && v.shape === 'sine');
  const a = pair.find((v) => !v.phase);
  const b = pair.find((v) => v.phase === 0.5 && v.cycleSteps === a?.cycleSteps);
  if (!a || !b) return t.skip('no crossfade pair in config');
  const bank = new LfoBank(fakeSynth());
  bank.reset();
  const la = bank.lfos.find((l) => l.voice === a);
  const lb = bank.lfos.find((l) => l.voice === b);
  for (let pos = 0; pos <= a.cycleSteps * 2; pos += 0.37) {
    bank.update(pos);
    assert.ok(Math.abs(la.value + lb.value - 1) < 1e-9, `values at ${pos}`);
    assert.ok(Math.abs(la.note + lb.note - (a.range[0] + a.range[1])) <= 1, `notes at ${pos}`);
  }
});

test(`${toy.id}: held LFOs only send when the note changes`, () => {
  useToy(toy);
  const synth = fakeSynth();
  const bank = new LfoBank(synth);
  bank.reset();
  for (let pos = 0; pos < 64; pos += 0.05) bank.update(pos);
  const bySlot = {};
  for (const s of synth.sent.filter((s) => s.op === 'hold')) (bySlot[s.slot] ??= []).push(s.note);
  for (const notes of Object.values(bySlot)) {
    for (let i = 1; i < notes.length; i += 1) assert.notEqual(notes[i], notes[i - 1]);
  }
});

test(`${toy.id}: sample & hold triggers once per sample`, (t) => {
  useToy(toy);
  const snh = toy.voices.find((v) => v.kind === 'lfo' && v.shape === 'sh');
  if (!snh) return t.skip('no S&H in config');
  const synth = fakeSynth();
  const bank = new LfoBank(synth);
  bank.reset();
  const cycles = 10;
  for (let pos = 0; pos < snh.cycleSteps * cycles; pos += 0.1) bank.update(pos);
  const triggers = synth.sent.filter((s) => s.op === 'play' && s.slot === snh.slot).length;
  assert.equal(triggers, cycles);
});
}
