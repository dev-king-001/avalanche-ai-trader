import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.js';
import { EnvironmentManager } from '../config/environment.js';

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private client: RedisClientType;
  private logger: Logger;
  private metrics: MetricsCollector;
  private envManager: EnvironmentManager;
  private isConnected: boolean = false;
  private stats: CacheStats;

  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = MetricsCollector.getInstance();
    this.envManager = EnvironmentManager.getInstance();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0
    };
    this.client = this.createRedisClient();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private createRedisClient(): RedisClientType {
    const redisConfig = this.envManager.getConfig('redis');
    
    const client = createClient({
      url: redisConfig.url,
      password: redisConfig.password,
      database: redisConfig.db,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on('connect', () => {
      this.logger.info('Redis client connected');
      this.isConnected = true;
    });

    client.on('error', (error) => {
      this.logger.error('Redis client error', error);
      this.isConnected = false;
    });

    return client as unknown as RedisClientType;
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        this.logger.info('Cache manager connected to Redis');
      } catch (error) {
        this.logger.error('Failed to connect to Redis', error as Error);
        throw error;
      }
    }
  }

  public async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Cache not connected, skipping set operation');
      return;
    }

    try {
      const ttl = options.ttl || this.envManager.getConfig('redis').ttl;
      const prefixedKey = this.getPrefixedKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);

      await this.client.setEx(prefixedKey, ttl, serializedValue);
      this.updateStats();
    } catch (error) {
      this.logger.error('Failed to set cache value', error as Error);
    }
  }

  public async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isConnected) {
      this.stats.misses++;
      return null;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key, options.prefix);
      const value = await this.client.get(prefixedKey);

      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      this.logger.error('Failed to get cache value', error as Error);
      return null;
    } finally {
      this.updateStats();
    }
  }

  public async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key, options.prefix);
      const result = await this.client.del(prefixedKey);
      this.updateStats();
      return result > 0;
    } catch (error) {
      this.logger.error('Failed to delete cache value', error as Error);
      return false;
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key, options.prefix);
      const result = await this.client.exists(prefixedKey);
      return result > 0;
    } catch (error) {
      this.logger.error('Failed to check cache existence', error as Error);
      return false;
    }
  }

  public async cacheAIPrediction(prediction: any, features: any): Promise<void> {
    const featureHash = this.generateFeatureHash(features);
    const cacheKey = `ai_prediction:${featureHash}`;
    
    await this.set(cacheKey, {
      prediction,
      features,
      timestamp: new Date().toISOString()
    }, { ttl: 3600 });
  }

  public async getCachedPrediction(features: any): Promise<any | null> {
    const featureHash = this.generateFeatureHash(features);
    const cacheKey = `ai_prediction:${featureHash}`;
    
    const cached = await this.get(cacheKey);
    if (cached && this.isPredictionValid(cached)) {
      return cached.prediction;
    }
    
    return null;
  }

  public async cacheMarketData(data: any, symbol: string, timeframe: string = '1h'): Promise<void> {
    const cacheKey = `market_data:${symbol}:${timeframe}`;
    
    await this.set(cacheKey, {
      data,
      symbol,
      timeframe,
      timestamp: new Date().toISOString()
    }, { ttl: 300 });
  }

  public async getCachedMarketData(symbol: string, timeframe: string = '1h'): Promise<any | null> {
    const cacheKey = `market_data:${symbol}:${timeframe}`;
    
    const cached = await this.get(cacheKey);
    if (cached && this.isMarketDataValid(cached)) {
      return cached.data;
    }
    
    return null;
  }

  public async invalidateCache(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        this.logger.info(`Invalidated ${result} cache keys matching pattern: ${pattern}`);
        this.updateStats();
        return result;
      }
      return 0;
    } catch (error) {
      this.logger.error('Failed to invalidate cache', error as Error);
      return 0;
    }
  }

  public async getCacheStats(): Promise<CacheStats> {
    if (!this.isConnected) {
      return this.stats;
    }

    try {
      const total = this.stats.hits + this.stats.misses;
      this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

      this.metrics.recordCachePerformance(this.stats.hits, this.stats.misses);

      return { ...this.stats };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error as Error);
      return this.stats;
    }
  }

  private getPrefixedKey(key: string, prefix?: string): string {
    const defaultPrefix = 'ai_trading';
    const finalPrefix = prefix || defaultPrefix;
    return `${finalPrefix}:${key}`;
  }

  private generateFeatureHash(features: any): string {
    const featureString = JSON.stringify(features);
    return crypto.createHash('md5').update(featureString).digest('hex');
  }

  private isPredictionValid(cached: any): boolean {
    const cacheTime = new Date(cached.timestamp);
    const now = new Date();
    const ageInMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
    return ageInMinutes < 60;
  }

  private isMarketDataValid(cached: any): boolean {
    const cacheTime = new Date(cached.timestamp);
    const now = new Date();
    const ageInMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
    return ageInMinutes < 5;
  }

  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Warm cache (for backward compatibility)
   */
  async warmCache(): Promise<void> {
    this.logger.info('Cache warming completed (placeholder)');
  }
}
