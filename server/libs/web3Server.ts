// @ts-nocheck
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';
import { EnvironmentManager } from '../config/environment';
import AIPoweredTraderABI from '../../src/utils/abis/AIPoweredTrader.json';
import PriceOracleABI from '../../src/utils/abis/PriceOracle.json';

/**
 * Enhanced Web3 Server for blockchain integration
 * Phase 3: Blockchain Layer Enhancement
 */
export class Web3Server {
  private static instance: Web3Server;
  private web3: Web3;
  private aiTraderContract: any;
  private priceOracleContract: any;
  private logger: Logger;
  private cache: CacheManager;
  private envManager: EnvironmentManager;
  private isConnected: boolean = false;
  private gasPriceCache: { price: string; timestamp: number } | null = null;
  private gasPriceCacheDuration = 60000; // 1 minute

  private constructor() {
    this.logger = Logger.getInstance();
    this.cache = CacheManager.getInstance();
    this.envManager = EnvironmentManager.getInstance();
    this.web3 = new Web3();
  }

  public static getInstance(): Web3Server {
    if (!Web3Server.instance) {
      Web3Server.instance = new Web3Server();
    }
    return Web3Server.instance;
  }

  /**
   * Initialize Web3 connection and contracts
   */
  async initialize(): Promise<void> {
    try {
      const rpcUrl = this.envManager.getConfig('blockchain').rpcUrl;
      this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
      
      // Test connection
      await this.web3.eth.getBlockNumber();
      this.isConnected = true;
      
      // Initialize contracts
      await this.initializeContracts();
      
      this.logger.info('Web3 server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Web3 server', error as Error);
      throw error;
    }
  }

  /**
   * Initialize smart contracts
   */
  private async initializeContracts(): Promise<void> {
    try {
      const aiTraderAddress = this.envManager.getConfig('blockchain').aiTraderAddress;
      const priceOracleAddress = this.envManager.getConfig('blockchain').priceOracleAddress;

      this.aiTraderContract = new this.web3.eth.Contract(
        AIPoweredTraderABI.abi as AbiItem[],
        aiTraderAddress
      );

      this.priceOracleContract = new this.web3.eth.Contract(
        PriceOracleABI.abi as AbiItem[],
        priceOracleAddress
      );

      this.logger.info('Smart contracts initialized');
    } catch (error) {
      this.logger.error('Failed to initialize smart contracts', error as Error);
      throw error;
    }
  }

  /**
   * Get optimized gas price with caching
   */
  async getOptimizedGasPrice(): Promise<string> {
    try {
      // Check cache first
      if (this.gasPriceCache && 
          Date.now() - this.gasPriceCache.timestamp < this.gasPriceCacheDuration) {
        return this.gasPriceCache.price;
      }

      // Get current gas price
      const currentGasPrice = await this.web3.eth.getGasPrice();
      
      // Calculate optimized gas price (add 10% buffer for faster confirmation)
      const currentGasPriceBN = BigInt(currentGasPrice);
      const optimizedGasPrice = (currentGasPriceBN * BigInt(110) / BigInt(100)).toString();

      // Cache the result
      this.gasPriceCache = {
        price: optimizedGasPrice,
        timestamp: Date.now()
      };

      return optimizedGasPrice;
    } catch (error) {
      this.logger.error('Failed to get optimized gas price');
      // Return a reasonable default
      return this.web3.utils.toWei('50', 'gwei');
    }
  }

  /**
   * Estimate gas for transaction with fallback
   */
  async estimateGas(transaction: any): Promise<number> {
    try {
      const gasEstimate = await this.web3.eth.estimateGas(transaction);
      // Add 20% buffer for safety
      return Math.ceil(Number(gasEstimate) * 1.2);
    } catch (error) {
      this.logger.warn('Gas estimation failed, using default');
      // Return reasonable defaults based on transaction type
      if (transaction.data?.includes('tradeExactAVAXForTokens')) {
        return 300000; // AVAX to token swap
      } else if (transaction.data?.includes('tradeExactTokensForAVAX')) {
        return 250000; // Token to AVAX swap
      } else {
        return 200000; // Default
      }
    }
  }

  /**
   * Execute trade with enhanced error handling and retry logic
   */
  async executeTrade(
    tradeParams: {
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      amountOutMin: string;
      deadline: number;
      tradeType: 'AVAX_TO_TOKEN' | 'TOKEN_TO_AVAX' | 'TOKEN_TO_TOKEN';
    },
    userAddress: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      this.logger.info('Executing trade', {
        trading: {
          symbol: `${tradeParams.tokenIn}/${tradeParams.tokenOut}`,
          action: 'execute_trade',
          amount: parseFloat(tradeParams.amountIn)
        }
      });

      // Validate AI prediction before trade
      const aiPredictionValid = await this.validateAIPrediction();
      if (!aiPredictionValid) {
        return {
          success: false,
          error: 'AI prediction validation failed'
        };
      }

      // Get optimized gas price
      const gasPrice = await this.getOptimizedGasPrice();

      // Prepare transaction parameters
      const transactionParams = await this.prepareTransaction(
        tradeParams,
        userAddress,
        gasPrice
      );

      // Execute transaction with retry logic
      const result = await this.executeTransactionWithRetry(transactionParams);

      if (result.success) {
        this.logger.info('Trade executed successfully', {
          trading: {
            symbol: `${tradeParams.tokenIn}/${tradeParams.tokenOut}`,
            action: 'trade_success',
            amount: parseFloat(tradeParams.amountIn)
          }
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Trade execution failed', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate AI prediction from smart contract
   */
  private async validateAIPrediction(): Promise<boolean> {
    try {
      const predictionStatus = await this.aiTraderContract.methods
        .getAIPredictionStatus()
        .call();

      return predictionStatus.isValid;
    } catch (error) {
      this.logger.error('Failed to validate AI prediction', error as Error);
      return false;
    }
  }

  /**
   * Prepare transaction parameters
   */
  private async prepareTransaction(
    tradeParams: any,
    userAddress: string,
    gasPrice: string
  ): Promise<any> {
    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

    let method;
    let params;

    switch (tradeParams.tradeType) {
      case 'AVAX_TO_TOKEN':
        method = this.aiTraderContract.methods.tradeExactAVAXForTokens(
          tradeParams.tokenOut,
          tradeParams.amountOutMin,
          deadline
        );
        params = {
          from: userAddress,
          value: tradeParams.amountIn,
          gasPrice: gasPrice
        };
        break;

      case 'TOKEN_TO_AVAX':
        method = this.aiTraderContract.methods.tradeExactTokensForAVAX(
          tradeParams.tokenIn,
          tradeParams.amountIn,
          tradeParams.amountOutMin,
          deadline
        );
        params = {
          from: userAddress,
          gasPrice: gasPrice
        };
        break;

      case 'TOKEN_TO_TOKEN':
        method = this.aiTraderContract.methods.tradeExactTokensForTokens(
          tradeParams.tokenIn,
          tradeParams.tokenOut,
          tradeParams.amountIn,
          tradeParams.amountOutMin,
          deadline
        );
        params = {
          from: userAddress,
          gasPrice: gasPrice
        };
        break;

      default:
        throw new Error('Invalid trade type');
    }

    // Estimate gas
    const gasLimit = await this.estimateGas({
      ...params,
      data: method.encodeABI()
    });

    return {
      method,
      params: {
        ...params,
        gas: gasLimit
      }
    };
  }

  /**
   * Execute transaction with retry logic
   */
  private async executeTransactionWithRetry(
    transactionParams: any,
    maxRetries: number = 3
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Transaction attempt ${attempt}/${maxRetries}`);

        const txHash = await transactionParams.method.send(transactionParams.params);
        
        // Wait for transaction confirmation
        const receipt = await this.waitForTransactionConfirmation(txHash);
        
        if (receipt.status) {
          return {
            success: true,
            txHash: txHash
          };
        } else {
          throw new Error('Transaction failed on-chain');
        }
      } catch (error) {
        this.logger.warn(`Transaction attempt ${attempt} failed`);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Transaction failed after retries'
          };
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: 'Transaction failed after all retries'
    };
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransactionConfirmation(
    txHash: string,
    maxBlocks: number = 12
  ): Promise<any> {
    const startBlock = await this.web3.eth.getBlockNumber();
    
    while (true) {
      try {
        const receipt = await this.web3.eth.getTransactionReceipt(txHash);
        
        if (receipt) {
          return receipt;
        }
        
        const currentBlock = await this.web3.eth.getBlockNumber();
        if (currentBlock - startBlock > maxBlocks) {
          throw new Error('Transaction confirmation timeout');
        }
        
        // Wait 3 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        this.logger.error('Error waiting for transaction confirmation', error as Error);
        throw error;
      }
    }
  }

  /**
   * Get current AI prediction from smart contract
   */
  async getAIPrediction(): Promise<{
    price: number;
    confidence: number;
    timestamp: number;
    isValid: boolean;
  }> {
    try {
      const prediction = await this.priceOracleContract.methods
        .getPrediction()
        .call();

      return {
        price: Number(prediction.price) / 1e18, // Convert from wei
        confidence: Number(prediction.confidence) / 100, // Convert from basis points
        timestamp: Number(prediction.timestamp),
        isValid: prediction.isValid
      };
    } catch (error) {
      this.logger.error('Failed to get AI prediction', error as Error);
      throw error;
    }
  }

  /**
   * Get user's token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        // AVAX balance
        const balance = await this.web3.eth.getBalance(userAddress);
        return this.web3.utils.fromWei(balance, 'ether');
      } else {
        // ERC20 token balance
        const tokenContract = new this.web3.eth.Contract([
          {
            constant: true,
            inputs: [{ name: '_owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: 'balance', type: 'uint256' }],
            type: 'function'
          }
        ], tokenAddress);

        const balance = await tokenContract.methods.balanceOf(userAddress).call();
        return this.web3.utils.fromWei((balance as any).toString(), 'ether');
      }
    } catch (error) {
      this.logger.error('Failed to get token balance', error as Error);
      return '0';
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
    gasUsed?: number;
  }> {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { status: 'pending' };
      }
      
      return {
        status: receipt.status ? 'confirmed' : 'failed',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      this.logger.error('Failed to get transaction status', error as Error);
      return { status: 'pending' };
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; networkId?: number } {
    return {
      connected: this.isConnected,
      networkId: undefined // Will be set after initialization
    };
  }

  /**
   * Get Web3 instance (for advanced usage)
   */
  getWeb3(): Web3 {
    return this.web3;
  }

  /**
   * Get AI Trader contract instance
   */
  getAITraderContract(): any {
    return this.aiTraderContract;
  }

  /**
   * Get Price Oracle contract instance
   */
  getPriceOracleContract(): any {
    return this.priceOracleContract;
  }
}
