// Toy definitions, and which toy is running.
//
// Each toy lives in src/toys/<id>/ and its index.js default-exports
// defineToy({...}). The framework reads everything toy-specific (the slot
// map, tempo, visual settings) from the active toy, so several toys can live
// in one project. Only one runs per page load.

const DEFAULT_TRANSPORT = { BPM_MIN: 60, BPM_MAX: 180, BPM_DEFAULT: 120 };

const DEFAULT_VISUALS = {
  /** Render scale as a fraction of the screen's pixels; drops (never above RENDER_SCALE_MAX) to hold the frame rate. */
  RENDER_SCALE: 1,
  RENDER_SCALE_MIN: 0.4,
  RENDER_SCALE_MAX: 1,
  /** Frame-time band the adaptive resolution aims for, in ms. */
  TARGET_FRAME_MS: [12, 19],
  /** Default camera tilt for the View slider, degrees above the horizon. */
  TILT_DEFAULT: 55,
};

/**
 * Define a toy.
 *
 *   id            lowercase, [a-z0-9-]; the folder name, the ?toy= value and
 *                 the prefix for its saved settings
 *   name          shown in the picker and the page title
 *   description   optional, one line (the picker's tooltip)
 *   voices        the slot map: see src/toys/example/config.js
 *   transport     optional { BPM_MIN, BPM_MAX, BPM_DEFAULT }
 *   visuals       optional overrides of DEFAULT_VISUALS above
 *   createSong()               returns the song
 *   createVisual(runtime, song) returns the visual
 */
export function defineToy(def) {
  const problems = [];
  if (!/^[a-z0-9-]+$/.test(def.id ?? '')) problems.push('id must be lowercase letters, digits or -');
  if (!def.name) problems.push('name is required');
  if (!Array.isArray(def.voices)) problems.push('voices must be an array');
  if (typeof def.createSong !== 'function') problems.push('createSong must be a function');
  if (typeof def.createVisual !== 'function') problems.push('createVisual must be a function');
  if (problems.length) throw new Error(`defineToy(${def.id ?? '?'}): ${problems.join('; ')}`);

  return Object.freeze({
    id: def.id,
    name: def.name,
    description: def.description ?? '',
    voices: def.voices,
    voice: Object.fromEntries(def.voices.map((v) => [v.id, v])),
    transport: { ...DEFAULT_TRANSPORT, ...def.transport },
    visuals: { ...DEFAULT_VISUALS, ...def.visuals },
    createSong: def.createSong,
    createVisual: def.createVisual,
  });
}

let active = null;

/** Make `toy` the one the framework plays. Call before building anything else. */
export function useToy(toy) {
  active = toy;
}

/** The toy that's running. */
export function activeToy() {
  if (!active) throw new Error('No active toy: call useToy(toy) first (main.js does this).');
  return active;
}

/** The active toy's voices (its slot map). */
export const voices = () => activeToy().voices;

/** One of the active toy's voices, by id. */
export const voiceById = (id) => activeToy().voice[id];
