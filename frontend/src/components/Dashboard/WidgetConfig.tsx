import React from 'react';
import { IWidget, IWidgetConfig } from '../../types/dashboard';
import { X, Save, RefreshCcw, Palette, Database } from 'lucide-react';

interface WidgetConfigProps {
  widget: IWidget;
  onUpdate: (id: string, config: IWidgetConfig) => void;
  onClose: () => void;
}

const WidgetConfig: React.FC<WidgetConfigProps> = ({ widget, onUpdate, onClose }) => {
  const [localConfig, setLocalConfig] = React.useState<IWidgetConfig>(widget.config);

  const handleSave = () => {
    onUpdate(widget.id, localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 transform animate-in slide-in-from-bottom-5 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Widget Configuration</h2>
              <p className="text-xs text-slate-500 font-mono tracking-tight uppercase">{widget.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Display Title</label>
            <div className="relative group">
              <input
                type="text"
                value={localConfig.title}
                onChange={(e) => setLocalConfig({ ...localConfig, title: e.target.value })}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all font-medium"
                placeholder="Enter widget title..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                <RefreshCcw className="w-3 h-3 text-emerald-400" />
                Refresh Rate
              </label>
              <select
                value={localConfig.refreshInterval}
                onChange={(e) => setLocalConfig({ ...localConfig, refreshInterval: Number(e.target.value) })}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all appearance-none font-medium cursor-pointer"
              >
                <option value={30000}>30 Seconds</option>
                <option value={60000}>1 Minute</option>
                <option value={300000}>5 Minutes</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                <Database className="w-3 h-3 text-purple-400" />
                Data Stream
              </label>
              <select
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all appearance-none font-medium text-slate-400 italic"
                disabled
              >
                <option>Real-time Feed</option>
                <option>Aggregated Log</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
            <div className="flex items-center gap-3 mb-3">
              <Palette className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-slate-300">Theme Override</span>
            </div>
            <div className="flex gap-3">
              {['#3b82f6', '#10b981', '#a855f7', '#f59e0b'].map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded-full border-2 border-slate-700/50 hover:scale-110 transition-transform cursor-not-allowed grayscale"
                  style={{ backgroundColor: color }}
                  title="Coming Soon"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors border border-slate-700/50"
          >
            DISCARD
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] px-6 py-4 rounded-2xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group"
          >
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetConfig;
import { Settings } from 'lucide-react';
