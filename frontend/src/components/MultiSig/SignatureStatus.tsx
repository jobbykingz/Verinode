import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Users, 
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Timer,
  Shield,
  Eye,
  RefreshCw,
  Download,
  Filter,
  Search
} from 'lucide-react';
import { multiSigService } from '../../services/multiSigService';
import { toast } from 'react-hot-toast';

interface SignatureStatusProps {
  walletId?: string;
  refreshInterval?: number;
}

interface SignatureStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  executedRequests: number;
  failedRequests: number;
  averageSignaturesPerRequest: number;
  averageConfirmationTime: number;
  signerParticipation: Array<{
    signerAddress: string;
    signerName: string;
    totalSignatures: number;
    participationRate: number;
    averageResponseTime: number;
  }>;
}

interface SuspiciousPattern {
  type: 'RAPID_SIGNING' | 'UNUSUAL_TIME' | 'DUPLICATE_IP' | 'SIGNATURE_ANOMALY';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedSignatures: string[];
  recommendation: string;
}

interface RecentRequest {
  requestId: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  threshold: {
    current: number;
    required: number;
  };
  priority: string;
}

export const SignatureStatus: React.FC<SignatureStatusProps> = ({ 
  walletId, 
  refreshInterval = 30000 
}) => {
  const [stats, setStats] = useState<SignatureStats | null>(null);
  const [suspiciousPatterns, setSuspiciousPatterns] = useState<SuspiciousPattern[]>([]);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (walletId) {
      loadData();
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [walletId, refreshInterval]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (walletId) {
        const [statsData, patternsData] = await Promise.all([
          multiSigService.getSignatureStats(walletId),
          multiSigService.detectSuspiciousPatterns(walletId)
        ]);
        
        setStats(statsData);
        setSuspiciousPatterns(patternsData);
      }

      // Load recent requests (mock data for now)
      setRecentRequests([
        {
          requestId: 'req_1',
          title: 'Create new proof',
          type: 'PROOF_CREATION',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          threshold: { current: 2, required: 3 },
          priority: 'MEDIUM'
        },
        {
          requestId: 'req_2',
          title: 'Verify proof #123',
          type: 'PROOF_VERIFICATION',
          status: 'APPROVED',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          threshold: { current: 3, required: 3 },
          priority: 'HIGH'
        }
      ]);

    } catch (error) {
      toast.error('Failed to load signature status');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'yellow';
      case 'APPROVED': return 'green';
      case 'REJECTED': return 'red';
      case 'EXPIRED': return 'gray';
      case 'EXECUTED': return 'blue';
      case 'FAILED': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      case 'EXPIRED': return <Timer className="h-4 w-4" />;
      case 'EXECUTED': return <Shield className="h-4 w-4" />;
      case 'FAILED': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'secondary';
      case 'MEDIUM': return 'default';
      case 'HIGH': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'secondary';
      case 'MEDIUM': return 'default';
      case 'HIGH': return 'destructive';
      case 'CRITICAL': return 'destructive';
      default: return 'default';
    }
  };

  const filteredRequests = recentRequests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.requestId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || request.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (!walletId) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Wallet Selected</h3>
          <p className="text-gray-500 text-center">
            Select a wallet to view signature status and analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Signature Status Dashboard
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.totalRequests > 0 
                      ? Math.round((stats.executedRequests / stats.totalRequests) * 100)
                      : 0}%
                  </p>
                </div>
                {stats.executedRequests > 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">{stats.pendingRequests}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.averageConfirmationTime / 60)}m
                  </p>
                </div>
                <Timer className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="signers">Signers</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Request Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalRequests}</div>
                      <div className="text-sm text-gray-500">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</div>
                      <div className="text-sm text-gray-500">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.approvedRequests}</div>
                      <div className="text-sm text-gray-500">Approved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.executedRequests}</div>
                      <div className="text-sm text-gray-500">Executed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.failedRequests}</div>
                      <div className="text-sm text-gray-500">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Average Signatures per Request</span>
                      <span className="text-sm text-gray-500">{stats.averageSignaturesPerRequest.toFixed(1)}</span>
                    </div>
                    <Progress value={(stats.averageSignaturesPerRequest / 5) * 100} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Average Confirmation Time</span>
                      <span className="text-sm text-gray-500">{Math.round(stats.averageConfirmationTime / 60)} minutes</span>
                    </div>
                    <Progress value={Math.min((stats.averageConfirmationTime / 3600) * 100, 100)} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Requests</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search requests..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="EXECUTED">Executed</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No requests found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request) => (
                    <Card key={request.requestId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            {getStatusIcon(request.status)}
                          </div>
                          <div>
                            <h4 className="font-semibold">{request.title}</h4>
                            <p className="text-sm text-gray-500">
                              {request.type.replace('_', '')} • {new Date(request.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(request.priority)}>
                            {request.priority}
                          </Badge>
                          <Badge variant={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                          <div className="text-sm text-gray-500">
                            {request.threshold.current}/{request.threshold.required}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signers" className="space-y-4">
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Signer Participation</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.signerParticipation.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No signer data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.signerParticipation.map((signer, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold">{signer.signerName}</h4>
                            <p className="text-sm text-gray-500">{signer.signerAddress}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{signer.totalSignatures}</div>
                            <div className="text-sm text-gray-500">Total Signatures</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Participation Rate</span>
                              <span className="text-sm text-gray-500">{Math.round(signer.participationRate * 100)}%</span>
                            </div>
                            <Progress value={signer.participationRate * 100} />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Avg Response Time</span>
                              <span className="text-sm text-gray-500">{Math.round(signer.averageResponseTime / 60)}m</span>
                            </div>
                            <Progress value={Math.min((signer.averageResponseTime / 3600) * 100, 100)} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {suspiciousPatterns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No suspicious patterns detected</p>
                  <p className="text-sm">All signature activities appear normal</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suspiciousPatterns.map((pattern, index) => (
                    <Card key={index} className="p-4 border-l-4 border-l-orange-500">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          <h4 className="font-semibold">{pattern.type.replace('_', ' ')}</h4>
                          <Badge variant={getSeverityColor(pattern.severity)}>
                            {pattern.severity}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{pattern.description}</p>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm font-medium mb-1">Recommendation:</p>
                        <p className="text-sm text-gray-600">{pattern.recommendation}</p>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          {pattern.affectedSignatures.length} signature(s) affected
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
