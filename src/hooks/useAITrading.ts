import { useState, useEffect, useCallback, useRef } from 'react';
import { AITradingSystem, ProcessedFeatures } from '@/utils/aiModels';
import { collectHistoricalData, initLiveDataStream, isStreamingActive, getStreamingStatus, startPriceStreaming, startSubgraphStreaming, stopStreaming } from '@/utils/dataCollection';
import { processMarketData, preprocessData } from '@/utils/dataPreprocessing';
import { StreamingEventType } from '@/shared/types';

/**
 * Custom hook for AI Trading functionality
 * Manages LSTM predictions, RL trading decisions, and model training
 */
export const useAITrading = () => {
  const [aiSystem, setAISystem] = useState<AITradingSystem | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<string>('');
  const [currentPrediction, setCurrentPrediction] = useState<{
    price: number;
    confidence: number;
  } | null>(null);
  const [currentSignal, setCurrentSignal] = useState<{
    action: string;
    confidence: number;
  } | null>(null);
  const [historicalData, setHistoricalData] = useState<ProcessedFeatures[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // Prediction history buffer
  const [predictionHistory, setPredictionHistory] = useState<Array<{
    predictedPrice: number;
    currentPrice: number;
    actualPrice: number | null;
    confidence: number;
    timestamp: number;
  }>>([]);
  
  // Streaming state
  const [isStreamingEnabled, setIsStreamingEnabled] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<any>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  
  // Use refs for batching to avoid stale closures and multiple timers
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferRef = useRef<any[]>([]);
  const streamHandlersRef = useRef<{
    onPriceUpdate: (event: any) => void;
    onConnectionStatus: (event: any) => void;
    onError: (event: any) => void;
  } | null>(null);

  // Simple AI state for real data
  const [useSimpleAI, setUseSimpleAI] = useState(true); // Default to simple AI

  // Initialize AI system
  const initializeAI = useCallback(async () => {
    console.log('🚀 Starting AI initialization...');
    setIsTraining(true);
    setInitializationError(null);
    
    try {
      // First, try to load existing models
      console.log('📂 Step 1: Attempting to load existing AI models...');
      const system = new AITradingSystem();
      
      try {
        await system.loadModels();
        console.log('✅ Successfully loaded existing AI models!');
        
        // Get some recent data for predictions (but don't retrain)
        console.log('📊 Step 2: Collecting recent data for predictions...');
        const rawData = await collectHistoricalData();
        const processedData = preprocessData(rawData);
        const features = processMarketData(processedData);
        
        setHistoricalData(features);
        setAISystem(system);
        setIsInitialized(true);
        setLastUpdate(new Date());
        
              // Get initial prediction with loaded models
      console.log('🔮 Getting initial AI prediction with loaded models...');
      const initialSignal = await system.getTradeSignal(features.slice(-60), 0.5);
      setCurrentPrediction(initialSignal.prediction);
      setCurrentSignal(initialSignal.decision);
      
      // Add to prediction history
      if (initialSignal.prediction) {
        setPredictionHistory(prev => [{
          predictedPrice: initialSignal.prediction.price,
          currentPrice: initialSignal.prediction.price, // Use predicted as current for now
          actualPrice: null,
          confidence: initialSignal.prediction.confidence,
          timestamp: Date.now()
        }, ...prev.slice(0, 99)]); // Keep last 100 predictions
      }
      
      console.log('✅ Initial prediction received:', initialSignal);
        
        return; // Successfully loaded, no need to train
        
      } catch (loadError: any) {
        console.log('⚠️ Could not load existing models:', loadError.message);
        console.log('🔄 Proceeding with training new models...');
      }
      
      // If loading failed, train new models
      console.log('📊 Step 2: Collecting historical data for training...');
      setTrainingProgress('📊 Collecting market data...');
      const rawData = await collectHistoricalData();
      console.log(`📊 Collected ${rawData.length} raw data points`);
      
      console.log('🔧 Step 3: Preprocessing data...');
      setTrainingProgress('🔧 Processing market data...');
      const processedData = preprocessData(rawData);
      console.log(`🔧 Preprocessed ${processedData.length} data points`);
      
      console.log('⚙️ Step 4: Processing market features...');
      setTrainingProgress('⚙️ Generating AI features...');
      const features = processMarketData(processedData);
      console.log(`⚙️ Generated ${features.length} feature sets`);
      
      setHistoricalData(features);
      
      console.log('🤖 Step 5: Training new AI models...');
      setTrainingProgress('🤖 Training LSTM model (5 epochs)...');
      await system.initialize(features, true); // Use quick mode for faster training
      
      setAISystem(system);
      setIsInitialized(true);
      setLastUpdate(new Date());
      setTrainingProgress('');
      
      console.log('✅ AI Trading System trained and initialized successfully!');
      
      // Get initial prediction
      console.log('🔮 Getting initial AI prediction...');
      const initialSignal = await system.getTradeSignal(features.slice(-60), 0.5);
      setCurrentPrediction(initialSignal.prediction);
      setCurrentSignal(initialSignal.decision);
      
      // Add to prediction history
      if (initialSignal.prediction) {
        setPredictionHistory(prev => [{
          predictedPrice: initialSignal.prediction.price,
          currentPrice: initialSignal.prediction.price, // Use predicted as current for now
          actualPrice: null,
          confidence: initialSignal.prediction.confidence,
          timestamp: Date.now()
        }, ...prev.slice(0, 99)]); // Keep last 100 predictions
      }
      
      console.log('✅ Initial prediction received:', initialSignal);
      
    } catch (error: any) {
      console.error('❌ Failed to initialize AI system:', error);
      setInitializationError(error.message || 'Unknown error during initialization');
    } finally {
      setIsTraining(false);
    }
  }, []);

  // Manual initialization trigger for testing
  const manualInitialize = useCallback(async () => {
    console.log('🔧 Manual AI initialization triggered');
    await initializeAI();
  }, [initializeAI]);

  // Check if models exist in localStorage
  const checkModelsExist = useCallback(() => {
    const lstmExists = localStorage.getItem('lstm_model') !== null;
    const rlExists = localStorage.getItem('rl_model') !== null;
    console.log('📂 Model existence check:', { lstmExists, rlExists });
    return lstmExists && rlExists;
  }, []);

  // Force retrain models (useful for updating with new data)
  const forceRetrain = useCallback(async () => {
    console.log('🔄 Force retraining AI models...');
    setIsTraining(true);
    setInitializationError(null);
    
    try {
      console.log('📊 Collecting fresh data for retraining...');
      const rawData = await collectHistoricalData();
      const processedData = preprocessData(rawData);
      const features = processMarketData(processedData);
      
      setHistoricalData(features);
      
      console.log('🤖 Training new AI models...');
      const system = new AITradingSystem();
      await system.initialize(features, true); // Use quick mode for faster training
      
      setAISystem(system);
      setIsInitialized(true);
      setLastUpdate(new Date());
      
      console.log('✅ AI models retrained successfully!');
      
      // Get initial prediction
      const initialSignal = await system.getTradeSignal(features.slice(-60), 0.5);
      setCurrentPrediction(initialSignal.prediction);
      setCurrentSignal(initialSignal.decision);
      
    } catch (error: any) {
      console.error('❌ Failed to retrain models:', error);
      setInitializationError(error.message || 'Failed to retrain models');
    } finally {
      setIsTraining(false);
    }
  }, []);

  // Get AI prediction and trading signal
  const getAISignal = useCallback(async (portfolioRatio: number = 0.5) => {
    if (!aiSystem || !isInitialized || historicalData.length === 0) {
      console.log('⚠️ Cannot get AI signal - system not ready:', {
        hasSystem: !!aiSystem,
        isInitialized,
        dataLength: historicalData.length
      });
      return null;
    }

    try {
      console.log('🔮 Getting AI signal...');
      // Use recent data for prediction
      const recentData = historicalData.slice(-60); // Last 60 data points
      const signal = await aiSystem.getTradeSignal(recentData, portfolioRatio);
      
      setCurrentPrediction(signal.prediction);
      setCurrentSignal(signal.decision);
      setLastUpdate(new Date());
      
      // Add to prediction history
      if (signal.prediction) {
        setPredictionHistory(prev => [{
          predictedPrice: signal.prediction.price,
          currentPrice: signal.prediction.price, // Use predicted as current for now
          actualPrice: null,
          confidence: signal.prediction.confidence,
          timestamp: Date.now()
        }, ...prev.slice(0, 99)]); // Keep last 100 predictions
      }
      
      console.log('✅ AI signal received:', signal);
      return signal;
    } catch (error) {
      console.error('❌ Failed to get AI signal:', error);
      return null;
    }
  }, [aiSystem, isInitialized, historicalData]);

  // Fetch from Simple AI API (real data)
  const getSimpleAISignal = useCallback(async () => {
    try {
      console.log('🔮 Getting Simple AI signal with real data...');
      const response = await fetch('/api/simple/prediction');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const { prediction, signal } = result.data;
        
        // Update state with real AI predictions
        setCurrentPrediction({
          price: prediction.price,
          confidence: prediction.confidence
        });
        
        setCurrentSignal({
          action: signal.action,
          confidence: signal.confidence
        });
        
        setLastUpdate(new Date());
        setIsInitialized(true); // Mark as initialized since we have real data
        
        // Add to prediction history
        setPredictionHistory(prev => [{
          predictedPrice: prediction.price,
          currentPrice: result.data.currentPrice,
          actualPrice: null,
          confidence: prediction.confidence,
          timestamp: Date.now()
        }, ...prev.slice(0, 99)]);
        
        console.log('✅ Simple AI signal received:', result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'Invalid response from Simple AI');
      }
    } catch (error) {
      console.error('❌ Failed to get Simple AI signal:', error);
      return null;
    }
  }, []);

  // Update model with new data
  const updateWithNewData = useCallback(async (newDataPoint: any) => {
    if (!aiSystem || !isInitialized) return;

    try {
      // Process new data point
      const processed = processMarketData([newDataPoint]);
      if (processed.length > 0) {
        setHistoricalData(prev => [...prev.slice(-999), processed[0]]);
      }
    } catch (error) {
      console.error('Failed to update with new data:', error);
    }
  }, [aiSystem, isInitialized]);

  // Retrain models with new data
  const retrainModels = useCallback(async () => {
    if (!aiSystem || historicalData.length === 0) return;

    setIsTraining(true);
    try {
      console.log('🔄 Retraining AI models...');
      await aiSystem.initialize(historicalData);
      console.log('✅ AI models retrained successfully');
    } catch (error) {
      console.error('❌ Failed to retrain models:', error);
    } finally {
      setIsTraining(false);
    }
  }, [aiSystem, historicalData]);

  // Auto-update predictions every 5 minutes
  useEffect(() => {
    if (!isInitialized || isTraining) return;

    const interval = setInterval(async () => {
      if (useSimpleAI) {
        await getSimpleAISignal();
      } else {
        await getAISignal();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isInitialized, isTraining, useSimpleAI, getAISignal, getSimpleAISignal]);

  // Streaming integration
  const enableStreaming = useCallback(async () => {
    if (isStreamingEnabled) return; // Prevent duplicate bindings
    
    try {
      console.log('🔌 Enabling real-time streaming...');
      const streamBus = await initLiveDataStream();
      
      // Start both price and subgraph streams
      await startPriceStreaming();
      await startSubgraphStreaming();
      
      // Define event handlers
      const onPriceUpdate = (event: any) => {
        console.log('💰 Received streaming price update:', event.data.price);
        
        // Add to buffer using ref
        bufferRef.current = [...bufferRef.current, event.data];
        
        // Clear existing timer and set new one for 30s batching
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current);
        }
        
        batchTimerRef.current = setTimeout(() => {
          if (bufferRef.current.length > 0) {
            // Use the latest data point in the batch
            const latestData = bufferRef.current[bufferRef.current.length - 1];
            updateWithNewData(latestData);
            console.log(`📦 Processed batch of ${bufferRef.current.length} streaming updates`);
            bufferRef.current = []; // Clear buffer
          }
        }, 30000); // 30 seconds
      };

      const onConnectionStatus = (event: any) => {
        console.log('📡 Streaming connection status:', event.status);
        setStreamingStatus(getStreamingStatus());
      };

      const onError = (event: any) => {
        console.error('❌ Streaming error:', event.error);
        setStreamingError(event.error);
      };

      // Store handlers in ref for cleanup
      streamHandlersRef.current = { onPriceUpdate, onConnectionStatus, onError };
      
      // Bind event listeners using StreamingEventType enum
      streamBus.on(StreamingEventType.PRICE_UPDATE, onPriceUpdate);
      streamBus.on(StreamingEventType.CONNECTION_STATUS, onConnectionStatus);
      streamBus.on(StreamingEventType.ERROR, onError);

      setIsStreamingEnabled(true);
      setStreamingStatus(getStreamingStatus());
      console.log('✅ Real-time streaming enabled');
    } catch (error: any) {
      console.error('❌ Failed to enable streaming:', error);
      setStreamingError(error.message);
    }
  }, [isStreamingEnabled, updateWithNewData]);

  const disableStreaming = useCallback(async () => {
    console.log('🔌 Disabling real-time streaming...');
    
    try {
      // Get stream bus and remove event listeners
      const streamBus = await initLiveDataStream();
      if (streamHandlersRef.current) {
        const handlers = streamHandlersRef.current;
        streamBus.off(StreamingEventType.PRICE_UPDATE, handlers.onPriceUpdate);
        streamBus.off(StreamingEventType.CONNECTION_STATUS, handlers.onConnectionStatus);
        streamBus.off(StreamingEventType.ERROR, handlers.onError);
        streamHandlersRef.current = null;
      }
      
      stopStreaming();
      
      // Clear batch timer using ref
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      
      // Process any remaining buffered data
      if (bufferRef.current.length > 0) {
        const latestData = bufferRef.current[bufferRef.current.length - 1];
        updateWithNewData(latestData);
        console.log(`📦 Processed final batch of ${bufferRef.current.length} streaming updates`);
        bufferRef.current = []; // Clear buffer
      }
      
      setIsStreamingEnabled(false);
      setStreamingStatus(null);
      setStreamingError(null);
      console.log('✅ Real-time streaming disabled');
    } catch (error) {
      console.error('❌ Error during streaming disable:', error);
    }
  }, [updateWithNewData]);

  // Update streaming status periodically
  useEffect(() => {
    if (!isStreamingEnabled) return;

    const interval = setInterval(() => {
      setStreamingStatus(getStreamingStatus());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [isStreamingEnabled]);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized && !isTraining) {
      console.log('🚀 Auto-initializing Simple AI system with real data...');
      if (useSimpleAI) {
        getSimpleAISignal();
      } else {
        initializeAI();
      }
    }
  }, [isInitialized, isTraining, useSimpleAI, initializeAI, getSimpleAISignal]);

  return {
    isInitialized,
    isTraining,
    trainingProgress,
    currentPrediction,
    currentSignal,
    predictionHistory,
    lastUpdate,
    initializationError,
    historicalDataLength: historicalData.length,
    initializeAI: manualInitialize, // Expose manual trigger
    getAISignal: useSimpleAI ? getSimpleAISignal : getAISignal, // Use simple AI by default
    updateWithNewData,
    retrainModels,
    checkModelsExist,
    forceRetrain,
    // Simple AI controls
    useSimpleAI,
    setUseSimpleAI,
    getSimpleAISignal,
    // Streaming controls
    isStreamingEnabled,
    streamingStatus,
    streamingError,
    enableStreaming,
    disableStreaming,
  };
};