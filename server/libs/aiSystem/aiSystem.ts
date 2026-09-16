import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';
import { CacheManager } from '../../utils/cache.js';
import { EnvironmentManager } from '../../config/environment.js';
import { collectMarketData } from '../dataCollection/index.js';
import { Web3Server } from '../web3Server.js';
import { ServerLSTMPredictor } from './lstmModel.js';
import { QLearningAgent } from './qLearningAgent.js';
import { PredictionResult, ModelState } from './types.js';

/**
 * Main AI System Implementation
 * Orchestrates LSTM and Q-Learning models for comprehensive predictions
 */

export class AISystem {
  private static instance: AISystem;
  private lstmPredictor: ServerLSTMPredictor;
  private rlAgent: QLearningAgent;
  private isInitialized: boolean = false;
  private lastTrainingTime: number = 0;
  private totalPredictions: number = 0;
  private averageAccuracy: number = 0;
  private oraclePublishInterval: NodeJS.Timeout | null = null;
  private modelVersion: string = '1.0.0';
  
  private logger = Logger.getInstance();
  private cache = CacheManager.getInstance();
  private envManager = EnvironmentManager.getInstance();

  private constructor() {
    this.lstmPredictor = new ServerLSTMPredictor();
    this.rlAgent = new QLearningAgent();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AISystem {
    if (!AISystem.instance) {
      AISystem.instance = new AISystem();
    }
    return AISystem.instance;
  }

  /**
   * Initialize the AI system
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AI system', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'initialization_start',
          amount: 0
        }
      });

      // Load pre-trained models if available
      await this.loadModels();
      
      // If no models available, train with initial data
      if (!this.isInitialized) {
        await this.trainWithInitialData();
      }
      
      this.isInitialized = true;
      
      this.logger.info('AI system initialized successfully', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'initialization_complete',
          amount: 1
        }
      });

    } catch (error) {
      this.logger.error('AI system initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Train models with initial market data
   */
  private async trainWithInitialData(): Promise<void> {
    try {
      this.logger.info('Training models with initial data', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'initial_training_start',
          amount: 0
        }
      });

      // Collect market data
      const marketData = await collectMarketData(['pangolin', 'coingecko'], { hours: 168 }); // 1 week
      const prices = marketData.map(d => d.price);
      
      if (prices.length < 100) {
        throw new Error('Insufficient data for training');
      }

      // Train LSTM model
      await this.lstmPredictor.train(prices);
      
      // Train Q-Learning agent
      await this.rlAgent.train(prices, 500); // Reduced episodes for faster training
      
      this.lastTrainingTime = Date.now();
      this.isInitialized = true;
      
      this.logger.info('Initial model training completed', {
        performance: {
          duration: 0,
          memoryUsage: prices.length
        },
        trading: {
          symbol: 'ai_system',
          action: 'initial_training_complete',
          amount: prices.length
        }
      });

    } catch (error) {
      this.logger.error('Initial model training failed', error as Error);
      throw error;
    }
  }

  /**
   * Make comprehensive prediction using both models
   */
  async predict(data: number[]): Promise<PredictionResult> {
    if (!this.isInitialized) {
      throw new Error('AI system not initialized');
    }

    try {
      this.totalPredictions++;
      
      // Get predictions from both models
      const [lstmPrediction, rlPrediction] = await Promise.all([
        this.lstmPredictor.predict(data),
        this.rlAgent.predict(data)
      ]);
      
      // Combine predictions (weighted average)
      const lstmWeight = 0.7;
      const rlWeight = 0.3;
      
      const combinedPrice = (lstmPrediction.price * lstmWeight) + (rlPrediction.price * rlWeight);
      const combinedConfidence = (lstmPrediction.confidence * lstmWeight) + (rlPrediction.confidence * rlWeight);
      
      // Determine direction based on combined prediction
      const currentPrice = data[data.length - 1];
      const direction = combinedPrice > currentPrice * 1.001 ? 'up' : 
                       combinedPrice < currentPrice * 0.999 ? 'down' : 'neutral';
      
      const result: PredictionResult = {
        price: combinedPrice,
        direction,
        confidence: Math.min(combinedConfidence, 0.95),
        timestamp: Date.now(),
        modelType: 'ensemble',
        features: data.slice(-20) // Last 20 data points
      };
      
      // Update average accuracy (simplified)
      this.averageAccuracy = (this.averageAccuracy * (this.totalPredictions - 1) + result.confidence) / this.totalPredictions;
      
      this.logger.debug('AI prediction completed', {
        performance: {
          duration: 0,
          memoryUsage: data.length
        },
        trading: {
          symbol: 'ai_system',
          action: 'prediction',
          amount: this.totalPredictions
        }
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('AI prediction failed', error as Error);
      throw error;
    }
  }

  /**
   * Retrain models with new data
   */
  async retrain(): Promise<void> {
    try {
      this.logger.info('Starting model retraining', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'retraining_start',
          amount: 0
        }
      });

      // Collect fresh market data
      const marketData = await collectMarketData(['pangolin', 'coingecko'], { hours: 168 });
      const prices = marketData.map(d => d.price);
      
      if (prices.length < 100) {
        throw new Error('Insufficient data for retraining');
      }

      // Retrain both models
      await Promise.all([
        this.lstmPredictor.train(prices),
        this.rlAgent.train(prices, 1000)
      ]);
      
      this.lastTrainingTime = Date.now();
      
      this.logger.info('Model retraining completed', {
        performance: {
          duration: 0,
          memoryUsage: prices.length
        },
        trading: {
          symbol: 'ai_system',
          action: 'retraining_complete',
          amount: prices.length
        }
      });

    } catch (error) {
      this.logger.error('Model retraining failed', error as Error);
      throw error;
    }
  }

  /**
   * Get system state
   */
  getSystemState(): ModelState {
    return {
      isInitialized: this.isInitialized,
      lastTrainingTime: this.lastTrainingTime,
      totalPredictions: this.totalPredictions,
      averageAccuracy: this.averageAccuracy,
      modelVersion: this.modelVersion
    };
  }

  /**
   * Get production status (for backward compatibility)
   */
  getProductionStatus(): { status: string; isReady: boolean; streamingEnabled: boolean; bufferSize: number; memoryUsage: number } {
    return {
      status: this.isInitialized ? 'ready' : 'initializing',
      isReady: this.isInitialized,
      streamingEnabled: false,
      bufferSize: 0,
      memoryUsage: 0
    };
  }

  /**
   * Get status (for backward compatibility)
   */
  getStatus(): { status: string; isReady: boolean; lstmReady: boolean; rlReady: boolean; initialized: boolean } {
    return {
      status: this.isInitialized ? 'ready' : 'initializing',
      isReady: this.isInitialized,
      lstmReady: this.isInitialized,
      rlReady: this.isInitialized,
      initialized: this.isInitialized
    };
  }

  /**
   * Get streaming status (for backward compatibility)
   */
  getStreamingStatus(): { isActive: boolean; status: string; enabled: boolean; bufferSize: number; lastUpdate: number } {
    return {
      isActive: false,
      status: 'disabled',
      enabled: false,
      bufferSize: 0,
      lastUpdate: Date.now()
    };
  }

  /**
   * Enable streaming (for backward compatibility)
   */
  async enableStreaming(): Promise<void> {
    this.logger.info('Streaming enabled (placeholder)');
  }

  /**
   * Disable streaming (for backward compatibility)
   */
  async disableStreaming(): Promise<void> {
    this.logger.info('Streaming disabled (placeholder)');
  }

  /**
   * Get decision (for backward compatibility)
   */
  getDecision(features: number[], portfolioRatio: number): { action: string; confidence: number } {
    return {
      action: 'hold',
      confidence: 0.5
    };
  }

  /**
   * Start performance monitoring (for backward compatibility)
   */
  startPerformanceMonitoring(): void {
    this.logger.info('Performance monitoring started (placeholder)');
  }

  /**
   * Stop performance monitoring (for backward compatibility)
   */
  stopPerformanceMonitoring(): void {
    this.logger.info('Performance monitoring stopped (placeholder)');
  }

  /**
   * Start memory cleanup (for backward compatibility)
   */
  startMemoryCleanup(): void {
    this.logger.info('Memory cleanup started (placeholder)');
  }

  /**
   * Stop memory cleanup (for backward compatibility)
   */
  stopMemoryCleanup(): void {
    this.logger.info('Memory cleanup stopped (placeholder)');
  }

  /**
   * Optimize memory usage (for backward compatibility)
   */
  async optimizeMemoryUsage(): Promise<void> {
    this.logger.info('Memory optimization completed (placeholder)');
  }

  /**
   * Get individual model states
   */
  getModelStates(): {
    lstm: { isInitialized: boolean; config: any };
    qlearning: { isInitialized: boolean; qTableSize: number; config: any };
  } {
    return {
      lstm: this.lstmPredictor.getModelState(),
      qlearning: this.rlAgent.getAgentState()
    };
  }

  /**
   * Save models
   */
  async saveModels(): Promise<void> {
    try {
      await Promise.all([
        this.rlAgent.saveModel()
        // LSTM model saving would be implemented here
      ]);
      
      this.logger.info('Models saved successfully', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'model_save',
          amount: 1
        }
      });

    } catch (error) {
      this.logger.error('Model saving failed', error as Error);
      throw error;
    }
  }

  /**
   * Load models
   */
  private async loadModels(): Promise<void> {
    try {
      await this.rlAgent.loadModel();
      
      // Check if models are properly loaded
      const lstmState = this.lstmPredictor.getModelState();
      const rlState = this.rlAgent.getAgentState();
      
      if (lstmState.isInitialized || rlState.isInitialized) {
        this.isInitialized = true;
        this.logger.info('Models loaded successfully', {
          performance: {
            duration: 0,
            memoryUsage: 0
          },
          trading: {
            symbol: 'ai_system',
            action: 'model_load',
            amount: 1
          }
        });
      }
      
    } catch (error) {
      this.logger.warn('Model loading failed, will train from scratch', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'ai_system',
          action: 'model_load_failed',
          amount: 0
        }
      });
    }
  }

  /**
   * Start publishing predictions to the PriceOracle smart contract
   */
  startOraclePublisher(intervalMs: number = 300000): void { // Default 5 minutes
    if (this.oraclePublishInterval) {
      clearInterval(this.oraclePublishInterval);
    }
    
    this.logger.info(`Starting Oracle Publisher, interval: ${intervalMs}ms`);
    
    this.oraclePublishInterval = setInterval(async () => {
      if (!this.isInitialized) return;
      
      try {
        // Collect brief market data to predict
        const marketData = await collectMarketData(['pangolin', 'coingecko'], { hours: 1 });
        if (!marketData || marketData.length === 0) return;
        
        const prices = marketData.map(d => d.price);
        const prediction = await this.predict(prices);
        
        // Expiry in 1 hour
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        
        const web3Server = Web3Server.getInstance();
        await web3Server.publishPrediction(prediction.price, prediction.confidence, expiresAt);
        
        this.logger.info(`Oracle Publisher: Published prediction. Price=${prediction.price.toFixed(4)}, Conf=${(prediction.confidence * 100).toFixed(1)}%`);
      } catch (error) {
        this.logger.error('Oracle Publisher encountered an error', error as Error);
      }
    }, intervalMs);
    
    // Also try to publish immediately
    setTimeout(() => {
      this.predict([100]).catch(() => {}); // Warmup
    }, 1000);
  }
}
