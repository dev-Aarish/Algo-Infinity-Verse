import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeFirebase } from '../firebase.js';
import { setupApiRoutes } from './routes/apiRoutes.js';
import { getSession, clearSessionCookie } from './utils/sessionToken.js';
import { readUsers } from './utils/helpers.js';
import securityConfig from './config/security.js';
import { protectedPaths } from './config/protectedPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

// ── Rate limiting ────────────────────────────────────────────────────────────

const signupAttempts = new Map();

// Periodic sweeper — runs every SIGNUP_WINDOW_MS and deletes any identifier
// whose timestamps have all aged out of the window.  This bounds the Map to
// only identifiers that have been active within the last window period and
// prevents unbounded memory growth under a sustained stream of unique IPs.
const _signupSweeper = setInterval(() => {
  const now = Date.now();
  for (const [identifier, timestamps] of signupAttempts) {
    const fresh = timestamps.filter((t) => now - t < securityConfig.SIGNUP_WINDOW_MS);
    if (fresh.length === 0) {
      signupAttempts.delete(identifier);
    } else {
      signupAttempts.set(identifier, fresh);
    }
  }
}, securityConfig.SIGNUP_WINDOW_MS);

// Allow the process to exit cleanly even while the interval is live
// (relevant in test environments and graceful-shutdown scenarios).
if (_signupSweeper.unref) _signupSweeper.unref();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.php': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

async function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

let db = null;
let useFirestore = false;

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function normalizePathname(pathname) {
  if (!pathname) return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isProtectedRoute(pathname) {
  return protectedPaths.has(pathname);
}

async function authorizeRequest(req, pathname) {
  if (!isProtectedRoute(pathname)) {
    return { authorized: true };
  }

  const session = getSession(req);

  if (!session) {
    return {
      authorized: false,
      redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
    };
  }

  if (!useFirestore && !String(session.sub).startsWith('guest-')) {
    const users = await readUsers();

    const user = users.find((u) => u.id === session.sub);

    if (!user || user.isDeactivated) {
      return {
        authorized: false,
        redirectTo: '/login',
      };
    }
  }

  return {
    authorized: true,
    session,
  };
}

function validateRequest(req) {
  const allowedMethods = ['GET', 'POST'];

  if (!allowedMethods.includes(req.method)) {
    return {
      valid: false,
      status: 405,
      message: 'Method not allowed.',
    };
  }

  return { valid: true };
}

function resolveStaticPath(pathname) {
  const routes = {
    '/': 'index.html',
    '/login': 'login.html',
    '/signup': 'signup.html',
    '/community': 'community.html',
    '/python-learning': 'python-learning.html',
    '/javascript-learning': 'javascript-learning.html',
    '/dbms-learning': 'dbms-learning.html',
    '/powerbi-learning': 'powerbi-learning.html',
    '/cplusplus-learning': 'cplusplus-learning.html',
    '/learning/php': 'php-learning.html',
    '/php-learning': 'php-learning.html',
    '/learning/oop': 'oop-learning.html',
    '/oop-learning': 'oop-learning.html',
    '/feedback': 'feedback.html',
    '/feedback.html': 'feedback.html',
    '/memory-scanner': 'memory-scanner.html',
    '/memory-scanner.html': 'memory-scanner.html',
    '/algorithm-timeline': 'algorithm-timeline.html',
    '/support-page': 'support-page/index.html',
    '/support-page/': 'support-page/index.html',
  };
  let mapped = routes[pathname];
  if (!mapped) {
    const basePath = pathname.slice(1);
    mapped = path.extname(basePath) ? basePath : basePath + '.html';
  }
  const filePath = path.resolve(ROOT, mapped);
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;

  // ── Arbitrary File Disclosure Prevention ──────────────────────────────────
  const fileName = path.basename(filePath);

  // 1. Block hidden files and sensitive directories
  if (
    fileName.startsWith('.') ||
    rel.startsWith('data' + path.sep) ||
    rel.startsWith('api' + path.sep) ||
    rel.startsWith('node_modules' + path.sep)
  ) {
    return null;
  }

  // 2. Block specific sensitive root files
  const sensitiveFiles = [
    'server.js',
    'firebase.js',
    'package.json',
    'package-lock.json',
    'vercel.json',
  ];
  if (sensitiveFiles.includes(fileName)) {
    return null;
  }

  // 3. Extension whitelist (only serve files with known mime types)
  const ext = path.extname(filePath);
  if (!mimeTypes[ext]) {
    return null;
  }
  // ──────────────────────────────────────────────────────────────────────────

  return filePath;
}

async function serveStatic(req, res, pathname) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const stat = await fs.stat(filePath);
    const target = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(target);
    const content = await fs.readFile(target);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = normalizePathname(decodeURIComponent(url.pathname));

    const requestValidation = validateRequest(req);

    if (!requestValidation.valid) {
      return sendJson(res, requestValidation.status, {
        error: requestValidation.message,
      });
    }
    if (pathname.startsWith('/api/')) {
      const routeResult = setupApiRoutes(req, res, pathname);
      if (routeResult !== null) {
        return routeResult;
      }
      return sendJson(res, 404, { error: 'Not found.' });
    }

    if (pathname === '/logout') {
      return redirect(res, '/login', { 'Set-Cookie': clearSessionCookie() });
    }

    const authorization = await authorizeRequest(req, pathname);

    if (!authorization.authorized) {
      return redirect(res, authorization.redirectTo);
    }

    return await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Something went wrong.' });
  }
});

export { server };
if (process.env.VERCEL === '1') {
  db = initializeFirebase();
  useFirestore = !!db;
}

if (process.env.VERCEL !== '1') {
  loadEnvFile()
    .then(() => {
      db = initializeFirebase();
      useFirestore = !!db;
      const port = Number(process.env.PORT || 3000);
      const host = process.env.HOST || '127.0.0.1';

      server.listen(port, host, () => {});
    })
    .catch((error) => {
      console.error('Failed to load environment configuration:', error);
      process.exit(1);
    });
}
