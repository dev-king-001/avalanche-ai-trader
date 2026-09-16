/**
 * Data Collection Module - Main Index
 * Centralized exports for all data collection functionality
 */

// Export types
export * from './types.js';

// Export API client functionality
export { 
  makeAPIRequest, 
  validateMarketData, 
  detectOutliers,
  PANGOLIN_SUBGRAPH_URL, 
  COINGECKO_API_URL, 
  SNOWTRACE_API_URL, 
  SNOWTRACE_API_KEY 
} from './apiClient.js';

// Export technical indicators
export { 
  interpolateMissingData, 
  addTechnicalIndicators 
} from './technicalIndicators.js';

// Export main data collection functions
export { 
  fetchPangolinSwaps, 
  fetchCoinGeckoData, 
  fetchSnowtraceData, 
  preprocessData,
  collectMarketData 
} from './dataCollection.js';

// Legacy exports for backward compatibility
export const collectHistoricalData = async (...args: any[]) => {
  const { collectMarketData } = await import('./dataCollection.js');
  return collectMarketData(...args);
};
export const getStreamingServerInstance = () => null; // Placeholder
