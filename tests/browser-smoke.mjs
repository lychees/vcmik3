import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

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

  async clickText(selector, text) {
    await this.evaluate(`(() => {
      const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((candidate) => !candidate.disabled && candidate.textContent.includes(${JSON.stringify(text)}));
      if (!element) throw new Error('Missing clickable ${selector} containing ${text}');
      element.click();
      return true;
    })()`);
  }

  async setValue(selector, value) {
    await this.evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error('Missing input: ${selector}');
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
  }

  async key(selector, key) {
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing keyboard target: ${selector}');
      element.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }));
      return true;
    })()`);
  }

  async clickMinimapTile(x, y) {
    await this.evaluate(`(() => {
      const canvas = document.querySelector('.h3-minimap');
      if (!canvas) throw new Error('Missing minimap');
      const serialized = localStorage.getItem('h3core.save.v1.slot-1');
      if (!serialized) throw new Error('Missing saved map dimensions');
      const { width, height } = JSON.parse(serialized).map;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: rect.left + (${x} + 0.5) / width * rect.width,
        clientY: rect.top + (${y} + 0.5) / height * rect.height,
      }));
      return true;
    })()`);
  }

  close() {
    this.socket.close();
  }
}

await access(chromePath);
await access(resolve(distRoot, 'index.html'));
const profile = await mkdtemp(resolve(projectRoot, '.browser-smoke-'));
const chromeErrors = [];
let chrome;
let client;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    let filePath = resolve(distRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(filePath)).isDirectory()) filePath = resolve(filePath, 'index.html');
    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

try {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static test server did not start');
  const applicationUrl = `http://127.0.0.1:${address.port}/`;
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
    '--window-size=1440,1000',
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
  if (!page) throw new Error('Chrome did not open the application');
  client = await CdpClient.connect(page.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');

  console.log('Browser smoke: onboarding and new campaign');
  await client.waitFor("document.readyState === 'complete' && document.querySelector('#h3-onboarding:not([hidden])')");
  await client.assert("document.title.includes('Aster Vale')", 'Production entry point is not Aster Vale');
  await client.assert("document.querySelectorAll('.h3-onboarding-roster li').length === 13", 'Onboarding does not show all 13 factions');
  await client.assert("document.querySelector('.h3-onboarding')?.textContent.includes('52 units') && document.querySelector('.h3-onboarding')?.textContent.includes('64 × 48')", 'Onboarding roster or enlarged-map counts are stale');
  await client.setValue('#h3-seed', 'browser-smoke');
  await client.click('[data-action="start-new"]');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-adventure canvas') && document.querySelector('.h3-ui')");
  await client.assert("document.querySelectorAll('.h3-adventure canvas').length === 1 && !document.querySelector('.h3b-root')", 'Adventure did not mount exactly once');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor("document.querySelector('.h3-adventure').getBoundingClientRect().width === innerWidth && document.querySelector('.h3-adventure canvas').width > 0");

  console.log('Browser smoke: 13-town atlas, responsive layout, and hero cycling');
  await client.click('[data-action="minimap-expand"]');
  await client.waitFor("document.querySelectorAll('[data-action=\"town-navigate\"]').length === 13");
  await client.assert(`(() => {
    const names = [...document.querySelectorAll('[data-action="town-navigate"]')].map((button) => button.textContent);
    return ['Aster Keep', 'Lunar Glade', 'Cinder Bastion', 'Sunken Fen', 'Astral Spire', 'Veil of Souls', 'Obsidian Depths', 'Thunder Bastion', 'Elemental Nexus', 'Tidehaven', 'Brasswork Bastion', 'Reedwall Refuge', 'Rose Court']
      .every((name) => names.some((text) => text.includes(name)));
  })()`, 'Town atlas does not list every faction town');
  await client.assert("document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns · 13 factions · 52 units')", 'Minimap roster summary is stale');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 390');
  await client.assert(`(() => {
    const rect = document.querySelector('.h3-minimap-panel').getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  })()`, 'Expanded town atlas overflows the mobile viewport');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 1280');
  await client.click('[data-action="minimap-expand"]');
  await client.click('[data-action="next-hero"]');
  await client.waitFor("document.querySelector('.h3-hero-panel')?.textContent.includes('Seraphine')");
  await client.click('[data-action="previous-hero"]');
  await client.waitFor("document.querySelector('.h3-hero-panel')?.textContent.includes('Aveline')");

  console.log('Browser smoke: hero movement and town construction/recruitment');
  await client.key('.h3-minimap', 'ArrowDown');
  await client.key('.h3-minimap', 'ArrowDown');
  await client.key('.h3-minimap', 'Enter');
  await client.waitFor("document.querySelector('.h3-town-screen')?.textContent.includes('Aster Keep')");
  await client.click('[data-town-tab="construction"]');
  await client.click('[data-building-id="archeryRange"]');
  await client.waitFor("document.querySelector('[data-building-id=\"archeryRange\"]')?.textContent.includes('Constructed')");
  await client.click('[data-town-tab="recruitment"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"archer\"]')");
  await client.setValue('[data-creature-card="archer"] [data-recruit-input]', '2');
  await client.click('[data-creature-card="archer"] [data-action="recruit-creature"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"archer\"] .h3-recruit-available strong')?.textContent.trim() === '7'");

  console.log('Browser smoke: save and turn advancement');
  await client.click('[data-action="town-exit"]');
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.click('[data-save="slot-1"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved')");
  await client.click('[data-action="end-turn"]');
  await client.waitFor("document.querySelector('.h3-calendar')?.textContent.includes('Day 2')");

  console.log('Browser smoke: tactical battle entry, auto combat, and result handoff');
  await client.clickMinimapTile(9, 24);
  await client.waitFor("document.querySelector('.h3b-root') && document.querySelector('[data-testid=\"adventure-layer\"]').hidden");
  await client.assert("document.querySelectorAll('.h3b-root').length === 1 && document.querySelector('.h3-ui').dataset.battleActive === 'true'", 'Battle handoff was not singular and exclusive');
  await client.click('.h3b-action[data-action="auto"]');
  await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 120000);
  await client.click('[data-action="complete"]');
  await client.waitFor("!document.querySelector('.h3b-root') && !document.querySelector('[data-testid=\"adventure-layer\"]').hidden && document.querySelector('.h3-ui').dataset.battleActive === 'false'");

  console.log('Browser smoke: load, restart, and autosave continuation');
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.click('[data-load="slot-1"]');
  await client.waitFor("document.querySelector('.h3-dialog')?.textContent.includes('Load saved campaign?')");
  await client.clickText('.h3-dialog-actions button', 'Load campaign');
  await client.waitFor("document.querySelector('.h3-calendar')?.textContent.includes('Day 1') && !document.querySelector('.h3b-root')");
  await client.click('[data-action="enter-town"]');
  await client.click('[data-town-tab="construction"]');
  await client.assert("document.querySelector('[data-building-id=\"archeryRange\"]')?.textContent.includes('Constructed')", 'Loaded save lost town construction');
  await client.click('[data-town-tab="recruitment"]');
  await client.assert("document.querySelector('[data-creature-card=\"archer\"] .h3-recruit-available strong')?.textContent.trim() === '7'", 'Loaded save lost recruitment state');
  await client.click('[data-action="town-exit"]');

  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.setValue('#h3-seed-input', 'browser-restart');
  await client.click('[data-new-game]');
  await client.waitFor("document.querySelector('.h3-dialog')?.textContent.includes('Begin a new campaign?')");
  await client.clickText('.h3-dialog-actions button', 'Begin new campaign');
  await client.waitFor("!document.querySelector('.h3-dialog[open]') && !document.querySelector('.h3b-root')");
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.assert("document.querySelector('#h3-seed-input')?.value === 'browser-restart'", 'Restart did not apply the requested seed');
  await client.click('[data-save="autosave"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved')");

  await client.send('Page.reload', { ignoreCache: true });
  await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])') && !document.querySelector('#h3-continue').hidden");
  await client.click('#h3-continue');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-adventure canvas')");
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.assert("document.querySelector('#h3-seed-input')?.value === 'browser-restart'", 'Autosave continuation restored the wrong campaign');
  await client.clickText('.h3-dialog-actions button', 'Return to adventure');

  console.log('Browser smoke: Tower construction, recruitment, transfer, and 13-town save/load');
  await client.evaluate(`(() => {
    const key = 'h3core.save.v1.autosave';
    const serialized = localStorage.getItem(key);
    if (!serialized) throw new Error('Missing autosave for Tower acceptance');
    const state = JSON.parse(serialized);
    if (Object.keys(state.towns).length !== 13) throw new Error('New campaign does not contain 13 towns');
    const town = state.towns.tower;
    const hero = state.heroes['hero-aveline'];
    if (!town || !hero) throw new Error('Missing Tower acceptance fixtures');
    town.ownerId = 'red';
    hero.position = { ...town.position };
    hero.movementPoints = hero.maxMovementPoints;
    hero.alive = true;
    state.activePlayerId = 'red';
    state.selectedHeroId = hero.id;
    localStorage.setItem(key, JSON.stringify(state));
    return town.position;
  })()`);
  await client.send('Page.reload', { ignoreCache: true });
  await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])') && !document.querySelector('#h3-continue').hidden");
  await client.click('#h3-continue');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-hero-panel')?.textContent.includes('Aveline')");
  await client.assert("document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns · 13 factions · 52 units')", 'Loaded campaign lost the enlarged roster');
  await client.click('.h3-command-bar [data-action="enter-town"]');
  await client.waitFor("document.querySelector('.h3-town-screen')?.textContent.includes('Astral Spire')");
  await client.assert("document.querySelector('.h3-town-screen')?.dataset.faction === 'Tower'", 'Tower town has the wrong faction presentation');
  await client.click('[data-town-tab="construction"]');
  await client.click('[data-building-id="gargoyleParapet"]');
  await client.waitFor("document.querySelector('[data-building-id=\"gargoyleParapet\"]')?.textContent.includes('Constructed')");
  await client.click('[data-town-tab="recruitment"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"stoneGargoyle\"]')");
  await client.setValue('[data-creature-card="stoneGargoyle"] [data-recruit-input]', '2');
  await client.click('[data-creature-card="stoneGargoyle"] [data-action="recruit-creature"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"stoneGargoyle\"] .h3-recruit-available strong')?.textContent.trim() === '7'");
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 390');
  await client.assert(`(() => {
    const screen = document.querySelector('.h3-town-screen').getBoundingClientRect();
    const card = document.querySelector('[data-creature-card="stoneGargoyle"]').getBoundingClientRect();
    return screen.left >= 0 && screen.right <= innerWidth && card.left >= 0 && card.right <= innerWidth;
  })()`, 'New-faction recruitment overflows the mobile town layout');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 1280');
  await client.click('[data-town-tab="army"]');
  await client.click('[data-creature-id="stoneGargoyle"][data-direction="toHero"][data-all="true"]');
  await client.waitFor("document.querySelector('.h3-transfer-columns > section:last-child')?.textContent.includes('Stone Gargoyle')");
  await client.click('[data-action="town-exit"]');
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.click('[data-save="slot-2"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved')");
  await client.click('.h3-command-bar [data-action="game-menu"]');
  await client.click('[data-load="slot-2"]');
  await client.waitFor("document.querySelector('.h3-dialog')?.textContent.includes('Load saved campaign?')");
  await client.clickText('.h3-dialog-actions button', 'Load campaign');
  await client.waitFor("!document.querySelector('.h3-dialog[open]') && document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns')");
  await client.click('[data-action="enter-town"]');
  await client.click('[data-town-tab="construction"]');
  await client.assert("document.querySelector('[data-building-id=\"gargoyleParapet\"]')?.textContent.includes('Constructed')", '13-town save lost Tower construction');
  await client.click('[data-town-tab="recruitment"]');
  await client.assert("document.querySelector('[data-creature-card=\"stoneGargoyle\"] .h3-recruit-available strong')?.textContent.trim() === '7'", '13-town save lost Tower recruitment');
  await client.click('[data-action="town-exit"]');
  await client.assert("document.querySelector('.h3-hero-panel')?.textContent.includes('Stone Gargoyle')", '13-town save lost the transferred new unit');

  console.log('Browser smoke: new-unit tactical battle');
  await client.clickMinimapTile(20, 10);
  await client.waitFor("document.querySelector('.h3b-root') && document.querySelector('[data-testid=\"adventure-layer\"]').hidden");
  await client.assert("document.querySelector('.h3b-initiative')?.textContent.includes('Gargoyle') && document.querySelector('.h3b-initiative')?.textContent.includes('Titan')", 'Tower battle is missing the recruited or defending new units');
  await client.click('.h3b-action[data-action="auto"]');
  try {
    await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 360000);
  } catch (error) {
    const diagnostics = await client.evaluate(`(() => ({
      round: document.querySelector('.h3b-round')?.textContent,
      active: document.querySelector('.h3b-active')?.textContent,
      hint: document.querySelector('.h3b-hint')?.textContent,
      auto: document.querySelector('[data-action="auto"]')?.getAttribute('aria-pressed'),
      log: [...document.querySelectorAll('.h3b-log-list li')].slice(-4).map((entry) => entry.textContent),
    }))()`);
    throw new Error(`${error instanceof Error ? error.message : error}; Tower battle diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  await client.click('[data-action="complete"]');
  await client.waitFor("!document.querySelector('.h3b-root') && !document.querySelector('[data-testid=\"adventure-layer\"]').hidden");

  if (process.env.H3_SCREENSHOT) {
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(projectRoot, process.env.H3_SCREENSHOT), Buffer.from(screenshot.data, 'base64'));
  }
  if (client.exceptions.length) throw new Error(`Browser exceptions:\n${client.exceptions.join('\n')}`);
  console.log('Browser smoke passed: 13-faction onboarding, 13-town atlas, mobile layouts, hero cycling, Haven and Tower construction/recruitment, 13-town save/load, and classic/new-unit battles.');
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
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profile, { recursive: true, force: true });
}
