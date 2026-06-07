import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';

type Framework = 'angular' | 'vue' | 'react';

interface GenerateComponentOptions {
  framework?: Framework;
  category?: string;
  description?: string;
  tags?: string;
  outDir?: string;
}

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

export async function generateComponent(rawName: string, opts: GenerateComponentOptions): Promise<void> {
  const name = rawName?.trim();
  if (!name || !PASCAL_CASE.test(name)) {
    console.error(chalk.red(`x invalid component name "${rawName}" - must be PascalCase (e.g. "Cart")`));
    process.exit(1);
  }

  const cwd = process.cwd();
  const framework = opts.framework ?? (await detectFramework(cwd));
  if (!framework) {
    const ans = await inquirer.prompt<{ framework: Framework }>([
      {
        type: 'list',
        name: 'framework',
        message: 'Framework not detected from package.json - pick one:',
        choices: [
          { name: 'Vue 3', value: 'vue' },
          { name: 'React 18', value: 'react' },
          { name: 'Angular', value: 'angular' },
        ],
      },
    ]);
    return generateComponent(name, { ...opts, framework: ans.framework });
  }

  const outDir = path.resolve(cwd, opts.outDir ?? 'src');
  await fs.mkdir(outDir, { recursive: true });

  const tags = (opts.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const description = opts.description?.trim();
  const category = opts.category?.trim();

  const { file, contents } = renderComponent(framework, name, { description, category, tags });
  const target = path.join(outDir, file);

  if (await pathExists(target)) {
    console.error(chalk.red(`x ${path.relative(cwd, target)} already exists - delete it or pick another name`));
    process.exit(1);
  }
  await fs.writeFile(target, contents, 'utf8');

  console.log(chalk.green(`+ wrote ${path.relative(cwd, target)}`));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log('  npm run build');
  console.log('  bnx publish');
}

interface RenderedFile {
  file: string;
  contents: string;
}

interface ComponentMeta {
  description?: string;
  category?: string;
  tags: string[];
}

function renderComponent(framework: Framework, name: string, meta: ComponentMeta): RenderedFile {
  const metaLiteral = renderMetaLiteral(name, meta);
  if (framework === 'vue') return { file: `${name}.vue`, contents: vueSfc(name, metaLiteral) };
  if (framework === 'react') return { file: `${name}.tsx`, contents: reactComponent(name, metaLiteral) };
  return { file: `${kebabCase(name)}.component.ts`, contents: angularComponent(name, meta) };
}

function renderMetaLiteral(name: string, meta: ComponentMeta): string {
  const lines: string[] = [`    title: '${name}',`];
  if (meta.description) lines.push(`    description: '${escapeQuote(meta.description)}',`);
  if (meta.category) lines.push(`    category: '${escapeQuote(meta.category)}',`);
  if (meta.tags.length > 0) {
    lines.push(`    tags: [${meta.tags.map((t) => `'${escapeQuote(t)}'`).join(', ')}],`);
  } else {
    lines.push(`    tags: [],`);
  }
  return `{\n${lines.join('\n')}\n  }`;
}

function vueSfc(name: string, metaLiteral: string): string {
  return `<script lang="ts" setup>
// Vue 3 single-file component. Export the wrapped component so
// nexusViteAuto() picks it up at build time.
</script>

<template>
  <div class="${kebabCase(name)}">
    <h2>${name}</h2>
    <p>Replace this with your component.</p>
  </div>
</template>

<style scoped>
.${kebabCase(name)} {
  padding: 1rem;
}
</style>

<script lang="ts">
import { defineComponent } from 'vue';
import { defineNexusComponent } from '@bimo-dk/nexus-build';

export default defineNexusComponent(
  ${metaLiteral},
  defineComponent({
    name: '${name}',
  }),
);
</script>
`;
}

function reactComponent(name: string, metaLiteral: string): string {
  return `import { defineNexusComponent } from '@bimo-dk/nexus-build';

export const ${name} = defineNexusComponent(
  ${metaLiteral},
  function ${name}(): JSX.Element {
    return (
      <div className="${kebabCase(name)}">
        <h2>${name}</h2>
        <p>Replace this with your component.</p>
      </div>
    );
  },
);
`;
}

function angularComponent(name: string, meta: ComponentMeta): string {
  const selector = `app-${kebabCase(name)}`;
  const metaLines: string[] = [`  title: '${name}',`];
  if (meta.description) metaLines.push(`  description: '${escapeQuote(meta.description)}',`);
  if (meta.category) metaLines.push(`  category: '${escapeQuote(meta.category)}',`);
  if (meta.tags.length > 0) {
    metaLines.push(`  tags: [${meta.tags.map((t) => `'${escapeQuote(t)}'`).join(', ')}],`);
  } else {
    metaLines.push(`  tags: [],`);
  }
  return `import { Component } from '@angular/core';
import { NexusComponent, NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote()
@NexusComponent({
${metaLines.join('\n')}
})
@Component({
  standalone: true,
  selector: '${selector}',
  template: \`
    <div class="${kebabCase(name)}">
      <h2>${name}</h2>
      <p>Replace this with your component.</p>
    </div>
  \`,
})
export default class ${name}Component {}
`;
}

function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function escapeQuote(s: string): string {
  return s.replace(/'/g, "\\'");
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function detectFramework(cwd: string): Promise<Framework | undefined> {
  try {
    const raw = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps['@angular/core']) return 'angular';
    if (deps['vue']) return 'vue';
    if (deps['react']) return 'react';
    return undefined;
  } catch {
    return undefined;
  }
}
