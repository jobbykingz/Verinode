import React from 'react';
import dashboardService from '../../services/dashboard/DashboardService';
import { IDashboardTemplate } from '../../types/dashboard';
import { Layout, Star, ChevronRight, Bookmark } from 'lucide-react';

interface DashboardTemplatesProps {
  onSelect: (id: string) => void;
}

const DashboardTemplates: React.FC<DashboardTemplatesProps> = ({ onSelect }) => {
  const templates = dashboardService.getTemplates();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <Layout className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 italic tracking-tight uppercase">BLUEPRINT GALLERY</h3>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider ml-1">Pre-built architecture layouts</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className="flex flex-col text-left p-6 rounded-3xl bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-purple-500/30 transition-all hover:translate-y-[-4px] group relative overflow-hidden group/card shadow-xl shadow-black/20"
          >
            {/* Background Accent */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-[40px] group-hover/card:bg-purple-500/10 transition-colors" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-500/20 shadow-inner">
                <Bookmark className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-500 text-amber-500" />
                ))}
              </div>
            </div>

            <div className="mt-2 relative z-10">
              <h4 className="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2 group-hover:text-purple-400 transition-colors">
                {template.name}
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">{template.description}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between relative z-10">
              <span className="text-[10px] font-bold text-slate-600 tracking-widest uppercase flex items-center gap-2 group-hover:text-slate-400 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-purple-500 transition-colors" />
                {template.widgets.length} ACTIVE WIDGETS
              </span>
              <div className="flex -space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800" />
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardTemplates;
