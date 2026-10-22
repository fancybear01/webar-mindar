import * as THREE from 'three';
import { RGBELoader } from '../../vendor/addons/loaders/RGBELoader.js';

export class EnvironmentLighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x52627d, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 2);
    scene.add(key);
  }

  async load() {
    const texture = await new RGBELoader().loadAsync(new URL('../../assets/studio.hdr', import.meta.url).href);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    try {
      this.environment = pmrem.fromEquirectangular(texture);
      this.scene.environment = this.environment.texture;
    } finally {
      texture.dispose();
      pmrem.dispose();
    }
  }

  dispose() { this.scene.environment = null; this.environment?.dispose(); }
}
