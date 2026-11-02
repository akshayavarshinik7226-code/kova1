#!/usr/bin/env node
/**
 * KOVA container entrypoint.
 *
 * Responsibilities (one process tree, one public port):
 *   1. Start the FastAPI backend (uvicorn) on loopback.
 *   2. Serve the pre-built React SPA from KOVA_FRONTEND_DIST, with history
 *      fallback so client-side routes such as /app/overview survive a reload.
 *   3. Reverse-proxy /api/* to the FastAPI process.
 *
 * Why this exists: the platform classifies a repository that contains a Node
 * project as a Node app and requires the container start command to be Node.
 * KOVA keeps FastAPI as the API and puts this thin Node edge in front of it
 * instead of dropping either stack.
 *
 * Only Node built-ins are used, so the runtime image needs no extra packages.
 */
import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 3000);
const LISTEN_HOST = process.env.HOST || '0.0.0.0';
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

/** Start the FastAPI process. Its stdout/stderr go straight to the platform log. */
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

  const child = spawn(PYTHON, args, { cwd: BACKEND_DIR, stdio: 'inherit', env: process.env });

  child.on('error', (error) => {
    console.error(`[gateway] failed to spawn ${PYTHON}: ${error.message}`);
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
        resolve(typeof response.statusCode === 'number' && response.statusCode < 500);
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
  const remote = req.socket.remoteAddress || '';
  headers['x-forwarded-for'] = headers['x-forwarded-for']
    ? `${headers['x-forwarded-for']}, ${remote}`
    : remote;
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || 'http';
  headers['x-forwarded-host'] = headers.host || '';
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
    res.end(JSON.stringify({ detail: 'The KOVA API is unavailable. Please retry shortly.' }));
  });

  req.pipe(proxyReq);
}

async function fileInfo(target) {
  try {
    const info = await fs.stat(target);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

function sendFile(req, res, filePath, info, cacheControl) {
  res.writeHead(200, {
    'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'content-length': String(info.size),
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on('error', (error) => {
    console.error(`[gateway] read error for ${filePath}: ${error.message}`);
    res.destroy();
  });
  stream.pipe(res);
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    text(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    text(res, 400, 'Bad Request');
    return;
  }

  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(DIST, relative);

  // Never serve outside the bundle directory.
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) {
    text(res, 404, 'Not Found');
    return;
  }

  const direct = await fileInfo(candidate);
  if (direct) {
    const immutable = relative.startsWith('assets/');
    sendFile(
      req,
      res,
      candidate,
      direct,
      immutable ? 'public, max-age=31536000, immutable' : 'no-cache, no-store, must-revalidate',
    );
    return;
  }

  // A missing hashed asset is a real 404, not a client-side route.
  if (relative.startsWith('assets/') || /\.[a-z0-9]{2,8}$/i.test(relative)) {
    text(res, 404, 'Not Found');
    return;
  }

  const indexFile = path.join(DIST, 'index.html');
  const indexInfo = await fileInfo(indexFile);
  if (!indexInfo) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        detail: 'The KOVA frontend bundle was not found.',
        hint: `Expected index.html in ${DIST}. Run "npm run build" in frontend/.`,
      }),
    );
    return;
  }

  sendFile(req, res, indexFile, indexInfo, 'no-cache, no-store, must-revalidate');
}

async function handleRequest(req, res) {
  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0] || '/';

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyToApi(req, res);
    return;
  }

  try {
    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(`[gateway] static error for ${pathname}: ${error.message}`);
    if (!res.headersSent) text(res, 500, 'Internal Server Error');
    else res.destroy();
  }
}

async function main() {
  console.log(
    `[gateway] dist=${DIST} listen=${LISTEN_HOST}:${PORT} api=${API_HOST}:${API_PORT} python=${PYTHON}`,
  );

  const api = startApi();
  const ready = await waitForApi(Date.now() + API_READY_TIMEOUT_MS);
  console.log(`[gateway] FastAPI health: ${ready ? 'ready' : 'not ready (proxy will retry)'}`);

  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });

  server.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    void error;
  });

  server.listen(PORT, LISTEN_HOST, () => {
    console.log(`[gateway] listening on http://${LISTEN_HOST}:${PORT}`);
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

main().catch((error) => {
  console.error(`[gateway] fatal: ${error.stack || error.message}`);
  process.exit(1);
});
