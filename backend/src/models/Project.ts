import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description: string;
  owner: string;
  members: {
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    joinedAt: Date;
  }[];
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  settings: {
    isPublic: boolean;
    allowGuestAccess: boolean;
    requireApproval: boolean;
    maxMembers: number;
  };
  metadata: {
    tags: string[];
    category: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    deadline?: Date;
    budget?: number;
  };
  collaboration: {
    videoConferenceEnabled: boolean;
    screenShareEnabled: boolean;
    collaborativeEditingEnabled: boolean;
    recordingEnabled: boolean;
  };
  statistics: {
    totalTasks: number;
    completedTasks: number;
    activeMembers: number;
    lastActivity: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  owner: { type: String, required: true, ref: 'User', index: true },
  members: [{
    userId: { type: String, required: true, ref: 'User' },
    role: { 
      type: String, 
      enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'], 
      default: 'MEMBER',
      required: true 
    },
    joinedAt: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['ACTIVE', 'ARCHIVED', 'DELETED'], 
    default: 'ACTIVE',
    index: true 
  },
  settings: {
    isPublic: { type: Boolean, default: false },
    allowGuestAccess: { type: Boolean, default: false },
    requireApproval: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 50, min: 1, max: 1000 }
  },
  metadata: {
    tags: [{ type: String, trim: true, maxlength: 50 }],
    category: { type: String, trim: true, maxlength: 50 },
    priority: { 
      type: String, 
      enum: ['LOW', 'MEDIUM', 'HIGH'], 
      default: 'MEDIUM' 
    },
    deadline: { type: Date },
    budget: { type: Number, min: 0 }
  },
  collaboration: {
    videoConferenceEnabled: { type: Boolean, default: true },
    screenShareEnabled: { type: Boolean, default: true },
    collaborativeEditingEnabled: { type: Boolean, default: true },
    recordingEnabled: { type: Boolean, default: false }
  },
  statistics: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
ProjectSchema.index({ owner: 1, status: 1 });
ProjectSchema.index({ 'members.userId': 1 });
ProjectSchema.index({ 'metadata.tags': 1 });
ProjectSchema.index({ 'metadata.category': 1 });
ProjectSchema.index({ createdAt: -1 });

// Virtual for completion percentage
ProjectSchema.virtual('completionPercentage').get(function() {
  if (this.statistics.totalTasks === 0) return 0;
  return Math.round((this.statistics.completedTasks / this.statistics.totalTasks) * 100);
});

// Virtual for active member count
ProjectSchema.virtual('activeMemberCount').get(function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.members.filter((member: any) => 
    member.joinedAt > thirtyDaysAgo || member.role === 'OWNER'
  ).length;
});

// Method to check if user is member
ProjectSchema.methods.isMember = function(userId: string): boolean {
  return this.members.some((member: any) => member.userId === userId);
};

// Method to get user role
ProjectSchema.methods.getUserRole = function(userId: string): string | null {
  const member = this.members.find((member: any) => member.userId === userId);
  return member ? member.role : null;
};

// Method to add member
ProjectSchema.methods.addMember = function(userId: string, role: string = 'MEMBER') {
  if (!this.isMember(userId)) {
    this.members.push({ userId, role, joinedAt: new Date() });
    this.statistics.activeMembers += 1;
  }
  return this.save();
};

// Method to remove member
ProjectSchema.methods.removeMember = function(userId: string) {
  this.members = this.members.filter((member: any) => member.userId !== userId);
  this.statistics.activeMembers = Math.max(0, this.statistics.activeMembers - 1);
  return this.save();
};

// Method to update statistics
ProjectSchema.methods.updateStatistics = async function() {
  const Task = mongoose.model('Task');
  const stats = await Task.aggregate([
    { $match: { projectId: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.statistics.totalTasks = stats[0].total;
    this.statistics.completedTasks = stats[0].completed;
  }
  
  this.statistics.lastActivity = new Date();
  return this.save();
};

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
export default Project;
