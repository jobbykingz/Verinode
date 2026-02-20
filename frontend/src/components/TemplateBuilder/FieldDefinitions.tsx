import React, { useState } from 'react';
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface TemplateField {
  id: string;
  name: string;
  type: string;
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  helpText?: string;
  order: number;
  visible: boolean;
  editable: boolean;
}

interface FieldDefinitionsProps {
  fields: TemplateField[];
  onFieldChange: (fieldId: string, updates: Partial<TemplateField>) => void;
  onFieldAdd: (field: Omit<TemplateField, 'id' | 'order'>) => void;
  onFieldRemove: (fieldId: string) => void;
  selectedField: string | null;
  onFieldSelect: (fieldId: string | null) => void;
}

const FieldDefinitions: React.FC<FieldDefinitionsProps> = ({
  fields,
  onFieldChange,
  onFieldAdd,
  onFieldRemove,
  selectedField,
  onFieldSelect
}) => {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState<Omit<TemplateField, 'id' | 'order'>>({
    name: '',
    type: 'text',
    label: '',
    required: false,
    visible: true,
    editable: true
  });

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'phone', label: 'Phone' },
    { value: 'select', label: 'Select' },
    { value: 'multiselect', label: 'Multi Select' },
    { value: 'file', label: 'File' },
    { value: 'json', label: 'JSON' }
  ];

  const handleAddField = () => {
    if (newField.name && newField.label) {
      onFieldAdd(newField);
      setNewField({
        name: '',
        type: 'text',
        label: '',
        required: false,
        visible: true,
        editable: true
      });
      setShowAddForm(false);
    }
  };

  const handleFieldUpdate = (fieldId: string, field: Partial<TemplateField>) => {
    onFieldChange(fieldId, field);
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'text': return 'T';
      case 'number': return '123';
      case 'date': return '📅';
      case 'boolean': return '☑';
      case 'email': return '✉';
      case 'url': return '🔗';
      case 'phone': return '📞';
      case 'select': return '⌄';
      case 'file': return '📁';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Fields</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Field
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900">Add New Field</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field Name *
              </label>
              <input
                type="text"
                value={newField.name}
                onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., firstName"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Label *
              </label>
              <input
                type="text"
                value={newField.label}
                onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="First Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={newField.type}
              onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {fieldTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newField.required}
                onChange={(e) => setNewField(prev => ({ ...prev, required: e.target.checked }))}
                className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Required</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newField.visible}
                onChange={(e) => setNewField(prev => ({ ...prev, visible: e.target.checked }))}
                className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Visible</span>
            </label>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleAddField}
              disabled={!newField.name || !newField.label}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Field
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
        {fields.map((field) => (
          <div
            key={field.id}
            className={`border rounded-lg transition-colors ${
              selectedField === field.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => {
                if (expandedField === field.id) {
                  setExpandedField(null);
                } else {
                  setExpandedField(field.id);
                }
                onFieldSelect(field.id);
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                  {getFieldIcon(field.type)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{field.label}</div>
                  <div className="text-xs text-gray-500">{field.name} • {field.type}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {field.required && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Required
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFieldRemove(field.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedField === field.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {expandedField === field.id && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleFieldUpdate(field.id, { label: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => handleFieldUpdate(field.id, { placeholder: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={field.description || ''}
                    onChange={(e) => handleFieldUpdate(field.id, { description: e.target.value })}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => handleFieldUpdate(field.id, { required: e.target.checked })}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Required</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.visible}
                      onChange={(e) => handleFieldUpdate(field.id, { visible: e.target.checked })}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Visible</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.editable}
                      onChange={(e) => handleFieldUpdate(field.id, { editable: e.target.checked })}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Editable</span>
                  </label>
                </div>

                {field.type === 'select' || field.type === 'multiselect' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => handleFieldUpdate(field.id, { 
                        options: e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt) 
                      })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                ) : null}

                {(field.type === 'text' || field.type === 'email' || field.type === 'url') ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Min Length
                      </label>
                      <input
                        type="number"
                        value={field.minLength || ''}
                        onChange={(e) => handleFieldUpdate(field.id, { 
                          minLength: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={field.maxLength || ''}
                        onChange={(e) => handleFieldUpdate(field.id, { 
                          maxLength: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : null}

                {field.type === 'number' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Min Value
                      </label>
                      <input
                        type="number"
                        value={field.minValue || ''}
                        onChange={(e) => handleFieldUpdate(field.id, { 
                          minValue: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Max Value
                      </label>
                      <input
                        type="number"
                        value={field.maxValue || ''}
                        onChange={(e) => handleFieldUpdate(field.id, { 
                          maxValue: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Help Text
                  </label>
                  <input
                    type="text"
                    value={field.helpText || ''}
                    onChange={(e) => handleFieldUpdate(field.id, { helpText: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Help text for users"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {fields.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No fields added yet</p>
            <p className="text-sm mt-1">Click "Add Field" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldDefinitions;
