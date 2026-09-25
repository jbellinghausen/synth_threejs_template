// Pick the song and visual. Everything else is the framework.

import { startApp } from './framework/app.js';
import { ExampleSong } from './song/example-song.js';
import { ExampleVisual } from './visual/example-visual.js';

startApp({
  song: new ExampleSong(),
  createVisual: (runtime) => new ExampleVisual(runtime),
});
