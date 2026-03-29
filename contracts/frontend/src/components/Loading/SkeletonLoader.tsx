import React from 'react';

interface SkeletonLoaderProps {
  type?: 'text' | 'avatar' | 'card' | 'list' | 'table';
  lines?: number;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  type = 'text', 
  lines = 3, 
  className = '' 
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          </div>
        );

      case 'avatar':
        return (
          <div className="animate-pulse">
            <div className="h-16 w-16 bg-gray-200 rounded-full mb-4"></div>
          </div>
        );

      case 'card':
        return (
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          </div>
        );

      case 'list':
        return (
          <div className="space-y-3">
            {Array.from({ length: lines }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        );

      case 'table':
        return (
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-2"></div>
            <div className="h-10 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-10 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-10 bg-gray-200 rounded w-1/3 mb-2"></div>
          </div>
        );

      default:
        return (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          </div>
        );
    }
  };

  return (
    <div className={`skeleton-loader ${className}`}>
      {renderSkeleton()}
    </div>
  );
};
