import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Calendar, User, Tag, AlertCircle, Clock, MessageSquare, Paperclip, Edit3, Trash2, CheckCircle, XCircle, Play, Pause, BarChart2, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  type: 'TASK' | 'BUG' | 'FEATURE' | 'EPIC' | 'STORY';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
  };
  reporter: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
  };
  labels: string[];
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  comments: number;
  attachments: number;
  subtasks: number;
  completedSubtasks: number;
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface TaskFilters {
  status: string[];
  priority: string[];
  type: string[];
  assignee: string;
  labels: string[];
  dueDate: {
    from?: Date;
    to?: Date;
  };
  search: string;
}

interface TaskManagerProps {
  projectId: string;
  onTaskSelect?: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  className?: string;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  projectId,
  onTaskSelect,
  onTaskUpdate,
  className = ''
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list');
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'dueDate' | 'createdAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<TaskFilters>({
    status: [],
    priority: [],
    type: [],
    assignee: 'all',
    labels: [],
    dueDate: {},
    search: ''
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: '1',
        title: 'Implement user authentication system',
        description: 'Add JWT-based authentication with refresh tokens and secure password hashing',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        type: 'FEATURE',
        assignee: { id: '1', name: 'John Doe', avatar: 'JD', email: 'john@example.com' },
        reporter: { id: '2', name: 'Jane Smith', avatar: 'JS', email: 'jane@example.com' },
        labels: ['backend', 'security', 'authentication'],
        dueDate: new Date('2024-02-01'),
        estimatedHours: 16,
        actualHours: 8,
        progress: 50,
        comments: 12,
        attachments: 3,
        subtasks: 4,
        completedSubtasks: 2,
        dependencies: ['2'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20')
      },
      {
        id: '2',
        title: 'Fix login page responsiveness issues',
        description: 'Mobile layout breaks on small screens, need to fix CSS grid',
        status: 'TODO',
        priority: 'MEDIUM',
        type: 'BUG',
        assignee: { id: '3', name: 'Bob Johnson', avatar: 'BJ', email: 'bob@example.com' },
        reporter: { id: '4', name: 'Alice Brown', avatar: 'AB', email: 'alice@example.com' },
        labels: ['frontend', 'css', 'mobile'],
        dueDate: new Date('2024-01-25'),
        estimatedHours: 6,
        actualHours: 0,
        progress: 0,
        comments: 5,
        attachments: 2,
        subtasks: 2,
        completedSubtasks: 0,
        dependencies: [],
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16')
      },
      {
        id: '3',
        title: 'Database performance optimization',
        description: 'Optimize slow queries and add proper indexing for better performance',
        status: 'IN_REVIEW',
        priority: 'HIGH',
        type: 'TASK',
        assignee: { id: '5', name: 'Charlie Wilson', avatar: 'CW', email: 'charlie@example.com' },
        reporter: { id: '1', name: 'John Doe', avatar: 'JD', email: 'john@example.com' },
        labels: ['backend', 'database', 'performance'],
        dueDate: new Date('2024-01-30'),
        estimatedHours: 12,
        actualHours: 10,
        progress: 90,
        comments: 8,
        attachments: 4,
        subtasks: 3,
        completedSubtasks: 3,
        dependencies: [],
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-22')
      },
      {
        id: '4',
        title: 'User dashboard redesign',
        description: 'Complete redesign of the main user dashboard with improved UX',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        type: 'FEATURE',
        assignee: { id: '4', name: 'Alice Brown', avatar: 'AB', email: 'alice@example.com' },
        reporter: { id: '2', name: 'Jane Smith', avatar: 'JS', email: 'jane@example.com' },
        labels: ['frontend', 'design', 'ux'],
        estimatedHours: 20,
        actualHours: 18,
        progress: 100,
        comments: 15,
        attachments: 8,
        subtasks: 5,
        completedSubtasks: 5,
        dependencies: [],
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-18')
      }
    ];

    setTasks(mockTasks);
    setLoading(false);
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...tasks];

    // Apply search filter
    if (filters.search) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.labels.some(label => label.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status.includes(task.status));
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      filtered = filtered.filter(task => filters.priority.includes(task.priority));
    }

    // Apply type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(task => filters.type.includes(task.type));
    }

    // Apply assignee filter
    if (filters.assignee !== 'all') {
      filtered = filtered.filter(task => task.assignee?.id === filters.assignee);
    }

    // Apply labels filter
    if (filters.labels.length > 0) {
      filtered = filtered.filter(task =>
        filters.labels.some(label => task.labels.includes(label))
      );
    }

    // Apply due date filter
    if (filters.dueDate.from || filters.dueDate.to) {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        if (filters.dueDate.from && task.dueDate < filters.dueDate.from) return false;
        if (filters.dueDate.to && task.dueDate > filters.dueDate.to) return false;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === 'priority') {
        const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        aValue = priorityOrder[a.priority];
        bValue = priorityOrder[b.priority];
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredTasks(filtered);
  }, [tasks, filters, sortBy, sortOrder]);

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, status: newStatus as Task['status'] };
    
    // Auto-update progress based on status
    if (newStatus === 'COMPLETED') {
      updatedTask.progress = 100;
    } else if (newStatus === 'TODO') {
      updatedTask.progress = 0;
    } else if (newStatus === 'IN_PROGRESS' && updatedTask.progress === 0) {
      updatedTask.progress = 25;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    onTaskUpdate?.(taskId, { status: newStatus, progress: updatedTask.progress });
    toast(`Task status updated to ${newStatus}`);
  };

  const handleTaskPriorityChange = (taskId: string, newPriority: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, priority: newPriority as Task['priority'] };
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    onTaskUpdate?.(taskId, { priority: newPriority });
    toast(`Task priority updated to ${newPriority}`);
  };

  const handleTaskAssigneeChange = (taskId: string, newAssignee?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { 
      ...task, 
      assignee: newAssignee ? { id: newAssignee, name: 'New User', avatar: 'NU' } : undefined 
    };
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    onTaskUpdate?.(taskId, { assignee: updatedTask.assignee });
    toast('Task assignee updated');
  };

  const handleTaskSelection = (taskId: string, selected: boolean) => {
    if (selected) {
      setSelectedTasks(prev => [...prev, taskId]);
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTasks(filteredTasks.map(task => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedTasks.length === 0) {
      toast('Please select tasks first');
      return;
    }

    switch (action) {
      case 'delete':
        if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} tasks?`)) {
          setTasks(prev => prev.filter(task => !selectedTasks.includes(task.id)));
          setSelectedTasks([]);
          toast('Tasks deleted successfully');
        }
        break;
      case 'complete':
        selectedTasks.forEach(taskId => {
          handleTaskStatusChange(taskId, 'COMPLETED');
        });
        setSelectedTasks([]);
        break;
      case 'assign':
        // In real implementation, this would open a user selection modal
        toast('Bulk assign feature coming soon');
        break;
    }
  };

  const exportTasks = (format: 'csv' | 'json' | 'excel') => {
    const data = filteredTasks.map(task => ({
      ID: task.id,
      Title: task.title,
      Status: task.status,
      Priority: task.priority,
      Type: task.type,
      Assignee: task.assignee?.name || 'Unassigned',
      'Due Date': task.dueDate?.toLocaleDateString() || '',
      'Estimated Hours': task.estimatedHours || 0,
      'Actual Hours': task.actualHours || 0,
      Progress: `${task.progress}%`,
      Labels: task.labels.join(', ')
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
        content = convertToCSV(data);
        filename = 'tasks.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = 'tasks.json';
        mimeType = 'application/json';
        break;
      case 'excel':
        // In real implementation, would use a library like xlsx
        content = convertToCSV(data);
        filename = 'tasks.csv';
        mimeType = 'text/csv';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast(`Tasks exported as ${format.toUpperCase()}`);
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      case 'IN_REVIEW': return 'bg-yellow-100 text-yellow-700';
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUG': return '🐛';
      case 'FEATURE': return '✨';
      case 'EPIC': return '📋';
      case 'STORY': return '📖';
      default: return '📝';
    }
  };

  const isOverdue = (dueDate?: Date) => {
    if (!dueDate) return false;
    return dueDate < new Date() && dueDate < new Date();
  };

  const getUniqueAssignees = () => {
    const assignees = new Map();
    tasks.forEach(task => {
      if (task.assignee) {
        assignees.set(task.assignee.id, task.assignee);
      }
    });
    return Array.from(assignees.values());
  };

  const getUniqueLabels = () => {
    const labels = new Set<string>();
    tasks.forEach(task => {
      task.labels.forEach(label => labels.add(label));
    });
    return Array.from(labels);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Task Manager</h2>
            <span className="text-sm text-gray-500">
              {filteredTasks.length} of {tasks.length} tasks
            </span>
            {selectedTasks.length > 0 && (
              <span className="text-sm text-blue-600">
                {selectedTasks.length} selected
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg ${showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <div className="relative group">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Download className="w-5 h-5" />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10">
                <button
                  onClick={() => exportTasks('csv')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => exportTasks('json')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => exportTasks('excel')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as Excel
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setIsCreatingTask(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Quick Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Created</option>
            <option value="title">Title</option>
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="status">Status</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded ${viewMode === 'timeline' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Timeline
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="space-y-1">
                  {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, status: [...prev.status, status] }));
                          } else {
                            setFilters(prev => ({ ...prev, status: prev.status.filter(s => s !== status) }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <div className="space-y-1">
                  {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(priority => (
                    <label key={priority} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, priority: [...prev.priority, priority] }));
                          } else {
                            setFilters(prev => ({ ...prev, priority: prev.priority.filter(p => p !== priority) }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                <select
                  value={filters.assignee}
                  onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Assignees</option>
                  {getUniqueAssignees().map(assignee => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dueDate.from?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dueDate: { ...prev.dueDate, from: e.target.value ? new Date(e.target.value) : undefined }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={filters.dueDate.to?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dueDate: { ...prev.dueDate, to: e.target.value ? new Date(e.target.value) : undefined }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedTasks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-700">
                {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => handleSelectAll(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('complete')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Mark Complete
              </button>
              <button
                onClick={() => handleBulkAction('assign')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Assign
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="p-4">
        {viewMode === 'list' && (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </div>
              <div className="col-span-4">Title</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Assignee</div>
              <div className="col-span-1">Due Date</div>
              <div className="col-span-1">Progress</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Task Rows */}
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="grid grid-cols-12 gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 items-center"
              >
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={(e) => handleTaskSelection(task.id, e.target.checked)}
                    className="rounded"
                  />
                </div>
                
                <div className="col-span-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(task.type)}</span>
                    <div>
                      <h4 className="font-medium text-sm cursor-pointer hover:text-blue-600"
                          onClick={() => onTaskSelect?.(task)}>
                        {task.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {task.labels.slice(0, 2).map((label, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {label}
                          </span>
                        ))}
                        {task.labels.length > 2 && (
                          <span className="text-xs text-gray-500">+{task.labels.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <select
                    value={task.status}
                    onChange={(e) => handleTaskStatusChange(task.id, e.target.value)}
                    className={`px-2 py-1 text-xs rounded border-0 ${getStatusColor(task.status)}`}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <select
                    value={task.priority}
                    onChange={(e) => handleTaskPriorityChange(task.id, e.target.value)}
                    className="px-2 py-1 text-xs rounded border-0"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="col-span-2">
                  {task.assignee ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                        {task.assignee.avatar || task.assignee.name.charAt(0)}
                      </div>
                      <span className="text-sm">{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  )}
                </div>

                <div className="col-span-1">
                  {task.dueDate && (
                    <div className={`flex items-center space-x-1 text-xs ${
                      isOverdue(task.dueDate) ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      <span>{task.dueDate.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600">{task.progress}%</span>
                  </div>
                </div>

                <div className="col-span-1">
                  <div className="flex items-center space-x-1">
                    {task.comments > 0 && (
                      <div className="flex items-center text-gray-500">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs ml-1">{task.comments}</span>
                      </div>
                    )}
                    {task.attachments > 0 && (
                      <div className="flex items-center text-gray-500">
                        <Paperclip className="w-4 h-4" />
                        <span className="text-xs ml-1">{task.attachments}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onTaskSelect?.(task)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(task.type)}</span>
                    <h3 className="font-medium text-sm">{task.title}</h3>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                </div>

                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>

                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  {task.dueDate && (
                    <div className={`flex items-center space-x-1 text-xs ${
                      isOverdue(task.dueDate) ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      <span>{task.dueDate.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {task.assignee && (
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                        {task.assignee.avatar || task.assignee.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      {task.comments > 0 && (
                        <>
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.comments}</span>
                        </>
                      )}
                      {task.attachments > 0 && (
                        <>
                          <Paperclip className="w-3 h-3" />
                          <span>{task.attachments}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600">{task.progress}%</div>
                </div>

                {task.progress > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="space-y-4">
            {filteredTasks
              .filter(task => task.dueDate)
              .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
              .map((task) => (
                <div key={task.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-32 text-sm text-gray-600">
                    {task.dueDate?.toLocaleDateString()}
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`}></div>
                  </div>
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getTypeIcon(task.type)}</span>
                        <h4 className="font-medium text-sm">{task.title}</h4>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">No tasks found</div>
            <button
              onClick={() => setFilters({
                status: [],
                priority: [],
                type: [],
                assignee: 'all',
                labels: [],
                dueDate: {},
                search: ''
              })}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create New Task</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="Enter task title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Enter task description..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="FEATURE">Feature</option>
                    <option value="EPIC">Epic</option>
                    <option value="STORY">Story</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignee
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Unassigned</option>
                    {getUniqueAssignees().map(assignee => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labels (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="frontend, backend, urgent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setIsCreatingTask(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle task creation
                  setIsCreatingTask(false);
                  toast('Task created successfully');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
