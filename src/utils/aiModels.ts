import * as tf from '@tensorflow/tfjs';
import { 
  processMarketData, 
  calculateSMA, 
  calculateEMA, 
  calculateVolatility 
} from './dataPreprocessing.js';

/**
 * AI Models for Token Price Prediction and Trading
 * LSTM for price prediction and Q-Learning for trading decisions
 */

// Feature engineering utilities
export interface MarketData {
  timestamp: number;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface ProcessedFeatures {
  price: number;
  sma7: number;
  sma14: number;
  sma30: number;
  ema10: number;
  ema30: number;
  volatility: number;
  momentum: number;
  volume: number;
  priceChange: number;
  volumeChange: number;
}

// Re-export preprocessing functions for backward compatibility
export { processMarketData, calculateSMA, calculateEMA, calculateVolatility };

/**
 * LSTM Model for Price Prediction
 */
export class LSTMPredictor {
  private model: tf.Sequential | null = null;
  private scaler: { mean: number; std: number } | null = null;

  /**
   * Create and compile LSTM model
   */
  createModel(inputShape: [number, number]): tf.Sequential {
    const model = tf.sequential();

    // First LSTM layer
    model.add(tf.layers.lstm({
      units: 100,
      returnSequences: true,
      inputShape: inputShape,
      activation: 'relu',
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Second LSTM layer
    model.add(tf.layers.lstm({
      units: 100,
      returnSequences: true,
      activation: 'relu',
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Third LSTM layer
    model.add(tf.layers.lstm({
      units: 100,
      returnSequences: false,
      activation: 'relu',
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Output layer
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    return model;
  }

  /**
   * Prepare training sequences
   */
  private prepareSequences(features: ProcessedFeatures[], sequenceLength: number = 60) {
    const sequences = [];
    const targets = [];

    for (let i = sequenceLength; i < features.length; i++) {
      const sequence = features.slice(i - sequenceLength, i);
      const target = features[i].price;
      
      sequences.push(sequence);
      targets.push(target);
    }

    return { sequences, targets };
  }

  /**
   * Normalize features
   */
  private async normalizeFeatures(features: ProcessedFeatures[]) {
    const featureArrays = features.map(f => [
      f.price, f.sma7, f.sma14, f.sma30, f.ema10, f.ema30,
      f.volatility, f.momentum, f.volume, f.priceChange, f.volumeChange
    ]);

    const tensor = tf.tensor2d(featureArrays);
    const mean = tensor.mean(0);
    const std = tensor.sub(mean).square().mean(0).sqrt();
    
    const normalized = tensor.sub(mean).div(std);
    
    const meanData = await mean.data();
    const stdData = await std.data();
    
    this.scaler = {
      mean: meanData[0],
      std: stdData[0],
    };

    return normalized;
  }

  /**
   * Train the LSTM model
   */
  async train(features: ProcessedFeatures[], quickMode: boolean = false): Promise<void> {
    console.log(`Training LSTM model${quickMode ? ' (quick mode)' : ''}...`);
    
    const { sequences, targets } = this.prepareSequences(features);
    const normalizedFeatures = this.normalizeFeatures(features);
    
    // Convert to tensors
    const xs = tf.tensor3d(sequences.map(seq => 
      seq.map(f => [
        f.price, f.sma7, f.sma14, f.sma30, f.ema10, f.ema30,
        f.volatility, f.momentum, f.volume, f.priceChange, f.volumeChange
      ])
    ));
    const ys = tf.tensor2d(targets.map(t => [t]));

    // Create model
    this.model = this.createModel([60, 11]);

    // Train model with reduced epochs for faster training
    const epochs = quickMode ? 5 : 20; // Even faster in quick mode
    await this.model.fit(xs, ys, {
      epochs: epochs,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % (quickMode ? 1 : 5) === 0) { // Show progress every epoch in quick mode
            console.log(`LSTM Epoch ${epoch}/${epochs}: loss = ${logs?.loss?.toFixed(4)}`);
          }
        },
      },
    });

    console.log('LSTM training completed');
  }

  /**
   * Make price prediction
   */
  async predict(recentFeatures: ProcessedFeatures[]): Promise<{ price: number; confidence: number }> {
    if (!this.model || !this.scaler) {
      throw new Error('Model not trained');
    }

    const sequence = recentFeatures.slice(-60).map(f => [
      f.price, f.sma7, f.sma14, f.sma30, f.ema10, f.ema30,
      f.volatility, f.momentum, f.volume, f.priceChange, f.volumeChange
    ]);

    const input = tf.tensor3d([sequence]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    // Calculate confidence based on recent volatility
    const recentVolatility = recentFeatures.slice(-10).map(f => f.volatility);
    const avgVolatility = recentVolatility.reduce((a, b) => a + b, 0) / recentVolatility.length;
    const confidence = Math.max(0.1, Math.min(0.95, 1 - avgVolatility * 10));

    return {
      price: result[0],
      confidence: confidence * 100,
    };
  }

  /**
   * Save model
   */
  async saveModel(path: string): Promise<void> {
    if (this.model) {
      await this.model.save(`localstorage://${path}`);
    }
  }

  /**
   * Load model
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`localstorage://${path}`) as tf.Sequential;
    } catch (error) {
      console.error('Failed to load LSTM model:', error);
    }
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.model !== null && this.scaler !== null;
  }
}

/**
 * Q-Learning Agent for Trading Decisions
 */
export class QLearningAgent {
  private qTable: Map<string, Map<string, number>> = new Map();
  private learningRate = 0.1;
  private discountFactor = 0.95;
  private epsilon = 0.1; // Exploration rate

  private actions = ['BUY', 'SELL', 'HOLD'];

  /**
   * Get state representation
   */
  private getState(features: ProcessedFeatures, portfolioRatio: number): string {
    const price = features.price;
    const sma7 = features.sma7;
    const momentum = features.momentum;
    
    // Discretize continuous values
    const priceVsSma = price > sma7 ? 'above' : 'below';
    const momentumSign = momentum > 0 ? 'positive' : 'negative';
    const portfolioState = portfolioRatio > 0.7 ? 'high_avax' : portfolioRatio < 0.3 ? 'low_avax' : 'balanced';
    
    return `${priceVsSma}_${momentumSign}_${portfolioState}`;
  }

  /**
   * Choose action using epsilon-greedy policy
   */
  chooseAction(state: string): string {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
      this.actions.forEach(action => {
        this.qTable.get(state)!.set(action, 0);
      });
    }

    // Epsilon-greedy exploration
    if (Math.random() < this.epsilon) {
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    }

    // Choose best action
    const stateActions = this.qTable.get(state)!;
    let bestAction = this.actions[0];
    let bestValue = stateActions.get(bestAction)!;

    for (const action of this.actions) {
      const value = stateActions.get(action)!;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Update Q-value
   */
  updateQValue(state: string, action: string, reward: number, nextState: string): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
      this.actions.forEach(a => this.qTable.get(state)!.set(a, 0));
    }

    if (!this.qTable.has(nextState)) {
      this.qTable.set(nextState, new Map());
      this.actions.forEach(a => this.qTable.get(nextState)!.set(a, 0));
    }

    const currentQ = this.qTable.get(state)!.get(action)!;
    const nextStateActions = this.qTable.get(nextState)!;
    const maxNextQ = Math.max(...Array.from(nextStateActions.values()));

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    this.qTable.get(state)!.set(action, newQ);
  }

  /**
   * Calculate reward based on trade outcome
   */
  calculateReward(
    action: string,
    oldPrice: number,
    newPrice: number,
    portfolioValue: number,
    oldPortfolioValue: number
  ): number {
    const portfolioReturn = (portfolioValue - oldPortfolioValue) / oldPortfolioValue;
    const priceReturn = (newPrice - oldPrice) / oldPrice;

    let reward = 0;

    if (action === 'BUY' && priceReturn > 0) {
      reward = portfolioReturn * 100; // Reward successful buys
    } else if (action === 'SELL' && priceReturn < 0) {
      reward = -priceReturn * 100; // Reward successful sells
    } else if (action === 'HOLD') {
      reward = Math.abs(priceReturn) < 0.01 ? 1 : -Math.abs(priceReturn) * 10; // Small reward for holding during stability
    } else {
      reward = portfolioReturn * 50; // Smaller penalty for unsuccessful trades
    }

    return reward;
  }

  /**
   * Get trading decision
   */
  getDecision(
    features: ProcessedFeatures,
    portfolioRatio: number
  ): { action: string; confidence: number } {
    const state = this.getState(features, portfolioRatio);
    const action = this.chooseAction(state);

    // Calculate confidence based on Q-value
    const stateActions = this.qTable.get(state);
    const qValue = stateActions?.get(action) || 0;
    const maxQ = stateActions ? Math.max(...Array.from(stateActions.values())) : 0;
    const confidence = maxQ > 0 ? (qValue / maxQ) * 100 : 50;

    return { action, confidence: Math.max(0, Math.min(100, confidence)) };
  }

  /**
   * Train the agent
   */
  train(
    historicalData: ProcessedFeatures[],
    episodes: number = 500, // Reduced from 10000 to 500 for faster training
    quickMode: boolean = false
  ): void {
    const actualEpisodes = quickMode ? 100 : episodes; // Even fewer episodes in quick mode
    console.log(`Training Q-Learning agent with ${actualEpisodes} episodes${quickMode ? ' (quick mode)' : ''}...`);

    for (let episode = 0; episode < actualEpisodes; episode++) {
      let portfolioValue = 10000; // Starting portfolio value
      let avaxHoldings = 0;
      let usdtHoldings = 10000;

      // Use a subset of data for faster training
      const maxDataPoints = quickMode ? 50 : 100; // Even less data in quick mode
      const trainingData = historicalData.slice(0, Math.min(historicalData.length, maxDataPoints));
      
      for (let i = 1; i < trainingData.length; i++) {
        const currentFeatures = trainingData[i - 1];
        const nextFeatures = trainingData[i];
        
        const portfolioRatio = (avaxHoldings * currentFeatures.price) / portfolioValue;
        const state = this.getState(currentFeatures, portfolioRatio);
        const action = this.chooseAction(state);

        // Simulate trade
        const oldPortfolioValue = portfolioValue;
        if (action === 'BUY' && usdtHoldings > 100) {
          const buyAmount = Math.min(usdtHoldings * 0.1, 500); // Buy up to 10% or $500
          avaxHoldings += buyAmount / currentFeatures.price;
          usdtHoldings -= buyAmount;
        } else if (action === 'SELL' && avaxHoldings > 0.1) {
          const sellAmount = Math.min(avaxHoldings * 0.1, 10); // Sell up to 10% or 10 AVAX
          usdtHoldings += sellAmount * currentFeatures.price;
          avaxHoldings -= sellAmount;
        }

        portfolioValue = avaxHoldings * nextFeatures.price + usdtHoldings;
        const nextPortfolioRatio = (avaxHoldings * nextFeatures.price) / portfolioValue;
        const nextState = this.getState(nextFeatures, nextPortfolioRatio);

        const reward = this.calculateReward(
          action,
          currentFeatures.price,
          nextFeatures.price,
          portfolioValue,
          oldPortfolioValue
        );

        this.updateQValue(state, action, reward, nextState);
      }

      const progressInterval = quickMode ? 25 : 100; // Show progress more frequently in quick mode
      if (episode % progressInterval === 0) {
        console.log(`Q-Learning Episode ${episode}/${actualEpisodes} completed`);
      }
    }

    console.log('Q-Learning training completed');
  }

  /**
   * Save Q-table
   */
  saveModel(): void {
    const qTableObj: any = {};
    this.qTable.forEach((actions, state) => {
      qTableObj[state] = {};
      actions.forEach((value, action) => {
        qTableObj[state][action] = value;
      });
    });
    localStorage.setItem('rl_model', JSON.stringify(qTableObj));
  }

  /**
   * Load Q-table
   */
  loadModel(): void {
    try {
      const saved = localStorage.getItem('rl_model');
      if (saved) {
        const qTableObj = JSON.parse(saved);
        this.qTable.clear();
        
        Object.keys(qTableObj).forEach(state => {
          this.qTable.set(state, new Map());
          Object.keys(qTableObj[state]).forEach(action => {
            this.qTable.get(state)!.set(action, qTableObj[state][action]);
          });
        });
      }
    } catch (error) {
      console.error('Failed to load RL model:', error);
    }
  }

  /**
   * Export Q-table for server-side persistence
   */
  exportQTable(): any {
    const qTableObj: any = {};
    this.qTable.forEach((actions, state) => {
      qTableObj[state] = {};
      actions.forEach((value, action) => {
        qTableObj[state][action] = value;
      });
    });
    return qTableObj;
  }

  /**
   * Import Q-table from server-side persistence
   */
  importQTable(qTableObj: any): void {
    this.qTable.clear();
    Object.keys(qTableObj).forEach(state => {
      this.qTable.set(state, new Map());
      Object.keys(qTableObj[state]).forEach(action => {
        this.qTable.get(state)!.set(action, qTableObj[state][action]);
      });
    });
  }
}

/**
 * Combined AI Trading System
 */
export class AITradingSystem {
  private lstmPredictor = new LSTMPredictor();
  private rlAgent = new QLearningAgent();

  async initialize(historicalData: ProcessedFeatures[], quickMode: boolean = false): Promise<void> {
    console.log(`Initializing AI Trading System${quickMode ? ' (quick mode)' : ''}...`);
    
    // Add timeout to prevent infinite training
    const timeoutMs = quickMode ? 30000 : 60000; // 30s timeout for quick mode, 60s for normal
    const trainingTimeout = setTimeout(() => {
      console.warn('Training timeout reached, using basic models');
      throw new Error('Training timeout - using basic models');
    }, timeoutMs);
    
    try {
      // Train models
      await this.lstmPredictor.train(historicalData, quickMode);
      this.rlAgent.train(historicalData, undefined, quickMode);

      // Save models
      await this.lstmPredictor.saveModel('lstm_model');
      this.rlAgent.saveModel();

      console.log('AI Trading System initialized');
    } finally {
      clearTimeout(trainingTimeout);
    }
  }

  async loadModels(): Promise<void> {
    await this.lstmPredictor.loadModel('lstm_model');
    this.rlAgent.loadModel();
  }

  async getTradeSignal(
    recentData: ProcessedFeatures[],
    portfolioRatio: number
  ): Promise<{
    prediction: { price: number; confidence: number };
    decision: { action: string; confidence: number };
  }> {
    const prediction = await this.lstmPredictor.predict(recentData);
    const decision = this.rlAgent.getDecision(recentData[recentData.length - 1], portfolioRatio);

    return { prediction, decision };
  }
}