import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(editorRoot, '../..');
const require = createRequire(import.meta.url);
const viteBin = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = Number(process.env.EDITOR_BROWSER_PORT ?? 4176);
const harnessBase = `ContentEditor-${process.pid}.harness`;
const harnessHtml = resolve(editorRoot, `${harnessBase}.html`);
const harnessModule = resolve(editorRoot, `${harnessBase}.mjs`);
const url = `http://127.0.0.1:${port}/src/editor/${harnessBase}.html`;
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.kill('SIGTERM');
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(check, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForFile(path, timeout = 15000) {
  let content = '';
  await waitFor(async () => {
    try {
      content = await readFile(path, 'utf8');
      return content.length > 0;
    } catch {
      return false;
    }
  }, path, timeout);
  return content;
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

  send(method, params = {}, timeout = 15000) {
    const id = this.nextId++;
    return new Promise((resolveSend, rejectSend) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectSend(new Error(`Timed out running ${method}`));
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
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    }
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

let server;
let chrome;
let client;
let chromeProfile;
let serverLog = '';

async function run() {
  await writeFile(harnessHtml, `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><title>Editor browser regressions</title></head>
<body><main id="root"></main><script type="module" src="./${harnessBase}.mjs"></script></body></html>`);
  await writeFile(harnessModule, `import { ContentEditor } from './ContentEditor.ts';
import { ContentEditorStore } from './ContentEditorStore.ts';
const store = new ContentEditorStore({ storage: null, randomToken: () => 'keyboard' });
const editor = new ContentEditor(document.querySelector('#root'), { store });
window.editorBrowserTest = { store, editor };
document.body.dataset.editorReady = 'true';`);

  server = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--base', '/'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
  server.stderr.on('data', (chunk) => { serverLog += String(chunk); });
  await waitFor(async () => {
    try {
      return (await fetch(url)).ok;
    } catch {
      return false;
    }
  }, `Vite at ${url}\n${serverLog}`);

  chromeProfile = await mkdtemp(resolve(editorRoot, '.chrome-editor-'));
  chrome = spawn(chromePath, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  const devTools = await waitForFile(resolve(chromeProfile, 'DevToolsActivePort'));
  const [debugPort] = devTools.trim().split('\n');
  let targets;
  await waitFor(async () => {
    try {
      targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      return targets.some((target) => target.type === 'page');
    } catch {
      return false;
    }
  }, 'Chrome page target');
  const page = targets.find((target) => target.type === 'page');
  client = await CdpClient.connect(page.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url });
  try {
    await waitFor(async () => client.evaluate('document.body?.dataset.editorReady === "true"'), 'editor mount');
  } catch (error) {
    console.error(await client.evaluate('document.documentElement.outerHTML'));
    console.error(client.exceptions);
    throw error;
  }

  const evaluate = (expression) => client.evaluate(expression);
  const activeElement = () => evaluate(`(() => {
    const element = document.activeElement;
    return {
      tag: element?.tagName,
      action: element?.dataset.action,
      field: element?.dataset.field,
      id: element?.dataset.id,
      value: element?.value,
    };
  })()`);
  const setField = async (field, value) => {
    await evaluate(`(() => {
      const control = document.querySelector('[data-field="${field}"]');
      if (!control) throw new Error('Missing field ${field}');
      control.value = ${JSON.stringify(value)};
      control.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  };
  const focusAction = async (action) => {
    const focused = await evaluate(`(() => {
      const control = document.querySelector('button[data-action="${action}"]');
      if (!control) return false;
      control.focus();
      return document.activeElement === control;
    })()`);
    assert.equal(focused, true, `Could not focus ${action}`);
  };
  const pressEnter = async () => {
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
  };
  const activate = async (action) => {
    await focusAction(action);
    await pressEnter();
  };

  assert.equal(await evaluate('document.querySelector(".content-editor-model canvas") !== null'), true, 'Live model preview missing');
  await setField('name', 'Keyboard Vanguard');
  await activate('save');
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().creatures.length === 1'), 'creature save');
  const creatureId = await evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].id');
  let focus = await activeElement();
  assert.deepEqual(
    { tag: focus.tag, action: focus.action, id: focus.id },
    { tag: 'BUTTON', action: 'select', id: creatureId },
    'Create Save must focus the saved creature list entry',
  );
  assert.equal(await evaluate(`window.editorBrowserTest.editor.getBattleHooks().createCreatureModel(${JSON.stringify(creatureId)})?.userData.creatureId`), creatureId);

  await setField('health', '0');
  await activate('save');
  await waitFor(async () => evaluate('document.querySelector("[data-ui=form-errors]") === document.activeElement'), 'invalid-save focus');
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].health'), 10, 'Invalid health must not be saved');
  await setField('health', '36');
  await activate('save');
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].health === 36'), 'valid health update');
  focus = await activeElement();
  assert.equal(focus.action, 'select', 'Successful Save after a validation error must restore list focus');

  await setField('name', 'Keyboard Vanguard Updated');
  await activate('save');
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].name === "Keyboard Vanguard Updated"'), 'creature update');
  focus = await activeElement();
  assert.equal(focus.action, 'select', 'Update Save must focus the saved list entry');
  assert.equal(focus.id, creatureId);

  await setField('name', 'Discard this edit');
  await activate('cancel');
  await waitFor(async () => evaluate('document.querySelector("[data-field=name]").value === "Keyboard Vanguard Updated"'), 'cancel restoration');
  focus = await activeElement();
  assert.deepEqual(
    { tag: focus.tag, field: focus.field, value: focus.value },
    { tag: 'INPUT', field: 'name', value: 'Keyboard Vanguard Updated' },
    'Cancel must focus the restored name input',
  );
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].name'), 'Keyboard Vanguard Updated');

  await activate('new');
  await setField('name', 'Unsaved new creature');
  await activate('cancel');
  await waitFor(async () => evaluate('document.querySelector("[data-field=name]").value === "Keyboard Vanguard Updated"'), 'new-draft cancellation');
  focus = await activeElement();
  assert.equal(focus.field, 'name', 'New-draft Cancel must focus the surviving name input');
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures.length'), 1);

  await setField('name', 'Dirty navigation must not save');
  const dirtyTabFocused = await evaluate(`(() => {
    const tab = document.querySelector('[role="tab"][data-kind="artifact"]');
    tab.focus();
    return document.activeElement === tab;
  })()`);
  assert.equal(dirtyTabFocused, true);
  await pressEnter();
  await waitFor(async () => evaluate('document.querySelector("[role=alertdialog]") !== null'), 'dirty-navigation confirmation');
  assert.equal((await activeElement()).action, 'confirm-no');
  await pressEnter();
  assert.equal(await evaluate('document.querySelector(".content-editor").dataset.kind'), 'creature');
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].name'), 'Keyboard Vanguard Updated');
  await activate('cancel');
  assert.equal((await activeElement()).field, 'name');

  const artifactTabFocused = await evaluate(`(() => {
    const tab = document.querySelector('[role="tab"][data-kind="artifact"]');
    tab.focus();
    return document.activeElement === tab;
  })()`);
  assert.equal(artifactTabFocused, true);
  await pressEnter();
  await waitFor(async () => evaluate('document.querySelector(".content-editor").dataset.kind === "artifact"'), 'artifact tab');
  await setField('name', 'Keyboard Artifact');
  await activate('save');
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().artifacts.length === 1'), 'artifact save');
  const artifactId = await evaluate('window.editorBrowserTest.store.getSnapshot().artifacts[0].id');
  focus = await activeElement();
  assert.equal(focus.action, 'select', 'Artifact Save must focus the saved list entry');
  assert.equal(focus.id, artifactId);

  await setField('description', 'Discard this artifact edit');
  await activate('cancel');
  focus = await activeElement();
  assert.equal(focus.field, 'name', 'Artifact Cancel must focus the restored name input');
  assert.equal(focus.value, 'Keyboard Artifact');

  await activate('export');
  const exported = await evaluate('document.querySelector("[data-ui=json-input]").value');
  const exportedRegistry = JSON.parse(exported);
  assert.equal(exportedRegistry.version, 1);
  assert.equal(exportedRegistry.creatures[0].id, creatureId);
  assert.equal(exportedRegistry.artifacts[0].id, artifactId);
  await activate('transfer-close');

  await activate('import-open');
  await evaluate('document.querySelector("[data-ui=json-input]").value = "{bad json"');
  await activate('import-apply');
  assert.equal(await evaluate('document.querySelectorAll("[data-ui=transfer-errors]").length'), 1);
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures.length'), 1);
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().artifacts.length'), 1);
  assert.equal(await evaluate('document.querySelector("[data-ui=json-input]").value'), '{bad json');
  await activate('transfer-close');

  await activate('import-open');
  await evaluate(`(() => {
    document.querySelector('[data-ui=json-input]').value = ${JSON.stringify(exported)};
    document.querySelector('[data-ui=import-mode]').value = 'replace';
  })()`);
  await activate('import-apply');
  await waitFor(async () => evaluate('document.querySelector("[data-ui=json-input]") === null'), 'replace import');
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures[0].health'), 36);
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().artifacts.length'), 1);

  await activate('delete');
  await pressEnter();
  assert.equal(await evaluate('window.editorBrowserTest.store.getArtifact(window.editorBrowserTest.store.getSnapshot().artifacts[0]?.id) !== undefined'), true);
  await activate('delete');
  await focusAction('confirm-yes');
  await pressEnter();
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().artifacts.length === 0'), 'artifact deletion');

  await activate('reset');
  await pressEnter();
  assert.equal(await evaluate('window.editorBrowserTest.store.getSnapshot().creatures.length'), 1);
  await activate('reset');
  await focusAction('confirm-yes');
  await pressEnter();
  await waitFor(async () => evaluate('window.editorBrowserTest.store.getSnapshot().creatures.length === 0'), 'registry reset');
  assert.equal(await evaluate(`window.editorBrowserTest.editor.getBattleHooks().getCreature(${JSON.stringify(creatureId)}) === undefined`), true);

  const persisted = await evaluate(`(async () => {
    const { ContentEditorStore } = await import('/src/editor/ContentEditorStore.ts');
    const key = 'h3content.editor-browser-regression';
    try {
      const original = new ContentEditorStore({ storage: localStorage, storageKey: key });
      const imported = original.importJson(${JSON.stringify(exported)}, { mode: 'replace' });
      if (!imported.ok) return { imported: false };
      const restored = new ContentEditorStore({ storage: localStorage, storageKey: key });
      return {
        imported: true,
        creatures: restored.getSnapshot().creatures.length,
        artifacts: restored.getSnapshot().artifacts.length,
        health: restored.getSnapshot().creatures[0].health,
      };
    } finally {
      localStorage.removeItem(key);
    }
  })()`);
  assert.deepEqual(persisted, { imported: true, creatures: 1, artifacts: 1, health: 36 });
  await evaluate('window.editorBrowserTest.editor.dispose()');
  assert.equal(await evaluate('document.querySelector(".content-editor") === null'), true);
  assert.deepEqual(client.exceptions, [], 'Editor browser run must not produce JavaScript exceptions');
  console.log('PASSED: real Enter-key Save/Cancel focus regressions and comprehensive editor browser flows');
}

try {
  await run();
} catch (error) {
  console.error(error);
  if (serverLog) console.error(serverLog);
  process.exitCode = 1;
} finally {
  client?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  await Promise.all([
    rm(harnessHtml, { force: true }),
    rm(harnessModule, { force: true }),
    chromeProfile ? rm(chromeProfile, { recursive: true, force: true }) : Promise.resolve(),
  ]);
}
