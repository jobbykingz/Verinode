import { io, Socket } from 'socket.io-client';

class CollaborationClientService {
  private socket: Socket | null = null;
  private apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  connect(proofId: string, userId: string, username: string) {
    this.socket = io(`${this.apiUrl}/collaboration`);
    
    this.socket.on('connect', () => {
      this.socket?.emit('join_session', { proofId, userId, username });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendEdit(proofId: string, diff: any, version: number) {
    this.socket?.emit('edit_proof', { proofId, diff, version });
  }

  sendCursor(proofId: string, fieldId: string, position: number) {
    this.socket?.emit('cursor_move', { proofId, fieldId, position });
  }

  onPresenceUpdate(callback: (users: any[]) => void) {
    this.socket?.on('presence_update', callback);
  }

  onProofUpdated(callback: (data: { diff: any, version: number, authorSocket: string }) => void) {
    this.socket?.on('proof_updated', callback);
  }

  onEditConflict(callback: (data: { message: string }) => void) {
    this.socket?.on('edit_conflict', callback);
  }
  
  onCommentAdded(callback: (comment: any) => void) {
    this.socket?.on('comment_added', callback);
  }

  broadcastComment(proofId: string, comment: any) {
    this.socket?.emit('new_comment', { proofId, comment });
  }
}

export const collabService = new CollaborationClientService();
export default collabService;