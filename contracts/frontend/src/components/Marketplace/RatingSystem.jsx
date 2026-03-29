import React, { useState } from 'react';

const RatingSystem = ({ 
  initialRating = 0, 
  initialReview = '', 
  onSubmit, 
  onCancel, 
  isLoading = false,
  isEditing = false
}) => {
  const [rating, setRating] = useState(initialRating);
  const [review, setReview] = useState(initialReview);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (rating < 1) {
      alert('Please select a rating');
      return;
    }
    
    onSubmit({ rating, review });
  };

  const renderStars = () => {
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= (hoverRating || rating);
      const isHovered = i <= hoverRating;
      
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => setRating(i)}
          onMouseEnter={() => setHoverRating(i)}
          onMouseLeave={() => setHoverRating(0)}
          className={`text-3xl focus:outline-none transition-colors ${
            isFilled 
              ? isHovered 
                ? 'text-yellow-500' 
                : 'text-yellow-400'
              : 'text-gray-300'
          }`}
        >
          ★
        </button>
      );
    }
    
    return stars;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {isEditing ? 'Update Your Rating' : 'Rate This Template'}
        </h3>
        <p className="text-gray-600">
          Share your experience with this template to help others
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Rating Stars */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Your Rating *
          </label>
          <div className="flex items-center space-x-1">
            {renderStars()}
            <span className="ml-3 text-sm text-gray-600">
              {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Select rating'}
            </span>
          </div>
        </div>

        {/* Review Text */}
        <div className="mb-6">
          <label htmlFor="review" className="block text-sm font-medium text-gray-700 mb-2">
            Your Review
          </label>
          <textarea
            id="review"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Share your detailed experience with this template..."
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-500">
              {review.length}/500 characters
            </p>
            {review.length > 450 && (
              <p className={`text-sm ${review.length > 500 ? 'text-red-600' : 'text-yellow-600'}`}>
                {500 - review.length} characters remaining
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || rating < 1}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Submitting...
              </>
            ) : (
              isEditing ? 'Update Rating' : 'Submit Rating'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// Display component for showing existing ratings
export const RatingDisplay = ({ 
  rating, 
  review, 
  user, 
  createdAt,
  onEdit,
  showEdit = false
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderStars = (ratingValue) => {
    const stars = [];
    const fullStars = Math.floor(ratingValue);
    const hasHalfStar = ratingValue % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400 text-lg">★</span>
      );
    }
    
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400 text-lg">☆</span>
      );
    }
    
    const emptyStars = 5 - Math.ceil(ratingValue);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300 text-lg">☆</span>
      );
    }
    
    return stars;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            {renderStars(rating)}
          </div>
          <span className="text-sm font-medium text-gray-900">
            {rating.toFixed(1)} stars
          </span>
        </div>
        {showEdit && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
        )}
      </div>
      
      {review && (
        <p className="text-gray-700 mb-3">{review}</p>
      )}
      
      <div className="flex items-center text-xs text-gray-500">
        <span>{user || 'Anonymous'}</span>
        <span className="mx-2">•</span>
        <span>{formatDate(createdAt)}</span>
      </div>
    </div>
  );
};

export default RatingSystem;