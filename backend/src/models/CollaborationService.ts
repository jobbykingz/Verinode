import { CollaborationSession } from '../../models/CollaborationSession';
import { Comment } from '../../models/Comment';

export class CollaborationService {
  static async getOrCreateSession(proofId: string) {
    let session = await CollaborationSession.findOne({ proofId });
    if (!session) {
      session = await CollaborationSession.create({
        proofId,
        documentState: {},
        version: 1,
        activeUsers: []
      });
    }
    return session;
  }

  static async applyEdit(proofId: string, diff: any, incomingVersion: number) {
    const session = await CollaborationSession.findOne({ proofId });
    if (!session) throw new Error('Session not found');

    // Basic conflict resolution: If version is too far behind, reject.
    if (incomingVersion < session.version) {
      throw new Error('Conflict: Document has been updated by another user. Please resync.');
    }

    // Apply patch (Simplified: Direct merge for JSON state)
    session.documentState = { ...session.documentState, ...diff };
    session.version += 1;
    
    await session.save();
    return session;
  }

  static async getComments(proofId: string) {
    return await Comment.find({ proofId }).sort({ createdAt: 1 });
  }

  static async addComment(data: { proofId: string, authorId: string, authorName: string, content: string, parentId?: string }) {
    const comment = await Comment.create(data);
    return comment;
  }

  static async joinSession(proofId: string, userId: string, socketId: string, accessLevel: 'VIEW' | 'COMMENT' | 'EDIT' = 'EDIT') {
    const session = await this.getOrCreateSession(proofId);
    
    // Remove existing socket instance for user if reconnected
    session.activeUsers = session.activeUsers.filter(u => u.userId !== userId);
    
    session.activeUsers.push({ userId, socketId, accessLevel, lastActive: new Date() });
    await session.save();
    return session;
  }

  static async leaveSession(socketId: string) {
    await CollaborationSession.updateMany(
      { 'activeUsers.socketId': socketId },
      { $pull: { activeUsers: { socketId } } }
    );
  }
}