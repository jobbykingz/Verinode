import React from 'react';
import { IWidgetConfig } from '../../types/dashboard';
import { Code, Terminal, FileJson } from 'lucide-react';

interface CustomWidgetProps {
  config: IWidgetConfig;
}

const CustomWidget: React.FC<CustomWidgetProps> = ({ config }) => {
  return (
    <div className="w-full h-full p-4 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-300 truncate">{config.title || 'Custom Component'}</h3>
      </div>
      
      <div className="flex-1 bg-slate-950/50 rounded-lg border border-slate-800 p-4 font-mono text-[11px] overflow-hidden group">
        <div className="flex items-center gap-2 text-slate-600 mb-3 opacity-50 group-hover:opacity-100 transition-opacity">
          <FileJson className="w-3.5 h-3.5" />
          <span>CONFIG_SCHEMA.json</span>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-blue-400">"data_source":</span>
            <span className="text-emerald-400 pl-4">"{config.dataSource || 'primary_rpc'}"</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-blue-400">"parameters":</span>
            <div className="pl-4 border-l border-slate-800 flex flex-col gap-1 ml-1 cursor-default">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">interval:</span>
                <span className="text-amber-500">"{config.refreshInterval || 30000}ms"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">buffer:</span>
                <span className="text-amber-500">"512KB"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">mode:</span>
                <span className="text-amber-500">"HYBRID_OBSERVABILITY"</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center py-2 bg-blue-500/5 border border-dashed border-blue-500/20 rounded-md text-blue-400/50 group-hover:text-blue-400 transition-all cursor-pointer">
          <Code className="w-3.5 h-3.5 mr-2" />
          <span>INJECT LOGIC</span>
        </div>
      </div>
    </div>
  );
};

export default CustomWidget;
