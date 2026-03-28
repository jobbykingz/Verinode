import React, { useState, useEffect } from 'react';
import { Shield, FileText, CheckCircle, AlertTriangle, Clock, Download, RefreshCw } from 'lucide-react';
import axios from 'axios';

const ComplianceDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchDashboard();
  }, [timeRange]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/compliance/dashboard', {
        params: { timeRange, includeDetails: true }
      });
      setDashboard(response.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Requests"
          value={dashboard?.overview.totalRequests || 0}
          icon={<FileText className="h-6 w-6 text-blue-600" />}
          color="text-blue-600"
        />
        <MetricCard
          title="Completion Rate"
          value={`${dashboard?.overview.complianceRate || 0}%`}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="text-green-600"
        />
        <MetricCard
          title="Pending Requests"
          value={dashboard?.overview.pendingRequests || 0}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          color="text-yellow-600"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${dashboard?.overview.averageCompletionTime || 0}h`}
          icon={<Shield className="h-6 w-6 text-purple-600" />}
          color="text-purple-600"
        />
      </div>

      {/* Alerts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Active Alerts</h2>
        <div className="space-y-3">
          <AlertItem severity="critical" count={dashboard?.alerts.critical || 0} />
          <AlertItem severity="high" count={dashboard?.alerts.high || 0} />
          <AlertItem severity="medium" count={dashboard?.alerts.medium || 0} />
        </div>
      </div>

      {/* GDPR Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">GDPR Compliance</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatItem label="Data Subject Requests" value={dashboard?.gdprMetrics.dataSubjectRequests || 0} />
          <StatItem label="SLA Compliance Rate" value={`${dashboard?.gdprMetrics.slaComplianceRate || 0}%`} />
          <StatItem label="Average Response Time" value={`${dashboard?.gdprMetrics.averageResponseTime || 0}h`} />
          <StatItem label="Consents Granted" value={dashboard?.gdprMetrics.consentsGranted || 0} />
        </div>
      </div>

      {/* KYC/AML Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">KYC/AML Compliance</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatItem label="KYC Verifications" value={dashboard?.kycAmlMetrics.kycVerificationsCompleted || 0} />
          <StatItem label="Approval Rate" value={`${dashboard?.kycAmlMetrics.approvalRate || 0}%`} />
          <StatItem label="AML Screenings" value={dashboard?.kycAmlMetrics.amlScreeningsPerformed || 0} />
          <StatItem label="High Risk Matches" value={dashboard?.kycAmlMetrics.highRiskMatches || 0} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionButton
          icon={<FileText className="h-5 w-5" />}
          label="Generate Report"
          onClick={() => console.log('Generate Report')}
        />
        <QuickActionButton
          icon={<Download className="h-5 w-5" />}
          label="Export Data"
          onClick={() => console.log('Export Data')}
        />
        <QuickActionButton
          icon={<Shield className="h-5 w-5" />}
          label="Run Compliance Check"
          onClick={() => console.log('Run Compliance Check')}
        />
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <div className="p-3 rounded-full bg-gray-100">{icon}</div>
    </div>
  </div>
);

const AlertItem = ({ severity, count }: any) => (
  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
    <div className="flex items-center gap-3">
      <AlertTriangle className={`h-5 w-5 ${
        severity === 'critical' ? 'text-red-600' :
        severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
      }`} />
      <span className="capitalize font-medium">{severity}</span>
    </div>
    <span className="text-lg font-bold">{count}</span>
  </div>
);

const StatItem = ({ label, value }: any) => (
  <div className="p-4 bg-gray-50 rounded-lg">
    <p className="text-sm text-gray-600 mb-1">{label}</p>
    <p className="text-xl font-bold text-gray-900">{value}</p>
  </div>
);

const QuickActionButton = ({ icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

export default ComplianceDashboard;
