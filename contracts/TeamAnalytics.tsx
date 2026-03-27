import React from 'react';

const TeamAnalytics: React.FC = () => {
    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Team Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Total Proofs Generated</h3>
                    <p className="mt-2 text-3xl font-bold text-blue-900">1,250</p>
                    <p className="text-sm text-blue-600 mt-1">+12% from last month</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">Active Members</h3>
                    <p className="mt-2 text-3xl font-bold text-green-900">8</p>
                    <p className="text-sm text-green-600 mt-1">2 new this week</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">API Usage</h3>
                    <p className="mt-2 text-3xl font-bold text-purple-900">15.4k</p>
                    <p className="text-sm text-purple-600 mt-1">Requests this billing cycle</p>
                </div>
            </div>
            
            <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Overview</h3>
                <div className="h-64 bg-white rounded border border-gray-200 p-4 flex items-end justify-between space-x-2">
                    {[35, 45, 30, 60, 75, 50, 65, 80, 55, 40, 70, 90].map((height, i) => (
                        <div key={i} className="w-full flex flex-col items-center group">
                            <div 
                                className="w-full bg-indigo-200 group-hover:bg-indigo-400 rounded-t transition-all duration-300 relative"
                                style={{ height: `${height}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded">
                                    {height * 10}
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">W{i + 1}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TeamAnalytics;