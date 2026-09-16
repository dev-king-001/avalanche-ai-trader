import { Router } from 'express';
import { Web3Server } from '../../libs/web3Server.js';
import { BlockchainTradeRequest, BlockchainTradeResponse } from '../../types/api.js';

const router = Router();

/**
 * POST /api/blockchain/trade
 * Execute AI-validated trade through smart contract
 */
router.post('/', async (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage = 0.5 }: BlockchainTradeRequest = req.body;
    
    console.log('🔗 Blockchain trade request received');
    
    // Validate input parameters
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'fromToken, toToken, and amount are required',
        timestamp: Date.now()
      });
    }
    
    if (typeof amount !== 'string' || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Amount must be a positive number string',
        timestamp: Date.now()
      });
    }
    
    if (typeof slippage !== 'number' || slippage < 0 || slippage > 10) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Slippage must be a number between 0 and 10',
        timestamp: Date.now()
      });
    }
    
    // Initialize Web3 server
    const web3Server = Web3Server.getInstance();
    await web3Server.initialize();
    
    // Execute the trade using the new Web3Server interface
    const tradeParams = {
      tokenIn: fromToken,
      tokenOut: toToken,
      amountIn: amount,
      amountOutMin: (parseFloat(amount) * (1 - slippage / 100)).toString(),
      deadline: Math.floor(Date.now() / 1000) + 1200, // 20 minutes
      tradeType: fromToken === '0x0000000000000000000000000000000000000000' ? 'AVAX_TO_TOKEN' : 
                 toToken === '0x0000000000000000000000000000000000000000' ? 'TOKEN_TO_AVAX' : 'TOKEN_TO_TOKEN'
    };
    
    // For now, we'll use a placeholder user address - in production this would come from authentication
    const userAddress = '0x0000000000000000000000000000000000000000'; // Placeholder
    
    const result = await web3Server.executeTrade(tradeParams as any, userAddress);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Trade execution failed',
        message: result.error || 'Failed to execute trade',
        timestamp: Date.now()
      });
    }
    
    const response: BlockchainTradeResponse = {
      txHash: result.txHash!,
      timestamp: Date.now()
    };
    
    console.log(`✅ Trade executed successfully: ${result.txHash}`);
    
    res.json(response);
  } catch (error: any) {
    console.error('❌ Blockchain trade failed:', error);
    
    res.status(500).json({
      error: 'Blockchain trade failed',
      message: error.message || 'Failed to execute trade on blockchain',
      timestamp: Date.now()
    });
  }
});

/**
 * GET /api/blockchain/status
 * Get blockchain connection and account status
 */
router.get('/status', async (req, res) => {
  try {
    const web3Server = Web3Server.getInstance();
    const status = web3Server.getConnectionStatus();
    
    res.json({
      connected: status.connected,
      networkId: status.networkId,
      network: process.env.BACKEND_NETWORK || 'fuji',
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('❌ Blockchain status check failed:', error);
    
    res.status(500).json({
      error: 'Status check failed',
      message: error.message || 'Failed to get blockchain status',
      timestamp: Date.now()
    });
  }
});

/**
 * GET /api/blockchain/balances
 * Get current account balances
 */
router.get('/balances', async (req, res) => {
  try {
    const web3Server = Web3Server.getInstance();
    const { account } = req.query;
    
    if (!account || typeof account !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Account address is required',
        timestamp: Date.now()
      });
    }
    
    const avaxBalance = await web3Server.getTokenBalance('0x0000000000000000000000000000000000000000', account);
    
    res.json({
      account,
      avaxBalance,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('❌ Balance check failed:', error);
    
    res.status(500).json({
      error: 'Balance check failed',
      message: error.message || 'Failed to get account balances',
      timestamp: Date.now()
    });
  }
});

export { router as blockchainRouter };
