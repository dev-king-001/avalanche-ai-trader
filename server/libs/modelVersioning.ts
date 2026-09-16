import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger.js';
import { MetricsCollector } from '../utils/metrics.js';
import { EnvironmentManager } from '../config/environment.js';

interface ModelMetadata {
  version: string;
  modelType: string;
  trainingDate: string;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  dataVersion: string;
  hyperparameters: Record<string, any>;
  validationScores: number[];
  deploymentDate: string;
  status: 'active' | 'inactive' | 'testing';
  trafficSplit?: number;
}

interface ABTest {
  id: string;
  modelA: string;
  modelB: string;
  trafficSplit: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'stopped';
  results: {
    modelAPerformance: ModelPerformance;
    modelBPerformance: ModelPerformance;
    winner?: string;
  };
}

interface ModelPerformance {
  predictions: number;
  accuracy: number;
  latency: number;
  memoryUsage: number;
  businessImpact: number;
}

export class ModelVersionManager {
  private static instance: ModelVersionManager;
  private logger: Logger;
  private metrics: MetricsCollector;
  private envManager: EnvironmentManager;
  private models: Map<string, ModelMetadata> = new Map();
  private abTests: Map<string, ABTest> = new Map();
  private modelDirectory: string;

  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = MetricsCollector.getInstance();
    this.envManager = EnvironmentManager.getInstance();
    this.modelDirectory = path.join(process.cwd(), 'server', 'models');
    this.initializeModelDirectory();
  }

  public static getInstance(): ModelVersionManager {
    if (!ModelVersionManager.instance) {
      ModelVersionManager.instance = new ModelVersionManager();
    }
    return ModelVersionManager.instance;
  }

  private async initializeModelDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.modelDirectory, { recursive: true });
      await this.loadExistingModels();
      await this.loadExistingABTests();
    } catch (error) {
      this.logger.error('Failed to initialize model directory', error as Error);
    }
  }

  private async loadExistingModels(): Promise<void> {
    try {
      const files = await fs.readdir(this.modelDirectory);
      const modelFiles = files.filter(file => file.endsWith('.json'));

      for (const file of modelFiles) {
        const content = await fs.readFile(path.join(this.modelDirectory, file), 'utf8');
        const metadata: ModelMetadata = JSON.parse(content);
        this.models.set(metadata.version, metadata);
      }

      this.logger.info(`Loaded ${this.models.size} existing models`);
    } catch (error) {
      this.logger.error('Failed to load existing models', error as Error);
    }
  }

  private async loadExistingABTests(): Promise<void> {
    try {
      const abTestFile = path.join(this.modelDirectory, 'ab-tests.json');
      if (await fs.access(abTestFile).then(() => true).catch(() => false)) {
        const content = await fs.readFile(abTestFile, 'utf8');
        const tests: ABTest[] = JSON.parse(content);
        tests.forEach(test => this.abTests.set(test.id, test));
        this.logger.info(`Loaded ${this.abTests.size} existing A/B tests`);
      }
    } catch (error) {
      this.logger.error('Failed to load existing A/B tests', error as Error);
    }
  }

  public async deployModel(
    modelData: any,
    version: string,
    modelType: string,
    metadata: Partial<ModelMetadata>
  ): Promise<ModelMetadata> {
    try {
      // Validate model data
      await this.validateModel(modelData, modelType);

      // Create model metadata
      const modelMetadata: ModelMetadata = {
        version,
        modelType,
        trainingDate: new Date().toISOString(),
        performance: metadata.performance || {
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0
        },
        dataVersion: metadata.dataVersion || '1.0.0',
        hyperparameters: metadata.hyperparameters || {},
        validationScores: metadata.validationScores || [],
        deploymentDate: new Date().toISOString(),
        status: 'inactive'
      };

      // Save model data
      const modelFile = path.join(this.modelDirectory, `${version}.bin`);
      await fs.writeFile(modelFile, JSON.stringify(modelData));

      // Save metadata
      const metadataFile = path.join(this.modelDirectory, `${version}.json`);
      await fs.writeFile(metadataFile, JSON.stringify(modelMetadata, null, 2));

      // Store in memory
      this.models.set(version, modelMetadata);

      // Log deployment
      this.logger.logDeploymentEvent(version, 'deploy', {
        modelType,
        performance: modelMetadata.performance as any
      });

      this.logger.info(`Model ${version} deployed successfully`, {
        modelVersion: version,
        modelType
      });

      return modelMetadata;
    } catch (error) {
      this.logger.logDeploymentEvent(version, 'deploy', {
        modelType,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async validateModel(modelData: any, modelType: string): Promise<void> {
    // Basic validation - can be extended based on model type
    if (!modelData) {
      throw new Error('Model data is required');
    }

    if (modelType === 'lstm' && (!modelData.layers || !modelData.weights)) {
      throw new Error('Invalid LSTM model structure');
    }

    if (modelType === 'qlearning' && (!modelData.qTable || !modelData.parameters)) {
      throw new Error('Invalid Q-Learning model structure');
    }
  }

  public getActiveModel(modelType: string): ModelMetadata | null {
    const activeModels = Array.from(this.models.values())
      .filter(model => model.modelType === modelType && model.status === 'active');

    if (activeModels.length === 0) {
      return null;
    }

    // Return the most recently deployed active model
    return activeModels.sort((a, b) => 
      new Date(b.deploymentDate).getTime() - new Date(a.deploymentDate).getTime()
    )[0];
  }

  public async createABTest(
    modelA: string,
    modelB: string,
    trafficSplit: number = 50
  ): Promise<ABTest> {
    try {
      // Validate models exist
      if (!this.models.has(modelA) || !this.models.has(modelB)) {
        throw new Error('One or both models do not exist');
      }

      // Validate traffic split
      if (trafficSplit < 0 || trafficSplit > 100) {
        throw new Error('Traffic split must be between 0 and 100');
      }

      const testId = crypto.randomUUID();
      const abTest: ABTest = {
        id: testId,
        modelA,
        modelB,
        trafficSplit,
        startDate: new Date().toISOString(),
        status: 'active',
        results: {
          modelAPerformance: {
            predictions: 0,
            accuracy: 0,
            latency: 0,
            memoryUsage: 0,
            businessImpact: 0
          },
          modelBPerformance: {
            predictions: 0,
            accuracy: 0,
            latency: 0,
            memoryUsage: 0,
            businessImpact: 0
          }
        }
      };

      // Set models to testing status
      const modelAMetadata = this.models.get(modelA)!;
      const modelBMetadata = this.models.get(modelB)!;
      
      modelAMetadata.status = 'testing';
      modelBMetadata.status = 'testing';
      modelAMetadata.trafficSplit = trafficSplit;
      modelBMetadata.trafficSplit = 100 - trafficSplit;

      // Save updated metadata
      await this.saveModelMetadata(modelA, modelAMetadata);
      await this.saveModelMetadata(modelB, modelBMetadata);

      // Store A/B test
      this.abTests.set(testId, abTest);
      await this.saveABTests();

      this.logger.info(`A/B test ${testId} created`, {
        modelA,
        modelB,
        trafficSplit
      });

      return abTest;
    } catch (error) {
      this.logger.error('Failed to create A/B test', error as Error);
      throw error;
    }
  }

  public async evaluateABTest(testId: string): Promise<ABTest> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'active') {
      throw new Error('A/B test is not active');
    }

    // Calculate performance metrics
    const modelAPerformance = await this.calculateModelPerformance(test.modelA);
    const modelBPerformance = await this.calculateModelPerformance(test.modelB);

    test.results.modelAPerformance = modelAPerformance;
    test.results.modelBPerformance = modelBPerformance;

    // Determine winner based on business impact
    if (modelBPerformance.businessImpact > modelAPerformance.businessImpact) {
      test.results.winner = test.modelB;
    } else {
      test.results.winner = test.modelA;
    }

    this.logger.info(`A/B test ${testId} evaluation completed`, {
      winner: test.results.winner,
      modelAPerformance,
      modelBPerformance
    });

    return test;
  }

  private async calculateModelPerformance(modelVersion: string): Promise<ModelPerformance> {
    const model = this.models.get(modelVersion);
    if (!model) {
      throw new Error(`Model ${modelVersion} not found`);
    }

    // This would typically involve running the model on test data
    // For now, we'll use the stored performance metrics
    return {
      predictions: 1000, // Mock data
      accuracy: model.performance.accuracy,
      latency: 150, // Mock latency in ms
      memoryUsage: 512, // Mock memory usage in MB
      businessImpact: model.performance.accuracy * 100 // Simple business impact calculation
    };
  }

  public async promoteModel(version: string): Promise<void> {
    try {
      const model = this.models.get(version);
      if (!model) {
        throw new Error(`Model ${version} not found`);
      }

      // Deactivate all other models of the same type
      for (const [modelVersion, modelData] of this.models.entries()) {
        if (modelData.modelType === model.modelType && modelVersion !== version) {
          modelData.status = 'inactive';
          await this.saveModelMetadata(modelVersion, modelData);
        }
      }

      // Activate the promoted model
      model.status = 'active';
      model.trafficSplit = 100;
      await this.saveModelMetadata(version, model);

      this.logger.logDeploymentEvent(version, 'promote', {
        modelType: model.modelType
      });

      this.logger.info(`Model ${version} promoted to production`);
    } catch (error) {
      this.logger.error('Failed to promote model', error as Error);
      throw error;
    }
  }

  public async rollbackModel(previousVersion: string): Promise<void> {
    try {
      const currentActive = this.getActiveModel(this.models.get(previousVersion)?.modelType || '');
      if (!currentActive) {
        throw new Error('No active model to rollback');
      }

      // Deactivate current model
      currentActive.status = 'inactive';
      await this.saveModelMetadata(currentActive.version, currentActive);

      // Activate previous model
      const previousModel = this.models.get(previousVersion);
      if (!previousModel) {
        throw new Error(`Previous model ${previousVersion} not found`);
      }

      previousModel.status = 'active';
      previousModel.trafficSplit = 100;
      await this.saveModelMetadata(previousVersion, previousModel);

      this.logger.logDeploymentEvent(previousVersion, 'rollback', {
        modelType: previousModel.modelType,
        fromVersion: currentActive.version
      });

      this.logger.info(`Rolled back to model ${previousVersion}`);
    } catch (error) {
      this.logger.error('Failed to rollback model', error as Error);
      throw error;
    }
  }

  public getModelVersions(modelType?: string): ModelMetadata[] {
    let models = Array.from(this.models.values());
    
    if (modelType) {
      models = models.filter(model => model.modelType === modelType);
    }

    return models.sort((a, b) => 
      new Date(b.deploymentDate).getTime() - new Date(a.deploymentDate).getTime()
    );
  }

  public getABTests(): ABTest[] {
    return Array.from(this.abTests.values());
  }

  public getABTest(testId: string): ABTest | null {
    return this.abTests.get(testId) || null;
  }

  public async updateModelMetrics(version: string, metrics: Partial<ModelPerformance>): Promise<void> {
    const model = this.models.get(version);
    if (!model) {
      throw new Error(`Model ${version} not found`);
    }

    // Update performance metrics
    if (metrics.accuracy !== undefined) {
      model.performance.accuracy = metrics.accuracy;
    }

    await this.saveModelMetadata(version, model);
  }

  private async saveModelMetadata(version: string, metadata: ModelMetadata): Promise<void> {
    const metadataFile = path.join(this.modelDirectory, `${version}.json`);
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  }

  private async saveABTests(): Promise<void> {
    const abTestFile = path.join(this.modelDirectory, 'ab-tests.json');
    const tests = Array.from(this.abTests.values());
    await fs.writeFile(abTestFile, JSON.stringify(tests, null, 2));
  }

  public getModelStatus(): any {
    const activeModels = Array.from(this.models.values())
      .filter(model => model.status === 'active');
    
    const testingModels = Array.from(this.models.values())
      .filter(model => model.status === 'testing');

    const activeABTests = Array.from(this.abTests.values())
      .filter(test => test.status === 'active');

    return {
      activeModels: activeModels.length,
      testingModels: testingModels.length,
      activeABTests: activeABTests.length,
      totalModels: this.models.size,
      totalABTests: this.abTests.size
    };
  }
}














