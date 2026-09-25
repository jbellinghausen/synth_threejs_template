import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VISUALS } from '../../config.js';
import { TILT_MAX, TILT_MIN, cameraDistance } from './camera.js';

/**
 * The three.js side of the framework: renderer, scene, camera and a
 * post-processing chain (feedback trails → bloom → tone mapping), resized to
 * the window, with adaptive resolution and a camera rig that keeps the
 * visual's subject in frame at any tilt.
 *
 * A visual gets this object and may use or tune any of it:
 *   scene, camera, renderer, composer
 *   trails        feedback: `trails` (0 = off) is per-frame persistence at 60 fps
 *   bloom         UnrealBloomPass: .strength, .radius, .threshold
 *   subject       { radius, height, y }: what the camera rig keeps in view
 *   rig           false to drive the camera yourself
 *   push          0..1, pulls the rig camera in (e.g. on a big hit)
 *   sway          side-to-side rig movement in radians
 */
export class Runtime {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scale = VISUALS.RENDER_SCALE;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060f);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0);
    this.composer.addPass(this.afterimage);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.6, 0.35);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.trails = 0.6;
    this.subject = { radius: 5, height: 2, y: 0 };
    this.rig = true;
    this.tilt = VISUALS.TILT_DEFAULT;
    this.push = 0;
    this.sway = 0.12;
    this.time = 0;

    this.visual = null;
    this.last = performance.now();
    this.frameMs = 16;
    this.fps = 60;
    this.lastScaleChange = 0;

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  get pixelRatio() {
    return Math.min(devicePixelRatio, 2) * this.scale;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Camera tilt in degrees above the horizon (the View slider). */
  setTilt(degrees) {
    this.tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, degrees));
  }

  /** Where the rig puts the camera this frame, at `tiltDeg`. */
  #placeCamera(requestedDeg) {
    const tiltDeg = Math.min(TILT_MAX, Math.max(TILT_MIN, requestedDeg));
    const tilt = (tiltDeg * Math.PI) / 180;
    const { radius, height, y } = this.subject;
    const dist = cameraDistance(tiltDeg, this.camera.aspect, this.camera.fov, { radius, height }) * (1 - 0.05 * this.push);
    const az = Math.sin(this.time * 0.025) * this.sway;
    this.camera.position.set(dist * Math.cos(tilt) * Math.sin(az), y + dist * Math.sin(tilt), dist * Math.cos(tilt) * Math.cos(az));
    this.camera.lookAt(0, y, 0);
  }

  /**
   * One frame. `info` is { pos, playing, stepsPerSecond }; the visual's
   * update() gets it plus dt and time, and may set frame.tiltOffset (degrees)
   * to move the camera rig off the View setting (e.g. from an LFO).
   */
  frame(now, info) {
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    this.#adaptResolution(dt * 1000, now);

    const frame = { ...info, dt, time: this.time, tiltOffset: 0 };
    this.visual?.update(frame);
    if (this.rig) this.#placeCamera(this.tilt + frame.tiltOffset);

    this.afterimage.enabled = this.trails > 0;
    this.afterimage.damp = Math.min(0.97, this.trails) ** (dt * 60); // same trail length at any frame rate
    this.composer.render(dt);
  }

  /** Nudge the render resolution to hold the frame rate. */
  #adaptResolution(frameMs, now) {
    this.frameMs += (frameMs - this.frameMs) * 0.05;
    this.fps = 1000 / this.frameMs;
    if (now - this.lastScaleChange < 1500) return;
    const [lo, hi] = VISUALS.TARGET_FRAME_MS;
    let next = this.scale;
    if (this.frameMs > hi) next = Math.max(VISUALS.RENDER_SCALE_MIN, this.scale * 0.85);
    else if (this.frameMs < lo) next = Math.min(VISUALS.RENDER_SCALE_MAX, this.scale * 1.1);
    if (Math.abs(next - this.scale) > 0.01) {
      this.lastScaleChange = now;
      this.scale = next;
      this.resize();
    }
  }

  dispose() {
    this.visual?.dispose?.();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
