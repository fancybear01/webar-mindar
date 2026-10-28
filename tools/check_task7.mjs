import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGestures } from '../unity-task7/Assets/WebGLTemplates/WebXRTask7/task7-input.mjs';
const packets = [];
const g = createGestures(packet => packets.push(packet));
const last = () => packets.at(-1);
const p = (px, py) => ({ x: px / 400, y: 1 - py / 800, px, py });
g.down(1, p(100, 200));
assert.equal(last().pressed, true);
g.move(1, p(160, 260));
assert.deepEqual([last().x, last().y], [.4, .675]);
g.down(2, p(260, 260));
assert.equal(last().scale, 1); // second finger does not jump scale
g.move(2, p(360, 260));
assert.equal(last().scale, 2);
assert.deepEqual([last().x, last().y], [.4, .675]); // first finger remains the ray
g.up(2);
assert.equal(last().pressed, true);
assert.equal(last().scale, 1);
g.up(1);
assert.equal(last().pressed, false);
assert.equal(last().visible, false);
g.down(1, p(50, 100));
g.down(2, p(150, 100));
g.up(1);
assert.equal(last().pressed, false);
g.move(2, p(200, 100));
assert.equal(last().pressed, false); // cannot jump onto remaining finger
g.down(3, p(100, 100));
assert.equal(last().pressed, false);
g.up(2); g.up(3);
g.down(4, p(100, 200));
assert.equal(last().pressed, true);
g.cancel();
assert.equal(last().pressed, false);
assert.equal(last().visible, false);
g.down(1, p(100, 100)); g.down(2, p(100, 100));
g.move(2, p(101, 100));
assert.equal(last().scale, 1); // coincident fingers cannot produce infinity
g.cancel();
g.move(9, p(100, 100), true);
assert.equal(last().visible, true);
assert.equal(last().pressed, false);

// Execute the real patched exporter function with a fake XR API, instead of
// merely matching strings. This verifies options, lifecycle and rejection recovery.
const source = readFileSync(new URL('../unity-task7/Packages/com.de-panther.webxr/Runtime/Plugins/WebGL/webxr.jspre', import.meta.url), 'utf8');
const start = source.indexOf('XRManager.prototype.onRequestARSession =');
const end = source.indexOf('XRManager.prototype.onRequestVRSession =', start);
assert.ok(start > 0 && end > start);
async function sessionTest({ overlay = true, reject = false } = {}) {
  let options, started = false, resumed = 0;
  const events = [], listeners = {};
  const session = { addEventListener(name, callback) { listeners[name] = callback; } };
  const overlayRoot = {};
  const context = { XRManager: function () {}, Module: { WebXR: {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { requestAnimationFrame(callback) { callback(); } },
    document: { getElementById() { return overlay ? overlayRoot : null; }, dispatchEvent(event) { events.push(event); } },
    navigator: { xr: { requestSession(mode, input) {
      assert.equal(mode, 'immersive-ar'); options = input;
      return reject ? Promise.reject(new Error('denied')) : Promise.resolve(session);
    } } }
  };
  vm.runInNewContext(source.slice(start, end), context);
  const settings = { ARRequiredReferenceSpace: ['local'], AROptionalFeatures: [] };
  const manager = new context.XRManager();
  Object.assign(manager, { isARSupported: true, gameModule: { WebXR: { Settings: settings } },
    BrowserObject: { pauseAsyncCallbacks() {}, resumeAsyncCallbacks() { resumed++; },
      mainLoop: { pause() {}, resume() { resumed++; } } },
    ctx: { clearColor() {}, clear() {}, COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2 },
    onSessionStarted() { started = true; } });
  manager.onRequestARSession();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(settings.ARRequiredReferenceSpace), ['local']);
  assert.deepEqual(Array.from(options.requiredFeatures), overlay ? ['local', 'dom-overlay'] : ['local']);
  assert.equal(options.domOverlay?.root, overlay ? overlayRoot : undefined);
  if (reject) {
    assert.equal(started, false); assert.equal(resumed, 2);
    assert.ok(events.some(event => event.type === 'task7-session-error'));
  } else {
    assert.equal(started, true);
    assert.equal(context.Module.WebXR.xrSession, session);
    assert.equal(events[0].detail.active, true);
    listeners.end();
    assert.equal(events.at(-1).detail.active, false);
  }
}
await sessionTest();
await sessionTest({ reject: true });
await sessionTest({ overlay: false });
console.log('PASS task 7: drag, pinch, touch transitions, cancellation, mouse hover, AR overlay options, start/end and rejection recovery.');
console.log('Unity C# compilation, WebGL runtime, controllers and real mobile AR: not tested here.');
