import React, { useState } from 'react';

const SlackBot: React.FC = () => {
    const [connected, setConnected] = useState(false);

    const handleConnect = () => {
        setConnected(true);
    };

    return (
        <div className="border p-4 rounded-lg shadow-sm bg-white mt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">Sl</div>
                    <div>
                        <h3 className="font-medium">Slack Bot</h3>
                        <p className="text-sm text-gray-500">Get notifications in your channels</p>
                    </div>
                </div>
                <button
                    onClick={handleConnect}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                        connected 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                >
                    {connected ? 'Connected' : 'Add to Slack'}
                </button>
            </div>
        </div>
    );
};

export default SlackBot;