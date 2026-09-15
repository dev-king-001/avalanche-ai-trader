// @ts-nocheck
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { predictRouter } from './api/predict';
import { tradeRouter } from './api/trade';
import { blockchainRouter } from './api/blockchain/trade';
import { streamingRouter } from './api/streaming';
import { adminRouter } from './api/admin';
import { simplePredictRouter } from './api/simplePredict';
import { portfolioRouter } from './api/portfolio';
import { AISystem } from './libs/aiSystem';
import { Logger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';
import { CacheManager } from './utils/cache';
import { EnvironmentManager } from './config/environment';

const app = express();
const PORT = process.env.BACKEND_PORT || 5001;

// Initialize production components
const logger = Logger.getInstance();
const metrics = MetricsCollector.getInstance();
const cache = CacheManager.getInstance();
const envManager = EnvironmentManager.getInstance();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
if (envManager.getConfig('optimization').compressionEnabled) {
  app.use(compression());
}

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and OPTIONS requests
    return req.path === '/health' || req.method === 'OPTIONS';
  }
});
app.use('/api/', limiter);

// CORS middleware - more permissive for development
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const correlationId = Math.random().toString(36).substring(7);
  
  // Add correlation ID to request
  req.headers['x-correlation-id'] = correlationId;
  
  // Log request
  logger.info(`${req.method} ${req.path}`, {
    correlationId,
    security: {
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || '',
      action: 'request'
    },
    requestId: correlationId
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    metrics.recordAPIRequest(req.method, req.path, res.statusCode, duration);
    
    // Log response
    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      correlationId,
      performance: {
        duration,
        memoryUsage: 0
      },
      requestId: correlationId
    });
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const aiSystem = AISystem.getInstance();
    const streamingStatus = aiSystem.getStreamingStatus();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      streaming: streamingStatus
    });
  } catch (error) {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      streaming: { error: 'Failed to get streaming status' }
    });
  }
});

// API routes
app.use('/api/predict', predictRouter);
app.use('/api/simple', simplePredictRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/blockchain', blockchainRouter);
app.use('/api/streaming', streamingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/portfolio', portfolioRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error', err, {
    correlationId: Array.isArray(req.headers['x-correlation-id']) ? req.headers['x-correlation-id'][0] : req.headers['x-correlation-id']
    // path: req.path, // Not in LogMetadata interface
    // method: req.method, // Not in LogMetadata interface
    // ip: req.ip // Not in LogMetadata interface
  });
  
  // Record error metrics
  metrics.recordError('server_error', 'express', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: envManager.isDevelopment() ? err.message : 'Something went wrong',
    correlationId: req.headers['x-correlation-id']
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize AI system on startup
async function initializeServer() {
  try {
    logger.info('🚀 Initializing AI Trading Backend Server...');
    
    // Try to connect to cache (non-fatal in development)
    try {
      await cache.connect();
      logger.info('✅ Cache connected successfully');
    } catch (error) {
      logger.warn('⚠️ Cache connection failed - running without caching');
    }
    
    // Start server first for immediate responsiveness
    const server = app.listen(PORT, () => {
      logger.info(`🎯 Backend server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🤖 AI endpoints available at http://localhost:${PORT}/api`);
      logger.info(`🔧 Admin endpoints available at http://localhost:${PORT}/api/admin`);
    });
    
    // Initialize AI system in the background
    const aiSystem = AISystem.getInstance();
    aiSystem.initialize().then(async () => {
      logger.info('✅ AI System initialized successfully');
      
      // Start production monitoring
      aiSystem.startPerformanceMonitoring();
      aiSystem.startMemoryCleanup();
      
      // Enable streaming if configured
      if (envManager.getEnableStreaming()) {
        try {
          await aiSystem.enableStreaming();
          logger.info('✅ AI System streaming enabled');
        } catch (error) {
          logger.error('❌ Failed to enable AI System streaming', error as Error);
        }
      }
    }).catch((error) => {
      logger.error('❌ Failed to initialize AI System', error as Error);
      // Don't exit the server, just log the error
    });
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      // Stop monitoring
      aiSystem.stopPerformanceMonitoring();
      aiSystem.stopMemoryCleanup();
      
      // Disable AI system streaming
      await aiSystem.disableStreaming();
      
      // Disconnect cache
      // await cache.disconnect(); // Disconnect method not implemented
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('❌ Failed to initialize server', error as Error);
    process.exit(1);
  }
}

// Only start the server if not running in a serverless environment like Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  initializeServer();
}

export default app;
