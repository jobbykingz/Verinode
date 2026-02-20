import React, { useState, useEffect, useRef } from 'react';

const AutoComplete = ({ 
  query,
  onSuggestionSelect,
  maxSuggestions = 8,
  className = "",
  debounceMs = 300
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API calls
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=${maxSuggestions}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Auto-complete error:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, maxSuggestions, debounceMs]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      
      default:
        setSelectedIndex(-1);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleMouseEnter = (index) => {
    setSelectedIndex(index);
  };

  if (!showSuggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="px-4 py-3 text-center text-gray-500">
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span>Searching...</span>
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {!isLoading && suggestions.length > 0 && (
        <div className="py-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion}-${index}`}
              onClick={() => handleSuggestionSelect(suggestion)}
              onMouseEnter={() => handleMouseEnter(index)}
              className={`w-full px-4 py-2.5 text-left transition-colors text-sm ${
                selectedIndex === index
                  ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500'
                  : 'text-gray-700 hover:bg-gray-50'
              } first:rounded-t-lg last:rounded-b-lg`}
            >
              <div className="flex items-center">
                <svg 
                  className={`w-4 h-4 mr-2 flex-shrink-0 ${
                    selectedIndex === index ? 'text-blue-500' : 'text-gray-400'
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer with keyboard shortcuts */}
      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <div className="flex justify-between items-center">
          <span>↑↓ Navigate • Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};

// Enhanced version with search history integration
export const EnhancedAutoComplete = ({ 
  query,
  onSuggestionSelect,
  recentSearches = [],
  popularSearches = [],
  maxSuggestions = 8,
  className = ""
}) => {
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Combine all suggestion sources
  useEffect(() => {
    if (!query || query.length < 2) {
      // Show recent and popular searches when no query
      const combined = [
        ...recentSearches.slice(0, 3).map(search => ({ 
          type: 'recent', 
          text: search.query,
          data: search 
        })),
        ...popularSearches.slice(0, 5).map(search => ({ 
          type: 'popular', 
          text: search.query || search,
          count: search.count
        }))
      ];
      
      setAllSuggestions(combined);
      setShowSuggestions(combined.length > 0);
      setSelectedIndex(-1);
      return;
    }

    // Fetch auto-complete suggestions
    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=${maxSuggestions}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const autoCompleteSuggestions = (data.data || []).map(text => ({
            type: 'autocomplete',
            text
          }));
          
          setAllSuggestions(autoCompleteSuggestions);
          setShowSuggestions(autoCompleteSuggestions.length > 0);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Auto-complete error:', error);
        setAllSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [query, recentSearches, popularSearches, maxSuggestions]);

  const handleSuggestionSelect = (suggestion) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion.text, suggestion);
    }
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'recent':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'popular':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
    }
  };

  const getSuggestionClass = (type, isSelected) => {
    const baseClasses = "w-full px-4 py-2.5 text-left transition-colors text-sm flex items-center";
    
    if (isSelected) {
      return `${baseClasses} bg-blue-50 text-blue-700 border-l-2 border-blue-500`;
    }
    
    switch (type) {
      case 'recent':
        return `${baseClasses} text-gray-700 hover:bg-gray-50`;
      case 'popular':
        return `${baseClasses} text-yellow-700 hover:bg-yellow-50`;
      default:
        return `${baseClasses} text-gray-700 hover:bg-gray-50`;
    }
  };

  if (!showSuggestions || allSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="px-4 py-3 text-center text-gray-500">
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span>Searching...</span>
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {!isLoading && allSuggestions.length > 0 && (
        <div className="py-1">
          {allSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.text}-${index}`}
              onClick={() => handleSuggestionSelect(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={getSuggestionClass(suggestion.type, selectedIndex === index)}
            >
              <div className="flex items-center w-full">
                <div className={`mr-3 flex-shrink-0 ${
                  selectedIndex === index ? 'text-blue-500' : 
                  suggestion.type === 'popular' ? 'text-yellow-500' : 'text-gray-400'
                }`}>
                  {getSuggestionIcon(suggestion.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{suggestion.text}</div>
                  {suggestion.type === 'popular' && suggestion.count && (
                    <div className="text-xs text-gray-500">{suggestion.count} searches</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <div className="flex justify-between items-center">
          <span>Recent searches • Popular queries</span>
          <span>↑↓ to navigate</span>
        </div>
      </div>
    </div>
  );
};

export default AutoComplete;