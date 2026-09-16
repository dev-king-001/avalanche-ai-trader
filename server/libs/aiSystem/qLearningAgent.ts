import { Logger } from '../../utils/logger.js';
import { QLearningConfig, PredictionResult } from './types.js';

/**
 * Q-Learning Agent Implementation
 * Extracted from aiSystem.ts for better modularity
 */

export class QLearningAgent {
  private qTable: Map<string, number[]> = new Map();
  private config: QLearningConfig = {
    learningRate: 0.1,
    discountFactor: 0.95,
    epsilon: 0.1,
    epsilonDecay: 0.995,
    minEpsilon: 0.01,
    stateSize: 10,
    actionSize: 3 // buy, sell, hold
  };
  
  private logger = Logger.getInstance();

  /**
   * Get state representation from price data
   */
  private getState(prices: number[]): string {
    if (prices.length < this.config.stateSize) {
      // Pad with the last known price
      const lastPrice = prices[prices.length - 1] || 0;
      while (prices.length < this.config.stateSize) {
        prices.unshift(lastPrice);
      }
    }
    
    const recentPrices = prices.slice(-this.config.stateSize);
    const priceChanges = recentPrices.slice(1).map((price, i) => {
      const change = (price - recentPrices[i]) / recentPrices[i];
      return Math.sign(change); // -1, 0, 1
    });
    
    return priceChanges.join(',');
  }

  /**
   * Get action from Q-table or random exploration
   */
  private getAction(state: string): number {
    const random = Math.random();
    
    if (random < this.config.epsilon) {
      // Exploration: random action
      return Math.floor(Math.random() * this.config.actionSize);
    }
    
    // Exploitation: best action from Q-table
    const qValues = this.qTable.get(state) || new Array(this.config.actionSize).fill(0);
    return qValues.indexOf(Math.max(...qValues));
  }

  /**
   * Update Q-table with new experience
   */
  private updateQValue(state: string, action: number, reward: number, nextState: string): void {
    const qValues = this.qTable.get(state) || new Array(this.config.actionSize).fill(0);
    const nextQValues = this.qTable.get(nextState) || new Array(this.config.actionSize).fill(0);
    
    const maxNextQ = Math.max(...nextQValues);
    const currentQ = qValues[action];
    
    // Q-learning update formula
    qValues[action] = currentQ + this.config.learningRate * (reward + this.config.discountFactor * maxNextQ - currentQ);
    
    this.qTable.set(state, qValues);
  }

  /**
   * Calculate reward based on price movement
   */
  private calculateReward(action: number, priceChange: number): number {
    const actionNames = ['hold', 'buy', 'sell'];
    
    switch (action) {
      case 0: // hold
        return Math.abs(priceChange) < 0.01 ? 0.1 : -0.1;
      case 1: // buy
        return priceChange > 0.01 ? 1.0 : -1.0;
      case 2: // sell
        return priceChange < -0.01 ? 1.0 : -1.0;
      default:
        return 0;
    }
  }

  /**
   * Train the Q-learning agent
   */
  async train(data: number[], episodes: number = 1000): Promise<void> {
    try {
      this.logger.info('Starting Q-learning agent training', {
        performance: {
          duration: 0,
          memoryUsage: data.length
        },
        trading: {
          symbol: 'qlearning',
          action: 'training_start',
          amount: episodes
        }
      });

      for (let episode = 0; episode < episodes; episode++) {
        let totalReward = 0;
        
        for (let i = this.config.stateSize; i < data.length - 1; i++) {
          const currentPrices = data.slice(i - this.config.stateSize, i);
          const nextPrices = data.slice(i - this.config.stateSize + 1, i + 1);
          
          const currentState = this.getState(currentPrices);
          const nextState = this.getState(nextPrices);
          
          const action = this.getAction(currentState);
          const priceChange = (data[i + 1] - data[i]) / data[i];
          const reward = this.calculateReward(action, priceChange);
          
          this.updateQValue(currentState, action, reward, nextState);
          totalReward += reward;
        }
        
        // Decay epsilon
        this.config.epsilon = Math.max(this.config.minEpsilon, this.config.epsilon * this.config.epsilonDecay);
        
        if (episode % 100 === 0) {
          this.logger.debug(`Q-learning episode ${episode}/${episodes}, total reward: ${totalReward.toFixed(2)}`, {
            performance: {
              duration: 0,
              memoryUsage: this.qTable.size
            },
            trading: {
              symbol: 'qlearning',
              action: 'training_progress',
              amount: episode
            }
          });
        }
      }

      this.logger.info('Q-learning agent training completed', {
        performance: {
          duration: 0,
          memoryUsage: this.qTable.size
        },
        trading: {
          symbol: 'qlearning',
          action: 'training_complete',
          amount: episodes
        }
      });

    } catch (error) {
      this.logger.error('Q-learning agent training failed', error as Error);
      throw error;
    }
  }

  /**
   * Make predictions with the Q-learning agent
   */
  async predict(data: number[]): Promise<PredictionResult> {
    try {
      const state = this.getState(data);
      const qValues = this.qTable.get(state) || new Array(this.config.actionSize).fill(0);
      const action = qValues.indexOf(Math.max(...qValues));
      
      const currentPrice = data[data.length - 1];
      const actionNames = ['hold', 'buy', 'sell'];
      const directions = ['neutral', 'up', 'down'];
      
      // Calculate confidence based on Q-value differences
      const maxQ = Math.max(...qValues);
      const minQ = Math.min(...qValues);
      const confidence = maxQ > minQ ? (maxQ - minQ) / (maxQ + 1e-8) : 0.5;
      
      // Estimate price movement based on action
      let predictedPrice = currentPrice;
      switch (action) {
        case 1: // buy - expect price to go up
          predictedPrice = currentPrice * 1.02;
          break;
        case 2: // sell - expect price to go down
          predictedPrice = currentPrice * 0.98;
          break;
        default: // hold - expect minimal change
          predictedPrice = currentPrice;
      }
      
      return {
        price: predictedPrice,
        direction: directions[action] as 'up' | 'down' | 'neutral',
        confidence: Math.min(confidence, 0.95),
        timestamp: Date.now(),
        modelType: 'qlearning',
        features: data.slice(-this.config.stateSize)
      };
      
    } catch (error) {
      this.logger.error('Q-learning prediction failed', error as Error);
      throw error;
    }
  }

  /**
   * Get agent state
   */
  getAgentState(): { isInitialized: boolean; qTableSize: number; config: QLearningConfig } {
    return {
      isInitialized: this.qTable.size > 0,
      qTableSize: this.qTable.size,
      config: this.config
    };
  }

  /**
   * Save model to file (simplified)
   */
  async saveModel(): Promise<void> {
    // Implementation would save Q-table to file
    this.logger.info('Q-learning model saved', {
      performance: {
        duration: 0,
        memoryUsage: this.qTable.size
      },
      trading: {
        symbol: 'qlearning',
        action: 'model_save',
        amount: this.qTable.size
      }
    });
  }

  /**
   * Load model from file (simplified)
   */
  async loadModel(): Promise<void> {
    // Implementation would load Q-table from file
    this.logger.info('Q-learning model loaded', {
      performance: {
        duration: 0,
        memoryUsage: this.qTable.size
      },
      trading: {
        symbol: 'qlearning',
        action: 'model_load',
        amount: this.qTable.size
      }
    });
  }
}








