import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RegistryClient, RegistryError } from '@bimo-dk/nexus-client';
import chalk from 'chalk';

interface FederationConfig {
  name: string;
  exposes?: Record<string, string>;
}

export async function publish(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'federation.config.json');

  let config: FederationConfig;
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8')) as FederationConfig;
  } catch {
    console.error(chalk.red(`✗ Cannot read ${configPath}`));
    console.error(chalk.dim('  Did you run "npm run build" first?'));
    process.exit(1);
  }

  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3000';
  const token = process.env.NEXUS_TOKEN;
  if (!token) {
    console.error(chalk.red('✗ NEXUS_TOKEN environment variable is required'));
    process.exit(1);
  }

  const remoteUrl = process.env.REMOTE_URL ?? `/remotes/${config.name}/remoteEntry.json`;
  const exposedModule = config.exposes ? Object.keys(config.exposes)[0] ?? './RemoteEntry' : './RemoteEntry';
  const routePath = process.env.REMOTE_ROUTE ?? config.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  const client = new RegistryClient({ registryUrl, token });

  console.log(chalk.cyan(`�ae� Publishing "${config.name}" to ${registryUrl}/api/remotes`));
  console.log(chalk.dim(`  url=${remoteUrl} route=${routePath} exposedModule=${exposedModule}`));

  try {
    const created = await client.addRemote({
      name: config.name,
      url: remoteUrl,
      exposedModule,
      routePath,
      enabled: true,
    });
    console.log(chalk.green(`✓ Registered "${created.name}"`));
  } catch (err) {
    if (err instanceof RegistryError && err.statusCode === 409) {
      console.log(chalk.yellow('  Remote already exists — updating via PUT...'));
      try {
        const updated = await client.updateRemote(config.name, {
          url: remoteUrl,
          exposedModule,
          routePath,
          enabled: true,
        });
        console.log(chalk.green(`✓ Updated "${updated.name}"`));
        return;
      } catch (putErr) {
        printError(putErr);
        process.exit(1);
      }
    }
    printError(err);
    process.exit(1);
  }
}

function printError(err: unknown): void {
  if (err instanceof RegistryError) {
    console.error(chalk.red(`✗ ${err.message}`));
    if (err.correlationId) console.error(chalk.dim(`  correlationId=${err.correlationId}`));
  } else {
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
  }
}
