import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  FormField, 
  FormTemplate, 
  FormBuilderState, 
  FieldType, 
  FieldLibraryItem 
} from '../../types/formBuilder';
import FieldLibrary from './FieldLibrary';
import ValidationRules from './ValidationRules';
import ConditionalLogic from './ConditionalLogic';
import FormPreview from './FormPreview';
import FormBuilderService from '../../services/formBuilderService';
import { 
  Plus, 
  Settings, 
  Eye, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Copy,
  Move,
  Lock,
  Unlock
} from 'lucide-react';

const FormBuilder: React.FC = () => {
  const [state, setState] = useState<FormBuilderState>({
    template: null,
    selectedField: null,
    draggedField: null,
    previewMode: false,
    validationErrors: {},
    isDirty: false,
    isLoading: false,
  });

  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'settings'>('builder');
  const [showFieldLibrary, setShowFieldLibrary] = useState(true);
  const formBuilderService = useRef(new FormBuilderService());

  // Initialize empty template
  useEffect(() => {
    const initializeTemplate = () => {
      const emptyTemplate: FormTemplate = {
        id: '',
        name: 'New Form Template',
        description: '',
        fields: [],
        settings: {
          title: 'Untitled Form',
          description: '',
          submitButtonText: 'Submit',
          resetButtonText: 'Reset',
          showProgressBar: false,
          allowSave: true,
          multipleSubmissions: false,
          confirmationMessage: 'Thank you for your submission!',
          redirectUrl: '',
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user',
          version: 1,
          tags: [],
          category: 'general',
          isPublic: false,
          usageCount: 0,
        },
      };
      setState(prev => ({ ...prev, template: emptyTemplate }));
    };

    initializeTemplate();
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (!state.isDirty || !state.template) return;

    const autoSaveTimeout = setTimeout(() => {
      handleAutoSave();
    }, 2000); // Auto-save after 2 seconds

    return () => clearTimeout(autoSaveTimeout);
  }, [state.isDirty, state.template]);

  const handleAutoSave = useCallback(async () => {
    if (!state.template) return;

    try {
      await formBuilderService.current.autoSaveTemplate(state.template);
      setState(prev => ({ ...prev, isDirty: false }));
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [state.template]);

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination || !state.template) return;

    const { source, destination, draggableId } = result;

    // Handle dragging from field library to form
    if (source.droppableId === 'field-library') {
      const fieldType = draggableId as FieldType;
      addFieldToForm(fieldType, destination.index);
      return;
    }

    // Handle reordering existing fields
    if (source.droppableId === 'form-fields' && destination.droppableId === 'form-fields') {
      reorderFields(source.index, destination.index);
    }
  }, [state.template]);

  const addFieldToForm = useCallback((fieldType: FieldType, index: number) => {
    if (!state.template) return;

    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: fieldType,
      label: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
      name: `${fieldType}_${Date.now()}`,
      placeholder: '',
      description: '',
      required: false,
      disabled: false,
      validationRules: [],
      settings: getDefaultFieldSettings(fieldType),
      order: index,
    };

    const updatedFields = [...state.template.fields];
    updatedFields.splice(index, 0, newField);

    // Update order for all fields
    updatedFields.forEach((field, i) => {
      field.order = i;
    });

    setState(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        fields: updatedFields,
        metadata: {
          ...prev.template!.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      isDirty: true,
      selectedField: newField,
    }));
  }, [state.template]);

  const reorderFields = useCallback((sourceIndex: number, destinationIndex: number) => {
    if (!state.template) return;

    const updatedFields = [...state.template.fields];
    const [movedField] = updatedFields.splice(sourceIndex, 1);
    updatedFields.splice(destinationIndex, 0, movedField);

    // Update order for all fields
    updatedFields.forEach((field, i) => {
      field.order = i;
    });

    setState(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        fields: updatedFields,
        metadata: {
          ...prev.template!.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      isDirty: true,
    }));
  }, [state.template]);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    if (!state.template) return;

    const updatedFields = state.template.fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    setState(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        fields: updatedFields,
        metadata: {
          ...prev.template!.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      isDirty: true,
      selectedField: prev.selectedField?.id === fieldId 
        ? { ...prev.selectedField, ...updates }
        : prev.selectedField,
    }));
  }, [state.template]);

  const deleteField = useCallback((fieldId: string) => {
    if (!state.template) return;

    const updatedFields = state.template.fields.filter(field => field.id !== fieldId);

    // Update order for remaining fields
    updatedFields.forEach((field, i) => {
      field.order = i;
    });

    setState(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        fields: updatedFields,
        metadata: {
          ...prev.template!.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      isDirty: true,
      selectedField: prev.selectedField?.id === fieldId ? null : prev.selectedField,
    }));
  }, [state.template]);

  const duplicateField = useCallback((fieldId: string) => {
    if (!state.template) return;

    const fieldToDuplicate = state.template.fields.find(field => field.id === fieldId);
    if (!fieldToDuplicate) return;

    const duplicatedField: FormField = {
      ...fieldToDuplicate,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${fieldToDuplicate.name}_copy`,
      label: `${fieldToDuplicate.label} (Copy)`,
    };

    const fieldIndex = state.template.fields.findIndex(field => field.id === fieldId);
    const updatedFields = [...state.template.fields];
    updatedFields.splice(fieldIndex + 1, 0, duplicatedField);

    // Update order for all fields
    updatedFields.forEach((field, i) => {
      field.order = i;
    });

    setState(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        fields: updatedFields,
        metadata: {
          ...prev.template!.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
      isDirty: true,
      selectedField: duplicatedField,
    }));
  }, [state.template]);

  const handleSave = useCallback(async () => {
    if (!state.template) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      let savedTemplate: FormTemplate;
      
      if (state.template.id) {
        savedTemplate = await formBuilderService.current.updateTemplate(state.template.id, state.template);
      } else {
        savedTemplate = await formBuilderService.current.createTemplate(state.template);
      }

      setState(prev => ({
        ...prev,
        template: savedTemplate,
        isDirty: false,
        isLoading: false,
      }));

      // Show success message
      console.log('Form template saved successfully!');
    } catch (error) {
      console.error('Failed to save form template:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.template]);

  const handleExport = useCallback(async () => {
    if (!state.template) return;

    try {
      const blob = await formBuilderService.current.exportTemplate(state.template.id, 'json');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.template.name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export form template:', error);
    }
  }, [state.template]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const importedTemplate = await formBuilderService.current.importTemplate(file);
      setState(prev => ({
        ...prev,
        template: importedTemplate,
        isDirty: false,
        selectedField: null,
      }));
    } catch (error) {
      console.error('Failed to import form template:', error);
    }
  }, []);

  const getDefaultFieldSettings = (fieldType: FieldType): Record<string, any> => {
    const commonSettings = {
      showLabel: true,
      showDescription: true,
      showPlaceholder: true,
      cssClass: '',
      customAttributes: {},
    };

    switch (fieldType) {
      case 'text':
      case 'email':
      case 'password':
      case 'url':
      case 'phone':
        return {
          ...commonSettings,
          maxLength: 255,
          minLength: 0,
          inputType: fieldType,
        };
      case 'number':
        return {
          ...commonSettings,
          min: 0,
          max: 999999,
          step: 1,
          decimalPlaces: 0,
        };
      case 'textarea':
        return {
          ...commonSettings,
          rows: 4,
          maxLength: 1000,
          minLength: 0,
          resize: 'vertical',
        };
      case 'select':
      case 'multiselect':
        return {
          ...commonSettings,
          allowOther: false,
          otherLabel: 'Other',
          options: [
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
          ],
        };
      case 'radio':
      case 'checkbox':
        return {
          ...commonSettings,
          inline: false,
          options: [
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
          ],
        };
      case 'file':
      case 'image':
        return {
          ...commonSettings,
          multiple: false,
          maxFileSize: 5242880, // 5MB
          allowedTypes: fieldType === 'image' 
            ? ['image/jpeg', 'image/png', 'image/gif']
            : ['application/pdf', 'image/jpeg', 'image/png'],
        };
      case 'date':
        return {
          ...commonSettings,
          minDate: '',
          maxDate: '',
          dateFormat: 'YYYY-MM-DD',
        };
      case 'datetime':
        return {
          ...commonSettings,
          minDate: '',
          maxDate: '',
          dateTimeFormat: 'YYYY-MM-DD HH:mm',
        };
      case 'time':
        return {
          ...commonSettings,
          minTime: '',
          maxTime: '',
          timeFormat: '24h',
        };
      case 'rating':
        return {
          ...commonSettings,
          maxRating: 5,
          allowHalf: false,
          showValues: true,
        };
      case 'range':
        return {
          ...commonSettings,
          min: 0,
          max: 100,
          step: 1,
          showLabels: true,
          showValue: true,
        };
      case 'signature':
        return {
          ...commonSettings,
          width: 400,
          height: 200,
          backgroundColor: '#ffffff',
          penColor: '#000000',
        };
      default:
        return commonSettings;
    }
  };

  if (!state.template) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Field Library */}
      <div className={`w-80 bg-white border-r border-gray-200 transition-all duration-300 ${showFieldLibrary ? 'translate-x-0' : '-translate-x-full'}`}>
        <FieldLibrary
          onFieldSelect={(fieldType) => addFieldToForm(fieldType, state.template!.fields.length)}
          onClose={() => setShowFieldLibrary(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFieldLibrary(!showFieldLibrary)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <Plus className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">{state.template.name}</h1>
              {state.isDirty && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  Unsaved
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Tab Navigation */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('builder')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'builder' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Builder
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'preview' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'settings' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Settings
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSave}
                  disabled={state.isLoading || !state.isDirty}
                  className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>

                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                    className="hidden"
                    id="import-file"
                  />
                  <label
                    htmlFor="import-file"
                    className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import</span>
                  </label>
                </div>

                <button
                  onClick={handleExport}
                  disabled={!state.template.id}
                  className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'builder' && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex h-full">
                {/* Form Fields Area */}
                <div className="flex-1 p-6">
                  <Droppable droppableId="form-fields">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-full bg-white rounded-lg border-2 border-dashed ${
                          snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                        } p-6`}
                      >
                        {state.template.fields.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="text-gray-400 mb-4">
                              <Plus className="w-12 h-12 mx-auto" />
                            </div>
                            <p className="text-gray-500 mb-2">Start building your form</p>
                            <p className="text-sm text-gray-400">
                              Drag fields from the library or click the + button to add fields
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {state.template.fields.map((field, index) => (
                              <Draggable key={field.id} draggableId={field.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${
                                      snapshot.isDragging ? 'shadow-lg opacity-75' : 'shadow-sm'
                                    } ${
                                      state.selectedField?.id === field.id 
                                        ? 'border-blue-500 ring-2 ring-blue-200' 
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setState(prev => ({ ...prev, selectedField: field }))}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <div {...provided.dragHandleProps}>
                                          <Move className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div>
                                          <h3 className="font-medium text-gray-900">{field.label}</h3>
                                          <p className="text-sm text-gray-500">{field.type}</p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        {field.required && (
                                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                            Required
                                          </span>
                                        )}
                                        {field.disabled && (
                                          <Lock className="w-4 h-4 text-gray-400" />
                                        )}
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            duplicateField(field.id);
                                          }}
                                          className="p-1 rounded hover:bg-gray-100"
                                        >
                                          <Copy className="w-4 h-4 text-gray-500" />
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteField(field.id);
                                          }}
                                          className="p-1 rounded hover:bg-red-100"
                                        >
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Field Properties Panel */}
                {state.selectedField && (
                  <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                    <div className="space-y-6">
                      {/* Basic Properties */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Field Properties</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={state.selectedField.label}
                              onChange={(e) => updateField(state.selectedField!.id, { label: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Field Name
                            </label>
                            <input
                              type="text"
                              value={state.selectedField.name}
                              onChange={(e) => updateField(state.selectedField!.id, { name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Placeholder
                            </label>
                            <input
                              type="text"
                              value={state.selectedField.placeholder || ''}
                              onChange={(e) => updateField(state.selectedField!.id, { placeholder: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <textarea
                              value={state.selectedField.description || ''}
                              onChange={(e) => updateField(state.selectedField!.id, { description: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={state.selectedField.required}
                                onChange={(e) => updateField(state.selectedField!.id, { required: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Required</span>
                            </label>

                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={state.selectedField.disabled}
                                onChange={(e) => updateField(state.selectedField!.id, { disabled: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Disabled</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Validation Rules */}
                      <ValidationRules
                        field={state.selectedField}
                        onUpdate={(rules) => updateField(state.selectedField!.id, { validationRules: rules })}
                      />

                      {/* Conditional Logic */}
                      <ConditionalLogic
                        field={state.selectedField}
                        allFields={state.template.fields}
                        onUpdate={(logic) => updateField(state.selectedField!.id, { conditionalLogic: logic })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </DragDropContext>
          )}

          {activeTab === 'preview' && (
            <div className="p-6">
              <FormPreview template={state.template} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Form Settings</h2>
                {/* Form settings implementation */}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBuilder;
