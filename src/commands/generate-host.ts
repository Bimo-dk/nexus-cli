import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';

type Framework = 'angular' | 'vue' | 'react';

const TEMPLATE_REPOS: Record<Framework, string> = {
  angular: 'https://github.com/Bimo-dk/nexus-host-template.git',
  vue: 'https://github.com/Bimo-dk/nexus-host-template-vue.git',
  react: 'https://github.com/Bimo-dk/nexus-host-template-react.git',
};

const HOST_NAME = /^[a-z][a-z0-9-]*$/;

export interface GenerateHostOptions {
  name?: string;
  framework?: Framework;
}

export async function generateHost(opts: GenerateHostOptions): Promise<void> {
  let name = opts.name;
  if (!name) {
    const ans = await inquirer.prompt<{ name: string }>([
      {
        type: 'input',
        name: 'name',
        message: 'Host name (kebab-case, e.g. shop-host):',
        validate: (v: string) => HOST_NAME.test(v) || 'Must be kebab-case starting with a lowercase letter',
      },
    ]);
    name = ans.name;
  } else if (!HOST_NAME.test(name)) {
    console.error(chalk.red(`x invalid host name "${name}" - must be kebab-case`));
    process.exit(1);
  }

  let framework = opts.framework;
  if (!framework) {
    const ans = await inquirer.prompt<{ framework: Framework }>([
      {
        type: 'list',
        name: 'framework',
        message: 'Host framework:',
        choices: [
          { name: 'Angular', value: 'angular' },
          { name: 'Vue 3', value: 'vue' },
          { name: 'React 18', value: 'react' },
        ],
      },
    ]);
    framework = ans.framework;
  }

  const target = path.resolve(process.cwd(), name);
  try {
    await fs.access(target);
    console.error(chalk.red(`x directory "${name}" already exists`));
    process.exit(1);
  } catch {
    /* good - doesn't exist */
  }

  const repo = TEMPLATE_REPOS[framework];
  console.log(chalk.cyan(`-> cloning ${repo} into ./${name}`));
  await runGit(['clone', '--depth', '1', repo, name]);
  await fs.rm(path.join(target, '.git'), { recursive: true, force: true });

  await substituteTemplate(target, name);

  console.log('');
  console.log(chalk.green(`+ created ./${name}`));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm run dev');
}

async function substituteTemplate(dir: string, name: string): Promise<void> {
  const candidates = [
    'package.json',
    'README.md',
    'angular.json',
    'vite.config.ts',
    'index.html',
    'src/main.ts',
    'src/main.tsx',
    'src/App.tsx',
    'src/app.vue',
  ];
  for (const file of candidates) {
    const full = path.join(dir, file);
    try {
      const content = await fs.readFile(full, 'utf8');
      const replaced = content.replace(/__HOST_NAME__/g, name);
      if (replaced !== content) await fs.writeFile(full, replaced, 'utf8');
    } catch {
      /* file may not exist - skip */
    }
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
