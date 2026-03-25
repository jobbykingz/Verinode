import React, { useEffect, useState } from 'react';
import { QueueManager, SyncOperation } from '../../services/offline/QueueManager';
import { useOffline } from '../../hooks/useOffline';

export const OfflineQueue: React.FC = () => {
  const [queue, setQueue] = useState<SyncOperation[]>([]);
  const { pendingItemsCount, isOnline } = useOffline();

  useEffect(() => {
    const fetchQueue = async () => {
      const items = await QueueManager.getQueue();
      setQueue(items);
    };
    fetchQueue();
  }, [pendingItemsCount]);

  if (queue.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 max-w-md w-full my-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Pending Changes</h3>
        <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
          {queue.length}
        </span>
      </div>
      <ul className="space-y-3 max-h-60 overflow-y-auto">
        {queue.map((op) => (
          <li key={op.queueId} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {op.action} {op.entity}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(op.timestamp).toLocaleString()}
              </p>
            </div>
            {op.retryCount > 0 && (
              <span className="text-xs text-red-500">Retries: {op.retryCount}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
export default OfflineQueue;