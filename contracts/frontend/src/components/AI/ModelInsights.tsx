import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Zap,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  RefreshCw
} from 'lucide-react';

interface ModelInsightsProps {
  modelData: {
    modelVersion: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
    confusionMatrix: number[][];
    featureImportance: { [key: string]: number };
    predictionDistribution: { [key: string]: number };
    calibrationCurve: number[][];
    trainingHistory: Array<{
      version: string;
      accuracy: number;
      date: string;
    }>;
    performanceMetrics: {
      totalValidations: number;
      averageProcessingTime: number;
      uptime: number;
      errorRate: number;
    };
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  onRetrainModel?: () => void;
  onExportReport?: () => void;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  onTimeRangeChange?: (range: string) => void;
}

const ModelInsights: React.FC<ModelInsightsProps> = ({
  modelData,
  onRetrainModel,
  onExportReport,
  timeRange = '24h',
  onTimeRangeChange
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRefreshing(false);
  };

  const getPerformanceColor = (value: number, threshold: number = 0.8) => {
    if (value >= threshold) return 'text-green-600';
    if (value >= threshold - 0.1) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (value: number, threshold: number = 0.8) => {
    if (value >= threshold) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  // Prepare data for charts
  const performanceData = [
    { name: 'Accuracy', value: modelData.accuracy * 100, threshold: 80 },
    { name: 'Precision', value: modelData.precision * 100, threshold: 80 },
    { name: 'Recall', value: modelData.recall * 100, threshold: 80 },
    { name: 'F1 Score', value: modelData.f1Score * 100, threshold: 80 },
    { name: 'AUC', value: modelData.auc * 100, threshold: 85 },
  ];

  const riskDistributionData = [
    { name: 'Low', value: modelData.riskDistribution.low, color: '#10b981' },
    { name: 'Medium', value: modelData.riskDistribution.medium, color: '#f59e0b' },
    { name: 'High', value: modelData.riskDistribution.high, color: '#f97316' },
    { name: 'Critical', value: modelData.riskDistribution.critical, color: '#ef4444' },
  ];

  const featureImportanceData = Object.entries(modelData.featureImportance)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([feature, importance]) => ({
      name: feature.replace(/([A-Z])/g, ' $1').trim(),
      value: importance * 100,
    }));

  const predictionDistributionData = Object.entries(modelData.predictionDistribution)
    .map(([range, count]) => ({
      range,
      count,
    }));

  const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Brain className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Model Insights</h2>
            <p className="text-gray-600">AI Model Performance and Analytics</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {onExportReport && (
            <Button variant="outline" onClick={onExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
          {onRetrainModel && (
            <Button onClick={onRetrainModel}>
              <Brain className="h-4 w-4 mr-2" />
              Retrain Model
            </Button>
          )}
        </div>
      </div>

      {/* Model Version Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Model Performance</span>
              </CardTitle>
              <CardDescription>
                Version {modelData.modelVersion} • Last updated: {new Date().toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {performanceData.map((metric) => (
              <div key={metric.name} className="text-center">
                <div className={`flex items-center justify-center space-x-1 ${getPerformanceColor(metric.value / 100)}`}>
                  {getPerformanceIcon(metric.value / 100)}
                  <span className="text-2xl font-bold">
                    {metric.value.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-600">{metric.name}</div>
                <Progress value={metric.value} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChartIcon className="h-5 w-5" />
                  <span>Risk Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>System Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Validations</span>
                  <span className="font-bold">{modelData.performanceMetrics.totalValidations.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Processing Time</span>
                  <span className="font-bold">{modelData.performanceMetrics.averageProcessingTime.toFixed(0)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">System Uptime</span>
                  <span className="font-bold text-green-600">{modelData.performanceMetrics.uptime.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Rate</span>
                  <span className={`font-bold ${modelData.performanceMetrics.errorRate < 1 ? 'text-green-600' : 'text-red-600'}`}>
                    {modelData.performanceMetrics.errorRate.toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                    <Bar dataKey="threshold" fill="#e5e7eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Confusion Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Confusion Matrix</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {modelData.confusionMatrix[0][0]}
                    </div>
                    <div className="text-sm text-gray-600">True Positive</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {modelData.confusionMatrix[0][1]}
                    </div>
                    <div className="text-sm text-gray-600">False Positive</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded">
                    <div className="text-2xl font-bold text-orange-600">
                      {modelData.confusionMatrix[1][0]}
                    </div>
                    <div className="text-sm text-gray-600">False Negative</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {modelData.confusionMatrix[1][1]}
                    </div>
                    <div className="text-sm text-gray-600">True Negative</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Feature Importance</span>
              </CardTitle>
              <CardDescription>
                Most influential features in model predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={featureImportanceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Prediction Distribution</span>
              </CardTitle>
              <CardDescription>
                Distribution of prediction confidence scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={predictionDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#93c5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Training History</span>
              </CardTitle>
              <CardDescription>
                Model performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={modelData.trainingHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModelInsights;
