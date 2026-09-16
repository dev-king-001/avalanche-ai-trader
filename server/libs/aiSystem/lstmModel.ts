// @ts-nocheck
import * as tf from '@tensorflow/tfjs';
import { Logger } from '../../utils/logger';
import { LSTMConfig, TrainingProgress, PredictionResult } from './types';

/**
 * LSTM Model Implementation
 * Extracted from aiSystem.ts for better modularity
 */

export class ServerLSTMPredictor {
  private model: tf.Sequential | null = null;
  private scaler: { min: number; max: number } | null = null;
  private attentionWeights: number[] = [];
  private modelConfig: LSTMConfig = {
    lstmUnits: [128, 64, 32],
    dropoutRate: 0.2,
    learningRate: 0.001,
    batchSize: 32,
    sequenceLength: 60,
    epochs: 100,
    validationSplit: 0.2
  };
  
  private logger = Logger.getInstance();

  /**
   * Create LSTM model architecture
   */
  private createModel(inputShape: [number, number]): tf.Sequential {
    const model = tf.sequential();
    
    // First LSTM layer
    model.add(tf.layers.lstm({
      units: this.modelConfig.lstmUnits[0],
      returnSequences: true,
      inputShape: inputShape,
      recurrentDropout: this.modelConfig.dropoutRate
    }));
    model.add(tf.layers.dropout({ rate: this.modelConfig.dropoutRate }));
    
    // Second LSTM layer
    model.add(tf.layers.lstm({
      units: this.modelConfig.lstmUnits[1],
      returnSequences: true,
      recurrentDropout: this.modelConfig.dropoutRate
    }));
    model.add(tf.layers.dropout({ rate: this.modelConfig.dropoutRate }));
    
    // Third LSTM layer
    model.add(tf.layers.lstm({
      units: this.modelConfig.lstmUnits[2],
      returnSequences: false,
      recurrentDropout: this.modelConfig.dropoutRate
    }));
    model.add(tf.layers.dropout({ rate: this.modelConfig.dropoutRate }));
    
    // Dense layers
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: this.modelConfig.dropoutRate }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    
    // Compile model
    const optimizer = tf.train.adamax(this.modelConfig.learningRate);
    model.compile({
      optimizer: optimizer,
      loss: 'huberLoss',
      metrics: ['mae', 'mse']
    });
    
    return model;
  }

  /**
   * Prepare sequences for LSTM training
   */
  private prepareSequences(data: number[]): { X: number[][]; y: number[] } {
    const X: number[][] = [];
    const y: number[] = [];
    
    for (let i = this.modelConfig.sequenceLength; i < data.length; i++) {
      X.push(data.slice(i - this.modelConfig.sequenceLength, i));
      y.push(data[i]);
    }
    
    return { X, y };
  }

  /**
   * Normalize features using robust scaling
   */
  private normalizeFeatures(data: number[]): { normalized: number[]; scaler: { min: number; max: number } } {
    const sorted = [...data].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    const mad = sorted.reduce((sum, val) => {
      return sum + Math.abs(val - median);
    }, 0) / sorted.length;
    
    const normalized = data.map(val => (val - median) / (mad + 1e-8));
    
    return {
      normalized,
      scaler: { min: median - 3 * mad, max: median + 3 * mad }
    };
  }

  /**
   * Train the LSTM model
   */
  async train(
    data: number[],
    progressCallback?: (progress: TrainingProgress) => void
  ): Promise<void> {
    try {
      this.logger.info('Starting LSTM model training', {
        performance: {
          duration: 0,
          memoryUsage: data.length
        },
        trading: {
          symbol: 'lstm',
          action: 'training_start',
          amount: data.length
        }
      });

      // Prepare data
      const { X, y } = this.prepareSequences(data);
      if (X.length === 0) {
        throw new Error('Insufficient data for training');
      }

      // Normalize features and reshape for LSTM
      const XNormalized: number[][][] = [];
      for (let i = 0; i < X.length; i++) {
        const sequence = X[i];
        const { normalized } = this.normalizeFeatures(sequence);
        // Reshape to 3D array: [batch, sequence_length, features]
        const reshapedSequence = normalized.map(val => [val]);
        XNormalized.push(reshapedSequence);
      }

      // Create tensors
      const XTensor = tf.tensor3d(XNormalized, [XNormalized.length, this.modelConfig.sequenceLength, 1]);
      const yTensor = tf.tensor2d(y, [y.length, 1]);

      // Create and train model
      this.model = this.createModel([this.modelConfig.sequenceLength, 1]);
      this.scaler = scaler;

      // Training callbacks
      const callbacks = [
        tf.callbacks.earlyStopping({
          monitor: 'val_loss',
          patience: 10,
          restoreBestWeights: true
        })
      ];

      // Train model
      const history = await this.model.fit(XTensor, yTensor, {
        epochs: this.modelConfig.epochs,
        batchSize: this.modelConfig.batchSize,
        validationSplit: this.modelConfig.validationSplit,
        callbacks,
        verbose: 0
      });

      // Clean up tensors
      XTensor.dispose();
      yTensor.dispose();

      this.logger.info('LSTM model training completed', {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: 'lstm',
          action: 'training_complete',
          amount: history.history.loss?.length || 0
        }
      });

    } catch (error) {
      this.logger.error('LSTM model training failed', error as Error);
      throw error;
    }
  }

  /**
   * Make predictions with the LSTM model
   */
  async predict(data: number[]): Promise<PredictionResult> {
    if (!this.model || !this.scaler) {
      throw new Error('Model not trained');
    }

    try {
      // Prepare input sequence
      const sequence = data.slice(-this.modelConfig.sequenceLength);
      const { normalized } = this.normalizeFeatures(sequence);
      
      // Create tensor
      const reshapedInput = normalized.map(val => [val]);
      const inputTensor = tf.tensor3d([reshapedInput], [1, this.modelConfig.sequenceLength, 1]);
      
      // Make prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = prediction.dataSync()[0];
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Calculate direction and confidence
      const currentPrice = data[data.length - 1];
      const direction = predictedValue > currentPrice ? 'up' : predictedValue < currentPrice ? 'down' : 'neutral';
      const confidence = this.calculatePredictionConfidence(data, predictedValue);
      
      return {
        price: predictedValue,
        direction,
        confidence,
        timestamp: Date.now(),
        modelType: 'lstm',
        features: sequence
      };
      
    } catch (error) {
      this.logger.error('LSTM prediction failed', error as Error);
      throw error;
    }
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(data: number[], predictedPrice: number): number {
    const trendConsistency = this.calculateTrendConsistency(data);
    const volumeConsistency = this.calculateVolumeConsistency(data);
    const technicalAlignment = this.calculateTechnicalAlignment(data, predictedPrice);
    
    return (trendConsistency + volumeConsistency + technicalAlignment) / 3;
  }

  private calculateTrendConsistency(data: number[]): number {
    if (data.length < 10) return 0.5;
    
    const recent = data.slice(-10);
    const trends = recent.slice(1).map((price, i) => price > recent[i]);
    const consistentTrends = trends.filter(trend => trend === trends[0]).length;
    
    return consistentTrends / trends.length;
  }

  private calculateVolumeConsistency(data: number[]): number {
    // Simplified volume consistency calculation
    return 0.7; // Placeholder
  }

  private calculateTechnicalAlignment(data: number[], predictedPrice: number): number {
    if (data.length < 20) return 0.5;
    
    const sma20 = data.slice(-20).reduce((sum, price) => sum + price, 0) / 20;
    const currentPrice = data[data.length - 1];
    
    const priceAlignment = Math.abs(predictedPrice - sma20) / sma20;
    return Math.max(0, 1 - priceAlignment);
  }

  /**
   * Get model state
   */
  getModelState(): { isInitialized: boolean; config: LSTMConfig } {
    return {
      isInitialized: this.model !== null,
      config: this.modelConfig
    };
  }
}
