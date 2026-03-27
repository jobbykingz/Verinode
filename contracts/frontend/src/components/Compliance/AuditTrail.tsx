import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  User, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye
} from 'lucide-react';
import axios from 'axios';

interface AuditEvent {
  eventId: string;
  timestamp: string;
  eventType: string;
  actor: {
    name: string;
    id: string;
  };
  resource?: {
    name: string;
    id: string;
  };
  action: string;
  status: string;
  compliance: {
    classification: string;
    gdprRelevant: boolean;
  };
}

interface AuditTrailProps {
  resourceId?: string;
  userId?: string;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ resourceId, userId }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: '',
    limit: 50
  });
  const [exportFormat, setExportFormat] = useState('JSON');

  useEffect(() => {
    fetchAuditTrail();
  }, [resourceId, userId, filters]);

  const fetchAuditTrail = async () => {
    try {
      setLoading(true);
      const params: any = { ...filters };
      
      if (resourceId) params.resourceId = resourceId;
      if (userId) params.userId = userId;
      
      const response = await axios.get('/api/compliance/audit-trail', { params });
      setEvents(response.data.auditTrail);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch audit trail');
    } finally {
      setLoading(false);
    }
  };

  const exportAuditTrail = async () => {
    try {
      const params: any = { format: exportFormat };
      if (resourceId) params.resourceId = resourceId;
      if (userId) params.userId = userId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get('/api/compliance/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-trail-${Date.now()}.${exportFormat.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError('Failed to export audit trail');
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('PROOF')) return <Shield className="h-4 w-4" />;
    if (eventType.includes('PRIVACY') || eventType.includes('CONSENT')) return <Eye className="h-4 w-4" />;
    if (eventType.includes('SECURITY')) return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getSeverityColor = (status: string, classification: string) => {
    if (status === 'FAILURE') return 'text-red-600';
    if (classification === 'RESTRICTED') return 'text-orange-600';
    if (classification === 'CONFIDENTIAL') return 'text-yellow-600';
    return 'text-green-600';
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
        <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
        <div className="flex gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="JSON">JSON</option>
            <option value="CSV">CSV</option>
            <option value="HTML">HTML</option>
          </select>
          <button
            onClick={exportAuditTrail}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
          <select
            value={filters.eventType}
            onChange={(e) => setFilters({...filters, eventType: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Events</option>
            <option value="PROOF_ISSUED">Proof Issued</option>
            <option value="PROOF_VERIFIED">Proof Verified</option>
            <option value="PROOF_SHARED">Proof Shared</option>
            <option value="PRIVACY_SETTING_CHANGED">Privacy Settings</option>
            <option value="CONSENT_GRANTED">Consent Granted</option>
            <option value="ACCESS_REQUEST">Access Request</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => setFilters({...filters, limit: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classification
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => (
              <tr key={event.eventId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getEventIcon(event.eventType)}
                    <div className="ml-2">
                      <div className="text-sm font-medium text-gray-900">
                        {event.eventType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-500">{event.action}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{event.actor.name}</div>
                      <div className="text-sm text-gray-500">{event.actor.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {event.resource ? (
                    <div>
                      <div className="font-medium">{event.resource.name}</div>
                      <div className="text-gray-500">{event.resource.id}</div>
                    </div>
                  ) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    event.status === 'SUCCESS' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {event.status === 'SUCCESS' ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    event.compliance.classification === 'RESTRICTED' 
                      ? 'bg-red-100 text-red-800' 
                      : event.compliance.classification === 'CONFIDENTIAL'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {event.compliance.classification}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length === 0 && !loading && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No audit events found</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;