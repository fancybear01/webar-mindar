import * as THREE from './vendor/three-0.160.0.module.js';

const status = document.querySelector('#xr-status');
const startButton = document.querySelector('#start-ar');
const endButton = document.querySelector('#end-ar');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 20);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7080a0, 2));
const light = new THREE.DirectionalLight(0xffffff, 2.2);
light.position.set(1, 2, 1);
scene.add(light);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.setAnimationLoop(render);
document.body.appendChild(renderer.domElement);

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.09, 0.13, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

const cubeGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xf0ad39, metalness: 0.15, roughness: 0.48 });
let session = null;
let hitTestSource = null;
let lastHitMatrix = null;

if (!window.isSecureContext) {
  status.textContent = 'Для AR откройте эту страницу через HTTPS.';
} else if (!navigator.xr) {
  status.textContent = 'Этот браузер не поддерживает WebXR. Используйте Chrome на Android с ARCore.';
} else {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (supported) {
      status.textContent = 'Устройство готово. Нажмите «Начать AR».';
      startButton.disabled = false;
    } else {
      status.textContent = 'Immersive AR недоступен. Проверьте Chrome и Сервисы Google Play для AR.';
    }
  }).catch(() => { status.textContent = 'Не удалось проверить поддержку WebXR.'; });
}

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  try {
    // local-floor задаёт устойчивую систему координат; hit-test ищет плоскость.
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor', 'hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });
    session.addEventListener('end', onSessionEnd, { once: true });
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace, entityTypes: ['plane'] });
    session.addEventListener('select', placeCube);
    startButton.hidden = true;
    endButton.hidden = false;
    status.textContent = 'Ищем плоскость. Медленно наведите камеру на пол или стол.';
  } catch (error) {
    status.textContent = `AR не запустился: ${error?.message || error}`;
    startButton.disabled = false;
    if (session) await session.end().catch(() => {});
  }
});

endButton.addEventListener('click', () => session?.end());

function placeCube() {
  if (!lastHitMatrix) return;
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  // Позиция сохранена в local-floor; объект добавлен в сцену, а не к камере.
  const pose = new THREE.Matrix4().fromArray(lastHitMatrix);
  pose.decompose(cube.position, cube.quaternion, cube.scale);
  cube.position.y += 0.09; // половина высоты куба — нижняя грань стоит на плоскости
  scene.add(cube);
  status.textContent = 'Куб размещён. Двигайтесь вокруг него или коснитесь экрана ещё раз.';
}

function render(_time, frame) {
  if (frame && hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitTestSource);
    const pose = hits.length ? hits[0].getPose(referenceSpace) : null;
    if (pose) {
      lastHitMatrix = Array.from(pose.transform.matrix);
      reticle.matrix.fromArray(lastHitMatrix);
      reticle.visible = true;
      reticle.matrixWorldNeedsUpdate = true;
    } else {
      lastHitMatrix = null;
      reticle.visible = false;
    }
  }
  renderer.render(scene, camera);
}

function onSessionEnd() {
  hitTestSource?.cancel();
  hitTestSource = null;
  lastHitMatrix = null;
  reticle.visible = false;
  session = null;
  startButton.hidden = false;
  startButton.disabled = false;
  endButton.hidden = true;
  status.textContent = 'AR завершён. Нажмите «Начать AR», чтобы попробовать снова.';
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
