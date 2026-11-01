import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function waitForFile(path, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      await delay(100);
    }
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
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', rejectOpen, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, timeout = 60000) {
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
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }

  async waitFor(expression, timeout = 60000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.evaluate(`(() => { try { return Boolean(${expression}); } catch { return false; } })()`)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async assert(expression, message) {
    if (!await this.evaluate(expression)) throw new Error(message ?? `Browser assertion failed: ${expression}`);
  }

  async click(selector) {
    await this.waitFor(`document.querySelector(${JSON.stringify(selector)})`);
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }

  async setValue(selector, value) {
    await this.evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error('Missing input: ${selector}');
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  close() { this.socket.close(); }
}

async function saveCampaign(client) {
  if (!await client.evaluate("Boolean(document.querySelector('[data-save=\"autosave\"]'))")) {
    await client.click('.h3-command-bar [data-action="game-menu"]');
  }
  await client.click('[data-save="autosave"]');
  await delay(100);
  if (await client.evaluate("document.querySelector('.h3-dialog[open]')?.textContent.includes('Overwrite saved campaign?')")) {
    await client.evaluate(`[...document.querySelectorAll('.h3-dialog-actions button')].find((button) => button.textContent.includes('Overwrite save')).click()`);
  }
  await delay(250);
  if (!await client.evaluate("Boolean(document.querySelector('.h3-dialog[open]'))")) return;
  await client.evaluate(`[...document.querySelectorAll('.h3-dialog-actions button')].find((button) => /Return to adventure|Close/.test(button.textContent))?.click()`);
}

async function reloadCampaign(client) {
  await client.send('Page.reload', { ignoreCache: true });
  await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])') && !document.querySelector('#h3-continue').hidden");
  await client.click('#h3-continue');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-adventure canvas')");
}

async function exerciseBlockedCampaignInputs(client, selector) {
  await client.evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) throw new Error('Missing editor isolation target: ' + ${JSON.stringify(selector)});
    for (const init of [
      { key: 'n' },
      { key: 'h' },
      { key: ' ', code: 'Space' },
      { key: 's', ctrlKey: true },
      { key: 'o', ctrlKey: true },
    ]) target.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true }));
    document.querySelector('.h3-command-bar [data-action="end-turn"]').click();
    document.querySelector('.h3-command-bar [data-action="game-menu"]').click();
  })()`);
}

await access(chromePath);
await access(resolve(distRoot, 'index.html'));
const profile = await mkdtemp(resolve(projectRoot, '.h3content-browser-'));
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
    let filePath = resolve(distRoot, pathname.slice('/vcmik3/'.length) || 'index.html');
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
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    `--use-angle=${process.env.H3_CHROME_ANGLE ?? 'swiftshader'}`, '--enable-unsafe-swiftshader',
    '--window-size=1280,900', applicationUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', (chunk) => chromeErrors.push(String(chunk)));
  const devTools = await waitForFile(resolve(profile, 'DevToolsActivePort'));
  const devToolsPort = devTools.split('\n')[0].trim();
  let page;
  const deadline = Date.now() + 20000;
  while (!page && Date.now() < deadline) {
    const targets = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`).then((result) => result.json());
    page = targets.find((target) => target.type === 'page' && target.url.startsWith(applicationUrl));
    if (!page) await delay(100);
  }
  if (!page) throw new Error('Chrome did not open the application');
  client = await CdpClient.connect(page.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');

  console.log('H3CONTENT browser: campaign, resources, and responsive UI');
  await client.waitFor("document.readyState === 'complete' && document.querySelector('#h3-onboarding:not([hidden])')");
  await client.setValue('#h3-seed', 'h3content-browser');
  await client.click('[data-action="start-new"]');
  await client.waitFor("document.querySelector('#h3-onboarding').hidden && document.querySelector('.h3-ui')");
  await client.assert("document.querySelectorAll('.h3-resources .h3-resource').length === 10", 'Expanded resource bar does not contain ten resources');
  await client.click('[data-action="minimap-expand"]');
  await client.assert("document.querySelectorAll('[data-action=\"town-navigate\"]').length === 13", 'Prior 13-town atlas regressed');
  await client.click('[data-action="minimap-expand"]');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await client.waitFor('innerWidth === 390');
  await client.assert(`(() => {
    const list = document.querySelector('.h3-resources');
    list.scrollLeft = list.scrollWidth;
    const last = list.lastElementChild.getBoundingClientRect();
    return list.children.length === 10 && list.scrollWidth >= list.clientWidth && last.left >= 0 && last.right <= innerWidth &&
      document.documentElement.scrollWidth <= innerWidth;
  })()`, 'Ten-resource mobile UI is not reachable without page overflow');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await saveCampaign(client);
  await client.evaluate(`(() => {
    const key = 'h3core.save.v1.autosave';
    const state = JSON.parse(localStorage.getItem(key));
    const hero = state.heroes['hero-aveline'];
    const object = state.map.objects['mithril-cache'];
    hero.position = { ...object.position };
    state.selectedHeroId = hero.id;
    localStorage.setItem(key, JSON.stringify(state));
  })()`);
  await reloadCampaign(client);
  const mithrilBefore = await client.evaluate("JSON.parse(localStorage.getItem('h3core.save.v1.autosave')).players.red.resources.mithril");
  await client.click('.h3-command-bar [data-action="interact"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Treasure claimed')");
  await saveCampaign(client);
  await client.assert(`JSON.parse(localStorage.getItem('h3core.save.v1.autosave')).players.red.resources.mithril > ${mithrilBefore}`, 'Mithril pickup did not increase the balance');

  console.log('H3CONTENT browser: artifact pickup, equipment, and save/load');
  await client.evaluate(`(() => {
    const key = 'h3core.save.v1.autosave';
    const state = JSON.parse(localStorage.getItem(key));
    const hero = state.heroes['hero-aveline'];
    hero.position = { ...state.map.objects['artifact-copperSunblade'].position };
    localStorage.setItem(key, JSON.stringify(state));
  })()`);
  await reloadCampaign(client);
  await client.click('.h3-command-bar [data-action="interact"]');
  await client.waitFor("document.querySelector('.h3-toasts')?.textContent.includes('Artifact found')");
  await client.click('[data-action="open-inventory"]');
  await client.waitFor("document.querySelector('.h3-inventory-dialog[open]') && document.querySelector('[data-action=\"equip-artifact\"][data-artifact-id=\"copperSunblade\"]')");
  await client.click('[data-action="equip-artifact"][data-artifact-id="copperSunblade"]');
  await client.waitFor("document.querySelector('[data-action=\"unequip-artifact\"][data-slot=\"weapon\"]')");
  await client.evaluate("document.querySelector('.h3-inventory-dialog [data-dialog-close]').click()");
  await client.assert(`(() => {
    const state = JSON.parse(localStorage.getItem('h3core.save.v1.autosave'));
    const hero = state.heroes['hero-aveline'];
    const attack = [...document.querySelectorAll('.h3-primary-stats strong')][0].textContent;
    return Number(attack) === hero.primarySkills.attack + 1;
  })()`, 'Equipment did not apply attack in the adventure hero panel');
  await saveCampaign(client);
  await reloadCampaign(client);
  await client.assert("JSON.parse(localStorage.getItem('h3core.save.v1.autosave')).heroes['hero-aveline'].artifacts.equipped.weapon === 'copperSunblade'", 'Equipment was not persisted');

  console.log('H3CONTENT browser: expanded spellcasting, once-per-round rule, and mana result');
  await client.evaluate(`(() => {
    const key = 'h3core.save.v1.autosave';
    const state = JSON.parse(localStorage.getItem(key));
    const hero = state.heroes['hero-aveline'];
    const monster = state.map.objects['monster-west'];
    hero.position = { ...monster.position };
    hero.army = [{ creatureId: 'dragon', count: 50 }];
    hero.primarySkills.knowledge = 6;
    hero.primarySkills.spellPower = 2;
    hero.maxMana = 60;
    hero.mana = 60;
    monster.army = [{ creatureId: 'militia', count: 20 }];
    state.pendingBattle = null;
    localStorage.setItem(key, JSON.stringify(state));
  })()`);
  await reloadCampaign(client);
  console.log('  entering expanded-spell battle');
  await client.click('.h3-command-bar [data-action="interact"]');
  await client.waitFor("document.querySelector('.h3b-root') && document.querySelector('.h3b-active')?.textContent.includes('Verdant Dragon')");
  await client.click('.h3b-action[data-action="spell"]');
  await client.assert("document.querySelectorAll('.h3b-spell').length === 19", 'Tactical spellbook does not contain all 19 spells');
  console.log('  casting Ember Volley');
  await client.click('[data-spell="emberVolley"]');
  await client.waitFor("document.querySelector('.h3b-heroes')?.textContent.includes('48/60 mana') && document.querySelector('.h3b-log-list')?.textContent.includes('Ember Volley')");
  await client.assert("document.querySelector('.h3b-action[data-action=\"spell\"]').disabled", 'Once-per-round casting was not disabled after a real cast');
  console.log('  resolving decisive post-cast attack');
  await client.click('.h3b-action[data-action="auto"]');
  await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 20000);
  await client.click('[data-action="complete"]');
  await client.waitFor("!document.querySelector('.h3b-root') && !document.querySelector('[data-testid=\"adventure-layer\"]').hidden");
  await saveCampaign(client);
  await client.assert(`(() => {
    const state = JSON.parse(localStorage.getItem('h3core.save.v1.autosave'));
    return state.pendingBattle === null && state.heroes['hero-aveline'].mana <= 48;
  })()`, 'Tactical mana was not returned and persisted with the battle result');

  console.log('H3CONTENT browser: custom editor, persistence, and isolated sandbox battle');
  const campaignSaveBeforeEditor = await client.evaluate("localStorage.getItem('h3core.save.v1.autosave')");
  await client.click('[data-action="open-editor"]');
  await client.waitFor("document.querySelector('.content-editor') && !document.querySelector('.h3-editor-layer').hidden");
  await client.click('[data-ui="new"]');
  await client.setValue('[data-field="name"]', 'Browser Custom');
  await client.setValue('[data-resource="mithril"]', '1');
  await client.setValue('[data-resource="obsidian"]', '2');
  await client.setValue('[data-resource="essence"]', '3');
  await client.click('form[data-editor-form] button[type="submit"]');
  await client.waitFor("document.querySelector('[data-ui=\"status\"]')?.textContent.includes('created')");
  await client.click('[data-action="tab"][data-kind="artifact"]');
  await client.click('[data-ui="new"]');
  await client.setValue('[data-field="name"]', 'Browser Focus');
  await client.click('form[data-editor-form] button[type="submit"]');
  await client.waitFor("document.querySelector('[data-ui=\"status\"]')?.textContent.includes('created')");
  await client.assert(`(() => {
    const registry = JSON.parse(localStorage.getItem('h3content.custom-registry.v1'));
    const creature = registry.creatures.find((entry) => entry.name === 'Browser Custom');
    return creature?.cost.mithril === 1 && creature.cost.obsidian === 2 && creature.cost.essence === 3 &&
      registry.artifacts.some((entry) => entry.name === 'Browser Focus');
  })()`, 'Custom definitions or expanded resource costs were not persisted');
  await exerciseBlockedCampaignInputs(client, '.content-editor');
  await client.assert(`localStorage.getItem('h3core.save.v1.autosave') === ${JSON.stringify(campaignSaveBeforeEditor)}`, 'Editor keyboard or commands mutated the autosave');
  await client.click('[data-action="start-sandbox"]');
  await client.waitFor("document.querySelector('.h3-sandbox-host .h3b-root') && document.querySelector('.h3b-active')?.textContent.includes('Browser Custom')");
  await exerciseBlockedCampaignInputs(client, '.h3-sandbox-host .h3b-root');
  await client.evaluate("document.querySelector('.h3-sandbox-host [data-action=\"close-help\"]')?.click()");
  await client.assert(`localStorage.getItem('h3core.save.v1.autosave') === ${JSON.stringify(campaignSaveBeforeEditor)} &&
    document.querySelector('.h3-application').dataset.editorOpen === 'true' && Boolean(document.querySelector('.h3-sandbox-host .h3b-root')) &&
    !document.querySelector('.h3-ui .h3-dialog[open]')`, 'Sandbox input changed the campaign or opened campaign commands');
  await client.click('[data-action="leave-sandbox"]');
  await client.click('[data-action="close-editor"]');
  await saveCampaign(client);
  await client.assert(`localStorage.getItem('h3core.save.v1.autosave') === ${JSON.stringify(campaignSaveBeforeEditor)}`, 'Editor or sandbox mutated in-memory campaign state');
  await client.click('[data-action="open-editor"]');
  await client.click('[data-action="start-sandbox"]');
  await client.waitFor("document.querySelector('.h3-sandbox-host .h3b-root') && document.querySelector('.h3b-active')?.textContent.includes('Browser Custom')");
  await client.assert("document.querySelector('.h3b-initiative')?.textContent.includes('Militia')", 'Sandbox did not preserve the built-in opponent');
  await client.click('.h3b-action[data-action="auto"]');
  await client.waitFor("!document.querySelector('[data-modal=\"result\"]').hidden", 120000);
  await client.click('[data-action="complete"]');
  await client.waitFor("document.querySelector('.h3-sandbox-result')?.textContent.includes('Campaign state was not changed')");
  await client.assert(`localStorage.getItem('h3core.save.v1.autosave') === ${JSON.stringify(campaignSaveBeforeEditor)}`, 'Sandbox mutated the campaign save');

  await client.send('Page.reload', { ignoreCache: true });
  await client.waitFor("document.querySelector('#h3-onboarding:not([hidden])')");
  await client.click('[data-action="onboarding-editor"]');
  await client.waitFor("document.querySelector('.content-editor-list')?.textContent.includes('Browser Custom')");
  await client.click('[data-action="tab"][data-kind="artifact"]');
  await client.waitFor("document.querySelector('.content-editor-list')?.textContent.includes('Browser Focus')");
  if (client.exceptions.length) throw new Error(`Browser exceptions:\n${client.exceptions.join('\n')}`);
  console.log('H3CONTENT browser passed: resources, equipment, expanded spellcasting, mana persistence, custom editor, and sandbox.');
} catch (error) {
  if (client) {
    try {
      const diagnostics = await client.evaluate(`(() => ({
        url: location.href,
        body: document.body.textContent.slice(0, 900),
        battle: document.querySelector('.h3b-hint')?.textContent,
        editor: document.querySelector('[data-ui="status"]')?.textContent,
      }))()`);
      console.error('H3CONTENT diagnostics:', JSON.stringify(diagnostics));
    } catch { }
  }
  if (chromeErrors.length) console.error(chromeErrors.slice(-20).join(''));
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
