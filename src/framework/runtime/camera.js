// Camera framing: how far back to sit, for a given tilt and screen shape, so
// a subject stays in view.

export const TILT_MIN = 10;
export const TILT_MAX = 88; // straight down (90) makes the camera's up vector degenerate
/** Fraction of the screen the subject may fill, edge to edge. */
const FILL = 0.94;
const SAMPLES = 48;

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Distance from the subject's centre for a tilt (degrees above the horizon).
 *
 * The subject is a cylinder of `radius` and `height` centred on the target.
 * This projects its rim, top and bottom, through the camera and finds the
 * nearest distance at which all of it fits. A closed-form estimate goes wrong
 * for flat subjects seen side-on, whose near edge is much closer to the
 * camera than their middle. The subject is round, so the result doesn't
 * depend on where the camera sits around it.
 */
export function cameraDistance(tiltDeg, aspect, fovDeg, { radius, height }) {
  const tilt = rad(tiltDeg);
  const tanV = Math.tan(rad(fovDeg / 2));
  const tanH = tanV * aspect;
  // Camera basis for a camera on the +Z side of the target, looking at it.
  const back = [0, Math.sin(tilt), Math.cos(tilt)]; // from the target towards the camera
  const up = [0, Math.cos(tilt), -Math.sin(tilt)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const fits = (d) => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const a = (i / SAMPLES) * Math.PI * 2;
      for (const y of [-height / 2, height / 2]) {
        const v = [Math.cos(a) * radius - back[0] * d, y - back[1] * d, Math.sin(a) * radius - back[2] * d];
        const depth = -dot(v, back);
        if (depth <= 0) return false;
        if (Math.abs(v[0] / (depth * tanH)) > FILL || Math.abs(dot(v, up) / (depth * tanV)) > FILL) return false;
      }
    }
    return true;
  };

  let lo = 0;
  let hi = (radius + height) * 4;
  while (!fits(hi)) hi *= 2;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
