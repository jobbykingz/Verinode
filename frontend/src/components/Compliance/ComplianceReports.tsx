import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Filter
} from 'lucide-react';
import axios from 'axios';

interface ComplianceReport {
  reportId: string;
  reportType: string;
  period: {
    startDate: string;
    endDate: string;
  };
  status: {
    overall: string;
    findings: any[];
  };
  generatedBy: {
    userName: string;
    timestamp: string;
  };
  requirements: any[];
}

const ComplianceReports: React.FC = () => {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    reportType: 'GDPR_COMPLIANCE',
    startDate: '',
    endDate: '',
    standards: ['GDPR'],
    format: 'PDF'
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch existing reports
      // For now, we'll show an empty state
      setReports([]);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      const response = await axios.post('/api/compliance/reports/generate', {
        ...generateForm,
        userId: 'current-user-id', // Would come from auth context
        userName: 'Current User'   // Would come from auth context
      }, {
        responseType: 'blob'
      });

      // Handle PDF download
      if (generateForm.format === 'PDF') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `compliance-report-${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setShowGenerateForm(false);
      fetchReports(); // Refresh reports list
    } catch (err: any) {
      setError('Failed to generate report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-green-100 text-green-800';
      case 'PARTIALLY_COMPLIANT': return 'bg-yellow-100 text-yellow-800';
      case 'NON_COMPLIANT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getReportIcon = (reportType: string) => {
    if (reportType.includes('GDPR')) return '🇪🇺';
    if (reportType.includes('HIPAA')) return '🏥';
    if (reportType.includes('SOX')) return '📊';
    if (reportType.includes('PCI')) return '💳';
    return '📋';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Compliance Reports</h2>
        <button
          onClick={() => setShowGenerateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Generate Compliance Report</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <select
                  value={generateForm.reportType}
                  onChange={(e) => setGenerateForm({...generateForm, reportType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GDPR_COMPLIANCE">GDPR Compliance</option>
                  <option value="HIPAA_COMPLIANCE">HIPAA Compliance</option>
                  <option value="SOX_COMPLIANCE">SOX Compliance</option>
                  <option value="PCI_COMPLIANCE">PCI DSS Compliance</option>
                  <option value="SECURITY_ASSESSMENT">Security Assessment</option>
                  <option value="PRIVACY_AUDIT">Privacy Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                  value={generateForm.format}
                  onChange={(e) => setGenerateForm({...generateForm, format: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PDF">PDF</option>
                  <option value="JSON">JSON</option>
                  <option value="CSV">CSV</option>
                  <option value="HTML">HTML</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({...generateForm, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={generateForm.endDate}
                  onChange={(e) => setGenerateForm({...generateForm, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Standards</label>
              <div className="flex flex-wrap gap-2">
                {['GDPR', 'HIPAA', 'SOX', 'PCI_DSS'].map((standard) => (
                  <label key={standard} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={generateForm.standards.includes(standard)}
                      onChange={(e) => {
                        const newStandards = e.target.checked
                          ? [...generateForm.standards, standard]
                          : generateForm.standards.filter(s => s !== standard);
                        setGenerateForm({...generateForm, standards: newStandards});
                      }}
                      className="mr-2 rounded"
                    />
                    <span className="text-sm">{standard}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={generateReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {reports.length > 0 ? (
          reports.map((report) => (
            <div key={report.reportId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getReportIcon(report.reportType)}</div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{report.reportType.replace(/_/g, ' ')}</h3>
                    <p className="text-sm text-gray-500">
                      Period: {new Date(report.period.startDate).toLocaleDateString()} - {new Date(report.period.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Generated by {report.generatedBy.userName} on {new Date(report.generatedBy.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status.overall)}`}>
                    {report.status.overall.replace(/_/g, ' ')}
                  </span>
                  <button className="text-blue-600 hover:text-blue-800">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {report.status.findings && report.status.findings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Key Findings</h4>
                  <div className="space-y-1">
                    {report.status.findings.slice(0, 3).map((finding, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                          finding.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          finding.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {finding.severity}
                        </span>
                        {finding.description}
                      </div>
                    ))}
                    {report.status.findings.length > 3 && (
                      <p className="text-sm text-blue-600">+{report.status.findings.length - 3} more findings</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No compliance reports</h3>
            <p className="text-gray-500 mb-4">Generate your first compliance report to get started.</p>
            <button
              onClick={() => setShowGenerateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Generate Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceReports;