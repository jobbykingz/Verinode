import axios from 'axios';
import toast from 'react-hot-toast';

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: ProjectMember[];
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  settings: ProjectSettings;
  metadata: ProjectMetadata;
  collaboration: CollaborationSettings;
  statistics: ProjectStatistics;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface ProjectSettings {
  isPublic: boolean;
  allowGuestAccess: boolean;
  requireApproval: boolean;
  maxMembers: number;
}

export interface ProjectMetadata {
  tags: string[];
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  deadline?: Date;
  budget?: number;
}

export interface CollaborationSettings {
  videoConferenceEnabled: boolean;
  screenShareEnabled: boolean;
  collaborativeEditingEnabled: boolean;
  recordingEnabled: boolean;
}

export interface ProjectStatistics {
  totalTasks: number;
  completedTasks: number;
  activeMembers: number;
  lastActivity: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignee?: string;
  reporter: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  type: 'TASK' | 'BUG' | 'FEATURE' | 'EPIC' | 'STORY';
  labels: string[];
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: string[];
  subtasks: string[];
  parentTask?: string;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  history: TaskHistoryEntry[];
  timeTracking: TaskTimeTracking;
  metadata: TaskMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  field: string;
  oldValue?: any;
  newValue?: any;
  author: string;
  timestamp: Date;
}

export interface TaskTimeTracking {
  entries: TaskTimeEntry[];
  totalSpent: number;
}

export interface TaskTimeEntry {
  id: string;
  user: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  description: string;
}

export interface TaskMetadata {
  storyPoints?: number;
  sprint?: string;
  component?: string;
  environment?: string;
  affectedVersion?: string;
  fixedVersion?: string;
}

export interface ProjectFilters {
  status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  category?: string;
  tags?: string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  owner?: string;
  member?: string;
  search?: string;
}

export interface TaskFilters {
  projectId?: string;
  assignee?: string;
  reporter?: string;
  status?: string[];
  priority?: string[];
  type?: string[];
  labels?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  search?: string;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  tasks: Task[];
  limit?: number;
}

export interface ProjectStatistics {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  averageCompletionRate: number;
  projectsByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
  recentActivity: Array<{
    projectId: string;
    projectName: string;
    activity: string;
    timestamp: Date;
    user: string;
  }>;
}

export class ProjectService {
  private apiClient: any;
  private baseURL: string;

  constructor(baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.apiClient = axios.create({
      baseURL: `${baseURL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.apiClient.interceptors.request.use(
      (config: any) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        
        const message = error.response?.data?.message || error.message || 'An error occurred';
        toast.error(message);
        
        return Promise.reject(error);
      }
    );
  }

  // Project Management
  async createProject(projectData: Partial<Project>): Promise<Project> {
    try {
      const response = await this.apiClient.post('/projects', projectData);
      toast.success('Project created successfully');
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const response = await this.apiClient.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project:', error);
      throw error;
    }
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    try {
      const response = await this.apiClient.put(`/projects/${projectId}`, updates);
      toast.success('Project updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/projects/${projectId}`);
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  async getProjects(filters: ProjectFilters = {}): Promise<Project[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.owner) params.append('owner', filters.owner);
      if (filters.member) params.append('member', filters.member);
      if (filters.search) params.append('search', filters.search);
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }

      const response = await this.apiClient.get(`/projects?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }

  async addProjectMember(projectId: string, userId: string, role: string): Promise<void> {
    try {
      await this.apiClient.post(`/projects/${projectId}/members`, { userId, role });
      toast.success('Member added successfully');
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/projects/${projectId}/members/${userId}`);
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }

  async updateProjectMember(projectId: string, userId: string, role: string): Promise<void> {
    try {
      await this.apiClient.put(`/projects/${projectId}/members/${userId}`, { role });
      toast.success('Member role updated successfully');
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  }

  // Task Management
  async createTask(taskData: Partial<Task>): Promise<Task> {
    try {
      const response = await this.apiClient.post('/tasks', taskData);
      toast.success('Task created successfully');
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getTask(taskId: string): Promise<Task> {
    try {
      const response = await this.apiClient.get(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      const response = await this.apiClient.put(`/tasks/${taskId}`, updates);
      toast.success('Task updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/tasks/${taskId}`);
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async getTasks(filters: TaskFilters = {}): Promise<Task[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.assignee) params.append('assignee', filters.assignee);
      if (filters.reporter) params.append('reporter', filters.reporter);
      if (filters.search) params.append('search', filters.search);
      
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach(status => params.append('status', status));
      }
      if (filters.priority && filters.priority.length > 0) {
        filters.priority.forEach(priority => params.append('priority', priority));
      }
      if (filters.type && filters.type.length > 0) {
        filters.type.forEach(type => params.append('type', type));
      }
      if (filters.labels && filters.labels.length > 0) {
        filters.labels.forEach(label => params.append('labels', label));
      }
      
      if (filters.dueDate?.from) {
        params.append('dueDateFrom', filters.dueDate.from.toISOString());
      }
      if (filters.dueDate?.to) {
        params.append('dueDateTo', filters.dueDate.to.toISOString());
      }

      const response = await this.apiClient.get(`/tasks?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  async bulkUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<Task[]> {
    try {
      const response = await this.apiClient.put('/tasks/bulk', { taskIds, updates });
      toast.success('Tasks updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error bulk updating tasks:', error);
      throw error;
    }
  }

  async assignTask(taskId: string, assigneeId: string): Promise<Task> {
    try {
      const response = await this.apiClient.put(`/tasks/${taskId}/assign`, { assigneeId });
      toast.success('Task assigned successfully');
      return response.data;
    } catch (error) {
      console.error('Error assigning task:', error);
      throw error;
    }
  }

  async updateTaskStatus(taskId: string, status: string): Promise<Task> {
    try {
      const response = await this.apiClient.put(`/tasks/${taskId}/status`, { status });
      toast.success('Task status updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  async addTaskComment(taskId: string, content: string): Promise<TaskComment> {
    try {
      const response = await this.apiClient.post(`/tasks/${taskId}/comments`, { content });
      toast.success('Comment added successfully');
      return response.data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  async updateTaskComment(taskId: string, commentId: string, content: string): Promise<TaskComment> {
    try {
      const response = await this.apiClient.put(`/tasks/${taskId}/comments/${commentId}`, { content });
      toast.success('Comment updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  async deleteTaskComment(taskId: string, commentId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/tasks/${taskId}/comments/${commentId}`);
      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  async addTaskAttachment(taskId: string, file: File): Promise<TaskAttachment> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await this.apiClient.post(`/tasks/${taskId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success('Attachment uploaded successfully');
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  }

  async deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
      toast.success('Attachment deleted successfully');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  }

  async startTimeTracking(taskId: string, description: string): Promise<TaskTimeEntry> {
    try {
      const response = await this.apiClient.post(`/tasks/${taskId}/time/start`, { description });
      toast.success('Time tracking started');
      return response.data;
    } catch (error) {
      console.error('Error starting time tracking:', error);
      throw error;
    }
  }

  async stopTimeTracking(taskId: string, entryId: string): Promise<TaskTimeEntry> {
    try {
      const response = await this.apiClient.post(`/tasks/${taskId}/time/stop`, { entryId });
      toast.success('Time tracking stopped');
      return response.data;
    } catch (error) {
      console.error('Error stopping time tracking:', error);
      throw error;
    }
  }

  // Kanban Board
  async getKanbanBoard(projectId: string): Promise<KanbanBoard> {
    try {
      const response = await this.apiClient.get(`/projects/${projectId}/kanban`);
      return response.data;
    } catch (error) {
      console.error('Error fetching kanban board:', error);
      throw error;
    }
  }

  async updateTaskColumn(taskId: string, columnId: string): Promise<void> {
    try {
      await this.apiClient.put(`/tasks/${taskId}/column`, { columnId });
    } catch (error) {
      console.error('Error updating task column:', error);
      throw error;
    }
  }

  // Statistics and Analytics
  async getProjectStatistics(userId?: string): Promise<ProjectStatistics> {
    try {
      const params = userId ? { userId } : {};
      const response = await this.apiClient.get('/projects/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching project statistics:', error);
      throw error;
    }
  }

  async getProjectAnalytics(projectId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/projects/${projectId}/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project analytics:', error);
      throw error;
    }
  }

  // Search and Filtering
  async searchProjects(query: string): Promise<Project[]> {
    try {
      const response = await this.apiClient.get('/projects/search', { params: { q: query } });
      return response.data;
    } catch (error) {
      console.error('Error searching projects:', error);
      throw error;
    }
  }

  async searchTasks(query: string, projectId?: string): Promise<Task[]> {
    try {
      const params: any = { q: query };
      if (projectId) params.projectId = projectId;
      
      const response = await this.apiClient.get('/tasks/search', { params });
      return response.data;
    } catch (error) {
      console.error('Error searching tasks:', error);
      throw error;
    }
  }

  // Export functionality
  async exportProjectData(projectId: string, format: 'json' | 'csv' | 'xlsx'): Promise<Blob> {
    try {
      const response = await this.apiClient.get(`/projects/${projectId}/export`, {
        params: { format },
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `project-${projectId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Project data exported successfully');
      return response.data;
    } catch (error) {
      console.error('Error exporting project data:', error);
      throw error;
    }
  }

  async exportTaskData(filters: TaskFilters = {}, format: 'json' | 'csv' | 'xlsx'): Promise<Blob> {
    try {
      const response = await this.apiClient.post('/tasks/export', { filters, format }, {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasks.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Task data exported successfully');
      return response.data;
    } catch (error) {
      console.error('Error exporting task data:', error);
      throw error;
    }
  }

  // Utility Methods
  static getInstance(baseURL?: string): ProjectService {
    return new ProjectService(baseURL);
  }
}

// Export types for external use
export type { ProjectServiceConfig };
