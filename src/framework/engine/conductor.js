import { CV_SLOTS, LFO, STEPS_PER_BAR, TUNE } from '../../hardware.js';
import { voiceById, voices } from '../toy.js';
import { LfoBank } from './lfo.js';
import { Sequencer } from './sequencer.js';

/**
 * The note an event sends: its own `note` if it has one, otherwise the
 * voice's fixed note, using `accentNote` for accented hits.
 */
export function eventNote(event, voice) {
  if (event.note != null) return event.note;
  return event.accent && voice.accentNote != null ? voice.accentNote : voice.note;
}

/**
 * Plays a song: reads each bar's events, sends them as CV/gate, runs the
 * LFOs, and reports what happened. Also owns mute, solo and tune mode.
 *
 * The song interface (see src/toys/example/song.js):
 *
 *   resetPosition()      Called on Play, before the first bar.
 *   advanceBar()         Called at the top of every bar except the first.
 *                        Returns an object describing what changed; it is
 *                        passed to onBar untouched.
 *   eventsAt(abs)        Events starting on absolute step `abs` (steps since
 *                        Play). The conductor reads the whole bar at its
 *                        first step, so this must give the same answer for
 *                        any step of the current bar whenever it's asked.
 *   lfoRate              Optional. Multiplies LFO speed; read every bar.
 *
 * An event is { voice, note?, steps?, accent?, ghost?, ...anything }: `voice`
 * is a voice id from the toy's config, `steps` the length in 16ths (synths). Drums
 * may omit `note`: they then send the voice's `note`, or its `accentNote` if
 * `accent` is set (see eventNote). Extra fields are passed to the visual.
 */
export class Conductor {
  constructor({ synth, song, onEvent = () => {}, onBar = () => {}, onStep = () => {}, onLfo = () => {} }) {
    this.synth = synth;
    this.song = song;
    this.onEvent = onEvent;
    this.onBar = onBar;
    this.onStep = onStep;
    this.onLfo = onLfo;
    this.muted = new Set();
    this.soloed = new Set();
    this.tuning = false;
    this.bar = Array.from({ length: STEPS_PER_BAR }, () => []);
    this.barStart = 0;
    this.lfo = new LfoBank(synth);
    this.lfoTimer = null;
    this.sequencer = new Sequencer((step, abs, stepMs) => this.#step(step, abs, stepMs));
  }

  get playing() {
    return this.sequencer.playing;
  }

  play() {
    if (this.playing) return;
    if (this.tuning) this.setTuning(false);
    this.song.resetPosition();
    this.lfo.reset();
    this.lfo.setRate(this.song.lfoRate ?? 1);
    this.sequencer.start();
    this.lfoTimer = setInterval(() => {
      this.lfo.update(this.sequencer.position());
      this.onLfo(this.lfo.lfos);
    }, LFO.TICK_MS);
  }

  stop() {
    this.sequencer.stop();
    clearInterval(this.lfoTimer);
    this.lfoTimer = null;
    this.synth.panic();
  }

  setBpm(bpm) {
    this.sequencer.setBpm(bpm);
  }

  get bpm() {
    return this.sequencer.bpm;
  }

  /** Song position in fractional steps (frozen when stopped). */
  position() {
    return this.sequencer.position();
  }

  /** Call when a connection opens: a fresh connection has every gate low. */
  onConnected() {
    this.lfo.resend();
    if (this.tuning) this.#sendTune();
  }

  // --- mute / solo ---------------------------------------------------------------

  /**
   * Can this voice be heard? Muted voices never. While anything is soloed,
   * only soloed voices play, except LFOs: solo leaves them running, since
   * freezing an LFO that drives a VCA could silence the voice being soloed.
   */
  isAudible(id) {
    if (this.muted.has(id)) return false;
    if (this.soloed.size === 0 || voiceById(id).kind === 'lfo') return true;
    return this.soloed.has(id);
  }

  setMuted(id, muted) {
    this.#changeAudibility(() => (muted ? this.muted.add(id) : this.muted.delete(id)));
  }

  setSoloed(id, soloed) {
    this.#changeAudibility(() => (soloed ? this.soloed.add(id) : this.soloed.delete(id)));
  }

  /** Apply a mute/solo change, closing the gate of anything that went silent. */
  #changeAudibility(change) {
    const before = new Set(voices().filter((v) => this.isAudible(v.id)).map((v) => v.id));
    change();
    for (const voice of voices()) {
      if (before.has(voice.id) && !this.isAudible(voice.id)) this.synth.gateOff(voice.slot);
    }
    this.lfo.muted = new Set(voices().filter((v) => v.kind === 'lfo' && !this.isAudible(v.id)).map((v) => v.id));
    this.lfo.resend(); // anything that came back gets its current value again
  }

  // --- tune mode -----------------------------------------------------------------

  /**
   * Tune mode: stop, then every slot's CV to TUNE.NOTE with the synth gates
   * held open. Off closes the gates.
   */
  setTuning(on) {
    if (on && this.playing) this.stop();
    this.tuning = on;
    if (on) this.#sendTune();
    else this.synth.panic();
  }

  /**
   * The protocol can't set a CV without raising the gate, so non-synth slots
   * get the gate dropped straight after: a sub-millisecond blip.
   */
  #sendTune() {
    for (let slot = 0; slot < CV_SLOTS; slot += 1) {
      this.synth.holdCv(slot, TUNE.NOTE);
      if (voices().find((v) => v.slot === slot)?.kind !== 'synth') this.synth.gateOff(slot);
    }
  }

  // --- the bar -------------------------------------------------------------------

  /** Re-read the current bar, e.g. after the song changed under it. */
  refreshBar(changes = { refreshed: true }) {
    this.bar = Array.from({ length: STEPS_PER_BAR }, (_, i) => this.song.eventsAt(this.barStart + i));
    this.onBar({ events: this.bar, changes });
  }

  #step(step, abs, stepMs) {
    if (step === 0) {
      const changes = abs === 0 ? { first: true } : this.song.advanceBar();
      this.barStart = abs;
      this.lfo.setRate(this.song.lfoRate ?? 1);
      this.refreshBar(changes);
    }

    for (const event of this.bar[step]) {
      if (!this.isAudible(event.voice)) continue;
      const voice = voiceById(event.voice);
      const lengthMs = voice.kind === 'drum' ? voice.trigMs : Math.max(10, (event.steps ?? 1) * stepMs * voice.gate);
      this.synth.playCv(voice.slot, eventNote(event, voice), lengthMs);
      this.onEvent(event, abs);
    }
    this.onStep(step, abs);
  }
}
