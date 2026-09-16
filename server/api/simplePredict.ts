/**
 * Simple Prediction API - Bypass TensorFlow issues and show real data
 */

import express from 'express';
import { SimpleAISystem } from '../libs/simpleAI.js';
import { collectHistoricalData } from '../libs/dataCollection/index.js';

export const simplePredictRouter = express.Router();

let simpleAI: SimpleAISystem | null = null;
let isInitializing = false;

// Initialize Simple AI System
async function initializeSimpleAI() {
  if (simpleAI?.isReady() || isInitializing) {
    return;
  }

  isInitializing = true;
  try {
    console.log('🔧 Initializing Simple AI for real data predictions...');
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
 * Get AI prediction based on real market data
 */
simplePredictRouter.get('/prediction', async (req, res) => {
  try {
    if (!simpleAI?.isReady()) {
      await initializeSimpleAI();
    }

    if (!simpleAI?.isReady()) {
      return res.status(503).json({
        error: 'AI system not ready',
        message: 'Simple AI system is still initializing'
      });
    }

    const prediction = simpleAI.generatePrediction();
    const signal = simpleAI.generateSignal();
    const currentPrice = simpleAI.getCurrentPrice();

    res.json({
      success: true,
      data: {
        prediction: {
          price: prediction.price,
          confidence: prediction.confidence * 100, // Convert to percentage
          timestamp: prediction.timestamp
        },
        signal: {
          action: signal.action,
          confidence: signal.confidence * 100, // Convert to percentage
          price: signal.price,
          timestamp: signal.timestamp
        },
        currentPrice,
        dataSource: 'real_coingecko_data',
        aiType: 'simple_statistical_analysis'
      }
    });

  } catch (error) {
    console.error('❌ Simple prediction error:', error);
    res.status(500).json({
      error: 'Prediction failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get historical data summary
 */
simplePredictRouter.get('/data-summary', async (req, res) => {
  try {
    const historicalData = await collectHistoricalData();
    
    if (historicalData.length === 0) {
      return res.json({
        success: false,
        message: 'No historical data available'
      });
    }

    // Calculate summary statistics
    const prices = historicalData.map((d: any) => d.price);
    const volumes = historicalData.map((d: any) => d.volume);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const currentPrice = prices[prices.length - 1];
    const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
    
    // Calculate recent performance (last 30 data points)
    const recentData = historicalData.slice(-30);
    const recentPrices = recentData.map((d: any) => d.price);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceChangePercent = (priceChange / recentPrices[0]) * 100;

    res.json({
      success: true,
      data: {
        totalDataPoints: historicalData.length,
        timeRange: {
          start: new Date(historicalData[0].timestamp * 1000).toISOString(),
          end: new Date(historicalData[historicalData.length - 1].timestamp * 1000).toISOString()
        },
        priceStatistics: {
          current: Math.round(currentPrice * 100) / 100,
          min: Math.round(minPrice * 100) / 100,
          max: Math.round(maxPrice * 100) / 100,
          average: Math.round(avgPrice * 100) / 100,
          recentChange: Math.round(priceChange * 100) / 100,
          recentChangePercent: Math.round(priceChangePercent * 100) / 100
        },
        volumeStatistics: {
          average: Math.round(avgVolume * 100) / 100,
          recent: Math.round(volumes.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10 * 100) / 100
        },
        dataSource: 'coingecko_api',
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Data summary error:', error);
    res.status(500).json({
      error: 'Failed to get data summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});