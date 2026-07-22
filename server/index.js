import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import sessionRoutes from './routes/sessions.js';
import registerRoutes from './routes/register.js';
import adminRoutes from './routes/admin.js';
import checkinRoutes from './routes/checkin.js';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// ── Firebase Admin ─────────────────────────────────────
const saPath = resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json');
if (existsSync(saPath) && statSync(saPath).isFile()) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(readFileSync(saPath, 'utf8'))),
  });
} else {
  console.warn('[warn] Firebase service account not found at', saPath);
  console.warn('       Auth endpoints will fail. See .env.example for setup.');
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

// ── Express ────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Behind a reverse proxy (nginx) the client IP arrives in X-Forwarded-For.
// Without this, rate limiting sees every visitor as the proxy's IP and
// throttles them all in one shared bucket.
const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10);
if (trustProxy > 0) app.set('trust proxy', trustProxy);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,   // Astro pages manage their own CSP
  crossOriginEmbedderPolicy: false,
  // Google Identity Services sign-in popup needs window.opener access;
  // helmet's default COOP `same-origin` severs it and the auth callback never fires.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

app.use(compression());

// CORS
const corsOrigins = process.env.CORS_ORIGINS;
app.use(cors(corsOrigins && corsOrigins !== '*'
  ? { origin: corsOrigins.split(',').map(o => o.trim()), credentials: true }
  : {},
));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// General rate limit
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
}));

// Stricter limit on registration
app.use('/api/sessions/:id/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REGISTER || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts' },
}));

// Request logging
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/')) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Health check ───────────────────────────────────────
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'db_error' });
  }
});

// ── API routes ─────────────────────────────────────────
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', registerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/checkin', checkinRoutes);

// ── Global error handler ───────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(`[error] ${err.stack || err.message || err}`);
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

// ── Serve Astro dist ───────────────────────────────────
const distPath = resolve(__dirname, process.env.DIST_PATH || '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: isProd ? '1d' : 0,
    etag: true,
  }));

  app.get('*', (_req, res) => {
    const fourOhFour = resolve(distPath, '404.html');
    res.status(404).sendFile(existsSync(fourOhFour) ? fourOhFour : distPath + '/index.html');
  });
}

// ── Start ──────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[sntc] Server running on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[sntc] ${signal} received, shutting down…`);
  server.close(() => {
    db.close();
    console.log('[sntc] Closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
