import React, { useState } from 'react';

const TemplateCreator = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    price: 0,
    category: 'custom',
    tags: [],
    isPublic: true
  });

  const [tagInput, setTagInput] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState({});

  const categories = [
    { id: 'identity', name: 'Identity Verification', description: 'Identity and KYC verification templates' },
    { id: 'credential', name: 'Credentials', description: 'Academic and professional credentials' },
    { id: 'document', name: 'Document Verification', description: 'Document authenticity verification' },
    { id: 'transaction', name: 'Transaction Proofs', description: 'Financial transaction verification' },
    { id: 'custom', name: 'Custom Templates', description: 'Specialized verification templates' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Template content is required';
    }

    if (formData.price < 0) {
      newErrors.price = 'Price must be a non-negative number';
    }

    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
      if (errors.tags) {
        const newErrors = { ...errors };
        delete newErrors.tags;
        setErrors(newErrors);
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Create New Template</h2>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {previewMode ? 'Edit' : 'Preview'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-gray-600">
            Create a new proof template to share with the community
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {previewMode ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{formData.title || 'Template Title'}</h3>
                <div className="flex items-center space-x-4 mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {categories.find(c => c.id === formData.category)?.name || 'Custom'}
                  </span>
                  <span className="flex items-center text-lg font-bold text-green-600">
                    {formData.price.toFixed(2)} XLM
                  </span>
                </div>
                <p className="text-gray-700 mb-4">{formData.description || 'Template description will appear here...'}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {formData.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Template Content Preview</h4>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                    {formData.content || 'Your template content will appear here...'}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Template Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter a descriptive title for your template"
                  maxLength={100}
                />
                {errors.title && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    {errors.title}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Describe what this template does and how it can be used"
                  maxLength={1000}
                />
                {errors.description && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    {errors.description}
                  </div>
                )}
              </div>

              {/* Category and Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    Price (XLM) *
                  </label>
                  <input
                    type="number"
                    id="price"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.price && (
                    <div className="flex items-center mt-2 text-red-600 text-sm">
                      {errors.price}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags *
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className={`flex-1 px-4 py-3 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.tags ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Add tags (press Enter)"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {errors.tags && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    {errors.tags}
                  </div>
                )}
              </div>

              {/* Template Content */}
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  Template Content *
                </label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  rows={12}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm transition-colors ${
                    errors.content ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your proof template content here..."
                />
                {errors.content && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    {errors.content}
                  </div>
                )}
              </div>

              {/* Visibility */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                  Make this template public (visible in marketplace)
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <div className="flex items-center space-x-3">
              {Object.keys(errors).length > 0 && (
                <div className="flex items-center text-red-600 text-sm">
                  Please fix the errors above
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || Object.keys(errors).length > 0}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateCreator;