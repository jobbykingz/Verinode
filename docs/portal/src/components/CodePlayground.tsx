import React, { useState } from 'react';
import { Play, RotateCcw, Share2, Terminal, HardDrive, Cpu, Settings, Copy, Info } from 'lucide-react';

/**
 * CodePlayground for Verinode developers
 * Provides a sandbox environment to test SDK functions in real-time
 */
const CodePlayground: React.FC = () => {
  const [code, setCode] = useState<string>(`// Verinode Sandbox Protocol v1.0
// Testing a basic proof verification flow

async function testProofFlow() {
  const proofId = await sdk.issue('My First Data Proof');
  const record = await sdk.get(proofId);
  
  if (record.verified) {
    console.log('Success: Protocol Verified!');
  }
}
  `);

  const [output, setOutput] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runCode = () => {
    setIsLoading(true);
    // Simulated live sandbox execution
    setTimeout(() => {
      setOutput([
        `[${new Date().toLocaleTimeString()}] > Initializing Stellar SDK Session...`,
        `[${new Date().toLocaleTimeString()}] > Connected to Soroban Mainnet.`,
        `[${new Date().toLocaleTimeString()}] > Issuing cryptographic proof...`,
        `[${new Date().toLocaleTimeString()}] > Proof Created: proof_74281 (0.8s)`,
        `[${new Date().toLocaleTimeString()}] > Status: Success - Protocol Verified!`
      ]);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl group transition-all hover:border-blue-500/30">
      <div className="p-4 px-6 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-2.5 bg-blue-600/20 text-blue-500 rounded-xl relative group overflow-hidden">
                <Cpu className="w-5 h-5 font-bold animate-pulse-slow" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Verinode Sandbox</h2>
        </div>
        <div className="flex space-x-3 text-slate-500 py-3">
            <Share2 className="w-4 h-4 cursor-pointer hover:text-white transition" />
            <RotateCcw className="w-4 h-4 cursor-pointer hover:text-white transition" onClick={() => setOutput([])} />
            <Settings className="w-4 h-4 cursor-pointer hover:text-white transition" />
            <Info className="w-4 h-4 cursor-pointer hover:text-white transition" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[600px]">
        {/* Monaco-like Editor Body */}
        <div className="flex-1 p-6 space-y-4 bg-slate-950/20 border-r border-slate-800 flex flex-col pointer-events-auto">
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 relative">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" /> script.js
              <div className="absolute right-0"># v1.0</div>
          </div>
          <div className="flex-1 overflow-hidden">
              <textarea 
                className="w-full h-full bg-transparent border-none outline-none text-blue-300 font-mono text-sm leading-relaxed tracking-tight" 
                value={code}
                spellCheck={false}
                onChange={(e) => setCode(e.target.value)}
              />
          </div>
          <button 
            onClick={runCode}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold flex items-center justify-center transition-all shadow-xl shadow-blue-500/10 group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Play className="w-16 h-16 text-white" />
            </div>
            {isLoading ? <span className="animate-spin mr-2">⊚</span> : <Play className="w-4 h-4 mr-2" />}
            Compile & Execute Sandbox
          </button>
        </div>

        {/* Terminal Dashboard */}
        <div className="w-full lg:w-[450px] p-6 bg-slate-950 flex flex-col space-y-4 overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600 opacity-5 blur-3xl group-hover:opacity-10 transition-opacity" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              <Terminal className="w-3.5 h-3.5 mr-1" /> System Console
            </div>
            <div className="p-1 px-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 text-[10px] font-bold tracking-tighter opacity-70">
                Soroban Testnet : Connected
            </div>
          </div>
          
          <div className="flex-1 p-5 bg-[#0c1222] rounded-2xl border border-slate-800 font-mono text-xs overflow-y-auto space-y-2 relative group-hover:border-slate-700/50 transition">
                <div className="absolute top-4 right-4 text-slate-700 hover:text-white cursor-pointer transition">
                    <Copy className="w-3.5 h-3.5 font-bold" />
                </div>
            {output.length > 0 ? (
              output.map((line, i) => (
                <div key={i} className={`p-1.5 rounded-lg border-l-2 transition ${
                    line.includes('Success') ? 'bg-emerald-500/5 border-emerald-500 text-emerald-400' : 
                    line.includes('Initializing') ? 'bg-blue-500/5 border-blue-500 text-blue-400' : 'border-slate-800 text-slate-400'
                }`}>
                  {line}
                </div>
              ))
            ) : (
                <div className="text-slate-700 italic flex items-center h-full justify-center opacity-60">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mr-2 animate-pulse" /> Initializing Terminal Interface...
                </div>
            )}
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/20 text-center">
                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">Compute Cost</div>
                    <div className="text-blue-400 text-xs font-black">0.0004 XLM</div>
                </div>
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/20 text-center">
                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">Execution Time</div>
                    <div className="text-amber-400 text-xs font-black">1.2s</div>
                </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePlayground;
