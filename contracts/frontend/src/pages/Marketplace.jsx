import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import TemplateBrowser from '../components/Marketplace/TemplateBrowser';
import TemplateCreator from '../components/Marketplace/TemplateCreator';
import TemplatePreview from '../components/Marketplace/TemplatePreview';
import RatingSystem from '../components/Marketplace/RatingSystem';
import { trackEvent } from '../analytics/ga';

const Marketplace = () => {
  const [view, setView] = useState('browse'); // 'browse', 'create', 'preview', 'rate'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Mock data for demonstration
  const mockTemplates = [
    {
      _id: '1',
      title: 'Identity Verification Template',
      description: 'Comprehensive template for verifying user identities with KYC compliance',
      content: 'Template content for identity verification...',
      price: 15.99,
      category: 'identity',
      tags: ['identity', 'kyc', 'verification'],
      averageRating: 4.5,
      totalRatings: 24,
      purchaseCount: 156,
      creator: 'user123',
      createdAt: '2024-01-15T10:30:00Z',
      version: '2.1.0'
    },
    {
      _id: '2',
      title: 'Academic Credential Verifier',
      description: 'Template for verifying academic degrees and certifications',
      content: 'Template content for academic credentials...',
      price: 9.99,
      category: 'credential',
      tags: ['education', 'credential', 'academic'],
      averageRating: 4.2,
      totalRatings: 18,
      purchaseCount: 89,
      creator: 'user456',
      createdAt: '2024-01-10T14:20:00Z',
      version: '1.3.2'
    },
    {
      _id: '3',
      title: 'Document Authenticity Checker',
      description: 'Verify the authenticity of important documents and certificates',
      content: 'Template content for document verification...',
      price: 12.50,
      category: 'document',
      tags: ['document', 'authenticity', 'verification'],
      averageRating: 4.7,
      totalRatings: 31,
      purchaseCount: 203,
      creator: 'user789',
      createdAt: '2024-01-05T09:15:00Z',
      version: '3.0.1'
    }
  ];

  const mockCategories = [
    { id: 'identity', name: 'Identity Verification' },
    { id: 'credential', name: 'Credentials' },
    { id: 'document', name: 'Document Verification' },
    { id: 'transaction', name: 'Transaction Proofs' },
    { id: 'custom', name: 'Custom Templates' }
  ];

  // Simulate API calls with mock data
  const fetchTemplates = async (search, filterParams = {}) => {
    // In a real implementation, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    
    let filtered = [...mockTemplates];
    
    // Apply search filter
    if (search) {
      filtered = filtered.filter(template => 
        template.title.toLowerCase().includes(search.toLowerCase()) ||
        template.description.toLowerCase().includes(search.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    // Apply other filters
    if (filterParams.category) {
      filtered = filtered.filter(t => t.category === filterParams.category);
    }
    
    if (filterParams.minPrice !== undefined) {
      filtered = filtered.filter(t => t.price >= filterParams.minPrice);
    }
    
    if (filterParams.maxPrice !== undefined) {
      filtered = filtered.filter(t => t.price <= filterParams.maxPrice);
    }
    
    if (filterParams.minRating !== undefined) {
      filtered = filtered.filter(t => t.averageRating >= filterParams.minRating);
    }
    
    if (filterParams.tags && filterParams.tags.length > 0) {
      filtered = filtered.filter(t => 
        filterParams.tags.some(tag => t.tags.includes(tag))
      );
    }
    
    return filtered;
  };

  const createTemplate = async (templateData) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newTemplate = {
      ...templateData,
      _id: Date.now().toString(),
      averageRating: 0,
      totalRatings: 0,
      purchaseCount: 0,
      creator: 'current-user',
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };
    return newTemplate;
  };

  const purchaseTemplate = async (templateId) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { 
      success: true, 
      transactionId: `tx_${Date.now()}`,
      message: 'Template purchased successfully'
    };
  };

  const rateTemplate = async ({ templateId, rating, review }) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { 
      success: true, 
      message: 'Rating submitted successfully',
      rating: { templateId, rating, review, createdAt: new Date().toISOString() }
    };
  };

  // React Query hooks
  const { data: templates = [], isLoading, refetch } = useQuery(
    ['templates', searchQuery, filters],
    () => fetchTemplates(searchQuery, filters),
    {
      keepPreviousData: true
    }
  );

  const createTemplateMutation = useMutation(createTemplate, {
    onSuccess: (newTemplate) => {
      toast.success('Template created successfully!');
      setView('browse');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to create template');
    }
  });

  const purchaseTemplateMutation = useMutation(purchaseTemplate, {
    onSuccess: (result) => {
      toast.success(result.message);
      setSelectedTemplate(null);
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to purchase template');
    }
  });

  const rateTemplateMutation = useMutation(rateTemplate, {
    onSuccess: (result) => {
      toast.success(result.message);
      setSelectedTemplate(null);
      setView('browse');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to submit rating');
    }
  });

  // Handler functions
  const handleSearch = (query, filterParams) => {
    setSearchQuery(query);
    setFilters(filterParams);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleTemplatePreview = (template) => {
    setSelectedTemplate(template);
    setView('preview');
  };

  const handleTemplatePurchase = (template) => {
    if (view === 'preview') {
      trackEvent({
        action: 'form_submit',
        category: 'Marketplace',
        label: 'purchase_template',
      });
      purchaseTemplateMutation.mutate(template._id);
    } else {
      trackEvent({
        action: 'cta_click',
        category: 'Marketplace',
        label: 'preview_template',
      });
      setSelectedTemplate(template);
      setView('preview');
    }
  };

  const handleTemplateRate = (template) => {
    setSelectedTemplate(template);
    setView('rate');
  };

  const handleCreateTemplate = (templateData) => {
    trackEvent({
      action: 'form_submit',
      category: 'Marketplace',
      label: 'create_template',
    });
    createTemplateMutation.mutate(templateData);
  };

  const handleSubmitRating = (ratingData) => {
    if (selectedTemplate) {
      trackEvent({
        action: 'form_submit',
        category: 'Marketplace',
        label: 'submit_template_rating',
      });
      rateTemplateMutation.mutate({
        templateId: selectedTemplate._id,
        ...ratingData
      });
    }
  };

  const renderView = () => {
    switch (view) {
      case 'create':
        return (
          <TemplateCreator
            onSubmit={handleCreateTemplate}
            onCancel={() => setView('browse')}
            isLoading={createTemplateMutation.isLoading}
          />
        );
      
      case 'preview':
        return (
          <TemplatePreview
            template={selectedTemplate}
            onClose={() => {
              setSelectedTemplate(null);
              setView('browse');
            }}
            onPurchase={() => handleTemplatePurchase(selectedTemplate)}
            onRate={() => handleTemplateRate(selectedTemplate)}
          />
        );
      
      case 'rate':
        return (
          <div className="max-w-2xl mx-auto">
            <RatingSystem
              onSubmit={handleSubmitRating}
              onCancel={() => {
                setSelectedTemplate(null);
                setView('browse');
              }}
              isLoading={rateTemplateMutation.isLoading}
            />
          </div>
        );
      
      case 'browse':
      default:
        return (
          <TemplateBrowser
            templates={templates}
            isLoading={isLoading}
            onTemplatePreview={handleTemplatePreview}
            onTemplatePurchase={handleTemplatePurchase}
            onTemplateRate={handleTemplateRate}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            categories={mockCategories}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Actions */}
      {view === 'browse' && (
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
                <p className="text-gray-600">Browse and manage proof templates</p>
              </div>
              <button
                onClick={() => {
                  trackEvent({
                    action: 'cta_click',
                    category: 'Marketplace',
                    label: 'open_create_template',
                  });
                  setView('create');
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {renderView()}
      </div>
    </div>
  );
};

export default Marketplace;
