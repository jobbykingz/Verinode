import React, { useState } from 'react';

interface ResourceQuota {
  maxUsers: number;
  maxStorage: number;
  maxProofs: number;
}

export const ResourceAllocation: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [quota, setQuota] = useState<ResourceQuota>({
    maxUsers: 10,
    maxStorage: 5,
    maxProofs: 1000
  });

  const handleUpdate = async () => {
    console.log('Updating resources for', tenantId, quota);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Resource Allocation</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Max Users</label>
          <input
            type="number"
            value={quota.maxUsers}
            onChange={(e) => setQuota({ ...quota, maxUsers: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Max Storage (GB)</label>
          <input
            type="number"
            value={quota.maxStorage}
            onChange={(e) => setQuota({ ...quota, maxStorage: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Max Proofs/Month</label>
          <input
            type="number"
            value={quota.maxProofs}
            onChange={(e) => setQuota({ ...quota, maxProofs: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <button onClick={handleUpdate} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
          Update Allocation
        </button>
      </div>
    </div>
  );
};
