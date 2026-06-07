import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { generateHost } from './generate-host.js';

interface EnvironmentDef {
  key: string;
  publicUrl: string;
  tokenEnv: string;
}

const STANDARD_ENVS: Record<string, { publicUrl: string; tokenEnv: string; label: string }> = {
  local: {
    label: 'local (docker-compose: gateway on http://localhost:8668)',
    publicUrl: 'http://localhost:8668',
    tokenEnv: 'NEXUS_TOKEN_LOCAL',
  },
  staging: {
    label: 'staging (e.g. https://nexus-staging.bimo.dk)',
    publicUrl: 'https://nexus-staging.example.com',
    tokenEnv: 'NEXUS_TOKEN_STAGING',
  },
  prod: {
    label: 'prod (e.g. https://nexus.bimo.dk)',
    publicUrl: 'https://nexus.example.com',
    tokenEnv: 'NEXUS_TOKEN_PROD',
  },
};

export async function init(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'nexus.config.json');
  if (await pathExists(configPath)) {
    console.error(chalk.red(`x ${configPath} already exists - refusing to overwrite`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('Bimo-Nexus workspace setup'));
  console.log(chalk.dim(`  cwd: ${cwd}`));
  console.log('');

  const { envChoices } = await inquirer.prompt<{ envChoices: string[] }>([
    {
      type: 'checkbox',
      name: 'envChoices',
      message: 'Which gateway stacks (environments) will you work against?',
      choices: Object.entries(STANDARD_ENVS).map(([key, info]) => ({
        name: info.label,
        value: key,
        checked: key === 'local' || key === 'staging',
      })),
      validate: (v: readonly string[]) => v.length > 0 || 'Pick at least one',
    },
  ]);

  const envs: EnvironmentDef[] = [];
  for (const key of envChoices) {
    const defaults = STANDARD_ENVS[key];
    const { publicUrl, tokenEnv } = await inquirer.prompt<{ publicUrl: string; tokenEnv: string }>([
      {
        type: 'input',
        name: 'publicUrl',
        message: `[${key}] gateway URL:`,
        default: defaults.publicUrl,
        validate: (v: string) => /^https?:\/\//.test(v) || 'Must start with http:// or https://',
      },
      {
        type: 'input',
        name: 'tokenEnv',
        message: `[${key}] env-var name that holds NEXUS_TOKEN for this stack:`,
        default: defaults.tokenEnv,
      },
    ]);
    envs.push({ key, publicUrl, tokenEnv });
  }

  const { baseEnv } = await inquirer.prompt<{ baseEnv: string }>([
    {
      type: 'list',
      name: 'baseEnv',
      message: 'Default stack for `bnx dev` (overridable with --env):',
      choices: envs.map((e) => ({ name: `${e.key} - ${e.publicUrl}`, value: e.key })),
      default: envs[0].key,
    },
  ]);

  const { scaffoldHost } = await inquirer.prompt<{ scaffoldHost: boolean }>([
    {
      type: 'confirm',
      name: 'scaffoldHost',
      message: 'Scaffold a host now? (you can run `bnx generate host` later)',
      default: true,
    },
  ]);

  if (scaffoldHost) {
    await generateHost({});
    console.log('');
  }

  await writeConfig(configPath, envs, baseEnv);
  await writeEnvExample(cwd, envs);

  console.log('');
  console.log(chalk.green('+ workspace ready'));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log('  bnx generate remote        # add a remote');
  console.log('  bnx generate component X   # add a component to a remote');
  console.log(`  bnx dev                    # serve against ${baseEnv} (override with --env)`);
}

async function writeConfig(target: string, envs: EnvironmentDef[], baseEnv: string): Promise<void> {
  const environments: Record<string, { publicUrl: string; tokenEnv: string }> = {};
  for (const e of envs) {
    environments[e.key] = { publicUrl: e.publicUrl, tokenEnv: e.tokenEnv };
  }
  const config = {
    environments,
    dev: {
      baseEnv,
      proxyPort: 9000,
      host: { mode: 'proxy' as const },
      remotes: {},
      logRouting: true,
    },
  };
  await fs.writeFile(target, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(chalk.green(`+ wrote ${path.basename(target)} (${envs.length} environment${envs.length === 1 ? '' : 's'})`));
}

async function writeEnvExample(cwd: string, envs: EnvironmentDef[]): Promise<void> {
  const target = path.join(cwd, '.env.example');
  if (await pathExists(target)) return;
  const lines: string[] = [
    '# Tokens for each gateway stack you work against.',
    '# Copy to .env and fill in real values - the .env file is gitignored.',
    '',
  ];
  for (const e of envs) {
    lines.push(`${e.tokenEnv}=`);
  }
  await fs.writeFile(target, lines.join('\n') + '\n', 'utf8');
  console.log(chalk.green('+ wrote .env.example'));
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}
