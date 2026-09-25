// What's the same for every toy: the Pi, its outputs and their limits.
// Each toy's own settings (its name, slot map, tempo) are in src/toys/<id>/.

export const NETWORK = {
  DEFAULT_HOST: 'raspberrypi.local',
  FALLBACK_HOST: '192.168.1.234',
  PORT: 9743,
  RETRY_MS: 2000,
  PING_INTERVAL_MS: 3000,
};

/** Hardware limit: 1 V/oct, note 24 = 0 V, clamping at 3.3 V (note 63 = 3.25 V). */
export const CV_NOTE_MIN = 24;
export const CV_NOTE_MAX = 63;
export const CV_SLOTS = 12;

/**
 * The panel labels its jacks 1-12, the protocol numbers slots 0-11. The UI
 * shows panel numbers; every `slot` in a toy's config is a protocol slot
 * (jack - 1). Set to 0 to show protocol numbers instead.
 */
export const JACK_OFFSET = 1;
export const jackLabel = (slot) => String(slot + JACK_OFFSET).padStart(2, '0');

/** The clock runs in 16th notes, 16 to a bar. */
export const STEPS_PER_BAR = 16;

export function stepMsFor(bpm) {
  return 60000 / bpm / 4;
}

/**
 * Tune mode: every CV slot to one note (48 = C3 = 2.0 V), gates held high on
 * the synth voices so their oscillators sound.
 */
export const TUNE = { NOTE: 48 };

export const LFO = {
  /** How often LFO outputs are recomputed. Values are only sent on change. */
  TICK_MS: 20,
};

/**
 * localStorage prefix for settings shared by every toy (the Pi's address,
 * the last toy picked). Each toy's own settings are prefixed with its id.
 */
export const STORAGE_PREFIX = 'synth-toys';
