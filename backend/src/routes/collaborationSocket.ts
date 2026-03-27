import { Server, Socket } from 'socket.io';
import { PresenceService } from '../services/collaboration/PresenceService';
import { CollaborationService } from '../services/collaboration/CollaborationService';

export const setupCollaborationSockets = (io: Server) => {
  const nsp = io.of('/collaboration');

  nsp.on('connection', (socket: Socket) => {
    console.log(`[Collab] User connected: ${socket.id}`);

    socket.on('join_session', async (data: { proofId: string, userId: string, username: string }) => {
      socket.join(data.proofId);
      
      PresenceService.addUser(socket.id, {
        proofId: data.proofId,
        userId: data.userId,
        username: data.username,
        status: 'active'
      });

      await CollaborationService.joinSession(data.proofId, data.userId, socket.id);

      const users = PresenceService.getSessionUsers(data.proofId);
      nsp.to(data.proofId).emit('presence_update', users);
    });

    socket.on('edit_proof', async (data: { proofId: string, diff: any, version: number }) => {
      try {
        const updatedSession = await CollaborationService.applyEdit(data.proofId, data.diff, data.version);
        // Broadcast to others in the room
        socket.to(data.proofId).emit('proof_updated', {
          diff: data.diff,
          version: updatedSession.version,
          authorSocket: socket.id
        });
      } catch (err: any) {
        socket.emit('edit_conflict', { message: err.message });
      }
    });

    socket.on('cursor_move', (data: { proofId: string, fieldId: string, position: number }) => {
      PresenceService.updateCursor(socket.id, { fieldId: data.fieldId, position: data.position });
      const users = PresenceService.getSessionUsers(data.proofId);
      socket.to(data.proofId).emit('presence_update', users);
    });

    socket.on('new_comment', (data: { proofId: string, comment: any }) => {
      nsp.to(data.proofId).emit('comment_added', data.comment);
    });

    socket.on('disconnect', async () => {
      const user = PresenceService.getSessionUsers('').find(u => u.socketId === socket.id);
      if (user) {
        PresenceService.removeUser(socket.id);
        await CollaborationService.leaveSession(socket.id);
        nsp.to(user.proofId).emit('presence_update', PresenceService.getSessionUsers(user.proofId));
      }
    });
  });
};