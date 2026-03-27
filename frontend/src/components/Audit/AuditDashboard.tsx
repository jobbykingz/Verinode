import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
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
  AlertTriangle,
  Shield,
  Activity,
  Users,
  FileText,
  Download,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { auditService, AuditLog, ServiceStatistics, MonitoringAlert, AuditAnalytics } from '../../services/auditService';
import { AuditSeverity, AuditStatus, AuditEventType } from '../../services/auditService';

/**
 * Dashboard Props
 */
interface AuditDashboardProps {
  className?: string;
  onNavigate?: (section: string) => void;
}

/**
 * Audit Dashboard Component
 * 
 * Provides a comprehensive overview of the audit system:
 * - Real-time statistics and metrics
 * - Security alerts and monitoring
 * - Event analytics and trends
 * - Compliance status
 * - Quick actions and navigation
 */
export const AuditDashboard: React.FC<AuditDashboardProps> = ({ className, onNavigate }) => {
  const [statistics, setStatistics] = useState<ServiceStatistics | null>(null);
  const [analytics, setAnalytics] = useState<AuditAnalytics | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [recentEvents, setRecentEvents] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [stats, analyticsData, alertsData, recentData] = await Promise.all([
        auditService.getStatistics(),
        auditService.getAnalytics(getTimeRangeFilter(selectedTimeRange)),
        auditService.getActiveAlerts(),
        auditService.searchLogs(getTimeRangeFilter(selectedTimeRange), {
          limit: 10,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        })
      ]);

      setStatistics(stats);
      setAnalytics(analyticsData);
      setAlerts(alertsData);
      setRecentEvents(recentData.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTimeRange]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Setup real-time updates
  useEffect(() => {
    auditService.connectRealTime();

    auditService.on('auditEvent', (event: AuditLog) => {
      setRecentEvents(prev => [event, ...prev.slice(0, 9)]);
      setStatistics(prev => prev ? {
        ...prev,
        logsThisHour: prev.logsThisHour + 1,
        logsToday: prev.logsToday + 1,
        totalLogs: prev.totalLogs + 1
      } : null);
    });

    auditService.on('alertCreated', (alert: MonitoringAlert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    return () => {
      auditService.disconnectRealTime();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await auditService.resolveAlert(alertId, 'current_user');
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getTimeRangeFilter = (range: string) => {
    const now = new Date();
    let fromDate: Date;

    switch (range) {
      case '1h':
        fromDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return {
      fromDate: auditService.formatDate(fromDate),
      toDate: auditService.formatDate(now)
    };
  };

  const getSeverityIcon = (severity: AuditSeverity) => {
    switch (severity) {
      case AuditSeverity.CRITICAL:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case AuditSeverity.HIGH:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case AuditSeverity.MEDIUM:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case AuditSeverity.LOW:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: AuditStatus) => {
    switch (status) {
      case AuditStatus.SUCCESS:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case AuditStatus.FAILURE:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case AuditStatus.WARNING:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case AuditStatus.PENDING:
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.totalLogs.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {statistics?.logsToday.toLocaleString() || 0} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics?.criticalEvents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statistics?.securityEvents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Security-related incidents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics?.complianceScore || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall compliance status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Event Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>Events over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
                <CardDescription>Events by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Critical', value: analytics?.summary.criticalEvents || 0, color: '#ef4444' },
                        { name: 'High', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.high || 0), 0), color: '#f59e0b' },
                        { name: 'Medium', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.medium || 0), 0), color: '#3b82f6' },
                        { name: 'Low', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.low || 0), 0), color: '#10b981' },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Critical', value: analytics?.summary.criticalEvents || 0, color: '#ef4444' },
                        { name: 'High', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.high || 0), 0), color: '#f59e0b' },
                        { name: 'Medium', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.medium || 0), 0), color: '#3b82f6' },
                        { name: 'Low', value: analytics?.timeline.reduce((sum, period) => sum + (period.severityBreakdown.low || 0), 0), color: '#10b981' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Security and compliance alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getSeverityIcon(alert.severity as AuditSeverity)}
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-500">
                            {auditService.formatTimestamp(alert.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                        {!alert.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Users */}
            <Card>
              <CardHeader>
                <CardTitle>Top Active Users</CardTitle>
                <CardDescription>Users with most activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topUsers.slice(0, 5).map((user, index) => (
                    <div key={user.userId} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{user.userId}</p>
                          <p className="text-sm text-gray-600">{user.eventCount} events</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        {auditService.formatTimestamp(user.lastActivity)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Event Types */}
            <Card>
              <CardHeader>
                <CardTitle>Top Event Types</CardTitle>
                <CardDescription>Most frequent event types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics?.topEventTypes.slice(0, 5) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="eventType" 
                      tickFormatter={(value) => auditService.truncateText(value, 10)}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, 'Count']}
                      labelFormatter={(value) => auditService.getEventTypeLabel(value as AuditEventType)}
                    />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Security Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Security Metrics</CardTitle>
              <CardDescription>Security-related statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {analytics?.securityMetrics.suspiciousActivity || 0}
                  </div>
                  <p className="text-sm text-gray-600">Suspicious Activity</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics?.securityMetrics.blockedRequests || 0}
                  </div>
                  <p className="text-sm text-gray-600">Blocked Requests</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {analytics?.securityMetrics.failedLogins || 0}
                  </div>
                  <p className="text-sm text-gray-600">Failed Logins</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics?.securityMetrics.uniqueIPs || 0}
                  </div>
                  <p className="text-sm text-gray-600">Unique IPs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Alerts</CardTitle>
              <CardDescription>Security and compliance alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getSeverityIcon(alert.severity as AuditSeverity)}
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-500">
                            {auditService.formatTimestamp(alert.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.type}</Badge>
                        {!alert.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Latest audit events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div key={event.auditId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(event.severity)}
                      {getStatusIcon(event.status)}
                      <div>
                        <p className="font-medium">{event.action}</p>
                        <p className="text-sm text-gray-600">
                          {event.resourceType} - {event.userId || 'System'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {auditService.formatTimestamp(event.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{event.eventType}</Badge>
                      <Badge 
                        style={{ backgroundColor: auditService.getSeverityColor(event.severity) }}
                        className="text-white"
                      >
                        {event.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common audit tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => onNavigate?.('search')}
            >
              <Search className="h-4 w-4 mr-2" />
              Search Logs
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onNavigate?.('reports')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onNavigate?.('export')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onNavigate?.('integrity')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Verify Integrity
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditDashboard;
