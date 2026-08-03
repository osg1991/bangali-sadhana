#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest',
  'content/base-content.js', 'content/complete-script.js',
  'content/curriculum/README.md', 'content/curriculum/a1/week-20-common-adjectives.md',
  'content/generated/ramprasad-content.js',
  'content/generated/ramprasad-songs.json', 'content/generated/ramprasad-words.json',
  'content/generated/curriculum-content.js', 'content/generated/curriculum-content.json',
  'content/generated/curriculum-report.md',
  'learning/srs-engine.js', 'learning/srs-app.js', 'learning/srs.css',
  'learning/track-engine.js', 'learning/track-ui.js', 'learning/track.css',
  'learning/curriculum-engine.js', 'learning/curriculum-app.js', 'learning/curriculum.css',
  'scripts/sync-curriculum.mjs',
  'icons/icon-192.png', 'icons/icon-512.png'
];

for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing required file: ${file}`);
}

for (const file of [
  'app.js', 'sw.js', 'content/base-content.js', 'content/complete-script.js',
  'content/generated/ramprasad-content.js', 'content/generated/curriculum-content.js',
  'learning/srs-engine.js', 'learning/srs-app.js',
  'learning/track-engine.js', 'learning/track-ui.js',
  'learning/curriculum-engine.js', 'learning/curriculum-app.js'
]) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}

JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
for (const file of ['ramprasad-meta.json', 'ramprasad-songs.json', 'ramprasad-words.json', 'ramprasad-unmapped-words.json', 'curriculum-content.json']) {
  JSON.parse(readFileSync(join(root, 'content/generated', file), 'utf8'));
}

const curriculum = JSON.parse(readFileSync(join(root, 'content/generated/curriculum-content.json'), 'utf8'));
if (!curriculum.units?.length) throw new Error('No generated curriculum units.');
for (const unit of curriculum.units) {
  for (const key of ['id', 'level', 'week', 'topic']) if (!unit[key]) throw new Error(`Curriculum unit missing ${key}.`);
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
for (const reference of [
  'content/base-content.js', 'content/complete-script.js',
  'content/generated/ramprasad-content.js', 'content/generated/curriculum-content.js',
  'learning/srs-engine.js', 'learning/track-engine.js', 'learning/curriculum-engine.js',
  'learning/srs-app.js', 'learning/track-ui.js', 'learning/curriculum-app.js',
  'learning/srs.css', 'learning/track.css', 'learning/curriculum.css',
  'app.js', 'styles.css'
]) {
  if (!index.includes(reference)) throw new Error(`index.html does not load ${reference}`);
}

const serviceWorker = readFileSync(join(root, 'sw.js'), 'utf8');
for (const offlineFile of [
  'content/generated/curriculum-content.js',
  'learning/srs-engine.js', 'learning/track-engine.js', 'learning/curriculum-engine.js',
  'learning/srs-app.js', 'learning/track-ui.js', 'learning/curriculum-app.js',
  'learning/srs.css', 'learning/track.css', 'learning/curriculum.css'
]) {
  if (!serviceWorker.includes(offlineFile)) throw new Error(`sw.js does not cache ${offlineFile}`);
}

console.log('Static application validation passed.');
