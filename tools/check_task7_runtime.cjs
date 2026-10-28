const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../unity-interactive');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/webar-mindar\/unity-interactive\//, '');
  const file = path.resolve(root, relative || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const options = { headless: true, args: ['--enable-unsafe-swiftshader'] };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [], runtimeErrors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/Exception|Could not create|does not exist/.test(message.text())) { runtimeErrors.push(message.text()); console.log('Runtime:', message.text()); }
    });
    const base = process.env.TASK7_BASE_URL || `http://127.0.0.1:${server.address().port}/webar-mindar/unity-interactive/`;
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.task7App && window.task7State, null, { timeout: 180000 });
    await page.evaluate(() => {
      window.qaPackets = [];
      const send = task7App.SendMessage.bind(task7App);
      task7App.SendMessage = (object, method, value) => {
        if (object === 'Task7Input' && method === 'Pointer') qaPackets.push(JSON.parse(value));
        return send(object, method, value);
      };
    });
    const state = () => page.evaluate(() => task7State);
    const command = value => page.evaluate(v => task7App.SendMessage('Task7Scene', v), value);
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type, points) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 2, radiusY: 2, force: 1 })) });
      await page.waitForTimeout(240);
      if (process.env.DEBUG_TOUCH) console.log(type, JSON.stringify(await page.evaluate(() => ({ state: task7State, packets: qaPackets.slice(-3) }))));
    };
    assert.equal((await state()).bridgeDevices, 2, 'Real bridge must create both InputSystem devices');
    assert.deepEqual(await page.evaluate(() => task7App.Module.WebXR.Settings.ARRequiredReferenceSpace), ['local']);
    await command('ResetObject'); await page.waitForTimeout(250);
    const initial = await state();
    await touch('touchStart', [[1, 195, 422]]);
    assert.equal((await state()).selected, true, 'Touch must select actual XRGrabInteractable');
    assert.notEqual((await state()).color, initial.color, 'Selection must change real material color');
    await touch('touchMove', [[1, 245, 452]]);
    const dragged = await state();
    assert(Math.abs(dragged.position.x - initial.position.x) > 0.02, 'Drag must change C# transform');
    await touch('touchEnd', []);
    assert.equal((await state()).selected, false);
    const pose = (await state()).position;
    await page.locator('#larger').click(); await page.waitForTimeout(250);
    assert((await state()).scale > 1.05);
    assert.deepEqual((await state()).position, pose, 'UI scale must not change position');
    await command('ResetObject'); await page.waitForTimeout(250);
    await touch('touchStart', [[1, 180, 422]]);
    await touch('touchStart', [[1, 180, 422], [2, 215, 422]]);
    await touch('touchMove', [[1, 180, 422], [2, 285, 422]]);
    assert((await state()).scale > 1.8, 'Browser pinch must scale actual Unity object');
    assert((await state()).scale <= 3.001);
    await touch('touchEnd', [[2, 285, 422]]);
    assert.equal((await state()).selected, true, 'Lifting the second finger retains drag');
    await touch('touchCancel', []);
    assert.equal((await state()).selected, false, 'Cancel releases XRI selection');
    await command('ResetObject'); await page.waitForTimeout(250);
    await touch('touchStart', [[1, 180, 422]]);
    await touch('touchStart', [[1, 180, 422], [2, 215, 422]]);
    await touch('touchEnd', [[1, 180, 422]]);
    assert.equal((await state()).selected, false, 'Lifting primary finger releases without jumping');
    await touch('touchEnd', []);
    const count = (await state()).selections;
    await touch('touchStart', [[1, 25, 300]]); await touch('touchEnd', []);
    assert.equal((await state()).selections, count, 'Background does not select cube');

    // Synthetic packets traverse the real bridge -> InputSystem -> XRI ray.
    const packet = async (trigger, x = 0, enabled = true, thumbstickY = 0) => {
      await page.evaluate(data => task7App.SendMessage('Task7Scene', 'BridgeDiagnostic', JSON.stringify(data)), {
        hand: 2, enabled, trigger, thumbstickY,
        rotation: { x: 0, y: 0, z: 0, w: 1 }, position: { x, y: 0, z: 0 }
      });
      await page.waitForTimeout(350);
    };
    await command('ResetObject'); await page.waitForTimeout(250);
    await packet(0); await packet(1);
    assert.equal((await state()).selected, true, 'Bridge trigger must select through XRRayInteractor');
    await packet(1, 0.08);
    assert((await state()).position.x > 0.03, 'Bridge pose must move grabbed object');
    await packet(1, 0.08, true, 0.8);
    assert((await state()).scale > 1.05, 'Controller thumbstick must scale object');
    await packet(0, 0.08); await packet(0, 0, false);
    assert.equal((await state()).selected, false);
    await command('ResetObject'); await page.waitForTimeout(250);

    assert.equal(await page.evaluate(() => document.getElementById('task7-overlay').contains(document.getElementById('unity-canvas'))), false);
    assert.equal(await page.evaluate(() => {
      const event = new Event('beforexrselect', { bubbles: true, cancelable: true });
      document.getElementById('larger').dispatchEvent(event); return event.defaultPrevented;
    }), true);
    await page.evaluate(() => {
      navigator.xr.requestSession = async (mode, options) => {
        window.qaAROptions = { mode, required: options.requiredFeatures, rootId: options.domOverlay.root.id };
        throw new DOMException('Test session denied', 'NotAllowedError');
      };
      xrManager.isARSupported = true;
      document.getElementById('enterar').disabled = false;
    });
    await page.locator('#enterar').click();
    await page.waitForFunction(() => document.getElementById('ar-status').textContent.includes('Test session denied'));
    assert.deepEqual(await page.evaluate(() => qaAROptions), { mode: 'immersive-ar', required: ['local', 'dom-overlay'], rootId: 'task7-overlay' });
    await command('ScaleUp'); await page.waitForTimeout(250);
    assert((await state()).scale > 1.05, 'Unity must recover after denied AR session');
    assert.deepEqual(errors, []); assert.deepEqual(runtimeErrors, []);
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, process.env.TASK7_BASE_URL ? 'published.png' : 'local.png') });
    }
    console.log('PASS real Unity WebGL: XRI drag, pinch, selection, material feedback, cancellation, both touch transitions, bridge controller ray and thumbstick, DOM overlay, AR request and denial recovery.');
    console.log('Real Android camera and physical controllers require a separate device test.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
