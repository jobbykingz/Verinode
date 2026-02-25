import React, { useState } from 'react';

const TemplatePreview = ({ 
  template, 
  onClose, 
  onPurchase,
  onRate,
  showPurchaseButton = true,
  showRatingButton = true
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  const {
    title,
    description,
    content,
    price,
    category,
    tags,
    averageRating,
    totalRatings,
    purchaseCount,
    creator,
    createdAt,
    version
  } = template;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryColor = (cat) => {
    const colors = {
      identity: 'bg-blue-100 text-blue-800',
      credential: 'bg-green-100 text-green-800',
      document: 'bg-purple-100 text-purple-800',
      transaction: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[cat] || colors.custom;
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400">★</span>
      );
    }
    
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">☆</span>
      );
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">☆</span>
      );
    }
    
    return stars;
  };

  const overviewPanelId = 'template-preview-overview-panel';
  const contentPanelId = 'template-preview-content-panel';
  const detailsPanelId = 'template-preview-details-panel';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2
                  id="template-preview-title"
                  className="text-2xl font-bold text-gray-900"
                >
                  {title}
                </h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category)}`}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </span>
                {version && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    v{version}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="font-medium text-green-600 text-lg">
                    {price.toFixed(2)} XLM
                  </span>
                </div>
                
                <div className="flex items-center">
                  <div className="flex items-center mr-2">
                    {renderStars(averageRating)}
                  </div>
                  <span>
                    {averageRating.toFixed(1)} ({totalRatings} reviews)
                  </span>
                </div>
                
                <div>
                  Purchased {purchaseCount} times
                </div>
                
                <div>
                  Created {formatDate(createdAt)}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close template preview"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" role="tablist" aria-label="Template preview sections">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'content', label: 'Template Content' },
              { id: 'details', label: 'Details' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={
                  tab.id === 'overview'
                    ? overviewPanelId
                    : tab.id === 'content'
                    ? contentPanelId
                    : detailsPanelId
                }
                id={`template-preview-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'overview' && (
            <div
              className="space-y-6"
              role="tabpanel"
              id={overviewPanelId}
              aria-labelledby="template-preview-tab-overview"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700 leading-relaxed">{description}</p>
              </div>

              {tags && tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && (
            <div
              role="tabpanel"
              id={contentPanelId}
              aria-labelledby="template-preview-tab-content"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Content</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {content || 'No content available'}
                </pre>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                This is a preview of the template structure. Purchase to get the full template.
              </p>
            </div>
          )}

          {activeTab === 'details' && (
            <div
              className="space-y-4"
              role="tabpanel"
              id={detailsPanelId}
              aria-labelledby="template-preview-tab-details"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Template Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Version:</span>
                      <span className="font-medium">{version || '1.0.0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-medium text-green-600">{price.toFixed(2)} XLM</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Rating:</span>
                      <span className="font-medium">{averageRating.toFixed(1)}/5.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Reviews:</span>
                      <span className="font-medium">{totalRatings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Purchase Count:</span>
                      <span className="font-medium">{purchaseCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Creator Information</h4>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {creator ? creator.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {creator || 'Unknown Creator'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Created on {formatDate(createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(showPurchaseButton || showRatingButton) && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-end space-x-3">
              {showRatingButton && onRate && (
                <button
                  onClick={onRate}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                >
                  Rate Template
                </button>
              )}
              {showPurchaseButton && onPurchase && (
                <button
                  onClick={onPurchase}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Purchase for {price.toFixed(2)} XLM
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreview;