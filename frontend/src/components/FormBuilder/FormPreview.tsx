import React, { useState, useEffect } from 'react';
import { FormTemplate, FormField, FieldType } from '../../types/formBuilder';
import { 
  Eye, 
  EyeOff, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Check, 
  X, 
  AlertCircle,
  Upload,
  Star,
  Calendar,
  Clock,
  PenTool
} from 'lucide-react';

interface FormPreviewProps {
  template: FormTemplate;
}

const FormPreview: React.FC<FormPreviewProps> = ({ template }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showValidation, setShowValidation] = useState(true);

  // Initialize form data with default values
  useEffect(() => {
    const initialData: Record<string, any> = {};
    template.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialData[field.name] = field.defaultValue;
      } else {
        // Set default based on field type
        switch (field.type) {
          case 'checkbox':
            initialData[field.name] = false;
            break;
          case 'multiselect':
            initialData[field.name] = [];
            break;
          case 'number':
          case 'range':
            initialData[field.name] = field.settings?.min || 0;
            break;
          default:
            initialData[field.name] = '';
        }
      }
    });
    setFormData(initialData);
  }, [template.fields]);

  const getDeviceStyles = () => {
    switch (previewDevice) {
      case 'mobile':
        return 'max-w-sm mx-auto';
      case 'tablet':
        return 'max-w-2xl mx-auto';
      case 'desktop':
        return 'max-w-4xl mx-auto';
      default:
        return 'max-w-4xl mx-auto';
    }
  };

  const validateField = (field: FormField, value: any): string[] => {
    const errors: string[] = [];

    if (!field.validationRules || field.validationRules.length === 0) {
      return errors;
    }

    field.validationRules.forEach(rule => {
      switch (rule.type) {
        case 'required':
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors.push(rule.message);
          }
          break;
        
        case 'minLength':
          if (value && value.length < rule.value) {
            errors.push(rule.message);
          }
          break;
        
        case 'maxLength':
          if (value && value.length > rule.value) {
            errors.push(rule.message);
          }
          break;
        
        case 'min':
          if (value !== undefined && value !== '' && parseFloat(value) < rule.value) {
            errors.push(rule.message);
          }
          break;
        
        case 'max':
          if (value !== undefined && value !== '' && parseFloat(value) > rule.value) {
            errors.push(rule.message);
          }
          break;
        
        case 'pattern':
          if (value && rule.value) {
            const regex = new RegExp(rule.value as string);
            if (!regex.test(value)) {
              errors.push(rule.message);
            }
          }
          break;
        
        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(rule.message);
          }
          break;
        
        case 'url':
          if (value && !/^https?:\/\/.+/.test(value)) {
            errors.push(rule.message);
          }
          break;
        
        case 'custom':
          if (rule.customFunction && value) {
            try {
              // Simple custom validation simulation
              const customFunc = new Function('value', 'formData', rule.customFunction);
              if (!customFunc(value, formData)) {
                errors.push(rule.message);
              }
            } catch (error) {
              console.warn('Custom validation function error:', error);
            }
          }
          break;
      }
    });

    return errors;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear errors for this field when user starts typing
    if (formErrors[fieldName]) {
      setFormErrors(prev => ({ ...prev, [fieldName]: [] }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string[]> = {};
    
    template.fields.forEach(field => {
      const fieldErrors = validateField(field, formData[field.name]);
      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors;
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    
    const isValid = validateForm();
    if (isValid) {
      console.log('Form submitted:', formData);
      // In a real app, this would call the form submission service
      alert('Form submitted successfully!');
    } else {
      console.log('Form validation errors:', formErrors);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const errors = formErrors[field.name] || [];
    const hasError = errors.length > 0;

    const fieldClasses = `
      w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
      ${hasError ? 'border-red-300' : 'border-gray-300'}
      ${field.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    `;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'url':
      case 'phone':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={field.disabled}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || '')}
              placeholder={field.placeholder}
              disabled={field.disabled}
              min={field.settings?.min}
              max={field.settings?.max}
              step={field.settings?.step}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={field.disabled}
              rows={field.settings?.rows || 4}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={field.disabled}
              className={fieldClasses}
            >
              <option value="">Select an option</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map(option => (
                <label key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={(value || []).includes(option.value)}
                    onChange={(e) => {
                      const currentValues = value || [];
                      if (e.target.checked) {
                        handleFieldChange(field.name, [...currentValues, option.value]);
                      } else {
                        handleFieldChange(field.name, currentValues.filter((v: string) => v !== option.value));
                      }
                    }}
                    disabled={field.disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className={`space-y-2 ${field.settings?.inline ? 'flex flex-wrap gap-4' : ''}`}>
              {field.options?.map(option => (
                <label key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={field.disabled}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                disabled={field.disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 ml-6">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600 ml-6">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={field.disabled}
              min={field.settings?.minDate}
              max={field.settings?.maxDate}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'datetime':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={field.disabled}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'time':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="time"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={field.disabled}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'file':
      case 'image':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                {field.settings?.allowedTypes?.join(', ') || 'All files'}
              </p>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFieldChange(field.name, file);
                  }
                }}
                disabled={field.disabled}
                multiple={field.settings?.multiple}
                accept={field.settings?.allowedTypes?.join(',')}
                className="hidden"
                id={`file-${field.id}`}
              />
              <label
                htmlFor={`file-${field.id}`}
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Choose File
              </label>
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'rating':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex items-center space-x-2">
              {[...Array(field.settings?.maxRating || 5)].map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleFieldChange(field.name, index + 1)}
                  disabled={field.disabled}
                  className="text-2xl hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      index < value ? 'text-yellow-400 fill-current' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {field.settings?.showValues && (
                <span className="text-sm text-gray-600 ml-2">({value || 0})</span>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'range':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              <input
                type="range"
                value={value}
                onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
                disabled={field.disabled}
                min={field.settings?.min || 0}
                max={field.settings?.max || 100}
                step={field.settings?.step || 1}
                className="w-full"
              />
              {field.settings?.showValue && (
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">{value}</span>
                </div>
              )}
              {field.settings?.showLabels && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{field.settings?.min || 0}</span>
                  <span>{field.settings?.max || 100}</span>
                </div>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'signature':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-center h-32">
                <div className="text-center text-gray-500">
                  <PenTool className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Signature field</p>
                  <p className="text-xs">Click to sign</p>
                </div>
              </div>
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={field.disabled}
              className={fieldClasses}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && showValidation && (
              <div className="text-xs text-red-600">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      {/* Preview Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">Form Preview</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Eye className="w-4 h-4" />
              <span>Live Preview</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Device Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-2 rounded transition-colors ${
                  previewDevice === 'mobile' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Mobile"
              >
                <Smartphone className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('tablet')}
                className={`p-2 rounded transition-colors ${
                  previewDevice === 'tablet' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Tablet"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-2 rounded transition-colors ${
                  previewDevice === 'desktop' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Desktop"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Toggle */}
            <button
              onClick={() => setShowValidation(!showValidation)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                showValidation
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {showValidation ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span>Validation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <div className={getDeviceStyles()}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Form Header */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {template.settings.title}
              </h1>
              {template.settings.description && (
                <p className="text-gray-600">{template.settings.description}</p>
              )}
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
              {template.fields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-gray-400 mb-4">
                    <Eye className="w-12 h-12 mx-auto" />
                  </div>
                  <p className="text-lg font-medium mb-2">No fields to preview</p>
                  <p className="text-sm">Add fields to the form to see them in action</p>
                </div>
              ) : (
                <>
                  {template.fields.map(field => renderField(field))}
                  
                  {/* Form Actions */}
                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    {template.settings.resetButtonText && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({});
                          setFormErrors({});
                          setSubmitted(false);
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {template.settings.resetButtonText}
                      </button>
                    )}
                    
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {template.settings.submitButtonText}
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Form Footer */}
            {template.settings.confirmationMessage && submitted && Object.keys(formErrors).length === 0 && (
              <div className="px-6 py-4 bg-green-50 border-t border-green-200">
                <div className="flex items-center space-x-2 text-green-800">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Success!</span>
                </div>
                <p className="text-green-700 mt-1">{template.settings.confirmationMessage}</p>
              </div>
            )}
          </div>

          {/* Form Info */}
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Form Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total Fields:</span>
                <span className="ml-2 font-medium">{template.fields.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Required Fields:</span>
                <span className="ml-2 font-medium">
                  {template.fields.filter(f => f.required).length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Device:</span>
                <span className="ml-2 font-medium capitalize">{previewDevice}</span>
              </div>
              <div>
                <span className="text-gray-500">Validation:</span>
                <span className="ml-2 font-medium">{showValidation ? 'On' : 'Off'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPreview;
