import React, { useState, useEffect } from 'react';
import { FormTemplate } from '../types/formBuilder';
import FormBuilderService from '../services/formBuilderService';
import { 
  Plus, 
  Search, 
  Edit, 
  Copy, 
  Trash2, 
  Eye, 
  Download, 
  Upload,
  Filter,
  Grid,
  List,
  Star,
  Clock,
  Users,
  Tag,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

const FormTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  
  const formBuilderService = new FormBuilderService();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await formBuilderService.getTemplates({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      setTemplates(response.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleCreateNew = () => {
    window.location.href = '/form-builder';
  };

  const handleEditTemplate = (templateId: string) => {
    window.location.href = `/form-builder?templateId=${templateId}`;
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        const duplicated = await formBuilderService.duplicateTemplate(templateId, `${template.name} (Copy)`);
        setTemplates(prev => [duplicated, ...prev]);
      }
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await formBuilderService.deleteTemplate(templateId);
        setTemplates(prev => prev.filter(t => t.id !== templateId));
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleExportTemplate = async (templateId: string) => {
    try {
      const blob = await formBuilderService.exportTemplate(templateId, 'json');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const template = templates.find(t => t.id === templateId);
      a.download = `${template?.name || 'form-template'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export template:', error);
    }
  };

  const handleImportTemplate = async (file: File) => {
    try {
      const imported = await formBuilderService.importTemplate(file);
      setTemplates(prev => [imported, ...prev]);
    } catch (error) {
      console.error('Failed to import template:', error);
    }
  };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'contact', label: 'Contact Forms' },
    { value: 'survey', label: 'Surveys' },
    { value: 'application', label: 'Applications' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'registration', label: 'Registration' },
    { value: 'order', label: 'Order Forms' },
    { value: 'other', label: 'Other' },
  ];

  const TemplateCard = ({ template }: { template: FormTemplate }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
            {template.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-1 ml-4">
            <button
              onClick={() => handleEditTemplate(template.id)}
              className="p-1 rounded hover:bg-gray-100"
              title="Edit"
            >
              <Edit className="w-4 h-4 text-gray-500" />
            </button>
            <div className="relative">
              <button className="p-1 rounded hover:bg-gray-100" title="More options">
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <Grid className="w-4 h-4" />
            <span>{template.fields.length} fields</span>
          </div>
          {template.metadata.isPublic && (
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>Public</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{new Date(template.metadata.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {template.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {template.metadata.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
              >
                {tag}
              </span>
            ))}
            {template.metadata.tags.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                +{template.metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDuplicateTemplate(template.id)}
              className="flex items-center space-x-1 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Copy className="w-3 h-3" />
              <span>Duplicate</span>
            </button>
            <button
              onClick={() => handleExportTemplate(template.id)}
              className="flex items-center space-x-1 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            <span>{template.metadata.usageCount}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const TemplateListItem = ({ template }: { template: FormTemplate }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
            {template.metadata.isPublic && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                Public
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
          )}
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
            <span>{template.fields.length} fields</span>
            <span>Updated {new Date(template.metadata.updatedAt).toLocaleDateString()}</span>
            <span>{template.metadata.usageCount} uses</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEditTemplate(template.id)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            onClick={() => handleDuplicateTemplate(template.id)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            onClick={() => handleExportTemplate(template.id)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Export
          </button>
          <button
            onClick={() => handleDeleteTemplate(template.id)}
            className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Form Templates</h1>
            <p className="text-gray-600 mt-2">Create and manage your form templates</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && handleImportTemplate(e.target.files[0])}
                className="hidden"
                id="import-template"
              />
              <label
                htmlFor="import-template"
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </label>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg ${
              showFilters ? 'bg-blue-50 border-blue-300' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Templates */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Grid className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'Try adjusting your search terms' : 'Create your first form template to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map(template => (
                <TemplateListItem key={template.id} template={template} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Stats */}
      {templates.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <Grid className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Templates</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{templates.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Total Uses</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {templates.reduce((sum, t) => sum + t.metadata.usageCount, 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-gray-600">Public Templates</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {templates.filter(t => t.metadata.isPublic).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Last Updated</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {new Date(Math.max(...templates.map(t => new Date(t.metadata.updatedAt).getTime()))).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormTemplatesPage;
