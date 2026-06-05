import { RegistryClient, type HostConfig } from '@bimo-dk/nexus-client';
import chalk from 'chalk';
import inquirer from 'inquirer';

function makeClient(): RegistryClient {
  const registryUrl = process.env['REGISTRY_URL'] ?? 'http://localhost:3000';
  const token = process.env['NEXUS_TOKEN'];
  if (!token) {
    console.error(chalk.red('✗ NEXUS_TOKEN environment variable is required'));
    process.exit(1);
  }
  return new RegistryClient({ registryUrl, token: token! });
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

export async function listHosts(): Promise<void> {
  const client = makeClient();
  let hosts: HostConfig[];
  try {
    hosts = await client.getHosts();
  } catch (err) {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }

  if (hosts.length === 0) {
    console.log(chalk.dim('(no hosts registered)'));
    return;
  }

  const c = {
    name: Math.max(4, ...hosts.map((h) => h.name.length)),
    fw: Math.max(9, ...hosts.map((h) => h.framework.length)),
    url: Math.max(3, ...hosts.map((h) => h.url.length)),
    gates: 6,
  };
  console.log(chalk.bold(`${pad('NAME', c.name)}  ${pad('FRAMEWORK', c.fw)}  ${pad('URL', c.url)}  ${pad('GATES', c.gates)}  ENABLED`));
  for (const h of hosts) {
    const en = h.enabled ? chalk.green('yes') : chalk.dim('no');
    console.log(`${pad(h.name, c.name)}  ${pad(h.framework, c.fw)}  ${pad(h.url, c.url)}  ${pad(String(h.gate_count), c.gates)}  ${en}`);
  }
}

export async function createHost(): Promise<void> {
  const answers = await inquirer.prompt<{
    name: string;
    url: string;
    framework: string;
    remote_entry: string;
    exposed_module: string;
  }>([
    { type: 'input', name: 'name', message: 'Host name (camelCase):' },
    { type: 'input', name: 'url', message: 'Host URL:' },
    {
      type: 'list',
      name: 'framework',
      message: 'Framework:',
      choices: ['angular', 'vue', 'react'],
    },
    { type: 'input', name: 'remote_entry', message: 'Remote entry path:', default: '/host/remoteEntry.json' },
    { type: 'input', name: 'exposed_module', message: 'Exposed module:', default: './AppShell' },
  ]);

  const client = makeClient();
  try {
    const host = await client.createHost(answers);
    console.log(chalk.green(`✓ Host "${host.name}" created (id: ${host.id})`));
  } catch (err) {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }
}

export async function toggleHost(name: string): Promise<void> {
  const client = makeClient();
  try {
    const hosts = await client.getHosts();
    const host = hosts.find((h) => h.name === name);
    if (!host) {
      console.error(chalk.red(`✗ Host "${name}" not found`));
      process.exit(1);
    }
    const updated = await client.toggleHost(host.id);
    const state = updated.enabled ? chalk.green('enabled') : chalk.dim('disabled');
    console.log(`✓ Host "${name}" is now ${state}`);
  } catch (err) {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }
}
