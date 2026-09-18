import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'https://bunk-safe.vercel.app',
  'https://bunksafe-app.vercel.app',
  'https://bunksafe-nine.vercel.app',
  'https://bunksafe.vercel.app',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

const isOriginAllowed = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  // Allow all Vercel deployment preview and production domains for this project
  if (/^https:\/\/bunk.*\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/.*bunksafe.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

// Security headers (SEC-9: hardened CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'http://localhost:*', 'ws://localhost:*', 'https://*.vercel.app', ...allowedOrigins],
        workerSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration (SEC-1: strict origin checking in production)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // In production, match explicitly configured domains or verified project hosts
      if (
        isOriginAllowed(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// General API rate limiting: 300 requests per 5 minutes per IP (DoS protection)
const apiGeneralLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api', apiGeneralLimiter);

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
