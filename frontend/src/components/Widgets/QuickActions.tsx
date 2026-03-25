import React from 'react';
import { Shield, Plus, Settings, Share2, Download, Zap } from 'lucide-react';
import { IWidgetConfig } from '../../types/dashboard';

interface QuickActionsProps {
  config: IWidgetConfig;
}

const QuickActions: React.FC<QuickActionsProps> = ({ config }) => {
  return (
    <div className="w-full h-full p-4 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm group">
      <h3 className="text-sm font-medium text-slate-300 mb-6 flex items-center gap-2 group-hover:text-blue-400 transition-colors">
        <Shield className="w-4 h-4" />
        {config.title || 'Administrative Actions'}
      </h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <Plus className="w-6 h-6 text-blue-400" />
          <span className="text-[10px] font-medium text-blue-100 uppercase tracking-widest">New Tenant</span>
        </button>
        
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <Settings className="w-6 h-6 text-purple-400" />
          <span className="text-[10px] font-medium text-purple-100 uppercase tracking-widest">Configure Node</span>
        </button>
        
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <Zap className="w-6 h-6 text-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-100 uppercase tracking-widest">Deploy Fix</span>
        </button>
        
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <Share2 className="w-6 h-6 text-amber-400" />
          <span className="text-[10px] font-medium text-amber-100 uppercase tracking-widest">Share Stats</span>
        </button>
        
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <Download className="w-6 h-6 text-rose-400" />
          <span className="text-[10px] font-medium text-rose-100 uppercase tracking-widest">Reports</span>
        </button>
        
        <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 hover:border-slate-500/40 transition-all gap-2 transform hover:-translate-y-1">
          <div className="w-6 h-6 flex items-center justify-center text-slate-400 font-bold text-xl">+</div>
          <span className="text-[10px] font-medium text-slate-100 uppercase tracking-widest">Add More</span>
        </button>
      </div>
    </div>
  );
};

export default QuickActions;
