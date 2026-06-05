# @bimo-dk/nexus-cli

`bnx` — command-line tool for Bimo-Nexus.

## Installation

```bash
npm install -g @bimo-dk/nexus-cli
```

## Commands

| Command | Description |
|---|---|
| `bnx generate remote` | Scaffold a new remote (interactive prompts) |
| `bnx publish` | Register the current remote with the registry |
| `bnx status` | Table of all remotes |
| `bnx health` | Health check all remotes with response times |
| `bnx dev` | Start local dev environment (proxy + autostart configured remotes) |
| `bnx dev status` | Show which configured remotes are running locally |
| `bnx --version` | Version |

## Local dev workflow (`bnx dev`)

`bnx dev` orchestrates a local development environment that:

1. Reads `nexus.config.json` from the current directory
2. Detects which of your configured remotes are already running on localhost
3. Autostarts any with `autostart: true` that aren't running yet (runs `npm start` in the configured `path`)
4. Spins up a proxy on `proxyPort` that:
   - Routes `/remotes/<name>/*` to your local dev server for any remote you're working on
   - Routes everything else (host, registry, /api, /ws) to the `baseEnv` URL (typically staging)
5. Opens your browser at the proxy URL

You see the full application — but the remotes you're working on are served from your local Angular dev server (with HMR), while host/registry/other remotes come from staging. Nothing you do affects the shared environment.

### `nexus.config.json` schema

```jsonc
{
  "environments": {
    "staging": {
      "publicUrl": "https://nexus-staging.bimo.dk",
      "registryUrl": "https://nexus-staging.bimo.dk/api",   // optional, defaults to publicUrl + /api
      "tokenEnv": "NEXUS_STAGING_TOKEN"                     // optional, name of env-var with the token
    },
    "prod": {
      "publicUrl": "https://nexus.bimo.dk",
      "tokenEnv": "NEXUS_PROD_TOKEN"
    }
  },
  "dev": {
    "baseEnv": "staging",
    "proxyPort": 9000,
    "host": {
      "mode": "proxy"            // 'proxy' (default), 'docker', 'npm' — only 'proxy' is implemented today
    },
    "remotes": {
      "checkout": {
        "port": 4201,
        "path": "./packages/checkout",
        "autostart": true
      },
      "orders": {
        "port": 4202,
        "path": "./packages/orders",
        "autostart": false       // user starts this one themselves
      }
    },
    "logRouting": true
  }
}
```

### Example session

```bash
$ bnx dev
Bimo-Nexus dev
  config:     /work/myapp/nexus.config.json
  baseEnv:    staging (https://nexus-staging.bimo.dk)
  proxyPort:  9000

  ✓ checkout         listening on :4201 (verified federation entry)
  ↑ orders           autostart npm start in ./packages/orders (port 4202)
  ✓ orders           listening on :4202 (verified federation entry)

╭────────────────────────────────────────────────────────────
│  Open this:  http://localhost:9000
├────────────────────────────────────────────────────────────
│  Shared env: https://nexus-staging.bimo.dk
│  Local remotes:
│    /remotes/checkout         -> http://localhost:4201
│    /remotes/orders           -> http://localhost:4202
╰────────────────────────────────────────────────────────────
Press Ctrl+C to stop everything.
```

Ctrl+C stops the proxy AND any dev-servers it autostarted.

### Options

```
bnx dev [options]
  -c, --config <file>   Path to nexus.config.json (default: search cwd)
  -p, --port <port>     Override proxy port
  --no-open             Do not open browser
  --no-autostart        Do not autostart npm dev-servers (manual mode)
```

### Status check

```bash
$ bnx dev status
Bimo-Nexus dev — status
  config:  /work/myapp/nexus.config.json
  baseEnv: staging -> https://nexus-staging.bimo.dk

  Shared env: reachable

  Local remotes:
    checkout            :4201   serving remoteEntry.json
    orders              :4202   not running
```

## Environment variables (publish/status/health commands)

- `NEXUS_TOKEN` — required for publish/status/health
- `REGISTRY_URL` — default `http://localhost:3000`
- `REMOTE_URL` — URL that gets published (default `/remotes/<name>/remoteEntry.json`)
- `REMOTE_ROUTE` — override of route (default derived from name)

Loaded automatically from `.env` in cwd.

## Scaffolding example

```bash
# 1. Scaffold
bnx generate remote
? Remote name: checkout
? Route path: checkout

# 2. Build
cd checkout && npm install && npm run build

# 3. Publish
export NEXUS_TOKEN=your-secret
export REGISTRY_URL=http://localhost:3000
bnx publish
# -> ✓ Registered "checkout"

# 4. Verify
bnx status
```
