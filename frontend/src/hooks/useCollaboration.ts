import { useState, useEffect, useCallback } from 'react';
import { collabService } from '../services/collaboration/CollaborationService';

export const useCollaboration = (proofId: string, initialData: any) => {
  const [documentState, setDocumentState] = useState(initialData || {});
  const [version, setVersion] = useState(1);
  const [conflictMsg, setConflictMsg] = useState('');

  useEffect(() => {
    collabService.onProofUpdated((data) => {
      setDocumentState((prev: any) => ({ ...prev, ...data.diff }));
      setVersion(data.version);
    });

    collabService.onEditConflict((data) => {
      setConflictMsg(data.message);
      setTimeout(() => setConflictMsg(''), 5000);
    });
  }, []);

  const updateDocument = useCallback((diff: any) => {
    // Optimistic UI Update
    setDocumentState((prev: any) => ({ ...prev, ...diff }));
    const newVersion = version + 1;
    setVersion(newVersion);
    
    // Dispatch
    collabService.sendEdit(proofId, diff, version);
  }, [proofId, version]);

  const setCursor = useCallback((fieldId: string, position: number) => {
    collabService.sendCursor(proofId, fieldId, position);
  }, [proofId]);

  return {
    documentState, updateDocument, setCursor, conflictMsg, version
  };
};