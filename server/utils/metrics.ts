import * as promClient from 'prom-client';
import { Logger } from './logger.js';
import { EnvironmentManager } from '../config/environment.js';

interface MetricsData {
  apiRequests: {
    total: number;
    byEndpoint: Record<string, number>;
    responseTimes: number[];
  };
  aiModel: {
    predictions: number;
    accuracy: number[];
    confidence: number[];
    trainingTime: number[];
    memoryUsage: number[];
  };
  trading: {
    trades: number;
    successRate: number;
    volume: number;
    profitLoss: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private logger: Logger;
  private envManager: EnvironmentManager;
  private metrics: MetricsData;
  private prometheusMetrics: any;

  // Prometheus metrics
  private httpRequestDuration!: promClient.Histogram;
  private httpRequestTotal!: promClient.Counter;
  private aiPredictionDuration!: promClient.Histogram;
  private aiPredictionAccuracy!: promClient.Gauge;
  private aiModelMemoryUsage!: promClient.Gauge;
  private tradingVolume!: promClient.Counter;
  private tradingSuccessRate!: promClient.Gauge;
  private systemMemoryUsage!: promClient.Gauge;
  private systemCpuUsage!: promClient.Gauge;
  private cacheHitRate!: promClient.Gauge;
  private errorRate!: promClient.Counter;

  private constructor() {
    this.logger = Logger.getInstance();
    this.envManager = EnvironmentManager.getInstance();
    this.metrics = this.initializeMetrics();
    this.prometheusMetrics = this.initializePrometheusMetrics();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private initializeMetrics(): MetricsData {
    return {
      apiRequests: {
        total: 0,
        byEndpoint: {},
        responseTimes: []
      },
      aiModel: {
        predictions: 0,
        accuracy: [],
        confidence: [],
        trainingTime: [],
        memoryUsage: []
      },
      trading: {
        trades: 0,
        successRate: 0,
        volume: 0,
        profitLoss: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: process.uptime(),
        errors: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      }
    };
  }

  private initializePrometheusMetrics(): any {
    // Enable Prometheus metrics collection
    promClient.collectDefaultMetrics();

    // HTTP request metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    // AI model metrics
    this.aiPredictionDuration = new promClient.Histogram({
      name: 'ai_prediction_duration_seconds',
      help: 'Duration of AI predictions in seconds',
      labelNames: ['model_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.aiPredictionAccuracy = new promClient.Gauge({
      name: 'ai_prediction_accuracy',
      help: 'Accuracy of AI predictions',
      labelNames: ['model_type']
    });

    this.aiModelMemoryUsage = new promClient.Gauge({
      name: 'ai_model_memory_usage_bytes',
      help: 'Memory usage of AI models in bytes',
      labelNames: ['model_type']
    });

    // Trading metrics
    this.tradingVolume = new promClient.Counter({
      name: 'trading_volume_total',
      help: 'Total trading volume',
      labelNames: ['symbol', 'action']
    });

    this.tradingSuccessRate = new promClient.Gauge({
      name: 'trading_success_rate',
      help: 'Trading success rate',
      labelNames: ['symbol']
    });

    // System metrics
    this.systemMemoryUsage = new promClient.Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes'
    });

    this.systemCpuUsage = new promClient.Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage'
    });

    // Cache metrics
    this.cacheHitRate = new promClient.Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage'
    });

    // Error metrics
    this.errorRate = new promClient.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'component']
    });

    return {
      httpRequestDuration: this.httpRequestDuration,
      httpRequestTotal: this.httpRequestTotal,
      aiPredictionDuration: this.aiPredictionDuration,
      aiPredictionAccuracy: this.aiPredictionAccuracy,
      aiModelMemoryUsage: this.aiModelMemoryUsage,
      tradingVolume: this.tradingVolume,
      tradingSuccessRate: this.tradingSuccessRate,
      systemMemoryUsage: this.systemMemoryUsage,
      systemCpuUsage: this.systemCpuUsage,
      cacheHitRate: this.cacheHitRate,
      errorRate: this.errorRate
    };
  }

  public recordAPIRequest(method: string, route: string, statusCode: number, duration: number): void {
    // Update internal metrics
    this.metrics.apiRequests.total++;
    this.metrics.apiRequests.responseTimes.push(duration);
    
    const endpoint = `${method} ${route}`;
    this.metrics.apiRequests.byEndpoint[endpoint] = (this.metrics.apiRequests.byEndpoint[endpoint] || 0) + 1;

    // Update Prometheus metrics
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration / 1000); // Convert to seconds

    this.httpRequestTotal
      .labels(method, route, statusCode.toString())
      .inc();

    // Log performance
    this.logger.logPerformance(`API ${method} ${route}`, duration, this.getMemoryUsage());
  }

  public recordAIModelPerformance(modelType: string, accuracy: number, confidence: number, duration: number, memoryUsage: number): void {
    // Update internal metrics
    this.metrics.aiModel.predictions++;
    this.metrics.aiModel.accuracy.push(accuracy);
    this.metrics.aiModel.confidence.push(confidence);
    this.metrics.aiModel.trainingTime.push(duration);
    this.metrics.aiModel.memoryUsage.push(memoryUsage);

    // Update Prometheus metrics
    this.aiPredictionDuration
      .labels(modelType)
      .observe(duration / 1000);

    this.aiPredictionAccuracy
      .labels(modelType)
      .set(accuracy);

    this.aiModelMemoryUsage
      .labels(modelType)
      .set(memoryUsage);

    // Log AI event
    this.logger.logAIEvent(modelType, 'prediction', confidence, {
      performance: {
        duration,
        memoryUsage
      }
    });
  }

  public recordTradingMetrics(symbol: string, action: string, amount: number, success: boolean, profitLoss: number): void {
    // Update internal metrics
    this.metrics.trading.trades++;
    this.metrics.trading.volume += amount;
    this.metrics.trading.profitLoss += profitLoss;

    // Calculate success rate
    const successfulTrades = this.metrics.trading.trades * (this.metrics.trading.successRate / 100);
    const newSuccessfulTrades = successfulTrades + (success ? 1 : 0);
    this.metrics.trading.successRate = (newSuccessfulTrades / this.metrics.trading.trades) * 100;

    // Update Prometheus metrics
    this.tradingVolume
      .labels(symbol, action)
      .inc(amount);

    this.tradingSuccessRate
      .labels(symbol)
      .set(this.metrics.trading.successRate);

    // Log trade
    this.logger.logTrade(symbol, action, amount, success, {
      trading: {
        symbol,
        action,
        amount
      }
    });
  }

  public recordSystemHealth(memoryUsage: number, cpuUsage: number): void {
    // Update internal metrics
    this.metrics.system.memoryUsage = memoryUsage;
    this.metrics.system.cpuUsage = cpuUsage;
    this.metrics.system.uptime = process.uptime();

    // Update Prometheus metrics
    this.systemMemoryUsage.set(memoryUsage);
    this.systemCpuUsage.set(cpuUsage);

    // Log system health
    this.logger.logSystemHealth('system', 'healthy', {
      memoryUsage,
      cpuUsage,
      uptime: this.metrics.system.uptime
    });
  }

  public recordCachePerformance(hits: number, misses: number): void {
    // Update internal metrics
    this.metrics.cache.hits += hits;
    this.metrics.cache.misses += misses;
    
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;

    // Update Prometheus metrics
    this.cacheHitRate.set(this.metrics.cache.hitRate);
  }

  public recordError(errorType: string, component: string, error: Error): void {
    // Update internal metrics
    this.metrics.system.errors++;

    // Update Prometheus metrics
    this.errorRate
      .labels(errorType, component)
      .inc();

    // Log error
    this.logger.error(`Error in ${component}: ${errorType}`, error, {
      error: {
        type: errorType,
        component
      }
    });
  }

  public getMetricsReport(): MetricsData {
    return {
      ...this.metrics,
      system: {
        ...this.metrics.system,
        uptime: process.uptime()
      }
    };
  }

  public async getPrometheusMetrics(): Promise<string> {
    return await promClient.register.metrics();
  }

  public getHealthStatus(): any {
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        usage: memoryUsage,
        limit: this.envManager.getConfig('ai').memoryLimit
      },
      cpu: {
        usage: cpuUsage
      },
      metrics: {
        apiRequests: this.metrics.apiRequests.total,
        aiPredictions: this.metrics.aiModel.predictions,
        trades: this.metrics.trading.trades,
        errors: this.metrics.system.errors,
        cacheHitRate: this.metrics.cache.hitRate
      }
    };
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
  }

  private getCpuUsage(): number {
    // Simple CPU usage calculation
    const startUsage = process.cpuUsage();
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
      this.metrics.system.cpuUsage = cpuUsage;
    }, 100);
    
    return this.metrics.system.cpuUsage;
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.logger.info('Metrics reset');
  }
}














