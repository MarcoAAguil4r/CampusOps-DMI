/** @jest-environment node */
import { spawn, ChildProcess } from 'node:child_process';
import * as http from 'node:http';

jest.setTimeout(20000);

let baseUrl: string;
let backendProcess: ChildProcess;
let counter = 0;

beforeEach(async () => {
  backendProcess = spawn(process.execPath, ['course-backend/server.mjs'], {
    env: { ...process.env, COURSE_BACKEND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await new Promise<void>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('Backend did not print its URL within 5 seconds.'));
    }, 5000);
    
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    backendProcess.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/(http:\/\/127\.0\.0\.1:\d+)/);
      if (match?.[1]) {
        baseUrl = match[1];
        finish();
      }
    });

    backendProcess.once('error', (error) => {
      finish(new Error(`Backend could not start: ${error.message}`));
    });
    
    backendProcess.once('exit', (code, signal) => {
      if (!baseUrl) {
        finish(new Error(`Backend exited before startup (code ${code}, signal ${signal}). Output: ${output}`));
      }
    });
  });
});

afterEach(async () => {
  if (backendProcess && backendProcess.pid) {
    backendProcess.kill('SIGTERM');
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
});

async function call(path: string, actor: string, body?: unknown, key?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const method = body ? 'POST' : 'GET';
    const headers: http.OutgoingHttpHeaders = {
      'Authorization': 'Bearer course-valid-token',
      'X-Course-Actor': actor,
      'Content-Type': 'application/json',
    };
    
    if (body && key) {
      headers['Idempotency-Key'] = key;
    } else if (body) {
      headers['Idempotency-Key'] = `wk3-${++counter}-${Date.now()}`;
    }

    const req = http.request(`${baseUrl}${path}`, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsedBody = data.trim() ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, body: parsedBody });
        } catch (e) {
          reject(new Error(`Failed to parse JSON from backend. Raw response: "${data}"`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('P1-403 rejects an unassigned technician action', async () => {
  const response = await call('/v1/incidents/campus-inc-001/actions', 'technician-2', { action: 'start', baseVersion: 1 });
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('forbidden');
});

test('P1-sin-efectos preserves the incident after a forbidden action', async () => {
  const denied = await call('/v1/incidents/campus-inc-001/actions', 'technician-2', { action: 'start', baseVersion: 1 });
  const incident = await call('/v1/incidents/campus-inc-001', 'coordinator-1');

  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('forbidden');
  expect(incident.status).toBe(200);
  expect(incident.body.version).toBe(1);
  expect(incident.body.status).toBe('assigned');
  expect(incident.body.payload.assignedTechnicianId).toBe('technician-1');
  expect(incident.body.payload.history).toHaveLength(0);
});

test('P1-lectura rejects a reporter who cannot view the incident', async () => {
  const response = await call('/v1/incidents/campus-inc-001', 'reporter-2');
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('forbidden');
});

test('control-positivo allows the assigned technician to start the incident', async () => {
  const response = await call('/v1/incidents/campus-inc-001/actions', 'technician-1', { action: 'start', baseVersion: 1 });
  expect(response.status).toBe(201);
});

test('P2-reasignación rejects a displaced technician and a stale coordinator update', async () => {
  const reassigned = await call('/v1/incidents/campus-inc-001/actions', 'coordinator-1', {
    action: 'assign', technicianId: 'technician-2', baseVersion: 1,
  });
  const displaced = await call('/v1/incidents/campus-inc-001/actions', 'technician-1', { action: 'start', baseVersion: 1 });
  const stale = await call('/v1/incidents/campus-inc-001/actions', 'coordinator-1', {
    action: 'prioritize', priority: 'high', baseVersion: 1,
  });
  const incident = await call('/v1/incidents/campus-inc-001', 'coordinator-1');

  expect(reassigned.status).toBe(201);
  expect(reassigned.body.incident.version).toBe(2);
  expect(displaced.status).toBe(403);
  expect(displaced.body.code).toBe('forbidden');
  expect(stale.status).toBe(409);
  expect(stale.body.code).toBe('version_conflict');
  expect(incident.status).toBe(200);
  expect(incident.body.version).toBe(2);
  expect(incident.body.payload.assignedTechnicianId).toBe('technician-2');
});