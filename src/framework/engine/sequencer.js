import { TRANSPORT, stepMsFor } from '../../config.js';

/** Resync instead of catching up if we fall further behind than this. */
const RESYNC_MS = 250;

/**
 * 16th-note clock that schedules against ideal step times rather than
 * chaining fixed setTimeouts, so timer jitter doesn't accumulate.
 */
export class Sequencer {
  constructor(onStep) {
    this.onStep = onStep;
    this.bpm = TRANSPORT.BPM_DEFAULT;
    this.playing = false;
    this.step = 0; // absolute steps since start
    this.timer = null;
    this.nextTime = 0;
    this.lastStepTime = 0;
    this.lastStepMs = stepMsFor(this.bpm);
  }

  get stepMs() {
    return stepMsFor(this.bpm);
  }

  setBpm(bpm) {
    this.bpm = bpm; // picked up on the next step
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = performance.now();
    this.#tick();
  }

  stop() {
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** Song position in (fractional) steps, for LFOs and visuals. */
  position(now = performance.now()) {
    if (!this.playing) return this.step;
    const frac = (now - this.lastStepTime) / this.lastStepMs;
    return this.step - 1 + Math.min(Math.max(frac, 0), 1);
  }

  #tick() {
    if (!this.playing) return;

    const stepMs = this.stepMs;
    this.lastStepTime = this.nextTime;
    this.lastStepMs = stepMs;
    const abs = this.step;
    this.step += 1;
    this.onStep(abs % TRANSPORT.STEPS_PER_BAR, abs, stepMs);

    this.nextTime += stepMs;
    const now = performance.now();
    if (this.nextTime < now - RESYNC_MS) this.nextTime = now; // e.g. after a throttled tab
    this.timer = setTimeout(() => this.#tick(), Math.max(0, this.nextTime - now));
  }
}
