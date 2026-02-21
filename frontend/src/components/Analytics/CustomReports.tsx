import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Download, Calendar, Filter, Settings, Share2, Trash2, Plus } from 'lucide-react';

interface ReportMetric {
  name: string;
  label: string;
  type: 'number' | 'percentage' | 'currency';
  defaultSelected: boolean;
}

interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  metrics: string[];
  timeframe: string;
  visualization: string;
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  timeframe: string;
  filters: ReportFilter[];
  createdAt: Date;
  updatedAt: Date;
  data: any[];
}

const AVAILABLE_METRICS: ReportMetric[] = [
  { name: 'total_users', label: 'Total Users', type: 'number', defaultSelected: true },
  { name: 'daily_active_users', label: 'Daily Active Users', type: 'number', defaultSelected: true },
  { name: 'revenue', label: 'Revenue', type: 'currency', defaultSelected: false },
  { name: 'proofs_verified', label: 'Proofs Verified', type: 'number', defaultSelected: true },
  { name: 'response_time', label: 'Response Time', type: 'number', defaultSelected: false },
  { name: 'error_rate', label: 'Error Rate', type: 'percentage', defaultSelected: false },
  { name: 'conversion_rate', label: 'Conversion Rate', type: 'percentage', defaultSelected: false },
  { name: 'retention_rate', label: 'Retention Rate', type: 'percentage', defaultSelected: false }
];

const TIMEFRAMES = [
  { value: '1d', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const CustomReports: React.FC = () => {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line');

  useEffect(() => {
    fetchReports();
    fetchTemplates();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/analytics/reports');
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/analytics/reports/templates');
      const data = await response.json();
      setTemplates(data.flat());
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const createReport = async () => {
    if (!reportName || selectedMetrics.length === 0) {
      alert('Please provide a report name and select at least one metric');
      return;
    }

    setSaving(true);
    try {
      const reportData = {
        name: reportName,
        description: reportDescription,
        metrics: selectedMetrics,
        timeframe: selectedTimeframe,
        filters,
        visualization: {
          type: chartType,
          config: {}
        }
      };

      const response = await fetch('/api/analytics/custom-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });

      const newReport = await response.json();
      setReports([...reports, newReport]);
      resetBuilder();
      setShowBuilder(false);
    } catch (error) {
      console.error('Error creating report:', error);
      alert('Failed to create report');
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await fetch(`/api/analytics/reports/${reportId}`, {
        method: 'DELETE'
      });
      setReports(reports.filter(report => report.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const exportReport = async (reportId: string, format: 'pdf' | 'excel' | 'csv') => {
    try {
      const response = await fetch(`/api/analytics/reports/${reportId}/export?format=${format}`);
      const data = await response.json();
      
      // Create download link
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.filename;
      link.click();
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    }
  };

  const useTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setReportName(template.name);
    setReportDescription(template.description);
    setSelectedMetrics(template.metrics);
    setSelectedTimeframe(template.timeframe);
    setChartType(template.visualization as any);
    setShowBuilder(true);
  };

  const resetBuilder = () => {
    setReportName('');
    setReportDescription('');
    setSelectedMetrics([]);
    setSelectedTimeframe('30d');
    setFilters([]);
    setChartType('line');
    setSelectedTemplate(null);
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
  };

  const updateFilter = (index: number, field: string, value: any) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
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
          <h2 className="text-xl font-semibold text-gray-900">Custom Reports</h2>
          <p className="text-sm text-gray-600 mt-1">Create and manage custom analytics reports</p>
        </div>
        
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Report
        </button>
      </div>

      {showBuilder && (
        <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {selectedTemplate ? 'Edit Report' : 'Create New Report'}
            </h3>
            <button
              onClick={() => setShowBuilder(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Name
              </label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter report name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeframe
              </label>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter report description"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metrics
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {AVAILABLE_METRICS.map(metric => (
                <label key={metric.name} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(metric.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMetrics([...selectedMetrics, metric.name]);
                      } else {
                        setSelectedMetrics(selectedMetrics.filter(m => m !== metric.name));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{metric.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chart Type
            </label>
            <div className="flex gap-2">
              {['line', 'bar', 'pie'].map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type as any)}
                  className={`px-3 py-1 rounded-md text-sm capitalize ${
                    chartType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Filters
              </label>
              <button
                onClick={addFilter}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Filter
              </button>
            </div>
            
            {filters.map((filter, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Field"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, 'field', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="eq">Equals</option>
                  <option value="ne">Not Equals</option>
                  <option value="gt">Greater Than</option>
                  <option value="gte">Greater or Equal</option>
                  <option value="lt">Less Than</option>
                  <option value="lte">Less or Equal</option>
                  <option value="in">In</option>
                  <option value="contains">Contains</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => removeFilter(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetBuilder}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createReport}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </div>
      )}

      {!showBuilder && templates.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {template.category}
                  </span>
                  <button
                    onClick={() => useTemplate(template)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Your Reports</h3>
        {reports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No reports created yet</p>
            <p className="text-sm">Create your first custom report to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map(report => (
              <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900">{report.name}</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => exportReport(report.id, 'pdf')}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Export PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{report.description}</p>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {report.metrics.slice(0, 3).map(metric => (
                    <span key={metric} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {metric}
                    </span>
                  ))}
                  {report.metrics.length > 3 && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      +{report.metrics.length - 3} more
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{report.timeframe}</span>
                  <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
