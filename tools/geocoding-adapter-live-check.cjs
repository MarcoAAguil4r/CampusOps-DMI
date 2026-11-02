const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(outputText, filename);
};

const { GeocodingHttpAdapter } = require('../src/infrastructure/GeocodingHttpAdapter.ts');
const { HttpStatusError } = require('../src/infrastructure/httpErrors.ts');

function startBackend() {
  const root = process.cwd();
  const backend = spawn(process.execPath, ['course-backend/server.mjs'], {
    cwd: root,
    env: { ...process.env, COURSE_BACKEND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ready = new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for the controlled backend. ${errorOutput}`));
    }, 10000);
    const finish = (callback, value) => {
      clearTimeout(timeout);
      callback(value);
    };

    backend.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/DMI controlled backend listening at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) finish(resolve, Number(match[1]));
    });
    backend.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });
    backend.once('error', (error) => finish(reject, error));
    backend.once('exit', (code) => {
      finish(reject, new Error(`Controlled backend exited with ${code}. ${errorOutput}`));
    });
  });

  return { backend, ready };
}

async function main() {
  const { backend, ready } = startBackend();
  try {
    const port = await ready;
    const endpointUrl = `http://127.0.0.1:${port}/v1/geocoding`;
    const loginResponse = await fetch(`http://127.0.0.1:${port}/v1/session/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: 'reporter-1' }),
    });
    assert.equal(loginResponse.status, 200);
    const session = await loginResponse.json();
    assert.equal(session.actorId, 'reporter-1');

    const headers = {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Course-Actor': 'reporter-1',
    };
    const directResponse = await fetch(`${endpointUrl}?q=Zona+ficticia`, {
      headers: { ...headers, 'X-Course-Scenario': 'success' },
    });
    assert.equal(directResponse.status, 200);

    const adapter = new GeocodingHttpAdapter({
      endpointUrl,
      extraHeaders: headers,
      minimumRequestIntervalMs: 0,
      scenario: 'success',
    });

    assert.deepEqual(await adapter.geocode('Zona ficticia'), {
      source: 'provider',
      label: 'Edificio de prueba A',
      latitude: 0,
      longitude: 0,
    });

    const rateLimited = new GeocodingHttpAdapter({
      endpointUrl,
      extraHeaders: headers,
      minimumRequestIntervalMs: 0,
      scenario: 'rate_limited',
    });
    await assert.rejects(rateLimited.geocode('Zona ficticia'), (error) => {
      assert.ok(error instanceof HttpStatusError);
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterMs, 1000);
      return true;
    });

    process.stdout.write('Live adapter check against the controlled backend: success + 429 Retry-After (1000 ms) PASS.\n');
  } finally {
    if (backend.exitCode === null) {
      backend.kill();
      await once(backend, 'exit');
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
