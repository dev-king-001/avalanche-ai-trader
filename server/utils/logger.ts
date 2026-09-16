import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';
import { EnvironmentManager } from '../config/environment.js';

interface LogMetadata {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  modelVersion?: string;
  performance?: {
    duration: number;
    memoryUsage: number;
  };
  trading?: {
    symbol: string;
    action: string;
    amount: number;
  };
  ai?: {
    modelType: string;
    confidence: number;
    predictionType?: string;
    eventType?: string;
    timestamp?: string;
  };
  security?: {
    ip: string;
    userAgent: string;
    action: string;
  };
  error?: any;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private envManager: EnvironmentManager;

  private constructor() {
    this.envManager = EnvironmentManager.getInstance();
    this.logger = this.createLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private createLogger(): winston.Logger {
    const logConfig = this.envManager.getConfig('logging');
    const isProduction = this.envManager.isProduction();
    const isDevelopment = this.envManager.isDevelopment();

    // Ensure log directory exists
    if (!fs.existsSync(logConfig.dir)) {
      fs.mkdirSync(logConfig.dir, { recursive: true });
    }

    const transports: winston.transport[] = [];

    // Console transport for development
    if (isDevelopment) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          )
        })
      );
    }

    // File transports for production
    if (isProduction) {
      // General application logs
      transports.push(
        new DailyRotateFile({
          filename: path.join(logConfig.dir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );

      // Error logs
      transports.push(
        new DailyRotateFile({
          filename: path.join(logConfig.dir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );
    }

    return winston.createLogger({
      level: logConfig.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'ai-trading-backend' },
      transports,
      exitOnError: false
    });
  }

  private formatMessage(level: string, message: string, metadata?: LogMetadata): any {
    const baseLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: this.envManager.getNodeEnv(),
      ...metadata
    };

    return baseLog;
  }

  public info(message: string, metadata?: LogMetadata): void {
    this.logger.info(this.formatMessage('info', message, metadata));
  }

  public warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(this.formatMessage('warn', message, metadata));
  }

  public error(message: string, error?: Error, metadata?: LogMetadata): void {
    const errorMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
    this.logger.error(this.formatMessage('error', message, errorMetadata));
  }

  public debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(this.formatMessage('debug', message, metadata));
  }

  public logTrade(symbol: string, action: string, amount: number, success: boolean, metadata?: LogMetadata): void {
    const tradeMetadata = {
      ...metadata,
      trading: {
        symbol,
        action,
        amount,
        success,
        timestamp: new Date().toISOString()
      }
    };

    const message = `Trade ${action} ${amount} ${symbol} - ${success ? 'SUCCESS' : 'FAILED'}`;
    this.logger.info(this.formatMessage('info', message, tradeMetadata));
  }

  public logAIEvent(modelType: string, eventType: string, confidence: number, metadata?: LogMetadata): void {
    const aiMetadata = {
      ...metadata,
      ai: {
        modelType,
        eventType,
        confidence,
        timestamp: new Date().toISOString()
      }
    };

    const message = `AI ${modelType} ${eventType} - Confidence: ${confidence}`;
    this.logger.info(this.formatMessage('info', message, aiMetadata));
  }

  public logDeploymentEvent(version: string, status: string, metadata?: LogMetadata): void { this.logger.info(`Deployment - ${version} ${status}`, { version, status, ...metadata }); } public getLogFiles(): string[] { return []; } public async getRecentLogs(lines: number, level?: string): Promise<any[]> { return []; } public logSystemHealth(component: string, status: string, metadata?: LogMetadata): void {
    const healthMetadata = {
      ...metadata,
      system: {
        component,
        status,
        timestamp: new Date().toISOString()
      }
    };
    const message = `System Health: ${component} is ${status}`;
    this.logger.info(this.formatMessage('info', message, healthMetadata));
  }

  public logPerformance(operation: string, duration: number, memoryUsage: number, metadata?: LogMetadata): void {
    const performanceMetadata = {
      ...metadata,
      performance: {
        operation,
        duration,
        memoryUsage,
        timestamp: new Date().toISOString()
      }
    };

    const message = `Performance: ${operation} took ${duration}ms, memory: ${memoryUsage}MB`;
    this.logger.info(this.formatMessage('info', message, performanceMetadata));
  }

  public logSecurity(action: string, ip: string, userAgent: string, success: boolean, metadata?: LogMetadata): void {
    const securityMetadata = {
      ...metadata,
      security: {
        action,
        ip,
        userAgent,
        success,
        timestamp: new Date().toISOString()
      }
    };

    const message = `Security: ${action} from ${ip} - ${success ? 'SUCCESS' : 'FAILED'}`;
    this.logger.warn(this.formatMessage('warn', message, securityMetadata));
  }
}
