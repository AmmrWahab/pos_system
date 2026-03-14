// src/index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors    from 'cors';
import morgan  from 'morgan';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

import { mongoMiddleware } from './db.js';

import productRoutes     from './routes/products.js';
import serviceRoutes     from './routes/services.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes   from './routes/dashboard.js';
import reportRoutes      from './routes/reports.js';
import profileRoutes     from './routes/profiles.js';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_FILE = path.join(__dirname, '../profiles.json');
const DB_DIR        = path.join(__dirname, '../databases');

// ── Ensure databases dir + default profile ────────────────────────────────────
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

if (!fs.existsSync(PROFILES_FILE)) {
  const defaultDb = path.join(__dirname, '../nexuspos.db');
  fs.writeFileSync(PROFILES_FILE, JSON.stringify([{
    id: 'default', name: 'Default Store', storeName: 'Nexus Store',
    currency: 'USh', color: '#16a34a', dbPath: defaultDb,
    linkedTo: null, createdAt: new Date().toISOString(),
  }], null, 2));
  console.log('✅ Created default profile');
}

const app  = express();
const PORT = process.env.PORT || 5003;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5174'], 
  credentials: true 
}));
app.use(express.json());
app.use(morgan('dev'));

// MongoDB middleware (adds req.db)
app.use(mongoMiddleware);

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/profiles',     profileRoutes);
app.use('/api/products',     productRoutes);
app.use('/api/services',     serviceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/reports',      reportRoutes);

// ── Health Check Endpoint (✅ Single definition + DB test) ───────────────────
app.get('/api/health', mongoMiddleware, async (req, res) => {
  try {
    // Test actual DB connection
    await req.db.admin().ping();
    
    res.status(200).json({ 
      status: 'ok', 
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      profile: req.headers['x-profile-id'] || 'default'
    });
  } catch (error) {
    console.error('❌ Health check DB error:', error.message);
    res.status(503).json({ 
      status: 'error', 
      db: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ── API Index (list all endpoints) ──────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    profiles: '/api/profiles',
    products: '/api/products',
    services: '/api/services',
    transactions: '/api/transactions',
    dashboard: '/api/dashboard',
    reports: '/api/reports',
    health: '/api/health',
  });
});

// ── Root route for browser friendly message ─────────────────────────────────
app.get('/', (req, res) => {
  res.send('✅ NexusPOS backend is running! Visit /api/health to check API status.');
});

// ── 404 Handler (for undefined routes) ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NexusPOS API running on http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT',  async () => {
  console.log('🛑 Shutting down gracefully...');
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  process.exit(0);
});