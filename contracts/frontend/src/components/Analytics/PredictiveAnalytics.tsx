import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, Activity, Calendar, Settings } from 'lucide-react';

interface Prediction {
  date: string;
  value: number;
  confidence: number;
  range: {
    lower: number;
    upper: number;
  };
}

interface PredictiveModel {
  metric: string;
  predictions: Prediction[];
  confidence: number;
  accuracy: number;
  modelType: string;
  lastTrained: string;
}

interface Anomaly {
  timestamp: string;
  metric: string;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
}

interface Insight {
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  timeframe: string;
  recommendations: string[];
}

interface PredictiveAnalyticsProps {
  metric?: string;
  horizon?: string;
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({
  metric = 'user_growth',
  horizon = '30d'
}) => {
  const [predictions, setPredictions] = useState<PredictiveModel | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(metric);
  const [selectedHorizon, setSelectedHorizon] = useState(horizon);
  const [activeTab, setActiveTab] = useState<'predictions' | 'anomalies' | 'insights'>('predictions');

  useEffect(() => {
    fetchPredictiveData();
  }, [selectedMetric, selectedHorizon]);

  const fetchPredictiveData = async () => {
    setLoading(true);
    try {
      const [predictionsRes, anomaliesRes, insightsRes] = await Promise.all([
        fetch(`/api/analytics/predictive-analytics?metric=${selectedMetric}&horizon=${selectedHorizon}`),
        fetch('/api/analytics/anomaly-detection'),
        fetch('/api/analytics/predictive-insights')
      ]);

      const predictionsData = await predictionsRes.json();
      const anomaliesData = await anomaliesRes.json();
      const insightsData = await insightsRes.json();

      setPredictions(predictionsData);
      setAnomalies(anomaliesData.anomalies || []);
      setInsights(insightsData.insights || []);
    } catch (error) {
      console.error('Error fetching predictive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Predictive Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">AI-powered predictions and insights for business planning</p>
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user_growth">User Growth</option>
            <option value="revenue">Revenue</option>
            <option value="proofs_verified">Proofs Verified</option>
            <option value="response_time">Response Time</option>
            <option value="error_rate">Error Rate</option>
          </select>
          
          <select
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="1y">1 Year</option>
          </select>
        </div>
      </div>

      {predictions && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Model Accuracy</p>
                <p className="text-2xl font-bold text-blue-900">
                  {(predictions.accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <Brain className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Confidence</p>
                <p className={`text-2xl font-bold ${getConfidenceColor(predictions.confidence)}`}>
                  {(predictions.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Model Type</p>
                <p className="text-lg font-bold text-purple-900 capitalize">
                  {predictions.modelType.replace('_', ' ')}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Last Trained</p>
                <p className="text-lg font-bold text-orange-900">
                  {new Date(predictions.lastTrained).toLocaleDateString()}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-8 mb-6">
        <button
          onClick={() => setActiveTab('predictions')}
          className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'predictions'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Predictions
        </button>
        
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'anomalies'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Anomalies
        </button>
        
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'insights'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Insights
        </button>
      </div>

      {activeTab === 'predictions' && predictions && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Predicted Values with Confidence Intervals</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictions.predictions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any, name: string) => [
                      typeof value === 'number' ? value.toLocaleString() : value,
                      name === 'value' ? 'Predicted' : name === 'lower' ? 'Lower Bound' : 'Upper Bound'
                    ]}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="upper" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    name="Upper Bound"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lower" 
                    stackId="2"
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    name="Lower Bound"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Predicted Value"
                    dot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Next 7 Days</h4>
              <p className="text-2xl font-bold text-blue-600">
                {predictions.predictions[0]?.value.toLocaleString() || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                Confidence: {((predictions.predictions[0]?.confidence || 0) * 100).toFixed(1)}%
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">30 Day Average</h4>
              <p className="text-2xl font-bold text-green-600">
                {Math.round(predictions.predictions.reduce((sum, p) => sum + p.value, 0) / predictions.predictions.length).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Based on current trends
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">End of Period</h4>
              <p className="text-2xl font-bold text-purple-600">
                {predictions.predictions[predictions.predictions.length - 1]?.value.toLocaleString() || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                {selectedHorizon} projection
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Detected Anomalies</h3>
          {anomalies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No anomalies detected in the selected timeframe</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anomaly, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{anomaly.metric}</h4>
                      <p className="text-sm text-gray-600">{anomaly.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity.toUpperCase()}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                        {(anomaly.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Expected:</span>
                      <span className="ml-2 font-medium">{anomaly.expectedValue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Actual:</span>
                      <span className="ml-2 font-medium">{anomaly.value.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Deviation:</span>
                      <span className="ml-2 font-medium">
                        {((Math.abs(anomaly.value - anomaly.expectedValue) / anomaly.expectedValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(anomaly.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">AI-Generated Insights</h3>
          {insights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No insights available at this time</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{insight.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getImpactColor(insight.impact)}`}>
                        {insight.impact.toUpperCase()}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(insight.confidence)}`}>
                        {(insight.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                  
                  <div className="mb-3">
                    <span className="text-xs text-gray-500">Timeframe: {insight.timeframe}</span>
                  </div>
                  
                  {insight.recommendations.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Recommendations:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {insight.recommendations.map((rec, recIndex) => (
                          <li key={recIndex} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
