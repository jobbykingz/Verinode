import React, { useState } from 'react';
import { Book, CheckCircle, ChevronRight, Play, Info, Search, List, Filter } from 'lucide-react';

interface TutorialStep {
  title: string;
  content: string;
  code?: string;
}

const TutorialViewer: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TutorialStep[] = [
    { 
      title: "Initialize the SDK", 
      content: "Start by importing the Verinode Stellar SDK and initializing a secure session using your Soroban identity address.",
      code: "import { VerinodeSDK } from '@verinode/stellar-sdk';\n\nconst sdk = new VerinodeSDK('PUBLIC_ADMIN_ADDRESS');"
    },
    { 
      title: "Prepare Proof Data", 
      content: "Define the structure of the data you want to prove on the ledger. This can be anything from identity strings to complex metadata objects.",
      code: "const data = { \n  claim: 'Verification Success',\n  timestamp: Date.now()\n};"
    },
    { 
      title: "Issue Cryptographic Proof", 
      content: "Call the `issue_proof` function to submit your data to the Soroban contract. This operation requires authorization via your wallet.",
      code: "const proofId = await sdk.issue_proof(data);"
    },
    { 
      title: "Verify & Verify", 
      content: "The proof is now recorded on-chain. You can verify it at any time using the unique `proofId` returned in the previous step.",
      code: "const isVerified = await sdk.verify(proofId);"
    }
  ];

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 p-8 opacity-10 flex space-x-4 items-center">
            <Filter className="w-6 h-6 text-slate-500" />
            <Search className="w-6 h-6 text-slate-500" />
            <List className="w-6 h-6 text-slate-500" />
      </div>

      <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600/20 text-blue-500 rounded-2xl">
                    <Book className="w-5 h-5 font-bold" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Quick Start: First Proof</h2>
                    <p className="text-slate-500 text-xs font-semibold tracking-wider font-mono uppercase mt-1">Difficulty: Beginner • Duration: 5 mins</p>
                </div>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
                <span className="text-emerald-500 font-black">{currentStep + 1}</span> 
                <span className="text-slate-600">/</span> 
                <span>{steps.length}</span>
            </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[500px]">
        {/* Step Navigation Slider */}
        <div className="w-full lg:w-[320px] p-8 bg-slate-900/40 border-r border-slate-800 space-y-4">
          {steps.map((s, i) => (
            <div 
              key={i} 
              onClick={() => setCurrentStep(i)}
              className={`p-4 rounded-2xl cursor-pointer border transition-all flex items-center space-x-4 ${
                i === currentStep ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-xl shadow-blue-500/5' : 
                i < currentStep ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500/60' : 'bg-slate-900/50 border-slate-800 text-slate-600'
              }`}
            >
              {i < currentStep ? <CheckCircle className="w-4 h-4 font-bold" /> : <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${i === currentStep ? 'border-blue-500' : 'border-slate-700'}`}>{i + 1}</div>}
              <span className="text-sm font-bold truncate pr-2 tracking-tight">{s.title}</span>
              {i === currentStep && <ChevronRight className="w-4 h-4 ml-auto animate-bounce-x" />}
            </div>
          ))}
        </div>

        {/* Content Viewer */}
        <div className="flex-1 p-10 space-y-8 bg-gradient-to-br from-slate-950 to-[#0f172a]">
          <div className="space-y-4 max-w-2xl">
            <h3 className="text-2xl font-black text-white bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{steps[currentStep].title}</h3>
            <p className="text-slate-400 text-base leading-relaxed font-light">{steps[currentStep].content}</p>
          </div>

          {steps[currentStep].code && (
            <div className="space-y-4">
              <div className="flex items-center text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">
                <Play className="w-3 h-3 mr-2 text-blue-500" /> Implementation Code
              </div>
              <pre className="p-8 bg-[#0c1222] border border-slate-800 rounded-3xl text-sm font-mono text-blue-300 overflow-x-auto shadow-2xl relative group">
                <div className="absolute top-4 right-4 text-slate-700 hover:text-white cursor-pointer transition">
                    <Info className="w-3.5 h-3.5 font-bold" />
                </div>
                {steps[currentStep].code}
              </pre>
            </div>
          )}

          <div className="pt-8 flex justify-between items-center bg-slate-900/20 rounded-2xl">
            <button 
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(s => s-1)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-white rounded-xl text-sm font-bold transition flex items-center shadow-lg"
            >
              Previous Step
            </button>
            <button 
              onClick={() => currentStep === steps.length - 1 ? null : setCurrentStep(s => s+1)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition flex items-center shadow-xl shadow-blue-500/20"
            >
              {currentStep === steps.length - 1 ? 'Finish Tutorial' : 'Next Step'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialViewer;
