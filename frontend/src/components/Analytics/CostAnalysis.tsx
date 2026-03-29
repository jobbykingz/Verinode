import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { DollarSign, Shield, Zap, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface CostMetric {
  date: string;
  actualFee: number;
  estimatedFee: number;
}

const CostAnalysis: React.FC = () => {
  const [metrics, setMetrics] = useState<CostMetric[]>([]);
  const [optimizationScore, setOptimizationScore] = useState<number>(88);

  useEffect(() => {
    // Simulated data for rich aesthetic
    const generateData = () => {
      const data = [];
      const now = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const actual = Math.floor(Math.random() * 50) + 100;
        data.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          actualFee: actual,
          estimatedFee: actual + (Math.random() * 20),
        });
      }
      setMetrics(data);
    };
    generateData();
  }, []);

  const stats = [
    { label: 'Total Spend (30d)', value: '1.24 XLM', icon: <DollarSign className="w-5 h-5" />, color: 'from-blue-500 to-cyan-500' },
    { label: 'Efficiency Score', value: `${optimizationScore}%`, icon: <Zap className="w-5 h-5" />, color: 'from-amber-500 to-orange-500' },
    { label: 'Estimated Savings', value: '0.15 XLM', icon: <Shield className="w-5 h-5" />, color: 'from-emerald-500 to-teal-500' },
    { label: 'Cost/Tx Trend', value: '-0.02', icon: <TrendingUp className="w-5 h-5 transform rotate-180" />, color: 'from-indigo-500 to-purple-500' },
  ];

  return (
    <div className="p-6 bg-[#0f172a] min-h-screen text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Cost & Gas Intelligence
            </h1>
            <p className="text-slate-400 mt-1">Stellar Soroban resource analysis and optimization</p>
          </div>
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold border border-slate-700 transition">
              Export CSV
            </button>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-500/20">
              Optimize All
            </button>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl hover:border-emerald-500/30 transition-all cursor-default relative overflow-hidden">
               <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
               <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} opacity-90 shadow-lg`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                </div>
               </div>
            </div>
          ))}
        </div>

        {/* Cost Charts & Optimization Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main cost chart */}
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
              Fee Expenditure Trend
              <div className="flex space-x-4 text-xs">
                <div className="flex items-center space-x-1.5 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400">Actual Fee</span>
                </div>
                <div className="flex items-center space-x-1.5 font-medium">
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                   <span className="text-slate-500">Estimated Gap</span>
                </div>
              </div>
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Area type="monotone" dataKey="actualFee" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#costGradient)" />
                  <Area type="monotone" dataKey="estimatedFee" stroke="#64748b" strokeWidth={1} strokeDasharray="5 5" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Efficiency & Suggestions */}
          <div className="space-y-8">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl text-center relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Efficiency Pulse</h2>
               <div className="relative inline-flex items-center justify-center p-8 group-hover:scale-110 transition-transform">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle className="text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                    <circle className="text-emerald-500" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 58} strokeDashoffset={2 * Math.PI * 58 * (1 - optimizationScore/100)} stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold">{optimizationScore}%</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Excellent</span>
                  </div>
               </div>
               <p className="mt-6 text-sm text-slate-400 font-light leading-relaxed">
                 You are currently operating <span className="text-emerald-400 font-bold">12.5%</span> more efficient than the global network average.
               </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                 <Zap className="w-5 h-5 text-amber-400 mr-2" />
                 Optimization Engine
              </h2>
              <div className="space-y-3">
                {[
                  { title: "Redundant Calls", desc: "Batch 4 operations in ProofService", level: "High" },
                  { title: "Storage Layout", desc: "Compress metadata binary blobs", level: "Medium" },
                  { title: "Gas Limit", desc: "Decrease TTL for temporary state", level: "Low" }
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700/30 hover:border-emerald-500/20 transition group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.level === 'High' ? 'bg-red-500/10 text-red-500' : 
                        item.level === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>{item.level}</span>
                    </div>
                    <p className="text-xs text-slate-400 pr-2">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostAnalysis;
