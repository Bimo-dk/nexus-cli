import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import { createRequire } from 'node:module';
import { generateRemote } from './commands/generate.js';
import { generateComponent } from './commands/generate-component.js';
import { generateHost } from './commands/generate-host.js';
import { init } from './commands/init.js';
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

program
  .command('init')
  .description('Bootstrap a new Nexus workspace: nexus.config.json + .env.example + optional host scaffold')
  .action(init);

const generate = program.command('generate').description('Scaffold a new Bimo-Nexus artifact');
generate
  .command('remote')
  .description('Scaffold a new remote app from nexus-remote-templat')
  .option('-n, --name <name>', 'Remote name (camelCase)')
  .option('-r, --route <route>', 'Route path (kebab-case)')
  .action(generateRemote);

generate
  .command('host')
  .description('Scaffold a new host app from nexus-host-template (Angular/Vue/React)')
  .option('-n, --name <name>', 'Host name (kebab-case)')
  .option('-f, --framework <fw>', 'angular | vue | react')
  .action(generateHost);

generate
  .command('component <name>')
  .description('Scaffold a defineNexusComponent file inside the current remote (PascalCase name)')
  .option('-f, --framework <fw>', 'angular | vue | react (autodetected from package.json)')
  .option('-c, --category <category>', 'Catalog category')
  .option('-d, --description <text>', 'One-line catalog description')
  .option('-t, --tags <csv>', 'Comma-separated catalog tags')
  .option('-o, --out-dir <dir>', 'Output directory (default: src)')
  .action((name: string, opts) => generateComponent(name, opts));

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
  .option('-e, --env <name>', 'Override dev.baseEnv from nexus.config.json (pick which gateway stack to target)')
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
