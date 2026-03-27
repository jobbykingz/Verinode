import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
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
  progress: number; // 0-100
  dependencies: string[]; // Task IDs
  subtasks: string[]; // Task IDs
  parentTask?: string;
  attachments: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedBy: string;
    uploadedAt: Date;
  }[];
  comments: {
    id: string;
    author: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    isEdited: boolean;
  }[];
  history: {
    id: string;
    action: string;
    field: string;
    oldValue?: any;
    newValue?: any;
    author: string;
    timestamp: Date;
  }[];
  timeTracking: {
    entries: {
      id: string;
      user: string;
      startTime: Date;
      endTime?: Date;
      duration?: number;
      description: string;
    }[];
    totalSpent: number;
  };
  metadata: {
    storyPoints?: number;
    sprint?: string;
    component?: string;
    environment?: string;
    affectedVersion?: string;
    fixedVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project', index: true },
  assignee: { type: String, ref: 'User', index: true },
  reporter: { type: String, required: true, ref: 'User', index: true },
  status: { 
    type: String, 
    enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'], 
    default: 'TODO',
    index: true 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    default: 'MEDIUM',
    index: true 
  },
  type: { 
    type: String, 
    enum: ['TASK', 'BUG', 'FEATURE', 'EPIC', 'STORY'], 
    default: 'TASK' 
  },
  labels: [{ type: String, trim: true, maxlength: 50 }],
  dueDate: { type: Date, index: true },
  estimatedHours: { type: Number, min: 0, max: 1000 },
  actualHours: { type: Number, min: 0, default: 0 },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  subtasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  parentTask: { type: Schema.Types.ObjectId, ref: 'Task', index: true },
  attachments: [{
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 255 },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: String, required: true, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  comments: [{
    id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    author: { type: String, required: true, ref: 'User' },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isEdited: { type: Boolean, default: false }
  }],
  history: [{
    id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
    action: { type: String, required: true, maxlength: 100 },
    field: { type: String, required: true, maxlength: 50 },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    author: { type: String, required: true, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  timeTracking: {
    entries: [{
      id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
      user: { type: String, required: true, ref: 'User' },
      startTime: { type: Date, required: true },
      endTime: { type: Date },
      duration: { type: Number, min: 0 },
      description: { type: String, trim: true, maxlength: 500 }
    }],
    totalSpent: { type: Number, default: 0, min: 0 }
  },
  metadata: {
    storyPoints: { type: Number, min: 1, max: 100 },
    sprint: { type: String, trim: true, maxlength: 50 },
    component: { type: String, trim: true, maxlength: 100 },
    environment: { type: String, trim: true, maxlength: 50 },
    affectedVersion: { type: String, trim: true, maxlength: 50 },
    fixedVersion: { type: String, trim: true, maxlength: 50 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
TaskSchema.index({ projectId: 1, status: 1 });
TaskSchema.index({ assignee: 1, status: 1 });
TaskSchema.index({ reporter: 1, createdAt: -1 });
TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ labels: 1 });
TaskSchema.index({ type: 1, priority: 1 });

// Virtual for overdue status
TaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return this.dueDate < new Date() && this.status !== 'COMPLETED';
});

// Virtual for completion status based on progress
TaskSchema.virtual('isCompleted').get(function() {
  return this.status === 'COMPLETED' || this.progress === 100;
});

// Virtual for time tracking summary
TaskSchema.virtual('timeTrackingSummary').get(function() {
  return {
    totalEntries: this.timeTracking.entries.length,
    totalHours: this.timeTracking.totalSpent,
    estimatedVsActual: {
      estimated: this.estimatedHours || 0,
      actual: this.actualHours || 0,
      difference: (this.actualHours || 0) - (this.estimatedHours || 0)
    }
  };
});

// Method to add comment
TaskSchema.methods.addComment = function(author: string, content: string) {
  const comment = {
    id: new mongoose.Types.ObjectId().toString(),
    author,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false
  };
  this.comments.push(comment);
  return this.save();
};

// Method to update comment
TaskSchema.methods.updateComment = function(commentId: string, content: string) {
  const comment = this.comments.find((c: any) => c.id === commentId);
  if (comment) {
    comment.content = content;
    comment.updatedAt = new Date();
    comment.isEdited = true;
  }
  return this.save();
};

// Method to delete comment
TaskSchema.methods.deleteComment = function(commentId: string) {
  this.comments = this.comments.filter((c: any) => c.id !== commentId);
  return this.save();
};

// Method to add history entry
TaskSchema.methods.addHistory = function(action: string, field: string, oldValue: any, newValue: any, author: string) {
  const historyEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    action,
    field,
    oldValue,
    newValue,
    author,
    timestamp: new Date()
  };
  this.history.push(historyEntry);
  return this.save();
};

// Method to start time tracking
TaskSchema.methods.startTimeTracking = function(user: string, description: string) {
  // Check if user has an active entry
  const activeEntry = this.timeTracking.entries.find((entry: any) => 
    entry.user === user && !entry.endTime
  );
  
  if (activeEntry) {
    throw new Error('User already has an active time tracking entry');
  }
  
  const newEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    user,
    startTime: new Date(),
    description
  };
  
  this.timeTracking.entries.push(newEntry);
  return this.save();
};

// Method to stop time tracking
TaskSchema.methods.stopTimeTracking = function(user: string) {
  const activeEntry = this.timeTracking.entries.find((entry: any) => 
    entry.user === user && !entry.endTime
  );
  
  if (!activeEntry) {
    throw new Error('No active time tracking entry found for user');
  }
  
  activeEntry.endTime = new Date();
  activeEntry.duration = activeEntry.endTime.getTime() - activeEntry.startTime.getTime();
  
  // Update total spent time
  this.timeTracking.totalSpent += activeEntry.duration / (1000 * 60 * 60); // Convert to hours
  
  return this.save();
};

// Method to update progress
TaskSchema.methods.updateProgress = function(progress: number) {
  const oldProgress = this.progress;
  this.progress = Math.max(0, Math.min(100, progress));
  
  // Auto-update status based on progress
  if (this.progress === 100 && this.status !== 'COMPLETED') {
    this.status = 'COMPLETED';
  } else if (this.progress > 0 && this.progress < 100 && this.status === 'TODO') {
    this.status = 'IN_PROGRESS';
  }
  
  return this.addHistory('PROGRESS_UPDATED', 'progress', oldProgress, this.progress, this.reporter);
};

// Pre-save middleware to update project statistics
TaskSchema.pre('save', async function() {
  if (this.isModified('status') || this.isNew) {
    const Project = mongoose.model('Project');
    await Project.findByIdAndUpdate(this.projectId, { 
      $inc: { 
        'statistics.totalTasks': this.isNew ? 1 : 0,
        'statistics.completedTasks': (this.status === 'COMPLETED' && !this.isNew) ? 1 : 0
      },
      'statistics.lastActivity': new Date()
    });
  }
});

export const Task = mongoose.model<ITask>('Task', TaskSchema);
export default Task;
