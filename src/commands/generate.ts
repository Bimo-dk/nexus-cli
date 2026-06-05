import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isValidRemoteName, isValidRoutePath } from '@bimo-dk/nexus-core';
import { RegistryClient } from '@bimo-dk/nexus-client';
import chalk from 'chalk';
import inquirer from 'inquirer';

const TEMPLATE_REPOS: Record<'angular' | 'vue' | 'react', string> = {
  angular: 'https://github.com/Bimo-dk/nexus-remote-templat.git',
  vue: 'https://github.com/Bimo-dk/nexus-remote-templat-vue.git',
  react: 'https://github.com/Bimo-dk/nexus-remote-templat-react.git',
};

export async function generateRemote(opts: { name?: string; route?: string }): Promise<void> {
  let name = opts.name;
  let route = opts.route;

  if (!name) {
    const a = await inquirer.prompt<{ name: string }>([{
      type: 'input',
      name: 'name',
      message: 'Remote name (camelCase, e.g. remoteThree):',
      validate: (v: string) => isValidRemoteName(v) || 'Must be camelCase starting with a lowercase letter',
    }]);
    name = a.name;
  } else if (!isValidRemoteName(name)) {
    console.error(chalk.red(`✗ Invalid remote name "${name}" — must be camelCase`));
    process.exit(1);
  }

  if (!route) {
    const a = await inquirer.prompt<{ route: string }>([{
      type: 'input',
      name: 'route',
      message: 'Route path (kebab-case, e.g. remote-three):',
      default: name!.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      validate: (v: string) => isValidRoutePath(v) || 'Must be kebab-case starting with a lowercase letter',
    }]);
    route = a.route;
  } else if (!isValidRoutePath(route)) {
    console.error(chalk.red(`✗ Invalid route path "${route}" — must be kebab-case`));
    process.exit(1);
  }

  // Visibility
  const visAnswer = await inquirer.prompt<{ visibility: 'global' | 'host-specific' }>([{
    type: 'list',
    name: 'visibility',
    message: 'Visibility:',
    choices: [
      { name: 'global — visible in all hosts', value: 'global' },
      { name: 'host-specific — visible only in one host', value: 'host-specific' },
    ],
  }]);

  let visibility: string = 'global';
  if (visAnswer.visibility === 'host-specific') {
    const registryUrl = process.env['REGISTRY_URL'] ?? 'http://localhost:3000';
    const token = process.env['NEXUS_TOKEN'];
    if (token) {
      try {
        const client = new RegistryClient({ registryUrl, token });
        const hosts = await client.getHosts();
        if (hosts.length > 0) {
          const hostAnswer = await inquirer.prompt<{ hostId: string }>([{
            type: 'list',
            name: 'hostId',
            message: 'Select host:',
            choices: hosts.map((h) => ({ name: `${h.name} (${h.framework})`, value: h.id })),
          }]);
          visibility = `host:${hostAnswer.hostId}`;
        } else {
          console.log(chalk.yellow('  No hosts registered; defaulting to global'));
        }
      } catch {
        console.log(chalk.yellow('  Could not fetch hosts; defaulting to global'));
      }
    } else {
      console.log(chalk.yellow('  NEXUS_TOKEN not set; defaulting to global'));
    }
  }

  // Framework
  const fwAnswer = await inquirer.prompt<{ framework: 'angular' | 'vue' | 'react' }>([{
    type: 'list',
    name: 'framework',
    message: 'Framework:',
    choices: [
      { name: 'Angular', value: 'angular' },
      { name: 'Vue 3', value: 'vue' },
      { name: 'React 18', value: 'react' },
    ],
  }]);
  const framework = fwAnswer.framework;

  const target = path.resolve(process.cwd(), name!);
  try {
    await fs.access(target);
    console.error(chalk.red(`✗ Directory "${name}" already exists`));
    process.exit(1);
  } catch {
    /* good — doesn't exist */
  }

  const repo = TEMPLATE_REPOS[framework];
  console.log(chalk.cyan(`→ Cloning ${repo} into ./${name}`));
  await runGit(['clone', '--depth', '1', repo, name!]);
  console.log(chalk.cyan(`→ Removing template's .git directory`));
  await fs.rm(path.join(target, '.git'), { recursive: true, force: true });
  console.log(chalk.cyan(`→ Substituting name=${name}, route=${route} in template files`));
  await substituteTemplate(target, name!, route!, visibility);

  console.log('');
  console.log(chalk.green(`✓ Created ./${name}`));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(`  cd ${name}`);
  console.log(`  npm install`);
  console.log(`  npm run build`);
  console.log(`  NEXUS_TOKEN=... bnx publish`);
}

async function substituteTemplate(dir: string, name: string, route: string, visibility: string): Promise<void> {
  const candidates = [
    'package.json',
    'federation.config.json',
    'README.md',
    'angular.json',
    'vite.config.ts',
    'nginx.conf',
    'index.html',
    'src/main.ts',
    'src/main.tsx',
    'src/entry.vue',
    'src/entry.tsx',
    'src/app.vue',
    'src/app.tsx',
  ];
  for (const file of candidates) {
    const full = path.join(dir, file);
    try {
      const content = await fs.readFile(full, 'utf8');
      const replaced = content
        .replace(/__REMOTE_NAME__/g, name)
        .replace(/__REMOTE_ROUTE__/g, route)
        .replace(/__REMOTE_VISIBILITY__/g, visibility);
      if (replaced !== content) {
        await fs.writeFile(full, replaced, 'utf8');
      }
    } catch {
      /* file may not exist in template — skip */
    }
  }

  if (visibility !== 'global') {
    await fs.writeFile(path.join(dir, '.nexus-visibility'), visibility, 'utf8');
  }
}

function runGit(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { stdio: 'inherit' });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(' ')} failed with exit code ${code}`));
    });
    proc.on('error', reject);
  });
}
