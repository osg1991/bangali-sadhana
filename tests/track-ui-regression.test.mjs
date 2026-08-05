import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dirname, '..', 'learning', 'track-ui.js'), 'utf8');

test('learning-track DOM refresh cannot trigger an endless observer loop', () => {
  assert.match(source, /observer\?\.disconnect\(\)/u, 'refresh must pause its own MutationObserver');
  assert.match(source, /trackPanelSignature/u, 'the progress panel must be updated only when its state changes');
  assert.match(source, /trackLockSignature/u, 'the lock message must be updated only when its state changes');
  assert.match(source, /if \(refreshQueued\) return;/u, 'multiple mutations must collapse into one queued refresh');
  assert.doesNotMatch(
    source,
    /app\.querySelector\('\[data-learning-track-panel\]'\)\?\.remove\(\);\s*if \(activeView/u,
    'the panel must not be unconditionally removed and reinserted'
  );
});
