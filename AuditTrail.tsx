import React from 'react';

const AuditTrail: React.FC = () => {
    const logs = [
        { id: 1, action: 'User Added', actor: 'Alice Johnson', target: 'Bob Smith', timestamp: '2023-10-25 10:30 AM' },
        { id: 2, action: 'Role Updated', actor: 'Alice Johnson', target: 'Bob Smith (Editor)', timestamp: '2023-10-25 10:35 AM' },
        { id: 3, action: 'Bulk Verify', actor: 'Bob Smith', target: '5 items', timestamp: '2023-10-26 02:15 PM' },
    ];

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Enterprise Audit Log</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.timestamp}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.action}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.actor}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.target}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditTrail;