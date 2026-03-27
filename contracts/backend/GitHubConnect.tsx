import React, { useState } from 'react';

const GitHubConnect: React.FC = () => {
    const [connected, setConnected] = useState(false);

    const handleConnect = async () => {
        // In a real app, this would redirect to the backend generated URL
        // const response = await fetch('/api/integrations/auth-url/github');
        // const { url } = await response.json();
        // window.location.href = url;
        
        // Mocking connection for UI
        setConnected(true);
    };

    return (
        <div className="border p-4 rounded-lg shadow-sm bg-white">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">GH</div>
                    <div>
                        <h3 className="font-medium">GitHub</h3>
                        <p className="text-sm text-gray-500">Verify commits automatically</p>
                    </div>
                </div>
                <button
                    onClick={handleConnect}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                        connected 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                >
                    {connected ? 'Connected' : 'Connect GitHub'}
                </button>
            </div>
        </div>
    );
};

export default GitHubConnect;