/**
 * Simple AI System without TensorFlow dependency
 * Provides basic predictions using statistical methods on real market data
 */

import { MarketDataPoint } from './dataCollection/index.js';
import { collectHistoricalData, preprocessData } from './dataCollection/index.js';
import { Logger } from '../utils/logger.js';

export interface SimplePrediction {
  price: number;
  confidence: number;
  timestamp: number;
}

export interface SimpleSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  timestamp: number;
}

export class SimpleAISystem {
  private logger: Logger;
  private historicalData: MarketDataPoint[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🤖 Initializing Simple AI System with real data...');
      
      // Collect real historical data
      this.historicalData = await collectHistoricalData();
      console.log(`✅ Loaded ${this.historicalData.length} real data points`);
      
      if (this.historicalData.length < 10) {
        throw new Error('Insufficient historical data for analysis');
      }

      this.isInitialized = true;
      console.log('✅ Simple AI System initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Simple AI System:', error);
      throw error;
    }
  }

  /**
   * Generate price prediction using simple moving averages and trend analysis
   */
  generatePrediction(): SimplePrediction {
    if (!this.isInitialized || this.historicalData.length < 10) {
      // Return a fallback prediction
      return {
        price: 42.50,
        confidence: 0.5,
        timestamp: Date.now()
      };
    }

    const recentData = this.historicalData.slice(-50); // Last 50 data points
    const currentPrice = recentData[recentData.length - 1].price;
    
    // Calculate simple moving averages
    const sma10 = this.calculateSMA(recentData.slice(-10));
    const sma20 = this.calculateSMA(recentData.slice(-20));
    
    // Calculate price volatility
    const volatility = this.calculateVolatility(recentData.slice(-20));
    
    // Simple trend detection
    const trend = sma10 > sma20 ? 'bullish' : 'bearish';
    
    // Predict next price based on trend and momentum
    let predictedPrice = currentPrice;
    let confidence = 0.6;

    if (trend === 'bullish') {
      // Bullish trend: predict slight increase
      predictedPrice = currentPrice * (1 + (Math.random() * 0.02 + 0.005)); // 0.5-2.5% increase
      confidence = Math.min(0.85, 0.6 + (sma10 - sma20) / currentPrice * 10);
    } else {
      // Bearish trend: predict slight decrease
      predictedPrice = currentPrice * (1 - (Math.random() * 0.02 + 0.005)); // 0.5-2.5% decrease
      confidence = Math.min(0.85, 0.6 + (sma20 - sma10) / currentPrice * 10);
    }

    // Adjust confidence based on volatility (high volatility = lower confidence)
    confidence = Math.max(0.3, confidence - volatility * 2);

    return {
      price: Math.round(predictedPrice * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: Date.now()
    };
  }

  /**
   * Generate trading signal based on technical analysis
   */
  generateSignal(): SimpleSignal {
    if (!this.isInitialized || this.historicalData.length < 20) {
      // Return a fallback signal
      return {
        action: 'HOLD',
        confidence: 0.5,
        price: 42.50,
        timestamp: Date.now()
      };
    }

    const recentData = this.historicalData.slice(-30); // Last 30 data points
    const currentPrice = recentData[recentData.length - 1].price;
    
    // Calculate technical indicators
    const sma5 = this.calculateSMA(recentData.slice(-5));
    const sma10 = this.calculateSMA(recentData.slice(-10));
    const sma20 = this.calculateSMA(recentData.slice(-20));
    
    // RSI-like momentum indicator
    const momentum = this.calculateMomentum(recentData.slice(-14));
    
    // Volume analysis
    const recentVolume = this.calculateAverageVolume(recentData.slice(-5));
    const avgVolume = this.calculateAverageVolume(recentData.slice(-20));
    const volumeRatio = recentVolume / avgVolume;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;

    // Decision logic based on multiple indicators
    const bullishSignals = [
      sma5 > sma10,           // Short-term above medium-term
      sma10 > sma20,          // Medium-term above long-term  
      momentum > 0.3,         // Positive momentum
      volumeRatio > 1.2,      // Above average volume
      currentPrice > sma10    // Price above short-term average
    ];

    const bearishSignals = [
      sma5 < sma10,           // Short-term below medium-term
      sma10 < sma20,          // Medium-term below long-term
      momentum < -0.3,        // Negative momentum
      volumeRatio > 1.2,      // High volume on decline
      currentPrice < sma10    // Price below short-term average
    ];

    const bullishCount = bullishSignals.filter(Boolean).length;
    const bearishCount = bearishSignals.filter(Boolean).length;

    if (bullishCount >= 4) {
      action = 'BUY';
      confidence = Math.min(0.9, 0.6 + bullishCount * 0.05);
    } else if (bearishCount >= 4) {
      action = 'SELL';
      confidence = Math.min(0.9, 0.6 + bearishCount * 0.05);
    } else {
      action = 'HOLD';
      confidence = 0.4 + Math.abs(bullishCount - bearishCount) * 0.05;
    }

    return {
      action,
      confidence: Math.round(confidence * 100) / 100,
      price: Math.round(currentPrice * 100) / 100,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: MarketDataPoint[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, point) => acc + point.price, 0);
    return sum / data.length;
  }

  /**
   * Calculate price volatility (standard deviation)
   */
  private calculateVolatility(data: MarketDataPoint[]): number {
    if (data.length < 2) return 0;
    
    const prices = data.map(d => d.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / mean; // Normalized volatility
  }

  /**
   * Calculate momentum indicator (similar to RSI concept)
   */
  private calculateMomentum(data: MarketDataPoint[]): number {
    if (data.length < 2) return 0;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].price - data[i - 1].price;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    if (losses === 0) return 1; // All gains
    if (gains === 0) return -1; // All losses
    
    // Return normalized momentum between -1 and 1
    return (gains - losses) / (gains + losses);
  }

  /**
   * Calculate average volume
   */
  private calculateAverageVolume(data: MarketDataPoint[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, point) => acc + point.volume, 0);
    return sum / data.length;
  }

  /**
   * Get current market status
   */
  getCurrentPrice(): number {
    if (!this.isInitialized || this.historicalData.length === 0) {
      return 42.50;
    }
    return this.historicalData[this.historicalData.length - 1].price;
  }

  /**
   * Check if system is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}