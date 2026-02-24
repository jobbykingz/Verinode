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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Brain,
  Shield,
  Eye,
  Download
} from 'lucide-react';

interface ValidationScoreProps {
  proofId: string;
  validationData: {
    validationScore: number;
    confidenceLevel: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    suspiciousPatterns: string[];
    explainability: {
      primaryReasons: string[];
      featureImportance: { [key: string]: number };
      similarCases: Array<{
        proofId: string;
        similarity: number;
        outcome: string;
      }>;
    };
    processingTime: number;
    modelVersion: string;
    requiresReview: boolean;
  };
  onReview?: () => void;
  onExport?: () => void;
}

const ValidationScore: React.FC<ValidationScoreProps> = ({
  proofId,
  validationData,
  onReview,
  onExport
}) => {
  const [expanded, setExpanded] = useState(false);
  const [animatingScore, setAnimatingScore] = useState(false);

  useEffect(() => {
    setAnimatingScore(true);
    const timer = setTimeout(() => setAnimatingScore(false), 1000);
    return () => clearTimeout(timer);
  }, [validationData.validationScore]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <CheckCircle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <XCircle className="h-4 w-4" />;
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    if (score >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const formatProcessingTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  const getPatternDescription = (pattern: string) => {
    const descriptions: { [key: string]: string } = {
      'unusual_timestamp': 'Proof submitted at unusual time',
      'high_frequency_activity': 'High frequency of submissions',
      'regular_submission_pattern': 'Regular intervals suggest automation',
      'low_issuer_reputation': 'Issuer has suspicious history',
      'suspicious_hash_pattern': 'Hash pattern indicates manipulation',
      'unusual_content_size': 'Content size deviates from normal'
    };
    return descriptions[pattern] || pattern;
  };

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-lg">AI Validation Score</CardTitle>
                <CardDescription>Proof ID: {proofId}</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getRiskColor(validationData.riskLevel)}>
                {getRiskIcon(validationData.riskLevel)}
                <span className="ml-1">{validationData.riskLevel.toUpperCase()}</span>
              </Badge>
              <Badge variant="outline">
                v{validationData.modelVersion}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main Score Display */}
          <div className="text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="text-6xl font-bold">
                <span className={`transition-all duration-1000 ${animatingScore ? 'scale-110' : 'scale-100'}`}>
                  {(validationData.validationScore * 100).toFixed(1)}%
                </span>
              </div>
              {validationData.requiresReview && (
                <div className="absolute -top-2 -right-2">
                  <AlertTriangle className="h-6 w-6 text-orange-500 animate-pulse" />
                </div>
              )}
            </div>
            
            <div className="w-full max-w-md mx-auto">
              <Progress 
                value={validationData.validationScore * 100} 
                className="h-3"
                indicatorClassName={getScoreColor(validationData.validationScore)}
              />
            </div>
            
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span>Confidence: {(validationData.confidenceLevel * 100).toFixed(1)}%</span>
              <span>•</span>
              <span>Processed in {formatProcessingTime(validationData.processingTime)}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center space-x-3">
            {validationData.requiresReview && onReview && (
              <Button onClick={onReview} variant="outline" className="flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>Review Required</span>
              </Button>
            )}
            {onExport && (
              <Button onClick={onExport} variant="outline" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export Report</span>
              </Button>
            )}
            <Button 
              onClick={() => setExpanded(!expanded)} 
              variant="outline" 
              className="flex items-center space-x-2"
            >
              <Info className="h-4 w-4" />
              <span>{expanded ? 'Hide' : 'Show'} Details</span>
            </Button>
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="space-y-6 animate-in slide-in-from-top duration-300">
              {/* Suspicious Patterns */}
              {validationData.suspiciousPatterns.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                    Suspicious Patterns Detected
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {validationData.suspiciousPatterns.map((pattern, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger>
                          <Badge variant="destructive" className="justify-start">
                            {getPatternDescription(pattern)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{pattern}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Reasons */}
              {validationData.explainability.primaryReasons.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Brain className="h-4 w-4 mr-2 text-blue-500" />
                    Primary Reasons
                  </h4>
                  <ul className="space-y-2">
                    {validationData.explainability.primaryReasons.map((reason, index) => (
                      <li key={index} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feature Importance */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  Feature Importance
                </h4>
                <div className="space-y-3">
                  {Object.entries(validationData.explainability.featureImportance)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([feature, importance], index) => (
                      <div key={feature} className="flex items-center space-x-3">
                        <span className="text-sm font-medium w-32 capitalize">
                          {feature.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <div className="flex-1">
                          <Progress value={importance * 100} className="h-2" />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {(importance * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Similar Cases */}
              {validationData.explainability.similarCases.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-purple-500" />
                    Similar Cases
                  </h4>
                  <div className="space-y-2">
                    {validationData.explainability.similarCases.slice(0, 3).map((case_, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono">{case_.proofId}</span>
                          <Badge variant="outline" className="text-xs">
                            {(case_.similarity * 100).toFixed(1)}% similar
                          </Badge>
                        </div>
                        <Badge 
                          variant={case_.outcome === 'low' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {case_.outcome}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Information */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Model Version: {validationData.modelVersion}</span>
                  <span>Processing Time: {formatProcessingTime(validationData.processingTime)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default ValidationScore;
