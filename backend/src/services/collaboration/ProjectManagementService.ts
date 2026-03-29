import { Project, IProject } from '../../models/Project';
import { Task, ITask } from '../../models/Task';
import { CollaborationSession } from '../../models/CollaborationSession';
import mongoose from 'mongoose';

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

export interface KanbanBoard {
  columns: Array<{
    id: string;
    title: string;
    status: string;
    tasks: ITask[];
    limit?: number;
  }>;
}

export class ProjectManagementService {
  // Project Management
  static async createProject(projectData: Partial<IProject>): Promise<IProject> {
    const project = new Project(projectData);
    await project.save();
    
    // Add owner as member with OWNER role
    await project.addMember(project.owner.toString(), 'OWNER');
    
    // Create collaboration session for the project
    await CollaborationSession.create({
      proofId: `project_${project._id}`,
      documentState: { projectInfo: project.toObject() },
      version: 1,
      activeUsers: []
    });

    return project;
  }

  static async getProject(projectId: string, userId?: string): Promise<IProject | null> {
    const project = await Project.findById(projectId)
      .populate('members.userId', 'name email avatar')
      .populate('owner', 'name email avatar');

    if (!project) return null;

    // Check access permissions if userId provided
    if (userId && !project.isMember(userId) && project.settings.isPublic === false) {
      throw new Error('Access denied to this project');
    }

    return project;
  }

  static async updateProject(projectId: string, updates: Partial<IProject>, userId: string): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new Error('Insufficient permissions to update project');
    }

    Object.assign(project, updates);
    await project.save();
    
    // Update collaboration session
    const session = await CollaborationSession.findOne({ proofId: `project_${projectId}` });
    if (session) {
      session.documentState.projectInfo = project.toObject();
      session.version += 1;
      await session.save();
    }

    return project;
  }

  static async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    if (project.owner.toString() !== userId) {
      throw new Error('Only project owner can delete the project');
    }

    // Soft delete
    project.status = 'DELETED';
    await project.save();

    // Delete all associated tasks
    await Task.updateMany(
      { projectId },
      { status: 'CANCELLED' }
    );
  }

  static async getProjects(filters: ProjectFilters, userId?: string): Promise<IProject[]> {
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.category) query['metadata.category'] = filters.category;
    if (filters.priority) query['metadata.priority'] = filters.priority;
    if (filters.owner) query.owner = filters.owner;
    if (filters.tags && filters.tags.length > 0) {
      query['metadata.tags'] = { $in: filters.tags };
    }
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // If userId provided, filter by projects user has access to
    if (userId) {
      query.$or = [
        { owner: userId },
        { 'members.userId': userId },
        { 'settings.isPublic': true }
      ];
    }

    return await Project.find(query)
      .populate('owner', 'name email avatar')
      .populate('members.userId', 'name email avatar')
      .sort({ updatedAt: -1 });
  }

  static async addProjectMember(projectId: string, userId: string, role: string, requesterId: string): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const requesterRole = project.getUserRole(requesterId);
    if (!requesterRole || !['OWNER', 'ADMIN'].includes(requesterRole)) {
      throw new Error('Insufficient permissions to add members');
    }

    await project.addMember(userId, role);
  }

  static async removeProjectMember(projectId: string, userId: string, requesterId: string): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const requesterRole = project.getUserRole(requesterId);
    const targetRole = project.getUserRole(userId);

    // Can't remove owner, and only owner/admin can remove members
    if (targetRole === 'OWNER') {
      throw new Error('Cannot remove project owner');
    }

    if (!requesterRole || !['OWNER', 'ADMIN'].includes(requesterRole)) {
      throw new Error('Insufficient permissions to remove members');
    }

    await project.removeMember(userId);
  }

  // Task Management
  static async createTask(taskData: Partial<ITask>, userId: string): Promise<ITask> {
    // Verify user has access to the project
    const project = await Project.findById(taskData.projectId);
    if (!project) throw new Error('Project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new Error('Insufficient permissions to create tasks');
    }

    const task = new Task(taskData);
    await task.save();

    // Update project statistics
    await project.updateStatistics();

    return task;
  }

  static async getTask(taskId: string, userId?: string): Promise<ITask | null> {
    const task = await Task.findById(taskId)
      .populate('projectId', 'name owner members')
      .populate('assignee', 'name email avatar')
      .populate('reporter', 'name email avatar');

    if (!task) return null;

    // Check access permissions if userId provided
    if (userId) {
      const project = await Project.findById(task.projectId);
      if (project && !project.isMember(userId) && project.settings.isPublic === false) {
        throw new Error('Access denied to this task');
      }
    }

    return task;
  }

  static async updateTask(taskId: string, updates: Partial<ITask>, userId: string): Promise<ITask> {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    const project = await Project.findById(task.projectId);
    if (!project) throw new Error('Associated project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new Error('Insufficient permissions to update tasks');
    }

    // Track changes for history
    const oldValues: any = {};
    const newValues: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (task[key] !== value) {
        oldValues[key] = task[key];
        newValues[key] = value;
        task[key] = value;
      }
    }

    await task.save();

    // Add history entries for tracked changes
    for (const field of Object.keys(oldValues)) {
      await task.addHistory('FIELD_UPDATED', field, oldValues[field], newValues[field], userId);
    }

    // Update project statistics
    await project.updateStatistics();

    return task;
  }

  static async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    const project = await Project.findById(task.projectId);
    if (!project) throw new Error('Associated project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new Error('Insufficient permissions to delete tasks');
    }

    await Task.findByIdAndDelete(taskId);
    await project.updateStatistics();
  }

  static async getTasks(filters: TaskFilters, userId?: string): Promise<ITask[]> {
    const query: any = {};

    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.assignee) query.assignee = filters.assignee;
    if (filters.reporter) query.reporter = filters.reporter;
    if (filters.status && filters.status.length > 0) query.status = { $in: filters.status };
    if (filters.priority && filters.priority.length > 0) query.priority = { $in: filters.priority };
    if (filters.type && filters.type.length > 0) query.type = { $in: filters.type };
    if (filters.labels && filters.labels.length > 0) query.labels = { $in: filters.labels };
    
    if (filters.dueDate) {
      query.dueDate = {};
      if (filters.dueDate.from) query.dueDate.$gte = filters.dueDate.from;
      if (filters.dueDate.to) query.dueDate.$lte = filters.dueDate.to;
    }

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // If userId provided, filter by tasks user has access to
    if (userId) {
      const userProjects = await Project.find({
        $or: [
          { owner: userId },
          { 'members.userId': userId },
          { 'settings.isPublic': true }
        ]
      }).select('_id');

      query.projectId = { $in: userProjects.map(p => p._id) };
    }

    return await Task.find(query)
      .populate('assignee', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .sort({ createdAt: -1 });
  }

  // Kanban Board
  static async getKanbanBoard(projectId: string, userId: string): Promise<KanbanBoard> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole) {
      throw new Error('Access denied to this project');
    }

    const tasks = await Task.find({ projectId })
      .populate('assignee', 'name email avatar')
      .populate('reporter', 'name email avatar')
      .sort({ createdAt: -1 });

    const columns = [
      { id: 'todo', title: 'To Do', status: 'TODO', tasks: [], limit: null },
      { id: 'inprogress', title: 'In Progress', status: 'IN_PROGRESS', tasks: [], limit: null },
      { id: 'inreview', title: 'In Review', status: 'IN_REVIEW', tasks: [], limit: null },
      { id: 'completed', title: 'Completed', status: 'COMPLETED', tasks: [], limit: null }
    ];

    // Group tasks by status
    tasks.forEach(task => {
      const column = columns.find(col => col.status === task.status);
      if (column) {
        column.tasks.push(task);
      }
    });

    return { columns };
  }

  static async updateTaskStatus(taskId: string, newStatus: string, userId: string): Promise<ITask> {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    const project = await Project.findById(task.projectId);
    if (!project) throw new Error('Associated project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new Error('Insufficient permissions to update task status');
    }

    const oldStatus = task.status;
    task.status = newStatus as any;
    
    // Auto-update progress based on status
    if (newStatus === 'COMPLETED') {
      task.progress = 100;
    } else if (newStatus === 'TODO') {
      task.progress = 0;
    } else if (newStatus === 'IN_PROGRESS' && task.progress === 0) {
      task.progress = 25;
    }

    await task.save();
    await task.addHistory('STATUS_CHANGED', 'status', oldStatus, newStatus, userId);
    await project.updateStatistics();

    return task;
  }

  // Statistics and Analytics
  static async getProjectStatistics(userId?: string): Promise<ProjectStatistics> {
    const projectQuery = userId ? {
      $or: [
        { owner: userId },
        { 'members.userId': userId }
      ]
    } : {};

    const projects = await Project.find(projectQuery);
    const projectIds = projects.map(p => p._id);

    const tasks = await Task.find({ projectId: { $in: projectIds } });

    const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
    const archivedProjects = projects.filter(p => p.status === 'ARCHIVED').length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdueTasks = tasks.filter(t => t.isOverdue).length;

    const projectsByPriority = projects.reduce((acc, project) => {
      const priority = project.metadata.priority || 'MEDIUM';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tasksByStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalMembers = projects.reduce((total, project) => total + project.members.length, 0);
    const averageCompletionRate = projects.length > 0 
      ? projects.reduce((sum, project) => sum + project.completionPercentage, 0) / projects.length 
      : 0;

    // Get recent activity (simplified - in production, this would use a proper activity log)
    const recentActivity = await Task.find({ projectId: { $in: projectIds } })
      .populate('projectId', 'name')
      .sort({ updatedAt: -1 })
      .limit(10)
      .then(tasks => tasks.map(task => ({
        projectId: task.projectId._id.toString(),
        projectName: (task.projectId as any).name,
        activity: `Task "${task.title}" updated`,
        timestamp: task.updatedAt,
        user: task.assignee?.toString() || task.reporter.toString()
      })));

    return {
      totalProjects: projects.length,
      activeProjects,
      archivedProjects,
      totalTasks: tasks.length,
      completedTasks,
      overdueTasks,
      totalMembers,
      averageCompletionRate,
      projectsByPriority,
      tasksByStatus,
      recentActivity
    };
  }

  // Bulk Operations
  static async bulkUpdateTasks(taskIds: string[], updates: Partial<ITask>, userId: string): Promise<ITask[]> {
    // Verify permissions for all tasks
    const tasks = await Task.find({ _id: { $in: taskIds } });
    
    for (const task of tasks) {
      const project = await Project.findById(task.projectId);
      if (!project) throw new Error(`Associated project not found for task ${task._id}`);

      const userRole = project.getUserRole(userId);
      if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
        throw new Error(`Insufficient permissions to update task ${task._id}`);
      }
    }

    const updatedTasks = await Task.updateMany(
      { _id: { $in: taskIds } },
      updates,
      { new: true }
    );

    // Update project statistics for affected projects
    const affectedProjectIds = [...new Set(tasks.map(t => t.projectId.toString()))];
    for (const projectId of affectedProjectIds) {
      const project = await Project.findById(projectId);
      if (project) {
        await project.updateStatistics();
      }
    }

    return await Task.find({ _id: { $in: taskIds } });
  }

  static async assignTask(taskId: string, assigneeId: string, userId: string): Promise<ITask> {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    const project = await Project.findById(task.projectId);
    if (!project) throw new Error('Associated project not found');

    const userRole = project.getUserRole(userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new Error('Insufficient permissions to assign tasks');
    }

    // Verify assignee is project member
    if (!project.isMember(assigneeId)) {
      throw new Error('Assignee must be a project member');
    }

    const oldAssignee = task.assignee;
    task.assignee = assigneeId;
    await task.save();
    await task.addHistory('ASSIGNMENT_CHANGED', 'assignee', oldAssignee, assigneeId, userId);

    return task;
  }
}
