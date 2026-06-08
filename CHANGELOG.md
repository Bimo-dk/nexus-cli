# @bimo-dk/nexus-cli

## 1.0.0

### Major Changes

- First stable release. The CLI surface is now: `bnx init`, `bnx generate host`, `bnx generate remote`, `bnx generate component`, `bnx publish`, `bnx dev --env <stack>`, `bnx dev status`, `bnx status`, `bnx health`, `bnx hosts`, `bnx gates`.

  Highlights since 0.2:
  - `bnx init` — bootstraps an empty directory into a working workspace with `nexus.config.json` (multi-stack: local, staging, prod, custom) and `.env.example` listing every required token env-var. Optionally scaffolds a host inline.
  - `bnx generate host` — was missing in 0.x. Clones `nexus-host-template-{angular,vue,react}`, substitutes `__HOST_NAME__` placeholders, and prints next steps.
  - `bnx generate component <Name>` — writes a `defineNexusComponent`-annotated file straight into `src/`. Framework autodetected from the host's `package.json`. Pairs with `nexusViteAuto()` and the Angular `@NexusComponent` scanner so adding a new component is one file edit, not a Vite-config edit.
  - `bnx dev --env <name>` — picks which gateway stack each session targets. Same workspace can develop against `local` (docker-compose), `staging`, and `prod` with separate token env-vars.
  - `bnx publish` — reads `dist/catalog.json` after publish and reports how many catalog entries the build produced so the developer sees their component metadata made it into the artifact.

### License

- Relicensed from MIT to GNU Affero General Public License v3.0 or any later version (AGPL-3.0-or-later). A commercial license is available for organisations that cannot adopt AGPL — contact svp@bimo.dk.

## 0.2.0

### Minor Changes

- 45d3c1e: Rewrite `bnx dev` as a proper local development orchestrator. Reads `nexus.config.json` describing environments + which remotes you want to work on locally. Auto-detects running dev-servers, autostarts those flagged `autostart: true`, runs an in-process proxy that routes local remotes to `localhost:<port>` and everything else (host, registry, /api, /ws) to the configured `baseEnv` (typically staging). Adds `bnx dev status` subcommand to inspect which remotes are running.

  Replaces the previous thin shim that delegated to a separate `nexus-proxy` install. Drop `nexus.dev.json` in favour of the new schema — old configs will not work unchanged. See README for the full schema and example session.
