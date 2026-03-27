import React, { useState, useEffect } from 'react';

const SavedQueries = ({ 
  onSearchSelect,
  className = ""
}) => {
  const [savedQueries, setSavedQueries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newQuery, setNewQuery] = useState({ name: '', query: '', filters: {} });

  // Fetch saved queries
  useEffect(() => {
    fetchSavedQueries();
  }, []);

  const fetchSavedQueries = async () => {
    setIsLoading(true);
    try {
      // Mock API call - replace with actual endpoint
      const response = await fetch('/api/search/saved');
      if (response.ok) {
        const data = await response.json();
        setSavedQueries(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved queries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSelect = (savedQuery) => {
    if (onSearchSelect) {
      onSearchSelect(savedQuery.query, savedQuery.filters);
    }
  };

  const handleSaveQuery = async () => {
    if (!newQuery.name.trim() || !newQuery.query.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newQuery.name,
          query: newQuery.query,
          filters: newQuery.filters
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSavedQueries(prev => [...prev, data.data]);
        setNewQuery({ name: '', query: '', filters: {} });
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to save query:', error);
    }
  };

  const handleDeleteQuery = async (id) => {
    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setSavedQueries(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete saved query:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

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
          <h3 className="text-lg font-semibold text-gray-900">Saved Queries</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            {showForm ? 'Cancel' : 'Save Current Search'}
          </button>
        </div>
      </div>

      {/* Save Query Form */}
      {showForm && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Query Name *
              </label>
              <input
                type="text"
                value={newQuery.name}
                onChange={(e) => setNewQuery(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Identity Verification Templates"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Query *
              </label>
              <input
                type="text"
                value={newQuery.query}
                onChange={(e) => setNewQuery(prev => ({ ...prev, query: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search terms..."
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSaveQuery}
                disabled={!newQuery.name.trim() || !newQuery.query.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Save Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Queries List */}
      <div className="max-h-96 overflow-y-auto">
        {savedQueries.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="text-gray-500">No saved queries yet</p>
            <p className="text-sm text-gray-400 mt-1">Save your frequent searches for quick access</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {savedQueries.map((item) => (
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
                      <span className="font-medium text-gray-900">
                        {item.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.searchCount} uses
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      "{item.query}"
                    </p>
                    
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
                      <span>Last used: {formatDate(item.lastUsed)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteQuery(item.id)}
                    className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete saved query"
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
    </div>
  );
};

export default SavedQueries;