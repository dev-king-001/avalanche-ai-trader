import type { ProcessedFeatures, MarketData } from '../../src/utils/aiModels.js';

/**
 * API Request and Response Types
 * Shared between frontend and backend for type safety
 */

// Predict API
export interface PredictRequest {
  recentData?: MarketData[];
}

export interface PredictResponse {
  price: number;
  confidence: number;
  timestamp: number;
}

// Trade API
export interface TradeRequest {
  features: ProcessedFeatures;
  portfolioRatio: number;
}

export interface TradeResponse {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: number;
}

// Blockchain Trade API
export interface BlockchainTradeRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
}

export interface BlockchainTradeResponse {
  txHash?: string;
  error?: string;
  timestamp: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  message?: string;
  timestamp: number;
}

// Health Check Response
export interface HealthResponse {
  status: string;
  timestamp: string;
  aiSystemStatus?: {
    lstmReady: boolean;
    rlReady: boolean;
  };
}
