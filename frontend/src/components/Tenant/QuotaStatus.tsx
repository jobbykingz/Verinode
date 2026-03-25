import React from 'react';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  BarChart, 
  Clock, 
  AlertCircle,
  Database,
  ArrowUpRight,
  ChevronRight,
  Zap,
  Cpu
} from 'lucide-react';
import quotaService, { IQuotaStatus } from '../../services/quotaService';

const QuotaStatus: React.FC = () => {
  // Fetch current tenant status
  const { data: status = [], isLoading, error } = useQuery('tenant-quota', quotaService.getStatus, {
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'proofs': return <Zap size={20} />;
      case 'storage_mb': return <Database size={20} />;
      case 'api_calls': return <Activity size={20} />;
      case 'users': return <Cpu size={20} />;
      default: return <BarChart size={20} />;
    }
  };

  const getStatusColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (percentage > 70) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  };

  const getBarColor = (percentage: number) => {
    if (percentage > 90) return 'from-red-600 to-rose-400 shadow-red-500/50';
    if (percentage > 70) return 'from-amber-600 to-yellow-400 shadow-amber-500/50';
    return 'from-emerald-600 to-teal-400 shadow-emerald-500/50';
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400 animate-pulse">Analyzing Resource Consumption...</div>;
  if (error) return <div className="p-8 text-red-500 flex items-center justify-center gap-2"><AlertCircle size={20} /> Error fetching status</div>;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      {/* Active Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {status.map((item, idx) => (
            <motion.div
              key={item.resourceType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-gray-950/40 backdrop-blur-2xl border border-gray-900 rounded-[2rem] p-6 group hover:border-gray-800 transition-all hover:bg-gray-950/60 shadow-2xl overflow-hidden relative"
            >
              {/* Subtle background glow based on usage percentage */}
              <div className={`absolute -right-20 -top-20 w-40 h-40 blur-[80px] rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${
                item.percentageUsed > 90 ? 'bg-red-500' : item.percentageUsed > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${getStatusColor(item.percentageUsed)}`}>
                    {getResourceIcon(item.resourceType)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white capitalize tracking-tight">{item.resourceType.replace('_', ' ')}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                       <Clock size={12} /> {item.period} Reset
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white italic tracking-tighter">{item.percentageUsed.toFixed(0)}%</span>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">CONSUMED</p>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="relative h-2 w-full bg-gray-900 rounded-full overflow-hidden mb-6">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentageUsed}%` }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                  className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r shadow-[0_0_15px_rgba(0,0,0,0.5)] ${getBarColor(item.percentageUsed)}`}
                />
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">USAGE METRIC</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-white tracking-tight">{item.currentUsage.toLocaleString()}</span>
                    <span className="text-gray-600 text-sm font-medium">/ {item.limit === Infinity || item.limit === 0 ? '∞' : item.limit.toLocaleString()}</span>
                  </div>
                </div>
                
                <button className="flex items-center gap-1.5 text-blue-500 text-xs font-bold hover:text-blue-400 transition-colors uppercase tracking-widest pb-1 border-b border-transparent hover:border-blue-500/30 group-hover:translate-x-1">
                  History <ChevronRight size={14} />
                </button>
              </div>

              {item.percentageUsed > 80 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3"
                >
                  <AlertCircle size={16} className="text-amber-500" />
                  <p className="text-amber-500 text-[10px] font-bold uppercase tracking-tight leading-3">
                    Warning: You are approaching your limit. Upgrade plan to ensure service continuity.
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Analytics Summary */}
      <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border border-indigo-500/10 rounded-[2.5rem] p-8 backdrop-blur-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-white scale-110">
               <ArrowUpRight size={32} />
            </div>
            <div>
               <h4 className="text-2xl font-black text-white italic tracking-tighter">PREMIUM SCALABILITY</h4>
               <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest opacity-60">High-volume issuance allowed on current plan.</p>
            </div>
         </div>
         <button className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 shadow-xl transition-all text-xs">
            Upgrade Capacity
         </button>
      </div>
    </div>
  );
}

export default QuotaStatus;
