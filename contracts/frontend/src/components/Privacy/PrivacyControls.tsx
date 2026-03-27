import React, { useState } from 'react';
import { Users, Eye, Share2, Clock, UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface PrivacyControlsProps {
  proofId: string;
  currentSettings?: PrivacySettings;
  onSettingsChange?: (settings: PrivacySettings) => void;
}

interface PrivacySettings {
  visibility: 'public' | 'private' | 'shared';
  allowedViewers: string[]; // Stellar addresses
  allowedActions: ('view' | 'verify' | 'share')[];
  expirationDate?: string;
  requireConsent: boolean;
  dataMinimization: boolean;
}

interface AccessRequest {
  id: string;
  requester: string;
  requestedActions: ('view' | 'verify' | 'share')[];
  reason?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

const PrivacyControls: React.FC<PrivacyControlsProps> = ({ 
  proofId, 
  currentSettings,
  onSettingsChange 
}) => {
  const [settings, setSettings] = useState<PrivacySettings>(currentSettings || {
    visibility: 'private',
    allowedViewers: [],
    allowedActions: ['view'],
    requireConsent: true,
    dataMinimization: true
  });

  const [newViewer, setNewViewer] = useState('');
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([
    {
      id: 'req-1',
      requester: 'GABC...1234',
      requestedActions: ['view', 'verify'],
      reason: 'Employment verification',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'pending'
    }
  ]);

  const handleSettingsChange = (key: keyof PrivacySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }
  };

  const addAllowedViewer = () => {
    if (newViewer && !settings.allowedViewers.includes(newViewer)) {
      const updatedViewers = [...settings.allowedViewers, newViewer];
      handleSettingsChange('allowedViewers', updatedViewers);
      setNewViewer('');
      toast.success('Viewer added successfully');
    }
  };

  const removeAllowedViewer = (viewer: string) => {
    const updatedViewers = settings.allowedViewers.filter(v => v !== viewer);
    handleSettingsChange('allowedViewers', updatedViewers);
    toast.success('Viewer removed');
  };

  const handleAccessRequest = (requestId: string, approved: boolean) => {
    setAccessRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: approved ? 'approved' : 'rejected' }
          : req
      )
    );
    
    toast.success(`Access request ${approved ? 'approved' : 'rejected'}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <Users className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Privacy Controls</h2>
      </div>

      <div className="space-y-6">
        {/* Visibility Settings */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Visibility</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['public', 'private', 'shared'] as const).map((visibility) => (
              <button
                key={visibility}
                onClick={() => handleSettingsChange('visibility', visibility)}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  settings.visibility === visibility
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium capitalize">{visibility}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {visibility === 'public' && 'Anyone can view'}
                  {visibility === 'private' && 'Only you can view'}
                  {visibility === 'shared' && 'Specific people can view'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Allowed Actions */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Allowed Actions</h3>
          <div className="flex flex-wrap gap-2">
            {(['view', 'verify', 'share'] as const).map((action) => (
              <label key={action} className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allowedActions.includes(action)}
                  onChange={(e) => {
                    const updatedActions = e.target.checked
                      ? [...settings.allowedActions, action]
                      : settings.allowedActions.filter(a => a !== action);
                    handleSettingsChange('allowedActions', updatedActions);
                  }}
                  className="mr-2 rounded"
                />
                <span className="capitalize">{action}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Consent and Data Minimization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Require Consent</h4>
              <p className="text-sm text-gray-500">Request permission before sharing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConsent}
                onChange={(e) => handleSettingsChange('requireConsent', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Data Minimization</h4>
              <p className="text-sm text-gray-500">Share only essential data</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dataMinimization}
                onChange={(e) => handleSettingsChange('dataMinimization', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Expiration Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiration Date (Optional)
          </label>
          <input
            type="date"
            value={settings.expirationDate ? settings.expirationDate.split('T')[0] : ''}
            onChange={(e) => handleSettingsChange('expirationDate', e.target.value || undefined)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Allowed Viewers (for shared visibility) */}
        {settings.visibility === 'shared' && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Allowed Viewers</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newViewer}
                onChange={(e) => setNewViewer(e.target.value)}
                placeholder="Enter Stellar address"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addAllowedViewer}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>
            
            {settings.allowedViewers.length > 0 && (
              <div className="space-y-2">
                {settings.allowedViewers.map((viewer, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <UserCheck className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-mono text-sm">{viewer}</span>
                    </div>
                    <button
                      onClick={() => removeAllowedViewer(viewer)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <UserX className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Access Requests */}
        {accessRequests.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Access Requests
            </h3>
            <div className="space-y-3">
              {accessRequests.map((request) => (
                <div key={request.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-gray-900">{request.requester}</div>
                      <div className="text-sm text-gray-500">
                        Requested: {request.requestedActions.join(', ')}
                      </div>
                      {request.reason && (
                        <div className="text-sm text-gray-600 mt-1">
                          Reason: {request.reason}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(request.timestamp)}
                    </div>
                  </div>
                  
                  {request.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccessRequest(request.id, true)}
                        className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAccessRequest(request.id, false)}
                        className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                      request.status === 'approved' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {request.status === 'approved' ? 'Approved' : 'Rejected'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivacyControls;