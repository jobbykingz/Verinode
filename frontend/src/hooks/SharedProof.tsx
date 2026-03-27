import React from 'react';
import { useCollaboration } from '../../hooks/useCollaboration';
import { ChangeHistory } from './ChangeHistory';

interface SharedProofProps {
  proofId: string;
  initialData: any;
  readOnly?: boolean;
}

export const SharedProof: React.FC<SharedProofProps> = ({ proofId, initialData, readOnly }) => {
  const { documentState, updateDocument, setCursor, conflictMsg, version } = useCollaboration(proofId, initialData);

  const handleChange = (field: string, value: string) => {
    if (readOnly) return;
    updateDocument({ [field]: value });
  };

  return (
    <div className="flex flex-col h-full bg-white p-6 rounded-lg shadow">
      {conflictMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Sync Error! </strong>
          <span className="block sm:inline">{conflictMsg}</span>
        </div>
      )}
      
      <div className="mb-4 space-y-4 flex-1">
        <div>
          <label className="block text-sm font-medium text-gray-700">Proof Title</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            value={documentState.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            onFocus={() => setCursor('title', 0)}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border h-32"
            value={documentState.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            onFocus={() => setCursor('description', 0)}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
};