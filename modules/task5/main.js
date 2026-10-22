import { SceneController } from './SceneController.js';

export let app;
try {
  app = new SceneController();
  await app.initialize();
} catch (error) {
  document.querySelector('#controls-status').textContent = `Не удалось запустить 3D-сцену: ${error.message}`;
  console.error(error);
}
