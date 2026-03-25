import React, { useState, useEffect } from 'react';

const SearchHistory = ({ 
  onSearchSelect,
  onClearHistory,
  limit = 10,
  className = ""
}) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Fetch search history
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      // Mock API call - replace with actual endpoint
      const response = await fetch(`/api/search/history?limit=${limit * 2}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch search history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSelect = (searchItem) => {
    if (onSearchSelect) {
      onSearchSelect(searchItem.query, searchItem.filters);
    }
  };

  const handleDeleteHistoryItem = async (id) => {
    try {
      const response = await fetch(`/api/search/history/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  };

  const handleClearAll = async () => {
    if (onClearHistory) {
      onClearHistory();
    }
    
    try {
      const response = await fetch('/api/search/history', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const displayHistory = showAll ? history : history.slice(0, limit);
  const hasMore = history.length > limit;

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Search History</h3>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-red-600 hover:text-red-800 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No search history yet</p>
            <p className="text-sm text-gray-400 mt-1">Your recent searches will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleSearchSelect(item)}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {item.query}
                      </span>
                      {item.resultsCount > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {item.resultsCount} results
                        </span>
                      )}
                    </div>
                    
                    {Object.keys(item.filters).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(item.filters).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center text-xs text-gray-400">
                      <span>{formatDate(item.timestamp)}</span>
                      {item.searchDuration > 0 && (
                        <span className="ml-2">
                          • {item.searchDuration}ms
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteHistoryItem(item.id)}
                    className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete from history"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Show More/Less Button */}
      {hasMore && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showAll ? 'Show Less' : `Show All (${history.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchHistory;