// Checks every toy in src/toys/index.js: its definition and its slot map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CV_NOTE_MAX, CV_NOTE_MIN, CV_SLOTS } from '../src/hardware.js';
import { TOYS } from '../src/toys/index.js';
import { allToys } from './helpers.js';

const toys = await allToys();

test('the registry lists each toy once, under its own id and name', () => {
  assert.ok(TOYS.length > 0, 'no toys registered');
  assert.equal(new Set(TOYS.map((t) => t.id)).size, TOYS.length, 'duplicate ids in src/toys/index.js');
  for (const { entry, toy } of toys) {
    assert.equal(toy.id, entry.id, `registry id "${entry.id}" loads a toy whose id is "${toy.id}"`);
    assert.equal(toy.name, entry.name, `${entry.id}: registry name "${entry.name}" doesn't match the toy's name "${toy.name}"`);
  }
});

for (const { toy } of toys) {
  test(`${toy.id}: every voice has a unique id and a unique slot in range`, () => {
    assert.ok(toy.voices.length > 0, 'no voices');
    assert.equal(new Set(toy.voices.map((v) => v.id)).size, toy.voices.length, 'duplicate voice ids');
    assert.equal(new Set(toy.voices.map((v) => v.slot)).size, toy.voices.length, 'two voices on one slot');
    for (const v of toy.voices) assert.ok(Number.isInteger(v.slot) && v.slot >= 0 && v.slot < CV_SLOTS, `${v.id}: slot ${v.slot}`);
  });

  test(`${toy.id}: every voice has the fields its kind needs`, () => {
    for (const v of toy.voices) {
      assert.ok(v.label && v.patch, `${v.id}: label and patch`);
      if (v.kind === 'synth') assert.ok(v.range && v.gate > 0 && v.gate <= 1, `${v.id}: range, gate`);
      else if (v.kind === 'drum') assert.ok(v.trigMs > 0 && (v.note != null || v.range), `${v.id}: trigMs, note or range`);
      else if (v.kind === 'lfo') assert.ok(v.range && v.cycleSteps > 0 && ['sine', 'triangle', 'saw', 'square', 'sh'].includes(v.shape), `${v.id}: lfo fields`);
      else assert.fail(`${v.id}: unknown kind ${v.kind}`);
    }
  });

  test(`${toy.id}: every configured note is inside the DAC range`, () => {
    for (const v of toy.voices) {
      for (const n of [...(v.range ?? []), v.note, v.accentNote].filter((x) => x != null)) {
        assert.ok(n >= CV_NOTE_MIN && n <= CV_NOTE_MAX, `${v.id}: note ${n}`);
      }
    }
  });

  test(`${toy.id}: tempo defaults are sane`, () => {
    const { BPM_MIN, BPM_MAX, BPM_DEFAULT } = toy.transport;
    assert.ok(BPM_MIN > 0 && BPM_MIN <= BPM_DEFAULT && BPM_DEFAULT <= BPM_MAX, `${BPM_MIN} <= ${BPM_DEFAULT} <= ${BPM_MAX}`);
  });
}
