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




const app  = express();
const PORT = process.env.PORT || 5003;

// ── Middleware ───────────────────────────────────────────────────────────────
// ✅ SAHI CORS Configuration
// ✅ FIXED CORS - NO SPACES, EXACT URL
app.use(cors({
    origin: function(origin, callback) {
        // ✅ Allow localhost for development
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'https://pos-frontend-7esbcuowa-ammrs-projects-5e1a603d.vercel.app',  // ✅ NO trailing slash, NO spaces
        ];
        
        // ✅ Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // ✅ Trim any accidental spaces and check
        const cleanOrigin = origin.trim();
        if (allowedOrigins.indexOf(cleanOrigin) !== -1) {
            return callback(null, true);
        }
        
        // ✅ For production testing: allow all (REMOVE after testing)
        if (process.env.NODE_ENV === 'production') {
            console.log('⚠️ CORS: Allowing origin (production mode):', cleanOrigin);
            return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-profile-id']
}));

// ✅ Add explicit OPTIONS handler for preflight requests
app.options('*', cors());

// ✅ Add explicit OPTIONS handler for preflight
app.options('*', cors());
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