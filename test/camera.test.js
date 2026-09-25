import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TILT_MAX, TILT_MIN, cameraDistance } from '../src/framework/runtime/camera.js';

const SUBJECTS = {
  example: { radius: 4.1, height: 1.6, y: 0.4 },
  flat: { radius: 6, height: 0.2, y: 0 },
  tall: { radius: 1.5, height: 6, y: 2 },
  wide: { radius: 5.25, height: 2.2, y: 0.65 },
};

/** Largest |ndc| of the subject's rim, top and bottom, from a rig camera. */
function extent(subject, tilt, aspect, az) {
  const cam = new THREE.PerspectiveCamera(40, aspect, 0.01, 1e4);
  const d = cameraDistance(tilt, aspect, 40, subject);
  const t = (tilt * Math.PI) / 180;
  cam.position.set(d * Math.cos(t) * Math.sin(az), subject.y + d * Math.sin(t), d * Math.cos(t) * Math.cos(az));
  cam.lookAt(0, subject.y, 0);
  cam.updateMatrixWorld();
  let m = 0;
  for (let a = 0; a < 360; a += 3) for (const dy of [-1, 1]) {
    const r = (a * Math.PI) / 180;
    const p = new THREE.Vector3(Math.cos(r) * subject.radius, subject.y + (dy * subject.height) / 2, Math.sin(r) * subject.radius).project(cam);
    m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
  }
  return m;
}

for (const [name, subject] of Object.entries(SUBJECTS)) {
  test(`${name} subject stays in frame, and fills it, at every tilt and screen shape`, () => {
    for (const aspect of [0.5, 1, 1.6, 2.4]) for (let tilt = TILT_MIN; tilt <= TILT_MAX; tilt += 6) for (const az of [-0.12, 0, 0.12]) {
      const m = extent(subject, tilt, aspect, az);
      assert.ok(m < 1, `${name}: clips at aspect ${aspect} tilt ${tilt} az ${az} (${m.toFixed(3)})`);
      assert.ok(m > 0.85, `${name}: too small at aspect ${aspect} tilt ${tilt} (${m.toFixed(3)})`);
    }
  });
}
