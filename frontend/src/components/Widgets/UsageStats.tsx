import React from 'react';
import { Layers, Activity, Cpu, Zap } from 'lucide-react';
import { IWidgetConfig } from '../../types/dashboard';

interface UsageStatsProps {
  config: IWidgetConfig;
}

const UsageStats: React.FC<UsageStatsProps> = ({ config }) => {
  return (
    <div className="w-full h-full p-4 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-slate-300 mb-6">{config.title || 'Network Usage'}</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-medium tracking-wider">THROUGHPUT</span>
          </div>
          <span className="text-xl font-bold text-slate-100">12.5 GB/s</span>
          <div className="h-1 w-full bg-slate-800 rounded-full mt-2">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '65%' }}></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-medium tracking-wider">LATENCY</span>
          </div>
          <span className="text-xl font-bold text-slate-100">45 ms</span>
          <div className="h-1 w-full bg-slate-800 rounded-full mt-2">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: '40%' }}></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-medium tracking-wider">UPTIME</span>
          </div>
          <span className="text-xl font-bold text-slate-100">99.98%</span>
          <div className="h-1 w-full bg-slate-800 rounded-full mt-2">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: '99%' }}></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium tracking-wider">NODES</span>
          </div>
          <span className="text-xl font-bold text-slate-100">1,245 Active</span>
          <div className="h-1 w-full bg-slate-800 rounded-full mt-2">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageStats;
