# @bimo-dk/nexus-cli

## 0.2.0

### Minor Changes

- 45d3c1e: Rewrite `bnx dev` as a proper local development orchestrator. Reads `nexus.config.json` describing environments + which remotes you want to work on locally. Auto-detects running dev-servers, autostarts those flagged `autostart: true`, runs an in-process proxy that routes local remotes to `localhost:<port>` and everything else (host, registry, /api, /ws) to the configured `baseEnv` (typically staging). Adds `bnx dev status` subcommand to inspect which remotes are running.

  Replaces the previous thin shim that delegated to a separate `nexus-proxy` install. Drop `nexus.dev.json` in favour of the new schema — old configs will not work unchanged. See README for the full schema and example session.
