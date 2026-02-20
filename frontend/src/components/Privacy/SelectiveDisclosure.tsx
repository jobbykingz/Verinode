import React, { useState } from 'react';
import { Eye, EyeOff, FileText, Filter, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SelectiveDisclosureProps {
  proofData: any;
  onDisclosureChange?: (disclosedData: Record<string, any>) => void;
}

interface DisclosureField {
  name: string;
  value: any;
  disclosed: boolean;
  sensitive: boolean;
}

const SelectiveDisclosure: React.FC<SelectiveDisclosureProps> = ({ 
  proofData,
  onDisclosureChange 
}) => {
  const [fields, setFields] = useState<DisclosureField[]>(() => {
    return Object.entries(proofData)
      .filter(([key]) => !['id', 'issuer', 'timestamp', 'hash'].includes(key))
      .map(([name, value]) => ({
        name,
        value,
        disclosed: false,
        sensitive: typeof value === 'string' && value.length > 50
      }));
  });

  const [purpose, setPurpose] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const toggleFieldDisclosure = (fieldName: string) => {
    setFields(prev => 
      prev.map(field => 
        field.name === fieldName 
          ? { ...field, disclosed: !field.disclosed }
          : field
      )
    );
  };

  const selectTemplate = (templateName: string) => {
    const templates: Record<string, string[]> = {
      'verification_only': ['verified'],
      'basic_identity': ['issuer'],
      'timestamp_validation': ['timestamp'],
      'compliance_check': ['verified', 'issuer', 'timestamp']
    };

    const templateFields = templates[templateName] || [];
    setFields(prev => 
      prev.map(field => ({
        ...field,
        disclosed: templateFields.includes(field.name)
      }))
    );

    toast.success(`Applied ${templateName.replace('_', ' ')} template`);
  };

  const getDisclosedData = () => {
    const disclosed: Record<string, any> = {};
    fields
      .filter(field => field.disclosed)
      .forEach(field => {
        disclosed[field.name] = field.value;
      });
    return disclosed;
  };

  const handleShare = () => {
    if (!purpose || !recipient) {
      toast.error('Please specify purpose and recipient');
      return;
    }

    const disclosedCount = fields.filter(f => f.disclosed).length;
    if (disclosedCount === 0) {
      toast.error('Please select at least one field to disclose');
      return;
    }

    const disclosedData = getDisclosedData();
    if (onDisclosureChange) {
      onDisclosureChange(disclosedData);
    }

    toast.success(`Shared ${disclosedCount} fields with ${recipient}`);
  };

  const getDisclosurePercentage = () => {
    const totalFields = fields.length;
    const disclosedFields = fields.filter(f => f.disclosed).length;
    return totalFields > 0 ? Math.round((disclosedFields / totalFields) * 100) : 0;
  };

  const disclosurePercentage = getDisclosurePercentage();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <Filter className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Selective Disclosure</h2>
      </div>

      <div className="space-y-6">
        {/* Disclosure Summary */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-blue-900">Disclosure Summary</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              disclosurePercentage <= 25 ? 'bg-green-100 text-green-800' :
              disclosurePercentage <= 50 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {disclosurePercentage}% disclosed
            </span>
          </div>
          <p className="text-sm text-blue-700">
            {fields.filter(f => f.disclosed).length} of {fields.length} fields selected for disclosure
          </p>
        </div>

        {/* Templates */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Quick Templates</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { name: 'verification_only', label: 'Verification Only' },
              { name: 'basic_identity', label: 'Basic Identity' },
              { name: 'timestamp_validation', label: 'Timestamp Only' },
              { name: 'compliance_check', label: 'Compliance Check' }
            ].map((template) => (
              <button
                key={template.name}
                onClick={() => selectTemplate(template.name)}
                className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-center"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {/* Field Selection */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Select Fields to Disclose</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {fields.map((field) => (
              <div 
                key={field.name} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <button
                    onClick={() => toggleFieldDisclosure(field.name)}
                    className={`mr-3 p-1 rounded ${
                      field.disclosed 
                        ? 'text-green-600 bg-green-100' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {field.disclosed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <div>
                    <div className="font-medium text-gray-900">{field.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {typeof field.value === 'string' && field.value.length > 100
                        ? `${field.value.substring(0, 100)}...`
                        : String(field.value)}
                    </div>
                  </div>
                </div>
                {field.sensitive && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" title="Sensitive data" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Purpose and Recipient */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose of Disclosure
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Employment verification"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient name or organization"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Disclosure Preview</h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
          </div>
          
          {showPreview && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="font-mono text-sm">
                <div className="text-gray-500 mb-2">// Disclosed Data</div>
                {Object.entries(getDisclosedData()).map(([key, value]) => (
                  <div key={key} className="mb-1">
                    <span className="text-blue-600">{key}</span>: {JSON.stringify(value)}
                  </div>
                ))}
                {Object.keys(getDisclosedData()).length === 0 && (
                  <div className="text-gray-400 italic">No fields selected for disclosure</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            disabled={fields.filter(f => f.disclosed).length === 0 || !purpose || !recipient}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Share Selectively
          </button>
          
          <button
            onClick={() => setFields(prev => prev.map(f => ({ ...f, disclosed: false })))}
            className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectiveDisclosure;