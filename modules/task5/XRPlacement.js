import * as THREE from 'three';

export class XRPlacement {
  constructor(renderer, scene, object, ui, onModeChange) {
    Object.assign(this, { renderer, scene, object, ui, onModeChange });
    this.session = null;
    this.source = null;
    this.matrix = null;
    this.error = '';
    this.lastState = '';
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.15, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x86efac, side: THREE.DoubleSide })
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    scene.add(this.reticle);
  }

  async checkSupport() {
    if (!isSecureContext) { this.ui.status('Для AR требуется HTTPS. Управление 3D-объектом доступно в предпросмотре.'); return; }
    if (!navigator.xr) { this.ui.status('Доступен 3D-просмотр. Для AR нужен Android Chrome с WebXR и ARCore.'); return; }
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      this.ui.setSupported(supported);
      this.ui.status(supported ? 'Меняйте модель и материал. Для размещения на поверхности нажмите «Начать AR».' : 'AR не поддерживается устройством. Цвет, модели и PBR доступны в 3D-просмотре.');
    } catch (error) { this.ui.status(`Ошибка проверки AR: ${error.message}`); }
  }

  async start() {
    this.error = '';
    this.ui.startButton.disabled = true;
    this.ui.status('Запускаем AR…');
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor', 'hit-test', 'dom-overlay'],
        domOverlay: { root: this.ui.overlay }
      });
      this.session = session;
      session.addEventListener('end', () => this.cleanup(session), { once: true });
      session.addEventListener('select', () => this.place());
      this.object.root.visible = false;
      this.ui.setAR(true);
      this.onModeChange(true);
      await this.renderer.xr.setSession(session);
      if (this.session !== session) return;
      const viewer = await session.requestReferenceSpace('viewer');
      const source = await session.requestHitTestSource({ space: viewer });
      if (this.session !== session) { source.cancel(); return; }
      this.source = source;
      this.lastState = 'searching';
      this.ui.status('Ищем поверхность. Медленно двигайте телефон над освещённым полом или столом.');
    } catch (error) {
      this.error = `AR не запустился: ${error.name} — ${error.message}`;
      const active = this.session;
      if (active) { await active.end().catch(() => {}); this.cleanup(active); }
      this.ui.startButton.disabled = false;
      this.ui.status(this.error);
    }
  }

  update(frame) {
    if (!this.source || !frame) return;
    try {
      const space = this.renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(this.source);
      const pose = space && hits.length ? hits[0].getPose(space) : null;
      this.matrix = pose ? Array.from(pose.transform.matrix) : null;
      this.reticle.visible = Boolean(pose);
      this.ui.setTarget(Boolean(pose));
      if (pose) {
        this.reticle.matrix.fromArray(this.matrix);
        this.reticle.matrixWorldNeedsUpdate = true;
      }
      const state = pose ? 'found' : 'searching';
      if (state !== this.lastState) {
        this.ui.status(pose ? 'Поверхность найдена. Нажмите «Поставить объект».' : 'Поверхность потеряна. Найдите зелёное кольцо; поставленный объект остаётся на месте.');
        this.lastState = state;
      }
    } catch (error) {
      this.matrix = null;
      this.reticle.visible = false;
      this.ui.setTarget(false);
      this.ui.status(`Ошибка hit-test: ${error.message}`);
    }
  }

  place() {
    if (!this.session || !this.matrix) return;
    this.object.place(this.matrix);
    this.ui.status('Объект поставлен. Откройте «Настроить объект», чтобы менять его в AR.');
  }

  end() { return this.session?.end(); }

  cleanup(session) {
    if (this.session !== session) return;
    this.source?.cancel();
    this.source = null;
    this.session = null;
    this.matrix = null;
    this.reticle.visible = false;
    this.object.showPreview();
    this.ui.setAR(false);
    this.onModeChange(false);
    this.ui.status(this.error || 'AR завершён. Можно продолжить настройку в 3D.');
  }
}
