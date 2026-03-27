import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

interface SecurityReportProps {
  scanId: string;
  contractAddress: string;
  onRefresh?: () => void;
}

interface SecurityReportData {
  scanId: string;
  contractAddress: string;
  scanTimestamp: string;
  overallScore: number;
  gasScore: number;
  vulnerabilitySummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  patternSummary: {
    total: number;
    antiPatterns: number;
    bestPracticeViolations: number;
    gasInefficiencies: number;
    securityRisks: number;
  };
  gasAnalysis: {
    totalGasEstimate: number;
    highCostOperations: number;
    unoptimizedLoops: number;
    storageOperations: number;
    optimizationSuggestions: string[];
  };
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    category: string;
    effort: string;
    impact: string;
  }>;
  detailedFindings: {
    vulnerabilities: Array<{
      id: string;
      name: string;
      description: string;
      severity: number;
      lineNumber?: number;
      remediation: string;
      cweId?: string;
    }>;
    patterns: Array<{
      id: string;
      name: string;
      description: string;
      severity: number;
      patternType: string;
      remediation: string;
    }>;
  };
  complianceStatus: {
    overallCompliant: boolean;
    complianceScore: number;
    frameworkCompliance: Record<string, boolean>;
  };
  riskAssessment: {
    overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    securityRiskScore: number;
    gasRiskScore: number;
    operationalRiskScore: number;
    mitigationStrategies: string[];
  };
}

const SecurityReport: React.FC<SecurityReportProps> = ({
  scanId,
  contractAddress,
  onRefresh,
}) => {
  const [reportData, setReportData] = useState<SecurityReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchSecurityReport();
  }, [scanId]);

  const fetchSecurityReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/security/scan/${scanId}/report`);
      if (!response.ok) {
        throw new Error('Failed to fetch security report');
      }

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSecurityReport();
    onRefresh?.();
  };

  const handleExport = (format: 'json' | 'pdf' | 'csv') => {
    const url = `/api/security/scan/${scanId}/export?format=${format}`;
    window.open(url, '_blank');
  };

  const getSeverityColor = (severity: number): string => {
    if (severity >= 9) return 'destructive';
    if (severity >= 7) return 'destructive';
    if (severity >= 5) return 'secondary';
    if (severity >= 3) return 'outline';
    return 'secondary';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'Low': return 'text-green-600';
      case 'Medium': return 'text-yellow-600';
      case 'High': return 'text-orange-600';
      case 'Critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const vulnerabilityChartData = reportData ? [
    { name: 'Critical', value: reportData.vulnerabilitySummary.critical, color: '#dc2626' },
    { name: 'High', value: reportData.vulnerabilitySummary.high, color: '#ea580c' },
    { name: 'Medium', value: reportData.vulnerabilitySummary.medium, color: '#ca8a04' },
    { name: 'Low', value: reportData.vulnerabilitySummary.low, color: '#2563eb' },
    { name: 'Info', value: reportData.vulnerabilitySummary.info, color: '#6b7280' },
  ] : [];

  const patternChartData = reportData ? [
    { name: 'Anti-Patterns', value: reportData.patternSummary.antiPatterns, color: '#dc2626' },
    { name: 'Best Practice', value: reportData.patternSummary.bestPracticeViolations, color: '#ea580c' },
    { name: 'Gas Issues', value: reportData.patternSummary.gasInefficiencies, color: '#ca8a04' },
    { name: 'Security Risks', value: reportData.patternSummary.securityRisks, color: '#2563eb' },
  ] : [];

  const riskScoreData = reportData ? [
    { name: 'Security', score: reportData.riskAssessment.securityRiskScore },
    { name: 'Gas', score: reportData.riskAssessment.gasRiskScore },
    { name: 'Operational', score: reportData.riskAssessment.operationalRiskScore },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading security report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reportData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Report</h1>
          <p className="text-muted-foreground">
            Contract: {contractAddress} • Scan ID: {scanId}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleExport('pdf')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={() => handleExport('json')} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(reportData.overallScore)}`}>
              {reportData.overallScore}/100
            </div>
            <Progress value={reportData.overallScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gas Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(reportData.gasScore)}`}>
              {reportData.gasScore}/100
            </div>
            <Progress value={reportData.gasScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRiskLevelColor(reportData.riskAssessment.overallRiskLevel)}`}>
              {reportData.riskAssessment.overallRiskLevel}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Score: {reportData.riskAssessment.securityRiskScore}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {reportData.complianceStatus.overallCompliant ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span className="text-2xl font-bold">
                {reportData.complianceStatus.complianceScore}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData.complianceStatus.overallCompliant ? 'Compliant' : 'Non-Compliant'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="gas">Gas Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vulnerability Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Vulnerability Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={vulnerabilityChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {vulnerabilityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pattern Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={patternChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {patternChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={riskScoreData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Scan Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Scan Date</span>
                  <span className="text-sm font-medium">
                    {new Date(reportData.scanTimestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Vulnerabilities</span>
                  <Badge variant={reportData.vulnerabilitySummary.total > 0 ? 'destructive' : 'secondary'}>
                    {reportData.vulnerabilitySummary.total}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Patterns</span>
                  <Badge variant={reportData.patternSummary.total > 0 ? 'secondary' : 'outline'}>
                    {reportData.patternSummary.total}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Gas Estimate</span>
                  <span className="text-sm font-medium">
                    {reportData.gasAnalysis.totalGasEstimate.toLocaleString()} gas
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Vulnerabilities ({reportData.detailedFindings.vulnerabilities.length})
                </span>
                <Badge variant={reportData.vulnerabilitySummary.total > 0 ? 'destructive' : 'secondary'}>
                  {reportData.vulnerabilitySummary.total} Found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.detailedFindings.vulnerabilities.map((vulnerability) => (
                  <div key={vulnerability.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{vulnerability.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vulnerability.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <Badge variant={getSeverityColor(vulnerability.severity)}>
                          Severity: {vulnerability.severity}/10
                        </Badge>
                        {vulnerability.lineNumber && (
                          <Badge variant="outline">
                            Line: {vulnerability.lineNumber}
                          </Badge>
                        )}
                        {vulnerability.cweId && (
                          <Badge variant="outline">
                            {vulnerability.cweId}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <h4 className="font-medium text-sm mb-1">Remediation:</h4>
                      <p className="text-sm">{vulnerability.remediation}</p>
                    </div>
                  </div>
                ))}
                {reportData.detailedFindings.vulnerabilities.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">No vulnerabilities detected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security Patterns ({reportData.detailedFindings.patterns.length})
                </span>
                <Badge variant={reportData.patternSummary.total > 0 ? 'secondary' : 'outline'}>
                  {reportData.patternSummary.total} Found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.detailedFindings.patterns.map((pattern) => (
                  <div key={pattern.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{pattern.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {pattern.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <Badge variant={getSeverityColor(pattern.severity)}>
                          Severity: {pattern.severity}/10
                        </Badge>
                        <Badge variant="outline">
                          {pattern.patternType}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <h4 className="font-medium text-sm mb-1">Remediation:</h4>
                      <p className="text-sm">{pattern.remediation}</p>
                    </div>
                  </div>
                ))}
                {reportData.detailedFindings.patterns.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">No security patterns detected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gas Analysis Tab */}
        <TabsContent value="gas" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Gas Usage Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Gas Estimate</span>
                  <span className="text-sm font-medium">
                    {reportData.gasAnalysis.totalGasEstimate.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">High Cost Operations</span>
                  <Badge variant={reportData.gasAnalysis.highCostOperations > 0 ? 'destructive' : 'secondary'}>
                    {reportData.gasAnalysis.highCostOperations}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unoptimized Loops</span>
                  <Badge variant={reportData.gasAnalysis.unoptimizedLoops > 0 ? 'destructive' : 'secondary'}>
                    {reportData.gasAnalysis.unoptimizedLoops}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Storage Operations</span>
                  <Badge variant={reportData.gasAnalysis.storageOperations > 50 ? 'destructive' : 'secondary'}>
                    {reportData.gasAnalysis.storageOperations}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Optimization Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.gasAnalysis.optimizationSuggestions.length > 0 ? (
                    reportData.gasAnalysis.optimizationSuggestions.map((suggestion, index) => (
                      <div key={index} className="p-3 bg-muted rounded-md text-sm">
                        {suggestion}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No optimization suggestions at this time.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Recommendations ({reportData.recommendations.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{recommendation.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {recommendation.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <Badge className={getPriorityColor(recommendation.priority)}>
                          {recommendation.priority}
                        </Badge>
                        <Badge variant="outline">
                          {recommendation.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
                      <span>Effort: {recommendation.effort}</span>
                      <span>Impact: {recommendation.impact}</span>
                    </div>
                  </div>
                ))}
                {reportData.recommendations.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">No recommendations at this time</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Overall Compliance
                  </span>
                  <Badge variant={reportData.complianceStatus.overallCompliant ? 'secondary' : 'destructive'}>
                    {reportData.complianceStatus.overallCompliant ? 'Compliant' : 'Non-Compliant'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Compliance Score</span>
                      <span className="text-sm font-bold">{reportData.complianceStatus.complianceScore}%</span>
                    </div>
                    <Progress value={reportData.complianceStatus.complianceScore} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Framework Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportData.complianceStatus.frameworkCompliance).map(([framework, compliant]) => (
                    <div key={framework} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{framework}</span>
                      {compliant ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Mitigation Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportData.riskAssessment.mitigationStrategies.map((strategy, index) => (
                    <div key={index} className="p-3 border rounded-md">
                      <p className="text-sm">{strategy}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityReport;
