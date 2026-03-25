import React from 'react';

interface HistoryProps {
  version: number;
}

export const ChangeHistory: React.FC<HistoryProps> = ({ version }) => {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm mt-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Change History</h3>
      <p className="text-xs text-gray-500 mb-4">Current Version: v{version}</p>
      
      <ul className="space-y-3 relative border-l border-gray-200 ml-2 pl-4">
        <li className="relative">
          <div className="absolute w-2 h-2 bg-indigo-500 rounded-full -left-[21px] top-1.5"></div>
          <p className="text-sm text-gray-700 font-medium">Version {version}</p>
          <p className="text-xs text-gray-500">Latest Edits Synced</p>
        </li>
        <li className="relative opacity-60">
          <div className="absolute w-2 h-2 bg-gray-300 rounded-full -left-[21px] top-1.5"></div>
          <p className="text-sm text-gray-700 font-medium">Version {Math.max(1, version - 1)}</p>
          <p className="text-xs text-gray-500">Previous Revision</p>
        </li>
      </ul>
    </div>
  );
};
export default ChangeHistory;