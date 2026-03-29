import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import ChartLibrary, { ChartData } from './ChartLibrary';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Save,
  Eye,
  Settings,
  BarChart3,
  PieChart,
  LineChart,
  Grid3X3,
  Calendar,
  Filter,
  Move,
  Edit2,
  Copy,
  Share2,
} from 'lucide-react';

interface ReportWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text' | 'heatmap';
  title: string;
  config: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: ReportWidget[];
  layout: 'grid' | 'freeform';
  createdAt: string;
  updatedAt: string;
}

interface CustomReportsProps {
  className?: string;
  templates?: ReportTemplate[];
  onSave?: (template: ReportTemplate) => void;
  onLoad?: (templateId: string) => void;
  onExport?: (templateId: string, format: 'pdf' | 'excel' | 'csv') => void;
}

const widgetTypes = [
  { type: 'chart', icon: <LineChart className="w-4 h-4" />, label: 'Line Chart' },
  { type: 'bar', icon: <BarChart3 className="w-4 h-4" />, label: 'Bar Chart' },
  { type: 'pie', icon: <PieChart className="w-4 h-4" />, label: 'Pie Chart' },
  { type: 'metric', icon: <Grid3X3 className="w-4 h-4" />, label: 'Metric Card' },
  { type: 'table', icon: <FileText className="w-4 h-4" />, label: 'Data Table' },
  { type: 'heatmap', icon: <Grid3X3 className="w-4 h-4" />, label: 'Heat Map' },
];

const CustomReports: React.FC<CustomReportsProps> = ({
  className = '',
  templates,
  onSave,
  onLoad,
  onExport,
}) => {
  const [currentTemplate, setCurrentTemplate] = useState<ReportTemplate>({
    id: '',
    name: 'New Report',
    description: '',
    widgets: [],
    layout: 'grid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Mock data generation
  const generateMockChartData = (type: string): ChartData => {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data1 = labels.map(() => Math.floor(Math.random() * 100) + 20);
    const data2 = labels.map(() => Math.floor(Math.random() * 100) + 20);

    return {
      labels,
      datasets: [
        {
          label: 'Dataset 1',
          data: data1,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        ...(type === 'line' ? [{
          label: 'Dataset 2',
          data: data2,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        }] : []),
      ],
    };
  };

  const addWidget = (type: string) => {
    const newWidget: ReportWidget = {
      id: `widget-${Date.now()}`,
      type: type as any,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
      config: {
        chartType: type === 'chart' ? 'line' : type,
        dataSource: 'mock',
        refreshInterval: 30000,
      },
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      data: type === 'chart' || type === 'bar' || type === 'pie' ? generateMockChartData(type) : null,
    };

    setCurrentTemplate(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      updatedAt: new Date().toISOString(),
    }));
    setShowWidgetPanel(false);
  };

  const removeWidget = (widgetId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedWidget(null);
  };

  const updateWidget = (widgetId: string, updates: Partial<ReportWidget>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(currentTemplate.widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCurrentTemplate(prev => ({
      ...prev,
      widgets: items,
      updatedAt: new Date().toISOString(),
    }));
  };

  const renderWidget = (widget: ReportWidget) => {
    const isSelected = selectedWidget === widget.id;

    switch (widget.type) {
      case 'chart':
      case 'bar':
      case 'pie':
        return (
          <ChartLibrary
            type={widget.config.chartType || widget.type}
            data={widget.data || generateMockChartData(widget.type)}
            width={widget.size.width}
            height={widget.size.height}
            className="w-full h-full"
          />
        );
      
      case 'metric':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">1,234</div>
              <div className="text-sm text-gray-600">Total Metrics</div>
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Column 1</th>
                  <th className="text-left p-2">Column 2</th>
                  <th className="text-left p-2">Column 3</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="border-b">
                    <td className="p-2">Data {i}A</td>
                    <td className="p-2">Data {i}B</td>
                    <td className="p-2">Data {i}C</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'text':
        return (
          <div className="p-4 h-full">
            <h3 className="font-semibold mb-2">{widget.title}</h3>
            <p className="text-sm text-gray-600">
              This is a text widget. You can add descriptions, notes, or any other text content here.
            </p>
          </div>
        );
      
      default:
        return <div className="flex items-center justify-center h-full text-gray-500">Unknown Widget Type</div>;
    }
  };

  const saveTemplate = () => {
    setIsLoading(true);
    setTimeout(() => {
      onSave?.(currentTemplate);
      setIsLoading(false);
      setIsEditing(false);
    }, 1000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Custom Reports</h1>
          {isEditing && (
            <input
              type="text"
              value={currentTemplate.name}
              onChange={(e) => setCurrentTemplate(prev => ({ ...prev, name: e.target.value }))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
            >
              <Edit2 className="w-4 h-4" />
              Edit Report
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowWidgetPanel(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center gap-2 hover:bg-green-600"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
              <button
                onClick={saveTemplate}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg flex items-center gap-2 hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          )}
          
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              previewMode 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </button>
          
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Widget Panel */}
      <AnimatePresence>
        {showWidgetPanel && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Widget</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {widgetTypes.map(widgetType => (
                <button
                  key={widgetType.type}
                  onClick={() => addWidget(widgetType.type)}
                  className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    {widgetType.icon}
                    <span className="text-sm text-gray-700 dark:text-gray-300">{widgetType.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Canvas */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 min-h-[600px]"
      >
        {currentTemplate.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <FileText className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No widgets yet</h3>
            <p className="text-sm mb-4">Start building your report by adding widgets</p>
            {isEditing && (
              <button
                onClick={() => setShowWidgetPanel(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
                Add Your First Widget
              </button>
            )}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="widgets" direction="vertical">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {currentTemplate.widgets.map((widget, index) => (
                    <Draggable
                      key={widget.id}
                      draggableId={widget.id}
                      index={index}
                      isDragDisabled={!isEditing}
                    >
                      {(provided, snapshot) => (
                        <motion.div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg p-4 ${
                            snapshot.isDragging ? 'shadow-xl' : 'shadow-md'
                          } ${selectedWidget === widget.id ? 'ring-2 ring-blue-500' : ''} ${
                            isEditing ? 'cursor-move' : ''
                          }`}
                          style={{
                            ...provided.draggableProps.style,
                            height: widget.size.height,
                          }}
                          onClick={() => isEditing && setSelectedWidget(widget.id)}
                        >
                          {isEditing && (
                            <div className="absolute top-2 right-2 flex gap-2">
                              <button
                                {...provided.dragHandleProps}
                                className="p-1 bg-white dark:bg-gray-800 rounded shadow hover:shadow-md"
                                title="Drag to reorder"
                              >
                                <Move className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeWidget(widget.id);
                                }}
                                className="p-1 bg-white dark:bg-gray-800 rounded shadow hover:shadow-md"
                                title="Remove widget"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          )}
                          
                          <div className="h-full">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                              {widget.title}
                            </h3>
                            {renderWidget(widget)}
                          </div>
                        </motion.div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </motion.div>

      {/* Report Info */}
      {currentTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Name:</span>
              <p className="text-gray-900 dark:text-white">{currentTemplate.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Widgets:</span>
              <p className="text-gray-900 dark:text-white">{currentTemplate.widgets.length}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Last Updated:</span>
              <p className="text-gray-900 dark:text-white">
                {new Date(currentTemplate.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CustomReports;
