class TemplateValidationService {
  /**
   * Validate template data against template schema
   */
  static validateTemplateData(templateSchema, data) {
    const errors = [];
    const warnings = [];
    
    // Validate required fields
    if (templateSchema.fields) {
      for (const field of templateSchema.fields) {
        const value = data[field.id];
        
        // Check required fields
        if (field.required && (value === undefined || value === null || value === '')) {
          errors.push({
            field: field.id,
            message: `${field.label || field.name} is required`
          });
          continue;
        }
        
        // Skip validation for empty optional fields
        if (value === undefined || value === null || value === '') {
          continue;
        }
        
        // Validate field type
        const typeValidation = this.validateFieldType(field, value);
        if (!typeValidation.valid) {
          errors.push({
            field: field.id,
            message: `${field.label || field.name}: ${typeValidation.error}`
          });
          continue;
        }
        
        // Validate field constraints
        const constraintValidation = this.validateFieldConstraints(field, value);
        if (!constraintValidation.valid) {
          constraintValidation.errors.forEach(error => {
            errors.push({
              field: field.id,
              message: `${field.label || field.name}: ${error}`
            });
          });
        }
        
        if (constraintValidation.warnings) {
          constraintValidation.warnings.forEach(warning => {
            warnings.push({
              field: field.id,
              message: `${field.label || field.name}: ${warning}`
            });
          });
        }
      }
    }
    
    // Validate custom validation rules
    if (templateSchema.validationRules) {
      for (const rule of templateSchema.validationRules) {
        const ruleValidation = this.validateRule(rule, data);
        if (!ruleValidation.valid) {
          errors.push({
            field: rule.fieldId,
            message: ruleValidation.error
          });
        }
      }
    }
    
    // Validate cross-field dependencies
    if (templateSchema.dependencies) {
      const dependencyValidation = this.validateDependencies(templateSchema.dependencies, data);
      if (!dependencyValidation.valid) {
        dependencyValidation.errors.forEach(error => {
          errors.push({
            field: error.field,
            message: error.message
          });
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate field type
   */
  static validateFieldType(field, value) {
    const type = field.type;
    
    switch (type) {
      case 'text':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Must be a text value' };
        }
        break;
        
      case 'number':
        if (typeof value !== 'number') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            return { valid: false, error: 'Must be a number' };
          }
        }
        break;
        
      case 'date':
        if (!(value instanceof Date) && typeof value !== 'string') {
          return { valid: false, error: 'Must be a date' };
        }
        if (typeof value === 'string' && isNaN(Date.parse(value))) {
          return { valid: false, error: 'Must be a valid date' };
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          if (value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
            return { valid: false, error: 'Must be a boolean value' };
          }
        }
        break;
        
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return { valid: false, error: 'Must be a valid email address' };
        }
        break;
        
      case 'url':
        if (typeof value !== 'string' || !this.isValidURL(value)) {
          return { valid: false, error: 'Must be a valid URL' };
        }
        break;
        
      case 'phone':
        if (typeof value !== 'string' || !this.isValidPhone(value)) {
          return { valid: false, error: 'Must be a valid phone number' };
        }
        break;
        
      case 'select':
        if (!field.options || !field.options.includes(value)) {
          return { valid: false, error: 'Must be one of the allowed options' };
        }
        break;
        
      case 'multiselect':
        if (!Array.isArray(value)) {
          return { valid: false, error: 'Must be an array of values' };
        }
        if (field.options) {
          const invalidOptions = value.filter(option => !field.options.includes(option));
          if (invalidOptions.length > 0) {
            return { valid: false, error: `Invalid options: ${invalidOptions.join(', ')}` };
          }
        }
        break;
        
      default:
        // For custom types, we assume valid
        break;
    }
    
    return { valid: true };
  }

  /**
   * Validate field constraints
   */
  static validateFieldConstraints(field, value) {
    const errors = [];
    const warnings = [];
    
    // Length constraints
    if (field.minLength !== undefined && typeof value === 'string') {
      if (value.length < field.minLength) {
        errors.push(`Must be at least ${field.minLength} characters long`);
      }
    }
    
    if (field.maxLength !== undefined && typeof value === 'string') {
      if (value.length > field.maxLength) {
        errors.push(`Must be no more than ${field.maxLength} characters long`);
      }
    }
    
    // Value constraints
    if (field.minValue !== undefined && typeof value === 'number') {
      if (value < field.minValue) {
        errors.push(`Must be at least ${field.minValue}`);
      }
    }
    
    if (field.maxValue !== undefined && typeof value === 'number') {
      if (value > field.maxValue) {
        errors.push(`Must be no more than ${field.maxValue}`);
      }
    }
    
    // Pattern validation
    if (field.pattern && typeof value === 'string') {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        errors.push(`Must match the required pattern`);
      }
    }
    
    // Custom validation
    if (field.customValidation) {
      try {
        const customValidation = this.evaluateCustomValidation(field.customValidation, value);
        if (!customValidation.valid) {
          errors.push(customValidation.error);
        }
      } catch (error) {
        errors.push(`Custom validation error: ${error.message}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate custom validation rule
   */
  static validateRule(rule, data) {
    const value = data[rule.fieldId];
    
    if (value === undefined || value === null) {
      return { valid: true }; // Skip validation for missing values
    }
    
    switch (rule.ruleType) {
      case 'required':
        if (value === '' || value === undefined || value === null) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.parameters.minLength) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.parameters.maxLength) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'minValue':
        const numValueMin = Number(value);
        if (!isNaN(numValueMin) && numValueMin < rule.parameters.minValue) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'maxValue':
        const numValueMax = Number(value);
        if (!isNaN(numValueMax) && numValueMax > rule.parameters.maxValue) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'pattern':
        const regex = new RegExp(rule.parameters.pattern);
        if (typeof value === 'string' && !regex.test(value)) {
          return { valid: false, error: rule.errorMessage };
        }
        break;
        
      case 'custom':
        try {
          const customValidation = this.evaluateCustomValidation(rule.parameters.expression, value, data);
          if (!customValidation.valid) {
            return { valid: false, error: rule.errorMessage };
          }
        } catch (error) {
          return { valid: false, error: `Validation error: ${error.message}` };
        }
        break;
        
      case 'conditional':
        try {
          const conditionResult = this.evaluateCondition(rule.parameters.condition, data);
          if (conditionResult && !this.validateRule(rule.parameters.thenRule, data).valid) {
            return { valid: false, error: rule.errorMessage };
          }
        } catch (error) {
          return { valid: false, error: `Conditional validation error: ${error.message}` };
        }
        break;
    }
    
    return { valid: true };
  }

  /**
   * Validate field dependencies
   */
  static validateDependencies(dependencies, data) {
    const errors = [];
    
    for (const dependency of dependencies) {
      const sourceValue = data[dependency.sourceField];
      const targetValue = data[dependency.targetField];
      
      switch (dependency.type) {
        case 'requiredIf':
          if (sourceValue && (targetValue === undefined || targetValue === null || targetValue === '')) {
            errors.push({
              field: dependency.targetField,
              message: `${dependency.targetLabel} is required when ${dependency.sourceLabel} is provided`
            });
          }
          break;
          
        case 'requiredUnless':
          if (!sourceValue && (targetValue === undefined || targetValue === null || targetValue === '')) {
            errors.push({
              field: dependency.targetField,
              message: `${dependency.targetLabel} is required when ${dependency.sourceLabel} is not provided`
            });
          }
          break;
          
        case 'matches':
          if (sourceValue !== targetValue) {
            errors.push({
              field: dependency.targetField,
              message: `${dependency.targetLabel} must match ${dependency.sourceLabel}`
            });
          }
          break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Evaluate custom validation expression
   */
  static evaluateCustomValidation(expression, value, data = {}) {
    try {
      // Create a safe evaluation context
      const context = {
        value,
        data,
        length: typeof value === 'string' ? value.length : undefined,
        number: typeof value === 'number' ? value : Number(value),
        string: typeof value === 'string' ? value : String(value),
        date: value instanceof Date ? value : new Date(value),
        // Add common validation helpers
        isEmail: this.isValidEmail,
        isURL: this.isValidURL,
        isPhone: this.isValidPhone,
        isEmpty: (val) => val === undefined || val === null || val === '',
        isNotEmpty: (val) => val !== undefined && val !== null && val !== ''
      };
      
      // Evaluate expression in context
      const result = new Function('context', `with(context) { return (${expression}); }`)(context);
      
      if (typeof result === 'boolean') {
        return { valid: result, error: result ? '' : 'Custom validation failed' };
      } else {
        return { valid: false, error: 'Custom validation must return a boolean' };
      }
    } catch (error) {
      return { valid: false, error: `Invalid custom validation expression: ${error.message}` };
    }
  }

  /**
   * Evaluate condition expression
   */
  static evaluateCondition(condition, data) {
    try {
      const context = { data };
      const result = new Function('context', `with(context) { return (${condition}); }`)(context);
      return Boolean(result);
    } catch (error) {
      throw new Error(`Invalid condition expression: ${error.message}`);
    }
  }

  /**
   * Validate template schema structure
   */
  static validateTemplateSchema(schema) {
    const errors = [];
    
    if (!schema) {
      errors.push('Template schema is required');
      return { valid: false, errors };
    }
    
    // Validate fields
    if (schema.fields) {
      if (!Array.isArray(schema.fields)) {
        errors.push('Fields must be an array');
      } else {
        const fieldIds = schema.fields.map(f => f.id);
        const duplicateIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          errors.push(`Duplicate field IDs: ${duplicateIds.join(', ')}`);
        }
        
        for (const field of schema.fields) {
          if (!field.id) errors.push('Field ID is required');
          if (!field.name) errors.push('Field name is required');
          if (!field.type) errors.push('Field type is required');
        }
      }
    }
    
    // Validate validation rules
    if (schema.validationRules) {
      if (!Array.isArray(schema.validationRules)) {
        errors.push('Validation rules must be an array');
      } else {
        const ruleIds = schema.validationRules.map(r => r.id);
        const duplicateIds = ruleIds.filter((id, index) => ruleIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          errors.push(`Duplicate validation rule IDs: ${duplicateIds.join(', ')}`);
        }
        
        for (const rule of schema.validationRules) {
          if (!rule.id) errors.push('Validation rule ID is required');
          if (!rule.fieldId) errors.push('Validation rule fieldId is required');
          if (!rule.ruleType) errors.push('Validation rule type is required');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper validation functions
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }
}

module.exports = TemplateValidationService;
