export type FieldType = 
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'date'
  | 'datetime'
  | 'time'
  | 'file'
  | 'image'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'url'
  | 'phone'
  | 'signature'
  | 'rating'
  | 'range';

export type ValidationRule = 
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'url'
  | 'custom';

export type ConditionalOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_checked'
  | 'is_not_checked';

export interface ValidationRuleConfig {
  type: ValidationRule;
  value?: string | number;
  message: string;
  customFunction?: string;
}

export interface ConditionalLogic {
  id: string;
  fieldId: string;
  operator: ConditionalOperator;
  value: string | number | boolean;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  required: boolean;
  disabled: boolean;
  validationRules: ValidationRuleConfig[];
  conditionalLogic?: ConditionalLogic[];
  options?: Array<{
    label: string;
    value: string;
  }>;
  settings: Record<string, any>;
  order: number;
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  settings: {
    title: string;
    description?: string;
    submitButtonText: string;
    resetButtonText?: string;
    showProgressBar: boolean;
    allowSave: boolean;
    multipleSubmissions: boolean;
    confirmationMessage?: string;
    redirectUrl?: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    version: number;
    tags: string[];
    category: string;
    isPublic: boolean;
    usageCount: number;
  };
}

export interface FormSubmission {
  id: string;
  templateId: string;
  data: Record<string, any>;
  metadata: {
    submittedAt: string;
    submittedBy: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
}

export interface FormBuilderState {
  template: FormTemplate | null;
  selectedField: FormField | null;
  draggedField: FormField | null;
  previewMode: boolean;
  validationErrors: Record<string, string[]>;
  isDirty: boolean;
  isLoading: boolean;
}

export interface DragItem {
  type: 'NEW_FIELD' | 'EXISTING_FIELD';
  fieldType?: FieldType;
  field?: FormField;
  index?: number;
}

export interface FieldLibraryItem {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  category: 'basic' | 'advanced' | 'special';
  defaultSettings: Record<string, any>;
}

export interface FormAnalytics {
  templateId: string;
  totalViews: number;
  totalSubmissions: number;
  completionRate: number;
  averageTimeToComplete: number;
  fieldAnalytics: Record<string, {
    views: number;
    interactions: number;
    errors: number;
    skipRate: number;
  }>;
  deviceBreakdown: Record<string, number>;
  timeSeriesData: Array<{
    date: string;
    views: number;
    submissions: number;
  }>;
}

export interface FormBuilderConfig {
  maxFields: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  enableAnalytics: boolean;
  enableConditionalLogic: boolean;
  enableCustomValidation: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
