// Сглаживает положение, поворот и масштаб очков, оставляя их привязанными
// к точке 168 лица. Умеренное сглаживание не создаёт большой задержки.
AFRAME.registerComponent('smooth-face-follow', {
  schema: {
    target: { type: 'selector' },
    responseMs: { type: 'number', default: 65 }
  },
  init() {
    this.position = new AFRAME.THREE.Vector3();
    this.rotation = new AFRAME.THREE.Quaternion();
    this.scale = new AFRAME.THREE.Vector3();
    this.needsSnap = true;
    this.el.object3D.visible = false;
  },
  tick(_time, delta) {
    const target = this.data.target?.object3D;
    if (!target || !target.visible) {
      this.el.object3D.visible = false;
      this.needsSnap = true;
      return;
    }
    target.updateWorldMatrix(true, false);
    target.getWorldPosition(this.position);
    target.getWorldQuaternion(this.rotation);
    target.getWorldScale(this.scale);
    const glasses = this.el.object3D;
    const alpha = this.needsSnap ? 1 : 1 - Math.exp(-Math.min(delta, 100) / this.data.responseMs);
    glasses.position.lerp(this.position, alpha);
    glasses.quaternion.slerp(this.rotation, alpha);
    glasses.scale.lerp(this.scale, alpha);
    glasses.visible = true;
    this.needsSnap = false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  const status = document.querySelector('#face-status');
  scene.addEventListener('arReady', () => { status.textContent = 'Наведите переднюю камеру на лицо'; });
  scene.addEventListener('targetFound', () => { status.textContent = 'Лицо найдено — очки отслеживают движение'; });
  scene.addEventListener('targetLost', () => { status.textContent = 'Лицо потеряно — вернитесь в кадр'; });
  scene.addEventListener('arError', () => { status.textContent = 'Не удалось запустить камеру. Проверьте HTTPS и разрешение камеры.'; });
});
