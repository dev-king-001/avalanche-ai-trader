import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { useToast } from './ui/use-toast';
import { PortfolioSummary } from './PortfolioSummary';
import { PerformanceMetrics } from './PerformanceMetrics';
import { BacktestingInterface } from './BacktestingInterface';
import { RebalancingInterface } from './RebalancingInterface';
import TradingHistory from './TradingHistory';
import { AutoTradingManager } from './AutoTradingManager';
import TradeControls from './TradeControls';
import AIInsights from './AIInsights';
import PriceChart from './PriceChart';
import { StreamingStatus } from './StreamingStatus';
import { SignalAnalysis } from './SignalAnalysis';
import { PerformanceComparison } from './PerformanceComparison';
import { RiskAlerts } from './RiskAlerts';
import { AllocationAnalysis } from './AllocationAnalysis';
import WalletConnection from './WalletConnection';
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics';
import { useWeb3 } from '../hooks/useWeb3';
import { useAITrading } from '../hooks/useAITrading';
import { useIsMobile } from '../hooks/use-mobile';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target, 
  AlertTriangle, 
  Settings,
  PieChart,
  LineChart,
  Activity,
  Zap,
  Shield,
  DollarSign,
  Bot,
  ChartBar,
  RefreshCw,
  Bell,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Wallet
} from 'lucide-react';
import { cn } from '../lib/utils';

export const TradingDashboard: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const {
    portfolioMetrics,
    riskMetrics,
    aiPerformanceMetrics,
    isLoading: analyticsLoading,
    error: analyticsError,
    refreshAnalytics
  } = usePortfolioAnalytics();

  const { 
    avaxBalance, 
    usdtBalance, 
    portfolioValueUSDT, 
    isLoading: web3Loading,
    isConnected,
    connectWallet
  } = useWeb3();
  const { currentSignal, isInitialized } = useAITrading();
  
  const [activeTab, setActiveTab] = useState('manual');
  const [showBacktesting, setShowBacktesting] = useState(false);
  const [showRebalancing, setShowRebalancing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshAnalytics();
      setLastUpdate(new Date());
      toast({
        title: "Data Updated",
        description: "Portfolio data has been refreshed successfully.",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to refresh portfolio data. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshAnalytics, toast]);

  // Add notification
  const addNotification = useCallback((type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10 notifications
  }, []);

  // Risk alert notifications
  useEffect(() => {
    if (portfolioMetrics.maxDrawdown > 0.15) {
      addNotification('warning', 'High Drawdown Alert', 'Portfolio drawdown exceeds 15%. Consider risk management.');
    }
    if (riskMetrics.var > 0.08) {
      addNotification('error', 'Risk Limit Exceeded', 'Value at Risk exceeds 8%. Immediate action recommended.');
    }
    if (aiPerformanceMetrics.predictionAccuracy > 0.8) {
      addNotification('success', 'AI Performance', 'AI prediction accuracy is excellent!');
    }
  }, [portfolioMetrics.maxDrawdown, riskMetrics.var, aiPerformanceMetrics.predictionAccuracy, addNotification]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  };

  const getMetricColor = (value: number, threshold: number, reverse = false) => {
    const isGood = reverse ? value <= threshold : value >= threshold;
    return isGood ? 'text-green-600' : 'text-red-600';
  };

  const getMetricIcon = (value: number, threshold: number, reverse = false) => {
    const isGood = reverse ? value <= threshold : value >= threshold;
    return isGood ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  if (web3Loading || analyticsLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {analyticsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Error loading dashboard data: {analyticsError}</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {/* Enhanced Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Avalanche AI Trader Logo" className="w-10 h-10 rounded-md shadow-sm object-cover" />
            <h1 className="text-2xl lg:text-3xl font-bold">AI Trading Dashboard</h1>
            <div className="flex items-center gap-2">
              <Badge variant={isInitialized ? 'default' : 'secondary'} className="hidden sm:flex">
                <Bot className="w-3 h-3 mr-1" />
                AI {isInitialized ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Wifi className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground text-sm lg:text-base">
            Advanced portfolio management and automated trading
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last updated: {formatTimeAgo(lastUpdate)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Wallet Connection Status */}
          {!isConnected ? (
            <Button 
              variant="default" 
              size="sm" 
              onClick={connectWallet}
              className="bg-green-600 hover:bg-green-700"
            >
              <Wallet className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Wallet Connected</span>
              <span className="sm:hidden">Connected</span>
            </Badge>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="hidden sm:flex"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                {notifications.length}
              </Badge>
            )}
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => setShowBacktesting(true)}>
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Backtest</span>
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => setShowRebalancing(true)}>
            <Target className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Rebalance</span>
          </Button>
        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent notifications</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="flex items-start gap-2 p-2 rounded border">
                  <div className="mt-0.5">
                    {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                    {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                    {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(notification.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Wallet Connection and AI Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <WalletConnection />
        </div>
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI Models</span>
                  <Badge variant={isInitialized ? 'default' : 'secondary'}>
                    {isInitialized ? 'Ready' : 'Initializing'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Prediction Engine</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Signal Generation</span>
                  <Badge variant="default">Live</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Risk Management</span>
                  <Badge variant="default">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Market Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AVAX Price</span>
                  <span className="font-medium">$24.88</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">24h Change</span>
                  <span className="text-green-600 font-medium">+2.34%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Market Cap</span>
                  <span className="font-medium">$9.2B</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Volume (24h)</span>
                  <span className="font-medium">$245M</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Target className="w-4 h-4 mr-2" />
                  Portfolio Rebalance
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Trading Settings
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Trading History
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Portfolio Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Value</span>
                <span className="text-xl font-bold">{formatCurrency(portfolioMetrics.totalValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Return</span>
                <span className={cn("font-medium", portfolioMetrics.totalReturn >= 0 ? "text-green-600" : "text-red-600")}>
                  {formatPercentage(portfolioMetrics.totalReturn)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                <span className="font-medium">{portfolioMetrics.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                <span className="text-red-600 font-medium">{formatPercentage(portfolioMetrics.maxDrawdown)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="font-medium">{formatPercentage(portfolioMetrics.winRate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Profit Factor</span>
                <span className="font-medium">{portfolioMetrics.profitFactor.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AI Accuracy</span>
                <span className="font-medium">{formatPercentage(aiPerformanceMetrics.predictionAccuracy)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Signal Count</span>
                <span className="font-medium">{aiPerformanceMetrics.signalCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                {getMetricIcon(portfolioMetrics.totalReturn, 0)}
                <p className="text-xl lg:text-2xl font-bold">{formatCurrency(portfolioMetrics.totalValue)}</p>
              </div>
              <p className={cn("text-sm", getMetricColor(portfolioMetrics.totalReturn, 0))}>
                {formatPercentage(portfolioMetrics.totalReturn)} total return
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Sharpe Ratio</p>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                {getMetricIcon(portfolioMetrics.sharpeRatio, 1)}
                <p className={cn("text-xl lg:text-2xl font-bold", getMetricColor(portfolioMetrics.sharpeRatio, 1))}>
                  {portfolioMetrics.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Risk-adjusted return</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">AI Accuracy</p>
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                {getMetricIcon(aiPerformanceMetrics.predictionAccuracy, 0.6)}
                <p className={cn("text-xl lg:text-2xl font-bold", getMetricColor(aiPerformanceMetrics.predictionAccuracy, 0.6))}>
                  {formatPercentage(aiPerformanceMetrics.predictionAccuracy)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Prediction accuracy</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                {getMetricIcon(portfolioMetrics.maxDrawdown, 0.1, true)}
                <p className={cn("text-xl lg:text-2xl font-bold", getMetricColor(portfolioMetrics.maxDrawdown, 0.1, true))}>
                  {formatPercentage(portfolioMetrics.maxDrawdown)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Peak to trough decline</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Trading Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">BUY AVAX</p>
                      <p className="text-sm text-muted-foreground">43.51 AVAX @ $20.81</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$905.65</p>
                    <p className="text-sm text-muted-foreground">2 min ago</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">SELL AVAX</p>
                      <p className="text-sm text-muted-foreground">104.49 AVAX @ $21.08</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">+$202.65</p>
                    <p className="text-sm text-muted-foreground">15 min ago</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">AI Signal Generated</p>
                      <p className="text-sm text-muted-foreground">BUY signal with 78% confidence</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$24.88</p>
                    <p className="text-sm text-muted-foreground">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Market Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fear & Greed Index</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">Greed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">RSI (14)</span>
                  <span className="font-medium">65.4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">MACD Signal</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">Bullish</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Support Level</span>
                  <span className="font-medium">$23.50</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resistance Level</span>
                  <span className="font-medium">$26.20</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Main Dashboard Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Trading Interface</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live Data</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-6">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <LineChart className="w-4 h-4" />
                <span className="hidden sm:inline">Manual Trading</span>
                <span className="sm:hidden">Manual</span>
              </TabsTrigger>
              <TabsTrigger value="auto" className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <span className="hidden sm:inline">Auto Trading</span>
                <span className="sm:hidden">Auto</span>
              </TabsTrigger>
              <TabsTrigger value="signals" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Signal Analysis</span>
                <span className="sm:hidden">Signals</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Performance</span>
                <span className="sm:hidden">Perf</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Trading History</span>
                <span className="sm:hidden">History</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <ChartBar className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Enhanced Price Chart */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LineChart className="w-5 h-5" />
                          Price Chart
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>Real-time</span>
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PriceChart />
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Trade Controls */}
                <div className="space-y-4">
                  <TradeControls />
                  <StreamingStatus 
                    isStreamingEnabled={true}
                    streamingStatus={{
                      priceStreamActive: true,
                      subgraphStreamActive: true,
                      lastPriceUpdate: Date.now() / 1000,
                      connectionErrors: []
                    }}
                    streamingError={null}
                    onEnableStreaming={() => {}}
                    onDisableStreaming={() => {}}
                  />
                </div>
              </div>

              {/* Enhanced AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      AI Insights
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Bot className="w-3 h-3 mr-1" />
                      AI Powered
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AIInsights />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto" className="space-y-6 mt-6">
              <AutoTradingManager />
            </TabsContent>

            <TabsContent value="signals" className="space-y-6 mt-6">
              <SignalAnalysis />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 mt-6">
              <PerformanceComparison />
            </TabsContent>

            <TabsContent value="history" className="space-y-6 mt-6">
              <TradingHistory />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6 mt-6">
              <div className="space-y-6">
                <RiskAlerts />
                <AllocationAnalysis />
                <PerformanceMetrics />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Enhanced Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Portfolio Summary
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioSummary />
        </CardContent>
      </Card>

      {/* Enhanced Risk Alerts */}
      {(portfolioMetrics.maxDrawdown > 0.1 || riskMetrics.var > 0.05 || portfolioMetrics.sharpeRatio < 1) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {portfolioMetrics.maxDrawdown > 0.1 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Maximum drawdown exceeds 10% threshold. Consider risk management adjustments.
                  </AlertDescription>
                </Alert>
              )}
              {riskMetrics.var > 0.05 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Value at Risk exceeds 5% limit. Portfolio may be overexposed to risk.
                  </AlertDescription>
                </Alert>
              )}
              {portfolioMetrics.sharpeRatio < 1 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Sharpe ratio below optimal level. Consider strategy optimization.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Backtesting Modal */}
      {showBacktesting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-4 w-full max-w-6xl h-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-2">
              <h2 className="text-xl lg:text-2xl font-bold">Strategy Backtesting</h2>
              <Button variant="outline" onClick={() => setShowBacktesting(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <BacktestingInterface />
          </div>
        </div>
      )}

      {/* Enhanced Rebalancing Modal */}
      {showRebalancing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-4 w-full max-w-6xl h-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-2">
              <h2 className="text-xl lg:text-2xl font-bold">Portfolio Rebalancing</h2>
              <Button variant="outline" onClick={() => setShowRebalancing(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <RebalancingInterface />
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingDashboard;
