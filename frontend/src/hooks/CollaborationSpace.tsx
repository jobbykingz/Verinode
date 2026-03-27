import React, { useEffect } from 'react';
import { collabService } from '../../services/collaboration/CollaborationService';
import { SharedProof } from './SharedProof';
import { CommentSystem } from './CommentSystem';
import { UserPresence } from './UserPresence';
import { ChangeHistory } from './ChangeHistory';
import { useCollaboration } from '../../hooks/useCollaboration';

export const CollaborationSpace: React.FC<{ proofId: string, currentUser: any }> = ({ proofId, currentUser }) => {
  
  useEffect(() => {
    // Connect to WebSocket on mount
    collabService.connect(proofId, currentUser.id, currentUser.name);
    
    return () => {
      collabService.disconnect();
    };
  }, [proofId, currentUser]);

  const { version } = useCollaboration(proofId, { title: '', description: '' });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 overflow-hidden">
      {/* Main Editor Area */}
      <div className="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Proof Editor</h1>
          <UserPresence />
        </div>
        <SharedProof proofId={proofId} initialData={{}} />
      </div>

      {/* Right Sidebar (Comments & History) */}
      <div className="w-full md:w-80 flex flex-col bg-white border-l border-gray-200">
        <div className="flex-1 overflow-hidden"><CommentSystem proofId={proofId} currentUser={currentUser} /></div>
        <div className="p-4 border-t border-gray-200 bg-gray-50"><ChangeHistory version={version} /></div>
      </div>
    </div>
  );
};
export default CollaborationSpace;