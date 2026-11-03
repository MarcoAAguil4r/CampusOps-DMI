const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const { CampusOpsApiClient } = require('../src/infrastructure/CampusOpsApiClient.ts');

function startBackend() {
  const backend = spawn(process.execPath, ['course-backend/server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, COURSE_BACKEND_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`Timed out starting backend: ${stderr}`)), 10_000);
    backend.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    backend.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    backend.once('error', reject);
  });
  return { backend, ready };
}

async function main() {
  const { backend, ready } = startBackend();
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (input, init) => {
    calls.push({ url: String(input), body: init?.body, key: init?.headers?.['Idempotency-Key'] });
    return originalFetch(input, init);
  };
  try {
    const port = await ready;
    const baseUrl = `http://127.0.0.1:${port}`;
    const start = new CampusOpsApiClient({ baseUrl, actorId: 'technician-1', timeoutMs: 500 });
    await start.request({
      method: 'POST', path: '/v1/incidents/campus-inc-001/actions', idempotencyKey: 'start-op-001',
      body: { action: 'start', baseVersion: 1 },
    });
    const resolution = new CampusOpsApiClient({
      baseUrl, actorId: 'technician-1', timeoutMs: 100,
      extraHeaders: { 'X-Course-Scenario': 'timeout_after_commit' },
    });
    const body = { action: 'resolve', baseVersion: 2, diagnosis: 'Diagnóstico ficticio' };
    const result = await resolution.request({
      method: 'POST', path: '/v1/incidents/campus-inc-001/actions', body, idempotencyKey: 'resolve-op-001',
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.incident.status, 'resolved');
    assert.equal(result.incident.payload.history.filter((item) => item.action === 'resolve').length, 1);
    const retries = calls.filter((call) => call.key === 'resolve-op-001');
    assert.equal(retries.length, 2);
    assert.deepEqual(retries.map((call) => call.body), [JSON.stringify(body), JSON.stringify(body)]);
    process.stdout.write('Lost resolution response check: replayed same key/body; one resolve history event PASS.\n');
  } finally {
    global.fetch = originalFetch;
    if (backend.exitCode === null) { backend.kill(); await once(backend, 'exit'); }
  }
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
