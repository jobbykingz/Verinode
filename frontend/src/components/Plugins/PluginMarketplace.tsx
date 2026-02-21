import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Star, Users, Package, ExternalLink, Shield, Clock, TrendingUp } from 'lucide-react';
import { PluginStore, PluginListing, SearchFilters } from '../../marketplace/pluginStore';
import { PluginInstaller } from '../../marketplace/pluginInstaller';
import { PluginManager } from '../../plugins/pluginManager';
import toast from 'react-hot-toast';

const PluginMarketplace: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginListing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPricing, setSelectedPricing] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('downloads');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [pluginStore] = useState(() => new PluginStore());
  const [pluginManager] = useState(() => new PluginManager());
  const [pluginInstaller] = useState(() => new PluginInstaller(pluginManager, pluginStore));

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    searchPlugins();
  }, [searchQuery, selectedCategory, selectedPricing, sortBy, page]);

  const loadInitialData = async () => {
    try {
      const [categoriesData, tagsData] = await Promise.all([
        pluginStore.getCategories(),
        pluginStore.getTags()
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (error) {
      toast.error('Failed to load marketplace data');
    }
  };

  const searchPlugins = async () => {
    try {
      setLoading(true);
      const filters: SearchFilters = {
        query: searchQuery || undefined,
        category: selectedCategory || undefined,
        pricing: selectedPricing as any || undefined,
        sortBy: sortBy as any,
        page
      };

      const result = await pluginStore.searchPlugins(filters);
      setPlugins(page === 1 ? result.plugins : [...plugins, ...result.plugins]);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error('Failed to search plugins');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallPlugin = async (pluginId: string) => {
    try {
      await pluginInstaller.installPlugin(pluginId);
      toast.success('Plugin installed successfully');
    } catch (error) {
      toast.error('Failed to install plugin');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    searchPlugins();
  };

  const loadMore = () => {
    setPage(page + 1);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getPricingIcon = (pricing: string) => {
    switch (pricing) {
      case 'free': return <span className="text-green-600">Free</span>;
      case 'paid': return <span className="text-blue-600">Paid</span>;
      case 'freemium': return <span className="text-purple-600">Freemium</span>;
      default: return <span className="text-gray-600">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plugin Marketplace</h1>
          <p className="text-gray-600 mt-1">Discover and install plugins to extend Verinode functionality</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>

      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pricing</label>
              <select
                value={selectedPricing}
                onChange={(e) => setSelectedPricing(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Pricing</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
                <option value="freemium">Freemium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="downloads">Most Downloaded</option>
                <option value="rating">Highest Rated</option>
                <option value="updated">Recently Updated</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && plugins.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : plugins.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{plugin.metadata.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      v{plugin.metadata.version}
                    </span>
                    {plugin.author.verified && (
                      <Shield className="w-4 h-4 text-blue-600" title="Verified Author" />
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{plugin.metadata.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{plugin.author.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Download className="w-4 h-4" />
                      <span>{formatNumber(plugin.stats.downloads)} downloads</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>{plugin.stats.rating.toFixed(1)} ({plugin.stats.reviews} reviews)</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Updated {formatDate(plugin.stats.lastUpdated)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium">{getPricingIcon(plugin.pricing.type)}</span>
                      <div className="flex flex-wrap gap-1">
                        {plugin.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {plugin.tags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{plugin.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => window.open(`/plugins/${plugin.id}`, '_blank')}
                        className="flex items-center space-x-1 px-3 py-1.5 text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Details</span>
                      </button>
                      <button
                        onClick={() => handleInstallPlugin(plugin.id)}
                        className="flex items-center space-x-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Install</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {loading && plugins.length > 0 && (
        <div className="flex items-center justify-center h-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default PluginMarketplace;
