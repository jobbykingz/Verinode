import React from 'react';

const TemplateCard = ({ template, onPreview, onPurchase, onRate }) => {
  const {
    _id,
    title,
    description,
    price,
    category,
    tags,
    averageRating,
    totalRatings,
    purchaseCount,
    creator,
    createdAt
  } = template;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Card Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-3">
            {title}
          </h3>
          <div className="flex-shrink-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags && tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
            >
              {tag}
            </span>
          ))}
          {tags && tags.length > 3 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
              +{tags.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-green-600">
              {price.toFixed(2)} XLM
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <div className="flex items-center">
              {renderStars(averageRating)}
            </div>
            <span className="text-sm text-gray-600 ml-1">
              ({totalRatings})
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center">
            <span>Purchased {purchaseCount} times</span>
          </div>
          <div className="flex items-center">
            <span>Created {formatDate(createdAt)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => onPreview(template)}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Preview
          </button>
          <button
            onClick={() => onPurchase(template)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Purchase
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateCard;