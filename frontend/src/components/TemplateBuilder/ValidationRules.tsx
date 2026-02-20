import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface TemplateField {
  id: string;
  name: string;
  type: string;
  label: string;
}

interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  fieldId: string;
  ruleType: string;
  parameters?: any;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
}

interface ValidationRulesProps {
  rules: ValidationRule[];
  fields: TemplateField[];
  onRuleAdd: (rule: Omit<ValidationRule, 'id'>) => void;
  onRuleRemove: (ruleId: string) => void;
}

const ValidationRules: React.FC<ValidationRulesProps> = ({
  rules,
  fields,
  onRuleAdd,
  onRuleRemove
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState<Omit<ValidationRule, 'id'>>({
    name: '',
    fieldId: '',
    ruleType: 'required',
    errorMessage: '',
    severity: 'error',
    enabled: true
  });

  const ruleTypes = [
    { value: 'required', label: 'Required' },
    { value: 'minLength', label: 'Minimum Length' },
    { value: 'maxLength', label: 'Maximum Length' },
    { value: 'minValue', label: 'Minimum Value' },
    { value: 'maxValue', label: 'Maximum Value' },
    { value: 'pattern', label: 'Pattern Match' },
    { value: 'custom', label: 'Custom Validation' },
    { value: 'conditional', label: 'Conditional' }
  ];

  const severityOptions = [
    { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500' },
    { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500' },
    { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500' }
  ];

  const handleAddRule = () => {
    if (newRule.name && newRule.fieldId && newRule.errorMessage) {
      onRuleAdd(newRule);
      setNewRule({
        name: '',
        fieldId: '',
        ruleType: 'required',
        errorMessage: '',
        severity: 'error',
        enabled: true
      });
      setShowAddForm(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    const option = severityOptions.find(opt => opt.value === severity);
    return option ? option.icon : AlertCircle;
  };

  const getSeverityColor = (severity: string) => {
    const option = severityOptions.find(opt => opt.value === severity);
    return option ? option.color : 'text-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Validation Rules</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900">Add Validation Rule</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Email Required"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field *
              </label>
              <select
                value={newRule.fieldId}
                onChange={(e) => setNewRule(prev => ({ ...prev, fieldId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a field</option>
                {fields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.label} ({field.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rule Type
              </label>
              <select
                value={newRule.ruleType}
                onChange={(e) => setNewRule(prev => ({ ...prev, ruleType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ruleTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                value={newRule.severity}
                onChange={(e) => setNewRule(prev => ({ ...prev, severity: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {severityOptions.map(sev => (
                  <option key={sev.value} value={sev.value}>
                    {sev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Error Message *
            </label>
            <input
              type="text"
              value={newRule.errorMessage}
              onChange={(e) => setNewRule(prev => ({ ...prev, errorMessage: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Please enter a valid value"
            />
          </div>

          {(newRule.ruleType === 'minLength' || newRule.ruleType === 'maxLength') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Length
              </label>
              <input
                type="number"
                value={newRule.parameters?.length || ''}
                onChange={(e) => setNewRule(prev => ({
                  ...prev,
                  parameters: { ...prev.parameters, length: parseInt(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter length"
              />
            </div>
          )}

          {(newRule.ruleType === 'minValue' || newRule.ruleType === 'maxValue') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value
              </label>
              <input
                type="number"
                value={newRule.parameters?.value || ''}
                onChange={(e) => setNewRule(prev => ({
                  ...prev,
                  parameters: { ...prev.parameters, value: parseInt(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter value"
              />
            </div>
          )}

          {newRule.ruleType === 'pattern' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pattern (Regex)
              </label>
              <input
                type="text"
                value={newRule.parameters?.pattern || ''}
                onChange={(e) => setNewRule(prev => ({
                  ...prev,
                  parameters: { ...prev.parameters, pattern: e.target.value }
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="^[a-zA-Z0-9]+$"
              />
            </div>
          )}

          {newRule.ruleType === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Custom Expression
              </label>
              <textarea
                value={newRule.parameters?.expression || ''}
                onChange={(e) => setNewRule(prev => ({
                  ...prev,
                  parameters: { ...prev.parameters, expression: e.target.value }
                }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="value.length > 5 && value.includes('@')"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use 'value' to reference the field value
              </p>
            </div>
          )}

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newRule.enabled}
                onChange={(e) => setNewRule(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enabled</span>
            </label>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleAddRule}
              disabled={!newRule.name || !newRule.fieldId || !newRule.errorMessage}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Rule
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => {
          const field = fields.find(f => f.id === rule.fieldId);
          const SeverityIcon = getSeverityIcon(rule.severity);
          const severityColor = getSeverityColor(rule.severity);
          
          return (
            <div
              key={rule.id}
              className={`border rounded-lg p-3 transition-colors ${
                rule.enabled 
                  ? 'border-gray-200 hover:border-gray-300' 
                  : 'border-gray-100 bg-gray-50 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{rule.name}</h4>
                    <SeverityIcon className={`w-4 h-4 ${severityColor}`} />
                    {!rule.enabled && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Disabled
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="font-medium">{field?.label || 'Unknown Field'}</span>
                    <span className="mx-2">•</span>
                    <span>{rule.ruleType}</span>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-500">
                    {rule.errorMessage}
                  </div>
                  
                  {rule.description && (
                    <div className="mt-1 text-xs text-gray-400">
                      {rule.description}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => onRuleRemove(rule.id)}
                  className="p-1 text-gray-400 hover:text-red-500 ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {rules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No validation rules added yet</p>
            <p className="text-sm mt-1">Click "Add Rule" to define validation logic</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationRules;
