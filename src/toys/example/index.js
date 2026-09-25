// The toy's definition: what the registry (src/toys/index.js) loads.

import { defineToy } from '../../framework/toy.js';
import { TRANSPORT, VISUALS, VOICES } from './config.js';
import { ExampleSong } from './song.js';
import { ExampleVisual } from './visual.js';

export default defineToy({
  id: 'example',
  name: 'EXAMPLE',
  description: 'Kick, hat, bass, pad and an arp over four chords, in three sections',
  voices: VOICES,
  transport: TRANSPORT,
  visuals: VISUALS,
  createSong: () => new ExampleSong(),
  createVisual: (runtime, song) => new ExampleVisual(runtime, song),
});
