import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CV_NOTE_MAX, CV_NOTE_MIN, CV_SLOTS, VOICES } from '../src/config.js';

test('every voice has a unique id and a unique slot in range', () => {
  assert.equal(new Set(VOICES.map((v) => v.id)).size, VOICES.length);
  assert.equal(new Set(VOICES.map((v) => v.slot)).size, VOICES.length);
  for (const v of VOICES) assert.ok(Number.isInteger(v.slot) && v.slot >= 0 && v.slot < CV_SLOTS, `${v.id}: slot ${v.slot}`);
});

test('every voice has the fields its kind needs', () => {
  for (const v of VOICES) {
    assert.ok(v.label && v.patch, `${v.id}: label and patch`);
    if (v.kind === 'synth') assert.ok(v.range && v.gate > 0 && v.gate <= 1, `${v.id}: range, gate`);
    else if (v.kind === 'drum') assert.ok(v.trigMs > 0 && (v.note != null || v.range), `${v.id}: trigMs, note or range`);
    else if (v.kind === 'lfo') assert.ok(v.range && v.cycleSteps > 0 && ['sine', 'triangle', 'saw', 'square', 'sh'].includes(v.shape), `${v.id}: lfo fields`);
    else assert.fail(`${v.id}: unknown kind ${v.kind}`);
  }
});

test('every configured note is inside the DAC range', () => {
  for (const v of VOICES) {
    const notes = [...(v.range ?? []), v.note, v.accentNote].filter((n) => n != null);
    for (const n of notes) assert.ok(n >= CV_NOTE_MIN && n <= CV_NOTE_MAX, `${v.id}: note ${n}`);
  }
});
