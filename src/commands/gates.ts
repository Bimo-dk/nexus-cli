import { RegistryClient, type GateConfig } from '@bimo-dk/nexus-client';
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

export async function listGates(): Promise<void> {
  const client = makeClient();
  let gates: GateConfig[];
  try {
    gates = await client.getGates();
  } catch (err) {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }

  if (gates.length === 0) {
    console.log(chalk.dim('(no gates registered)'));
    return;
  }

  const c = {
    name: Math.max(4, ...gates.map((g) => g.name.length)),
    domain: Math.max(6, ...gates.map((g) => g.domain.length)),
    host: Math.max(4, ...gates.map((g) => g.host.name.length)),
  };
  console.log(chalk.bold(`${pad('NAME', c.name)}  ${pad('DOMAIN', c.domain)}  ${pad('HOST', c.host)}  ENABLED`));
  for (const g of gates) {
    const en = g.enabled ? chalk.green('yes') : chalk.dim('no');
    console.log(`${pad(g.name, c.name)}  ${pad(g.domain, c.domain)}  ${pad(g.host.name, c.host)}  ${en}`);
  }
}

export async function createGate(): Promise<void> {
  const client = makeClient();

  let hosts: Awaited<ReturnType<typeof client.getHosts>> = [];
  try {
    hosts = await client.getHosts();
  } catch {
    /* show empty selection if registry unreachable */
  }

  const answers = await inquirer.prompt<{ name: string; domain: string; host_id: string }>([
    { type: 'input', name: 'name', message: 'Gate name:' },
    { type: 'input', name: 'domain', message: 'Domain (e.g. checkout.example.com):' },
    {
      type: 'list',
      name: 'host_id',
      message: 'Host:',
      choices: hosts.length > 0
        ? hosts.map((h) => ({ name: `${h.name} (${h.framework})`, value: h.id }))
        : [{ name: '(no hosts — enter ID manually)', value: '' }],
    },
  ]);

  if (!answers.host_id) {
    const manual = await inquirer.prompt<{ host_id: string }>([
      { type: 'input', name: 'host_id', message: 'Host ID:' },
    ]);
    answers.host_id = manual.host_id;
  }

  try {
    const gate = await client.createGate(answers);
    console.log(chalk.green(`✓ Gate "${gate.name}" created (id: ${gate.id})`));
  } catch (err) {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }
}
