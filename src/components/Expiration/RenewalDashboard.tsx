// Issue #31: Renewal dashboard component
import React, { useState, useEffect } from 'react';

export interface ExpirationAnalytics {
  totalProofs: number;
  activeProofs: number;
  expiringSoon: number;
  inGracePeriod: number;
  expired: number;
  renewedThisMonth: number;
}

export interface RenewalDashboardProps {
  analytics: ExpirationAnalytics;
  onBulkRenew: (proofIds: string[]) => void;
}

export const RenewalDashboard: React.FC<RenewalDashboardProps> = ({
  analytics,
  onBulkRenew,
}) => {
  const [selectedProofs, setSelectedProofs] = useState<string[]>([]);

  const stats = [
    { label: 'Total Proofs', value: analytics.totalProofs, color: 'text-gray-900' },
    { label: 'Active', value: analytics.activeProofs, color: 'text-green-600' },
    { label: 'Expiring Soon', value: analytics.expiringSoon, color: 'text-blue-600' },
    { label: 'Grace Period', value: analytics.inGracePeriod, color: 'text-yellow-600' },
    { label: 'Expired', value: analytics.expired, color: 'text-red-600' },
    { label: 'Renewed (30d)', value: analytics.renewedThisMonth, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Expiration & Renewal Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {analytics.expiringSoon + analytics.inGracePeriod + analytics.expired > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Proofs Needing Attention</h3>
            <button
              onClick={() => onBulkRenew(selectedProofs)}
              disabled={selectedProofs.length === 0}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-300"
            >
              Renew Selected ({selectedProofs.length})
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Select proofs above to add them to the bulk renewal queue.
          </p>
        </div>
      )}
    </div>
  );
};
