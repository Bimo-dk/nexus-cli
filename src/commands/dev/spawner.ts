import { type ChildProcess, spawn } from 'node:child_process';
import * as path from 'node:path';
import chalk from 'chalk';

export interface SpawnedDevServer {
  name: string;
  port: number;
  process: ChildProcess;
}

const colors = [chalk.cyan, chalk.magenta, chalk.green, chalk.yellow, chalk.blue, chalk.red];
let colorIdx = 0;

/**
 * Spawn `npm start` in the given path. Output is prefixed with the remote name
 * so multiple parallel dev-servers don't drown each other.
 *
 * The child process inherits the env. On Windows we spawn through `cmd` so the
 * .cmd shim for npm resolves correctly.
 */
export function spawnDevServer(name: string, cwd: string, port: number): SpawnedDevServer {
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['start'], {
    cwd: path.resolve(cwd),
    env: { ...process.env, PORT: String(port) },
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const color = colors[colorIdx++ % colors.length];
  const prefix = color(`[${name}]`);

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) if (line.trim()) console.log(`${prefix} ${line}`);
  });
  child.stderr?.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) if (line.trim()) console.error(`${prefix} ${chalk.red(line)}`);
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`${prefix} ${chalk.red(`exited with code ${code}`)}`);
  });

  return { name, port, process: child };
}

export function stopAll(servers: SpawnedDevServer[]): void {
  for (const s of servers) {
    try {
      if (!s.process.killed) {
        s.process.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
      }
    } catch {
      /* ignore */
    }
  }
}
