import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import adminRoutes from './routes/admin.js';
import { db } from '../database/db.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const configuredOrigins = [process.env.APP_URL, process.env.WEB_ORIGIN]
  .filter(Boolean)
  .map((value) => { try { return new URL(value!).origin; } catch { return ''; } })
  .filter(Boolean);
const allowedOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000', ...configuredOrigins]);

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
}));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'SQLite (better-sqlite3)' });
  } catch {
    res.status(503).json({ status: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n🛡️  DocVault API Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite (${process.env.DOCVAULT_DB_PATH || 'database/data/docvault.db'})`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
