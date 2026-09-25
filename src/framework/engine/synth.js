import { SynthModuleClient } from 'synth-module-client';
import { CV_NOTE_MAX, CV_NOTE_MIN, NETWORK } from '../../hardware.js';

const clampNote = (note) => Math.max(CV_NOTE_MIN, Math.min(CV_NOTE_MAX, Math.round(note)));

/**
 * Owns the single connection to the daemon for the life of the page.
 * The daemon accepts one client at a time, so there must never be two.
 *
 * Every send is a no-op while offline: the demo runs without the hardware.
 */
export class SynthLink {
  constructor({ onStatus = () => {}, onRtt = () => {}, onConnected = () => {} } = {}) {
    this.onStatus = onStatus;
    this.onRtt = onRtt;
    this.onConnected = onConnected;
    this.client = null;
    this.status = 'offline';
    this.gateTimers = new Map();
    this.retryTimer = null;
    this.pingTimer = null;
    this.stopped = true;
  }

  get isConnected() {
    return Boolean(this.client && this.client.isConnected);
  }

  #setStatus(status) {
    this.status = status;
    this.onStatus(status);
  }

  /** Connect to `host` and keep retrying until disconnect(). */
  connect(host) {
    this.disconnect();
    this.stopped = false;
    this.client = new SynthModuleClient(host, { port: NETWORK.PORT });
    this.client.onclose = () => {
      this.#setStatus('disconnected');
      this.#retry();
    };
    this.#attempt();
  }

  async #attempt() {
    if (this.stopped || !this.client) return;
    this.#setStatus('connecting');
    try {
      await this.client.connect();
      if (this.stopped) return this.client.close();
      this.#setStatus('connected');
      this.#startPinging();
      this.onConnected();
    } catch (err) {
      this.#setStatus(err.message); // verbatim, e.g. "Daemon is busy with another client"
      this.#retry();
    }
  }

  #retry() {
    if (this.stopped) return;
    this.#stopPinging();
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.#attempt(), NETWORK.RETRY_MS);
  }

  #startPinging() {
    this.#stopPinging();
    const tick = async () => {
      if (!this.isConnected) return;
      try {
        this.onRtt((await this.client.ping()).rttMs);
      } catch {
        this.onRtt(null);
      }
    };
    tick();
    this.pingTimer = setInterval(tick, NETWORK.PING_INTERVAL_MS);
  }

  #stopPinging() {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.onRtt(null);
  }

  disconnect() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.#stopPinging();
    this.#clearGateTimers();
    if (this.client) {
      this.client.onclose = null;
      this.client.close();
      this.client = null;
    }
    this.#setStatus('offline');
  }

  #clearGateTimers() {
    for (const timer of this.gateTimers.values()) clearTimeout(timer);
    this.gateTimers.clear();
  }

  #send(fn) {
    if (!this.isConnected) return false;
    try {
      fn(this.client);
      return true;
    } catch {
      return false; // raced with a disconnect; the daemon drops gates on close
    }
  }

  /**
   * Fixed-length note (or trigger). Replaying a slot cancels its pending
   * gate-off, so an old note can't cut a new one short.
   */
  playCv(slot, note, lengthMs) {
    clearTimeout(this.gateTimers.get(slot));
    if (!this.#send((c) => c.cvNoteOn(slot, clampNote(note)))) return;
    this.gateTimers.set(slot, setTimeout(() => {
      this.gateTimers.delete(slot);
      this.#send((c) => c.cvGateOff(slot));
    }, lengthMs));
  }

  /** Move a slot's CV with its gate held high (legato: no retrigger). */
  holdCv(slot, note) {
    clearTimeout(this.gateTimers.get(slot));
    this.gateTimers.delete(slot);
    return this.#send((c) => c.cvNoteOn(slot, clampNote(note)));
  }

  gateOff(slot) {
    clearTimeout(this.gateTimers.get(slot));
    this.gateTimers.delete(slot);
    this.#send((c) => c.cvGateOff(slot));
  }

  /** Drop every gate right now. */
  panic() {
    this.#clearGateTimers();
    this.#send((c) => c.allNotesOff());
  }
}
