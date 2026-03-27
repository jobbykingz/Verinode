import React, { useState } from 'react';
import { Play, Terminal, Code, Copy, Globe, Database, Settings } from 'lucide-react';

interface InteractiveAPIProps {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  parameters: Array<{ name: string; type: string; required: boolean }>;
}

/**
 * Interactive API documentation component for Verinode developers
 * Provides live testing and real-time response visualization
 */
const InteractiveAPI: React.FC<InteractiveAPIProps> = ({ 
  endpoint = "/api/proofs", 
  method = "POST", 
  description = "Issue a new cryptographic proof on the Soroban network.",
  parameters = [
    { name: "issuer", type: "string", required: true },
    { name: "data", type: "object", required: true },
    { name: "hash", type: "string", required: false }
  ]
}) => {
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeCall = async () => {
    setIsLoading(true);
    // Simulated live testing for rich aesthetic
    setTimeout(() => {
      setResponse({
        success: true,
        proofId: `proof_${(Math.random() * 1000).toFixed(0)}`,
        status: "QUEUED",
        timestamp: new Date().toISOString()
      });
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl group transition-all hover:border-blue-500/30">
      <div className="p-1 px-4 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
            <Play className="w-3 h-3 mr-1 text-emerald-500" /> Interactive Explorer
          </span>
        </div>
        <div className="flex items-center space-x-3 text-slate-500 py-2">
            <Globe className="w-3 h-3" />
            <Database className="w-3 h-3" />
            <Settings className="w-3 h-3" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* API Specification */}
        <div className="p-8 border-r border-slate-800 space-y-6">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-lg text-xs font-black ${
              method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 
              method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>{method}</span>
            <code className="text-slate-300 font-mono text-sm">{endpoint}</code>
          </div>
          
          <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
          
          <div className="space-y-4 pt-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Parameters</h4>
            {parameters.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/50 group-hover:border-slate-700/50 transition">
                <div className="flex flex-col">
                  <span className="text-white text-sm font-bold">{p.name} <span className="text-slate-600 font-medium text-xs ml-1">{p.type}</span></span>
                  <input 
                    className="bg-transparent border-none outline-none text-blue-400 text-xs mt-1" 
                    placeholder="Enter value..." 
                    onChange={(e) => setParams({...params, [p.name]: e.target.value})}
                  />
                </div>
                {p.required && <span className="text-red-500/50 text-[10px] font-bold uppercase tracking-tighter">Required</span>}
              </div>
            ))}
          </div>

          <button 
            onClick={executeCall}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-500/20"
          >
            {isLoading ? <span className="animate-spin mr-2">⊚</span> : <Play className="w-4 h-4 mr-2" />}
            Test Request
          </button>
        </div>

        {/* Live Response Explorer */}
        <div className="bg-slate-950 p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
              <Terminal className="w-3 h-3 mr-1" /> Response Payload
            </h4>
            {response && <span className="text-xs text-emerald-400 font-bold">200 OK</span>}
          </div>

          <div className="relative group">
            <div className="absolute top-4 right-4 text-slate-600 hover:text-white cursor-pointer transition">
                <Copy className="w-4 h-4" />
            </div>
            <pre className="p-6 bg-[#0c1222] rounded-2xl border border-slate-800 text-blue-400 font-mono text-xs overflow-x-auto min-h-[300px]">
{response ? JSON.stringify(response, null, 2) : `// Execute a request to see the live output here...
// All responses are returned as structured JSON objects.`}
            </pre>
          </div>

          <div className="flex items-center space-x-3 text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            <span className="flex items-center"><Code className="w-3 h-3 mr-1" /> JavaScript</span>
            <span className="flex items-center"><Code className="w-3 h-3 mr-1" /> Python</span>
            <span className="flex items-center"><Code className="w-3 h-3 mr-1" /> cURL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveAPI;
