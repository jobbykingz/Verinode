import React, { useState, useEffect } from 'react';
import { collabService } from '../../services/collaboration/CollaborationService';

interface CommentProps {
  proofId: string;
  currentUser: { id: string; name: string };
}

export const CommentSystem: React.FC<CommentProps> = ({ proofId, currentUser }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    // In a real app, fetch initial comments from REST API here
    collabService.onCommentAdded((comment) => {
      setComments(prev => [...prev, comment]);
    });
  }, []);

  const submitComment = () => {
    if (!newText.trim()) return;
    const payload = {
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: newText,
      createdAt: new Date().toISOString()
    };
    collabService.broadcastComment(proofId, payload);
    setComments(prev => [...prev, payload]);
    setNewText('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 border-l border-gray-200">
      <h3 className="font-semibold text-gray-800 mb-4">Comments</h3>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {comments.map((c, i) => (
          <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm">
            <div className="font-medium text-gray-900 mb-1">{c.authorName}</div>
            <p className="text-gray-700">{c.content}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <textarea value={newText} onChange={e => setNewText(e.target.value)} className="w-full text-sm border-gray-300 rounded-md p-2" placeholder="Add a comment..." rows={3} />
        <button onClick={submitComment} className="mt-2 w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700">Post Comment</button>
      </div>
    </div>
  );
};

export default CommentSystem;