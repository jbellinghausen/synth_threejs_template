// Tests for the example song. Delete this along with the song, or copy it to
// check yours: range checks catch notes the DAC would clamp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExampleSong } from '../src/song/example-song.js';
import { CV_NOTE_MAX, CV_NOTE_MIN, TRANSPORT, VOICE } from '../src/config.js';
import { SCALES } from '../src/framework/music/theory.js';

test('every event is for a known voice, in range, in every key and section', () => {
  let count = 0;
  for (const scale of Object.keys(SCALES)) for (let root = 0; root < 12; root += 1) for (let seed = 1; seed <= 5; seed += 1) {
    const song = new ExampleSong();
    song.regenerate(seed);
    song.setKey(root, scale);
    for (let s = 0; s < song.sections.length; s += 1) {
      song.sectionIndex = s;
      for (let bar = 0; bar < 4; bar += 1) {
        song.bar = bar;
        for (let step = 0; step < TRANSPORT.STEPS_PER_BAR; step += 1) {
          for (const e of song.eventsAt(bar * TRANSPORT.STEPS_PER_BAR + step)) {
            const voice = VOICE[e.voice];
            assert.ok(voice, `unknown voice ${e.voice}`);
            assert.notEqual(voice.kind, 'lfo', 'songs do not play LFOs');
            assert.ok(e.note >= CV_NOTE_MIN && e.note <= CV_NOTE_MAX, `${e.voice} ${e.note}`);
            if (voice.range) assert.ok(e.note >= voice.range[0] && e.note <= voice.range[1], `${e.voice} ${e.note} ${voice.range}`);
            count += 1;
          }
        }
      }
    }
  }
  assert.ok(count > 1000);
});

test('eventsAt is stable within a bar (the tracker relies on it)', () => {
  const song = new ExampleSong();
  song.sectionIndex = 1;
  const read = () => JSON.stringify(Array.from({ length: 16 }, (_, i) => song.eventsAt(i)));
  assert.equal(read(), read());
});

test('sections advance every 8 bars when evolving, and jumps land on the next bar', () => {
  const song = new ExampleSong();
  const seen = [];
  for (let bar = 1; bar <= 24; bar += 1) if (song.advanceBar().sectionChanged) seen.push([bar, song.sectionIndex]);
  assert.deepEqual(seen, [[8, 1], [16, 2], [24, 0]]);
  song.queueSection(2);
  assert.equal(song.advanceBar().sectionChanged, true);
  assert.equal(song.sectionIndex, 2);
});
