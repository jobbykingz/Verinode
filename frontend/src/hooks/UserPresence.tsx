import React from 'react';
import { usePresence } from '../../hooks/usePresence';

export const UserPresence: React.FC = () => {
  const { activeUsers } = usePresence();

  if (!activeUsers || activeUsers.length === 0) return null;

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500 font-medium">Viewing:</span>
      <div className="flex -space-x-2 overflow-hidden">
        {activeUsers.map((user) => (
          <div 
            key={user.socketId} 
            className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-blue-500 text-white flex items-center justify-center text-xs font-bold"
            title={`${user.username} (${user.status})`}
          >
            {user.username.charAt(0).toUpperCase()}
            {user.status === 'active' && (
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-green-400"></span>
            )}
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-400 ml-2">
        {activeUsers.length} online
      </span>
    </div>
  );
};

export default UserPresence;