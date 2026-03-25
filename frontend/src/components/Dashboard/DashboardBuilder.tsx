import React, { useState } from 'react';
import { Layout as GridLayout } from 'react-grid-layout';
import { useDashboard } from '../../hooks/useDashboard';
import DashboardGrid from './DashboardGrid';
import WidgetLibrary from './WidgetLibrary';
import WidgetConfig from './WidgetConfig';
import DashboardTemplates from './DashboardTemplates';
import { IWidget, WidgetType } from '../../types/dashboard';
import { 
  Plus, 
  Save, 
  Settings2, 
  X, 
  Layout, 
  History, 
  Share2, 
  ChevronDown,
  Lock,
  LockOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const DashboardBuilder: React.FC = () => {
  const {
    currentDashboard,
    isEditing,
    setIsEditing,
    saveDashboard,
    addWidget,
    removeWidget,
    updateWidget,
    useTemplate,
    setCurrentDashboard
  } = useDashboard();

  const [configuringWidget, setConfiguringWidget] = useState<IWidget | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleLayoutChange = (newLayout: GridLayout[]) => {
    if (!currentDashboard) return;

    const updatedWidgets = currentDashboard.widgets.map(widget => {
      const match = newLayout.find(l => l.i === widget.id);
      if (match) {
        return { ...widget, x: match.x, y: match.y, w: match.w, h: match.h };
      }
      return widget;
    });

    setCurrentDashboard({ ...currentDashboard, widgets: updatedWidgets });
  };

  const handleSave = async () => {
    try {
      await saveDashboard();
      toast.success('DASHBOARD ARCHITECTURE PERSIISTED', {
        style: { background: '#0f172a', border: '1px solid #1e293b', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }
      });
    } catch (error) {
      toast.error('FAILED TO SAVE LAYOUT');
    }
  };

  if (!currentDashboard) return null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-2xl border-b border-slate-900 shadow-2xl shadow-black/40">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-4 group cursor-pointer transition-transform hover:scale-[1.02]">
              <div className="p-3.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                <Layout className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-bold italic tracking-tight uppercase group-hover:text-blue-400 transition-colors">
                    {currentDashboard.name}
                  </h1>
                  <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                    ID: {currentDashboard.id.slice(0, 8)}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-[10px] text-emerald-500/80 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Transmission
                  </span>
                </div>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <button className="px-5 py-2.5 bg-slate-800 text-slate-100 text-xs font-bold rounded-xl shadow-lg shadow-black/20 border border-slate-700 uppercase tracking-widest">
                Current View
              </button>
              <button onClick={() => setShowTemplates(!showTemplates)} className="px-5 py-2.5 text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-widest transition-colors font-mono">
                Templates
              </button>
              <button className="px-5 py-2.5 text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-widest transition-colors font-mono">
                History
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {!isEditing ? (
                <motion.button
                  key="unlock"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3.5 bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 hover:text-white border border-slate-800 transition-all flex items-center gap-3 hover:shadow-xl hover:shadow-black/50"
                >
                  <Lock className="w-4 h-4" />
                  Edit Interface
                </motion.button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3.5 bg-slate-900 text-rose-400 text-xs font-bold uppercase tracking-[0.2em] rounded-2xl hover:bg-rose-500/10 border border-slate-800 transition-all flex items-center gap-3"
                  >
                    <X className="w-4 h-4" />
                    DISCARD
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-7 py-3.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 flex items-center gap-3 group"
                  >
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Commit Layout
                  </button>
                </div>
              )}
            </AnimatePresence>

            <div className="h-8 w-[1px] bg-slate-900 mx-2" />
            
            <button className="p-3.5 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-2xl transition-all shadow-xl shadow-black/40">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1600px] mx-auto px-8 py-10">
        <AnimatePresence>
          {showTemplates && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12"
            >
              <DashboardTemplates onSelect={(id) => {
                useTemplate(id);
                setShowTemplates(false);
              }} />
            </motion.div>
          )}

          {isEditing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-12 overflow-hidden"
            >
              <div className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800/80 backdrop-blur-xl relative group shadow-2xl shadow-indigo-500/5">
                {/* Decorative Elements */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-[60px]" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-[60px]" />
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <Plus className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3 uppercase tracking-tight italic">
                      ASSEMBLY BAY
                      <span className="text-[10px] text-slate-500 font-mono tracking-widest opacity-50 not-italic">v2.4.0</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Inject new components and data streams into the active interface</p>
                  </div>
                </div>
                <WidgetLibrary onAddWidget={(type) => addWidget(type)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Grid Component */}
        <DashboardGrid
          widgets={currentDashboard.widgets}
          isEditing={isEditing}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={removeWidget}
          onConfigureWidget={setConfiguringWidget}
        />

        {/* Empty State */}
        {currentDashboard.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-40 bg-slate-900/10 rounded-[4rem] border-2 border-dashed border-slate-800/50">
            <div className="p-10 bg-slate-900/50 rounded-full mb-8 shadow-2xl shadow-black/40 border border-slate-800 group cursor-pointer hover:border-blue-500/30 transition-all hover:scale-105">
              <Layout className="w-16 h-16 text-slate-700 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-slate-200 mb-3 uppercase tracking-tighter">Architecture Required</h3>
            <p className="text-slate-500 max-w-sm text-center leading-relaxed font-medium">
              Initialize your control center by selecting a <button onClick={() => setShowTemplates(true)} className="text-blue-400 hover:text-blue-300 font-bold underline decoration-blue-500/30 underline-offset-4">blueprint</button> or crafting one in the <button onClick={() => setIsEditing(true)} className="text-purple-400 hover:text-purple-300 font-bold underline decoration-purple-500/30 underline-offset-4">assembly bay</button>.
            </p>
            <div className="mt-12 flex gap-4">
              <button 
                onClick={() => setShowTemplates(true)}
                className="px-6 py-3.5 bg-slate-900 text-slate-400 text-xs font-bold uppercase tracking-widest rounded-2xl hover:text-white transition-all border border-slate-800"
              >
                Browse Templates
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                className="px-6 py-3.5 bg-blue-600/10 text-blue-400 text-xs font-bold uppercase tracking-widest rounded-2xl hover:bg-blue-600/20 transition-all border border-blue-600/20"
              >
                Start From Scratch
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Widget Configuration Modal */}
      <AnimatePresence>
        {configuringWidget && (
          <WidgetConfig
            widget={configuringWidget}
            onUpdate={updateWidget}
            onClose={() => setConfiguringWidget(null)}
          />
        )}
      </AnimatePresence>

      {/* Interface Feedback Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-[1600px] mx-auto px-8 py-6 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-6 px-6 py-3 bg-[#020617]/90 backdrop-blur-xl border border-slate-900 rounded-full shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SYSTEM_STABLE</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800" />
            <div className="flex items-center gap-3">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest font-mono">245ms_LATENCY</span>
            </div>
          </div>
          
          <div className="px-6 py-3 bg-[#020617]/90 backdrop-blur-xl border border-slate-900 rounded-full shadow-2xl pointer-events-auto flex items-center gap-4">
            <div className="flex -space-x-1.5 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="inline-block h-5 w-5 rounded-full ring-2 ring-slate-950 bg-slate-800 border border-slate-700" title="Active Admin" />
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">12_ACTIVE_OPERATORS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardBuilder;
import { Activity } from 'lucide-react';
