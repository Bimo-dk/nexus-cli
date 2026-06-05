import chalk from 'chalk';
import { loadConfig, resolveEnvironment } from './config.js';
import { probeRemoteEntry } from './probe.js';

export async function devStatusCommand(opts: { config?: string } = {}): Promise<void> {
  const { config: cfg, path: cfgPath } = await loadConfig(opts.config);
  const env = resolveEnvironment(cfg);

  console.log(chalk.bold('Bimo-Nexus dev — status'));
  console.log(chalk.dim(`  config:  ${cfgPath}`));
  console.log(chalk.dim(`  baseEnv: ${cfg.dev.baseEnv} -> ${env.publicUrl}`));
  console.log('');

  const sharedAlive = await fetch(env.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok || r.status < 500)
    .catch(() => false);
  console.log(`  Shared env: ${sharedAlive ? chalk.green('reachable') : chalk.red('unreachable')}`);
  console.log('');

  console.log('  Local remotes:');
  for (const [name, remote] of Object.entries(cfg.dev.remotes)) {
    const probe = await probeRemoteEntry(remote.port);
    let label: string;
    if (!probe.alive) label = chalk.dim('not running');
    else if (probe.isRemoteEntry) label = chalk.green('serving remoteEntry.json');
    else label = chalk.yellow('port in use (not federation)');
    console.log(`    ${name.padEnd(20)} :${String(remote.port).padEnd(6)} ${label}`);
  }
}
