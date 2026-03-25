import React from 'react';
import { WidgetType } from '../../types/dashboard';
import { BarChart3, Layout, Activity, MousePointer2 } from 'lucide-react';

interface WidgetLibraryProps {
  onAddWidget: (type: WidgetType) => void;
}

const WIDGET_OPTIONS = [
  { type: 'PROOF_CHART', icon: BarChart3, label: 'Analytics Chart', color: 'text-blue-400' },
  { type: 'USAGE_STATS', icon: Activity, label: 'Network Intensity', color: 'text-emerald-400' },
  { type: 'RECENT_ACTIVITY', icon: Layout, label: 'Audit Trail', color: 'text-purple-400' },
  { type: 'QUICK_ACTIONS', icon: MousePointer2, label: 'Quick Toolbar', color: 'text-rose-400' },
] as const;

const WidgetLibrary: React.FC<WidgetLibraryProps> = ({ onAddWidget }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">WIDGET GALLERY</h3>
        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded uppercase tracking-widest">Select to add</span>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur-md">
        {WIDGET_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onAddWidget(opt.type)}
            className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-all hover:scale-[1.02] group"
          >
            <div className={`p-4 rounded-2xl bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors mb-3`}>
              <opt.icon className={`w-8 h-8 ${opt.color}`} />
            </div>
            <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WidgetLibrary;
