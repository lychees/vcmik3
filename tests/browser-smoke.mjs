import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const factionTownFixtures = [
  { id: 'haven', name: 'Aster Keep', buildings: ['militiaBarracks', 'archeryRange', 'griffinTower', 'joustingArena'], creatures: ['militia', 'archer', 'griffin', 'cavalier'] },
  { id: 'grove', name: 'Lunar Glade', buildings: ['spriteGlade', 'rangerLodge', 'unicornGrove', 'dragonCliffs'], creatures: ['sprite', 'ranger', 'unicorn', 'dragon'] },
  { id: 'ember', name: 'Cinder Bastion', buildings: ['impWarrens', 'hellhoundKennels', 'ifritSpire', 'pitFiendAbyss'], creatures: ['imp', 'hellhound', 'ifrit', 'pitFiend'] },
  { id: 'mire', name: 'Sunken Fen', buildings: ['lizardmanDen', 'gorgonPen', 'wyvernRoost', 'basiliskPit'], creatures: ['lizardman', 'gorgon', 'wyvern', 'basilisk'] },
  { id: 'tower', name: 'Astral Spire', buildings: ['gremlinWorkshop', 'gargoyleParapet', 'geniePavilion', 'titanCloudTemple'], creatures: ['gremlin', 'stoneGargoyle', 'genie', 'titan'] },
  { id: 'necropolis', name: 'Veil of Souls', buildings: ['skeletonCrypt', 'zombieGraveyard', 'vampireEstate', 'ghostDragonSepulcher'], creatures: ['skeleton', 'zombie', 'vampire', 'ghostDragon'] },
  { id: 'dungeon', name: 'Obsidian Depths', buildings: ['troglodyteWarrens', 'harpyRoost', 'minotaurLabyrinth', 'redDragonCavern'], creatures: ['troglodyte', 'harpy', 'minotaur', 'redDragon'] },
  { id: 'stronghold', name: 'Thunder Bastion', buildings: ['goblinBarracks', 'wolfPen', 'ogreFort', 'behemothCliffs'], creatures: ['goblin', 'wolfRider', 'ogre', 'behemoth'] },
  { id: 'conflux', name: 'Elemental Nexus', buildings: ['pixieGarden', 'airElementalAltar', 'stormElementalSpire', 'phoenixPyre'], creatures: ['pixie', 'airElemental', 'stormElemental', 'phoenix'] },
  { id: 'cove', name: 'Tidehaven', buildings: ['nymphGrotto', 'corsairTavern', 'seaWitchTower', 'seaSerpentCove'], creatures: ['nymph', 'corsair', 'seaWitch', 'seaSerpent'] },
  { id: 'factory', name: 'Brasswork Bastion', buildings: ['halflingHovels', 'automatonAssembly', 'dreadnoughtFoundry', 'juggernautHangar'], creatures: ['halfling', 'automaton', 'dreadnought', 'juggernaut'] },
  { id: 'bulwark', name: 'Reedwall Refuge', buildings: ['banditHideout', 'hornetNest', 'shamanLodge', 'alligatorPit'], creatures: ['bandit', 'hornet', 'shaman', 'alligator'] },
  { id: 'courtyard', name: 'Rose Court', buildings: ['pageBarracks', 'duelistSalon', 'courtWizardLibrary', 'royalLionGarden'], creatures: ['page', 'duelist', 'courtWizard', 'royalLion'] },
];

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

  send(method, params = {}, timeout = 900000) {
    const id = this.nextId++;
    return new Promise((resolveSend, rejectSend) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const expression = typeof params.expression === 'string' ? `: ${params.expression.slice(0, 300)}` : '';
        rejectSend(new Error(`DevTools command timed out: ${method}${expression}`));
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

  async waitFor(expression, timeout = 60000) {
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

  async key(selector, key, modifiers = {}) {
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing keyboard target: ${selector}');
      element.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, ...${JSON.stringify(modifiers)} }));
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

  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  }

  async constructBuilding(buildingId) {
    await this.click(`[data-building-card="${buildingId}"] [data-action="construct-building"]`);
    await this.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('One project per day')");
    await this.assert(`document.querySelector('.h3-town-scene__building[data-building-id="${buildingId}"]').dataset.built === 'false'`, 'Construction happened before confirmation');
    await this.clickText('.h3-dialog-actions button', 'Construct building');
    await this.waitFor(`document.querySelector('[data-building-card="${buildingId}"] .h3-status-badge')?.textContent === 'Built'`);
  }

  close() {
    this.socket.close();
  }
}

function assertWild(condition, message) {
  if (!condition) throw new Error(message);
}

async function installWildFixture(client, objectId, options = {}) {
  const fixture = await client.evaluate(`(() => {
    const key = 'h3core.save.v1.autosave';
    const serialized = localStorage.getItem(key);
    if (!serialized) throw new Error('Missing autosave for wild integration');
    const state = JSON.parse(serialized);
    const object = state.map.objects[${JSON.stringify(objectId)}];
    const options = ${JSON.stringify(options)};
    const hero = state.heroes['hero-aveline'];
    if (!object || !hero) throw new Error('Missing wild integration fixture: ' + ${JSON.stringify(objectId)});
    for (const candidate of Object.values(state.heroes)) candidate.alive = candidate.id === hero.id;
    hero.alive = true;
    hero.position = { ...object.position };
    hero.movementPoints = hero.maxMovementPoints;
    hero.mana = hero.maxMana;
    if (object.kind === 'monster') {
      hero.army = [
        { creatureId: 'royalLion', count: 50 },
        { creatureId: 'titan', count: 30 },
        { creatureId: 'phoenix', count: 30 },
      ];
    }
    if (options.clearSpells) hero.spells = [];
    if (options.zeroMovement) hero.movementPoints = 0;
    if (options.zeroMana) hero.mana = 0;
    if (options.merchant) Object.assign(state.players.red.resources, { gold: 500, wood: 10, ore: 20 });
    if (object.kind === 'landmark') {
      delete object.visits[hero.id];
      const linked = object.linkedObjectId ? state.map.objects[object.linkedObjectId] : null;
      if (linked) delete linked.visits[hero.id];
    }
    state.activePlayerId = 'red';
    state.selectedHeroId = hero.id;
    state.pendingBattle = null;
    state.phase = 'playing';
    state.winnerId = null;
    const fog = [];
    for (let y = Math.max(0, object.position.y - 5); y <= Math.min(state.map.height - 1, object.position.y + 5); y += 1) {
      for (let x = Math.max(0, object.position.x - 5); x <= Math.min(state.map.width - 1, object.position.x + 5); x += 1) {
        if (Math.hypot(object.position.x - x, object.position.y - y) <= 5) fog.push(y * state.map.width + x);
      }
    }
    state.fog.red = { visible: [...fog], explored: [...fog] };
    localStorage.setItem(key, JSON.stringify(state));
    return {
      attack: hero.primarySkills.attack,
      defense: hero.primarySkills.defense,
      experience: hero.experience,
      maxMana: hero.maxMana,
      maxMovementPoints: hero.maxMovementPoints,
      gold: state.players.red.resources.gold,
      wood: state.players.red.resources.wood,
      ore: state.players.red.resources.ore,
      exploredCount: fog.length,
      linkedPosition: object.linkedObjectId ? { ...state.map.objects[object.linkedObjectId].position } : null,
    };
  })()`);
  await client.send('Page.reload', { ignoreCache: true });
  await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])') && !document.querySelector('#h3-continue').hidden");
  await client.click('#h3-continue');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-adventure canvas')");
  await client.click('.h3-adventure__toolbar [aria-label="Focus selected hero"]');
  await client.click('.h3-adventure__toolbar [aria-label="Zoom in"]');
  await client.click('.h3-adventure__toolbar [aria-label="Zoom in"]');
  await delay(100);
  return fixture;
}

async function findAdventureObject(client, name) {
  const center = await client.evaluate(`(() => {
    const canvas = document.querySelector('.h3-adventure canvas');
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  for (const yOffset of [-100, -70, -40, -10, 20, 50, 80]) {
    for (const xOffset of [-90, -60, -30, 0, 30, 60, 90]) {
      const x = center.x + xOffset;
      const y = center.y + yOffset;
      await client.mouse('mouseMoved', x, y, { button: 'none' });
      await delay(35);
      const found = await client.evaluate(`(() => {
        const tooltip = document.querySelector('.h3-adventure__tooltip');
        return !tooltip.hidden && tooltip.textContent.includes(${JSON.stringify(name)});
      })()`);
      if (found) return { x, y };
    }
  }
  return null;
}

async function saveWildCampaign(client) {
  for (let index = 0; index < 4; index += 1) {
    if (await client.evaluate("Boolean(document.querySelector('.h3-victory-dialog[open], .h3-defeat-dialog[open]'))")) {
      await client.clickText('.h3-dialog-actions button', 'Load campaign');
      break;
    }
    if (!await client.evaluate("Boolean(document.querySelector('.h3-dialog[open]'))")) break;
    await client.evaluate("document.querySelector('.h3-dialog[open] .h3-dialog-actions button')?.click()");
    await delay(80);
  }
  if (!await client.evaluate("Boolean(document.querySelector('.h3-dialog[open] [data-save=\"autosave\"]'))")) {
    await client.click('.h3-command-bar [data-action="game-menu"]');
  }
  await client.click('[data-save="autosave"]');
  await client.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('Overwrite saved campaign?') || document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved')");
  if (await client.evaluate("document.querySelector('.h3-dialog[open]')?.textContent.includes('Overwrite saved campaign?')")) {
    await client.clickText('.h3-dialog-actions button', 'Overwrite save');
  }
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved')");
}

async function readWildState(client) {
  return client.evaluate(`JSON.parse(localStorage.getItem('h3core.save.v1.autosave'))`);
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
    if (pathname === '/') {
      response.writeHead(302, { Location: '/vcmik3/' }).end();
      return;
    }
    if (!pathname.startsWith('/vcmik3/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const relativePath = pathname.slice('/vcmik3/'.length) || 'index.html';
    let filePath = resolve(distRoot, relativePath);
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
  const applicationUrl = `http://127.0.0.1:${address.port}/vcmik3/`;
  chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    `--use-angle=${process.env.H3_CHROME_ANGLE ?? 'swiftshader'}`,
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
  await client.assert("document.title.includes('Aster Vale') && location.pathname === '/vcmik3/'", 'Production H3 entry or /vcmik3/ base path is incorrect');
  await client.assert("document.querySelectorAll('.h3-onboarding-roster li').length === 13", 'Onboarding does not show all 13 factions');
  await client.assert("document.querySelector('.h3-onboarding')?.textContent.includes('72 units') && document.querySelector('.h3-onboarding')?.textContent.includes('64 × 48')", 'Onboarding roster or enlarged-map counts are stale');
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
  await client.assert("document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns · 13 factions · 72 units')", 'Minimap roster summary is stale');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor(`(() => {
    const rect = document.querySelector('.h3-minimap-panel').getBoundingClientRect();
    return innerWidth === 390 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  })()`);
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

  console.log('Browser smoke: WebGL town picking, construction confirmation, model updates, and recruitment');
  await client.key('.h3-minimap', 'ArrowDown');
  await client.key('.h3-minimap', 'ArrowDown');
  await client.key('.h3-minimap', 'Enter');
  await client.waitFor("document.querySelector('.h3-town-screen')?.textContent.includes('Aster Keep') && document.querySelector('.h3-town-scene')?.dataset.buildingCount === '9'");
  await client.assert(`(() => {
    const canvas = document.querySelector('.h3-town-scene canvas');
    window.__townSmokeCanvas = canvas;
    return canvas.getContext('webgl2') !== null;
  })()`, 'Integrated town did not create a real WebGL2 context');
  const townHallPoint = await client.evaluate(`(() => {
    const label = document.querySelector('.h3-town-scene__label[data-building-id="townHall"]');
    const bounds = label.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.bottom };
  })()`);
  let townHallActivated = false;
  for (const offset of [8, 22, 38, 58, 82]) {
    const x = townHallPoint.x;
    const y = townHallPoint.y + offset;
    await client.mouse('mouseMoved', x, y, { button: 'none' });
    await delay(70);
    if (!await client.evaluate("!document.querySelector('.h3-town-scene__tooltip').hidden")) continue;
    await client.mouse('mousePressed', x, y, { clickCount: 1 });
    await client.mouse('mouseReleased', x, y, { clickCount: 1 });
    try {
      await client.waitFor("document.querySelector('[data-overview-building=\"townHall\"]')?.classList.contains('is-focused')", 1000);
      townHallActivated = true;
      break;
    } catch { }
  }
  if (!townHallActivated) throw new Error('Could not activate the integrated Town Hall through WebGL raycasting');
  await client.click('.h3-town-scene__building[data-building-id="archeryRange"]');
  await client.waitFor("document.querySelector('[data-building-card=\"archeryRange\"]')?.classList.contains('is-focused')");
  await client.assert("document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'false' && !document.querySelector('.h3-dialog[open]')", 'Unbuilt model click bypassed construction');
  await client.assert("document.querySelector('.h3-town-scene canvas') === window.__townSmokeCanvas", 'Tab routing recreated the town WebGL canvas');
  await client.evaluate(`(() => {
    const root = document.querySelector('.h3-town-scene');
    window.__constructionStarts = [];
    window.__constructionObserver = new MutationObserver(() => {
      if (root.dataset.constructionBuildingId) window.__constructionStarts.push(root.dataset.constructionBuildingId);
    });
    window.__constructionObserver.observe(root, { attributes: true, attributeFilter: ['data-construction-building-id'] });
  })()`);
  await client.click('[data-building-card="archeryRange"] [data-action="construct-building"]');
  await client.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('One project per day')");
  await client.clickText('.h3-dialog-actions button', 'Cancel');
  await client.waitFor("!document.querySelector('.h3-dialog[open]')");
  await delay(80);
  await client.assert("window.__constructionStarts.length === 0 && !document.querySelector('.h3-town-scene').dataset.constructionBuildingId && document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'false'", 'Cancelled confirmation started construction or its animation');
  await client.constructBuilding('archeryRange');
  await client.waitFor("document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'true'");
  await client.waitFor("window.__constructionStarts.length === 1 && !document.querySelector('.h3-town-scene__construction-controls').hidden");
  await client.assert("window.__constructionStarts[0] === 'archeryRange' && document.querySelectorAll('.h3-town-scene__construction-controls').length === 1", 'Confirmed construction did not start exactly one matching timeline');
  await client.assert("document.querySelector('.h3-town-scene canvas') === window.__townSmokeCanvas", 'Construction recreated rather than updated the town scene');
  await client.clickText('.h3-dialog-actions button', 'Construct building');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Construction unavailable')");
  await delay(80);
  await client.assert("window.__constructionStarts.length === 1", 'Failed duplicate construction restarted the timeline');
  await client.click('.h3-town-scene__building[data-building-id="mageGuild"]');
  await client.waitFor("document.querySelector('[data-building-card=\"mageGuild\"]')?.classList.contains('is-focused')");
  await client.assert("document.querySelector('[data-building-card=\"mageGuild\"] [data-action=\"construct-building\"]').disabled && !document.querySelector('.h3-dialog[open]')", 'Another building bypassed construction rules during playback');
  await client.click('.h3-town-scene__building[data-building-id="archeryRange"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"archer\"]')?.classList.contains('is-focused')");
  await client.setValue('[data-creature-card="archer"] [data-recruit-input]', '2');
  await client.click('[data-creature-card="archer"] [data-action="recruit-creature"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"archer\"] .h3-recruit-available strong')?.textContent.trim() === '7'");
  await client.assert("document.querySelector('.h3-town-scene canvas') === window.__townSmokeCanvas && !document.querySelector('.h3-town-scene__construction-controls').hidden", 'Recruitment replaced the canvas or active timeline');
  await client.click('.h3-town-scene__building[data-building-id="fort"]');
  await client.waitFor("document.querySelector('.h3-army-management') && document.querySelector('[data-town-tab=\"army\"]').getAttribute('aria-pressed') === 'true'");
  await client.assert("document.querySelector('.h3-town-scene canvas') === window.__townSmokeCanvas", 'Army routing recreated the town scene');

  console.log('Browser smoke: construction scrubbing, stage controls, accessibility, reduced motion, and exit lifecycle');
  await client.evaluate(`(() => {
    const play = document.querySelector('[aria-label="Pause construction animation"]');
    if (play) play.click();
  })()`);
  const constructionRange = '.h3-town-scene__construction-progress input';
  await client.setValue(constructionRange, '2.4');
  await client.waitFor("Math.abs(Number(document.querySelector('.h3-town-scene').dataset.constructionTime) - 2.4) < 0.02 && document.querySelector('.h3-town-scene').dataset.constructionPlaying === 'false'");
  await client.assert("document.querySelector('.h3-town-scene__construction-controls [aria-valuetext]').getAttribute('aria-valuetext').includes('2.4 of')", 'Construction slider has no accessible time and stage value');
  await client.evaluate(`document.querySelector(${JSON.stringify(constructionRange)}).focus()`);
  for (const [key, code, virtualKey] of [['Home', 'Home', 36], ['ArrowRight', 'ArrowRight', 39], ['End', 'End', 35]]) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
    if (key === 'Home') await client.waitFor("Number(document.querySelector('.h3-town-scene__construction-progress input').value) === 0 && document.querySelector('.h3-town-scene').dataset.constructionStage === 'foundation'");
    if (key === 'ArrowRight') await client.waitFor("Number(document.querySelector('.h3-town-scene__construction-progress input').value) > 0");
    if (key === 'End') await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionStage === 'finishing' && document.querySelector('.h3-town-scene').dataset.constructionPlaying === 'false' && document.querySelector('.h3-town-scene__construction-controls').dataset.completed === 'true' && document.querySelector('[aria-label=\"Replay construction animation\"]')");
  }
  await client.click('[aria-label="Previous construction stage"]');
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionStage === 'surroundings'");
  await client.click('[aria-label="Next construction stage"]');
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionStage === 'finishing'");
  await client.click('[aria-label="Play construction at 2 times speed"]');
  await client.assert("document.querySelector('.h3-town-scene').dataset.constructionSpeed === '2' && document.querySelector('[aria-label=\"Play construction at 2 times speed\"]').getAttribute('aria-pressed') === 'true'", 'Construction speed control did not update playback state');
  await client.key('.h3-town-scene canvas', 'F1');
  await client.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('Construction playback') && document.querySelector('.h3-dialog[open]')?.textContent.includes('Reduced-motion')");
  await client.clickText('.h3-dialog-actions button', 'Ready for adventure');
  await client.setValue(constructionRange, '2.4');
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await client.waitFor("document.querySelector('.h3-town-scene__construction-controls').dataset.reducedMotion === 'true' && document.querySelector('.h3-town-scene').dataset.constructionStage === 'finishing' && document.querySelector('.h3-town-scene').dataset.constructionPlaying === 'false' && document.querySelector('.h3-town-scene__construction-controls').dataset.completed === 'true' && document.querySelector('[aria-label=\"Replay construction animation\"]')");
  await client.assert("document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'true' && document.querySelector('.h3-town-scene__construction-component').textContent.includes('All components in place')", 'Reduced motion did not preserve the completed building model state');
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await client.waitFor("document.querySelector('.h3-town-scene__construction-controls').dataset.reducedMotion === 'false'");
  await client.click('[aria-label="Replay construction animation"]');
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionPlaying === 'true'");
  await client.click('[data-action="town-exit"]');
  await client.waitFor("!document.querySelector('.h3-town-scene')");
  await client.click('[data-action="enter-town"]');
  await client.waitFor("document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'true'");
  await client.assert("document.querySelector('.h3-town-scene__construction-controls').hidden && window.__constructionStarts.length === 1", 'Leaving and reopening town replayed or retained the old timeline');
  await client.evaluate("window.__townSmokeCanvas = document.querySelector('.h3-town-scene canvas')");

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
  await client.assert("document.querySelector('[data-building-card=\"archeryRange\"] .h3-status-badge')?.textContent === 'Built' && document.querySelector('.h3-town-scene__building[data-building-id=\"archeryRange\"]').dataset.built === 'true' && document.querySelector('.h3-town-scene__construction-controls').hidden && window.__constructionStarts.length === 1", 'Loaded save lost construction state or replayed its old timeline');
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
    if (!town.buildings.includes('mageGuild')) town.buildings.push('mageGuild');
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
  await client.assert("document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns · 13 factions · 72 units')", 'Loaded campaign lost the enlarged roster');
  await client.click('.h3-command-bar [data-action="enter-town"]');
  await client.waitFor("document.querySelector('.h3-town-screen')?.textContent.includes('Astral Spire') && document.querySelector('.h3-town-scene')?.dataset.buildingCount === '9'");
  await client.assert("document.querySelector('.h3-town-screen')?.dataset.faction === 'Tower'", 'Tower town has the wrong faction presentation');
  await client.click('.h3-town-scene__building[data-building-id="mageGuild"]');
  await client.waitFor("document.querySelector('[data-spellbook=\"ready\"]') && document.querySelector('[data-spell-id=\"magicArrow\"]') && document.querySelector('[data-spell-id=\"haste\"]')");
  await client.assert("document.querySelector('.h3-spellbook-hero')?.textContent.includes('Aveline')", 'Mage Guild did not open the visiting hero spellbook');
  await client.click('.h3-town-scene__building[data-building-id="gargoyleParapet"]');
  await client.waitFor("document.querySelector('[data-building-card=\"gargoyleParapet\"]')?.classList.contains('is-focused')");
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await client.waitFor("matchMedia('(prefers-reduced-motion: reduce)').matches");
  await client.evaluate("window.__towerConstructionCanvas = document.querySelector('.h3-town-scene canvas')");
  await client.constructBuilding('gargoyleParapet');
  await client.waitFor("document.querySelector('.h3-town-scene__building[data-building-id=\"gargoyleParapet\"]').dataset.built === 'true' && document.querySelector('.h3-town-scene__construction-controls').dataset.reducedMotion === 'true' && document.querySelector('.h3-town-scene__construction-controls').dataset.completed === 'true' && document.querySelector('[aria-label=\"Replay construction animation\"]') && document.querySelector('.h3-town-scene__construction-component').textContent === 'All components in place'");
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await client.waitFor("!matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('.h3-town-scene__construction-controls').dataset.reducedMotion === 'false'");
  await client.assert("document.querySelector('.h3-town-scene__construction-progress input').step === '0.001'", 'Integrated construction slider cannot represent exact timeline durations');
  await client.setValue(constructionRange, '2.4');
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionTime === '2.400' && document.querySelector('.h3-town-scene__construction-controls').dataset.completed === 'false'");
  await client.evaluate(`document.querySelector(${JSON.stringify(constructionRange)}).focus()`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await client.waitFor(`(() => {
    const root = document.querySelector('.h3-town-scene');
    const controls = document.querySelector('.h3-town-scene__construction-controls');
    const component = document.querySelector('.h3-town-scene__construction-component');
    return controls.dataset.completed === 'true' && root.dataset.constructionPlaying === 'false' &&
      document.querySelector('[aria-label="Replay construction animation"]') && component.textContent === 'All components in place' && component.title === '' &&
      document.querySelector('.h3-town-scene__status').textContent === 'Gargoyle Parapet construction animation complete.' &&
      document.querySelector('.h3-town-scene__building[data-building-id="gargoyleParapet"]').dataset.built === 'true' &&
      root.querySelector('canvas') === window.__towerConstructionCanvas;
  })()`);
  await client.click('.h3-town-scene__building[data-building-id="gargoyleParapet"]');
  await client.waitFor("document.querySelector('[data-creature-card=\"stoneGargoyle\"]')?.classList.contains('is-focused')");
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
  await client.assert(`(() => {
    const root = document.querySelector('.h3-town-scene');
    const scene = root.getBoundingClientRect();
    const panel = root.querySelector('.h3-town-scene__construction-controls');
    const controls = panel.getBoundingClientRect();
    const interactive = [...panel.querySelectorAll('button, input')].map((element) => element.getBoundingClientRect());
    return !panel.hidden && controls.left >= scene.left && controls.right <= scene.right && controls.top >= scene.top && controls.bottom <= scene.bottom &&
      controls.left >= 0 && controls.right <= innerWidth && interactive.every((rect) => rect.width > 0 && rect.height > 0 && rect.left >= controls.left && rect.right <= controls.right) &&
      document.documentElement.scrollWidth <= innerWidth;
  })()`, 'Construction playback controls overflow the mobile town scene');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 1280');
  await client.click('[data-town-tab="army"]');
  await client.click('[data-creature-id="stoneGargoyle"][data-direction="toHero"][data-all="true"]');
  await client.waitFor("document.querySelector('.h3-transfer-columns > section:last-child')?.textContent.includes('Stone Gargoyle')");
  await client.key('.h3-town-scene canvas', 'o', { ctrlKey: true });
  await client.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('Campaign journal')");
  await client.click('[data-save="slot-2"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Campaign saved') && document.querySelector('.h3-town-scene')");
  await client.setValue(constructionRange, '2.4');
  await client.evaluate("document.querySelector('[aria-label=\"Play construction animation\"]')?.click()");
  await client.waitFor("document.querySelector('.h3-town-scene').dataset.constructionPlaying === 'true'");
  await client.key('.h3-town-scene canvas', 'o', { ctrlKey: true });
  await client.waitFor("document.querySelector('.h3-dialog[open]')?.textContent.includes('Campaign journal')");
  await client.click('[data-load="slot-2"]');
  await client.waitFor("document.querySelector('.h3-dialog')?.textContent.includes('Load saved campaign?')");
  await client.clickText('.h3-dialog-actions button', 'Load campaign');
  await client.waitFor("!document.querySelector('.h3-dialog[open]') && !document.querySelector('.h3-town-scene') && document.querySelector('.h3-minimap-summary')?.textContent.includes('13 towns')");
  await client.click('[data-action="enter-town"]');
  await client.click('[data-town-tab="construction"]');
  await client.assert("document.querySelector('[data-building-card=\"gargoyleParapet\"] .h3-status-badge')?.textContent === 'Built' && document.querySelector('.h3-town-scene__building[data-building-id=\"gargoyleParapet\"]').dataset.built === 'true' && document.querySelector('.h3-town-scene__construction-controls').hidden", 'Loading during playback lost the building or restarted its completed timeline');
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
    await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 900000);
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

  console.log('Browser smoke: every faction pack, building interaction, recruitment, and desktop/mobile WebGL layout');
  for (const faction of factionTownFixtures) {
    await client.evaluate(`(() => {
      const fixture = ${JSON.stringify(faction)};
      const key = 'h3core.save.v1.autosave';
      const state = JSON.parse(localStorage.getItem(key));
      const town = state.towns[fixture.id];
      const hero = state.heroes['hero-aveline'];
      if (!town || !hero) throw new Error('Missing faction acceptance fixture: ' + fixture.id);
      town.ownerId = 'red';
      town.buildings = ['townHall', 'capitol', 'market', 'fort', 'mageGuild', ...fixture.buildings];
      town.dwellingPools = Object.fromEntries(fixture.creatures.map((id) => [id, 10]));
      town.garrison = [{ creatureId: fixture.creatures[0], count: 12 }];
      town.builtToday = false;
      hero.position = { ...town.position };
      hero.movementPoints = hero.maxMovementPoints;
      hero.alive = true;
      state.activePlayerId = 'red';
      state.selectedHeroId = hero.id;
      state.pendingBattle = null;
      state.phase = 'playing';
      for (const resource of Object.keys(state.players.red.resources)) state.players.red.resources[resource] = 100000;
      localStorage.setItem(key, JSON.stringify(state));
    })()`);
    await client.send('Page.reload', { ignoreCache: true });
    await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])') && !document.querySelector('#h3-continue').hidden");
    await client.click('#h3-continue');
    await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-adventure canvas')");
    await client.click('.h3-command-bar [data-action="enter-town"]');
    await client.waitFor(`document.querySelector('.h3-town-scene')?.dataset.faction === ${JSON.stringify(faction.id)} && document.querySelector('.h3-town-scene')?.dataset.buildingCount === '9'`);
    await client.assert(`(() => {
      const root = document.querySelector('.h3-town-scene');
      const buttons = [...document.querySelectorAll('.h3-town-scene__building')];
      const canvas = root.querySelector('canvas');
      return document.querySelector('.h3-town-screen').textContent.includes(${JSON.stringify(faction.name)}) &&
        buttons.length === 9 && root.querySelectorAll('.h3-town-scene__label').length === 9 &&
        buttons.every((button) => button.dataset.built === 'true') && canvas.getContext('webgl2') !== null;
    })()`, `${faction.id} did not render every constructed building in WebGL`);
    await client.click(`.h3-town-scene__building[data-building-id="${faction.buildings[1]}"]`);
    await client.waitFor(`document.querySelector('[data-creature-card="${faction.creatures[1]}"]')?.classList.contains('is-focused')`);
    await client.click(`[data-creature-card="${faction.creatures[1]}"] [data-action="recruit-creature"]`);
    await client.waitFor(`document.querySelector('[data-creature-card="${faction.creatures[1]}"] .h3-recruit-available strong')?.textContent.trim() === '9'`);
    await client.assert(`(() => {
      const panel = document.querySelector('.h3-town-panel');
      const card = document.querySelector('[data-creature-card="${faction.creatures[1]}"]');
      return panel.scrollWidth <= panel.clientWidth + 1 && card.getBoundingClientRect().left >= 0 && card.getBoundingClientRect().right <= innerWidth;
    })()`, `${faction.id} desktop building interaction overflows its panel`);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await client.waitFor('innerWidth === 390 && document.querySelector(".h3-town-scene canvas").clientWidth > 0');
    await client.assert(`(() => {
      const screen = document.querySelector('.h3-town-screen').getBoundingClientRect();
      const scene = document.querySelector('.h3-town-scene').getBoundingClientRect();
      const card = document.querySelector('[data-creature-card="${faction.creatures[1]}"]').getBoundingClientRect();
      const panel = document.querySelector('.h3-town-panel');
      const buttons = [...document.querySelectorAll('.h3-town-scene__building')].map((button) => button.getBoundingClientRect());
      return screen.left >= 0 && screen.right <= innerWidth && scene.left >= 0 && scene.right <= innerWidth &&
        card.left >= 0 && card.right <= innerWidth && panel.scrollWidth <= panel.clientWidth + 1 &&
        buttons.length === 9 && buttons.every((rect) => rect.left >= 0 && rect.right <= innerWidth);
    })()`, `${faction.id} mobile town or building controls overflow the viewport`);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await client.waitFor('innerWidth === 1280');
    console.log(`  ${faction.id}: 9 models, recruitment, desktop and mobile passed`);
  }

  console.log('Browser smoke: all landmark WebGL models, picking, effects, persistence, and mobile layouts');
  const landmarkFixtures = [
    { id: 'landmark-arcaneLibrary', name: 'Arcane Library', effect: 'spell', options: { clearSpells: true } },
    { id: 'landmark-warriorsArena', name: "Warriors' Arena", effect: 'attack' },
    { id: 'landmark-heroesShrine', name: "Heroes' Shrine", effect: 'experience' },
    { id: 'landmark-huntersLodge', name: "Hunters' Lodge", effect: 'defense' },
    { id: 'landmark-waterwheel', name: 'Waterwheel', effect: 'movement', options: { zeroMovement: true } },
    { id: 'landmark-elementalForge', name: 'Elemental Forge', effect: 'forge' },
    { id: 'landmark-ancientObservatory', name: 'Ancient Observatory', effect: 'reveal' },
    { id: 'landmark-healersSanctuary', name: "Healers' Sanctuary", effect: 'mana', options: { zeroMana: true } },
    { id: 'landmark-wayfarerPortal-west', name: 'Wayfarer Portal', effect: 'portal' },
    { id: 'landmark-wayfarerPortal-east', name: 'Wayfarer Portal', effect: 'portal' },
    { id: 'landmark-merchantsTent', name: "Merchants' Tent", effect: 'trade', options: { merchant: true } },
  ];
  for (const landmark of landmarkFixtures) {
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const before = await installWildFixture(client, landmark.id, landmark.options);
    await client.assert("document.querySelector('.h3-adventure canvas').getContext('webgl2') !== null", `${landmark.id} did not create a real adventure WebGL2 context`);
    const target = await findAdventureObject(client, landmark.name);
    assertWild(target, `Could not pick ${landmark.id} through the adventure WebGL canvas`);
    await client.mouse('mousePressed', target.x, target.y, { clickCount: 1 });
    await client.mouse('mouseReleased', target.x, target.y, { clickCount: 1 });
    await delay(120);
    await saveWildCampaign(client);
    const after = await readWildState(client);
    const hero = after.heroes['hero-aveline'];
    const object = after.map.objects[landmark.id];
    assertWild(object?.kind === 'landmark', `${landmark.id} disappeared after interaction`);
    assertWild(Number.isInteger(object.visits['hero-aveline']), `${landmark.id} did not persist its visit`);
    if (landmark.effect === 'spell') assertWild(hero.spells.includes('fireball'), 'Arcane Library did not teach a spell');
    if (landmark.effect === 'attack') assertWild(hero.primarySkills.attack === before.attack + 1, 'Warriors Arena did not grant attack');
    if (landmark.effect === 'experience') assertWild(hero.experience === before.experience + 1000, 'Heroes Shrine did not grant experience');
    if (landmark.effect === 'defense') assertWild(hero.primarySkills.defense === before.defense + 1, 'Hunters Lodge did not grant defense');
    if (landmark.effect === 'movement') assertWild(hero.movementPoints === before.maxMovementPoints, 'Waterwheel did not restore movement');
    if (landmark.effect === 'forge') {
      assertWild(hero.primarySkills.attack === before.attack + 1 && hero.primarySkills.defense === before.defense + 1, 'Elemental Forge did not grant both bonuses');
    }
    if (landmark.effect === 'reveal') assertWild(after.fog.red.explored.length > before.exploredCount, 'Ancient Observatory did not reveal new tiles');
    if (landmark.effect === 'mana') assertWild(hero.mana === before.maxMana, 'Healers Sanctuary did not restore mana');
    if (landmark.effect === 'portal') {
      assertWild(hero.position.x === before.linkedPosition.x && hero.position.y === before.linkedPosition.y, `${landmark.id} did not travel to its linked portal`);
    }
    if (landmark.effect === 'trade') {
      assertWild(after.players.red.resources.gold === before.gold - 500 && after.players.red.resources.wood === before.wood + 1 && after.players.red.resources.ore === before.ore + 1, 'Merchants Tent did not execute the fair trade');
    }
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await client.waitFor('innerWidth === 390 && document.querySelector(".h3-adventure canvas").clientWidth > 0');
    assertWild(await findAdventureObject(client, landmark.name), `${landmark.id} was not pickable after mobile WebGL resize`);
    await client.assert(`(() => {
      const canvas = document.querySelector('.h3-adventure canvas').getBoundingClientRect();
      const minimap = document.querySelector('.h3-minimap-panel').getBoundingClientRect();
      return canvas.left >= 0 && canvas.right <= innerWidth && minimap.left >= 0 && minimap.right <= innerWidth;
    })()`, `${landmark.id} mobile adventure layout overflows`);
    console.log(`  ${landmark.id}: model, raycast, effect, save, and mobile passed`);
  }

  console.log('Browser smoke: all 20 neutral overworld and tactical models in ten mixed encounters');
  const neutralFixtures = [
    { id: 'monster-neutral-arcane', name: 'Arcane Sentinels', units: ['Runic Golem', 'Beholder'] },
    { id: 'monster-neutral-aquatic', name: 'Tide of Teeth', units: ['Kraken', 'Sea Hag'] },
    { id: 'monster-neutral-beasts', name: 'Savage Menagerie', units: ['Dire Bear', 'Manticore'] },
    { id: 'monster-neutral-desert', name: 'Dune Revenants', units: ['Mummy', 'Sand Wyrm'] },
    { id: 'monster-neutral-forest', name: 'Thornwood Guardians', units: ['Ancient Ent', 'Giant Spider'] },
    { id: 'monster-neutral-ice', name: 'Frozen Brood', units: ['Frost Giant', 'Ice Wyrm'] },
    { id: 'monster-neutral-infernal', name: 'Infernal Hunt', units: ['Cerberus', 'Balor'] },
    { id: 'monster-neutral-reptile', name: 'Crowned Scales', units: ['Swamp Hydra', 'Basilisk King'] },
    { id: 'monster-neutral-swarm', name: 'Burrow Swarm', units: ['Ratling', 'Brood Mother'] },
    { id: 'monster-neutral-undead', name: 'Veiled Court', units: ['Lich', 'Wraith'] },
  ];
  for (const encounter of neutralFixtures) {
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await installWildFixture(client, encounter.id);
    const target = await findAdventureObject(client, encounter.name);
    assertWild(target, `Could not pick ${encounter.id} through the adventure WebGL canvas`);
    await client.mouse('mousePressed', target.x, target.y, { clickCount: 1 });
    await client.mouse('mouseReleased', target.x, target.y, { clickCount: 1 });
    await client.waitFor("document.querySelector('.h3b-root') && document.querySelector('[data-testid=\"adventure-layer\"]').hidden");
    for (const unit of encounter.units) {
      await client.assert(`[...document.querySelectorAll('.h3b-turn')].some((turn) => turn.getAttribute('title')?.startsWith(${JSON.stringify(unit)} + ' ·'))`, `${encounter.id} is missing ${unit}`);
    }
    await client.assert("document.querySelector('.h3b-root canvas').getContext('webgl2') !== null", `${encounter.id} did not create a real tactical WebGL2 context`);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await client.waitFor('innerWidth === 390 && document.querySelector(".h3b-root canvas").clientWidth > 0');
    await client.assert(`(() => {
      const root = document.querySelector('.h3b-root').getBoundingClientRect();
      return root.left >= 0 && root.right <= innerWidth && root.top >= 0 && root.bottom <= innerHeight;
    })()`, `${encounter.id} tactical mobile layout overflows`);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    if (encounter.id === 'monster-neutral-undead') {
      await client.click('.h3b-action[data-action="auto"]');
      await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 900000);
      await client.click('[data-action="complete"]');
      await client.waitFor("!document.querySelector('.h3b-root') && !document.querySelector('[data-testid=\"adventure-layer\"]').hidden");
      await saveWildCampaign(client);
      const after = await readWildState(client);
      assertWild(after.pendingBattle === null && !after.map.objects[encounter.id], 'Completed neutral battle did not persist its result');
    }
    console.log(`  ${encounter.id}: both neutral models, overworld picking, tactical WebGL, and mobile passed`);
  }

  if (process.env.H3_SCREENSHOT) {
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(projectRoot, process.env.H3_SCREENSHOT), Buffer.from(screenshot.data, 'base64'));
  }
  if (client.exceptions.length) throw new Error(`Browser exceptions:\n${client.exceptions.join('\n')}`);
  console.log('Browser smoke passed: /vcmik3/ production entry, 13-faction towns, 72-unit roster, 20 neutral models in ten encounters, all landmark effects and models, desktop/mobile WebGL picking and layouts, save/load, and tactical battles.');
} catch (error) {
  if (client) {
    try {
      const diagnostics = await client.evaluate(`(() => ({
        url: location.href,
        readyState: document.readyState,
        onboarding: document.querySelector('#h3-onboarding')?.outerHTML.slice(0, 500),
        continueHidden: document.querySelector('#h3-continue')?.hidden,
        fatal: document.querySelector('.h3-application-fatal')?.textContent,
        hasAutosave: localStorage.getItem('h3core.save.v1.autosave') !== null,
        body: document.body?.textContent.slice(0, 500),
      }))()`);
      console.error('Browser diagnostics:', JSON.stringify(diagnostics));
    } catch (diagnosticError) {
      console.error('Unable to collect browser diagnostics:', diagnosticError);
    }
  }
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
  server.closeAllConnections();
  server.unref();
  await Promise.race([new Promise((resolveClose) => server.close(resolveClose)), delay(3000)]);
  await rm(profile, { recursive: true, force: true });
}
