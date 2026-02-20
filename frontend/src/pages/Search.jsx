import React, { useState, useEffect } from 'react';
import SearchBar from '../components/Search/SearchBar';
import AdvancedFilters from '../components/Search/AdvancedFilters';
import SearchHistory from '../components/Search/SearchHistory';
import SavedQueries from '../components/Search/SavedQueries';
import { EnhancedAutoComplete } from '../components/Search/AutoComplete';

const Search = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularSearches, setPopularSearches] = useState([]);
  const [searchStats, setSearchStats] = useState({
    totalCount: 0,
    searchDuration: 0
  });

  // Fetch recent and popular searches on mount
  useEffect(() => {
    fetchRecentSearches();
    fetchPopularSearches();
  }, []);

  const fetchRecentSearches = async () => {
    try {
      const response = await fetch('/api/search/recent?limit=5');
      if (response.ok) {
        const data = await response.json();
        setRecentSearches(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent searches:', error);
    }
  };

  const fetchPopularSearches = async () => {
    try {
      const response = await fetch('/api/search/popular');
      if (response.ok) {
        const data = await response.json();
        setPopularSearches(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch popular searches:', error);
    }
  };

  const performSearch = async (query, searchFilters = {}) => {
    setIsLoading(true);
    setSearchQuery(query);
    setFilters(searchFilters);

    try {
      const queryParams = new URLSearchParams({
        q: query,
        ...searchFilters
      });

      const response = await fetch(`/api/search?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
        setSearchStats({
          totalCount: data.pagination?.totalCount || 0,
          searchDuration: data.pagination?.searchDuration || 0
        });
      } else {
        setSearchResults([]);
        setSearchStats({ totalCount: 0, searchDuration: 0 });
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setSearchStats({ totalCount: 0, searchDuration: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query, searchFilters = {}) => {
    performSearch(query, searchFilters);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    if (searchQuery) {
      performSearch(searchQuery, newFilters);
    }
  };

  const handleSuggestionSelect = (suggestion, suggestionData) => {
    if (suggestionData?.type === 'recent') {
      // Re-run the recent search
      performSearch(suggestionData.data.query, suggestionData.data.filters);
    } else {
      // Regular search with suggestion
      performSearch(suggestion, filters);
    }
  };

  const handleSaveCurrentSearch = async () => {
    if (!searchQuery) return;

    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Search: ${searchQuery}`,
          query: searchQuery,
          filters: filters
        })
      });

      if (response.ok) {
        // Refresh saved queries
        // This would typically trigger a refresh in the SavedQueries component
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchStats({ totalCount: 0, searchDuration: 0 });
  };

  const getResultTypeIcon = (type) => {
    switch (type) {
      case 'proof':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'template':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'user':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Search</h1>
          <p className="text-gray-600">Find proofs, templates, and users with powerful search capabilities</p>
        </div>

        {/* Search Bar with AutoComplete */}
        <div className="mb-6 relative">
          <SearchBar
            onSearch={handleSearch}
            onFilterChange={(filterData) => {
              if (filterData?.showAdvanced) {
                setShowFilters(true);
              }
            }}
            initialValue={searchQuery}
            placeholder="Search proofs, templates, or users..."
            showFilters={true}
            className="mb-2"
          />
          <EnhancedAutoComplete
            query={searchQuery}
            onSuggestionSelect={handleSuggestionSelect}
            recentSearches={recentSearches}
            popularSearches={popularSearches}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6">
            <AdvancedFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onApply={handleFilterChange}
              onCancel={() => setShowFilters(false)}
              show={showFilters}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search Stats */}
            {searchQuery && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Search Results</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total found:</span>
                    <span className="font-medium">{searchStats.totalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Search time:</span>
                    <span className="font-medium">{searchStats.searchDuration}ms</span>
                  </div>
                </div>
                {searchQuery && (
                  <button
                    onClick={handleSaveCurrentSearch}
                    className="w-full mt-3 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Save This Search
                  </button>
                )}
              </div>
            )}

            {/* Search History */}
            <SearchHistory
              onSearchSelect={handleSearch}
              onClearHistory={clearSearch}
              limit={5}
            />

            {/* Saved Queries */}
            <SavedQueries
              onSearchSelect={handleSearch}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-600">Searching...</p>
              </div>
            )}

            {/* No Search Performed */}
            {!isLoading && !searchQuery && (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Searching</h3>
                <p className="text-gray-600">
                  Enter a search query above to find proofs, templates, and users
                </p>
              </div>
            )}

            {/* No Results */}
            {!isLoading && searchQuery && searchResults.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47.881-6.08 2.32M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* Search Results */}
            {!isLoading && searchResults.length > 0 && (
              <div className="space-y-4">
                {searchResults.map((result, index) => (
                  <div key={`${result.type}-${result.id}`} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-4">
                          {getResultTypeIcon(result.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {result.title || result.name || result.username}
                            </h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {result.type}
                            </span>
                          </div>
                          
                          {result.description && (
                            <p className="text-gray-600 mb-3 line-clamp-2">
                              {result.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            {result.tags && result.tags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center space-x-4">
                              {result.category && (
                                <span>Category: {result.category}</span>
                              )}
                              {result.rating && (
                                <span>Rating: {result.rating.toFixed(1)}/5</span>
                              )}
                              {result.price && (
                                <span>Price: {result.price} XLM</span>
                              )}
                            </div>
                            <span>Created: {formatDate(result.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;