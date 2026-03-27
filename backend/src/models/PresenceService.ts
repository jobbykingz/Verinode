export interface UserPresence {
  userId: string;
  username: string;
  socketId: string;
  proofId: string;
  status: 'active' | 'idle';
  cursor?: { fieldId: string; position: number };
  lastSeen: number;
}

export class PresenceService {
  private static activePresences: Map<string, UserPresence> = new Map();

  static addUser(socketId: string, presence: Omit<UserPresence, 'socketId' | 'lastSeen'>) {
    this.activePresences.set(socketId, {
      ...presence,
      socketId,
      lastSeen: Date.now()
    });
  }

  static removeUser(socketId: string) {
    this.activePresences.delete(socketId);
  }

  static updateCursor(socketId: string, cursor: { fieldId: string; position: number }) {
    const user = this.activePresences.get(socketId);
    if (user) {
      user.cursor = cursor;
      user.status = 'active';
      user.lastSeen = Date.now();
      this.activePresences.set(socketId, user);
    }
  }

  static getSessionUsers(proofId: string): UserPresence[] {
    const users: UserPresence[] = [];
    this.activePresences.forEach(user => {
      if (user.proofId === proofId) users.push(user);
    });
    return users;
  }
}