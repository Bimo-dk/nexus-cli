import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface NexusEnvironment {
  /** Base URL to point browsers at — e.g. https://nexus-staging.bimo.dk */
  publicUrl: string;
  /** Registry API base — defaults to publicUrl + '/api' */
  registryUrl?: string;
  /** Env-var name that holds the token for this environment */
  tokenEnv?: string;
}

export type HostMode = 'proxy' | 'docker' | 'npm';

export interface DevHostConfig {
  /** 'proxy' = no local host (use baseEnv's host via proxy).
   *  'docker' = spin up ghcr.io/bimo-dk/nexus-host-template locally.
   *  'npm'   = run `npm start` in `path` (a local clone of host-template). */
  mode: HostMode;
  /** Docker image (mode=docker only) */
  image?: string;
  /** Path to local host clone (mode=npm only) */
  path?: string;
  /** Port the local host serves on (modes docker/npm only) */
  port?: number;
}

export interface DevRemoteConfig {
  /** Port the local dev-server listens on (Angular ng serve) */
  port: number;
  /** Path to the remote project (for autostart). Optional if you start it yourself. */
  path?: string;
  /** If true, bnx dev runs `npm start` in `path` when the port isn't already listening */
  autostart?: boolean;
}

export interface DevConfig {
  /** Which environment to use as "everything else" backend */
  baseEnv: string;
  /** Local proxy port (browser opens here) */
  proxyPort?: number;
  /** Local host configuration */
  host?: DevHostConfig;
  /** Remotes you want to work on locally — key is the remote name in the registry */
  remotes: Record<string, DevRemoteConfig>;
  /** If true, print every proxied request. Default true. */
  logRouting?: boolean;
}

export interface NexusConfig {
  environments: Record<string, NexusEnvironment>;
  dev: DevConfig;
}

const CONFIG_NAMES = ['nexus.config.json', '.nexusrc.json'];

export async function loadConfig(cwd: string = process.cwd()): Promise<{ config: NexusConfig; path: string }> {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(cwd, name);
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as NexusConfig;
      validate(parsed, candidate);
      return { config: parsed, path: candidate };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new Error(`[bnx dev] Failed to read ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(
    `[bnx dev] No nexus.config.json found in ${cwd}.\n` +
      `         Create one with environments + dev.remotes — see 'bnx dev --help' for the schema.`,
  );
}

function validate(cfg: NexusConfig, file: string): void {
  if (!cfg.environments || Object.keys(cfg.environments).length === 0) {
    throw new Error(`${file}: missing 'environments' map`);
  }
  if (!cfg.dev?.baseEnv) {
    throw new Error(`${file}: missing 'dev.baseEnv'`);
  }
  if (!cfg.environments[cfg.dev.baseEnv]) {
    throw new Error(`${file}: dev.baseEnv "${cfg.dev.baseEnv}" not in environments`);
  }
  if (!cfg.dev.remotes || Object.keys(cfg.dev.remotes).length === 0) {
    throw new Error(`${file}: dev.remotes is empty — add at least one remote you want to work on locally`);
  }
}

export function resolveEnvironment(cfg: NexusConfig): NexusEnvironment & { registryUrl: string } {
  const env = cfg.environments[cfg.dev.baseEnv];
  return {
    ...env,
    registryUrl: env.registryUrl ?? `${env.publicUrl.replace(/\/$/, '')}/api`,
  };
}
