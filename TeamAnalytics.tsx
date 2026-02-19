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
                <div className="h-64 bg-gray-50 rounded flex items-center justify-center border border-dashed border-gray-300">
                    <span className="text-gray-500">Chart Visualization Placeholder</span>
                </div>
            </div>
        </div>
    );
};

export default TeamAnalytics;