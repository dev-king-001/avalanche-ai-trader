import { MarketDataPoint } from './types.js';

/**
 * Technical Indicators Module
 * Extracted from dataCollection.ts for better modularity
 */

/**
 * Interpolate missing data points
 */
export function interpolateMissingData(data: MarketDataPoint[]): MarketDataPoint[] {
  if (data.length < 2) return data;
  
  const interpolated: MarketDataPoint[] = [];
  const targetInterval = 3600; // 1 hour in seconds
  
  for (let i = 0; i < data.length - 1; i++) {
    const current = data[i];
    const next = data[i + 1];
    
    interpolated.push(current);
    
    // Check if there's a gap larger than target interval
    const gap = next.timestamp - current.timestamp;
    if (gap > targetInterval * 1.5) {
      const missingPoints = Math.floor(gap / targetInterval) - 1;
      
      for (let j = 1; j <= missingPoints; j++) {
        const ratio = j / (missingPoints + 1);
        const interpolatedPoint: MarketDataPoint = {
          timestamp: current.timestamp + (gap * ratio),
          price: current.price + (next.price - current.price) * ratio,
          volume: current.volume + (next.volume - current.volume) * ratio,
          high: current.high + (next.high - current.high) * ratio,
          low: current.low + (next.low - current.low) * ratio,
          open: current.open + (next.open - current.open) * ratio,
          close: current.close + (next.close - current.close) * ratio,
          transactionCount: Math.floor(current.transactionCount + (next.transactionCount - current.transactionCount) * ratio),
          liquidity: current.liquidity + (next.liquidity - current.liquidity) * ratio,
        };
        interpolated.push(interpolatedPoint);
      }
    }
  }
  
  interpolated.push(data[data.length - 1]);
  return interpolated;
}

/**
 * Add technical indicators to market data
 */
export function addTechnicalIndicators(data: MarketDataPoint[]): MarketDataPoint[] {
  if (data.length < 20) return data;
  
  return data.map((point, index) => {
    const enhanced = { ...point };
    
    // Add SMA indicators
    if (index >= 6) {
      enhanced.sma7 = calculateSMA(data, index, 7);
    }
    if (index >= 13) {
      enhanced.sma14 = calculateSMA(data, index, 14);
    }
    if (index >= 29) {
      enhanced.sma30 = calculateSMA(data, index, 30);
    }
    
    // Add EMA indicators
    if (index >= 9) {
      enhanced.ema10 = calculateEMA(data, index, 10);
    }
    if (index >= 29) {
      enhanced.ema30 = calculateEMA(data, index, 30);
    }
    
    // Add volatility
    if (index >= 19) {
      enhanced.volatility = calculateVolatility(data, index, 20);
    }
    
    // Add momentum
    if (index >= 13) {
      enhanced.momentum = calculateMomentum(data, index, 14);
    }
    
    // Add volume indicators
    if (index >= 19) {
      enhanced.volumeSMA = calculateVolumeSMA(data, index, 20);
    }
    
    return enhanced;
  });
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data: MarketDataPoint[], currentIndex: number, period: number): number {
  const startIndex = Math.max(0, currentIndex - period + 1);
  const prices = data.slice(startIndex, currentIndex + 1).map(d => d.price);
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(data: MarketDataPoint[], currentIndex: number, period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = data[currentIndex].price;
  
  for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - period + 1); i--) {
    ema = (data[i].price * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

/**
 * Calculate volatility (standard deviation of returns)
 */
function calculateVolatility(data: MarketDataPoint[], currentIndex: number, period: number): number {
  const startIndex = Math.max(0, currentIndex - period + 1);
  const returns = [];
  
  for (let i = startIndex + 1; i <= currentIndex; i++) {
    const return_ = (data[i].price - data[i - 1].price) / data[i - 1].price;
    returns.push(return_);
  }
  
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate momentum (price change over period)
 */
function calculateMomentum(data: MarketDataPoint[], currentIndex: number, period: number): number {
  const startIndex = Math.max(0, currentIndex - period + 1);
  return data[currentIndex].price - data[startIndex].price;
}

/**
 * Calculate volume SMA
 */
function calculateVolumeSMA(data: MarketDataPoint[], currentIndex: number, period: number): number {
  const startIndex = Math.max(0, currentIndex - period + 1);
  const volumes = data.slice(startIndex, currentIndex + 1).map(d => d.volume);
  return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
}








