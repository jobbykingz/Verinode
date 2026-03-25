import React from 'react';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart, 
  Activity, 
  Share2, 
  FileText,
  Clock,
  Zap,
  Maximize2,
  Minimize2,
  Layers,
  BarChart3
} from 'lucide-react';
import quotaService, { IResourceHistory } from '../../services/quotaService';

const QuotaAnalytics: React.FC = () => {
  const [selectedRange, setSelectedRange] = React.useState('7d');
  const [isZoomed, setIsZoomed] = React.useState(false);

  // Mock data for analytics chart visualization
  const MOCK_DATAPOINTS = [
    { label: 'Mon', value: 450, secondary: 210 },
    { label: 'Tue', value: 380, secondary: 190 },
    { label: 'Wed', value: 520, secondary: 240 },
    { label: 'Thu', value: 610, secondary: 310 },
    { label: 'Fri', value: 490, secondary: 420 },
    { label: 'Sat', value: 210, secondary: 120 },
    { label: 'Sun', value: 150, secondary: 80 },
    { label: 'Mon', value: 420, secondary: 410 },
  ];

  const maxVal = Math.max(...MOCK_DATAPOINTS.map(d => d.value));

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h1 className="text-4xl font-extrabold text-white italic tracking-tighter flex items-center gap-4">
             <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl scale-110">
               <TrendingUp size={32} />
             </div>
             USAGE ANALYTICS
           </h1>
           <p className="text-gray-500 text-xs font-black uppercase tracking-widest pl-1 opacity-60 mt-2">Historical Resource Consumption Data</p>
        </div>
        
        <div className="flex bg-gray-950 border border-gray-900 rounded-[1.5rem] p-2 shadow-2xl">
           {['24h', '7d', '30d', 'ALL'].map(range => (
             <button
               key={range}
               onClick={() => setSelectedRange(range)}
               className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 selectedRange === range ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-600 hover:text-gray-400'
               }`}
             >
               {range}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Main Chart Card */}
         <div className="lg:col-span-8 bg-gray-950/40 border border-gray-900 rounded-[3rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 flex items-center gap-4 z-10">
               <button onClick={() => setIsZoomed(!isZoomed)} className="p-3 bg-gray-900 border border-gray-800 text-gray-400 rounded-2xl hover:text-white transition-all shadow-xl">
                  {isZoomed ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
               </button>
            </div>

            <div className="flex items-center gap-6 mb-16">
               <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 shadow-lg group-hover:bg-indigo-600/20 transition-all">
                  <BarChart3 size={24} />
               </div>
               <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">CONSUMPTION METRICS</h3>
                  <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Aggregate proof issuance count</p>
               </div>
            </div>

            {/* Custom Visual Column Chart (Simulation) */}
            <div className="h-[400px] flex items-end justify-between gap-4 px-4 relative">
               {/* Vertical Grid lines */}
               {[0, 25, 50, 75, 100].map(p => (
                 <div key={p} className="absolute left-0 right-0 border-t border-gray-900 pointer-events-none" style={{ bottom: `${p}%` }}>
                    <span className="absolute -left-1 text-[8px] font-black text-gray-700 -translate-y-1/2 uppercase tracking-tighter">{p === 0 ? 'START' : `${p}%`}</span>
                 </div>
               ))}

               {MOCK_DATAPOINTS.map((d, i) => (
                 <div key={i} className="flex-1 flex flex-col items-center gap-6 group/bar">
                    <div className="w-full relative flex justify-center">
                       <motion.div
                         initial={{ height: 0 }}
                         animate={{ height: `${(d.value / maxVal) * 320}px` }}
                         transition={{ delay: i * 0.05, duration: 1, ease: "circOut" }}
                         className="w-8 relative rounded-t-xl group-hover/bar:w-12 transition-all"
                       >
                          {/* Main bar with glassmorphism + gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/60 to-indigo-400 rounded-t-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] backdrop-blur-md border border-indigo-500/20" />
                          
                          {/* Inner secondary line */}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: '60%' }} 
                            className="absolute bottom-0 left-1 right-1 bg-white/10 rounded-t-lg"
                          />
                          
                          {/* Tooltip on hover */}
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 pb-2">
                             <div className="bg-white text-black text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap shadow-2xl uppercase tracking-widest">
                                {d.value.toLocaleString()} UNIT
                             </div>
                             <div className="w-2 h-2 bg-white rotate-45 mx-auto -mt-1" />
                          </div>
                       </motion.div>
                    </div>
                    <span className="text-[10px] font-black text-gray-600 group-hover/bar:text-white transition-colors uppercase tracking-widest">{d.label}</span>
                 </div>
               ))}
            </div>
         </div>

         {/* Sidebar Stats */}
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-950/40 border border-gray-900 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl hover:border-indigo-500/20 transition-all group">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                     <Clock size={20} />
                  </div>
                  <h4 className="text-xl font-black text-white italic tracking-tighter uppercase">PEAK PERFORMANCE</h4>
               </div>
               
               <div className="space-y-6">
                  <div className="flex justify-between items-center group/stat">
                     <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Global Max</span>
                     <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-white italic tracking-tighter">1,842</span>
                        <div className="flex items-center gap-1 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                           <TrendingUp size={10} /> +12.5%
                        </div>
                     </div>
                  </div>
                  
                  <div className="h-[1px] w-full bg-gray-900" />
                  
                  <div className="flex justify-between items-center group/stat">
                     <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Avg Consistency</span>
                     <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-white italic tracking-tighter">98.4%</span>
                        <div className="flex items-center gap-1 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                           <TrendingUp size={10} /> +0.2%
                        </div>
                     </div>
                  </div>
                  
                  <div className="h-[1px] w-full bg-gray-900" />
                  
                  <div className="flex justify-between items-center group/stat">
                     <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">System Load</span>
                     <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-red-500 italic tracking-tighter leading-none">HEAVY</span>
                        <div className="flex items-center gap-1 text-red-500 text-[8px] font-black uppercase tracking-widest mt-1">
                           <TrendingUp size={10} /> +42.1%
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-indigo-600 rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.5)] flex flex-col items-center justify-center text-center gap-6 hover:scale-[1.03] transition-all cursor-pointer group">
               <div className="w-16 h-16 rounded-[1.8rem] bg-white/10 flex items-center justify-center text-white backdrop-blur-md group-hover:rotate-12 transition-transform shadow-2xl border border-white/20">
                  <Share2 size={32} />
               </div>
               <div>
                  <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight mb-2">GENERATE ENTERPRISE REPORT</h4>
                  <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-widest">Export raw consumption data to PDF/CSV</p>
               </div>
            </div>
         </div>
      </div>

      {/* Feature Highlighting Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
         {[
           { icon: Zap, label: 'Real-time sync', color: 'text-emerald-500', desc: 'Latency < 50ms' },
           { icon: Layers, label: 'Multi-Tenant Scope', color: 'text-blue-500', desc: 'Isolating 500+ nodes' },
           { icon: Activity, label: 'Adaptive Scaling', color: 'text-purple-500', desc: 'Predictive analytics active' }
         ].map((item, i) => (
           <div key={i} className="bg-gray-950/40 border border-gray-900 rounded-[2rem] p-6 flex flex-col gap-4 text-center items-center shadow-xl">
              <div className={`p-4 rounded-2xl bg-gray-900 ${item.color} shadow-lg shadow-black/40`}>
                 <item.icon size={24} />
              </div>
              <div>
                 <h5 className="text-white font-black text-xs uppercase tracking-widest mb-1">{item.label}</h5>
                 <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest opacity-40">{item.desc}</p>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}

export default QuotaAnalytics;
