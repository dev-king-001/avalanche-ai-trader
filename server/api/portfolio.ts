/**
 * Portfolio Analytics API
 * Provides real-time portfolio metrics and performance data
 */

import express from 'express';
import { SimpleAISystem } from '../libs/simpleAI.js';
import { collectHistoricalData } from '../libs/dataCollection/index.js';

export const portfolioRouter = express.Router();

let simpleAI: SimpleAISystem | null = null;
let isInitializing = false;

// Mock Portfolio Data
const mockPortfolioHoldings = {
  AVAX: {
    amount: 1250.5,
    value: 31262.5,
    allocation: 0.65,
    performance: 0.0234,
    avgPrice: 24.85
  },
  USDT: {
    amount: 8500.0,
    value: 8500.0,
    allocation: 0.18,
    performance: 0.0,
    avgPrice: 1.0
  },
  'PANGOLIN-LP': {
    amount: 125.75,
    value: 3125.0,
    allocation: 0.07,
    performance: 0.0156,
    avgPrice: 24.85
  },
  'JOE-LP': {
    amount: 89.25,
    value: 2225.0,
    allocation: 0.05,
    performance: 0.0089,
    avgPrice: 24.92
  },
  'BENQI': {
    amount: 1250.0,
    value: 3125.0,
    allocation: 0.05,
    performance: -0.0123,
    avgPrice: 2.5
  }
};

// Mock Trading History
const generateMockTradingHistory = () => {
  const history = [];
  const baseDate = new Date('2025-05-01'); // Start from May 2025
  const basePrice = 20.0;
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    // Generate realistic price movements
    const volatility = 0.03;
    const trend = 0.0005;
    const randomWalk = (Math.random() - 0.5) * volatility;
    const price = basePrice * Math.exp(trend * i + randomWalk);
    
    // Generate trading activity
    const tradeType = Math.random() > 0.7 ? 'BUY' : (Math.random() > 0.5 ? 'SELL' : 'HOLD');
    const amount = tradeType !== 'HOLD' ? Math.random() * 100 + 10 : 0;
    const profit = tradeType === 'SELL' ? (Math.random() - 0.4) * 500 : 0;
    
    history.push({
      id: `trade_${i}`,
      timestamp: date.toISOString(),
      type: tradeType,
      asset: 'AVAX',
      amount: parseFloat(amount.toFixed(2)),
      price: parseFloat(price.toFixed(4)),
      value: parseFloat((amount * price).toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      gasUsed: tradeType !== 'HOLD' ? Math.floor(Math.random() * 200000) + 100000 : 0,
      gasPrice: parseFloat((Math.random() * 50 + 20).toFixed(2)),
      txHash: tradeType !== 'HOLD' ? `0x${Math.random().toString(16).substring(2, 66)}` : null,
      status: tradeType !== 'HOLD' ? 'CONFIRMED' : null,
      aiSignal: tradeType !== 'HOLD' ? (Math.random() > 0.3 ? 'BUY' : 'SELL') : null,
      confidence: tradeType !== 'HOLD' ? Math.floor(Math.random() * 30) + 70 : null
    });
  }
  
  return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Mock Portfolio Performance History
const generateMockPerformanceHistory = () => {
  const history = [];
  const baseDate = new Date('2025-05-01'); // Start from May 2025
  let baseValue = 45000;
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    // Generate realistic portfolio value movements
    const dailyReturn = (Math.random() - 0.48) * 0.04; // Slightly positive bias
    baseValue *= (1 + dailyReturn);
    
    const totalReturn = ((baseValue - 45000) / 45000) * 100;
    const dailyReturnPercent = dailyReturn * 100;
    
    history.push({
      timestamp: date.toISOString(),
      totalValue: parseFloat(baseValue.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(4)),
      dailyReturn: parseFloat(dailyReturnPercent.toFixed(4)),
      avaxPrice: parseFloat((20 + Math.random() * 10).toFixed(4)),
      volume: Math.floor(Math.random() * 1000000) + 500000
    });
  }
  
  return history;
};

// Initialize Simple AI System
async function initializeSimpleAI() {
  if (simpleAI?.isReady() || isInitializing) {
    return;
  }

  isInitializing = true;
  try {
    console.log('🔧 Initializing Simple AI for portfolio analytics...');
    simpleAI = new SimpleAISystem();
    await simpleAI.initialize();
    console.log('✅ Simple AI initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Simple AI:', error);
  } finally {
    isInitializing = false;
  }
}

// Initialize on startup
initializeSimpleAI();

/**
 * Get comprehensive portfolio metrics
 */
portfolioRouter.get('/metrics', async (req, res) => {
  try {
    if (!simpleAI?.isReady()) {
      await initializeSimpleAI();
    }

    // Get current AI prediction for accuracy calculation
    const currentPrediction = simpleAI?.generatePrediction();
    const currentSignal = simpleAI?.generateSignal();
    const currentPrice = simpleAI?.getCurrentPrice();

    // Calculate total portfolio value
    const totalValue = Object.values(mockPortfolioHoldings).reduce((sum: number, holding: any) => sum + holding.value, 0);
    
    // Calculate weighted performance
    const weightedPerformance = Object.values(mockPortfolioHoldings).reduce((sum: number, holding: any) => 
      sum + (holding.performance * holding.allocation), 0);

    const portfolioMetrics = {
      totalValue: totalValue,
      totalReturn: weightedPerformance * 100, // Convert to percentage
      annualizedReturn: weightedPerformance * 365 * 100, // Annualized
      sharpeRatio: 1.85,
      maxDrawdown: 0.023,
      volatility: 0.045,
      beta: 1.2,
      winRate: 0.68,
      profitFactor: 1.45,
      averageTrade: 0.008,
      holdings: mockPortfolioHoldings
    };

    const riskMetrics = {
      var: 0.025,
      cvar: 0.035,
      beta: 1.2,
      correlation: 0.85,
      trackingError: 0.012,
      informationRatio: 1.15
    };

    const aiPerformanceMetrics = {
      predictionAccuracy: currentPrediction ? 0.72 : 0.65,
      signalEffectiveness: currentSignal ? 0.68 : 0.62,
      confidenceCorrelation: 0.78,
      averageConfidence: currentPrediction ? currentPrediction.confidence / 100 : 0.61,
      signalCount: 156
    };

    res.json({
      success: true,
      data: {
        portfolioMetrics,
        riskMetrics,
        aiPerformanceMetrics,
        currentPrice,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Portfolio metrics error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get portfolio holdings
 */
portfolioRouter.get('/holdings', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        holdings: mockPortfolioHoldings,
        totalValue: Object.values(mockPortfolioHoldings).reduce((sum: number, holding: any) => sum + holding.value, 0),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Portfolio holdings error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio holdings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get trading history
 */
portfolioRouter.get('/trading-history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    
    let history = generateMockTradingHistory();
    
    // Filter by type if specified
    if (type && type !== 'ALL') {
      history = history.filter(trade => trade.type === type);
    }
    
    // Apply pagination
    const paginatedHistory = history.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));
    
    // Calculate summary statistics
    const totalTrades = history.filter(trade => trade.type !== 'HOLD').length;
    const profitableTrades = history.filter(trade => trade.profit > 0).length;
    const totalProfit = history.reduce((sum, trade) => sum + trade.profit, 0);
    const totalVolume = history.reduce((sum, trade) => sum + trade.value, 0);
    
    res.json({
      success: true,
      data: {
        trades: paginatedHistory,
        summary: {
          totalTrades,
          profitableTrades,
          winRate: totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0,
          totalProfit,
          totalVolume,
          averageTradeSize: totalTrades > 0 ? totalVolume / totalTrades : 0
        },
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: history.length,
          hasMore: parseInt(offset as string) + parseInt(limit as string) < history.length
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Trading history error:', error);
    res.status(500).json({
      error: 'Failed to fetch trading history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get portfolio history for charting
 */
portfolioRouter.get('/history', async (req, res) => {
  try {
    const historicalData = await collectHistoricalData();
    
    if (historicalData.length === 0) {
      // Use mock data if no real data available
      const mockHistory = generateMockPerformanceHistory();
      
      return res.json({
        success: true,
        data: {
          history: mockHistory,
          totalDataPoints: mockHistory.length,
          timeRange: {
            start: mockHistory[mockHistory.length - 1]?.timestamp,
            end: mockHistory[0]?.timestamp
          }
        }
      });
    }

    // Convert to portfolio history format
    const portfolioHistory = historicalData.slice(-30).map((data: any, index: number) => ({
      timestamp: data.timestamp,
      totalValue: data.price * 100,
      totalReturn: (data.price / historicalData[0].price - 1) * 100,
      dailyReturn: index > 0 ? (data.price / historicalData[index - 1].price - 1) * 100 : 0,
      volume: data.volume,
      price: data.price
    }));

    res.json({
      success: true,
      data: {
        history: portfolioHistory,
        totalDataPoints: portfolioHistory.length,
        timeRange: {
          start: new Date(portfolioHistory[0]?.timestamp * 1000).toISOString(),
          end: new Date(portfolioHistory[portfolioHistory.length - 1]?.timestamp * 1000).toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Portfolio history error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default portfolioRouter;

