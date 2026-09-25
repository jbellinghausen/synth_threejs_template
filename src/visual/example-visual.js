// An example visual, to replace. One orb per voice on a ring that turns once
// per bar; orbs flash when their voice plays, dim when it's silent, and the
// LFOs drive a halo and nudge the camera.
//
// The visual interface (every method optional except update):
//   constructor(runtime)   build your scene; see src/framework/runtime/runtime.js
//   hit(event, abs)        a voice played (only audible ones reach you)
//   setLfo(lfos)           ~50 times a second: [{ voice, value (0..1), note }]
//   setAudible(isAudible)  isAudible(id): muted / solo'd out / not in the arrangement
//   onBar({ events, changes })  top of each bar: its events, and what the song said changed
//   update(frame)          every frame: { dt, time, pos, playing, stepsPerSecond };
//                          set frame.tiltOffset (degrees) to move the camera rig
//   dispose()

import * as THREE from 'three';
import { TRANSPORT, VOICES } from '../config.js';

const TAU = Math.PI * 2;
const RING = 3.2;

export class ExampleVisual {
  constructor(runtime) {
    // Tell the camera rig how big the subject is, so it stays in frame.
    runtime.subject = { radius: RING + 0.9, height: 1.6, y: 0.4 };
    runtime.trails = 0.5;
    runtime.bloom.strength = 0.7;

    const { scene } = runtime;
    scene.add(new THREE.HemisphereLight(0x8090ff, 0x1a1006, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 8, 5);
    scene.add(key);

    this.group = new THREE.Group();
    scene.add(this.group);

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(RING, 0.012, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0xf4c55a, transparent: true, opacity: 0.3 }),
    );
    track.rotation.x = Math.PI / 2;
    this.group.add(track);

    this.orbs = new Map();
    const sounders = VOICES.filter((v) => v.kind !== 'lfo');
    const sphere = new THREE.SphereGeometry(0.42, 32, 16);
    sounders.forEach((voice, i) => {
      const angle = (i / sounders.length) * TAU;
      const color = new THREE.Color().setHSL(0.08 + i / sounders.length * 0.5, 0.75, 0.55);
      const material = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.2, transparent: true,
      });
      const mesh = new THREE.Mesh(sphere, material);
      mesh.position.set(Math.cos(angle) * RING, 0.45, Math.sin(angle) * RING);
      this.group.add(mesh);
      this.orbs.set(voice.id, { mesh, material, level: 0, presence: 1, target: 1 });
    });

    // A halo in the middle: LFO A sets its size, LFO B its colour.
    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x4fe0a8, transparent: true, opacity: 0.55 }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 0.2;
    scene.add(this.halo);

    this.lfo = {};
    this.idlePos = 0;
    this.tilt = 0;
  }

  hit(event) {
    const orb = this.orbs.get(event.voice);
    if (orb) orb.level = event.ghost ? 0.4 : event.accent ? 1 : 0.75;
  }

  setLfo(lfos) {
    for (const l of lfos) this.lfo[l.voice.id] = l.value;
  }

  setAudible(isAudible) {
    for (const [id, orb] of this.orbs) orb.target = isAudible(id) ? 1 : 0.15;
  }

  update(frame) {
    const { dt, pos, stepsPerSecond } = frame;
    // One turn per bar while playing; a slow drift when stopped.
    if (pos == null) this.idlePos += dt * stepsPerSecond * 0.2;
    const p = pos ?? this.idlePos;
    this.group.rotation.y = -(p / TRANSPORT.STEPS_PER_BAR) * TAU;

    for (const orb of this.orbs.values()) {
      orb.level *= Math.exp(-dt / 0.2);
      orb.presence += (orb.target - orb.presence) * (1 - Math.exp(-dt * 3));
      orb.mesh.scale.setScalar(0.6 + 0.4 * orb.presence + 0.5 * orb.level);
      orb.material.emissiveIntensity = 0.05 + 2.2 * orb.level;
      orb.material.opacity = orb.presence;
    }

    const a = this.lfo.lfoA ?? 0.5;
    const b = this.lfo.lfoB ?? 0.5;
    this.halo.scale.setScalar(0.6 + 1.6 * a);
    this.halo.material.color.setHSL(0.35 + 0.25 * b, 0.7, 0.3);

    // The S&H LFO nudges the camera a few degrees either way, eased: it
    // jumps to a new value every beat.
    const target = ((this.lfo.snh ?? 0.5) - 0.5) * 6;
    this.tilt += (target - this.tilt) * (1 - Math.exp(-dt * 2));
    frame.tiltOffset = this.tilt;
  }
}
