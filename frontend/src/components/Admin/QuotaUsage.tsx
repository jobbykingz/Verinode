import React from 'react';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Activity, 
  Search, 
  Filter, 
  ArrowUpRight, 
  CheckCircle,
  AlertCircle,
  BarChart2,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import quotaService, { IQuotaStatus } from '../../services/quotaService';

// Mock summary view of all tenants for the usage table
const MOCK_TENANTS = [
  { id: '1', name: 'Enterprise Global', plan: 'Enterprise', usage: 88, status: 'warning' },
  { id: '2', name: 'Startup Inc', plan: 'Pro', usage: 42, status: 'ok' },
  { id: '3', name: 'Web3 Devs', plan: 'Free', usage: 98, status: 'critical' },
  { id: '4', name: 'Stellar Foundation', plan: 'Enterprise', usage: 12, status: 'ok' },
  { id: '5', name: 'Validator Node 0', plan: 'Pro', usage: 65, status: 'ok' },
];

const QuotaUsage: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'warning': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-gradient-to-r from-red-600 to-rose-400';
      case 'warning': return 'bg-gradient-to-r from-amber-600 to-yellow-400';
      default: return 'bg-gradient-to-r from-emerald-600 to-teal-400';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search Tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-950 border border-gray-900 rounded-2xl pl-12 pr-4 py-4 text-white text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-blue-500 shadow-2xl"
          />
        </div>
        
        <div className="flex gap-4">
           <button className="px-6 py-4 bg-gray-950 border border-gray-900 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-900 transition-all">
             Filter Status <ChevronDown size={14} />
           </button>
           <button className="px-6 py-4 bg-gray-950 border border-gray-900 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-900 transition-all">
             Plan Type <ChevronDown size={14} />
           </button>
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-gray-950/40 border border-gray-900 rounded-[3rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
         <div className="overflow-x-auto">
            <table className="w-full border-collapse">
               <thead>
                  <tr className="border-b border-gray-900 bg-gray-950/60 font-black uppercase tracking-widest text-[10px] text-gray-600">
                     <th className="p-8 text-left">Tenant Identity</th>
                     <th className="p-8 text-left">Current Plan</th>
                     <th className="p-8 text-left">Resource Intensity</th>
                     <th className="p-8 text-left">Status</th>
                     <th className="p-8 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {MOCK_TENANTS.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((tenant, idx) => (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group border-b border-gray-900 hover:bg-gray-900/30 transition-all"
                    >
                       <td className="p-8">
                          <div className="flex items-center gap-5">
                             <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black italic shadow-lg group-hover:scale-110 transition-transform">
                                {tenant.name[0]}
                             </div>
                             <div>
                                <h4 className="text-lg font-black text-white italic tracking-tighter group-hover:text-blue-400 transition-colors uppercase">{tenant.name}</h4>
                                <p className="text-gray-600 text-[10px] font-bold tracking-widest uppercase">ID: TX-NOD-{tenant.id.padStart(4, '0')}</p>
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          <span className="px-4 py-2 rounded-xl bg-gray-950 border border-gray-900 text-gray-400 text-[10px] font-black uppercase tracking-widest italic group-hover:border-blue-500/30 transition-all">
                             {tenant.plan}
                          </span>
                       </td>
                       <td className="p-8 w-[300px]">
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
                                <span>Core Usage</span>
                                <span className={tenant.usage > 90 ? 'text-red-500' : 'text-white'}>{tenant.usage}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-900">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${tenant.usage}%` }}
                                  className={`h-full rounded-full transition-all duration-1000 ${getBarColor(tenant.status)} shadow-lg`}
                                />
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest scale-90 ${getStatusColor(tenant.status)}`}>
                             {tenant.status === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                             {tenant.status}
                          </div>
                       </td>
                       <td className="p-8 text-right">
                          <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                             <button className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-110 active:scale-95 transition-all">
                                <ArrowUpRight size={18} />
                             </button>
                             <button className="p-3 bg-gray-950 border border-gray-800 text-gray-500 rounded-xl hover:text-white transition-all">
                                <MoreVertical size={18} />
                             </button>
                          </div>
                       </td>
                    </motion.tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Secondary Insight Bar */}
      <div className="flex flex-col md:flex-row gap-6">
         <div className="flex-1 p-8 rounded-[3rem] bg-emerald-900/10 border border-emerald-500/10 flex items-center justify-between backdrop-blur-3xl shadow-2xl">
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-xl scale-110">
                  <BarChart2 size={28} />
               </div>
               <div>
                  <h4 className="text-xl font-black text-white italic tracking-tighter uppercase mb-1">PLATFORM STABILITY</h4>
                  <p className="text-emerald-300/40 text-xs font-bold uppercase tracking-widest">Aggregate node health: OPTIMAL</p>
               </div>
            </div>
            <div className="hidden lg:block text-right">
               <p className="text-emerald-500 text-2xl font-black italic tracking-tighter">99.98%</p>
               <p className="text-gray-700 text-[10px] font-black uppercase tracking-widest">Global Efficiency</p>
            </div>
         </div>
         
         <div className="flex-1 p-8 rounded-[3rem] bg-indigo-900/10 border border-indigo-500/10 flex items-center justify-between backdrop-blur-3xl shadow-2xl relative overflow-hidden">
             {/* Decorative grid */}
             <div className="absolute top-0 right-0 w-32 h-32 opacity-10 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl scale-110">
                  <Activity size={28} />
               </div>
               <div>
                  <h4 className="text-xl font-black text-white italic tracking-tighter uppercase mb-1">REAL-TIME TRAFFIC</h4>
                  <p className="text-indigo-300/40 text-xs font-bold uppercase tracking-widest">1,245 Events / Sec</p>
               </div>
            </div>
            <button className="p-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
                Live Feed
            </button>
         </div>
      </div>
    </div>
  );
}

export default QuotaUsage;
