import * as THREE from 'three';
import { ObjectManager } from './ObjectManager.js';
import { EnvironmentLighting } from './EnvironmentLighting.js';
import { UIController } from './UIController.js';
import { XRPlacement } from './XRPlacement.js';

export class SceneController {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 30);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    document.body.appendChild(this.renderer.domElement);
    this.ui = new UIController();
    this.object = new ObjectManager(this.scene);
    this.lighting = new EnvironmentLighting(this.scene, this.renderer);
    this.grid = new THREE.GridHelper(2, 20, 0x526c94, 0x263750);
    this.grid.position.set(0, 0.035, -0.8);
    this.scene.add(this.grid);
    this.placement = new XRPlacement(this.renderer, this.scene, this.object, this.ui, active => {
      this.grid.visible = !active;
      if (!active) {
        this.camera.position.set(0, 0, 0);
        this.camera.quaternion.identity();
        requestAnimationFrame(() => this.resize());
      }
    });
    this.ui.bind(this.object, this.placement);
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop((_time, frame) => {
      this.placement.update(frame);
      this.renderer.render(this.scene, this.camera);
    });
  }

  async initialize() {
    await this.object.setModel('cube');
    this.placement.checkSupport();
    try {
      await this.lighting.load();
      document.querySelector('#lighting-status').textContent = 'Освещение: HDRI studio.hdr · PBR';
      document.documentElement.dataset.hdri = 'ready';
    } catch (error) {
      document.querySelector('#lighting-status').textContent = 'HDRI не загружена — временно используются обычные источники света';
      console.error(error);
      document.documentElement.dataset.hdri = 'failed';
    }
    document.documentElement.dataset.task5 = 'ready';
  }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
