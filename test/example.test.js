// Tests specific to the example toy's song. Delete this file along with the
// toy; test/song.test.js checks every toy's song generically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExampleSong } from '../src/toys/example/song.js';

test('sections advance every 8 bars when evolving, and jumps land on the next bar', () => {
  const song = new ExampleSong();
  const seen = [];
  for (let bar = 1; bar <= 24; bar += 1) if (song.advanceBar().sectionChanged) seen.push([bar, song.sectionIndex]);
  assert.deepEqual(seen, [[8, 1], [16, 2], [24, 0]]);
  song.queueSection(2);
  assert.equal(song.advanceBar().sectionChanged, true);
  assert.equal(song.sectionIndex, 2);
});
