import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/addons/loaders/GLTFLoader.js';

export class ObjectManager {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'controlled-object';
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);
    this.materialState = { color: '#f0ad39', metalness: 0.25, roughness: 0.4 };
    this.materials = [];
    this.loader = new GLTFLoader();
    this.requestId = 0;
    this.yaw = 0;
    this.modelName = 'cube';
    this.showPreview();
  }

  async setModel(name) {
    const request = ++this.requestId;
    let model;
    if (name === 'pyramid') {
      const gltf = await this.loader.loadAsync(new URL('../../assets/pyramid.gltf', import.meta.url).href);
      model = gltf.scene;
    } else {
      const geometry = name === 'knot'
        ? new THREE.TorusKnotGeometry(0.7, 0.24, 96, 12)
        : new THREE.BoxGeometry(1, 1, 1);
      model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    }
    if (request !== this.requestId) { this.disposeModel(model); return false; }
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    const fitted = new THREE.Group();
    fitted.add(model);
    fitted.scale.setScalar(0.24 / Math.max(size.x, size.y, size.z));
    for (const old of [...this.pivot.children]) { this.pivot.remove(old); this.disposeModel(old); }
    this.pivot.add(fitted);
    this.materials = [];
    model.traverse(node => {
      if (!node.isMesh) return;
      const originals = Array.isArray(node.material) ? node.material : [node.material];
      const materials = originals.map(original => {
        const material = original.isMeshStandardMaterial ? original.clone() : new THREE.MeshStandardMaterial({ map: original.map });
        this.materials.push(material);
        original.dispose();
        return material;
      });
      node.material = Array.isArray(node.material) ? materials : materials[0];
    });
    this.modelName = name;
    this.applyMaterial();
    return true;
  }

  applyMaterial(update = {}) {
    Object.assign(this.materialState, update);
    for (const material of this.materials) {
      material.color.set(this.materialState.color);
      material.metalness = Number(this.materialState.metalness);
      material.roughness = Number(this.materialState.roughness);
      material.envMapIntensity = 1;
    }
  }

  rotate(degrees) {
    this.yaw = (this.yaw + degrees + 360) % 360;
    this.pivot.rotation.y = THREE.MathUtils.degToRad(this.yaw);
    return this.yaw;
  }

  resetRotation() { this.yaw = 0; this.pivot.rotation.y = 0; }

  place(matrix) {
    new THREE.Matrix4().fromArray(matrix).decompose(this.root.position, this.root.quaternion, this.root.scale);
    this.root.visible = true;
  }

  showPreview() {
    this.root.position.set(0, 0.04, -0.8);
    this.root.quaternion.identity();
    this.root.scale.setScalar(1);
    this.root.visible = true;
  }

  disposeModel(model) {
    const geometries = new Set(), materials = new Set();
    model.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
}
