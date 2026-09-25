#!/usr/bin/env node
// npm run report [-- --toy example --bars 32 --bpm 120 --seed 1 --section 0 --key 9:minor]
//
// Plays the toy's song through the real conductor and LFO bank in simulated
// time (no Pi, no browser, no waiting) and summarises what each jack would
// be sent. Use it after changing a song: it catches notes the DAC would
// clamp, voices that never play, repeated notes, runaway message rates and
// broken crossfade pairs.
//
// Exit code 1 if anything would be clamped or an event names an unknown
// voice; warnings alone exit 0.

import { Conductor, eventNote } from '../src/framework/engine/conductor.js';
import { useToy } from '../src/framework/toy.js';
import { CV_NOTE_MAX, CV_NOTE_MIN, LFO, STEPS_PER_BAR, jackLabel, stepMsFor } from '../src/hardware.js';
import { TOYS, loadToy } from '../src/toys/index.js';
import { trackerName } from '../src/framework/music/theory.js';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => a.trim().split(/\s+/)),
);
const toy = await loadToy(args.toy ?? TOYS[0].id);
useToy(toy);
const VOICES = toy.voices;
const BARS = Number(args.bars ?? 32);
const BPM = Number(args.bpm ?? toy.transport.BPM_DEFAULT);
const stepMs = stepMsFor(BPM);
const seconds = (BARS * STEPS_PER_BAR * stepMs) / 1000;

const volts = (n) => `${((n - CV_NOTE_MIN) / 12).toFixed(2)}V`;
const name = (n) => trackerName(n).replace('-', '');

// --- a synth that records instead of sending -----------------------------------------
let now = 0;
const sent = [];
const synth = {
  playCv: (slot, note, ms) => sent.push({ t: now, op: 'play', slot, note, ms }),
  holdCv: (slot, note) => (sent.push({ t: now, op: 'hold', slot, note }), true),
  gateOff: (slot) => sent.push({ t: now, op: 'off', slot }),
  panic: () => sent.push({ t: now, op: 'panic' }),
};

const song = toy.createSong();
if (args.seed != null && song.regenerate) song.regenerate(Number(args.seed));
if (args.key && song.setKey) {
  const [root, scale] = args.key.split(':');
  song.setKey(Number(root), scale);
}
if (args.section != null && song.sections) song.sectionIndex = Number(args.section);

const events = [];
const timeline = [];
const errors = [];
const conductor = new Conductor({
  synth,
  song,
  onEvent: (event, abs) => events.push({ ...event, abs }),
  onBar: () => {
    const title = song.caption?.title ?? song.sections?.[song.sectionIndex]?.name;
    const bar = Math.floor(now / stepMs / STEPS_PER_BAR);
    if (title && timeline.at(-1)?.title !== title) timeline.push({ bar, title });
  },
});

// Unknown voices would throw inside the conductor; catch them per event instead.
const knownIds = new Set(VOICES.map((v) => v.id));
const origEventsAt = song.eventsAt.bind(song);
song.eventsAt = (abs) => origEventsAt(abs).filter((e) => {
  if (knownIds.has(e.voice)) return true;
  errors.push(`step ${abs}: event for unknown voice "${e.voice}"`);
  return false;
});

// --- play -------------------------------------------------------------------------------
song.resetPosition();
conductor.lfo.reset();
conductor.lfo.setRate(song.lfoRate ?? 1);
const ticksPerStep = Math.max(1, Math.round(stepMs / LFO.TICK_MS));
for (let abs = 0; abs < BARS * STEPS_PER_BAR; abs += 1) {
  now = abs * stepMs;
  conductor.sequencer.onStep(abs % STEPS_PER_BAR, abs, stepMs);
  for (let k = 0; k < ticksPerStep; k += 1) {
    now = (abs + k / ticksPerStep) * stepMs;
    conductor.lfo.update(abs + k / ticksPerStep);
  }
}

// --- report -----------------------------------------------------------------------------
const warnings = [];
const pad = (s, n) => String(s).padEnd(n);
console.log(`${toy.name} (${toy.id}): ${BARS} bars at ${BPM} BPM (${seconds.toFixed(1)} s)\n`);
if (timeline.length) console.log(`sections: ${timeline.map((s) => `bar ${s.bar} ${s.title}`).join(' → ')}\n`);

console.log(`${pad('jack', 5)}${pad('voice', 9)}${pad('events', 8)}${pad('/bar', 6)}${pad('notes', 22)}${pad('distinct', 9)}${pad('repeats', 9)}gate`);
for (const voice of VOICES.filter((v) => v.kind !== 'lfo')) {
  const mine = events.filter((e) => e.voice === voice.id);
  const notes = mine.map((e) => eventNote(e, voice));
  const jack = jackLabel(voice.slot);
  if (!mine.length) {
    console.log(`${pad(jack, 5)}${pad(voice.label, 9)}${pad(0, 8)}`);
    warnings.push(`${voice.label} (jack ${jack}) never played in ${BARS} bars`);
    continue;
  }
  const lo = Math.min(...notes);
  const hi = Math.max(...notes);
  const pitched = voice.kind === 'synth' || voice.range;
  let repeats = 0;
  for (let i = 1; i < notes.length; i += 1) if (notes[i] === notes[i - 1]) repeats += 1;
  const repeatPct = pitched ? `${Math.round((repeats / Math.max(1, notes.length - 1)) * 100)}%` : '-';
  const gates = sent.filter((s) => s.op === 'play' && s.slot === voice.slot).map((s) => s.ms);
  const gate = gates.length ? `${Math.round(Math.min(...gates))}-${Math.round(Math.max(...gates))} ms` : '-';
  console.log(`${pad(jack, 5)}${pad(voice.label, 9)}${pad(mine.length, 8)}${pad((mine.length / BARS).toFixed(1), 6)}`
    + `${pad(`${name(lo)}-${name(hi)} ${volts(lo)}-${volts(hi)}`, 22)}${pad(pitched ? new Set(notes).size : '-', 9)}${pad(repeatPct, 9)}${gate}`);

  const clamped = notes.filter((n) => n < CV_NOTE_MIN || n > CV_NOTE_MAX).length;
  if (clamped) errors.push(`${voice.label}: ${clamped} notes outside the DAC range ${CV_NOTE_MIN}-${CV_NOTE_MAX}; the hardware would clamp them`);
  if (voice.range) {
    const out = notes.filter((n) => n < voice.range[0] || n > voice.range[1]).length;
    if (out) warnings.push(`${voice.label}: ${out} notes outside its configured range ${voice.range.join('-')}`);
  }
  if (pitched && notes.length > 8 && new Set(notes).size === 1) warnings.push(`${voice.label} plays only one note (${name(lo)})`);
  // A bass on the chord root repeats ~75% by design; a stuck arp repeats more.
  if (pitched && voice.kind === 'synth' && repeats / (notes.length - 1) > 0.8 && voice.gate < 0.9) {
    warnings.push(`${voice.label} repeats the previous note ${repeatPct} of the time; is that intended?`);
  }
}

console.log(`\n${pad('jack', 5)}${pad('lfo', 9)}${pad('sends/s', 9)}${pad('range', 22)}shape`);
for (const voice of VOICES.filter((v) => v.kind === 'lfo')) {
  const mine = sent.filter((s) => s.slot === voice.slot && (s.op === 'hold' || s.op === 'play'));
  const notes = mine.map((s) => s.note);
  const lo = notes.length ? Math.min(...notes) : null;
  const hi = notes.length ? Math.max(...notes) : null;
  const rate = mine.length / seconds;
  console.log(`${pad(jackLabel(voice.slot), 5)}${pad(voice.label, 9)}${pad(rate.toFixed(1), 9)}`
    + `${pad(lo == null ? '-' : `${name(lo)}-${name(hi)} ${volts(lo)}-${volts(hi)}`, 22)}${voice.shape}, ${voice.cycleSteps} steps${voice.phase ? `, phase ${voice.phase}` : ''}`);
  if (!mine.length) warnings.push(`${voice.label} never sent anything`);
  if (rate > 60) warnings.push(`${voice.label} sends ${rate.toFixed(0)} CV writes/s; each is an I2C write on the Pi`);
}

// Crossfade pairs: same shape and period, half a cycle apart.
const lfos = VOICES.filter((v) => v.kind === 'lfo');
for (const a of lfos) for (const b of lfos) {
  if (a === b || a.shape !== b.shape || a.cycleSteps !== b.cycleSteps || ((b.phase ?? 0) - (a.phase ?? 0)) !== 0.5) continue;
  let va = null;
  let vb = null;
  const sums = [];
  for (const s of sent) {
    if (s.op !== 'hold') continue;
    if (s.slot === a.slot) va = s;
    if (s.slot === b.slot) vb = s;
    if (va && vb && va.t === vb.t) sums.push(va.note + vb.note);
  }
  const ideal = a.range[0] + a.range[1];
  const off = sums.filter((x) => Math.abs(x - ideal) > 1).length;
  console.log(`\ncrossfade ${a.label} + ${b.label}: sum ${Math.min(...sums)}-${Math.max(...sums)} over ${sums.length} updates (full scale = ${ideal})`);
  if (off) warnings.push(`${a.label} + ${b.label} drift from full scale on ${off} updates`);
}

const total = sent.length / seconds;
console.log(`\ntotal: ${sent.length} messages, ${total.toFixed(0)}/s`);
if (total > 300) warnings.push(`${total.toFixed(0)} messages/s is a lot for the Pi; check for voices firing every step`);

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of [...new Set(errors)]) console.log(`ERROR ${e}`);
if (!warnings.length && !errors.length) console.log('no warnings');
process.exitCode = errors.length ? 1 : 0;
