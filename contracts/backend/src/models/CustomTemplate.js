const mongoose = require('mongoose');

const fieldDefinitionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'boolean', 'email', 'url', 'phone', 'file', 'select', 'multiselect', 'json']
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  required: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  placeholder: {
    type: String,
    trim: true
  },
  options: {
    type: [String],
    default: []
  },
  minLength: {
    type: Number,
    min: 0
  },
  maxLength: {
    type: Number,
    min: 0
  },
  minValue: {
    type: Number
  },
  maxValue: {
    type: Number
  },
  pattern: {
    type: String,
    trim: true
  },
  customValidation: {
    type: String,
    trim: true
  },
  helpText: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  visible: {
    type: Boolean,
    default: true
  },
  editable: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const validationRuleSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fieldId: {
    type: String,
    required: true
  },
  ruleType: {
    type: String,
    required: true,
    enum: ['required', 'minLength', 'maxLength', 'minValue', 'maxValue', 'pattern', 'custom', 'conditional']
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed
  },
  errorMessage: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['error', 'warning', 'info'],
    default: 'error'
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const templateLayoutSchema = new mongoose.Schema({
  sections: [{
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    fields: [{
      fieldId: {
        type: String,
        required: true
      },
      width: {
        type: String,
        enum: ['full', 'half', 'third', 'quarter'],
        default: 'full'
      }
    }],
    order: {
      type: Number,
      default: 0
    }
  }],
  theme: {
    primaryColor: {
      type: String,
      default: '#3b82f6'
    },
    secondaryColor: {
      type: String,
      default: '#6b7280'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#1f2937'
    }
  }
}, { _id: false });

const customTemplateSchema = new mongoose.Schema({
  // Basic template information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  category: {
    type: String,
    required: true,
    enum: ['identity', 'credential', 'document', 'transaction', 'employment', 'education', 'healthcare', 'finance', 'custom'],
    default: 'custom'
  },
  
  // Template structure
  fields: {
    type: [fieldDefinitionSchema],
    default: []
  },
  validationRules: {
    type: [validationRuleSchema],
    default: []
  },
  layout: {
    type: templateLayoutSchema
  },
  
  // Template content and configuration
  templateSchema: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  sampleData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Metadata and sharing
  createdBy: {
    type: String,
    required: true
  },
  organizationId: {
    type: String
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: {
    type: [String],
    default: []
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // Status and moderation
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'archived'],
    default: 'draft'
  },
  moderatedBy: {
    type: String
  },
  moderatedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  
  // Template dependencies and relationships
  dependencies: {
    type: [String],
    default: []
  },
  parentTemplateId: {
    type: String
  },
  forkedFrom: {
    type: String
  },
  
  // Security and privacy
  requiresEncryption: {
    type: Boolean,
    default: false
  },
  privacyLevel: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'restricted'],
    default: 'public'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
customTemplateSchema.index({ createdBy: 1, createdAt: -1 });
customTemplateSchema.index({ category: 1, status: 1 });
customTemplateSchema.index({ isPublic: 1, status: 1 });
customTemplateSchema.index({ tags: 1 });
customTemplateSchema.index({ name: 'text', description: 'text' });

// Virtual for field count
customTemplateSchema.virtual('fieldCount').get(function() {
  return this.fields.length;
});

// Virtual for validation rule count
customTemplateSchema.virtual('validationRuleCount').get(function() {
  return this.validationRules.length;
});

// Instance method to validate template structure
customTemplateSchema.methods.validateTemplate = function() {
  const errors = [];
  
  // Check required fields
  if (!this.name || this.name.trim().length === 0) {
    errors.push('Template name is required');
  }
  
  if (!this.description || this.description.trim().length === 0) {
    errors.push('Template description is required');
  }
  
  if (!this.templateSchema) {
    errors.push('Template schema is required');
  }
  
  // Validate field definitions
  const fieldIds = this.fields.map(f => f.id);
  const duplicateFieldIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
  if (duplicateFieldIds.length > 0) {
    errors.push(`Duplicate field IDs found: ${duplicateFieldIds.join(', ')}`);
  }
  
  // Validate validation rules reference existing fields
  const invalidRuleFields = this.validationRules.filter(rule => !fieldIds.includes(rule.fieldId));
  if (invalidRuleFields.length > 0) {
    errors.push(`Validation rules reference non-existent fields: ${invalidRuleFields.map(r => r.fieldId).join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Instance method to get template statistics
customTemplateSchema.methods.getStatistics = function() {
  return {
    fieldCount: this.fields.length,
    validationRuleCount: this.validationRules.length,
    requiredFieldCount: this.fields.filter(f => f.required).length,
    sectionCount: this.layout?.sections?.length || 0,
    usageCount: this.usageCount,
    averageRating: this.rating.average,
    ratingCount: this.rating.count
  };
};

module.exports = mongoose.model('CustomTemplate', customTemplateSchema);
