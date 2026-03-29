import React, { useState } from 'react';

const DiscordBot: React.FC = () => {
    const [connected, setConnected] = useState(false);

    const handleConnect = () => {
        setConnected(true);
    };

    return (
        <div className="border p-4 rounded-lg shadow-sm bg-white mt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">Ds</div>
                    <div>
                        <h3 className="font-medium">Discord Bot</h3>
                        <p className="text-sm text-gray-500">Receive alerts and run commands</p>
                    </div>
                </div>
                <button
                    onClick={handleConnect}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                        connected 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                >
                    {connected ? 'Connected' : 'Add to Discord'}
                </button>
            </div>
        </div>
    );
};

export default DiscordBot;