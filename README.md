# synth_threejs_template

A starting point for musical toys that drive the
[synth module](https://github.com/jbellinghausen/synth_module_daemon)'s 12
CV/gate outputs from a browser, with three.js visuals.

The framework handles everything that isn't the music or the graphics:
- the connection to the Pi (reconnects, the one-client rule, ping)
- a drift-free 16th-note clock
- tempo-synced LFOs on CV slots
- mute and solo
- tune mode
- a control panel
- a slot strip showing each jack's note and voltage
- a tracker view of the current bar
- a wiring card for patching
- a three.js runtime with bloom, trails, adaptive resolution, and a camera that keeps your scene in frame

A toy provides a **song** (what to play) and a **visual** (what to draw). The
template ships with a small example of each, to replace.

**Building a toy with an AI agent?** Point it at [AGENTS.md](AGENTS.md), the
operating manual: rules, workflow, contracts, verification and known pitfalls.
Claude Code picks it up automatically through [CLAUDE.md](CLAUDE.md). A
fill-in prompt is in [docs/new-toy-prompt.md](docs/new-toy-prompt.md).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # config, your song's events, engine, camera framing; no browser needed
npm run report   # simulate the song: per-jack notes, volts, repeats, LFO rates, warnings
npm run live -- --host localhost --seconds 10   # play it for real against a (dry-run) daemon
```

Serve it over **http://**: browsers block the daemon's `ws://` from https
pages. For another machine on the LAN, `npx vite --host`.

## Making a new toy

1. **Copy the template** (GitHub's "Use this template", or clone it into a new
   repo).
2. **Name it and map the slots** in [`src/config.js`](src/config.js): set
   `APP.NAME` and `APP.STORAGE_PREFIX`, then list one entry in `VOICES` per
   jack you use (see [Voices](#voices)). Write a `patch` suggestion for each;
   it appears in the wiring card.
3. **Write a song** in `src/song/` (see [The song](#the-song)). Start from
   [`example-song.js`](src/song/example-song.js).
4. **Write a visual** in `src/visual/` (see [The visual](#the-visual)). Start
   from [`example-visual.js`](src/visual/example-visual.js).
5. **Point [`src/toy.js`](src/toy.js) at them**, then delete the examples and
   `test/example-song.test.js`.
6. Run `npm test` and `npm run report`. The tests check whatever song
   `toy.js` names: valid voices, notes inside each voice's range and the DAC's,
   and events that stay stable within a bar. The report flags musical
   problems: clamped notes, stuck arps, silent voices, busy LFOs.

```
src/
  config.js                 ← yours: name, slots, tempo, network
  toy.js                    ← yours: which song and visual (read by the app, tests and tools)
  main.js                     browser entry point: startApp(toy)
  song/example-song.js      ← yours: replace
  visual/example-visual.js  ← yours: replace
  framework/                  the reusable part; normally left alone
    app.js                    wires everything together, and the panel
    style.css
    engine/   synth.js (connection) · sequencer.js (clock) · lfo.js · conductor.js
    ui/       strip.js · tracker.js · wiring.js
    runtime/  runtime.js (three.js) · camera.js (framing)
    music/    theory.js (scales, chords, seeded randomness, euclidean rhythms)
test/                         song.test.js checks any song; the rest check the framework
tools/                        report.mjs (npm run report), live.mjs (npm run live)
docs/new-toy-prompt.md        a fill-in prompt for starting a toy with an agent
AGENTS.md                     the manual for agents (and a checklist for people)
```

## Voices

Each entry in `VOICES` is one jack. `slot` is the **protocol** slot, 0–11;
the panel's jacks are labelled 1–12, so slot 0 is jack 1. The UI shows jack
numbers (`JACK_OFFSET` in config). Jacks without a voice stay silent and show
as free in the wiring card.

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
[`conductor.js`](src/framework/engine/conductor.js):

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

## The visual

`createVisual(runtime)` in `toy.js` builds it. Everything except `update` is
optional:

| member | |
|--------|---|
| `constructor(runtime)` | build the scene into `runtime.scene` |
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
- `push` (0..1, pull in on a big hit) and `sway`.

Render resolution drops on its own if frames get slow. Tone mapping (ACES) is
on, so standard materials and bloom behave.

## The UI

| | |
|---|---|
| `space` / **Play** | play / stop. Stop drops every gate. Won't start in a hidden tab. |
| `esc` / **Panic** | all notes off (always, even with the wiring card open) |
| **BPM**, **View** | tempo; camera tilt from side-on to straight down (remembered) |
| `u` / **Tune** | every CV to C3 (2.0 V) with the synth gates held open, for tuning |
| `w` / **Wiring** | the wiring card: every jack's gate, CV range and patch suggestion |
| `t` / **Tracker** | the tracker view (remembered) |
| slot cells | note and voltage being sent (red if the DAC can't reach it); click to mute; **S** or shift-click to solo |
| `h`, `f` | hide the UI, fullscreen |

Solo only silences sound voices. LFOs keep running, because freezing an LFO that drives
a VCA could silence the voice you soloed. Mute an LFO to stop it.

Playback stops when the tab is hidden: browsers throttle background timers to
about once a second, which would stutter the sequence and leave gates hanging.

## Hardware notes

- **CV range**: 1 V/oct with note 24 (C1) at 0 V, up to 3.3 V. The highest
  note with a real voltage is 63 (D#4, 3.25 V). Notes outside 24–63 are
  clamped, and show red in the slot strip.
- **LFOs are stepped**: the protocol only carries whole MIDI notes, so a CV
  moves in 1/12 V (83 mV) steps. That's fine for filters and VCAs, but stepped
  on pitch. LFOs only send when the step changes.
- **No CV without a gate**: `CV_NOTE_ON` always raises the gate, which is why
  tune mode gives non-synth jacks a sub-millisecond gate blip.
- **One client at a time**: the daemon refuses a second connection ("Daemon is
  busy with another client"). Close other toys' tabs first. The toy retries
  every 2 s.

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
