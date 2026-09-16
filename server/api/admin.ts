import express from 'express';
import { Logger } from '../utils/logger.js';
import { MetricsCollector } from '../utils/metrics.js';
import { ModelVersionManager } from '../libs/modelVersioning.js';
import { CacheManager } from '../utils/cache.js';
import { AISystem } from '../libs/aiSystem/index.js';
import { EnvironmentManager } from '../config/environment.js';

const router = express.Router();
const logger = Logger.getInstance();
const metrics = MetricsCollector.getInstance();
const modelManager = ModelVersionManager.getInstance();
const cache = CacheManager.getInstance();
const aiSystem = AISystem.getInstance();
const envManager = EnvironmentManager.getInstance();

// Authentication middleware
const authenticateAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminApiKey = envManager.getConfig('security').adminApiKey;
  
  if (!adminApiKey) {
    return res.status(500).json({ error: 'Admin API key not configured' });
  }

  const providedKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  
  if (providedKey !== adminApiKey) {
    logger.logSecurity('admin_access', req.ip || 'unknown', req.get('User-Agent') || 'unknown', false);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  logger.logSecurity('admin_access', req.ip || 'unknown', req.get('User-Agent') || 'unknown', true);
  next();
};

// Apply authentication to all admin routes
router.use(authenticateAdmin);

/**
 * GET /api/admin/health
 * Get detailed system health status
 */
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get system metrics
    const systemMetrics = metrics.getHealthStatus();
    const cacheStats = await cache.getCacheStats();
    const modelStatus = modelManager.getModelStatus();
    const aiStatus = aiSystem.getProductionStatus();
    
    // Check external dependencies
    const redisHealth = cache.isReady();
    const aiSystemHealth = aiSystem.getSystemState().isInitialized;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: envManager.getNodeEnv(),
      components: {
        aiSystem: {
          status: aiSystemHealth ? 'healthy' : 'unhealthy',
          streaming: aiStatus.streamingEnabled,
          bufferSize: aiStatus.bufferSize,
          memoryUsage: aiStatus.memoryUsage
        },
        cache: {
          status: redisHealth ? 'healthy' : 'unhealthy',
          hitRate: cacheStats.hitRate,
          totalKeys: cacheStats.totalKeys
        },
        models: {
          status: 'healthy',
          activeModels: modelStatus.activeModels,
          testingModels: modelStatus.testingModels,
          activeABTests: modelStatus.activeABTests
        },
        metrics: {
          status: 'healthy',
          apiRequests: systemMetrics.metrics.apiRequests,
          aiPredictions: systemMetrics.metrics.aiPredictions,
          trades: systemMetrics.metrics.trades,
          errors: systemMetrics.metrics.errors
        }
      },
      performance: {
        responseTime: Date.now() - startTime,
        memoryUsage: systemMetrics.memory.usage,
        memoryLimit: systemMetrics.memory.limit
      }
    };

    // Determine overall health
    const allHealthy = healthStatus.components.aiSystem.status === 'healthy' &&
                      healthStatus.components.cache.status === 'healthy' &&
                      healthStatus.components.models.status === 'healthy' &&
                      healthStatus.components.metrics.status === 'healthy';

    healthStatus.status = allHealthy ? 'healthy' : 'degraded';

    res.json(healthStatus);
  } catch (error) {
    logger.error('Failed to get system health', error as Error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to retrieve system health',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/metrics
 * Get Prometheus metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const prometheusMetrics = metrics.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to get metrics', error as Error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/admin/metrics/json
 * Get metrics in JSON format
 */
router.get('/metrics/json', async (req, res) => {
  try {
    const metricsReport = metrics.getMetricsReport();
    const cacheStats = await cache.getCacheStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: metricsReport,
      cache: cacheStats,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    });
  } catch (error) {
    logger.error('Failed to get metrics report', error as Error);
    res.status(500).json({ error: 'Failed to retrieve metrics report' });
  }
});

/**
 * GET /api/admin/models
 * Get model information and management
 */
router.get('/models', async (req, res) => {
  try {
    const { modelType } = req.query;
    
    const models = modelManager.getModelVersions(modelType as string);
    const abTests = modelManager.getABTests();
    const status = modelManager.getModelStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      models,
      abTests,
      status
    });
  } catch (error) {
    logger.error('Failed to get model information', error as Error);
    res.status(500).json({ error: 'Failed to retrieve model information' });
  }
});

/**
 * POST /api/admin/models/deploy
 * Deploy a new model
 */
router.post('/models/deploy', async (req, res) => {
  try {
    const { modelData, version, modelType, metadata } = req.body;
    
    if (!modelData || !version || !modelType) {
      return res.status(400).json({ error: 'Missing required fields: modelData, version, modelType' });
    }
    
    const deployedModel = await modelManager.deployModel(modelData, version, modelType, metadata);
    
    logger.logDeploymentEvent(version, 'deploy', {
      modelType,
      performance: deployedModel.performance as any
    });
    
    res.json({
      success: true,
      model: deployedModel,
      message: `Model ${version} deployed successfully`
    });
  } catch (error) {
    logger.error('Failed to deploy model', error as Error);
    res.status(500).json({ error: 'Failed to deploy model' });
  }
});

/**
 * POST /api/admin/models/ab-test
 * Create an A/B test
 */
router.post('/models/ab-test', async (req, res) => {
  try {
    const { modelA, modelB, trafficSplit } = req.body;
    
    if (!modelA || !modelB) {
      return res.status(400).json({ error: 'Missing required fields: modelA, modelB' });
    }
    
    const abTest = await modelManager.createABTest(modelA, modelB, trafficSplit || 50);
    
    res.json({
      success: true,
      abTest,
      message: `A/B test created successfully`
    });
  } catch (error) {
    logger.error('Failed to create A/B test', error as Error);
    res.status(500).json({ error: 'Failed to create A/B test' });
  }
});

/**
 * POST /api/admin/models/promote
 * Promote a model to production
 */
router.post('/models/promote', async (req, res) => {
  try {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: 'Missing required field: version' });
    }
    
    await modelManager.promoteModel(version);
    
    res.json({
      success: true,
      message: `Model ${version} promoted to production`
    });
  } catch (error) {
    logger.error('Failed to promote model', error as Error);
    res.status(500).json({ error: 'Failed to promote model' });
  }
});

/**
 * POST /api/admin/models/rollback
 * Rollback to a previous model version
 */
router.post('/models/rollback', async (req, res) => {
  try {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: 'Missing required field: version' });
    }
    
    await modelManager.rollbackModel(version);
    
    res.json({
      success: true,
      message: `Rolled back to model ${version}`
    });
  } catch (error) {
    logger.error('Failed to rollback model', error as Error);
    res.status(500).json({ error: 'Failed to rollback model' });
  }
});

/**
 * GET /api/admin/cache
 * Get cache information and management
 */
router.get('/cache', async (req, res) => {
  try {
    const cacheStats = await cache.getCacheStats();
    const cacheHealth = cache.isReady();
    
    res.json({
      timestamp: new Date().toISOString(),
      status: cacheHealth ? 'healthy' : 'unhealthy',
      stats: cacheStats,
      configuration: {
        url: envManager.getConfig('redis').url,
        ttl: envManager.getConfig('redis').ttl,
        enabled: envManager.getConfig('optimization').cacheEnabled
      }
    });
  } catch (error) {
    logger.error('Failed to get cache information', error as Error);
    res.status(500).json({ error: 'Failed to retrieve cache information' });
  }
});

/**
 * POST /api/admin/cache/invalidate
 * Invalidate cache by pattern
 */
router.post('/cache/invalidate', async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (!pattern) {
      return res.status(400).json({ error: 'Missing required field: pattern' });
    }
    
    const invalidatedCount = await cache.invalidateCache(pattern);
    
    res.json({
      success: true,
      invalidatedCount,
      message: `Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`
    });
  } catch (error) {
    logger.error('Failed to invalidate cache', error as Error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * POST /api/admin/system/optimize
 * Trigger system optimization
 */
router.post('/system/optimize', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Trigger memory optimization
    await aiSystem.optimizeMemoryUsage();
    
    // Trigger cache warming
    await cache.warmCache();
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      duration,
      message: 'System optimization completed',
      optimizations: ['memory_cleanup', 'cache_warming']
    });
  } catch (error) {
    logger.error('Failed to optimize system', error as Error);
    res.status(500).json({ error: 'Failed to optimize system' });
  }
});

/**
 * POST /api/admin/system/restart
 * Restart AI system components
 */
router.post('/system/restart', async (req, res) => {
  try {
    const { component } = req.body;
    
    switch (component) {
      case 'ai':
        // Restart AI system
        await aiSystem.disableStreaming();
        await aiSystem.initialize();
        break;
      case 'cache':
        // Reconnect cache
        await cache.connect();
        break;
      case 'monitoring':
        // Restart monitoring
        aiSystem.stopPerformanceMonitoring();
        aiSystem.startPerformanceMonitoring();
        break;
      default:
        return res.status(400).json({ error: 'Invalid component specified' });
    }
    
    res.json({
      success: true,
      message: `${component} component restarted successfully`
    });
  } catch (error) {
    logger.error('Failed to restart system component', error as Error);
    res.status(500).json({ error: 'Failed to restart system component' });
  }
});

/**
 * GET /api/admin/logs
 * Get recent logs (with security controls)
 */
router.get('/logs', async (req, res) => {
  try {
    const { lines = 100, level } = req.query;
    
    // In production, you might want to implement proper log retrieval
    // For now, we'll return a summary
    const logSummary = {
      timestamp: new Date().toISOString(),
      availableLogs: logger.getLogFiles(),
      recentLogs: logger.getRecentLogs(parseInt(lines as string)),
      logLevel: envManager.getConfig('logging').level
    };
    
    res.json(logSummary);
  } catch (error) {
    logger.error('Failed to get logs', error as Error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

export { router as adminRouter };






