import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const browserCandidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);

function findBrowser() {
  for (const candidate of browserCandidates) {
    const result = spawnSync('sh', ['-lc', `command -v ${candidate}`], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return '';
}

function runBrowser(executable, args, timeoutMs = 20000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(new Error(`Browser timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      resolveRun({ status: code, stdout, stderr });
    });
  });
}

const browser = findBrowser();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png'
};

function serveFile(requestPath) {
  const clean = normalize(decodeURIComponent(requestPath.split('?')[0])).replace(/^([/\\])+/, '');
  const file = join(root, clean || 'index.html');
  if (!file.startsWith(root) || !statSync(file).isFile()) throw new Error('Not found');
  return file;
}

test('daily review opens and browser remains responsive', { skip: !browser }, async () => {
  const server = createServer((request, response) => {
    try {
      const file = serveFile(request.url || '/');
      response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(readFileSync(file));
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
  const { port } = server.address();
  try {
    const result = await runBrowser(browser, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=5000',
      '--dump-dom',
      `http://127.0.0.1:${port}/tests/browser-review-smoke.html`
    ]);

    assert.equal(result.status, 0, result.stderr || 'Headless browser failed');
    assert.match(result.stdout, /data-review-smoke="pass"/u);
    assert.match(result.stdout, /Daily review/u);
  } finally {
    await new Promise(resolveClosed => server.close(resolveClosed));
  }
});
