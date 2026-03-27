import React from 'react';

interface TemplateField {
  id: string;
  name: string;
  type: string;
  label: string;
  required: boolean;
  visible: boolean;
  order: number;
}

interface TemplateSection {
  id: string;
  title?: string;
  description?: string;
  fields: { fieldId: string; width: string }[];
  order: number;
}

interface TemplateLayout {
  sections: TemplateSection[];
  theme: any;
}

interface CustomTemplate {
  name: string;
  description: string;
  fields: TemplateField[];
  layout: TemplateLayout;
}

interface DragDropInterfaceProps {
  template: CustomTemplate;
  onTemplateChange: (template: CustomTemplate) => void;
  selectedField: string | null;
  onFieldSelect: (fieldId: string | null) => void;
}

const DragDropInterface: React.FC<DragDropInterfaceProps> = ({
  template,
  onTemplateChange,
  selectedField,
  onFieldSelect
}) => {
  const getFieldById = (fieldId: string) => {
    return template.fields.find(field => field.id === fieldId);
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

  const handleFieldDrop = (fieldId: string, sectionId: string, position: number) => {
    // This would implement the actual drag and drop logic
    // For now, we'll just show a placeholder
    console.log(`Dropped field ${fieldId} to section ${sectionId} at position ${position}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Layout</h2>
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Available Fields</h3>
            <div className="text-sm text-gray-500">
              {template.fields.length} fields
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {template.fields.map((field) => (
              <div
                key={field.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('fieldId', field.id);
                }}
                className={`border rounded-lg p-3 cursor-move transition-all ${
                  selectedField === field.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onFieldSelect(field.id === selectedField ? null : field.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                    {getFieldIcon(field.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {field.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {field.name} • {field.type}
                    </div>
                  </div>
                  {field.required && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      *
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {template.fields.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <p>No fields defined yet</p>
                <p className="text-sm mt-1">Add fields in the sidebar to get started</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Layout Sections</h3>
            <button className="text-sm text-blue-600 hover:text-blue-800">
              Add Section
            </button>
          </div>
          
          <div className="space-y-4">
            {template.layout.sections
              .sort((a, b) => a.order - b.order)
              .map((section) => (
                <div
                  key={section.id}
                  className="border border-gray-200 rounded-lg bg-gray-50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fieldId = e.dataTransfer.getData('fieldId');
                    if (fieldId) {
                      handleFieldDrop(fieldId, section.id, section.fields.length);
                    }
                  }}
                >
                  <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {section.title || 'Untitled Section'}
                        </h4>
                        {section.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {section.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {section.fields.length} fields
                        </span>
                        <button className="text-gray-400 hover:text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {section.fields.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {section.fields.map((sectionField, index) => {
                          const field = getFieldById(sectionField.fieldId);
                          if (!field) return null;
                          
                          return (
                            <div
                              key={sectionField.fieldId}
                              className={`border rounded-lg p-3 ${
                                selectedField === field.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                              onClick={() => onFieldSelect(field.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                    {getFieldIcon(field.type)}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 text-sm">
                                      {field.label}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {field.name}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={sectionField.width}
                                    onChange={(e) => {
                                      const newSections = template.layout.sections.map(s => 
                                        s.id === section.id
                                          ? {
                                              ...s,
                                              fields: s.fields.map(f => 
                                                f.fieldId === sectionField.fieldId
                                                  ? { ...f, width: e.target.value }
                                                  : f
                                              )
                                            }
                                          : s
                                      );
                                      onTemplateChange({
                                        ...template,
                                        layout: {
                                          ...template.layout,
                                          sections: newSections
                                        }
                                      });
                                    }}
                                    className="text-xs border border-gray-300 rounded px-2 py-1"
                                  >
                                    <option value="full">Full</option>
                                    <option value="half">Half</option>
                                    <option value="third">Third</option>
                                    <option value="quarter">Quarter</option>
                                  </select>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newSections = template.layout.sections.map(s => 
                                        s.id === section.id
                                          ? {
                                              ...s,
                                              fields: s.fields.filter(f => f.fieldId !== sectionField.fieldId)
                                            }
                                          : s
                                      );
                                      onTemplateChange({
                                        ...template,
                                        layout: {
                                          ...template.layout,
                                          sections: newSections
                                        }
                                      });
                                    }}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div 
                        className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fieldId = e.dataTransfer.getData('fieldId');
                          if (fieldId) {
                            // Add field to this section
                            const newSections = template.layout.sections.map(s => 
                              s.id === section.id
                                ? {
                                    ...s,
                                    fields: [...s.fields, { fieldId, width: 'full' }]
                                  }
                                : s
                            );
                            onTemplateChange({
                              ...template,
                              layout: {
                                ...template.layout,
                                sections: newSections
                              }
                            });
                          }
                        }}
                      >
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2">Drag fields here to add them to this section</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }
            
            {template.layout.sections.length === 0 && (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <p>No sections created yet</p>
                <p className="text-sm mt-1">Click "Add Section" to create layout sections</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragDropInterface;
