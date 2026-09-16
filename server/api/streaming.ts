import express from 'express';
import { getStreamingServerInstance } from '../libs/dataCollection/index.js';
import { AISystem } from '../libs/aiSystem/index.js';

const router = express.Router();

/**
 * Get streaming server singleton instance
 */
const getStreamingServer = async (): Promise<any> => {
  return await getStreamingServerInstance();
};

/**
 * GET /api/streaming/status
 * Get current streaming health and status
 */
router.get('/status', async (req, res) => {
  try {
    const server = await getStreamingServer();
    const status = server.getStatus();
    const aiSystem = AISystem.getInstance();
    const aiStreamingStatus = aiSystem.getStreamingStatus();

    res.json({
      success: true,
      data: {
        streaming: status,
        aiSystem: aiStreamingStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error getting streaming status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get streaming status'
    });
  }
});

/**
 * POST /api/streaming/start
 * Start streaming connections
 */
router.post('/start', async (req, res) => {
  try {
    const server = await getStreamingServer();
    const { enablePrice = true, enableSubgraph = true } = req.body;

    console.log('🚀 Starting streaming connections...');

    if (enablePrice) {
      await server.startPriceStream();
    }

    if (enableSubgraph) {
      await server.startSubgraphStream();
    }

    // Enable AI system streaming
    const aiSystem = AISystem.getInstance();
    await aiSystem.enableStreaming();

    const status = server.getStatus();
    
    res.json({
      success: true,
      message: 'Streaming started successfully',
      data: status
    });
  } catch (error: any) {
    console.error('Error starting streaming:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start streaming'
    });
  }
});

/**
 * POST /api/streaming/stop
 * Stop streaming connections
 */
router.post('/stop', async (req, res) => {
  try {
    const server = await getStreamingServer();
    server.stop();

    // Disable AI system streaming
    const aiSystem = AISystem.getInstance();
    aiSystem.disableStreaming();

    console.log('🛑 Streaming stopped');

    res.json({
      success: true,
      message: 'Streaming stopped successfully'
    });
  } catch (error: any) {
    console.error('Error stopping streaming:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop streaming'
    });
  }
});

/**
 * GET /api/streaming/data
 * Get recent streaming data points
 */
router.get('/data', async (req, res) => {
  try {
    const server = await getStreamingServer();
    const data = server.getDataQueue();
    const lastPrice = server.getLastPriceUpdate();

    res.json({
      success: true,
      data: {
        queueSize: data.length,
        recentData: data.slice(-10), // Last 10 data points
        lastPriceUpdate: lastPrice,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error getting streaming data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get streaming data'
    });
  }
});

/**
 * POST /api/streaming/clear
 * Clear streaming data queue
 */
router.post('/clear', async (req, res) => {
  try {
    const server = await getStreamingServer();
    server.clearDataQueue();

    console.log('🧹 Streaming data queue cleared');

    res.json({
      success: true,
      message: 'Streaming data queue cleared successfully'
    });
  } catch (error: any) {
    console.error('Error clearing streaming data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear streaming data'
    });
  }
});

/**
 * GET /api/streaming/health
 * Get detailed streaming health metrics
 */
router.get('/health', async (req, res) => {
  try {
    const server = await getStreamingServer();
    const status = server.getStatus();
    const aiSystem = AISystem.getInstance();
    const aiStatus = aiSystem.getStatus();
    const aiStreamingStatus = aiSystem.getStreamingStatus();

    const health = {
      streaming: {
        isConnected: status.isConnected,
        priceStreamActive: status.priceStreamActive,
        subgraphStreamActive: status.subgraphStreamActive,
        lastPriceUpdate: status.lastPriceUpdate,
        lastSwapUpdate: status.lastSwapUpdate,
        connectionErrors: status.connectionErrors.length,
        reconnectAttempts: status.reconnectAttempts
      },
      aiSystem: {
        lstmReady: aiStatus.lstmReady,
        rlReady: aiStatus.rlReady,
        initialized: aiStatus.initialized,
        streamingEnabled: aiStreamingStatus.enabled,
        streamingBufferSize: aiStreamingStatus.bufferSize,
        lastStreamingUpdate: aiStreamingStatus.lastUpdate
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    console.error('Error getting streaming health:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get streaming health'
    });
  }
});

export { router as streamingRouter };
