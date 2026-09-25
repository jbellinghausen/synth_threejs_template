# AGENTS.md: building a toy on this template

This is the operating manual for an AI agent (or a person) turning this
template into a new musical toy. Read it all before changing anything. The
human-oriented overview is [README.md](README.md). This file is the rules,
the workflow, the contracts, and the traps.

A **toy** is a browser app that plays music on real hardware: a Raspberry Pi
"synth module" with 12 CV/gate outputs, driven over a WebSocket. Each toy
has a **song** (what to play), a **visual** (what to draw, with three.js) and
a **slot map** (which jack does what). Everything else is the framework in
`src/framework/`, shared by every toy.

---

## 1. Hardware facts (these are not negotiable)

| Fact | Consequence |
|------|-------------|
| 12 outputs. Each has a pitch **CV** and a **gate**. | A voice is one jack. At most 12 voices. |
| CV is **1 V/octave**, **MIDI note 24 (C1) = 0 V**, max **3.3 V**. | Usable notes are **24–63**. 63 (D#4) = 3.25 V is the highest real note. Outside that range the DAC clamps: melodies flatten. |
| Pitch is sent as a **whole MIDI note**. | CV moves in 1/12 V = **83 mV steps**. LFOs are stepped. Good for VCAs and filters, stepped on pitch. |
| `CV_NOTE_ON` sets the CV **and raises the gate**. There is no "CV only" command. | Setting a CV on a drum or LFO jack gives its gate a blip. Tune mode does this deliberately. |
| A CV write is a synchronous **I²C write on the Pi**. | Don't spray updates. LFOs send only when the note changes. Keep totals to tens or low hundreds of messages/s. |
| The daemon serves **one client at a time**. A second gets "Daemon is busy with another client". | Only one tab or app can drive the Pi. Tests and tools that connect need it free. |
| The daemon speaks plain **`ws://`** on port 9743. | Serve toys over **http://** (the Vite dev server). An https page can't connect. |
| The panel labels jacks **1–12**; the protocol numbers slots **0–11**. | `slot` in config is the protocol number (**jack − 1**). The UI shows jack numbers. Say "jack N" to the user; write `slot: N-1` in code. |
| Browsers throttle timers in **hidden tabs** to about 1 Hz. | Playback stops when the tab is hidden and refuses to start while hidden. That's intentional; don't remove it. |

The toys built so far (VOLTAGE, KOTEKAN, this template's example) assume jack
1 is a lead or arp synth, jack 2 a kick, jack 7 a bass, jack 8 a second arp,
jack 9 a pad or drone, and jacks 10–12 modulation. Keep new toys compatible
with that where you can. **Ask the user** how things are patched before
relying on it, and whenever a toy needs something different.

---

## 2. Rules

1. **Edit only the toy's files**:
   - `src/config.js`
   - `src/toy.js`
   - `src/song/`
   - `src/visual/`
   - tests in `test/`
   - the toy's section of `README.md`

   Change `src/framework/` only when the toy needs a capability the framework
   lacks. Then keep the change generic, add a test, and document it here and
   in the README.
2. **Songs emit sound voices only** (`synth`, `drum`). Never emit an `lfo`
   voice: the framework runs LFOs from their config.
3. **`eventsAt(abs)` must be stable for the current bar.** The conductor reads
   all 16 steps of a bar at its first step (the tracker shows them), and may
   re-read the bar at any time. Derive events from state that's fixed for the
   bar (the bar number, the section, a seed) plus `abs`. Never from a counter
   that `eventsAt` itself advances. `test/song.test.js` enforces this.
4. **Every note is an integer inside the voice's `range` and inside 24–63.**
   Choose notes from pools already in range. Don't generate freely and then
   octave-fold, which collapses melodies onto one or two notes.
5. **`src/toy.js`, songs and anything they import must load under Node.** No
   `window` or `document` at import time. Tests and tools import them. Visual
   modules may import three.js, but must only touch the DOM or WebGL inside
   the constructor.
6. **Every voice has a `patch` string**: what to plug that jack into. It's the
   wiring card, which is how the user patches the toy.
7. **Give each toy a unique `APP.STORAGE_PREFIX`** so toys don't share saved
   settings.
8. No new dependencies beyond `three` and the synth client without a good
   reason. No CDNs: toys are often run on a LAN without internet.
9. Don't commit `node_modules/` or `dist/`.
10. **Verify, don't assume.** Run the checks in [section 6](#6-verifying-your-work)
    and look at the output before calling something done. Report anything
    you couldn't verify.

---

## 3. Workflow for a new toy

1. **Read**:
   - `README.md`
   - `src/config.js`
   - `src/toy.js`
   - `src/song/example-song.js`
   - `src/visual/example-visual.js`
   - the header comments of `src/framework/engine/conductor.js` and
     `src/framework/runtime/runtime.js`

   Run `npm install && npm test && npm run report` to see a working baseline.
2. **Plan the slot map.** List the voices the idea needs, their kinds, and
   ranges that fit 24–63. Map them onto jacks compatible with the user's patch
   (section 1). If that's impossible, ask.
3. **`src/config.js`**:
   - set `APP.NAME` and `APP.STORAGE_PREFIX`;
   - rewrite `VOICES` (a `patch` for each);
   - set tempo defaults in `TRANSPORT`.
4. **Write the song** in `src/song/your-song.js` (section 4). Start by copying
   the example.
5. **Write the visual** in `src/visual/your-visual.js` (section 5).
6. **Point `src/toy.js` at them.** Delete the example song, the example visual
   and `test/example-song.test.js` once yours replace them.
7. **Verify** (section 6): `npm test`, `npm run report`, `npm run build`, then
   the browser check.
8. **Document**: replace the top of `README.md` with a section about the toy:
   what it is, its jacks (a table), its controls. Keep the framework sections
   below it.

---

## 4. The song

Contract: the header of
[`src/framework/engine/conductor.js`](src/framework/engine/conductor.js).
Worked example: [`src/song/example-song.js`](src/song/example-song.js).

```js
export class MySong {
  resetPosition() { this.bar = 0; }          // on Play
  advanceBar() {                              // top of every bar except the first
    this.bar += 1;
    return { sectionChanged: false };         // anything; reaches visual.onBar(changes)
  }
  eventsAt(abs) {                             // events starting on step `abs` (16ths since Play)
    const step = abs % 16;
    return step % 4 === 0 ? [{ voice: 'kick', accent: step === 0 }] : [];
  }
}
```

**Events**:

```js
{ voice: 'lead', note: 52, steps: 2 }            // synth: steps = length in 16ths
{ voice: 'kick', accent: true }                   // drum, no note: sends accentNote (else note); tracker shows ###
{ voice: 'hat', ghost: true }                     // ghost: tracker shows -o-, visuals may play it quieter
{ voice: 'perc', note: 55, index: 3 }             // extra fields reach the visual's hit()
```

- The gate is held for `steps × stepMs × voice.gate` (synths), or `trigMs`
  (drums). Leave `gate` below 1 so repeated notes retrigger.
- **Mute and solo are applied for you.** The **arrangement is not**: if a
  voice shouldn't play in the current section, don't return its events. Then
  report the same thing through `plays(id)`, which only dims it in the UI and
  visual. The example song does both with one `add()` helper.
- A voice that starts a new note while its previous gate is still high
  changes pitch without retriggering (legato). The framework cancels the old
  gate-off, so a note is never cut short by an older one.

**Optional members** switch on UI (see the `startApp` comment in
[`src/framework/app.js`](src/framework/app.js)):
- `setKey` / `rootPc` / `scaleKey` — key menus;
- `sections`, `sectionIndex`, `queueSection`, `evolve` — section menu, Evolve, 1–9 keys;
- `regenerate(seed?)` — New;
- `caption` — `{ title, subtitle }` above the slots;
- `plays(id)` — dims voices that aren't in the arrangement;
- `lfoRate` — LFO speed multiplier.

**Patterns that work**:
- **Seeded randomness** from `framework/music/theory.js`: `mulberry32(seed)`
  for per-piece choices made in `regenerate`, and `hash(seed, bar, step)` for
  per-step variation that stays stable within a bar.
- **Chords**: `chordPcs(rootPc, intervals, degree)` gives the pitch classes;
  collect the notes in a voice's range that match; walk that pool.
- **Arpeggios / melodies**: give **each voice its own line** through its own
  pool, with moves that are never 0, bouncing off the ends. Sampling one
  shared contour at alternate steps from two voices makes each voice repeat
  itself (the KOTEKAN bug).
- **Polymeter**: cycles of 10, 12 or 20 steps against the 16-step bar, indexed
  by `abs % cycle`. Stable, and it drifts nicely.
- **Arrangement**: sections of N bars, each with a list of `layers`, and
  `plays(id)` checking the current section.

---

## 5. The visual

Contract: the header of
[`src/visual/example-visual.js`](src/visual/example-visual.js) and of
[`src/framework/runtime/runtime.js`](src/framework/runtime/runtime.js).

```js
export class MyVisual {
  constructor(runtime) {
    runtime.subject = { radius: 5, height: 2, y: 0.5 }; // what the camera keeps in frame
    runtime.trails = 0.4;                                // 0 = off
    runtime.bloom.strength = 0.6;
    // build into runtime.scene
  }
  hit(event) { /* flash something for event.voice */ }
  setLfo(lfos) { /* [{ voice, value 0..1, note }]: the exact values sent to the hardware */ }
  setAudible(isAudible) { /* fade out voices where isAudible(id) is false */ }
  update({ dt, time, pos, playing, stepsPerSecond }) {
    // pos = song position in 16ths (null when stopped; keep things moving idly)
    // decay with Math.exp(-dt / tau), never a fixed factor per frame
  }
}
```

- **Tie motion to `pos`**, not wall time, when it should stay in sync with
  the music. For example, a wheel with a 12-step cycle turns
  `(pos % 12) / 12` of a revolution.
- **Set `runtime.subject` honestly.** The camera rig solves the distance so
  that disc fits the screen at any View tilt and aspect ratio. This is
  tested. Or set `runtime.rig = false` and drive `runtime.camera` yourself.
- `frame.tiltOffset` (degrees) moves the camera off the user's View setting.
  Ease it: LFO values can jump.
- Tone mapping (ACES) and bloom are on. Emissive intensities of about 0–3 are
  sensible. Test the *loudest* moment, not the idle one.

---

## 6. Verifying your work

Run all of these. Paste relevant output into your report to the user.

| Command | What it proves |
|---------|----------------|
| `npm test` | config is valid; the song's events are valid, in range and stable across keys, seeds and sections; LFO crossfade and S&H behave; mute, solo and tune; camera framing |
| `npm run report` | a simulated run of the song (no Pi, no browser, instant). Per-jack events, note range and volts, distinct notes, back-to-back repeats, gate lengths, LFO send rates, crossfade sums, sections. **Read every WARN.** Exits 1 on clamped notes or unknown voices. Flags: `--bars 64 --bpm 100 --seed 3 --section 2 --key 9:minor` |
| `npm run build` | it bundles |
| `npm run live -- --host localhost --seconds 10` | plays for real over the WebSocket against a daemon (see below) |

**Dry-run daemon**: a real daemon that logs instead of driving hardware.

```bash
git clone --branch v0.1.0 https://github.com/jbellinghausen/synth_module_daemon.git /tmp/synth_module_daemon
cd /tmp/synth_module_daemon && python3 -m venv venv && venv/bin/pip install websockets
venv/bin/python daemon/hw_daemon.py --dry-run --log-level DEBUG > /tmp/daemon.log 2>&1 &
```

The log lines are `CV ON: slot=N note=M` and `CV OFF: slot=N`, with
**protocol** slots (jack − 1), plus `All notes off` on stop or disconnect.
If port 9743 is taken (a browser tab holds the real daemon, say), run a second one
with `--port 9751 --ws-port 9753` and point tools at `ws://localhost:9753`.

**Browser check**: `npm run dev`, open the page, enter `localhost` as the
address and press Connect.
- Confirm no console errors, the panel, tracker, slot strip and wiring card, and that Play works.
- Try the View slider at both ends.
- Afterwards, set the address back to `raspberrypi.local` and press Connect,
  or leave it offline. The saved address persists per browser.

**Definition of done**:
- [ ] `npm test` passes and `npm run report` has no ERROR (every WARN is
      either fixed or explained to the user).
- [ ] `npm run build` succeeds.
- [ ] The browser check was done with no console errors, or you've said why
      you couldn't.
- [ ] Every voice has a `patch`, and the wiring card reads correctly.
- [ ] `README.md` describes the toy and its jacks (as jack numbers).
- [ ] Nothing is left connected to the Pi that the user didn't ask for, and
      the tabs you opened are closed.

---

## 7. Pitfalls we've hit (read before debugging)

**Music**
- **An arp stuck on one note**: two voices sampling one stepwise contour at
  alternate steps. Give each voice its own line (section 4). `npm run report`
  shows repeats.
- **Notes flatten at the top on real hardware**: the DAC's supply may be
  slightly under 3.3 V, so the top semitones (61–63) can squash. The slot
  strip shows the volts being sent. If the user reports it, lower the voice
  ranges (for example to 60, C4 = 3.00 V).
- **Octave-folding** (`fitRange` on every note) collapses a melody. Pick from
  in-range pools.
- **An LFO patched to a VCA and frozen** silences what it controls. That's
  why solo never stops LFOs; keep it that way.

**Visuals**
- **Everything washes out to pastel**: `AfterimagePass` is `max(new, old ×
  damp)`, so on fast full-screen motion it keeps every pixel near its
  brightest. Keep `runtime.trails` low (≤ 0.3) for full-screen effects; trails
  suit sparse things on dark backgrounds.
- **Blown out on big hits**: emissive + point light + halo + bloom stack up on
  a gong or section change. Budget intensities for the loudest moment.
- **Frame-rate dependence**: decays must use `Math.exp(-dt / tau)`. The
  runtime already rescales trails per frame. A 144 Hz screen will expose
  anything that doesn't.
- **Raymarched or fractal geometry renders black**: check it numerically first.
  Port the distance function to JS and march some rays in Node. Fold
  rotations above about 0.2 rad shredded a KIFS fractal to dust. And never
  feed unbounded `time` into geometry parameters: it drifts into a broken
  region after minutes.
- **The subject clips at some tilt**: set `runtime.subject` to the real size
  (including hit animations). The fit is exact for a disc of that radius and
  height.

**Browser and UI**
- **Something with `hidden` still shows**: a CSS `display` rule beats the
  `hidden` attribute. `style.css` has a global `[hidden] { display: none
  !important }`; don't remove it.
- **A `<canvas>` with `position: fixed; inset: 0` doesn't stretch** (it's a
  replaced element). Size it with `renderer.setSize(w, h)`, as the runtime does.
- **"Daemon is busy"**: another tab or tool is connected. Vite reloads every
  open tab of a toy on each save, and each reconnects, so an idle old tab can
  steal the Pi. Close tabs you're not using.
- **Play does nothing when automated**: the tab is hidden (the browser window
  is in the background), and the hidden-tab guard refuses to start. Check
  `document.hidden`. Playback verification can fall back to `npm run live`
  and the daemon log.
- **Browser-automation screenshots can be cropped or scaled** relative to the
  page. Measure geometry with JS (`innerWidth`, `getBoundingClientRect()`)
  rather than trusting pixels in a screenshot.

---

## 8. When to ask the user

Ask about things only they know: **how the jacks are patched**, what hardware
is on each jack, and whether something they hear matches what the UI shows.
Decide everything else (musical choices, visual style, code structure)
yourself, and say what you chose.
