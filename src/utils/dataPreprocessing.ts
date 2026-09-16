/**
 * Data Preprocessing Utilities
 * Comprehensive data preprocessing functions for AI trading system
 * Consolidates all preprocessing logic from various modules
 */

import { MarketData, MarketDataPoint } from '../shared/types.js';

// ============================================================================
// TECHNICAL INDICATORS CALCULATION
// ============================================================================

/**
 * Calculate Simple Moving Average
 * @param prices - Array of price values
 * @param period - Period for moving average calculation
 * @returns Array of SMA values
 */
export const calculateSMA = (prices: number[], period: number): number[] => {
  const sma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
};

/**
 * Calculate Exponential Moving Average
 * @param prices - Array of price values
 * @param period - Period for EMA calculation
 * @returns Array of EMA values
 */
export const calculateEMA = (prices: number[], period: number): number[] => {
  if (prices.length === 0) return [];
  
  const alpha = 2 / (period + 1);
  const ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema.push(alpha * prices[i] + (1 - alpha) * ema[i - 1]);
  }
  return ema;
};

/**
 * Calculate volatility (standard deviation of returns)
 * @param prices - Array of price values
 * @param period - Period for volatility calculation
 * @returns Array of volatility values
 */
export const calculateVolatility = (prices: number[], period: number): number[] => {
  const volatility = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      volatility.push(0);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const returns = [];
      for (let j = 1; j < slice.length; j++) {
        returns.push((slice[j] - slice[j - 1]) / slice[j - 1]);
      }
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      volatility.push(Math.sqrt(variance));
    }
  }
  return volatility;
};

/**
 * Calculate volatility from price history (single value)
 * @param prices - Array of price values
 * @returns Volatility as a percentage
 */
export const calculateVolatilityPercentage = (prices: number[]): number => {
  if (prices.length < 2) return 0;
  
  // Calculate price returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const return_ = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(return_);
  }
  
  // Calculate volatility (standard deviation of returns)
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(365 * 24 * 60); // Annualized
  
  return volatility * 100; // Convert to percentage
};

/**
 * Calculate Relative Strength Index (RSI)
 * @param prices - Array of price values
 * @param period - Period for RSI calculation (default: 14)
 * @returns Array of RSI values
 */
export const calculateRSI = (prices: number[], period: number = 14): number[] => {
  const rsi = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(50); // Neutral RSI for insufficient data
    } else {
      const gains = [];
      const losses = [];
      
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) {
          gains.push(change);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(change));
        }
      }
      
      const avgGain = gains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsiValue = 100 - (100 / (1 + rs));
        rsi.push(rsiValue);
      }
    }
  }
  
  return rsi;
};

/**
 * Calculate Bollinger Bands
 * @param prices - Array of price values
 * @param period - Period for moving average (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns Object with upper, middle, and lower bands
 */
export const calculateBollingerBands = (
  prices: number[], 
  period: number = 20, 
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } => {
  const sma = calculateSMA(prices, period);
  const upper = [];
  const middle = sma;
  const lower = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(prices[i]);
      lower.push(prices[i]);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      upper.push(mean + (stdDev * standardDeviation));
      lower.push(mean - (stdDev * standardDeviation));
    }
  }
  
  return { upper, middle, lower };
};

// ============================================================================
// DATA CLEANING AND VALIDATION
// ============================================================================

/**
 * Remove outliers using Z-score method
 * @param data - Array of data points
 * @param field - Field to check for outliers
 * @returns Filtered data array
 */
export const removeOutliers = <T extends Record<string, any>>(
  data: T[], 
  field: keyof T
): T[] => {
  if (data.length === 0) return data;
  
  const values = data.map(d => d[field] as number).filter(v => !isNaN(v) && isFinite(v));
  if (values.length === 0) return data;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  
  if (std === 0) return data; // No variation, return original data
  
  return data.filter(d => {
    const value = d[field] as number;
    if (isNaN(value) || !isFinite(value)) return false;
    const zScore = Math.abs((value - mean) / std);
    return zScore < 3; // Keep data within 3 standard deviations
  });
};

/**
 * Handle missing values with linear interpolation
 * @param data - Array of market data points
 * @returns Interpolated data array
 */
export const interpolateMissing = (data: MarketDataPoint[]): MarketDataPoint[] => {
  if (data.length === 0) return data;
  
  const interpolated = [...data];
  
  for (let i = 1; i < interpolated.length - 1; i++) {
    if (interpolated[i].price === 0 || isNaN(interpolated[i].price)) {
      const prevPrice = interpolated[i - 1]?.price;
      const nextPrice = interpolated[i + 1]?.price;
      if (prevPrice && nextPrice && !isNaN(prevPrice) && !isNaN(nextPrice)) {
        interpolated[i].price = (prevPrice + nextPrice) / 2;
      } else {
        interpolated[i].price = prevPrice || nextPrice || 40; // fallback to $40
      }
    }
  }
  
  return interpolated;
};

/**
 * Validate market data structure
 * @param data - Data to validate
 * @returns Validation result
 */
export const validateMarketData = (data: any[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { isValid: false, errors };
  }
  
  if (data.length === 0) {
    errors.push('Data array is empty');
    return { isValid: false, errors };
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    if (!item || typeof item !== 'object') {
      errors.push(`Item at index ${i} is not an object`);
      continue;
    }
    
    if (typeof item.price !== 'number' || isNaN(item.price)) {
      errors.push(`Invalid price at index ${i}`);
    }
    
    if (typeof item.volume !== 'number' || isNaN(item.volume)) {
      errors.push(`Invalid volume at index ${i}`);
    }
    
    if (typeof item.timestamp !== 'number' || isNaN(item.timestamp)) {
      errors.push(`Invalid timestamp at index ${i}`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

// ============================================================================
// FEATURE ENGINEERING
// ============================================================================

/**
 * Process raw market data into features for ML models
 * @param data - Raw market data array
 * @returns Processed features array
 */
export const processMarketData = (data: MarketData[]): any[] => {
  const prices = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  
  const sma7 = calculateSMA(prices, 7);
  const sma14 = calculateSMA(prices, 14);
  const sma30 = calculateSMA(prices, 30);
  const ema10 = calculateEMA(prices, 10);
  const ema30 = calculateEMA(prices, 30);
  const volatility = calculateVolatility(prices, 14);
  const rsi = calculateRSI(prices, 14);
  
  return data.map((item, index) => ({
    price: item.close,
    sma7: sma7[index],
    sma14: sma14[index],
    sma30: sma30[index],
    ema10: ema10[index],
    ema30: ema30[index],
    volatility: volatility[index],
    rsi: rsi[index],
    momentum: index >= 14 ? item.close - prices[index - 14] : 0,
    volume: item.volume,
    priceChange: index > 0 ? (item.close - prices[index - 1]) / prices[index - 1] : 0,
    volumeChange: index > 0 ? (item.volume - volumes[index - 1]) / volumes[index - 1] : 0,
  }));
};

/**
 * Create additional technical features
 * @param data - Market data array
 * @returns Enhanced features object
 */
export const createTechnicalFeatures = (data: MarketData[]): {
  bollingerBands: { upper: number[]; middle: number[]; lower: number[] };
  rsi: number[];
  macd: { macd: number[]; signal: number[]; histogram: number[] };
} => {
  const prices = data.map(d => d.close);
  
  const bollingerBands = calculateBollingerBands(prices, 20, 2);
  const rsi = calculateRSI(prices, 14);
  
  // Simple MACD calculation
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12.map((value, index) => value - ema26[index]);
  const signal = calculateEMA(macd, 9);
  const histogram = macd.map((value, index) => value - signal[index]);
  
  return {
    bollingerBands,
    rsi,
    macd: { macd, signal, histogram }
  };
};

// ============================================================================
// DATA NORMALIZATION
// ============================================================================

/**
 * Normalize data using Min-Max scaling
 * @param data - Array of numbers to normalize
 * @returns Normalized data array
 */
export const normalizeMinMax = (data: number[]): number[] => {
  if (data.length === 0) return data;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  if (range === 0) return data.map(() => 0.5); // All values are the same
  
  return data.map(value => (value - min) / range);
};

/**
 * Normalize data using Z-score standardization
 * @param data - Array of numbers to standardize
 * @returns Standardized data array
 */
export const normalizeZScore = (data: number[]): number[] => {
  if (data.length === 0) return data;
  
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance);
  
  if (std === 0) return data.map(() => 0); // All values are the same
  
  return data.map(value => (value - mean) / std);
};

/**
 * Create normalization scaler for future use
 * @param data - Training data
 * @returns Scaler object with transform and inverseTransform methods
 */
export const createScaler = (data: number[]) => {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance);
  
  return {
    mean,
    std,
    transform: (values: number[]) => values.map(v => (v - mean) / std),
    inverseTransform: (values: number[]) => values.map(v => v * std + mean)
  };
};

// ============================================================================
// MAIN PREPROCESSING PIPELINE
// ============================================================================

/**
 * Complete data preprocessing pipeline
 * @param rawData - Raw market data
 * @returns Preprocessed and validated data
 */
export const preprocessData = (rawData: MarketDataPoint[]): MarketDataPoint[] => {
  // Validate input data
  if (!rawData || rawData.length === 0) {
    console.warn('No data provided for preprocessing, returning empty array');
    return [];
  }

  console.log(`Preprocessing ${rawData.length} data points`);

  // Step 1: Validate data structure
  const validation = validateMarketData(rawData);
  if (!validation.isValid) {
    console.error('Data validation failed:', validation.errors);
    throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
  }

  // Step 2: Remove outliers
  let processedData = removeOutliers(rawData, 'price');
  processedData = removeOutliers(processedData, 'volume');

  // Step 3: Interpolate missing values
  processedData = interpolateMissing(processedData);

  // Step 4: Final validation
  if (processedData.length === 0) {
    console.warn('All data was filtered out during preprocessing, using original data');
    return rawData;
  }

  // Step 5: Sort by timestamp
  const sortedData = processedData.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`Preprocessing complete: ${sortedData.length} data points remaining`);
  
  return sortedData;
};

/**
 * Prepare data for AI model training
 * @param rawData - Raw market data
 * @returns Processed features ready for ML models
 */
export const prepareDataForTraining = (rawData: MarketData[]): MarketData[] => {
  // Convert MarketData to MarketDataPoint format for preprocessing
  const dataPoints: MarketDataPoint[] = rawData.map(d => ({
    timestamp: d.timestamp,
    price: d.close,
    volume: d.volume,
    high: d.high,
    low: d.low,
    open: d.open,
    close: d.close,
    transactionCount: 0,
    liquidity: 0
  }));

  // Preprocess the data
  const preprocessedData = preprocessData(dataPoints);

  // Convert back to MarketData format
  const marketData: MarketData[] = preprocessedData.map(d => ({
    symbol: 'UNKNOWN',
    timestamp: d.timestamp,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.price,
    volume: d.volume,
    priceChange: 0,
    priceChangePercent: 0
  }));

  // Process into features
  return processMarketData(marketData);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate mock data for testing
 * @param startTime - Start timestamp
 * @param endTime - End timestamp
 * @param interval - Time interval in seconds
 * @returns Mock market data
 */
export const generateMockData = (
  startTime: number,
  endTime: number,
  interval: number = 3600 // 1 hour intervals
): MarketDataPoint[] => {
  const data: MarketDataPoint[] = [];
  let currentPrice = 40 + Math.random() * 20; // Start between $40-$60
  
  for (let timestamp = startTime; timestamp <= endTime; timestamp += interval) {
    // Simulate price movement
    const change = (Math.random() - 0.5) * 0.1; // ±5% change
    currentPrice = Math.max(1, currentPrice * (1 + change));
    
    const volume = 1000000 + Math.random() * 5000000; // 1M-6M volume
    const high = currentPrice * (1 + Math.random() * 0.05);
    const low = currentPrice * (1 - Math.random() * 0.05);
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.02);
    const close = currentPrice;
    
    data.push({
      timestamp,
      price: currentPrice,
      volume,
      high,
      low,
      open,
      close,
      transactionCount: 0,
      liquidity: 0
    });
  }
  
  console.log(`Generated ${data.length} mock data points`);
  return data;
};

/**
 * Calculate data quality metrics
 * @param data - Market data array
 * @returns Quality metrics object
 */
export const calculateDataQuality = (data: MarketDataPoint[]): {
  totalPoints: number;
  missingValues: number;
  outliers: number;
  timeGaps: number;
  qualityScore: number;
} => {
  if (data.length === 0) {
    return { totalPoints: 0, missingValues: 0, outliers: 0, timeGaps: 0, qualityScore: 0 };
  }

  let missingValues = 0;
  let outliers = 0;
  let timeGaps = 0;

  // Check for missing values
  data.forEach(point => {
    if (point.price === 0 || isNaN(point.price)) missingValues++;
    if (point.volume === 0 || isNaN(point.volume)) missingValues++;
  });

  // Check for outliers (simplified)
  const prices = data.map(d => d.price).filter(p => p > 0 && !isNaN(p));
  if (prices.length > 0) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const std = Math.sqrt(prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length);
    outliers = prices.filter(p => Math.abs(p - mean) > 3 * std).length;
  }

  // Check for time gaps
  const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < sortedData.length; i++) {
    const gap = sortedData[i].timestamp - sortedData[i - 1].timestamp;
    if (gap > 3600 * 2) timeGaps++; // Gap larger than 2 hours
  }

  const qualityScore = Math.max(0, 100 - (missingValues + outliers + timeGaps) * 10);

  return {
    totalPoints: data.length,
    missingValues,
    outliers,
    timeGaps,
    qualityScore
  };
};
