import { defineToy } from '../../framework/toy.js';
import { TRANSPORT, VOICES } from './config.js';
import { PulseSong } from './song.js';
import { PulseVisual } from './visual.js';

export default defineToy({
  id: 'pulse',
  name: 'PULSE',
  description: 'A minimal kick, bass and blip loop: the smallest complete toy',
  voices: VOICES,
  transport: TRANSPORT,
  createSong: () => new PulseSong(),
  createVisual: (runtime) => new PulseVisual(runtime),
});
