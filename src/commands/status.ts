import { RegistryClient, type HostConfig, type GateConfig, type RemoteConfig, type RemoteHealthStatus } from '@bimo-dk/nexus-client';
import chalk from 'chalk';

function pad(s: string, n: number): string {
  const plain = s.replace(/\[[0-9;]*m/g, '');
  if (plain.length >= n) return s;
  return s + ' '.repeat(n - plain.length);
}

function colorStatus(s?: RemoteHealthStatus): string {
  switch (s) {
    case 'healthy': return chalk.green('healthy');
    case 'degraded': return chalk.yellow('degraded');
    case 'down': return chalk.red('down');
    default: return chalk.dim('unknown');
  }
}

function makeClient(): RegistryClient {
  const registryUrl = process.env['REGISTRY_URL'] ?? 'http://localhost:3000';
  const token = process.env['NEXUS_TOKEN'];
  if (!token) {
    console.error(chalk.red('✗ NEXUS_TOKEN environment variable is required'));
    process.exit(1);
  }
  return new RegistryClient({ registryUrl, token: token! });
}

export async function status(): Promise<void> {
  const client = makeClient();

  let hosts: HostConfig[] = [];
  let gates: GateConfig[] = [];
  let remotes: RemoteConfig[] = [];

  try {
    [hosts, gates, remotes] = await Promise.all([
      client.getHosts().catch(() => [] as HostConfig[]),
      client.getGates().catch(() => [] as GateConfig[]),
      client.getRemotes(),
    ]);
  } catch (err) {
    console.error(chalk.red(`✗ Failed to fetch status: ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }

  // ── Hosts ────────────────────────────────────────────────────────────────
  console.log(chalk.bold.underline('\nHosts'));
  if (hosts.length === 0) {
    console.log(chalk.dim('  (none)'));
  } else {
    const c = {
      name: Math.max(4, ...hosts.map((h) => h.name.length)),
      framework: Math.max(9, ...hosts.map((h) => h.framework.length)),
      url: Math.max(3, ...hosts.map((h) => h.url.length)),
      gates: 6,
      enabled: 7,
    };
    console.log(chalk.bold(
      `  ${pad('NAME', c.name)}  ${pad('FRAMEWORK', c.framework)}  ${pad('URL', c.url)}  ${pad('GATES', c.gates)}  ENABLED`,
    ));
    for (const h of hosts) {
      const en = h.enabled ? chalk.green('yes') : chalk.dim('no');
      console.log(
        `  ${pad(h.name, c.name)}  ${pad(h.framework, c.framework)}  ${pad(h.url, c.url)}  ${pad(String(h.gate_count), c.gates)}  ${en}`,
      );
    }
  }

  // ── Gates ────────────────────────────────────────────────────────────────
  console.log(chalk.bold.underline('\nGates'));
  if (gates.length === 0) {
    console.log(chalk.dim('  (none)'));
  } else {
    const c = {
      name: Math.max(4, ...gates.map((g) => g.name.length)),
      domain: Math.max(6, ...gates.map((g) => g.domain.length)),
      host: Math.max(4, ...gates.map((g) => g.host.name.length)),
      enabled: 7,
    };
    console.log(chalk.bold(
      `  ${pad('NAME', c.name)}  ${pad('DOMAIN', c.domain)}  ${pad('HOST', c.host)}  ENABLED`,
    ));
    for (const g of gates) {
      const en = g.enabled ? chalk.green('yes') : chalk.dim('no');
      console.log(`  ${pad(g.name, c.name)}  ${pad(g.domain, c.domain)}  ${pad(g.host.name, c.host)}  ${en}`);
    }
  }

  // ── Remotes ───────────────────────────────────────────────────────────────
  console.log(chalk.bold.underline('\nRemotes'));
  if (remotes.length === 0) {
    console.log(chalk.dim('  (none)'));
  } else {
    const c = {
      name: Math.max(4, ...remotes.map((r) => r.name.length)),
      route: Math.max(5, ...remotes.map((r) => r.routePath.length + 1)),
      visibility: Math.max(10, ...remotes.map((r) => (r.visibility ?? 'global').length)),
      status: 8,
      enabled: 7,
    };
    console.log(chalk.bold(
      `  ${pad('NAME', c.name)}  ${pad('ROUTE', c.route)}  ${pad('VISIBILITY', c.visibility)}  ${pad('STATUS', c.status)}  ENABLED`,
    ));
    for (const r of remotes) {
      const st = colorStatus(r.healthStatus);
      const en = r.enabled ? chalk.green('yes') : chalk.dim('no');
      const vis = r.visibility ?? 'global';
      console.log(
        `  ${pad(r.name, c.name)}  ${pad('/' + r.routePath, c.route)}  ${pad(vis, c.visibility)}  ${pad(st, c.status + 10)}  ${en}`,
      );
    }
    console.log('');
    console.log(chalk.dim(`  Total: ${remotes.length}  Enabled: ${remotes.filter((r) => r.enabled).length}`));
  }
  console.log('');
}
