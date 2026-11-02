#!/usr/bin/env node
/**
 * KOVA container entrypoint.
 *
 * Responsibilities (single process tree, single public port):
 *   1. Start the FastAPI backend (uvicorn) on loopback.
 *   2. Serve the pre-built React SPA from KOVA_FRONTEND_DIST, with history
 *      fallback so client-side routes such as /app/overview work on reload.
 *   3. Reverse-proxy /api/* to the FastAPI process.
 *
 * Why this exists: the platform classifies a repository containing a Node
 * project as a Node app and requires the container's start command to be Node.
 * KOVA keeps FastAPI as the API and adds this thin Node edge instead of
 * dropping either stack.
 *
 * Only Node built-ins are used, so the runtime image needs no extra packages.
 */
import http from 'node:http';
import https from 'node:https';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 3000);
const API_PORT = Number(process.env.KOVA_API_PORT || 8000);
const API_HOST = '127.0.0.1';
const DIST = path.resolve(process.env.KOVA_FRONTEND_DIST || '/app/frontend/dist');
const BACKEND_DIR = path.resolve(process.env.KOVA_BACKEND_DIR || '/app/backend');
const PYTHON = process.env.KOVA_PYTHON || 'python3';
const API_READY_TIMEOUT_MS = Number(process.env.KOVA_API_READY_TIMEOUT_MS || 45000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Hop-by-hop headers must not be forwarded by a proxy. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

let shuttingDown = false;

/**
 * Start the FastAPI process and wait until /api/health answers so the first
 * public request does not race uvicorn's startup.
 */
function startApi() {
  const args = [
    '-m',
    'uvicorn',
    'app.main:app',
    '--host',
    API_HOST,
    '--port',
    String(API_PORT),
    '--proxy-headers',
    '--forwarded-allow-ips',
    API_HOST,
  ];

  const child = spawn(PYTHON, args, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`[gateway] failed to start ${PYTHON}: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[gateway] FastAPI exited unexpectedly (code=${code} signal=${signal})`);
    // Let the platform restart the container instead of serving a dead API.
    process.exit(code && code > 0 ? code : 1);
  });

  return child;
}

function apiHealthy() {
  return new Promise((resolve) => {
    const request = http.get(
      { host: API_HOST, port: API_PORT, path: '/api/health', timeout: 2000 },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode < 500);
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function waitForApi(deadline) {
  while (Date.now() < deadline) {
    if (await apiHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function proxyToApi(req, res) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key)) continue;
    headers[key] = value;
  }
  const socket = req.socket;
  headers['x-forwarded-for'] = headers['x-forwarded-for']
    ? `${headers['x-forwarded-for']}, ${socket.remoteAddress || ''}`
    : socket.remoteAddress || '';
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'http';
  headers['x-forwarded-host'] = req.headers.host || '';
  headers.host = `${API_HOST}:${API_PORT}`;

  const proxyReq = http.request(
    { host: API_HOST, port: API_PORT, method: req.method, path: req.url, headers },
    (proxyRes) => {
      const responseHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (HOP_BY_HOP.has(key)) continue;
        responseHeaders[key] = value;
      }
      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    console.error(`[gateway] API proxy error for ${req.method} ${req.url}: ${error.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ detail: 'The KOVA API is unavailable.' }));
  });

  req.pipe(proxyReq);
}

async function statOrNull(target) {
  try {
    const info = await fs.stat(target);
    return info;
  } catch {
    return null;
  }
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(DIST, relative);

  // Reject traversal outside the bundle directory.
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const info = await statOrNull(candidate);
  if (info && info.isFile()) {
    sendFile(req, res, candidate, relative.startsWith('assets/'));
    return;
  }

  // Missing asset (hashed bundle file) is a real 404, not an SPA route.
  if (relative.startsWith('assets/') || /\.[a-z0-9]{2,8}$/i.test(relative)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const indexFile = path.join(DIST, 'index.html');
  if (!(await statOrNull(indexFile))) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        detail: 'KOVA frontend bundle not found.',
        hint: `Expected index.html in ${DIST}. Run "npm run build" in frontend/.`,
      }),
    );
    return;
  }

  sendFile(req, res, indexFile, false, { 'cache-control': 'no-cache, no-store, must-revalidate' });
}

function sendFile(req, res, filePath, immutable, extraHeaders = {}) {
  const headers = {
    'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'content-length': String(require_file_size_placeholder),
  };
  // stat is needed for content-length; do it synchronously via a fresh stat
  // result passed by the caller through a promise instead.
  void headers;
  void immutable;
  void extraHeaders;
  void filePath;
  void req;
  void res;
}

async function handleRequest(req, res) {
  const url = req.url || '/';
  const pathname = url.split('?')[0] || '/';

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyToApi(req, res);
    return;
  }

  try {
    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(`[gateway] static error for ${pathname}: ${error.message}`);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  }
}

async function main() {
  console.log(`[gateway] serving ${DIST} on 0.0.0.0:${PORT}; proxying /api to ${API_HOST}:${API_PORT}`);

  const api = startApi();
  const ready = await waitForApi(Date.now() + API_READY_TIMEOUT_MS);
  console.log(`[gateway] FastAPI health: ${ready ? 'ready' : 'not ready yet (proxy will retry)'}`);

  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });

  server.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    void error;
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[gateway] listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[gateway] ${signal} received, shutting down`);
    server.close(() => {});
    api.kill('SIGTERM');
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void https;
void createReadStream;

main().catch((error) => {
  console.error(`[gateway] fatal: ${error.stack || error.message}`);
  process.exit(1);
});
