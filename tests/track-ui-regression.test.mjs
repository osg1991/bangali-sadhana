import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dirname, '..', 'learning', 'track-ui.js'), 'utf8');

test('learning-track refresh is observer-free and idempotent', () => {
  assert.doesNotMatch(source, /new MutationObserver/u, 'the review path must not use a DOM observer');
  assert.match(source, /trackPanelSignature/u, 'the progress panel must be updated only when its state changes');
  assert.match(source, /trackLockSignature/u, 'the lock message must be updated only when its state changes');
  assert.match(source, /if \(refreshQueued\) return;/u, 'multiple actions must collapse into one queued refresh');
  assert.match(source, /window\.addEventListener\('click', scheduleRefresh, true\)/u, 'refresh must follow user actions even when document handlers stop propagation');
  assert.doesNotMatch(
    source,
    /app\.querySelector\('\[data-learning-track-panel\]'\)\?\.remove\(\);\s*if \(activeView/u,
    'the panel must not be unconditionally removed and reinserted'
  );
});
