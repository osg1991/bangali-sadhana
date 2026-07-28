#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest',
  'content/base-content.js', 'content/generated/ramprasad-content.js',
  'content/generated/ramprasad-songs.json', 'content/generated/ramprasad-words.json',
  'icons/icon-192.png', 'icons/icon-512.png'
];

for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing required file: ${file}`);
}

for (const file of ['app.js', 'sw.js', 'content/base-content.js', 'content/generated/ramprasad-content.js']) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}

JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
for (const file of ['ramprasad-meta.json', 'ramprasad-songs.json', 'ramprasad-words.json', 'ramprasad-unmapped-words.json']) {
  JSON.parse(readFileSync(join(root, 'content/generated', file), 'utf8'));
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
for (const reference of ['content/base-content.js', 'content/generated/ramprasad-content.js', 'app.js', 'styles.css']) {
  if (!index.includes(reference)) throw new Error(`index.html does not load ${reference}`);
}

console.log('Static application validation passed.');
