import * as net from 'node:net';

/**
 * Returns true if something is listening on the given port.
 * Uses a TCP connect with short timeout — works for any HTTP-ish dev server.
 */
export function isPortListening(port: number, host: string = 'localhost', timeoutMs: number = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const settle = (value: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    socket.once('timeout', () => settle(false));
    socket.connect(port, host);
  });
}

/**
 * Probe the remoteEntry.json on a dev-server to confirm it's actually serving
 * a federation bundle (not just any random TCP listener).
 */
export async function probeRemoteEntry(port: number): Promise<{ alive: boolean; isRemoteEntry: boolean }> {
  const alive = await isPortListening(port);
  if (!alive) return { alive: false, isRemoteEntry: false };
  try {
    const res = await fetch(`http://localhost:${port}/remoteEntry.json`, { cache: 'no-store' });
    if (!res.ok) return { alive: true, isRemoteEntry: false };
    const json = (await res.json().catch(() => null)) as unknown;
    const isRemoteEntry = typeof json === 'object' && json !== null && ('name' in json || 'exposes' in json);
    return { alive: true, isRemoteEntry };
  } catch {
    return { alive: true, isRemoteEntry: false };
  }
}
