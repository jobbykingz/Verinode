import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Save, 
  Eye, 
  EyeOff, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  Settings,
  Palette,
  Share2,
  Check,
  X
} from 'lucide-react';
import FieldDefinitions from './FieldDefinitions';
import ValidationRules from './ValidationRules';
import TemplatePreview from './TemplatePreview';
import DragDropInterface from './DragDropInterface';

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

interface TemplateSection {
  id: string;
  title?: string;
  description?: string;
  fields: { fieldId: string; width: string }[];
  order: number;
}

interface TemplateTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
}

interface TemplateLayout {
  sections: TemplateSection[];
  theme: TemplateTheme;
}

interface CustomTemplate {
  id?: string;
  name: string;
  description: string;
  version: string;
  category: string;
  fields: TemplateField[];
  validationRules: ValidationRule[];
  layout: TemplateLayout;
  templateSchema: any;
  sampleData?: any;
  isPublic: boolean;
  tags: string[];
  price: number;
  requiresEncryption: boolean;
  privacyLevel: string;
}

interface VisualBuilderProps {
  initialTemplate?: CustomTemplate;
  onSave: (template: CustomTemplate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const VisualBuilder: React.FC<VisualBuilderProps> = ({
  initialTemplate,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [template, setTemplate] = useState<CustomTemplate>(
    initialTemplate || {
      name: '',
      description: '',
      version: '1.0.0',
      category: 'custom',
      fields: [],
      validationRules: [],
      layout: {
        sections: [],
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#6b7280',
          backgroundColor: '#ffffff',
          textColor: '#1f2937'
        }
      },
      templateSchema: {},
      isPublic: false,
      tags: [],
      price: 0,
      requiresEncryption: false,
      privacyLevel: 'public'
    }
  );

  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'settings'>('builder');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  // Initialize with a default section if none exists
  useEffect(() => {
    if (template.layout.sections.length === 0) {
      setTemplate(prev => ({
        ...prev,
        layout: {
          ...prev.layout,
          sections: [{
            id: 'main',
            title: 'Main Information',
            fields: [],
            order: 0
          }]
        }
      }));
    }
  }, [template.layout.sections.length]);

  const validateTemplate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!template.name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (template.name.length > 100) {
      newErrors.name = 'Template name must be less than 100 characters';
    }

    if (!template.description.trim()) {
      newErrors.description = 'Template description is required';
    } else if (template.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }

    if (template.fields.length === 0) {
      newErrors.fields = 'At least one field is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateTemplate()) {
      try {
        await onSave(template);
      } catch (error) {
        console.error('Failed to save template:', error);
      }
    }
  };

  const handleFieldChange = (fieldId: string, updates: Partial<TemplateField>) => {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    }));
  };

  const handleAddField = (field: Omit<TemplateField, 'id' | 'order'>) => {
    const newField: TemplateField = {
      ...field,
      id: `field_${Date.now()}`,
      order: template.fields.length
    };

    setTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));

    // Add field to the first section
    if (template.layout.sections.length > 0) {
      const firstSection = template.layout.sections[0];
      setTemplate(prev => ({
        ...prev,
        layout: {
          ...prev.layout,
          sections: prev.layout.sections.map(section => 
            section.id === firstSection.id
              ? {
                  ...section,
                  fields: [...section.fields, { fieldId: newField.id, width: 'full' }]
                }
              : section
          )
        }
      }));
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId),
      validationRules: prev.validationRules.filter(rule => rule.fieldId !== fieldId),
      layout: {
        ...prev.layout,
        sections: prev.layout.sections.map(section => ({
          ...section,
          fields: section.fields.filter(f => f.fieldId !== fieldId)
        }))
      }
    }));
  };

  const handleAddValidationRule = (rule: Omit<ValidationRule, 'id'>) => {
    const newRule: ValidationRule = {
      ...rule,
      id: `rule_${Date.now()}`
    };

    setTemplate(prev => ({
      ...prev,
      validationRules: [...prev.validationRules, newRule]
    }));
  };

  const handleRemoveValidationRule = (ruleId: string) => {
    setTemplate(prev => ({
      ...prev,
      validationRules: prev.validationRules.filter(rule => rule.id !== ruleId)
    }));
  };

  const handleLayoutChange = (layout: TemplateLayout) => {
    setTemplate(prev => ({
      ...prev,
      layout
    }));
  };

  const getFieldById = (fieldId: string) => {
    return template.fields.find(field => field.id === fieldId);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {template.name || 'Untitled Template'}
            </h1>
            <p className="text-gray-600 mt-1">
              {template.description || 'Create your custom proof template'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isPreviewMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {isPreviewMode ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || Object.keys(errors).length > 0}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <div className="bg-white border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'builder', label: 'Builder', icon: Plus },
                { id: 'preview', label: 'Preview', icon: Eye },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'builder' && !isPreviewMode && (
              <div className="p-6">
                <DragDropInterface
                  template={template}
                  onTemplateChange={setTemplate}
                  selectedField={selectedField}
                  onFieldSelect={setSelectedField}
                />
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="p-6">
                <TemplatePreview template={template} />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Template Settings</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Template Name *
                        </label>
                        <input
                          type="text"
                          value={template.name}
                          onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                            errors.name ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter template name"
                        />
                        {errors.name && (
                          <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category
                        </label>
                        <select
                          value={template.category}
                          onChange={(e) => setTemplate(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="identity">Identity Verification</option>
                          <option value="credential">Credentials</option>
                          <option value="document">Document Verification</option>
                          <option value="transaction">Transaction Proofs</option>
                          <option value="employment">Employment</option>
                          <option value="education">Education</option>
                          <option value="healthcare">Healthcare</option>
                          <option value="finance">Finance</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        value={template.description}
                        onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                          errors.description ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Describe what this template is used for..."
                      />
                      {errors.description && (
                        <p className="mt-2 text-sm text-red-600">{errors.description}</p>
                      )}
                    </div>

                    <div className="mt-6 flex items-center space-x-6">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={template.isPublic}
                          onChange={(e) => setTemplate(prev => ({ ...prev, isPublic: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Make template public</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={template.requiresEncryption}
                          onChange={(e) => setTemplate(prev => ({ ...prev, requiresEncryption: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Require encryption</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'builder' && isPreviewMode && (
              <div className="p-6">
                <TemplatePreview template={template} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {!isPreviewMode && (
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Template Components</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <FieldDefinitions
                  fields={template.fields}
                  onFieldChange={handleFieldChange}
                  onFieldAdd={handleAddField}
                  onFieldRemove={handleRemoveField}
                  selectedField={selectedField}
                  onFieldSelect={setSelectedField}
                />
              </div>
              
              <div className="p-4 border-t border-gray-200">
                <ValidationRules
                  rules={template.validationRules}
                  fields={template.fields}
                  onRuleAdd={handleAddValidationRule}
                  onRuleRemove={handleRemoveValidationRule}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualBuilder;
