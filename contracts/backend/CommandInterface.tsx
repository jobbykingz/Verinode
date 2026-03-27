import React, { useState } from 'react';

const CommandInterface: React.FC = () => {
    const [command, setCommand] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const handleExecute = (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;

        const newLog = `> ${command}`;
        const response = `Executed: ${command} (Mock Response)`;
        
        setLogs([...logs, newLog, response]);
        setCommand('');
    };

    return (
        <div className="bg-gray-900 text-gray-200 p-4 rounded-lg shadow-lg mt-6 font-mono text-sm">
            <div className="mb-2 text-gray-400 border-b border-gray-700 pb-2">Command Interface</div>
            <div className="h-48 overflow-y-auto mb-4 space-y-1">
                {logs.map((log, i) => (
                    <div key={i} className={log.startsWith('>') ? 'text-yellow-400' : 'text-green-400'}>
                        {log}
                    </div>
                ))}
                {logs.length === 0 && <div className="text-gray-600 italic">Ready for commands...</div>}
            </div>
            <form onSubmit={handleExecute} className="flex">
                <span className="text-yellow-400 mr-2">$</span>
                <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 w-full text-white placeholder-gray-600"
                    placeholder="verinode verify --latest"
                />
            </form>
        </div>
    );
};

export default CommandInterface;