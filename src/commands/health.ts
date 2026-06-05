import { RegistryClient, type HealthStatus } from '@bimo-dk/nexus-client';
import chalk from 'chalk';

export async function health(): Promise<void> {
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3000';
  const token = process.env.NEXUS_TOKEN;
  if (!token) {
    console.error(chalk.red('✗ NEXUS_TOKEN environment variable is required'));
    process.exit(1);
  }

  const client = new RegistryClient({ registryUrl, token });
  const remotes = await client.getRemotes();
  if (remotes.length === 0) {
    console.log(chalk.dim('(no remotes registered)'));
    return;
  }

  console.log(chalk.bold(`Health check for ${remotes.length} remote(s):\n`));

  const results = await Promise.all(remotes.map(async (r) => {
    const h = await client.checkHealth(r.url);
    return { name: r.name, url: r.url, health: h };
  }));

  for (const r of results) {
    const icon = r.health.status === 'ok' ? chalk.green('●') : chalk.red('●');
    const rt = r.health.responseTimeMs !== undefined ? chalk.dim(`${r.health.responseTimeMs.toFixed(0)}ms`) : '';
    console.log(`  ${icon} ${pad(r.name, 24)}  ${pad(r.health.status, 6)}  ${rt}`);
  }
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}
