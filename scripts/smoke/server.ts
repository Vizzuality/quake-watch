import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const SERVER_ENTRY = path.join(ROOT, '.output/server/index.mjs');
const PRELOAD = pathToFileURL(path.join(import.meta.dirname, 'preload.mjs')).href;
const READY_TIMEOUT_MS = 15_000;
const EXIT_TIMEOUT_MS = 3_000;

export type SmokeServer = { origin: string; process: ChildProcess };

type StartServerOptions = { fetchLog?: string };

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('No port assigned'));
      });
    });
  });
}

async function waitForServer(origin: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with ${child.exitCode}`);
    try {
      await fetch(`${origin}/favicon.ico`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server at ${origin} did not start within ${READY_TIMEOUT_MS} ms`);
}

export async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), EXIT_TIMEOUT_MS);
  await exited;
  clearTimeout(timer);
}

export async function startServer(
  upstream: 'up' | 'down',
  { fetchLog }: StartServerOptions = {},
): Promise<SmokeServer> {
  const port = await getFreePort();
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_OPTIONS: `--import ${PRELOAD}`,
      SMOKE_UPSTREAM: upstream,
      ...(fetchLog ? { SMOKE_FETCH_LOG: fetchLog } : {}),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const origin = `http://127.0.0.1:${port}`;
  let isReady = false;
  try {
    await waitForServer(origin, child);
    isReady = true;
    return { origin, process: child };
  } finally {
    if (!isReady) await stopProcess(child);
  }
}
