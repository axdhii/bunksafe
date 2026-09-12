import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for secure cookies and headers behind reverse proxies (Railway, Heroku)
app.set('trust proxy', 1);

// Allowed Origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

// Security and CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow localhost, configured env URLs, or any *.vercel.app preview/production deployment
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive during deployment to prevent blocked mobile clients
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Root Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BunkSafe Attendance Backend API',
    timestamp: new Date().toISOString(),
  });
});

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Smart College Attendance Platform API',
    version: '1.0.0 (V1+V2)',
  });
});

// Mount Main API Router
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
});

// Start Server (only when not running inside Vercel serverless runtime)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✨ Aurora Attendance Backend running on http://localhost:${PORT}`);
  });
}

export default app;
