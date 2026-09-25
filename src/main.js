// Browser entry point: pick a toy, make it active, start the app.
// The toy comes from ?toy=<id>, else the last one picked, else the first in
// src/toys/index.js.

import { sharedStore, startApp } from './framework/app.js';
import { useToy } from './framework/toy.js';
import { TOYS, loadToy } from './toys/index.js';

const requested = new URLSearchParams(location.search).get('toy') || sharedStore.get('toy');
const id = TOYS.some((t) => t.id === requested) ? requested : TOYS[0].id;

const toy = await loadToy(id);
useToy(toy);
sharedStore.set('toy', id);
startApp(toy, { toys: TOYS });
