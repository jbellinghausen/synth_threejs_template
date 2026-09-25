// Which song and visual make up this toy. This is the one place they're
// named: the app (main.js), the tests and `npm run report` all read it.
//
// Keep this file free of browser-only code at import time: the tests and the
// report import it under Node. (Creating the visual needs a browser; importing
// its module does not.)

import { ExampleSong } from './song/example-song.js';
import { ExampleVisual } from './visual/example-visual.js';

export const toy = {
  createSong: () => new ExampleSong(),
  createVisual: (runtime) => new ExampleVisual(runtime),
};
