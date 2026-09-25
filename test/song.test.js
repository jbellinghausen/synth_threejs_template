// Checks every toy's song. These hold for any toy: keep them passing.
// (Musical judgement calls, like repeated notes, are in `npm run report`.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CV_NOTE_MAX, CV_NOTE_MIN, STEPS_PER_BAR } from '../src/hardware.js';
import { SCALES } from '../src/framework/music/theory.js';
import { eventNote } from '../src/framework/engine/conductor.js';
import { useToy } from '../src/framework/toy.js';
import { allToys } from './helpers.js';

const BARS = 64;

/** Every key/scale the UI can set (if the song has keys), a few seeds (if it regenerates). */
function* variants(toy) {
  const probe = toy.createSong();
  const keys = typeof probe.setKey === 'function'
    ? Object.keys(SCALES).flatMap((scale) => Array.from({ length: 12 }, (_, root) => [root, scale]))
    : [null];
  const seeds = typeof probe.regenerate === 'function' ? [1, 2, 3] : [null];
  for (const key of keys) for (const seed of seeds) {
    const song = toy.createSong();
    if (seed != null) song.regenerate(seed);
    if (key) song.setKey(...key);
    yield { song, label: `key ${key ?? '-'} seed ${seed ?? '-'}` };
  }
}

/** Play `bars` bars the way the conductor does, calling fn(bar, step, events) per step. */
function walk(song, bars, fn) {
  song.resetPosition();
  for (let bar = 0; bar < bars; bar += 1) {
    if (bar > 0) song.advanceBar();
    for (let step = 0; step < STEPS_PER_BAR; step += 1) fn(bar, step, song.eventsAt(bar * STEPS_PER_BAR + step));
  }
}

for (const { toy } of await allToys()) {
  test(`${toy.id}: the song has the required methods`, () => {
    useToy(toy);
    const song = toy.createSong();
    for (const name of ['resetPosition', 'advanceBar', 'eventsAt']) assert.equal(typeof song[name], 'function', name);
  });

  test(`${toy.id}: every event is for a configured sound voice, with a note the DAC can play`, () => {
    useToy(toy);
    let count = 0;
    for (const { song, label } of variants(toy)) {
      walk(song, BARS, (bar, step, events) => {
        assert.ok(Array.isArray(events), `eventsAt must return an array (${label}, bar ${bar} step ${step})`);
        for (const e of events) {
          const where = `${label}, bar ${bar} step ${step}: ${JSON.stringify(e)}`;
          const voice = toy.voice[e.voice];
          assert.ok(voice, `unknown voice (${where})`);
          assert.notEqual(voice.kind, 'lfo', `songs must not emit LFO voices; the framework runs them (${where})`);
          const note = eventNote(e, voice);
          assert.ok(Number.isInteger(note), `note must be an integer MIDI note (${where})`);
          assert.ok(note >= CV_NOTE_MIN && note <= CV_NOTE_MAX, `note outside the DAC range ${CV_NOTE_MIN}-${CV_NOTE_MAX} (${where})`);
          if (voice.range) assert.ok(note >= voice.range[0] && note <= voice.range[1], `note outside ${e.voice}'s range ${voice.range} (${where})`);
          if (voice.kind === 'synth') assert.ok(e.steps > 0, `synth events need steps > 0 (${where})`);
          count += 1;
        }
      });
    }
    assert.ok(count > 0, 'the song never played anything');
  });

  test(`${toy.id}: eventsAt gives the same answer for any step of the current bar, whenever asked`, () => {
    // The conductor reads a whole bar at its first step; the tracker shows it.
    useToy(toy);
    const song = toy.createSong();
    song.resetPosition();
    for (let bar = 0; bar < BARS; bar += 1) {
      if (bar > 0) song.advanceBar();
      const read = () => JSON.stringify(Array.from({ length: STEPS_PER_BAR }, (_, i) => song.eventsAt(bar * STEPS_PER_BAR + i)));
      const first = read();
      assert.equal(read(), first, `bar ${bar} changed between reads`);
      for (let i = STEPS_PER_BAR - 1; i >= 0; i -= 1) song.eventsAt(bar * STEPS_PER_BAR + i);
      assert.equal(read(), first, `bar ${bar} depends on the order steps are read in`);
    }
  });

  test(`${toy.id}: optional features are complete if present`, () => {
    useToy(toy);
    const song = toy.createSong();
    if (song.sections) {
      assert.ok(Array.isArray(song.sections) && song.sections.every((s) => typeof s.name === 'string'), 'sections: [{ name }]');
      assert.ok(Number.isInteger(song.sectionIndex), 'sectionIndex');
      assert.equal(typeof song.queueSection, 'function', 'queueSection(i)');
    }
    if (song.setKey) {
      assert.ok(Number.isInteger(song.rootPc) && song.rootPc >= 0 && song.rootPc < 12, 'rootPc 0-11');
      assert.ok(song.scaleKey in SCALES, 'scaleKey must be a key of SCALES');
    }
    if ('caption' in song) assert.ok(song.caption == null || typeof song.caption === 'object', 'caption is { title, subtitle }');
    if (song.plays) assert.equal(typeof song.plays('x'), 'boolean', 'plays(id) returns a boolean');
    if ('controls' in song) {
      assert.ok(Array.isArray(song.controls), 'controls is an array');
      for (const c of song.controls) {
        assert.ok(c.id && c.label && typeof c.get === 'function' && typeof c.set === 'function', `control ${c.id}: { id, label, get, set }`);
        const before = c.get();
        c.set(!before);
        assert.equal(Boolean(c.get()), !before, `control ${c.id}: set() then get() round-trips`);
      }
    }
  });
}
