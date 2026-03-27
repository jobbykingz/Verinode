import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Plus, MoreHorizontal, Filter, Search, Calendar, User, Tag, ChevronDown, Settings, BarChart3, Users, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  type: 'TASK' | 'BUG' | 'FEATURE' | 'EPIC' | 'STORY';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  reporter: {
    id: string;
    name: string;
    avatar?: string;
  };
  labels: string[];
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  comments: number;
  attachments: number;
  createdAt: Date;
  updatedAt: Date;
}

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  tasks: Task[];
  limit?: number;
  color: string;
}

interface ProjectBoardProps {
  projectId: string;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  className?: string;
}

export const ProjectBoard: React.FC<ProjectBoardProps> = ({
  projectId,
  onTaskClick,
  onTaskUpdate,
  className = ''
}) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([
    {
      id: 'todo',
      title: 'To Do',
      status: 'TODO',
      tasks: [],
      color: 'bg-gray-500'
    },
    {
      id: 'inprogress',
      title: 'In Progress',
      status: 'IN_PROGRESS',
      tasks: [],
      color: 'bg-blue-500'
    },
    {
      id: 'inreview',
      title: 'In Review',
      status: 'IN_REVIEW',
      tasks: [],
      color: 'bg-yellow-500'
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'COMPLETED',
      tasks: [],
      color: 'bg-green-500'
    }
  ]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string>('todo');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: '1',
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication system',
        status: 'TODO',
        priority: 'HIGH',
        type: 'FEATURE',
        assignee: { id: '1', name: 'John Doe', avatar: 'JD' },
        reporter: { id: '2', name: 'Jane Smith', avatar: 'JS' },
        labels: ['backend', 'security'],
        dueDate: new Date('2024-02-01'),
        estimatedHours: 8,
        actualHours: 0,
        progress: 0,
        comments: 3,
        attachments: 2,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: '2',
        title: 'Fix login bug',
        description: 'Users cannot login with correct credentials',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        type: 'BUG',
        assignee: { id: '3', name: 'Bob Johnson', avatar: 'BJ' },
        reporter: { id: '1', name: 'John Doe', avatar: 'JD' },
        labels: ['bug', 'frontend'],
        dueDate: new Date('2024-01-20'),
        estimatedHours: 4,
        actualHours: 2,
        progress: 50,
        comments: 5,
        attachments: 1,
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-17')
      },
      {
        id: '3',
        title: 'Design dashboard layout',
        description: 'Create mockups for the main dashboard',
        status: 'IN_REVIEW',
        priority: 'MEDIUM',
        type: 'TASK',
        assignee: { id: '4', name: 'Alice Brown', avatar: 'AB' },
        reporter: { id: '2', name: 'Jane Smith', avatar: 'JS' },
        labels: ['design', 'ui'],
        dueDate: new Date('2024-01-25'),
        estimatedHours: 6,
        actualHours: 6,
        progress: 100,
        comments: 2,
        attachments: 4,
        createdAt: new Date('2024-01-14'),
        updatedAt: new Date('2024-01-18')
      },
      {
        id: '4',
        title: 'Setup CI/CD pipeline',
        description: 'Configure automated testing and deployment',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        type: 'TASK',
        assignee: { id: '5', name: 'Charlie Wilson', avatar: 'CW' },
        reporter: { id: '1', name: 'John Doe', avatar: 'JD' },
        labels: ['devops', 'automation'],
        estimatedHours: 12,
        actualHours: 10,
        progress: 100,
        comments: 8,
        attachments: 3,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-16')
      }
    ];

    setTasks(mockTasks);
    
    // Distribute tasks to columns
    const updatedColumns = columns.map(column => ({
      ...column,
      tasks: mockTasks.filter(task => task.status === column.status)
    }));
    
    setColumns(updatedColumns);
    setLoading(false);
  }, []);

  // Filter tasks
  const filteredTasks = useCallback(() => {
    let filtered = tasks;

    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === selectedPriority);
    }

    if (selectedAssignee !== 'all') {
      filtered = filtered.filter(task => task.assignee?.id === selectedAssignee);
    }

    if (selectedLabels.length > 0) {
      filtered = filtered.filter(task => 
        selectedLabels.some(label => task.labels.includes(label))
      );
    }

    return filtered;
  }, [tasks, searchQuery, selectedPriority, selectedAssignee, selectedLabels]);

  // Update columns with filtered tasks
  useEffect(() => {
    const filtered = filteredTasks();
    const updatedColumns = columns.map(column => ({
      ...column,
      tasks: filtered.filter(task => task.status === column.status)
    }));
    setColumns(updatedColumns);
  }, [filteredTasks]);

  const handleDragStart = (start: any) => {
    const task = tasks.find(t => t.id === start.draggableId);
    setDraggedTask(task || null);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const sourceColumn = columns.find(col => col.id === source.droppableId);
    const destinationColumn = columns.find(col => col.id === destination.droppableId);

    if (!sourceColumn || !destinationColumn) return;

    const task = sourceColumn.tasks.find(t => t.id === draggableId);
    if (!task) return;

    // Remove task from source column
    const newSourceTasks = [...sourceColumn.tasks];
    newSourceTasks.splice(source.index, 1);

    // Add task to destination column
    const newDestinationTasks = [...destinationColumn.tasks];
    newDestinationTasks.splice(destination.index, 0, task);

    // Update columns
    const newColumns = columns.map(col => {
      if (col.id === source.droppableId) {
        return { ...col, tasks: newSourceTasks };
      }
      if (col.id === destination.droppableId) {
        return { ...col, tasks: newDestinationTasks };
      }
      return col;
    });

    setColumns(newColumns);

    // Update task status
    const updatedTask = { ...task, status: destinationColumn.status };
    setTasks(prev => prev.map(t => t.id === draggableId ? updatedTask : t));

    // Notify parent
    onTaskUpdate?.(draggableId, { status: destinationColumn.status });

    toast(`Task moved to ${destinationColumn.title}`);
    setDraggedTask(null);
  };

  const createNewTask = (columnId: string) => {
    setNewTaskColumn(columnId);
    setIsCreatingTask(true);
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
    return dueDate < new Date();
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
          <div className="text-gray-500">Loading project board...</div>
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
            <h2 className="text-xl font-semibold">Project Board</h2>
            <span className="text-sm text-gray-500">{tasks.length} tasks</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg ${showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {showFilters && (
            <div className="flex items-center space-x-2">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Assignees</option>
                {getUniqueAssignees().map(assignee => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="p-4 overflow-x-auto">
          <div className="flex space-x-4 min-w-max">
            {columns.map((column) => (
              <div key={column.id} className="flex-shrink-0 w-80">
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                      <h3 className="font-semibold">{column.title}</h3>
                      <span className="text-sm text-gray-500">({column.tasks.length})</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Task List */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-[400px] space-y-2 ${
                          snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''
                        }`}
                      >
                        {column.tasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                } ${draggedTask?.id === task.id ? 'opacity-50' : ''}`}
                                onClick={() => onTaskClick?.(task)}
                              >
                                {/* Task Header */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <span className="text-lg">{getTypeIcon(task.type)}</span>
                                    <h4 className="font-medium text-sm flex-1">{task.title}</h4>
                                  </div>
                                  
                                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                                </div>

                                {/* Task Description */}
                                {task.description && (
                                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}

                                {/* Task Metadata */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {/* Assignee */}
                                    {task.assignee && (
                                      <div className="flex items-center">
                                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                                          {task.assignee.avatar || task.assignee.name.charAt(0)}
                                        </div>
                                      </div>
                                    )}

                                    {/* Labels */}
                                    {task.labels.slice(0, 2).map((label, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                                      >
                                        {label}
                                      </span>
                                    ))}

                                    {task.labels.length > 2 && (
                                      <span className="text-xs text-gray-500">
                                        +{task.labels.length - 2}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    {/* Due Date */}
                                    {task.dueDate && (
                                      <div className={`flex items-center space-x-1 ${
                                        isOverdue(task.dueDate) ? 'text-red-500' : ''
                                      }`}>
                                        <Calendar className="w-3 h-3" />
                                        <span>{task.dueDate.toLocaleDateString()}</span>
                                      </div>
                                    )}

                                    {/* Comments */}
                                    {task.comments > 0 && (
                                      <div className="flex items-center space-x-1">
                                        <MessageSquare className="w-3 h-3" />
                                        <span>{task.comments}</span>
                                      </div>
                                    )}

                                    {/* Attachments */}
                                    {task.attachments > 0 && (
                                      <div className="flex items-center space-x-1">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>{task.attachments}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Progress Bar */}
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
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* Add Task Button */}
                        <button
                          onClick={() => createNewTask(column.id)}
                          className="w-full mt-2 p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center space-x-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm">Add Task</span>
                        </button>
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>

      {/* Task Creation Modal */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Column
                </label>
                <select
                  value={newTaskColumn}
                  onChange={(e) => setNewTaskColumn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {columns.map(column => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
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
