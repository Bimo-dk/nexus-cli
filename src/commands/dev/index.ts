import chalk from 'chalk';
import { loadConfig, resolveEnvironment, type DevRemoteConfig } from './config.js';
import { probeRemoteEntry } from './probe.js';
import { spawnDevServer, stopAll, type SpawnedDevServer } from './spawner.js';
import { startProxyServer } from './proxy-server.js';

export interface DevCommandOptions {
  config?: string;
  port?: number;
  noOpen?: boolean;
  noAutostart?: boolean;
}

export async function devCommand(opts: DevCommandOptions = {}): Promise<void> {
  const { config: cfg, path: cfgPath } = await loadConfig(opts.config);
  const env = resolveEnvironment(cfg);
  const proxyPort = opts.port ?? cfg.dev.proxyPort ?? 9000;

  console.log(chalk.bold.cyan('Bimo-Nexus dev'));
  console.log(chalk.dim(`  config:     ${cfgPath}`));
  console.log(chalk.dim(`  baseEnv:    ${cfg.dev.baseEnv} ${chalk.gray('(' + env.publicUrl + ')')}`));
  console.log(chalk.dim(`  proxyPort:  ${proxyPort}`));
  console.log('');

  const localRemotes: Record<string, number> = {};
  const spawned: SpawnedDevServer[] = [];

  for (const [name, remote] of Object.entries(cfg.dev.remotes)) {
    const status = await prepareRemote(name, remote, { autostart: !opts.noAutostart });
    if (status.spawned) spawned.push(status.spawned);
    if (status.ready) {
      localRemotes[name] = remote.port;
    }
  }

  if (Object.keys(localRemotes).length === 0) {
    console.warn(chalk.yellow('No local remotes ready — proxy will forward everything to ' + env.publicUrl));
  }
  console.log('');

  const proxy = await startProxyServer({
    port: proxyPort,
    localRemotes,
    sharedTarget: env.publicUrl,
    logRouting: cfg.dev.logRouting !== false,
  });

  printBanner(proxyPort, env.publicUrl, localRemotes);
  if (!opts.noOpen) tryOpenBrowser(`http://localhost:${proxyPort}`);

  const shutdown = async (): Promise<void> => {
    console.log('');
    console.log(chalk.yellow('Shutting down...'));
    stopAll(spawned);
    await proxy.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

interface PrepareResult {
  ready: boolean;
  spawned?: SpawnedDevServer;
}

async function prepareRemote(
  name: string,
  remote: DevRemoteConfig,
  opts: { autostart: boolean },
): Promise<PrepareResult> {
  const probe = await probeRemoteEntry(remote.port);

  if (probe.alive && probe.isRemoteEntry) {
    console.log(chalk.green(`  ✓ ${name.padEnd(20)} listening on :${remote.port} (verified federation entry)`));
    return { ready: true };
  }
  if (probe.alive && !probe.isRemoteEntry) {
    console.log(chalk.yellow(`  ⚠ ${name.padEnd(20)} port :${remote.port} is in use but not serving remoteEntry.json`));
    return { ready: true };
  }
  // Not alive
  if (!remote.autostart || !opts.autostart || !remote.path) {
    console.log(chalk.dim(`  ○ ${name.padEnd(20)} not running on :${remote.port} (autostart disabled or path missing)`));
    return { ready: false };
  }
  console.log(chalk.cyan(`  ↑ ${name.padEnd(20)} autostart npm start in ${remote.path} (port ${remote.port})`));
  const server = spawnDevServer(name, remote.path, remote.port);
  await waitForPort(remote.port, 60000).catch(() => false);
  return { ready: true, spawned: server };
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { alive } = await probeRemoteEntry(port);
    if (alive) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function printBanner(port: number, shared: string, localRemotes: Record<string, number>): void {
  const line = '─'.repeat(60);
  console.log('');
  console.log(chalk.cyan(`╭${line}`));
  console.log(chalk.cyan(`│  ${chalk.bold('Open this:')}  http://localhost:${port}`));
  console.log(chalk.cyan(`├${line}`));
  console.log(chalk.cyan(`│  Shared env: ${shared}`));
  if (Object.keys(localRemotes).length === 0) {
    console.log(chalk.cyan(`│  Local remotes: ${chalk.dim('(none)')}`));
  } else {
    console.log(chalk.cyan(`│  Local remotes:`));
    for (const [name, p] of Object.entries(localRemotes)) {
      console.log(chalk.cyan(`│    /remotes/${name.padEnd(16)} -> http://localhost:${p}`));
    }
  }
  console.log(chalk.cyan(`╰${line}`));
  console.log(chalk.dim('Press Ctrl+C to stop everything.'));
  console.log('');
}

function tryOpenBrowser(url: string): void {
  try {
    const { spawn } = require('node:child_process') as typeof import('node:child_process');
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* fine — user can open manually */
  }
}
