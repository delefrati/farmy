import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { createTranslationRoutes } from './routes/translations';
import { createGameStateRoutes } from './routes/game-state';
import { createAuthRoutes } from './routes/auth';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: unknown) => {
  console.error('Unexpected error on idle client', err);
});

// Redis connection
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err: unknown) => {
  console.error('Redis client error', err);
});

redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Database health check
app.get('/api/health/db', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: String(err) });
  }
});

// Redis health check
app.get('/api/health/redis', async (_req: Request, res: Response) => {
  try {
    const pong = await redisClient.ping();
    res.json({ status: 'ok', redis: 'connected', message: pong });
  } catch (err) {
    res.status(500).json({ status: 'error', redis: 'disconnected', error: String(err) });
  }
});

// Sample API route
app.get('/api/v1/farms', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM farms LIMIT 10');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Translation API routes
app.use('/api/v1/translations', createTranslationRoutes(pool));

// Auth routes
app.use('/api/v1/auth', createAuthRoutes(pool));

// Gameplay save sync routes
app.use('/api/v1/game-state', createGameStateRoutes(redisClient));

// Start server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(`[db]: Database URL: ${process.env.DATABASE_URL}`);
  console.log(`[redis]: Redis URL: ${process.env.REDIS_URL}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});
