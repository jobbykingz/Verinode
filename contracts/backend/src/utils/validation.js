// Simple validation utilities for template marketplace

const validateTemplateInput = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (data.title.length > 100) {
    errors.push('Title must be less than 100 characters');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Description is required');
  } else if (data.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  if (data.content === undefined || data.content === null) {
    errors.push('Content is required');
  }

  if (data.price === undefined || data.price < 0) {
    errors.push('Price must be a non-negative number');
  }

  if (!data.category) {
    errors.push('Category is required');
  } else if (!['identity', 'credential', 'document', 'transaction', 'custom'].includes(data.category)) {
    errors.push('Invalid category');
  }

  if (data.tags && !Array.isArray(data.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    error: errors.length > 0 ? { message: errors.join(', ') } : null
  };
};

const validateRatingInput = (data) => {
  const errors = [];

  if (data.rating === undefined || data.rating < 1 || data.rating > 5) {
    errors.push('Rating must be between 1 and 5');
  }

  if (data.review && data.review.length > 500) {
    errors.push('Review must be less than 500 characters');
  }

  return {
    error: errors.length > 0 ? { message: errors.join(', ') } : null
  };
};

module.exports = {
  validateTemplateInput,
  validateRatingInput
};