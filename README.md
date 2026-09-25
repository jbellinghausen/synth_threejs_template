# synth_threejs_template

A project for musical **toys** that drive the
[synth module](https://github.com/jbellinghausen/synth_module_daemon)'s 12
CV/gate outputs from a browser, with three.js visuals. One project can hold
any number of toys; a picker in the panel switches between them.

The framework handles everything that isn't the music or the graphics:
- the connection to the Pi (reconnects, the one-client rule, ping)
- a drift-free 16th-note clock
- tempo-synced LFOs on CV slots
- mute and solo
- tune mode
- the control panel and toy picker
- a slot strip showing each jack's note and voltage
- a tracker view of the current bar
- a wiring card for patching
- a three.js runtime with bloom, trails, adaptive resolution, and a camera that keeps your scene in frame

Each toy provides a **slot map**, a **song** (what to play) and a **visual**
(what to draw). Two small toys are included to copy from:
- **example** uses every optional feature;
- **pulse** is the smallest complete toy.

**Building a toy with an AI agent?** Point it at [AGENTS.md](AGENTS.md), the
operating manual: rules, workflow, contracts, verification and known pitfalls.
Claude Code picks it up automatically through [CLAUDE.md](CLAUDE.md). A
fill-in prompt is in [docs/new-toy-prompt.md](docs/new-toy-prompt.md).

```bash
npm install
npm run dev      # http://localhost:5173 (?toy=<id> opens a specific toy)
npm test         # every toy's slot map and song, the engine, camera framing; no browser needed
npm run report -- --toy example   # simulate a toy's song: per-jack notes, volts, repeats, LFO rates, warnings
npm run live -- --toy example --host localhost --seconds 10   # play it for real against a (dry-run) daemon
```

Serve it over **http://**: browsers block the daemon's `ws://` from https
pages. For another machine on the LAN, `npx vite --host`.

## Layout

```
src/
  hardware.js               shared by every toy: the Pi's address, CV limits, tune note
  toys/
    index.js                the registry: one line per toy, in picker order
    example/                a toy: its own folder
      index.js              defineToy({ id, name, voices, createSong, createVisual, ... })
      config.js             its slot map (VOICES), tempo, visual defaults
      song.js               what it plays
      visual.js             what it draws
    pulse/                  another toy
  main.js                   picks the toy (?toy=, else the last one picked) and starts it
  framework/                the reusable part; normally left alone
    app.js                  wires everything together, and the panel
    toy.js                  defineToy(), and the active toy the framework reads
    style.css
    engine/   synth.js (connection) · sequencer.js (clock) · lfo.js · conductor.js
    ui/       strip.js · tracker.js · wiring.js
    runtime/  runtime.js (three.js) · camera.js (framing)
    music/    theory.js (scales, chords, seeded randomness, euclidean rhythms)
test/                       toys.test.js and song.test.js check every registered toy; the rest check the framework
tools/                      report.mjs (npm run report), live.mjs (npm run live)
docs/new-toy-prompt.md      a fill-in prompt for starting a toy with an agent
AGENTS.md                   the manual for agents (and a checklist for people)
```

## Adding a toy

1. **Copy a toy's folder**: `cp -r src/toys/example src/toys/mytoy`. Use
   `pulse` for a minimal start.
2. **Define it** in `src/toys/mytoy/index.js`: give it a new `id` (lowercase,
   the same as the folder) and a `name`.
3. **Register it**: add a line to [`src/toys/index.js`](src/toys/index.js):
   ```js
   { id: 'mytoy', name: 'MY TOY', load: () => import('./mytoy/index.js') },
   ```
4. **Map its jacks** in `config.js` (see [Voices](#voices)). Write a `patch`
   suggestion for each; it appears in the wiring card.
5. **Write its song and visual** (see [The song](#the-song) and
   [The visual](#the-visual)).
6. **Check it**: `npm test` (runs for every registered toy) and
   `npm run report -- --toy mytoy`. Then open `http://localhost:5173/?toy=mytoy`.

To remove a toy, delete its folder and its registry line. The first toy in the
registry is the default. Each toy keeps its own saved settings (View tilt,
tracker), and they all share the Pi's address.

Only one toy runs at a time. Picking another reloads the page, so the old
toy's connection closes before the new one opens: the Pi serves one client.
Each toy is built as its own chunk and loaded when picked.

## Voices

Each entry in a toy's `VOICES` is one jack. `slot` is the **protocol** slot,
0–11. The panel's jacks are labelled 1–12, so slot 0 is jack 1. The UI shows
jack numbers (`JACK_OFFSET` in `hardware.js`). Jacks without a voice stay
silent and show as free in the wiring card.

| kind | gate | CV | fields |
|------|------|----|--------|
| `synth` | held for `gate` × the note's length | V/oct | `range` (the song should stay inside it), `gate` |
| `drum` | a `trigMs` trigger | `note`, or `accentNote` on accented hits; or a `range` for a pitched drum | `trigMs`, `note`/`accentNote` or `range` |
| `lfo` | held high (`gateMode: 'hold'`), or a `trigMs` pulse per sample (`'trigger'`) | the modulation, across `range` | `shape` (sine, triangle, saw, square, sh), `cycleSteps`, `phase`, `range`, `gateMode` |

The framework runs the LFOs itself, locked to the song position. Give two sine
LFOs the same `cycleSteps` and phases 0 and 0.5 and they always sum to full
scale: patch them to two VCAs for a crossfade.

## The song

A song is an object the conductor asks for events. The contract is in
[`conductor.js`](src/framework/engine/conductor.js); worked examples are
[`example/song.js`](src/toys/example/song.js) (everything) and
[`pulse/song.js`](src/toys/pulse/song.js) (the minimum).

| member | required | |
|--------|:-:|---|
| `resetPosition()` | ✓ | called on Play |
| `advanceBar()` | ✓ | top of every bar except the first; return what changed (passed on to the visual's `onBar`) |
| `eventsAt(abs)` | ✓ | events starting on absolute step `abs` (16ths since Play) |
| `lfoRate` | | multiplies LFO speed, read every bar |

`eventsAt` is called for all 16 steps of a bar at its start. That's how the
tracker shows a bar before it plays. So an event can depend only on state
that's fixed for the bar (the bar number, the section, a seed), not on what
happened earlier in it. Seeded randomness from `theory.js` (`hash`,
`mulberry32`) keeps this easy.

An event is `{ voice, note, steps, accent, ghost, …anything }`:
- `voice` is an id from `VOICES`.
- `steps` is the length in 16ths (synths).
- Drums can leave out `note`: they then send the voice's `note`, or its
  `accentNote` when `accent` is set.
- `accent` / `ghost` affect drums and how the tracker draws them.
- Extra fields go through to the visual.

Muted and solo'd-out voices are filtered for you. The arrangement isn't: if a
voice shouldn't play in the current section, don't return its events. Report
the same thing through `plays(id)` (below) so the UI dims it.

Optional members switch on parts of the panel:

| member | turns on |
|--------|----------|
| `setKey(rootPc, scaleKey)`, `rootPc`, `scaleKey` | root and scale menus |
| `sections: [{ name }]`, `sectionIndex`, `queueSection(i)`, `evolve` | section menu, Evolve toggle, `1`–`9` keys |
| `regenerate()` | the New button, `n` |
| `caption` → `{ title, subtitle }` | text above the slots; the title fades in when it changes |
| `plays(id)` | dims voices that aren't in the arrangement right now |
| `controls` → `[{ id, label, title, get(), set(on) }]` | the toy's own toggle buttons (the example's "Half-time"); the bar is re-read after `set` |

## The visual

`createVisual(runtime, song)` in the toy's `index.js` builds it. `song` is the
toy's song, for visuals that draw its patterns. Everything except `update` is
optional:

| member | |
|--------|---|
| `constructor(runtime, song)` | build the scene into `runtime.scene` |
| `update(frame)` | every frame: `{ dt, time, pos, playing, stepsPerSecond }`. `pos` is the song position in 16ths (null when stopped). Set `frame.tiltOffset` (degrees) to move the camera off the View setting. |
| `hit(event, abs)` | a voice played |
| `setLfo(lfos)` | about 50 times a second: `[{ voice, value (0..1), note }]` |
| `setAudible(isAudible)` | `isAudible(id)` after mute / solo / arrangement changes |
| `onBar({ events, changes })` | the bar's events, and what the song's `advanceBar()` returned |
| `dispose()` | |

The runtime ([`runtime.js`](src/framework/runtime/runtime.js)) gives you:
- `scene`, `camera`, `renderer`, `composer`;
- `trails` (feedback persistence, 0 = off, frame-rate independent);
- `bloom` (UnrealBloomPass);
- `subject = { radius, height, y }`: the size of what you draw. The camera rig keeps it in frame at any tilt and screen shape; this is tested.
- `rig = false` to drive the camera yourself;
- `push` (0..1, pull in on a big hit) and `sway`;
- `addPass(pass)`: add your own post-processing (a CRT, glitch or scroller `ShaderPass`) after bloom;
- `renderPass` and `outputPass`: e.g. aim `renderPass.camera` at an orthographic camera for a full-screen shader.

Render resolution drops on its own if frames get slow (bounds in the toy's
`visuals`). Tone mapping (ACES) is on, so standard materials and bloom behave.

## The UI

| | |
|---|---|
| **toy name ▾** | the picker: switch toys |
| `space` / **Play** | play / stop. Stop drops every gate. Won't start in a hidden tab. |
| `esc` / **Panic** | all notes off (always, even with the wiring card open) |
| **BPM**, **View** | tempo; camera tilt from side-on to straight down (remembered per toy) |
| `u` / **Tune** | every CV to C3 (2.0 V) with the synth gates held open, for tuning |
| `w` / **Wiring** | the wiring card: every jack's gate, CV range and patch suggestion |
| `t` / **Tracker** | the tracker view (remembered per toy) |
| slot cells | note and voltage being sent (red if the DAC can't reach it); click to mute; **S** or shift-click to solo |
| `h`, `f` | hide the UI, fullscreen |

Solo only silences sound voices. LFOs keep running, because freezing an LFO that drives
a VCA could silence the voice you soloed. Mute an LFO to stop it.

Playback stops when the tab is hidden: browsers throttle background timers to
about once a second, which would stutter the sequence and leave gates hanging.

## Hardware notes

These are in [`src/hardware.js`](src/hardware.js), shared by every toy.

- **CV range**: 1 V/oct with note 24 (C1) at 0 V, up to 3.3 V. The highest
  note with a real voltage is 63 (D#4, 3.25 V). Notes outside 24–63 are
  clamped, and show red in the slot strip.
- **LFOs are stepped**: the protocol only carries whole MIDI notes, so a CV
  moves in 1/12 V (83 mV) steps. That's fine for filters and VCAs, but stepped
  on pitch. LFOs only send when the step changes.
- **No CV without a gate**: `CV_NOTE_ON` always raises the gate, which is why
  tune mode gives non-synth jacks a sub-millisecond gate blip.
- **One client at a time**: the daemon refuses a second connection ("Daemon is
  busy with another client"). Close other tabs first. The toy retries every 2 s.

## Testing without the Pi

Run the daemon in dry-run mode: it speaks the real protocol and logs every
command, but drives no hardware.

```bash
git clone --branch v0.1.0 https://github.com/jbellinghausen/synth_module_daemon.git /tmp/synth_module_daemon
cd /tmp/synth_module_daemon
python3 -m venv venv && venv/bin/pip install websockets
venv/bin/python daemon/hw_daemon.py --dry-run --log-level DEBUG
```

Then enter `localhost` as the address and press **Connect**. The log shows
`CV ON: slot=N note=…` / `CV OFF: slot=N`, with protocol slots (jack − 1).

---

Extracted from two toys built on the synth module: *KOTEKAN* (ambient
interlocking arps with a gamelan mandala) for the UI, conductor and runtime,
and *VOLTAGE* (a 12-slot demoscene piece) for the tracker.
