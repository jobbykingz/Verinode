import React, { useState } from 'react';
import { FormField, ConditionalLogic, ConditionalOperator } from '../../types/formBuilder';
import { 
  Plus, 
  X, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  ArrowRight,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface ConditionalLogicProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (logic: ConditionalLogic[]) => void;
}

const ConditionalLogic: React.FC<ConditionalLogicProps> = ({ field, allFields, onUpdate }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const conditionalOperators: Array<{
    operator: ConditionalOperator;
    label: string;
    description: string;
    applicableFieldTypes: string[];
    valueType: 'text' | 'number' | 'boolean' | 'any';
  }> = [
    {
      operator: 'equals',
      label: 'Equals',
      description: 'Field value equals specified value',
      applicableFieldTypes: ['*'],
      valueType: 'any',
    },
    {
      operator: 'not_equals',
      label: 'Not Equals',
      description: 'Field value does not equal specified value',
      applicableFieldTypes: ['*'],
      valueType: 'any',
    },
    {
      operator: 'contains',
      label: 'Contains',
      description: 'Field value contains specified text',
      applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
      valueType: 'text',
    },
    {
      operator: 'not_contains',
      label: 'Does Not Contain',
      description: 'Field value does not contain specified text',
      applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
      valueType: 'text',
    },
    {
      operator: 'starts_with',
      label: 'Starts With',
      description: 'Field value starts with specified text',
      applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
      valueType: 'text',
    },
    {
      operator: 'ends_with',
      label: 'Ends With',
      description: 'Field value ends with specified text',
      applicableFieldTypes: ['text', 'textarea', 'email', 'url', 'phone'],
      valueType: 'text',
    },
    {
      operator: 'greater_than',
      label: 'Greater Than',
      description: 'Field value is greater than specified value',
      applicableFieldTypes: ['number', 'date', 'datetime', 'time'],
      valueType: 'number',
    },
    {
      operator: 'less_than',
      label: 'Less Than',
      description: 'Field value is less than specified value',
      applicableFieldTypes: ['number', 'date', 'datetime', 'time'],
      valueType: 'number',
    },
    {
      operator: 'is_empty',
      label: 'Is Empty',
      description: 'Field has no value',
      applicableFieldTypes: ['*'],
      valueType: 'boolean',
    },
    {
      operator: 'is_not_empty',
      label: 'Is Not Empty',
      description: 'Field has a value',
      applicableFieldTypes: ['*'],
      valueType: 'boolean',
    },
    {
      operator: 'is_checked',
      label: 'Is Checked',
      description: 'Checkbox is checked',
      applicableFieldTypes: ['checkbox'],
      valueType: 'boolean',
    },
    {
      operator: 'is_not_checked',
      label: 'Is Not Checked',
      description: 'Checkbox is not checked',
      applicableFieldTypes: ['checkbox'],
      valueType: 'boolean',
    },
  ];

  const conditionalActions = [
    { action: 'show', label: 'Show', description: 'Show this field', icon: 'Eye' },
    { action: 'hide', label: 'Hide', description: 'Hide this field', icon: 'EyeOff' },
    { action: 'enable', label: 'Enable', description: 'Enable this field', icon: 'CheckCircle' },
    { action: 'disable', label: 'Disable', description: 'Disable this field', icon: 'XCircle' },
    { action: 'require', label: 'Require', description: 'Make this field required', icon: 'AlertCircle' },
  ];

  const getAvailableFields = () => {
    return allFields.filter(f => f.id !== field.id);
  };

  const getAvailableOperators = (targetFieldType: string) => {
    return conditionalOperators.filter(op => 
      op.applicableFieldTypes.includes('*') || 
      op.applicableFieldTypes.includes(targetFieldType)
    );
  };

  const addConditionalLogic = () => {
    const availableFields = getAvailableFields();
    if (availableFields.length === 0) return;

    const targetField = availableFields[0];
    const availableOperators = getAvailableOperators(targetField.type);
    const defaultOperator = availableOperators[0]?.operator || 'equals';

    const newLogic: ConditionalLogic = {
      id: `logic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fieldId: targetField.id,
      operator: defaultOperator,
      value: getDefaultValueForOperator(defaultOperator),
      action: 'show',
    };

    const updatedLogic = [...(field.conditionalLogic || []), newLogic];
    onUpdate(updatedLogic);
  };

  const getDefaultValueForOperator = (operator: ConditionalOperator): any => {
    switch (operator) {
      case 'equals':
      case 'not_equals':
      case 'contains':
      case 'not_contains':
      case 'starts_with':
      case 'ends_with':
        return '';
      case 'greater_than':
      case 'less_than':
        return 0;
      case 'is_empty':
      case 'is_not_empty':
      case 'is_checked':
      case 'is_not_checked':
        return true;
      default:
        return '';
    }
  };

  const removeConditionalLogic = (index: number) => {
    const updatedLogic = (field.conditionalLogic || []).filter((_, i) => i !== index);
    onUpdate(updatedLogic);
  };

  const updateConditionalLogic = (index: number, updates: Partial<ConditionalLogic>) => {
    const updatedLogic = (field.conditionalLogic || []).map((logic, i) => 
      i === index ? { ...logic, ...updates } : logic
    );
    onUpdate(updatedLogic);
  };

  const duplicateConditionalLogic = (index: number) => {
    const logicToDuplicate = (field.conditionalLogic || [])[index];
    if (!logicToDuplicate) return;

    const duplicatedLogic: ConditionalLogic = {
      ...logicToDuplicate,
      id: `logic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const updatedLogic = [...(field.conditionalLogic || [])];
    updatedLogic.splice(index + 1, 0, duplicatedLogic);
    onUpdate(updatedLogic);
  };

  const renderValueInput = (logic: ConditionalLogic, index: number) => {
    const targetField = allFields.find(f => f.id === logic.fieldId);
    if (!targetField) return null;

    const operatorConfig = conditionalOperators.find(op => op.operator === logic.operator);
    const valueType = operatorConfig?.valueType || 'text';

    // Some operators don't need a value
    if (['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(logic.operator)) {
      return (
        <div className="text-sm text-gray-500 italic">
          No value needed for this operator
        </div>
      );
    }

    switch (valueType) {
      case 'text':
        return (
          <input
            type="text"
            value={logic.value || ''}
            onChange={(e) => updateConditionalLogic(index, { value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter value..."
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={logic.value || ''}
            onChange={(e) => updateConditionalLogic(index, { value: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter number..."
          />
        );
      
      case 'boolean':
        return (
          <select
            value={logic.value ? 'true' : 'false'}
            onChange={(e) => updateConditionalLogic(index, { value: e.target.value === 'true' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      
      default:
        return (
          <input
            type="text"
            value={logic.value || ''}
            onChange={(e) => updateConditionalLogic(index, { value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter value..."
          />
        );
    }
  };

  const getLogicDescription = (logic: ConditionalLogic): string => {
    const targetField = allFields.find(f => f.id === logic.fieldId);
    const operatorConfig = conditionalOperators.find(op => op.operator === logic.operator);
    const actionConfig = conditionalActions.find(a => a.action === logic.action);

    if (!targetField || !operatorConfig || !actionConfig) return '';

    let valueText = '';
    if (logic.value !== undefined && logic.value !== null) {
      if (typeof logic.value === 'boolean') {
        valueText = logic.value ? 'true' : 'false';
      } else {
        valueText = `"${logic.value}"`;
      }
    }

    return `If ${targetField.label} ${operatorConfig.label.toLowerCase()}${valueText ? ` ${valueText}` : ''}, then ${actionConfig.label.toLowerCase()} this field`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Conditional Logic</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Current Logic Rules */}
      {(field.conditionalLogic || []).length > 0 && (
        <div className="space-y-3">
          {(field.conditionalLogic || []).map((logic, index) => {
            const targetField = allFields.find(f => f.id === logic.fieldId);
            
            return (
              <div key={logic.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      Rule {index + 1}
                    </span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {logic.action}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => duplicateConditionalLogic(index)}
                      className="p-1 rounded hover:bg-gray-200"
                      title="Duplicate rule"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => removeConditionalLogic(index)}
                      className="p-1 rounded hover:bg-red-100"
                      title="Remove rule"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Logic Description */}
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  {getLogicDescription(logic)}
                </div>

                {/* Field Selection */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      When Field
                    </label>
                    <select
                      value={logic.fieldId}
                      onChange={(e) => {
                        const newFieldId = e.target.value;
                        const newField = allFields.find(f => f.id === newFieldId);
                        if (newField) {
                          const availableOperators = getAvailableOperators(newField.type);
                          const defaultOperator = availableOperators[0]?.operator || 'equals';
                          updateConditionalLogic(index, {
                            fieldId: newFieldId,
                            operator: defaultOperator,
                            value: getDefaultValueForOperator(defaultOperator),
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {getAvailableFields().map(field => (
                        <option key={field.id} value={field.id}>
                          {field.label} ({field.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operator Selection */}
                  {targetField && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition
                      </label>
                      <select
                        value={logic.operator}
                        onChange={(e) => {
                          const newOperator = e.target.value as ConditionalOperator;
                          updateConditionalLogic(index, {
                            operator: newOperator,
                            value: getDefaultValueForOperator(newOperator),
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {getAvailableOperators(targetField.type).map(op => (
                          <option key={op.operator} value={op.operator}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Value Input */}
                  {targetField && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Value
                      </label>
                      {renderValueInput(logic, index)}
                    </div>
                  )}

                  {/* Action Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Then
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {conditionalActions.map(action => (
                        <button
                          key={action.action}
                          onClick={() => updateConditionalLogic(index, { action: action.action as any })}
                          className={`p-2 border rounded-lg text-left transition-colors ${
                            logic.action === action.action
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="text-sm font-medium">{action.label}</div>
                          <div className="text-xs text-gray-500">{action.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Logic Rule */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Add Logic Rule</h4>
          {getAvailableFields().length === 0 && (
            <span className="text-xs text-gray-500">
              Add more fields to enable conditional logic
            </span>
          )}
        </div>
        
        <button
          onClick={addConditionalLogic}
          disabled={getAvailableFields().length === 0}
          className={`w-full flex items-center justify-center space-x-2 p-3 border-2 border-dashed rounded-lg transition-colors ${
            getAvailableFields().length === 0
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add Conditional Logic</span>
        </button>
      </div>

      {/* Logic Preview */}
      {(field.conditionalLogic || []).length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Settings className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-medium text-green-900">Logic Summary</h4>
          </div>
          <div className="text-xs text-green-700">
            <p>This field has {(field.conditionalLogic || []).length} conditional rule(s):</p>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              {(field.conditionalLogic || []).map((logic, index) => (
                <li key={logic.id} className="truncate">
                  {getLogicDescription(logic)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Helper Text */}
      {(field.conditionalLogic || []).length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No conditional logic added</p>
          <p className="text-xs mt-1">Add rules to show/hide fields based on user input</p>
        </div>
      )}

      {/* Advanced Options */}
      {showAdvanced && (field.conditionalLogic || []).length > 1 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h4 className="text-sm font-medium text-yellow-900">Logic Evaluation</h4>
          </div>
          <div className="text-xs text-yellow-700">
            <p>Multiple rules are evaluated independently. This field will be affected if ANY rule condition is met.</p>
            <p className="mt-1">For more complex logic (AND/OR conditions), consider using custom validation rules.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionalLogic;
