import React, { useState } from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { FieldType, FieldLibraryItem } from '../../types/formBuilder';
import { 
  Type, 
  Hash, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  Image, 
  List, 
  CheckSquare, 
  Radio, 
  MessageSquare, 
  Link, 
  Upload, 
  Star, 
  Sliders, 
  PenTool,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface FieldLibraryProps {
  onFieldSelect: (fieldType: FieldType) => void;
  onClose: () => void;
}

const FieldLibrary: React.FC<FieldLibraryProps> = ({ onFieldSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'advanced' | 'special'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    basic: true,
    advanced: false,
    special: false,
  });

  const fieldLibraryItems: FieldLibraryItem[] = [
    // Basic Fields
    {
      type: 'text',
      label: 'Text Input',
      icon: 'Type',
      description: 'Single line text input',
      category: 'basic',
      defaultSettings: {
        maxLength: 255,
        placeholder: 'Enter text...',
      },
    },
    {
      type: 'number',
      label: 'Number',
      icon: 'Hash',
      description: 'Numeric input field',
      category: 'basic',
      defaultSettings: {
        min: 0,
        max: 999999,
        step: 1,
      },
    },
    {
      type: 'email',
      label: 'Email',
      icon: 'Mail',
      description: 'Email address input',
      category: 'basic',
      defaultSettings: {
        placeholder: 'email@example.com',
      },
    },
    {
      type: 'phone',
      label: 'Phone',
      icon: 'Phone',
      description: 'Phone number input',
      category: 'basic',
      defaultSettings: {
        placeholder: '+1 (555) 123-4567',
      },
    },
    {
      type: 'url',
      label: 'URL',
      icon: 'Link',
      description: 'Website or link input',
      category: 'basic',
      defaultSettings: {
        placeholder: 'https://example.com',
      },
    },
    {
      type: 'textarea',
      label: 'Text Area',
      icon: 'MessageSquare',
      description: 'Multi-line text input',
      category: 'basic',
      defaultSettings: {
        rows: 4,
        placeholder: 'Enter your message...',
      },
    },
    {
      type: 'password',
      label: 'Password',
      icon: 'Lock',
      description: 'Password input field',
      category: 'basic',
      defaultSettings: {
        minLength: 8,
        showPasswordToggle: true,
      },
    },

    // Choice Fields
    {
      type: 'select',
      label: 'Dropdown',
      icon: 'List',
      description: 'Single selection dropdown',
      category: 'advanced',
      defaultSettings: {
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
      },
    },
    {
      type: 'multiselect',
      label: 'Multi Select',
      icon: 'CheckSquare',
      description: 'Multiple selection dropdown',
      category: 'advanced',
      defaultSettings: {
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
      },
    },
    {
      type: 'radio',
      label: 'Radio Buttons',
      icon: 'Radio',
      description: 'Single choice radio buttons',
      category: 'advanced',
      defaultSettings: {
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
        inline: false,
      },
    },
    {
      type: 'checkbox',
      label: 'Checkboxes',
      icon: 'CheckSquare',
      description: 'Multiple choice checkboxes',
      category: 'advanced',
      defaultSettings: {
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
        inline: false,
      },
    },

    // Date & Time Fields
    {
      type: 'date',
      label: 'Date',
      icon: 'Calendar',
      description: 'Date picker',
      category: 'advanced',
      defaultSettings: {
        dateFormat: 'YYYY-MM-DD',
        showTodayButton: true,
      },
    },
    {
      type: 'datetime',
      label: 'Date & Time',
      icon: 'Calendar',
      description: 'Date and time picker',
      category: 'advanced',
      defaultSettings: {
        dateTimeFormat: 'YYYY-MM-DD HH:mm',
        showNowButton: true,
      },
    },
    {
      type: 'time',
      label: 'Time',
      icon: 'Clock',
      description: 'Time picker',
      category: 'advanced',
      defaultSettings: {
        timeFormat: '24h',
        interval: 15,
      },
    },

    // File Fields
    {
      type: 'file',
      label: 'File Upload',
      icon: 'Upload',
      description: 'File upload field',
      category: 'advanced',
      defaultSettings: {
        multiple: false,
        maxFileSize: 5242880, // 5MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      },
    },
    {
      type: 'image',
      label: 'Image Upload',
      icon: 'Image',
      description: 'Image upload field',
      category: 'advanced',
      defaultSettings: {
        multiple: false,
        maxFileSize: 2097152, // 2MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        preview: true,
      },
    },

    // Special Fields
    {
      type: 'rating',
      label: 'Rating',
      icon: 'Star',
      description: 'Star rating field',
      category: 'special',
      defaultSettings: {
        maxRating: 5,
        allowHalf: false,
        showValues: true,
      },
    },
    {
      type: 'range',
      label: 'Range Slider',
      icon: 'Sliders',
      description: 'Range slider input',
      category: 'special',
      defaultSettings: {
        min: 0,
        max: 100,
        step: 1,
        showLabels: true,
        showValue: true,
      },
    },
    {
      type: 'signature',
      label: 'Signature',
      icon: 'PenTool',
      description: 'Digital signature field',
      category: 'special',
      defaultSettings: {
        width: 400,
        height: 200,
        backgroundColor: '#ffffff',
        penColor: '#000000',
        showClearButton: true,
      },
    },
  ];

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      Type,
      Hash,
      Mail,
      Phone,
      Calendar,
      Clock,
      FileText,
      Image,
      List,
      CheckSquare,
      Radio,
      MessageSquare,
      Link,
      Upload,
      Star,
      Sliders,
      PenTool,
      Lock,
    };
    return icons[iconName] || Type;
  };

  const filteredItems = fieldLibraryItems.filter(item => {
    const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
    return groups;
  }, {} as Record<string, FieldLibraryItem[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleFieldClick = (fieldType: FieldType) => {
    onFieldSelect(fieldType);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Field Library</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex space-x-2 mt-3">
          {[
            { key: 'all', label: 'All' },
            { key: 'basic', label: 'Basic' },
            { key: 'advanced', label: 'Advanced' },
            { key: 'special', label: 'Special' },
          ].map(category => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key as any)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                selectedCategory === category.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Field List */}
      <div className="flex-1 overflow-y-auto p-4">
        <Droppable droppableId="field-library" isDropDisabled={true}>
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center space-x-2 w-full text-left mb-2 group"
                  >
                    {expandedCategories[category] ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <h3 className="text-sm font-medium text-gray-700 capitalize">
                      {category}
                    </h3>
                    <span className="text-xs text-gray-500">
                      ({items.length})
                    </span>
                  </button>

                  {expandedCategories[category] && (
                    <div className="space-y-2 pl-6">
                      {items.map((item, index) => {
                        const Icon = getIcon(item.icon);
                        return (
                          <div
                            key={item.type}
                            onClick={() => handleFieldClick(item.type)}
                            className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex-shrink-0">
                              <Icon className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {item.label}
                              </h4>
                              <p className="text-xs text-gray-500 truncate">
                                {item.description}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Search className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-sm text-gray-500">No fields found</p>
            <p className="text-xs text-gray-400 mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500">
          <p className="mb-1">💡 Tip: Drag fields to the form or click to add</p>
          <p>Hold and drag to reorder fields in the form</p>
        </div>
      </div>
    </div>
  );
};

export default FieldLibrary;
