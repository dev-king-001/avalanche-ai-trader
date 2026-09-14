/**
 * AI System Types
 * Extracted from aiSystem.ts for better modularity
 */

import * as tf from '@tensorflow/tfjs';

/**
 * LSTM Model Configuration
 */
export interface LSTMConfig {
  lstmUnits: [number, number, number];
  dropoutRate: number;
  learningRate: number;
  batchSize: number;
  sequenceLength: number;
  epochs: number;
  validationSplit: number;
}

/**
 * Q-Learning Configuration
 */
export interface QLearningConfig {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  minEpsilon: number;
  stateSize: number;
  actionSize: number;
}

/**
 * Prediction Result
 */
export interface PredictionResult {
  price: number;
  direction: 'up' | 'down' | 'neutral';
  confidence: number;
  timestamp: number;
  modelType: 'lstm' | 'qlearning' | 'ensemble';
  features: number[];
}

/**
 * Model Training Progress
 */
export interface TrainingProgress {
  epoch: number;
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
}

/**
 * Model Performance Metrics
 */
export interface ModelMetrics {
  mae: number;
  mse: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

/**
 * Attention Weights for LSTM
 */
export interface AttentionWeights {
  weights: number[];
  timestamp: number;
}

/**
 * Model State
 */
export interface ModelState {
  isInitialized: boolean;
  lastTrainingTime: number;
  totalPredictions: number;
  averageAccuracy: number;
  modelVersion: string;
}
