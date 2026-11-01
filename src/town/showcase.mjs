import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await pathExists(path)) return readFile(path, 'utf8');
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chrome DevTools connection closed'));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error('Timed out connecting to Chrome')), 10000);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolveOpen();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        rejectOpen(new Error('Unable to connect to Chrome DevTools'));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, timeout = 30000) {
    const id = this.nextId++;
    return new Promise((resolveSend, rejectSend) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectSend(new Error(`DevTools command timed out: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    }
    return response.result.value;
  }

  async waitFor(expression, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await this.evaluate(`(() => { try { return Boolean(${expression}); } catch { return false; } })()`);
      if (value) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async assert(expression, message) {
    const value = await this.evaluate(expression);
    if (!value) throw new Error(message ?? `Browser assertion failed: ${expression}`);
  }

  async click(selector) {
    await this.waitFor(`document.querySelector(${JSON.stringify(selector)})`);
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing element: ${selector}');
      element.click();
      return true;
    })()`);
  }

  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  }

  close() {
    this.socket.close();
  }
}

const factionIds = [
  'haven', 'grove', 'ember', 'mire', 'tower', 'necropolis', 'dungeon',
  'stronghold', 'conflux', 'cove', 'factory', 'bulwark', 'courtyard',
];

async function activateEveryBuilding(client, faction, expectedIds, built) {
  const result = await client.evaluate(`(async () => {
    const { BUILDINGS } = await import('/src/game/content.ts');
    const ids = ${JSON.stringify(expectedIds)};
    window.__townShowcase.clearInteractions();
    const buttons = [...document.querySelectorAll('.h3-town-scene__building')];
    for (const button of buttons) button.click();
    return {
      actual: window.__townShowcase.interactions,
      expected: ids.map((buildingId) => {
        const interaction = { townId: ${JSON.stringify(faction)}, buildingId, built: ${built} };
        if (BUILDINGS[buildingId].creatureId) interaction.creatureId = BUILDINGS[buildingId].creatureId;
        return interaction;
      }),
    };
  })()`);
  assert.deepEqual(result.actual, result.expected, `${faction} emitted inaccurate ${built ? 'built' : 'unbuilt'} interactions`);
}

async function exerciseRaycast(client, faction, built) {
  await client.evaluate('window.__townShowcase.clearInteractions()');
  const rect = await client.evaluate(`(() => {
    const label = document.querySelector('.h3-town-scene__label[data-building-id="townHall"]');
    const bounds = label.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.bottom };
  })()`);
  for (const offset of [8, 22, 38, 58, 82]) {
    const x = rect.x;
    const y = rect.y + offset;
    await client.mouse('mouseMoved', x, y, { button: 'none' });
    await delay(70);
    const hovered = await client.evaluate("!document.querySelector('.h3-town-scene__tooltip').hidden && document.querySelector('.h3-town-scene canvas').style.cursor === 'pointer'");
    if (!hovered) continue;
    await client.mouse('mousePressed', x, y, { clickCount: 1 });
    await client.mouse('mouseReleased', x, y, { clickCount: 1 });
    await delay(70);
    const interactions = await client.evaluate('window.__townShowcase.interactions');
    if (interactions.length === 0) continue;
    assert.deepEqual(interactions, [{ townId: faction, buildingId: 'townHall', built }], 'Raycast did not activate Town Hall');
    return;
  }
  throw new Error(`Could not raycast ${built ? 'built' : 'unbuilt'} Town Hall in ${faction}`);
}

async function exerciseCameraAndResize(client, faction) {
  const labelTransform = "() => document.querySelector('.h3-town-scene__label[data-building-id=\\\"townHall\\\"]').style.transform";
  const beforeZoom = await client.evaluate(`(${labelTransform})()`);
  await client.click('[aria-label="Zoom in"]');
  await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const afterZoom = await client.evaluate(`(${labelTransform})()`);
  assert.notEqual(afterZoom, beforeZoom, 'Zoom did not change the projected town view');
  await client.click('[aria-label="Rotate right"]');
  await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const afterRotate = await client.evaluate(`(${labelTransform})()`);
  assert.notEqual(afterRotate, afterZoom, 'Rotation did not change the projected town view');
  await client.evaluate("document.querySelector('.h3-town-scene canvas').focus()");
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const afterPan = await client.evaluate(`(${labelTransform})()`);
  assert.notEqual(afterPan, afterRotate, 'Keyboard pan did not change the projected town view');
  await client.click('[aria-label="Reset town camera"]');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.querySelector('.h3-town-scene canvas').clientWidth === 390 && document.querySelector('.h3-town-scene canvas').width === 390");
  await client.assert(`(() => {
    const panel = document.querySelector('.h3-town-scene__buildings').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.h3-town-scene__building')].map((button) => button.getBoundingClientRect());
    return panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight &&
      buttons.length === 9 && buttons.every((rect) => rect.left >= 0 && rect.right <= innerWidth);
  })()`, `${faction} keyboard building list overflows the mobile viewport`);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.querySelector('.h3-town-scene canvas').clientWidth === 1280");
}

async function exerciseConstructionTimeline(client) {
  console.log('Town WebGL showcase: deterministic construction timeline');
  await client.evaluate("window.__townShowcase.setTown('haven', false)");
  const confirmed = await client.evaluate("window.__townShowcase.constructConfirmed('townHall')");
  assert.equal(confirmed.buildingId, 'townHall', 'Confirmed construction did not start the correct building timeline');
  assert.equal(confirmed.stageId, 'foundation');
  assert.equal(confirmed.playing, true, 'Confirmed construction did not autoplay');
  await client.waitFor("!document.querySelector('.h3-town-scene__construction-controls').hidden && document.querySelector('.h3-town-scene').dataset.constructionBuildingId === 'townHall'");

  const baseline = await client.evaluate(`(() => {
    const api = window.__townShowcase;
    api.pauseConstruction();
    api.cancelConstruction();
    return api.constructionSnapshot('townHall');
  })()`);
  assert.ok(baseline.length >= 8, 'Constructed Town Hall lost its original mesh components');
  const baselineGeometries = new Set(baseline.map((mesh) => mesh.geometryUuid));
  const started = await client.evaluate("window.__townShowcase.startConstruction('townHall', { autoplay: false, reducedMotion: false })");
  assert.equal(started.time, 0);
  assert.equal(started.playing, false);
  assert.equal(started.stageIndex, 0);
  const stages = await client.evaluate('window.__townShowcase.constructionStages()');
  assert.deepEqual(stages.map((stage) => stage.id), ['foundation', 'supports', 'walls', 'roof', 'fittings', 'details', 'surroundings', 'finishing']);

  for (const stage of stages) {
    const time = stage.start + stage.duration * 0.55;
    const status = await client.evaluate(`window.__townShowcase.scrubConstruction(${time})`);
    assert.equal(status.stageIndex, stage.index, `Scrubbing did not select ${stage.id}`);
    assert.equal(status.stageLabel, stage.label);
    assert.equal(status.component.stageIndex, stage.index, `${stage.id} highlight is not linked to its geometry`);
    const stageState = await client.evaluate(`(() => {
      const api = window.__townShowcase;
      const meshes = api.constructionSnapshot('townHall');
      const baseline = ${JSON.stringify(baseline)};
      const original = new Set(baseline.map((mesh) => mesh.geometryUuid));
      return {
        allOriginal: meshes.every((mesh) => original.has(mesh.geometryUuid)),
        currentVisible: meshes.some((mesh) => mesh.stage === ${JSON.stringify(stage.id)} && mesh.visible),
        moved: meshes.some((mesh) => {
          const base = baseline.find((candidate) => candidate.uuid === mesh.uuid);
          return base && mesh.position.some((value, index) => value !== base.position[index]);
        }),
      };
    })()`);
    assert.ok(stageState.allOriginal, `${stage.id} replaced original geometry`);
    assert.ok(stageState.currentVisible, `${stage.id} has no visible real component`);
    assert.ok(stageState.moved, `${stage.id} did not animate real component transforms`);
    assert.equal((await client.evaluate('window.__townShowcase.rendererStats()')).highlights, 1);
    await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await client.assert("document.querySelector('.h3-town-scene canvas').getContext('webgl2').getError() === 0", `${stage.id} produced a WebGL error`);
  }

  const duration = stages.at(-1).end;
  for (const target of [duration * 0.82, duration * 0.14, duration * 0.61, 0, duration * 0.33]) {
    const equal = await client.evaluate(`(() => {
      const api = window.__townShowcase;
      api.scrubConstruction(${duration} * 0.93);
      api.scrubConstruction(${duration} * 0.07);
      api.scrubConstruction(${target});
      const scrubbed = JSON.stringify(api.constructionSnapshot('townHall'));
      api.scrubConstruction(0);
      api.scrubConstruction(${target});
      return scrubbed === JSON.stringify(api.constructionSnapshot('townHall'));
    })()`);
    assert.ok(equal, `Forward/backward scrubbing was not deterministic at ${target}`);
  }

  const storeStable = await client.evaluate(`(() => {
    const api = window.__townShowcase;
    api.scrubConstruction(${duration} * 0.43);
    const beforeTime = api.constructionStatus().time;
    const before = JSON.stringify(api.constructionSnapshot('townHall'));
    api.reloadStore();
    return beforeTime === api.constructionStatus().time && before === JSON.stringify(api.constructionSnapshot('townHall'));
  })()`);
  assert.ok(storeStable, 'An unrelated store update disturbed timeline time or model sampling');

  for (const speed of [0.5, 1, 2, 4]) {
    const result = await client.evaluate(`(async () => {
      const api = window.__townShowcase;
      api.scrubConstruction(0.2);
      api.speedConstruction(${speed});
      api.playConstruction();
      const before = api.constructionStatus().time;
      const started = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 280));
      const after = api.pauseConstruction();
      return { elapsed: after.time - before, wall: (performance.now() - started) / 1000, speed: after.speed };
    })()`);
    assert.equal(result.speed, speed);
    assert.ok(result.elapsed > 0, `${speed}x playback did not advance`);
    assert.ok(Math.abs(result.elapsed / result.wall - speed) < 0.22, `${speed}x playback advanced at the wrong rate: ${JSON.stringify(result)}`);
  }

  await client.evaluate(`window.__townShowcase.scrubConstruction(${stages[2].start})`);
  assert.equal((await client.evaluate('window.__townShowcase.nextConstructionStage()')).stageIndex, 3);
  assert.equal((await client.evaluate('window.__townShowcase.previousConstructionStage()')).stageIndex, 2);
  await client.click('[aria-label="Play construction animation"]');
  await client.waitFor("document.querySelector('.h3-town-scene__construction-controls').dataset.playing === 'true'");
  await client.click('[aria-label="Pause construction animation"]');
  const pausedTime = await client.evaluate('window.__townShowcase.constructionStatus().time');
  await client.evaluate('new Promise((resolve) => setTimeout(resolve, 100))');
  assert.equal(await client.evaluate('window.__townShowcase.constructionStatus().time'), pausedTime, 'Pause did not freeze the timeline');
  await client.evaluate(`(() => {
    const range = document.querySelector('.h3-town-scene__construction-progress input');
    range.value = ${duration} * 0.66;
    range.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.ok(Math.abs((await client.evaluate('window.__townShowcase.constructionStatus()')).time - duration * 0.66) < 0.02, 'Draggable progress did not scrub the model');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.querySelector('.h3-town-scene canvas').clientWidth === 390");
  await client.assert(`(() => {
    const controls = document.querySelector('.h3-town-scene__construction-controls').getBoundingClientRect();
    return controls.left >= 0 && controls.right <= innerWidth && controls.top >= 0 && controls.bottom <= innerHeight;
  })()`, 'Construction controls overflow the mobile viewport');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.querySelector('.h3-town-scene canvas').clientWidth === 1280");

  const final = await client.evaluate('window.__townShowcase.finishConstruction()');
  assert.equal(final.completed, true);
  assert.equal(final.playing, false);
  const finalMeshes = await client.evaluate("window.__townShowcase.constructionSnapshot('townHall')");
  assert.deepEqual(finalMeshes, baseline, 'Final construction state differs from the original completed model');
  assert.ok(finalMeshes.every((mesh) => baselineGeometries.has(mesh.geometryUuid)), 'Final model geometry was replaced');

  const reduced = await client.evaluate("window.__townShowcase.startConstruction('townHall', { reducedMotion: true })");
  assert.equal(reduced.completed, true, 'Reduced motion did not finalize immediately');
  assert.equal(reduced.reducedMotion, true);
  assert.deepEqual(await client.evaluate("window.__townShowcase.constructionSnapshot('townHall')"), baseline);

  await client.evaluate('window.__townShowcase.cancelConstruction()');
  await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const resourcesBefore = await client.evaluate('window.__townShowcase.rendererStats()');
  for (let index = 0; index < 3; index += 1) {
    await client.evaluate("window.__townShowcase.startConstruction('townHall', { autoplay: false })");
    assert.equal((await client.evaluate('window.__townShowcase.rendererStats()')).highlights, 1);
    await client.evaluate('window.__townShowcase.cancelConstruction()');
  }
  await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const resourcesAfter = await client.evaluate('window.__townShowcase.rendererStats()');
  assert.equal(resourcesAfter.highlights, 0, 'Cancelled construction left a highlighter in the scene');
  assert.equal(resourcesAfter.geometries, resourcesBefore.geometries, 'Construction highlight geometries leaked');
  assert.equal(resourcesAfter.textures, resourcesBefore.textures, 'Construction leaked GPU textures');

  await client.evaluate("window.__townShowcase.setTown('haven', true)");
  await client.evaluate("window.__townShowcase.startConstruction('mageGuild', { reducedMotion: true })");
  const ambientBefore = await client.evaluate("window.__townShowcase.constructionSnapshot('mageGuild').find((mesh) => mesh.animation === 'float')");
  assert.ok(ambientBefore, 'Mage Guild ambient test mesh is missing');
  await client.evaluate('new Promise((resolve) => setTimeout(resolve, 180))');
  const ambientAfter = await client.evaluate("window.__townShowcase.constructionSnapshot('mageGuild').find((mesh) => mesh.animation === 'float')");
  assert.notDeepEqual(ambientAfter.position, ambientBefore.position, 'Completed construction froze the original ambient mesh animation');
  const restoredAmbient = await client.evaluate(`(() => {
    const api = window.__townShowcase;
    const stages = api.constructionStages();
    api.scrubConstruction(stages.at(-1).end);
    return api.constructionSnapshot('mageGuild').find((mesh) => mesh.animation === 'float');
  })()`);
  assert.deepEqual(restoredAmbient.position, ambientBefore.position, 'Explicitly scrubbing to the end did not restore the exact base transform');

  await client.evaluate("window.__townShowcase.startConstruction('townHall', { autoplay: false })");
  await client.evaluate('window.__townShowcase.clearTown()');
  assert.equal(await client.evaluate('window.__townShowcase.constructionStatus()'), null, 'Town exit did not cancel construction');
  await client.assert("document.querySelector('.h3-town-scene__construction-controls').hidden", 'Town exit left construction controls visible');
  console.log('Town WebGL construction passed: confirmed start, 8 stages, original meshes, scrubbing, speeds, controls, reduced motion, final equality, and cleanup.');
}

await access(chromePath);
const profile = await mkdtemp(resolve(projectRoot, '.town-showcase-'));
const chromeErrors = [];
let chrome;
let client;
let server;
try {
  server = await createServer({
    root: projectRoot,
    configFile: false,
    cacheDir: resolve(profile, 'vite-cache'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'town-scene-showcase',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__town-showcase', (_request, response) => {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end('<!doctype html><html><head><meta charset="utf-8"><title>Town scene showcase</title></head><body><script type="module" src="/src/town/showcase.ts"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite showcase server did not start');
  const applicationUrl = `http://127.0.0.1:${address.port}/__town-showcase`;
  chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1280,800',
    applicationUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', (chunk) => {
    chromeErrors.push(String(chunk));
    if (chromeErrors.length > 30) chromeErrors.shift();
  });
  const devTools = await waitForFile(resolve(profile, 'DevToolsActivePort'));
  const devToolsPort = devTools.split('\n')[0].trim();
  let page;
  const pageDeadline = Date.now() + 20000;
  while (!page && Date.now() < pageDeadline) {
    const targets = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`).then((result) => result.json());
    page = targets.find((target) => target.type === 'page' && target.url.startsWith(applicationUrl));
    if (!page) await delay(100);
  }
  if (!page) throw new Error('Chrome did not open the town showcase');
  client = await CdpClient.connect(page.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.readyState === 'complete' && window.__townShowcase && document.querySelector('.h3-town-scene canvas')");
  await client.assert('window.__townShowcase.subscriptionCount() === 1', 'TownScene did not subscribe exactly once');
  await client.assert(`(() => {
    const canvas = document.querySelector('.h3-town-scene canvas');
    const gl = canvas.getContext('webgl2');
    return gl && !gl.isContextLost();
  })()`, 'TownScene did not create a real WebGL2 context');

  const covered = new Set();
  for (const faction of factionIds) {
    for (const built of [false, true]) {
      const expectedIds = await client.evaluate(`window.__townShowcase.setTown(${JSON.stringify(faction)}, ${built})`);
      await client.waitFor(`(() => {
        const root = document.querySelector('.h3-town-scene');
        const buttons = [...document.querySelectorAll('.h3-town-scene__building')];
        const labels = [...document.querySelectorAll('.h3-town-scene__label')];
        return root.dataset.faction === ${JSON.stringify(faction)} && root.dataset.buildingCount === '9' &&
          document.querySelector('.h3-town-scene__tooltip').hidden && buttons.length === 9 && labels.length === 9 &&
          buttons.every((button) => button.dataset.built === ${JSON.stringify(String(built))});
      })()`);
      await client.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await client.assert(`(() => {
        const canvas = document.querySelector('.h3-town-scene canvas');
        const gl = canvas.getContext('webgl2');
        return gl && !gl.isContextLost() && gl.getError() === gl.NO_ERROR;
      })()`, `${faction} produced a WebGL error while rendering ${built ? 'built' : 'unbuilt'} models`);
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      assert.ok(screenshot.data.length > 10000, `${faction} ${built ? 'built' : 'unbuilt'} showcase appears blank`);
      if (faction === 'courtyard' && built && process.env.H3_TOWN_SCREENSHOT) {
        await writeFile(resolve(projectRoot, process.env.H3_TOWN_SCREENSHOT), Buffer.from(screenshot.data, 'base64'));
      }
      await activateEveryBuilding(client, faction, expectedIds, built);
      await exerciseRaycast(client, faction, built);
      for (const id of expectedIds) covered.add(`${id}:${built}`);
    }
    await exerciseCameraAndResize(client, faction);
    console.log(`Town WebGL showcase: ${faction} passed all nine built/unbuilt models and interactions`);
  }
  assert.equal(covered.size, 114, 'Not every building ID was covered in both construction states');
  await exerciseConstructionTimeline(client);
  await client.evaluate('window.__townShowcase.clearTown()');
  await client.assert("document.querySelector('.h3-town-scene').dataset.buildingCount === '0' && !document.querySelector('.h3-town-scene__label') && !document.querySelector('.h3-town-scene__building')", 'setTown(null) left building visuals or keyboard destinations behind');
  await client.assert('window.__townShowcase.subscriptionCount() === 1', 'setTown(null) should retain the single reusable store subscription');
  await client.evaluate('window.__townShowcase.setTown("haven", true)');
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.buildingCount === '9'");
  await client.evaluate("window.__townShowcase.startConstruction('townHall', { autoplay: false })");
  await client.evaluate('window.__townShowcase.dispose()');
  await client.assert("!document.querySelector('.h3-town-scene') && window.__townShowcase.subscriptionCount() === 0 && window.__townShowcase.constructionStatus() === null", 'Dispose left DOM, an active timeline, or store subscriptions behind');
  if (client.exceptions.length) throw new Error(`Browser exceptions:\n${client.exceptions.join('\n')}`);
  console.log('Town WebGL showcase passed: 13 factions, 57 building IDs in both states, 114 exact interaction variants, deterministic construction, raycasts, camera, resize, and cleanup.');
} catch (error) {
  if (chromeErrors.length) console.error(chromeErrors.join(''));
  throw error;
} finally {
  client?.close();
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((resolveExit) => chrome.once('exit', resolveExit));
    chrome.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  await server?.close();
  await rm(profile, { recursive: true, force: true });
}
