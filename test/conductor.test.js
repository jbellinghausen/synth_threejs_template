import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conductor } from '../src/framework/engine/conductor.js';
import { CV_SLOTS, TRANSPORT, TUNE, VOICES } from '../src/config.js';
import { fakeSynth } from './helpers.js';

// These run against whatever voices config.js defines.

// Any sound voice (synth or drum) will do for mute / solo.
const synthIds = VOICES.filter((v) => v.kind !== 'lfo').map((v) => v.id);
const lfoIds = VOICES.filter((v) => v.kind === 'lfo').map((v) => v.id);

/** A song that plays every voice on every step. */
const everything = {
  resetPosition() {},
  advanceBar: () => ({}),
  eventsAt: (abs) => VOICES.filter((v) => v.kind !== 'lfo').map((v) => ({ voice: v.id, note: 48, steps: 1, abs })),
};

test('reads the whole bar at its first step and reports it', () => {
  let reported = null;
  const c = new Conductor({ synth: fakeSynth(), song: everything, onBar: ({ events }) => (reported = events) });
  c.sequencer.onStep(0, 0, 125);
  assert.equal(reported.length, TRANSPORT.STEPS_PER_BAR);
  assert.equal(reported[5][0].abs, 5);
});

test('solo silences other sound voices but leaves LFOs running', () => {
  const synth = fakeSynth();
  const c = new Conductor({ synth, song: everything });
  const [first] = synthIds;
  c.setSoloed(first, true);
  for (const v of VOICES) {
    const expected = v.id === first || v.kind === 'lfo';
    assert.equal(c.isAudible(v.id), expected, v.id);
  }
  // gates closed on everything that went silent, and nothing else
  const closed = synth.sent.filter((s) => s.op === 'off').map((s) => s.slot).sort((a, b) => a - b);
  const silenced = VOICES.filter((v) => v.id !== first && v.kind !== 'lfo').map((v) => v.slot).sort((a, b) => a - b);
  assert.deepEqual(closed, silenced);
});

test('mute wins over solo, and silent voices are not sent', () => {
  const synth = fakeSynth();
  const c = new Conductor({ synth, song: everything });
  const [first] = synthIds;
  c.setSoloed(first, true);
  c.setMuted(first, true);
  assert.equal(c.isAudible(first), false);
  synth.sent.length = 0;
  c.sequencer.onStep(0, 0, 125);
  assert.equal(synth.sent.filter((s) => s.op === 'play').length, 0);
});

test('muting an LFO stops it; solo does not', () => {
  const c = new Conductor({ synth: fakeSynth(), song: everything });
  if (!lfoIds.length) return;
  c.setSoloed(synthIds[0], true);
  assert.equal(c.lfo.muted.size, 0);
  c.setMuted(lfoIds[0], true);
  assert.deepEqual([...c.lfo.muted], [lfoIds[0]]);
});

test('tune sets every slot to the tune note and holds only synth gates', () => {
  const synth = fakeSynth();
  const c = new Conductor({ synth, song: everything });
  c.setTuning(true);
  const holds = synth.sent.filter((s) => s.op === 'hold');
  assert.equal(holds.length, CV_SLOTS);
  assert.ok(holds.every((s) => s.note === TUNE.NOTE));
  const closed = new Set(synth.sent.filter((s) => s.op === 'off').map((s) => s.slot));
  for (let slot = 0; slot < CV_SLOTS; slot += 1) {
    const isSynth = VOICES.find((v) => v.slot === slot)?.kind === 'synth';
    assert.equal(closed.has(slot), !isSynth, `slot ${slot}`);
  }
  c.setTuning(false);
  assert.equal(synth.sent.at(-1).op, 'panic');
});
