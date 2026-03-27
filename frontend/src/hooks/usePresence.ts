import { useState, useEffect } from 'react';
import { collabService } from '../services/collaboration/CollaborationService';

export interface UserPresence {
  userId: string;
  username: string;
  socketId: string;
  status: string;
  cursor?: { fieldId: string; position: number };
}

export const usePresence = () => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    collabService.onPresenceUpdate((users) => {
      setActiveUsers(users);
    });
  }, []);

  return { activeUsers };
};