import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import { createRequire } from 'node:module';
import { generateRemote } from './commands/generate.js';
import { publish } from './commands/publish.js';
import { status } from './commands/status.js';
import { health } from './commands/health.js';
import { devCommand } from './commands/dev/index.js';
import { devStatusCommand } from './commands/dev/status.js';
import { listHosts, createHost, toggleHost } from './commands/hosts.js';
import { listGates, createGate } from './commands/gates.js';

// Load .env if it exists in cwd
loadEnv({ path: '.env', quiet: true });

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();
program
  .name('bnx')
  .description('Bimo-Nexus CLI — generate, publish, status, health, dev, hosts, gates')
  .version(pkg.version);

const generate = program.command('generate').description('Scaffold a new Bimo-Nexus artifact');
generate
  .command('remote')
  .description('Scaffold a new remote app from nexus-remote-templat')
  .option('-n, --name <name>', 'Remote name (camelCase)')
  .option('-r, --route <route>', 'Route path (kebab-case)')
  .action(generateRemote);

program
  .command('publish')
  .description('Publish the current remote to the registry (reads federation.config.json)')
  .action(publish);

program
  .command('status')
  .description('Print three-section table: Hosts, Gates, Remotes')
  .action(status);

program
  .command('health')
  .description('Health check all remotes and print response times')
  .action(health);

const dev = program
  .command('dev')
  .description('Start local dev environment: proxy + autostart configured remotes')
  .option('-c, --config <file>', 'Path to nexus.config.json (default: search cwd)')
  .option('-p, --port <port>', 'Override proxy port', (v: string) => Number(v))
  .option('--gate <name>', 'Act as this gate (sets NEXUS_GATE_NAME for the dev proxy)')
  .option('--no-open', 'Do not open browser')
  .option('--no-autostart', 'Do not autostart npm dev-servers for remotes')
  .action((opts) => {
    if (opts.gate) {
      process.env['NEXUS_GATE_NAME'] = opts.gate;
    }
    return devCommand(opts);
  });
dev
  .command('status')
  .description('Show which configured remotes are running locally')
  .option('-c, --config <file>', 'Path to nexus.config.json (default: search cwd)')
  .action(devStatusCommand);

// ── hosts ──────────────────────────────────────────────────────────────────
const hosts = program.command('hosts').description('Manage host shells');
hosts.command('list').description('List all registered hosts').action(listHosts);
hosts.command('create').description('Interactively create a host').action(createHost);
hosts
  .command('toggle <name>')
  .description('Toggle enabled state of a host')
  .action(toggleHost);

// ── gates ──────────────────────────────────────────────────────────────────
const gates = program.command('gates').description('Manage gates');
gates.command('list').description('List all registered gates').action(listGates);
gates.command('create').description('Interactively create a gate').action(createGate);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
