import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import { CacheManager } from '../../utils/cache.js';
import { EnvironmentManager } from '../../config/environment.js';
import { RateLimitConfig, RateLimitTracker, APIConfig } from './types.js';

/**
 * API Client for external data sources
 * Extracted from dataCollection.ts for better modularity
 */

// Direct API endpoints
// Pangolin API endpoints (working)
const PANGOLIN_API_BASE = 'https://api.pangolin.exchange';
const PANGOLIN_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/dasconnor/pangolin-dex'; // Fallback
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const SNOWTRACE_API_URL = 'https://api.snowtrace.io/api';
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || 'YourSnowtraceAPIKey';

// Rate limiting configuration
const RATE_LIMITS: APIConfig = {
  coingecko: { requests: 50, window: 60000 }, // 50 requests per minute
  snowtrace: { requests: 5, window: 1000 },   // 5 requests per second
  pangolin: { requests: 100, window: 60000 }  // 100 requests per minute
};

// Rate limit tracking
const rateLimitTrackers: Record<keyof APIConfig, RateLimitTracker> = {
  coingecko: { requests: 0, resetTime: Date.now() },
  snowtrace: { requests: 0, resetTime: Date.now() },
  pangolin: { requests: 0, resetTime: Date.now() }
};

// Initialize production components
const logger = Logger.getInstance();
const cache = CacheManager.getInstance();
const envManager = EnvironmentManager.getInstance();

/**
 * Enhanced rate limiting utility
 */
function checkRateLimit(api: keyof APIConfig): boolean {
  const tracker = rateLimitTrackers[api];
  const limit = RATE_LIMITS[api];
  
  // Reset counter if window has passed
  if (Date.now() > tracker.resetTime) {
    tracker.requests = 0;
    tracker.resetTime = Date.now() + limit.window;
  }
  
  // Check if limit exceeded
  if (tracker.requests >= limit.requests) {
    logger.warn(`Rate limit exceeded for ${api}`, {
      performance: {
        duration: 0,
        memoryUsage: 0
      },
      trading: {
        symbol: api,
        action: 'rate_limit_exceeded',
        amount: tracker.requests
      }
    });
    return false;
  }
  
  tracker.requests++;
  return true;
}

/**
 * Enhanced API request with retry logic and error handling
 */
export async function makeAPIRequest<T>(
  url: string,
  options: any = {},
  api: keyof APIConfig,
  retries: number = 3
): Promise<T> {
  // Check rate limit
  if (!checkRateLimit(api)) {
    throw new Error(`Rate limit exceeded for ${api}`);
  }
  
  const maxRetries = retries;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Making API request to ${url} (attempt ${attempt}/${maxRetries})`, {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: api,
          action: 'api_request',
          amount: attempt
        }
      });
      
      const response = await axios({
        url,
        timeout: 10000, // 10 second timeout
        ...options,
        headers: {
          'User-Agent': 'Avalanche-AI-Trader/1.0',
          ...options.headers
        }
      });
      
      // Validate response
      if (!response.data) {
        throw new Error('Empty response received');
      }
      
      logger.debug(`API request successful`, {
        performance: {
          duration: 0,
          memoryUsage: JSON.stringify(response.data).length
        },
        trading: {
          symbol: api,
          action: 'api_success',
          amount: response.status
        }
      });
      
      return response.data;
      
    } catch (error: any) {
      lastError = error;
      
      // Log error details
      logger.warn(`API request failed (attempt ${attempt}/${maxRetries})`, {
        performance: {
          duration: 0,
          memoryUsage: 0
        },
        trading: {
          symbol: api,
          action: 'api_error',
          amount: attempt
        }
      });
      
      // Don't retry on certain errors
      if (error.response?.status === 429) { // Rate limit
        throw new Error(`Rate limit exceeded for ${api}`);
      }
      
      if (error.response?.status >= 400 && error.response?.status < 500) { // Client errors
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Enhanced data validation
 */
export function validateMarketData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const requiredFields = ['timestamp', 'price', 'volume'];
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      return false;
    }
  }
  
  // Validate data types and ranges
  if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
    return false;
  }
  
  if (typeof data.price !== 'number' || data.price <= 0) {
    return false;
  }
  
  if (typeof data.volume !== 'number' || data.volume < 0) {
    return false;
  }
  
  return true;
}

/**
 * Enhanced outlier detection
 */
export function detectOutliers(data: any[]): any[] {
  if (data.length < 3) {
    return data;
  }
  
  // Calculate price changes
  const priceChanges = data.slice(1).map((point, i) => {
    const prevPrice = data[i].price;
    return Math.abs((point.price - prevPrice) / prevPrice);
  });
  
  // Calculate median and MAD for outlier detection
  const sortedChanges = [...priceChanges].sort((a, b) => a - b);
  const median = sortedChanges[Math.floor(sortedChanges.length / 2)];
  
  const mad = sortedChanges.reduce((sum, change) => {
    return sum + Math.abs(change - median);
  }, 0) / sortedChanges.length;
  
  // Filter out outliers (price changes > 3 * MAD)
  const threshold = median + 3 * mad;
  
  return data.filter((point, i) => {
    if (i === 0) return true; // Keep first point
    const priceChange = Math.abs((point.price - data[i - 1].price) / data[i - 1].price);
    return priceChange <= threshold;
  });
}

// Export constants for use in other modules
export { PANGOLIN_SUBGRAPH_URL, COINGECKO_API_URL, SNOWTRACE_API_URL, SNOWTRACE_API_KEY };
