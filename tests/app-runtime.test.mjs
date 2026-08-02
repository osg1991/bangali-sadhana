import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');

function element(id = '') {
  const listeners = new Map();
  return {
    id,
    dataset: {},
    innerHTML: '',
    textContent: '',
    className: '',
    checked: false,
    hidden: false,
    value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatch(type, event = {}) { listeners.get(type)?.({ target: this, ...event }); },
    focus() {},
    showModal() {},
    closest() { return null; }
  };
}

function createContext() {
  const ids = new Map();
  for (const id of [
    'app', 'settings-dialog', 'install-button', 'network-status', 'streak-status', 'toast',
    'settings-button', 'show-roman', 'show-devanagari', 'show-tamil'
  ]) ids.set(id, element(id));

  const navButtons = ['today', 'script', 'words', 'sentences', 'songs'].map(view => {
    const button = element(`nav-${view}`);
    button.dataset.view = view;
    return button;
  });

  const storage = new Map();
  const document = {
    getElementById(id) {
      if (!ids.has(id)) ids.set(id, element(id));
      return ids.get(id);
    },
    querySelectorAll(selector) { return selector === '.nav-button' ? navButtons : []; },
    addEventListener() {}
  };

  const window = {
    BENGALI_BASE_CONTENT: undefined,
    RAMPRASAD_CONTENT: undefined,
    addEventListener() {},
    scrollTo() {}
  };

  const context = vm.createContext({
    window,
    document,
    navigator: { onLine: true },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    structuredClone,
    setTimeout,
    clearTimeout,
    console,
    Date,
    Math,
    Set,
    Map,
    Array,
    String,
    Object,
    JSON
  });
  return { context, ids, navButtons };
}

function runFile(context, path) {
  vm.runInContext(readFileSync(resolve(root, path), 'utf8'), context, { filename: path });
}

test('application renders imported lyric words and songs', () => {
  const { context, ids, navButtons } = createContext();
  runFile(context, 'content/base-content.js');
  runFile(context, 'content/generated/ramprasad-content.js');
  runFile(context, 'app.js');

  const today = ids.get('app').innerHTML;
  assert.match(today, /আজকের সাধনা/u);
  assert.match(today, /Ramprasad Sen · imported/u);
  assert.match(today, /Ramprasadi vocabulary/u);
  assert.match(today, /<strong>Tamil:<\/strong>/u);

  navButtons.find(button => button.dataset.view === 'songs').dispatch('click');
  const songs = ids.get('app').innerHTML;
  const imported = context.window.RAMPRASAD_CONTENT;
  assert.ok(songs.includes(`${imported.songs.length} songs imported`));
  assert.ok(songs.includes(`${imported.words.length} reviewed lyric words`));
  assert.match(songs, /Show imported lyrics/u);
});
