import * as THREE from './vendor/three-0.160.0.module.js';

const status = document.querySelector('#xr-status');
const startButton = document.querySelector('#start-ar');
const endButton = document.querySelector('#end-ar');
const placeButton = document.querySelector('#place-cube');
const overlay = document.querySelector('#xr-overlay');
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
// The WebGL canvas stays outside the DOM overlay and renders to the XR layer.
document.body.appendChild(renderer.domElement);

const cubeGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(0, 0.09, 0);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xf0ad39, metalness: 0.15, roughness: 0.48 });
const demoCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
demoCube.position.set(0, 0.02, -0.8);
scene.add(demoCube);
const previewCube = new THREE.Mesh(cubeGeometry, new THREE.MeshStandardMaterial({
  color: 0xf0ad39, transparent: true, opacity: 0.5, depthWrite: false,
  metalness: 0.1, roughness: 0.5
}));
previewCube.visible = false;
scene.add(previewCube);
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.11, 0.15, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let session = null;
let hitTestSource = null;
let lastHitMatrix = null;
let startupError = '';
let trackingState = 'idle';
let searchStarted = null;
let searchHintShown = false;
const placedCubes = new Set();

if (!window.isSecureContext) {
  status.textContent = 'Для AR откройте эту страницу через HTTPS.';
} else if (!navigator.xr) {
  status.textContent = 'Куб показан в 3D. Для AR нужен Chrome на Android с поддержкой ARCore.';
} else {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    startButton.disabled = !supported;
    status.textContent = supported
      ? 'Куб готов. Нажмите «Начать AR», затем найдите поверхность.'
      : 'Куб показан в 3D. AR недоступен: проверьте Сервисы Google Play для AR и совместимость телефона.';
  }).catch(() => { status.textContent = 'Не удалось проверить поддержку WebXR. 3D-просмотр доступен.'; });
}

// UI clicks must not also place a second cube through an XR select event.
overlay.addEventListener('beforexrselect', (event) => {
  if (event.target.closest('button, a')) event.preventDefault();
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  startupError = '';
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor', 'hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay }
    });
    session.addEventListener('end', onSessionEnd, { once: true });
    session.addEventListener('select', placeCube);
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Same hit-test setup as the official Three.js AR example.
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    demoCube.visible = false;
    document.body.classList.add('xr-active');
    startButton.hidden = true;
    endButton.hidden = false;
    placeButton.hidden = false;
    placeButton.disabled = true;
    trackingState = 'searching';
    searchStarted = null;
    searchHintShown = false;
    status.textContent = 'Ищем поверхность. Медленно двигайте телефон, направив камеру на пол или стол.';
  } catch (error) {
    startupError = `AR не запустился: ${error?.message || error}`;
    if (session) await session.end().catch(() => {});
    status.textContent = startupError;
    startButton.disabled = false;
  }
});

endButton.addEventListener('click', () => session?.end());
placeButton.addEventListener('click', placeCube);

function placeCube() {
  if (!session || !lastHitMatrix) {
    if (session) status.textContent = 'Сначала найдите поверхность: дождитесь зелёного кольца и полупрозрачного куба.';
    return;
  }
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  // World-space pose: the placed cube is never attached to the camera.
  new THREE.Matrix4().fromArray(lastHitMatrix).decompose(cube.position, cube.quaternion, cube.scale);
  scene.add(cube);
  placedCubes.add(cube);
  status.textContent = 'Куб размещён. Обойдите его: он остаётся на поверхности. Можно разместить ещё один.';
}

function render(time, frame) {
  if (!session) {
    demoCube.rotation.y = time * 0.0006;
    demoCube.rotation.x = 0.25;
  }
  if (frame && hitTestSource) {
    try {
    const hits = frame.getHitTestResults(hitTestSource);
    const pose = hits.length ? hits[0].getPose(renderer.xr.getReferenceSpace()) : null;
    if (pose) {
      lastHitMatrix = Array.from(pose.transform.matrix);
      reticle.matrix.fromArray(lastHitMatrix);
      reticle.matrixWorldNeedsUpdate = true;
      reticle.visible = true;
      reticle.matrix.decompose(previewCube.position, previewCube.quaternion, previewCube.scale);
      previewCube.visible = true;
      placeButton.disabled = false;
      searchStarted = null;
      searchHintShown = false;
      if (trackingState !== 'found') {
        status.textContent = 'Поверхность найдена! Нажмите «Разместить куб» или коснитесь свободной области экрана.';
        trackingState = 'found';
      }
    } else {
      lastHitMatrix = null;
      reticle.visible = false;
      previewCube.visible = false;
      placeButton.disabled = true;
      searchStarted ??= time;
      if (trackingState !== 'searching') {
        status.textContent = 'Поверхность потеряна. Снова наведите камеру на пол или стол.';
        trackingState = 'searching';
      }
      if (!searchHintShown && time - searchStarted > 8000) {
        status.textContent = 'Пока нет поверхности. Отойдите на 0,5–1,5 м, медленно двигайте телефон. Нужны свет и пол или стол с заметным рисунком; зеркало и однотонная поверхность распознаются хуже.';
        searchHintShown = true;
      }
    }
    } catch (error) {
      lastHitMatrix = null;
      reticle.visible = false;
      previewCube.visible = false;
      placeButton.disabled = true;
      status.textContent = `Ошибка поиска поверхности: ${error.name} — ${error.message}`;
    }
  }
  renderer.render(scene, camera);
}

function onSessionEnd() {
  hitTestSource?.cancel();
  hitTestSource = null;
  lastHitMatrix = null;
  reticle.visible = false;
  previewCube.visible = false;
  demoCube.visible = true;
  for (const cube of placedCubes) scene.remove(cube);
  placedCubes.clear();
  session = null;
  trackingState = 'idle';
  searchStarted = null;
  document.body.classList.remove('xr-active');
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  startButton.hidden = false;
  startButton.disabled = false;
  endButton.hidden = true;
  placeButton.hidden = true;
  placeButton.disabled = true;
  status.textContent = startupError || 'AR завершён. Нажмите «Начать AR», чтобы попробовать снова.';
}

renderer.setAnimationLoop(render);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
