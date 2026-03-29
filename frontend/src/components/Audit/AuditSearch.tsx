import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  X,
  Save,
} from 'lucide-react';
import { auditService, AuditLog, AuditQueryFilters, AuditQueryOptions, AuditEventType, AuditSeverity, AuditStatus } from '../../services/auditService';

/**
 * Search Props
 */
interface AuditSearchProps {
  className?: string;
  onResults?: (results: AuditLog[]) => void;
  initialFilters?: AuditQueryFilters;
}

/**
 * Saved Search
 */
interface SavedSearch {
  id: string;
  name: string;
  description: string;
  filters: AuditQueryFilters;
  createdAt: string;
}

/**
 * Advanced Search Component
 * 
 * Provides comprehensive search capabilities for audit logs:
 * - Full-text search
 * - Advanced filtering by multiple criteria
 * - Saved search configurations
 * - Real-time search suggestions
 * - Export functionality
 */
export const AuditSearch: React.FC<AuditSearchProps> = ({ 
  className, 
  onResults, 
  initialFilters 
}) => {
  const [filters, setFilters] = useState<AuditQueryFilters>(initialFilters || {});
  const [options, setOptions] = useState<AuditQueryOptions>({
    page: 1,
    limit: 50,
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });
  const [results, setResults] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load saved searches
  useEffect(() => {
    const saved = localStorage.getItem('audit-saved-searches');
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  }, []);

  // Perform search
  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      const searchFilters = {
        ...filters,
        ...(searchQuery && { searchText: searchQuery })
      };

      const response = await auditService.searchLogs(searchFilters, options);
      setResults(response.data);
      setTotal(response.total);
      onResults?.(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, options, searchQuery, onResults]);

  // Load suggestions
  const loadSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const suggestions = await auditService.getQuerySuggestions(query);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  }, []);

  // Save search
  const saveSearch = (name: string, description: string) => {
    const newSearch: SavedSearch = {
      id: `search_${Date.now()}`,
      name,
      description,
      filters: { ...filters, searchText: searchQuery },
      createdAt: new Date().toISOString()
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('audit-saved-searches', JSON.stringify(updated));
  };

  // Load saved search
  const loadSavedSearch = (saved: SavedSearch) => {
    setFilters(saved.filters);
    setSearchQuery(saved.filters.searchText || '');
  };

  // Delete saved search
  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(search => search.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('audit-saved-searches', JSON.stringify(updated));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setResults([]);
    setTotal(0);
  };

  // Export results
  const exportResults = async (format: 'json' | 'csv' | 'xml') => {
    try {
      const blob = await auditService.exportLogs(filters, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    loadSuggestions(value);
  };

  // Update filter
  const updateFilter = (key: keyof AuditQueryFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get severity color
  const getSeverityColor = (severity: AuditSeverity) => {
    return auditService.getSeverityColor(severity);
  };

  // Get status color
  const getStatusColor = (status: AuditStatus) => {
    return auditService.getStatusColor(status);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Audit Log Search
          </CardTitle>
          <CardDescription>
            Search and filter audit logs with advanced criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Main Search Bar */}
          <div className="flex space-x-2 mb-4">
            <div className="flex-1 relative">
              <Input
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                className="pr-10"
              />
              {searchQuery && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button onClick={performSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Filter className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>

          {/* Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="border rounded-md p-2 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-2">Suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant="outline"
                    onClick={() => setSearchQuery(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="time">Time</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* Basic Filters */}
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eventTypes">Event Types</Label>
                      <Select
                        value={filters.eventTypes?.[0] || ''}
                        onValueChange={(value) => 
                          updateFilter('eventTypes', value ? [value as AuditEventType] : [])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(AuditEventType).map((type) => (
                            <SelectItem key={type} value={type}>
                              {auditService.getEventTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="severity">Severity</Label>
                      <Select
                        value={filters.severity?.[0] || ''}
                        onValueChange={(value) => 
                          updateFilter('severity', value ? [value as AuditSeverity] : [])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(AuditSeverity).map((severity) => (
                            <SelectItem key={severity} value={severity}>
                              {auditService.getSeverityLabel(severity)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={filters.status?.[0] || ''}
                        onValueChange={(value) => 
                          updateFilter('status', value ? [value as AuditStatus] : [])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(AuditStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {auditService.getStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="userId">User ID</Label>
                      <Input
                        placeholder="Enter user ID"
                        value={filters.userIds?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('userIds', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Time Filters */}
                <TabsContent value="time" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fromDate">From Date</Label>
                      <Input
                        type="datetime-local"
                        value={filters.fromDate || ''}
                        onChange={(e) => updateFilter('fromDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="toDate">To Date</Label>
                      <Input
                        type="datetime-local"
                        value={filters.toDate || ''}
                        onChange={(e) => updateFilter('toDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
                        updateFilter('fromDate', hourAgo.toISOString());
                        updateFilter('toDate', now.toISOString());
                      }}
                    >
                      Last Hour
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        updateFilter('fromDate', dayAgo.toISOString());
                        updateFilter('toDate', now.toISOString());
                      }}
                    >
                      Last 24 Hours
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        updateFilter('fromDate', weekAgo.toISOString());
                        updateFilter('toDate', now.toISOString());
                      }}
                    >
                      Last Week
                    </Button>
                  </div>
                </TabsContent>

                {/* Security Filters */}
                <TabsContent value="security" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ipAddress">IP Address</Label>
                      <Input
                        placeholder="Enter IP address"
                        value={filters.ipAddresses?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('ipAddresses', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="resourceType">Resource Type</Label>
                      <Input
                        placeholder="Enter resource type"
                        value={filters.resourceTypes?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('resourceTypes', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Security Event Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        AuditEventType.SECURITY_BREACH,
                        AuditEventType.SUSPICIOUS_ACTIVITY,
                        AuditEventType.BLOCKED_REQUEST,
                        AuditEventType.RATE_LIMIT_EXCEEDED
                      ].map((eventType) => (
                        <div key={eventType} className="flex items-center space-x-2">
                          <Checkbox
                            id={eventType}
                            checked={filters.eventTypes?.includes(eventType) || false}
                            onCheckedChange={(checked) => {
                              const current = filters.eventTypes || [];
                              if (checked) {
                                updateFilter('eventTypes', [...current, eventType]);
                              } else {
                                updateFilter('eventTypes', current.filter(t => t !== eventType));
                              }
                            }}
                          />
                          <Label htmlFor={eventType} className="text-sm">
                            {auditService.getEventTypeLabel(eventType)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Advanced Filters */}
                <TabsContent value="advanced" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="requestId">Request ID</Label>
                      <Input
                        placeholder="Enter request ID"
                        value={filters.requestIds?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('requestIds', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="correlationId">Correlation ID</Label>
                      <Input
                        placeholder="Enter correlation ID"
                        value={filters.correlationIds?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('correlationIds', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="endpoint">Endpoint</Label>
                      <Input
                        placeholder="Enter endpoint"
                        value={filters.endpoints?.[0] || ''}
                        onChange={(e) => 
                          updateFilter('endpoints', e.target.value ? [e.target.value] : [])
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="method">HTTP Method</Label>
                      <Select
                        value={filters.methods?.[0] || ''}
                        onValueChange={(value) => 
                          updateFilter('methods', value ? [value] : [])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Processing Status</Label>
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="processed"
                          checked={filters.processed === true}
                          onCheckedChange={(checked) => updateFilter('processed', checked)}
                        />
                        <Label htmlFor="processed" className="text-sm">Processed</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="unprocessed"
                          checked={filters.processed === false}
                          onCheckedChange={(checked) => updateFilter('processed', checked ? false : undefined)}
                        />
                        <Label htmlFor="unprocessed" className="text-sm">Unprocessed</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Filter Actions */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                  <SaveSearchDialog
                    onSave={saveSearch}
                    filters={filters}
                    searchText={searchQuery}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => exportResults('csv')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => exportResults('json')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Searches</CardTitle>
            <CardDescription>Quick access to your saved search configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedSearches.map((saved) => (
                <div key={saved.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{saved.name}</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSavedSearch(saved.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{saved.description}</p>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadSavedSearch(saved)}
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        loadSavedSearch(saved);
                        performSearch();
                      }}
                    >
                      Search
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results ({total.toLocaleString()})</span>
              <div className="flex items-center space-x-2">
                <Select
                  value={options.sortBy}
                  onValueChange={(value) => setOptions(prev => ({ ...prev, sortBy: value }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">Timestamp</SelectItem>
                    <SelectItem value="severity">Severity</SelectItem>
                    <SelectItem value="eventType">Event Type</SelectItem>
                    <SelectItem value="userId">User ID</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={options.sortOrder}
                  onValueChange={(value) => setOptions(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' }))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Desc</SelectItem>
                    <SelectItem value="asc">Asc</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={performSearch}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((event) => (
                <div key={event.auditId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge 
                          style={{ backgroundColor: getSeverityColor(event.severity) }}
                          className="text-white"
                        >
                          {event.severity}
                        </Badge>
                        <Badge variant="outline">{event.eventType}</Badge>
                        <Badge 
                          style={{ backgroundColor: getStatusColor(event.status) }}
                          className="text-white"
                        >
                          {event.status}
                        </Badge>
                      </div>
                      <h4 className="font-medium mb-1">{event.action}</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {event.resourceType} - {event.userId || 'System'}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {auditService.formatTimestamp(event.timestamp)}
                        </span>
                        {event.ipAddress && (
                          <span className="flex items-center">
                            <Shield className="h-3 w-3 mr-1" />
                            {event.ipAddress}
                          </span>
                        )}
                        {event.userId && (
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {event.userId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {total > (options.limit || 50) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing {((options.page || 1) - 1) * (options.limit || 50) + 1} to{' '}
                  {Math.min((options.page || 1) * (options.limit || 50), total)} of {total} results
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(options.page || 1) <= 1}
                    onClick={() => setOptions(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(options.page || 1) * (options.limit || 50) >= total}
                    onClick={() => setOptions(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * Save Search Dialog Component
 */
interface SaveSearchDialogProps {
  onSave: (name: string, description: string) => void;
  filters: AuditQueryFilters;
  searchText: string;
}

const SaveSearchDialog: React.FC<SaveSearchDialogProps> = ({ onSave, filters, searchText }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
      setName('');
      setDescription('');
      setOpen(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Save className="h-4 w-4 mr-2" />
        Save Search
      </Button>
      
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Save Search</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="searchName">Name</Label>
                <Input
                  id="searchName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter search name"
                />
              </div>
              <div>
                <Label htmlFor="searchDescription">Description</Label>
                <Input
                  id="searchDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditSearch;
