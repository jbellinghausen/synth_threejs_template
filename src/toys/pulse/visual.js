// A row of 16 columns, one per step. The column under the playhead lights
// up, blips raise their column by pitch, kicks pulse the floor, and the SWEEP
// LFO tints everything.

import * as THREE from 'three';
import { STEPS_PER_BAR } from '../../hardware.js';
import { VOICE } from './config.js';

const WIDTH = 9;

export class PulseVisual {
  constructor(runtime) {
    runtime.subject = { radius: WIDTH / 2 + 0.5, height: 3, y: 1 };
    runtime.trails = 0.3;
    runtime.bloom.strength = 0.8;
    runtime.scene.add(new THREE.HemisphereLight(0xa0b0ff, 0x101010, 1.2));

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH + 1, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x151a30, emissive: 0xff5fa8, emissiveIntensity: 0 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    runtime.scene.add(this.floor);

    const box = new THREE.BoxGeometry(0.42, 1, 0.42);
    box.translate(0, 0.5, 0);
    this.columns = Array.from({ length: STEPS_PER_BAR }, (_, i) => {
      const material = new THREE.MeshStandardMaterial({ color: 0x4fe0a8, emissive: 0x4fe0a8, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(box, material);
      mesh.position.x = (i / (STEPS_PER_BAR - 1) - 0.5) * WIDTH;
      mesh.scale.y = 0.1;
      runtime.scene.add(mesh);
      return { mesh, material, height: 0.1, glow: 0 };
    });
    this.kick = 0;
    this.sweep = 0.5;
  }

  hit(event, abs) {
    if (event.voice === 'kick') this.kick = 1;
    if (event.voice === 'blip') {
      const [lo, hi] = VOICE.blip.range;
      const column = this.columns[abs % STEPS_PER_BAR];
      column.height = 0.6 + 2.2 * ((event.note - lo) / (hi - lo));
      column.glow = 1;
    }
  }

  setLfo(lfos) {
    this.sweep = lfos.find((l) => l.voice.id === 'sweep')?.value ?? this.sweep;
  }

  update({ dt, pos }) {
    const here = pos == null ? -1 : Math.floor(pos) % STEPS_PER_BAR;
    this.kick *= Math.exp(-dt / 0.15);
    this.floor.material.emissiveIntensity = this.kick * 0.6;
    this.columns.forEach((c, i) => {
      c.glow *= Math.exp(-dt / 0.3);
      c.height += (0.1 - c.height) * (1 - Math.exp(-dt * 1.5));
      c.mesh.scale.y = c.height;
      c.material.color.setHSL(0.45 + 0.4 * this.sweep, 0.7, 0.5);
      c.material.emissive.copy(c.material.color);
      c.material.emissiveIntensity = c.glow * 2 + (i === here ? 0.8 : 0.02);
    });
  }
}
