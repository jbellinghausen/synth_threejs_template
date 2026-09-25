import { APP, NETWORK, TRANSPORT, TUNE, VISUALS, VOICES } from '../config.js';
import { Conductor } from './engine/conductor.js';
import { SynthLink } from './engine/synth.js';
import { NOTE_NAMES, SCALES, trackerName } from './music/theory.js';
import { Runtime } from './runtime/runtime.js';
import { TILT_MAX, TILT_MIN } from './runtime/camera.js';
import { Strip } from './ui/strip.js';
import { Tracker } from './ui/tracker.js';
import { Wiring } from './ui/wiring.js';

/** localStorage that never throws (private windows, blocked storage). */
const store = {
  get(key) {
    try {
      return localStorage.getItem(`${APP.STORAGE_PREFIX}.${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${APP.STORAGE_PREFIX}.${key}`, String(value));
    } catch {
      /* storage blocked */
    }
  },
};

/**
 * Start a toy (see src/toy.js): `createSong()` returns the song (see
 * src/song/example-song.js), `createVisual(runtime)` builds its visual from
 * the three.js runtime (see src/visual/example-visual.js).
 *
 * Optional song features switch on parts of the panel:
 *   setKey(rootPc, scaleKey), rootPc, scaleKey     → root and scale menus
 *   sections [{ name }], sectionIndex, queueSection(i), evolve → section menu, Evolve, 1-9 keys
 *   regenerate()                                   → New button, n key
 *   caption { title, subtitle }                    → the caption above the slots
 *   plays(id)                                      → whether a voice is in the arrangement right now
 */
export function startApp({ createSong, createVisual }) {
  const song = createSong();
  const $ = (id) => document.getElementById(id);
  const el = {
    ui: $('ui'), logo: $('logo'), status: $('status'), host: $('host'), connect: $('connect'),
    rtt: $('rtt'), fps: $('fps'), play: $('play'), bpm: $('bpm'), bpmValue: $('bpmValue'),
    tilt: $('tilt'), tiltValue: $('tiltValue'), root: $('root'), scale: $('scale'),
    section: $('section'), evolve: $('evolve'), regen: $('regen'), tune: $('tune'), panic: $('panic'),
    trackerToggle: $('trackerToggle'), tracker: $('tracker'), strip: $('strip'),
    captionTitle: $('captionTitle'), captionSubtitle: $('captionSubtitle'),
  };

  document.title = APP.NAME;
  el.logo.textContent = APP.NAME;

  const features = {
    key: typeof song.setKey === 'function',
    sections: Array.isArray(song.sections) && song.sections.length > 0,
    regenerate: typeof song.regenerate === 'function',
  };
  for (const node of document.querySelectorAll('[data-needs]')) node.hidden = !features[node.dataset.needs];

  // --- core -------------------------------------------------------------------

  const runtime = new Runtime($('gl'));
  const visual = createVisual(runtime);
  runtime.visual = visual;
  const tracker = new Tracker(el.tracker);

  const synth = new SynthLink({
    onStatus: (status) => {
      el.status.textContent = status;
      el.status.dataset.state = status === 'connected' ? 'connected'
        : status === 'offline' || status === 'connecting' ? 'idle' : 'error';
      el.connect.textContent = status === 'offline' ? 'Connect' : 'Disconnect';
    },
    onRtt: (rtt) => {
      el.rtt.textContent = rtt == null ? '' : `ping ${rtt.toFixed(1)} ms`;
    },
    onConnected: () => conductor.onConnected(),
  });

  const conductor = new Conductor({
    synth,
    song,
    onEvent: (event, abs) => {
      visual.hit?.(event, abs);
      strip.hit(event);
    },
    onBar: ({ events, changes }) => {
      tracker.setBar(events);
      visual.onBar?.({ events, changes });
      showCaption();
      if (features.sections) el.section.value = String(song.sectionIndex);
      updateAudible();
    },
    onStep: (step) => tracker.setRow(step),
    onLfo: (lfos) => {
      tracker.setLfos(lfos);
      strip.setLfos(lfos);
      visual.setLfo?.(lfos);
    },
  });

  const strip = new Strip(el.strip, conductor, { onChange: () => updateAudible() });

  /** Is a voice sounding: not muted or solo'd out, and in the arrangement while playing. */
  const sounding = (id) => conductor.isAudible(id) && (!conductor.playing || (song.plays?.(id) ?? true));

  function updateAudible() {
    tracker.setSilence((id) => !sounding(id));
    visual.setAudible?.(sounding);
  }

  // --- caption ----------------------------------------------------------------

  let captionTimer = null;
  let lastTitle = null;
  function showCaption() {
    const caption = song.caption;
    if (!caption) return;
    el.captionSubtitle.textContent = caption.subtitle ?? '';
    if (caption.title && caption.title !== lastTitle) flashTitle(caption.title);
    lastTitle = caption.title;
  }
  function flashTitle(text, ms = 5000) {
    el.captionTitle.textContent = text;
    el.captionTitle.classList.add('is-showing');
    clearTimeout(captionTimer);
    if (ms) captionTimer = setTimeout(() => el.captionTitle.classList.remove('is-showing'), ms);
  }

  // --- transport ----------------------------------------------------------------

  function setPlaying(playing) {
    // visibilitychange only fires on a change, so a play started while already
    // hidden would run throttled to ~1 Hz with nothing to stop it.
    if (playing && document.hidden) return;
    if (playing) {
      if (conductor.tuning) setTuning(false);
      conductor.play();
    } else {
      conductor.stop();
      tracker.setRow(-1);
    }
    el.play.textContent = playing ? 'Stop' : 'Play';
    updateAudible();
  }

  function setTuning(on) {
    conductor.setTuning(on); // stops playback first
    el.tune.setAttribute('aria-pressed', String(on));
    el.play.textContent = 'Play';
    tracker.setRow(-1);
    if (on) {
      for (const voice of VOICES) strip.showNote(voice.id, TUNE.NOTE);
      flashTitle(`TUNE · ${trackerName(TUNE.NOTE).replace('-', '')} ON EVERY SLOT`, 0);
    } else {
      el.captionTitle.classList.remove('is-showing');
    }
  }

  /** Re-read the bar after the song changed (new music, key, section). */
  function refresh() {
    conductor.refreshBar();
    showCaption();
    updateAudible();
  }

  // --- panel ----------------------------------------------------------------------

  el.host.value = store.get('host') || NETWORK.DEFAULT_HOST;
  el.host.placeholder = `${NETWORK.DEFAULT_HOST} or ${NETWORK.FALLBACK_HOST}`;
  el.connect.addEventListener('click', () => {
    if (synth.status !== 'offline') return synth.disconnect();
    const host = el.host.value.trim() || NETWORK.DEFAULT_HOST;
    store.set('host', host);
    synth.connect(host);
  });

  el.play.addEventListener('click', () => setPlaying(!conductor.playing));
  el.panic.addEventListener('click', () => synth.panic());
  el.tune.addEventListener('click', () => setTuning(!conductor.tuning));

  Object.assign(el.bpm, { min: TRANSPORT.BPM_MIN, max: TRANSPORT.BPM_MAX, step: 1, value: TRANSPORT.BPM_DEFAULT });
  el.bpmValue.textContent = String(TRANSPORT.BPM_DEFAULT);
  el.bpm.addEventListener('input', () => {
    el.bpmValue.textContent = el.bpm.value;
    conductor.setBpm(Number(el.bpm.value));
  });

  Object.assign(el.tilt, { min: TILT_MIN, max: TILT_MAX, step: 1, value: Number(store.get('tilt')) || VISUALS.TILT_DEFAULT });
  const applyTilt = () => {
    el.tiltValue.textContent = `${el.tilt.value}°`;
    runtime.setTilt(Number(el.tilt.value));
  };
  applyTilt();
  el.tilt.addEventListener('input', () => {
    applyTilt();
    store.set('tilt', el.tilt.value);
  });

  if (features.key) {
    NOTE_NAMES.forEach((name, i) => el.root.add(new Option(name, String(i))));
    for (const [key, { label }] of Object.entries(SCALES)) el.scale.add(new Option(label, key));
    el.root.value = String(song.rootPc ?? 0);
    el.scale.value = song.scaleKey ?? 'minor';
    const setKey = () => {
      song.setKey(Number(el.root.value), el.scale.value);
      refresh();
    };
    el.root.addEventListener('change', setKey);
    el.scale.addEventListener('change', setKey);
  }

  function jumpToSection(index) {
    if (conductor.playing) {
      song.queueSection(index); // lands on the next bar line
    } else {
      song.sectionIndex = index;
      refresh();
    }
    el.section.value = String(index);
  }

  if (features.sections) {
    song.sections.forEach((s, i) => el.section.add(new Option(s.name, String(i))));
    el.section.value = String(song.sectionIndex ?? 0);
    el.section.addEventListener('change', () => jumpToSection(Number(el.section.value)));
    if ('evolve' in song) {
      el.evolve.setAttribute('aria-pressed', String(Boolean(song.evolve)));
      el.evolve.addEventListener('click', () => {
        song.evolve = !song.evolve;
        el.evolve.setAttribute('aria-pressed', String(song.evolve));
      });
    } else {
      el.evolve.hidden = true;
    }
  }

  const newMusic = () => {
    song.regenerate();
    refresh();
  };
  if (features.regenerate) el.regen.addEventListener('click', newMusic);

  const wiring = new Wiring({ dialog: $('wiring'), rows: $('wiringRows'), openButton: $('wiringOpen'), closeButton: $('wiringClose') });

  const setTrackerShown = (shown) => {
    el.tracker.hidden = !shown;
    el.trackerToggle.setAttribute('aria-pressed', String(shown));
    store.set('tracker', shown ? '1' : '0');
  };
  setTrackerShown(store.get('tracker') !== '0');
  el.trackerToggle.addEventListener('click', () => setTrackerShown(el.tracker.hidden));

  // --- keys -----------------------------------------------------------------------

  addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      setPlaying(!conductor.playing);
    } else if (key === 'escape') {
      synth.panic(); // Esc is always Panic, even with the wiring card open
    } else if (key === 'u') {
      setTuning(!conductor.tuning);
    } else if (key === 'w') {
      wiring.toggle();
    } else if (key === 't') {
      setTrackerShown(el.tracker.hidden);
    } else if (key === 'h') {
      el.ui.classList.toggle('is-hidden');
    } else if (key === 'f') {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (key === 'n' && features.regenerate) {
      newMusic();
    } else if (features.sections && /^[1-9]$/.test(key) && Number(key) <= song.sections.length) {
      jumpToSection(Number(key) - 1);
    }
  });

  // Hidden tabs throttle timers to ~1 Hz, which would stutter the sequence and
  // hang gates, so stop instead.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && conductor.playing) setPlaying(false);
  });

  // --- frame loop -------------------------------------------------------------------

  let last = performance.now();
  let fpsShownAt = 0;
  let rafId = 0;
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    runtime.frame(now, {
      pos: conductor.playing ? conductor.position() : null,
      playing: conductor.playing,
      stepsPerSecond: (conductor.bpm / 60) * 4,
    });
    strip.update(dt);
    tracker.draw();
    if (now - fpsShownAt > 500) {
      fpsShownAt = now;
      el.fps.textContent = `${Math.round(runtime.fps)} fps`;
    }
    rafId = requestAnimationFrame(frame);
  }

  refresh();
  rafId = requestAnimationFrame(frame);
  synth.connect(el.host.value);

  // The daemon accepts one client at a time: drop ours before Vite swaps in a
  // new module instance.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(rafId);
      conductor.stop();
      synth.disconnect();
      runtime.dispose();
    });
  }

  return { song, conductor, synth, runtime, visual };
}
