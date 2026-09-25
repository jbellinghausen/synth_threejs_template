#!/usr/bin/env node
// npm run live [-- --host localhost --seconds 10 --section 1]
//
// Plays the toy's song for real, over the WebSocket, with the real clock:
// the same path the browser uses, minus the browser. Point it at a dry-run
// daemon and read the daemon's log (CV ON: slot=N note=... / CV OFF: slot=N).
// Needs Node 22+ (built-in WebSocket).
//
// The daemon serves one client at a time: close any browser tab that's
// connected first, or this reports "Daemon is busy with another client".

import { toy } from '../src/toy.js';
import { Conductor } from '../src/framework/engine/conductor.js';
import { SynthLink } from '../src/framework/engine/synth.js';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => a.trim().split(/\s+/)),
);
const host = args.host ?? 'localhost';
const seconds = Number(args.seconds ?? 10);

const song = toy.createSong();
if (args.section != null && song.sections) song.sectionIndex = Number(args.section);
if ('evolve' in song && args.section != null) song.evolve = false;

let ready;
const connected = new Promise((resolve) => (ready = resolve));
const synth = new SynthLink({
  onStatus: (status) => {
    if (status === 'connected') ready();
    else if (!['connecting', 'offline'].includes(status)) console.error(`status: ${status}`);
  },
});
let events = 0;
const conductor = new Conductor({ synth, song, onEvent: () => (events += 1) });

synth.connect(host);
const giveUp = setTimeout(() => {
  console.error(`could not connect to ${host} within 8 s`);
  process.exit(1);
}, 8000);
await connected;
clearTimeout(giveUp);

console.log(`connected to ${host}; playing ${song.constructor.name} for ${seconds} s (start ${new Date().toISOString()})`);
conductor.play();
await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
conductor.stop();
console.log(`stopped (${new Date().toISOString()}): ${events} events sent`);
setTimeout(() => {
  synth.disconnect();
  process.exit(0);
}, 300);
