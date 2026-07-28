// Issue #31: Bulk renewal component
import React, { useState } from 'react';

export interface BulkRenewalProps {
  onBulkRenew: (proofIds: string[], durationDays: number) => Promise<void>;
}

export const BulkRenewal: React.FC<BulkRenewalProps> = ({ onBulkRenew }) => {
  const [proofIds, setProofIds] = useState('');
  const [durationDays, setDurationDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    const ids = proofIds.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) return;

    setLoading(true);
    setResult(null);
    try {
      await onBulkRenew(ids, durationDays);
      setResult(`Successfully renewed ${ids.length} proof(s).`);
      setProofIds('');
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Bulk Renewal</h3>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Proof IDs (comma-separated)</label>
        <textarea
          value={proofIds}
          onChange={(e) => setProofIds(e.target.value)}
          rows={3}
          placeholder="proof-1, proof-2, proof-3"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Duration (days)</label>
        <input
          type="number"
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={loading || !proofIds.trim()}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
      >
        {loading ? 'Renewing...' : 'Renew All'}
      </button>
      {result && (
        <p className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </p>
      )}
    </div>
  );
};
