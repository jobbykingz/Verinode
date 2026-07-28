// Issue #31: Proof expiration alert component
import React from 'react';

export interface ExpirationAlertProps {
  daysUntilExpiry: number;
  isInGracePeriod: boolean;
  isExpired: boolean;
  onRenew: () => void;
}

export const ExpirationAlert: React.FC<ExpirationAlertProps> = ({
  daysUntilExpiry,
  isInGracePeriod,
  isExpired,
  onRenew,
}) => {
  if (isExpired && !isInGracePeriod) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-800">Proof Expired</h3>
            <p className="text-xs text-red-600 mt-1">
              Your proof is no longer valid. Renew immediately to restore verification.
            </p>
          </div>
          <button
            onClick={onRenew}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700"
          >
            Renew Now
          </button>
        </div>
      </div>
    );
  }

  if (isInGracePeriod) {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Grace Period Active</h3>
            <p className="text-xs text-yellow-600 mt-1">
              Your proof has expired but is temporarily valid. Renew before the grace period ends.
            </p>
          </div>
          <button
            onClick={onRenew}
            className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded-md hover:bg-yellow-700"
          >
            Renew Now
          </button>
        </div>
      </div>
    );
  }

  if (daysUntilExpiry <= 7) {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-800">Expiring Soon</h3>
            <p className="text-xs text-blue-600 mt-1">
              Your proof expires in {daysUntilExpiry} day(s). Renew to avoid interruption.
            </p>
          </div>
          <button
            onClick={onRenew}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700"
          >
            Renew
          </button>
        </div>
      </div>
    );
  }

  return null;
};
