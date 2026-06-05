import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import chalk from 'chalk';

export interface ProxyServerOptions {
  port: number;
  /** Remote name -> local port (e.g. { remoteOne: 4201 }) */
  localRemotes: Record<string, number>;
  /** Where to forward everything that isn't a local remote */
  sharedTarget: string;
  logRouting: boolean;
}

export interface RunningProxy {
  server: Server;
  port: number;
  close: () => Promise<void>;
}

const ARROW = '->';

export async function startProxyServer(options: ProxyServerOptions): Promise<RunningProxy> {
  const { port, localRemotes, sharedTarget: rawShared, logRouting } = options;
  const sharedTarget = rawShared.replace(/\/$/, '');
  const app = express();

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nexus-Token, X-Request-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  for (const [name, localPort] of Object.entries(localRemotes)) {
    const target = `http://localhost:${localPort}`;
    const route = `/remotes/${name}`;
    const localProxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      pathRewrite: { [`^/remotes/${name}`]: '' },
      on: {
        error: (err: Error, _req: IncomingMessage, res: ServerResponse | Socket) => {
          if (logRouting) {
            console.error(chalk.red(`[bnx dev] LOCAL ${name} unreachable at ${target}: ${err.message}`));
          }
          const httpRes = res as ServerResponse;
          if (httpRes && !httpRes.headersSent && typeof httpRes.writeHead === 'function') {
            httpRes.writeHead(502, { 'Content-Type': 'application/json' });
            httpRes.end(JSON.stringify({ error: 'local_remote_unreachable', remote: name, target, message: err.message }));
          }
        },
      },
    });
    app.use(route, (req, res, next) => {
      if (logRouting) console.log(chalk.cyan(`[bnx dev] ${req.method.padEnd(6)} ${req.url.padEnd(40)} ${ARROW} LOCAL ${name}`));
      localProxy(req, res, next);
    });
  }

  const sharedProxy = createProxyMiddleware({
    target: sharedTarget,
    changeOrigin: true,
    ws: true,
    on: {
      error: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => {
        if (logRouting) {
          console.error(chalk.red(`[bnx dev] SHARED ${sharedTarget} unreachable: ${err.message}`));
        }
        const httpRes = res as ServerResponse;
        if (httpRes && !httpRes.headersSent && typeof httpRes.writeHead === 'function') {
          httpRes.writeHead(502, { 'Content-Type': 'application/json' });
          httpRes.end(JSON.stringify({
            error: 'shared_environment_unreachable',
            target: sharedTarget,
            message: err.message,
            path: req.url,
          }));
        }
      },
    },
  });

  app.use((req, res, next) => {
    if (logRouting) console.log(chalk.dim(`[bnx dev] ${req.method.padEnd(6)} ${req.url.padEnd(40)} ${ARROW} SHARED`));
    sharedProxy(req, res, next);
  });

  return new Promise<RunningProxy>((resolve) => {
    const server = app.listen(port, () => {
      server.on('upgrade', (req, socket, head) => {
        sharedProxy.upgrade?.(req, socket as Socket, head);
      });
      const close = (): Promise<void> => new Promise((resolveClose) => server.close(() => resolveClose()));
      resolve({ server, port, close });
    });
  });
}
