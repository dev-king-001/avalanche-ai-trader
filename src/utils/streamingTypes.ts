// Re-export StreamingEventType from shared types
export { StreamingEventType } from '../shared/types.js';

// Import shared types for re-export
export type { 
  MarketDataPoint,
  StreamingEvent,
  PriceUpdateEvent,
  SwapEvent,
  ConnectionStatusEvent,
  ErrorEvent,
  ReconnectEvent,
  ConnectionState,
  ValidationResult,
  StreamHealth
} from '../shared/types.js';

// Define specific streaming data interfaces
export interface PriceStreamData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  p: string; // Price
  q: string; // Quantity
  T: number; // Trade time
  t: number; // Trade ID
  b: number; // Buyer order ID
  a: number; // Seller order ID
  M: boolean; // Is buyer market maker
  m: boolean; // Ignore
}

export interface SubgraphStreamData {
  id: string;
  timestamp: string;
  amount0In: string;
  amount1Out: string;
  amount0Out: string;
  amount1In: string;
  amountUSD: string;
  pair: {
    token0: {
      symbol: string;
      decimals: string;
    };
    token1: {
      symbol: string;
      decimals: string;
    };
  };
}

// Event payload types for streaming
export interface PriceUpdatePayload {
  timestamp: number;
  price: number;
  volume: number;
  source: string;
}

export interface SwapEventPayload {
  id: string;
  timestamp: number;
  amountUSD: number;
  pairAddress: string;
  source: string;
}

export interface ConnectionStatusPayload {
  source: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  error?: string;
  timestamp: number;
}

export interface ErrorPayload {
  message: string;
  details?: any;
  source: string;
  timestamp: number;
}

// Streaming configuration with environment variables
export interface StreamingConfig {
  enablePriceStream: boolean;
  enableSubgraphStream: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  dataBufferSize: number;
  updateThrottleMs: number;
  // Environment-specific URLs
  binanceWsUrl?: string;
  pangolinSubgraphWs?: string;
  pangolinSubgraphHttp?: string;
  pangolinPairId?: string;
}

// Streaming status with error management
export interface StreamingStatus {
  isConnected: boolean;
  priceStreamActive: boolean;
  subgraphStreamActive: boolean;
  lastPriceUpdate: number | null;
  lastSwapUpdate: number | null;
  connectionErrors: string[];
  reconnectAttempts: number;
  priceErrorCount: number;
  subgraphErrorCount: number;
  isInFallbackMode: boolean;
}
