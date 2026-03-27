import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  FileText,
  Download,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Eye,
  Send,
} from 'lucide-react';
import { auditService, ComplianceFramework, ReportPeriod } from '../../services/auditService';
import { format, addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';

/**
 * Report Props
 */
interface AuditReportProps {
  className?: string;
  onReportGenerated?: (reportId: string) => void;
}

/**
 * Report Template
 */
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  format: 'pdf' | 'json' | 'csv' | 'html';
  includeRawData: boolean;
  includeCharts: boolean;
}

/**
 * Generated Report
 */
interface GeneratedReport {
  id: string;
  name: string;
  framework: ComplianceFramework;
  period: ReportPeriod;
  format: string;
  generatedAt: string;
  size: number;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
}

/**
 * Compliance Report Component
 * 
 * Provides comprehensive compliance reporting capabilities:
 * - Multiple compliance frameworks (SOX, GDPR, HIPAA, PCI-DSS)
 * - Flexible time periods and scheduling
 * - Multiple export formats
 * - Report templates and customization
 * - Report history and management
 */
export const AuditReportComponent: React.FC<AuditReportProps> = ({ 
  className, 
  onReportGenerated 
}) => {
  const [framework, setFramework] = useState<ComplianceFramework>(ComplianceFramework.SOX);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<'pdf' | 'json' | 'csv' | 'html'>('pdf');
  const [includeRawData, setIncludeRawData] = useState(false);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Load saved reports and templates
  useEffect(() => {
    loadGeneratedReports();
    loadTemplates();
    setDefaultDateRange();
  }, [periodType]);

  const setDefaultDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (periodType) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        start = addWeeks(now, -1);
        break;
      case 'monthly':
        start = addMonths(now, -1);
        break;
      case 'quarterly':
        start = addQuarters(now, -1);
        break;
      case 'yearly':
        start = addYears(now, -1);
        break;
      default:
        start = addDays(now, -30);
    }

    setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
  };

  const loadGeneratedReports = () => {
    const saved = localStorage.getItem('audit-generated-reports');
    if (saved) {
      setGeneratedReports(JSON.parse(saved));
    }
  };

  const loadTemplates = () => {
    const defaultTemplates: ReportTemplate[] = [
      {
        id: 'sox-monthly',
        name: 'SOX Monthly Report',
        description: 'Monthly Sarbanes-Oxley compliance report',
        framework: ComplianceFramework.SOX,
        periodType: 'monthly',
        format: 'pdf',
        includeRawData: false,
        includeCharts: true
      },
      {
        id: 'gdpr-quarterly',
        name: 'GDPR Quarterly Report',
        description: 'Quarterly GDPR compliance assessment',
        framework: ComplianceFramework.GDPR,
        periodType: 'quarterly',
        format: 'pdf',
        includeRawData: false,
        includeCharts: true
      },
      {
        id: 'hipaa-annual',
        name: 'HIPAA Annual Report',
        description: 'Annual HIPAA compliance report',
        framework: ComplianceFramework.HIPAA,
        periodType: 'yearly',
        format: 'pdf',
        includeRawData: true,
        includeCharts: true
      },
      {
        id: 'pci-dss-monthly',
        name: 'PCI-DSS Monthly Report',
        description: 'Monthly PCI-DSS compliance report',
        framework: ComplianceFramework.PCI_DSS,
        periodType: 'monthly',
        format: 'pdf',
        includeRawData: false,
        includeCharts: true
      }
    ];

    const saved = localStorage.getItem('audit-report-templates');
    setTemplates(saved ? JSON.parse(saved) : defaultTemplates);
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select a date range');
      return;
    }

    try {
      setGenerating(true);

      const reportId = `report_${Date.now()}`;
      const newReport: GeneratedReport = {
        id: reportId,
        name: `${framework} Report - ${periodType}`,
        framework,
        period: {
          type: periodType,
          startDate,
          endDate
        },
        format,
        generatedAt: new Date().toISOString(),
        size: 0,
        status: 'generating'
      };

      // Add to reports list
      const updated = [newReport, ...generatedReports];
      setGeneratedReports(updated);
      localStorage.setItem('audit-generated-reports', JSON.stringify(updated));

      // Generate report
      const blob = await auditService.generateReport(
        {
          type: periodType,
          startDate,
          endDate
        },
        framework,
        {
          format,
          includeRawData
        }
      );

      // Create download URL
      const url = URL.createObjectURL(blob);
      
      // Update report status
      const completedReport = {
        ...newReport,
        status: 'completed' as const,
        size: blob.size,
        downloadUrl: url
      };

      const finalReports = updated.map(r => r.id === reportId ? completedReport : r);
      setGeneratedReports(finalReports);
      localStorage.setItem('audit-generated-reports', JSON.stringify(finalReports));

      onReportGenerated?.(reportId);
    } catch (error) {
      console.error('Failed to generate report:', error);
      
      // Update report status to failed
      const failedReports = generatedReports.map(r => 
        r.id === `report_${Date.now()}` ? { ...r, status: 'failed' as const } : r
      );
      setGeneratedReports(failedReports);
      localStorage.setItem('audit-generated-reports', JSON.stringify(failedReports));
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (report: GeneratedReport) => {
    if (report.downloadUrl) {
      const a = document.createElement('a');
      a.href = report.downloadUrl;
      a.download = `${report.name}.${report.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const deleteReport = (reportId: string) => {
    const updated = generatedReports.filter(r => r.id !== reportId);
    setGeneratedReports(updated);
    localStorage.setItem('audit-generated-reports', JSON.stringify(updated));
  };

  const saveTemplate = () => {
    const newTemplate: ReportTemplate = {
      id: `template_${Date.now()}`,
      name: `${framework} ${periodType} Template`,
      description: `Custom ${framework} report template`,
      framework,
      periodType: periodType as any,
      format,
      includeRawData,
      includeCharts
    };

    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('audit-report-templates', JSON.stringify(updated));
  };

  const loadTemplate = (template: ReportTemplate) => {
    setFramework(template.framework);
    setPeriodType(template.periodType);
    setFormat(template.format);
    setIncludeRawData(template.includeRawData);
    setIncludeCharts(template.includeCharts);
    setDefaultDateRange();
  };

  const deleteTemplate = (templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    localStorage.setItem('audit-report-templates', JSON.stringify(updated));
  };

  const getFrameworkColor = (framework: ComplianceFramework) => {
    const colors = {
      [ComplianceFramework.SOX]: '#3b82f6',
      [ComplianceFramework.GDPR]: '#10b981',
      [ComplianceFramework.HIPAA]: '#f59e0b',
      [ComplianceFramework.PCI_DSS]: '#ef4444',
      [ComplianceFramework.ISO_27001]: '#8b5cf6',
      [ComplianceFramework.NIST]: '#64748b'
    };
    return colors[framework] || '#64748b';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'generating':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Reports</h1>
          <p className="text-gray-600">Generate compliance reports for regulatory frameworks</p>
        </div>
        <Button onClick={() => setShowPreview(!showPreview)}>
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? 'Hide' : 'Show'} Preview
        </Button>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Report Configuration
          </CardTitle>
          <CardDescription>
            Configure your compliance report parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Framework Selection */}
            <div>
              <Label htmlFor="framework">Compliance Framework</Label>
              <Select value={framework} onValueChange={(value) => setFramework(value as ComplianceFramework)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ComplianceFramework.SOX}>SOX (Sarbanes-Oxley)</SelectItem>
                  <SelectItem value={ComplianceFramework.GDPR}>GDPR</SelectItem>
                  <SelectItem value={ComplianceFramework.HIPAA}>HIPAA</SelectItem>
                  <SelectItem value={ComplianceFramework.PCI_DSS}>PCI-DSS</SelectItem>
                  <SelectItem value={ComplianceFramework.ISO_27001}>ISO 27001</SelectItem>
                  <SelectItem value={ComplianceFramework.NIST}>NIST</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Selection */}
            <div>
              <Label htmlFor="period">Report Period</Label>
              <Select value={periodType} onValueChange={(value) => setPeriodType(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection */}
            <div>
              <Label htmlFor="format">Export Format</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRawData"
                  checked={includeRawData}
                  onCheckedChange={(checked) => setIncludeRawData(checked as boolean)}
                />
                <Label htmlFor="includeRawData">Include Raw Data</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCharts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="includeCharts">Include Charts</Label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between mt-6 pt-6 border-t">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={saveTemplate}>
                <FileText className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button onClick={generateReport} disabled={generating}>
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Templates */}
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Templates</CardTitle>
            <CardDescription>Quick access to saved report configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{template.name}</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      ×
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge 
                      style={{ backgroundColor: getFrameworkColor(template.framework) }}
                      className="text-white"
                    >
                      {template.framework}
                    </Badge>
                    <Badge variant="outline">{template.periodType}</Badge>
                    <Badge variant="outline">{template.format.toUpperCase()}</Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadTemplate(template)}
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        loadTemplate(template);
                        generateReport();
                      }}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>History of generated compliance reports</CardDescription>
        </CardHeader>
        <CardContent>
          {generatedReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <p>No reports generated yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatedReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(report.status)}
                    <div>
                      <h4 className="font-medium">{report.name}</h4>
                      <p className="text-sm text-gray-600">
                        {report.framework} - {report.period.type}
                      </p>
                      <p className="text-xs text-gray-500">
                        Generated {format(new Date(report.generatedAt), 'PPp')}
                        {report.size > 0 && ` • ${formatFileSize(report.size)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      style={{ backgroundColor: getFrameworkColor(report.framework) }}
                      className="text-white"
                    >
                      {report.framework}
                    </Badge>
                    <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                    {report.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadReport(report)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteReport(report.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Preview */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>Preview of what your report will contain</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">--</div>
                    <p className="text-sm text-gray-600">Total Events</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">--%</div>
                    <p className="text-sm text-gray-600">Compliance Score</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">--</div>
                    <p className="text-sm text-gray-600">Critical Events</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4" />
                  <p>Compliance details will be shown in the generated report</p>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4" />
                  <p>Security metrics will be shown in the generated report</p>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>Analytics charts will be shown in the generated report</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AuditReportComponent;
