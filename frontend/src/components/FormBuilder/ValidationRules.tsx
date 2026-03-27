import React, { useState } from 'react';
import { FormField, ValidationRule, ValidationRuleConfig } from '../../types/formBuilder';
import { 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  Settings,
  Eye,
  EyeOff,
  Copy,
  Trash2
} from 'lucide-react';

interface ValidationRulesProps {
  field: FormField;
  onUpdate: (rules: ValidationRuleConfig[]) => void;
}

const ValidationRules: React.FC<ValidationRulesProps> = ({ field, onUpdate }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const validationRuleTypes: Array<{
    type: ValidationRule;
    label: string;
    description: string;
    icon: string;
    applicableFieldTypes: string[];
    requiresValue: boolean;
    defaultValue?: any;
  }> = [
    {
      type: 'required',
      label: 'Required',
      description: 'Field must be filled',
      icon: 'Check',
      applicableFieldTypes: ['*'],
      requiresValue: false,
    },
    {
      type: 'minLength',
      label: 'Minimum Length',
      description: 'Minimum number of characters',
      icon: 'Settings',
      applicableFieldTypes: ['text', 'textarea', 'password', 'email', 'url', 'phone'],
      requiresValue: true,
      defaultValue: 1,
    },
    {
      type: 'maxLength',
      label: 'Maximum Length',
      description: 'Maximum number of characters',
      icon: 'Settings',
      applicableFieldTypes: ['text', 'textarea', 'password', 'email', 'url', 'phone'],
      requiresValue: true,
      defaultValue: 255,
    },
    {
      type: 'min',
      label: 'Minimum Value',
      description: 'Minimum numeric value',
      icon: 'Settings',
      applicableFieldTypes: ['number', 'range'],
      requiresValue: true,
      defaultValue: 0,
    },
    {
      type: 'max',
      label: 'Maximum Value',
      description: 'Maximum numeric value',
      icon: 'Settings',
      applicableFieldTypes: ['number', 'range'],
      requiresValue: true,
      defaultValue: 999999,
    },
    {
      type: 'pattern',
      label: 'Pattern Match',
      description: 'Regular expression pattern',
      icon: 'Settings',
      applicableFieldTypes: ['text', 'textarea', 'password', 'email', 'url', 'phone'],
      requiresValue: true,
      defaultValue: '',
    },
    {
      type: 'email',
      label: 'Email Format',
      description: 'Valid email address format',
      icon: 'Mail',
      applicableFieldTypes: ['email', 'text'],
      requiresValue: false,
    },
    {
      type: 'url',
      label: 'URL Format',
      description: 'Valid URL format',
      icon: 'Link',
      applicableFieldTypes: ['url', 'text'],
      requiresValue: false,
    },
    {
      type: 'custom',
      label: 'Custom Validation',
      description: 'Custom JavaScript validation',
      icon: 'Settings',
      applicableFieldTypes: ['*'],
      requiresValue: true,
      defaultValue: '',
    },
  ];

  const getAvailableRules = () => {
    return validationRuleTypes.filter(rule => 
      rule.applicableFieldTypes.includes('*') || 
      rule.applicableFieldTypes.includes(field.type)
    );
  };

  const addValidationRule = (ruleType: ValidationRule) => {
    const ruleConfig = validationRuleTypes.find(r => r.type === ruleType);
    if (!ruleConfig) return;

    const newRule: ValidationRuleConfig = {
      type: ruleType,
      value: ruleConfig.defaultValue,
      message: getDefaultErrorMessage(ruleType, ruleConfig.defaultValue),
      customFunction: ruleType === 'custom' ? '' : undefined,
    };

    const updatedRules = [...field.validationRules, newRule];
    onUpdate(updatedRules);
  };

  const removeValidationRule = (index: number) => {
    const updatedRules = field.validationRules.filter((_, i) => i !== index);
    onUpdate(updatedRules);
  };

  const updateValidationRule = (index: number, updates: Partial<ValidationRuleConfig>) => {
    const updatedRules = field.validationRules.map((rule, i) => 
      i === index ? { ...rule, ...updates } : rule
    );
    onUpdate(updatedRules);
  };

  const getDefaultErrorMessage = (ruleType: ValidationRule, value?: any): string => {
    switch (ruleType) {
      case 'required':
        return 'This field is required';
      case 'minLength':
        return `Must be at least ${value} characters`;
      case 'maxLength':
        return `Must be no more than ${value} characters`;
      case 'min':
        return `Value must be at least ${value}`;
      case 'max':
        return `Value must be no more than ${value}`;
      case 'pattern':
        return 'Please enter a valid format';
      case 'email':
        return 'Please enter a valid email address';
      case 'url':
        return 'Please enter a valid URL';
      case 'custom':
        return 'Validation failed';
      default:
        return 'Invalid input';
    }
  };

  const renderRuleValueInput = (rule: ValidationRuleConfig, index: number) => {
    switch (rule.type) {
      case 'minLength':
      case 'maxLength':
        return (
          <input
            type="number"
            min="1"
            value={rule.value || ''}
            onChange={(e) => updateValidationRule(index, { 
              value: parseInt(e.target.value) || 1,
              message: getDefaultErrorMessage(rule.type, parseInt(e.target.value) || 1)
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter length"
          />
        );
      
      case 'min':
      case 'max':
        return (
          <input
            type="number"
            value={rule.value || ''}
            onChange={(e) => updateValidationRule(index, { 
              value: parseFloat(e.target.value) || 0,
              message: getDefaultErrorMessage(rule.type, parseFloat(e.target.value) || 0)
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter value"
          />
        );
      
      case 'pattern':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={rule.value || ''}
              onChange={(e) => updateValidationRule(index, { value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter regex pattern (e.g., /^[A-Z]+$/)"
            />
            <div className="text-xs text-gray-500">
              Use JavaScript RegExp syntax. Example: /^[A-Za-z0-9]+$/
            </div>
          </div>
        );
      
      case 'custom':
        return (
          <div className="space-y-2">
            <textarea
              value={rule.customFunction || ''}
              onChange={(e) => updateValidationRule(index, { customFunction: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="// Return true if valid, false if invalid&#10;// Available variables: value, formData&#10;return value.length > 0;"
            />
            <div className="text-xs text-gray-500">
              Custom JavaScript function. Return true for valid, false for invalid.
              Variables: value (current field value), formData (all form data)
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const duplicateRule = (index: number) => {
    const ruleToDuplicate = field.validationRules[index];
    const duplicatedRule: ValidationRuleConfig = {
      ...ruleToDuplicate,
      message: `${ruleToDuplicate.message} (Copy)`,
    };
    
    const updatedRules = [...field.validationRules];
    updatedRules.splice(index + 1, 0, duplicatedRule);
    onUpdate(updatedRules);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Validation Rules</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Current Rules */}
      {field.validationRules.length > 0 && (
        <div className="space-y-3">
          {field.validationRules.map((rule, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {rule.type.replace(/_/g, ' ')}
                  </span>
                  {rule.type === 'required' && rule.value === true && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      Required
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => duplicateRule(index)}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Duplicate rule"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => removeValidationRule(index)}
                    className="p-1 rounded hover:bg-red-100"
                    title="Remove rule"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Rule Value Input */}
              {renderRuleValueInput(rule, index)}

              {/* Error Message */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Error Message
                </label>
                <input
                  type="text"
                  value={rule.message}
                  onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter error message"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Rule */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Add Validation Rule</h4>
        
        {showAdvanced ? (
          <div className="grid grid-cols-2 gap-2">
            {getAvailableRules().map((ruleType) => {
              const isAdded = field.validationRules.some(rule => rule.type === ruleType.type);
              
              return (
                <button
                  key={ruleType.type}
                  onClick={() => !isAdded && addValidationRule(ruleType.type)}
                  disabled={isAdded}
                  className={`flex items-center space-x-2 p-3 border rounded-lg text-left transition-colors ${
                    isAdded
                      ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                      : 'bg-white border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {ruleType.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {ruleType.description}
                    </div>
                  </div>
                  {isAdded && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {getAvailableRules().slice(0, 4).map((ruleType) => {
              const isAdded = field.validationRules.some(rule => rule.type === ruleType.type);
              
              return (
                <button
                  key={ruleType.type}
                  onClick={() => !isAdded && addValidationRule(ruleType.type)}
                  disabled={isAdded}
                  className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                    isAdded
                      ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                      : 'bg-white border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {ruleType.label}
                  {isAdded && <Check className="w-3 h-3 inline ml-1 text-green-600" />}
                </button>
              );
            })}
            
            {getAvailableRules().length > 4 && (
              <button
                onClick={() => setShowAdvanced(true)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50"
              >
                + More
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation Preview */}
      {field.validationRules.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-medium text-blue-900">Validation Preview</h4>
          </div>
          <div className="text-xs text-blue-700">
            <p>This field will be validated with {field.validationRules.length} rule(s):</p>
            <ul className="mt-1 ml-4 list-disc">
              {field.validationRules.map((rule, index) => (
                <li key={index} className="truncate">
                  {rule.type.replace(/_/g, ' ')}: {rule.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Helper Text */}
      {field.validationRules.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No validation rules added</p>
          <p className="text-xs mt-1">Add rules to ensure data quality and consistency</p>
        </div>
      )}
    </div>
  );
};

export default ValidationRules;
