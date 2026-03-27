import React, { useState, useEffect, useRef } from 'react';

const SearchBar = ({ 
  onSearch, 
  onFilterChange,
  placeholder = "Search proofs, templates, or users...",
  initialValue = "",
  showFilters = true,
  className = ""
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch auto-complete suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Mock API call - replace with actual endpoint
        const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=8`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data || []);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Auto-complete error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce 300ms

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSearch = (searchQuery = query) => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleFilterToggle = () => {
    // This would open the advanced filters panel
    if (showFilters && onFilterChange) {
      onFilterChange({ showAdvanced: true });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="flex items-center">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                // Delay hiding suggestions to allow click events
                setTimeout(() => {
                  setIsFocused(false);
                  setShowSuggestions(false);
                }, 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-4 py-3 pl-12 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Search Icon */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {showFilters && (
            <button
              onClick={handleFilterToggle}
              className="ml-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label="Open advanced search filters"
              title="Advanced Filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          )}
          
          <button
            onClick={() => handleSearch()}
            className="ml-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Search
          </button>
        </div>
      </div>

      {/* Auto-complete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg"
          aria-label="Search suggestions"
        >
          <div className="py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                aria-label={`Use suggestion ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
            Press Enter to search • Esc to close
          </div>
        </div>
      )}

      {/* Search Tips */}
      {isFocused && query.length === 0 && (
        <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="text-sm text-gray-600 mb-2">Search tips:</div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Search by title, description, or tags</li>
            <li>• Use quotes for exact phrases: "university degree"</li>
            <li>• Filter by category using the filter button</li>
            <li>• Try common terms like "identity", "credential", "document"</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchBar;