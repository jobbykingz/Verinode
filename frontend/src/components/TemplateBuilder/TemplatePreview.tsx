import React from 'react';

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
  validationRules: any[];
  layout: TemplateLayout;
  templateSchema: any;
  sampleData?: any;
  isPublic: boolean;
  tags: string[];
  price: number;
  requiresEncryption: boolean;
  privacyLevel: string;
}

interface TemplatePreviewProps {
  template: CustomTemplate;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template }) => {
  const getFieldById = (fieldId: string) => {
    return template.fields.find(field => field.id === fieldId);
  };

  const renderField = (field: TemplateField) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const disabledClasses = "bg-gray-100 text-gray-500 cursor-not-allowed";
    
    const className = `${baseClasses} ${field.editable ? '' : disabledClasses}`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            placeholder={field.placeholder}
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            placeholder={field.placeholder}
            min={field.minValue}
            max={field.maxValue}
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          />
        );
      
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={!field.editable}
              defaultChecked={field.defaultValue}
            />
            <label className="ml-2 text-sm text-gray-700">
              {field.label}
            </label>
          </div>
        );
      
      case 'select':
        return (
          <select
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          >
            <option value="">{field.placeholder || 'Select an option'}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'multiselect':
        return (
          <select
            multiple
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          >
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'file':
        return (
          <input
            type="file"
            className={className}
            disabled={!field.editable}
          />
        );
      
      default:
        return (
          <input
            type="text"
            placeholder={field.placeholder}
            className={className}
            disabled={!field.editable}
            defaultValue={field.defaultValue}
          />
        );
    }
  };

  const getFieldWidthClass = (width: string) => {
    switch (width) {
      case 'half': return 'md:col-span-6';
      case 'third': return 'md:col-span-4';
      case 'quarter': return 'md:col-span-3';
      default: return 'md:col-span-12';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Template Header */}
        <div 
          className="p-6 border-b border-gray-200"
          style={{ backgroundColor: template.layout.theme.backgroundColor }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 
                className="text-2xl font-bold"
                style={{ color: template.layout.theme.textColor }}
              >
                {template.name}
              </h1>
              <p 
                className="mt-2 text-gray-600"
                style={{ color: template.layout.theme.secondaryColor }}
              >
                {template.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {template.category}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  v{template.version}
                </span>
                {template.isPublic && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    Public
                  </span>
                )}
                {template.requiresEncryption && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    Encrypted
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              {template.price > 0 && (
                <div className="text-3xl font-bold text-green-600">
                  {template.price} XLM
                </div>
              )}
              <div className="mt-2 text-sm text-gray-500">
                {template.fields.length} fields
              </div>
            </div>
          </div>
        </div>

        {/* Template Form */}
        <div className="p-6">
          <form className="space-y-6">
            {template.layout.sections
              .sort((a, b) => a.order - b.order)
              .map(section => {
                const visibleFields = section.fields
                  .map(f => getFieldById(f.fieldId))
                  .filter(field => field && field.visible) as TemplateField[];
                
                if (visibleFields.length === 0) return null;
                
                return (
                  <div key={section.id}>
                    {section.title && (
                      <div className="mb-4">
                        <h2 
                          className="text-xl font-semibold"
                          style={{ color: template.layout.theme.primaryColor }}
                        >
                          {section.title}
                        </h2>
                        {section.description && (
                          <p className="mt-1 text-gray-600">{section.description}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-12 gap-4">
                      {section.fields
                        .map(f => {
                          const field = getFieldById(f.fieldId);
                          return field && field.visible ? { ...field, width: f.width } : null;
                        })
                        .filter(Boolean)
                        .map((field: any) => (
                          <div 
                            key={field.id} 
                            className={`col-span-12 ${getFieldWidthClass(field.width)}`}
                          >
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>
                            
                            {renderField(field)}
                            
                            {field.description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {field.description}
                              </p>
                            )}
                            
                            {field.helpText && (
                              <p className="mt-1 text-xs text-blue-600">
                                {field.helpText}
                              </p>
                            )}
                            
                            {field.type === 'email' && (
                              <p className="mt-1 text-xs text-gray-500">
                                Example: user@example.com
                              </p>
                            )}
                            
                            {field.type === 'url' && (
                              <p className="mt-1 text-xs text-gray-500">
                                Include http:// or https://
                              </p>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })
            }
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                This is a preview of your template
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  style={{ backgroundColor: template.layout.theme.primaryColor }}
                >
                  Submit
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Template Information */}
      <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Fields</h3>
            <div className="space-y-2">
              {template.fields
                .filter(field => field.visible)
                .map(field => (
                  <div key={field.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{field.label}</span>
                    <span className="text-gray-500">
                      {field.type} {field.required && <span className="text-red-500">*</span>}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Validation Rules</h3>
            <div className="space-y-2">
              {template.validationRules.length > 0 ? (
                template.validationRules.map(rule => {
                  const field = template.fields.find(f => f.id === rule.fieldId);
                  return (
                    <div key={rule.id} className="text-sm">
                      <div className="font-medium text-gray-700">{rule.name}</div>
                      <div className="text-gray-500">{field?.label} • {rule.ruleType}</div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm">No validation rules defined</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Metadata</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Category:</span>
              <span className="ml-2 font-medium">{template.category}</span>
            </div>
            <div>
              <span className="text-gray-500">Fields:</span>
              <span className="ml-2 font-medium">{template.fields.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Rules:</span>
              <span className="ml-2 font-medium">{template.validationRules.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Sections:</span>
              <span className="ml-2 font-medium">{template.layout.sections.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;
