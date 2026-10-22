export class UIController {
  constructor() {
    this.overlay = document.querySelector('#controls-overlay');
    this.statusElement = document.querySelector('#controls-status');
    this.startButton = document.querySelector('#controls-start');
    this.placeButton = document.querySelector('#controls-place');
    this.endButton = document.querySelector('#controls-end');
    this.details = document.querySelector('#object-controls');
    this.overlay.addEventListener('beforexrselect', event => {
      if (event.target.closest('button, a, input, select, summary, label, details')) event.preventDefault();
    });
  }

  bind(object, placement) {
    this.startButton.addEventListener('click', () => placement.start());
    this.placeButton.addEventListener('click', () => placement.place());
    this.endButton.addEventListener('click', () => placement.end());
    document.querySelector('#object-model').addEventListener('change', async event => {
      const selector = event.target;
      selector.disabled = true;
      try {
        if (await object.setModel(selector.value)) this.status('Модель заменена. Положение, цвет и поворот сохранены.');
      } catch (error) {
        selector.value = object.modelName;
        this.status(`Не удалось загрузить модель: ${error.message}`);
      } finally { selector.disabled = false; }
    });
    document.querySelector('#object-color').addEventListener('input', event => object.applyMaterial({ color: event.target.value }));
    for (const property of ['metalness', 'roughness']) {
      document.querySelector(`#object-${property}`).addEventListener('input', event => {
        object.applyMaterial({ [property]: event.target.value });
        document.querySelector(`#${property}-value`).textContent = event.target.value;
      });
    }
    const displayRotation = () => { document.querySelector('#rotation-value').textContent = `${object.yaw}°`; };
    document.querySelector('#rotate-left').addEventListener('click', () => { object.rotate(-15); displayRotation(); });
    document.querySelector('#rotate-right').addEventListener('click', () => { object.rotate(15); displayRotation(); });
    document.querySelector('#rotate-reset').addEventListener('click', () => { object.resetRotation(); displayRotation(); });
  }

  status(text) { this.statusElement.textContent = text; }
  setSupported(value) { this.startButton.disabled = !value; }
  setTarget(found) { this.placeButton.disabled = !found; }

  setAR(active) {
    document.body.classList.toggle('ar-running', active);
    this.startButton.hidden = active;
    this.startButton.disabled = active;
    this.placeButton.hidden = !active;
    this.placeButton.disabled = true;
    this.endButton.hidden = !active;
    this.details.open = !active;
  }
}
