import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  Settings, 
  Save, 
  Search, 
  User, 
  Trophy, 
  Zap, 
  Activity, 
  ChevronRight,
  Database,
  Cpu,
  RefreshCcw,
  Plus,
  ShieldCheck,
  ZapOff
} from 'lucide-react';
import quotaService from '../../services/quotaService';
import { toast } from 'react-hot-toast';

const QuotaManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  
  // Local state for quota form
  const [resourceType, setResourceType] = useState('proofs');
  const [limit, setLimit] = useState(100);
  const [period, setPeriod] = useState('monthly');
  const [isSoftLimit, setIsSoftLimit] = useState(false);

  // Fetch all quotas (admin view) - assuming a new endpoint or list
  const { data: currentQuotas = [], isLoading } = useQuery(['tenant-quota', selectedTenant], () => selectedTenant ? quotaService.getTenantStatus(selectedTenant) : Promise.resolve([]));

  // Mutation to update quota
  const setQuotaMutation = useMutation(quotaService.setQuota, {
    onSuccess: () => {
      queryClient.invalidateQueries(['tenant-quota', selectedTenant]);
      toast.success('Quota updated successfully');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update quota')
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'proofs': return <Zap size={18} />;
      case 'storage_mb': return <Database size={18} />;
      case 'api_calls': return <Activity size={18} />;
      case 'users': return <Cpu size={18} />;
      default: return <Settings size={18} />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setQuotaMutation.mutate({ 
      tenantId: selectedTenant, 
      resourceType, 
      limit, 
      period, 
      isSoftLimit 
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-10">
      {/* Header */}
      <div className="flex justify-between items-center bg-gray-950/20 p-8 rounded-[3rem] border border-gray-900 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/5">
               <Settings size={28} />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tighter italic">QUOTA FORGE</h1>
          </div>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest pl-1">Modify Platform Power Levels</p>
        </div>
        
        <div className="hidden lg:flex gap-8 relative z-10">
           <div className="text-right">
             <p className="text-emerald-500 text-xs font-black uppercase tracking-widest mb-1">AUTO-SCALING</p>
             <p className="text-white font-bold opacity-60">ENABLED</p>
           </div>
           <div className="h-12 w-[1px] bg-gray-800" />
           <div className="text-right">
             <p className="text-blue-500 text-xs font-black uppercase tracking-widest mb-1">GLOBAL THRESHOLD</p>
             <p className="text-white font-bold opacity-60">99.8% STABLE</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Tenant Selection */}
        <div className="lg:col-span-4 space-y-6">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Find Tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-950 border border-gray-900 rounded-3xl pl-12 pr-4 py-4 text-white font-bold placeholder:text-gray-700 focus:outline-none focus:border-blue-500 transition-all text-sm uppercase tracking-widest shadow-xl"
              />
           </div>

           <div className="bg-gray-950/40 border border-gray-900 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl p-4 shadow-2xl">
              {/* Mock list of tenants */}
              {['Enterprise_Global', 'Startup_Inc', 'Web3_Devs', 'Stellar_Foundation'].map(tenant => (
                <button
                  key={tenant}
                  onClick={() => setSelectedTenant(tenant)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-all group ${
                    selectedTenant === tenant 
                      ? 'bg-blue-600/10 border border-blue-500/30' 
                      : 'hover:bg-gray-900/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                       selectedTenant === tenant ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900 text-gray-500'
                     }`}>
                        <User size={20} />
                     </div>
                     <span className={`font-bold transition-all text-xs uppercase tracking-widest ${selectedTenant === tenant ? 'text-white' : 'text-gray-500'}`}>
                       {tenant.replace('_', ' ')}
                     </span>
                  </div>
                  {selectedTenant === tenant && <ChevronRight className="text-blue-500" size={18} />}
                </button>
              ))}
           </div>
        </div>

        {/* Right: Configuration Form */}
        <div className="lg:col-span-8 space-y-10">
           {selectedTenant ? (
             <motion.div
               key="config-panel"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-gray-950/60 border border-gray-900 rounded-[3rem] p-10 backdrop-blur-3xl shadow-2xl relative"
             >
                <div className="flex justify-between items-start mb-12">
                   <div>
                      <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2">QUOTA CONFIGURATION</h2>
                      <div className="flex gap-2">
                        <span className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">TENANT: {selectedTenant}</span>
                        <span className="bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest italic">ACTIVE PLATROLE</span>
                      </div>
                   </div>
                   <Trophy size={48} className="text-gray-800" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Resource Selection</label>
                         <div className="grid grid-cols-2 gap-3">
                            {['proofs', 'storage_mb', 'api_calls', 'users'].map(type => (
                              <button
                                type="button"
                                key={type}
                                onClick={() => setResourceType(type)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                  resourceType === type 
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30' 
                                    : 'bg-gray-950 border-gray-900 text-gray-500 hover:border-gray-800'
                                }`}
                              >
                                {getResourceIcon(type)}
                                <span className="text-[10px] font-black uppercase tracking-widest">{type.split('_')[0]}</span>
                              </button>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Limit Threshold</label>
                         <div className="relative">
                            <input
                               type="number"
                               value={limit}
                               onChange={(e) => setLimit(parseInt(e.target.value))}
                               className="w-full bg-gray-950 border border-gray-900 rounded-2xl p-4 text-2xl font-black text-white italic tracking-tighter focus:outline-none focus:border-blue-500 transition-all pr-12"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold uppercase text-[10px] pointer-events-none">VAL</div>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Reset Cycle</label>
                         <div className="flex gap-4">
                            {['daily', 'monthly', 'perpetual'].map(p => (
                               <button
                                 type="button"
                                 key={p}
                                 onClick={() => setPeriod(p)}
                                 className={`flex-1 p-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${
                                   period === p ? 'bg-gray-900 text-white border-blue-500 shadow-xl' : 'bg-gray-950 border-gray-900 text-gray-600'
                                 }`}
                               >
                                 {p}
                               </button>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Constraint Mode</label>
                         <button
                           type="button"
                           onClick={() => setIsSoftLimit(!isSoftLimit)}
                           className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                             isSoftLimit 
                               ? 'bg-emerald-600/5 border-emerald-500/30 text-emerald-500' 
                               : 'bg-red-600/5 border-red-500/30 text-red-500'
                           }`}
                         >
                            <div className="flex items-center gap-3">
                               {isSoftLimit ? <ShieldCheck size={20} /> : <ZapOff size={20} />}
                               <span className="text-[10px] font-black uppercase tracking-widest">
                                 {isSoftLimit ? 'SOFT LIMIT (GRACEFUL)' : 'HARD LIMIT (ENFORCED)'}
                               </span>
                            </div>
                            <div className={`w-10 h-6 rounded-full p-1 transition-all ${isSoftLimit ? 'bg-emerald-600' : 'bg-red-600'}`}>
                               <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${isSoftLimit ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                         </button>
                      </div>
                   </div>

                   <div className="pt-10 flex gap-4">
                      <button 
                         type="button"
                         onClick={() => setSelectedTenant(null)}
                         className="px-8 py-5 border border-gray-900 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-900 transition-colors"
                      >
                         Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={setQuotaMutation.isLoading}
                        className="flex-1 bg-white text-black py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 shadow-2xl transition-all disabled:opacity-50"
                      >
                         {setQuotaMutation.isLoading ? <RefreshCcw className="animate-spin" size={20} /> : <><Save size={20} /> Finalize Configuration</>}
                      </button>
                   </div>
                </form>
             </motion.div>
           ) : (
             <div className="h-[600px] border-4 border-dashed border-gray-900 rounded-[4rem] flex flex-col items-center justify-center p-12 text-center space-y-8 bg-gray-950/20 backdrop-blur-2xl">
                <div className="w-24 h-24 rounded-[3rem] bg-gray-900 flex items-center justify-center text-gray-700 shadow-2xl">
                   <Settings size={48} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">No Tenant Selected</h3>
                   <p className="text-gray-500 text-sm font-bold uppercase tracking-widest max-w-[300px] mx-auto opacity-60 leading-relaxed">
                     Forge new power levels and resource limits. Select a tenant from the left to begin scaling.
                   </p>
                </div>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4"
                >
                   <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-900/50 text-[10px] font-black text-gray-700">PR-QUOTA AWARE</div>
                   <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-900/50 text-[10px] font-black text-gray-700">MULTISECURE</div>
                </motion.div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default QuotaManager;
