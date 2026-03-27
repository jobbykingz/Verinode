import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, Shield, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

interface ContractMetric {
  date: string;
  usage: number;
  latency: number;
  successRate: number;
}

const ContractAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<ContractMetric[]>([]);
  const [healthStatus, setHealthStatus] = useState<'HEALTHY' | 'DEGRADED' | 'CRITICAL'>('HEALTHY');

  useEffect(() => {
    // Simulated data for rich aesthetic
    const generateData = () => {
      const data = [];
      const now = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        data.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          usage: Math.floor(Math.random() * 500) + 200,
          latency: Math.floor(Math.random() * 50) + 120,
          successRate: 95 + Math.random() * 4.9
        });
      }
      setMetrics(data);
    };
    generateData();
  }, []);

  const stats = [
    { label: 'Total Calls', value: '14.2k', icon: <Activity className="w-5 h-5" />, color: 'from-blue-500 to-cyan-500' },
    { label: 'Avg Latency', value: '142ms', icon: <Zap className="w-5 h-5" />, color: 'from-amber-500 to-orange-500' },
    { label: 'Proof Success', value: '99.4%', icon: <Shield className="w-5 h-5" />, color: 'from-emerald-500 to-teal-500' },
    { label: 'Active Users', value: '842', icon: <TrendingUp className="w-5 h-5" />, color: 'from-indigo-500 to-purple-500' },
  ];

  return (
    <div className="p-6 bg-[#0f172a] min-h-screen text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Contract Intelligence
            </h1>
            <p className="text-slate-400 mt-1">Real-time performance metrics and usage tracking</p>
          </div>
          <div className={`px-4 py-2 rounded-full flex items-center space-x-2 border ${
            healthStatus === 'HEALTHY' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 
            'bg-amber-500/10 border-amber-500/50 text-amber-400'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${healthStatus === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-semibold uppercase tracking-wider">{healthStatus} System</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl hover:border-blue-500/30 transition-all group overflow-hidden relative">
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
              <div className="flex justify-between items-start">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color} opacity-80`}>
                  {stat.icon}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Usage Chart */}
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              Usage Throughout (30d)
              <span className="ml-3 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg">+12.4% vs last mo</span>
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#usageGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Health & Insights */}
          <div className="space-y-8">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl">
              <h2 className="text-xl font-bold mb-4">Contract Health</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 text-sm">Response Time</span>
                  <span className="text-blue-400 font-medium">Optimal</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 text-sm">Error Frequency</span>
                  <span className="text-emerald-400 font-medium">Low (0.01%)</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 text-sm">Resource Usage</span>
                  <span className="text-amber-400 font-medium">Peak Load Warning</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border border-indigo-500/20 p-6 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Zap className="w-16 h-16 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Predictive Insights</h2>
              <p className="text-sm text-slate-300 mb-4 font-light leading-relaxed">
                Based on current activity trends, your usage will likely surge by <span className="text-indigo-400 font-bold">22.4%</span> in the next 14 days.
              </p>
              <button className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold transition-colors">
                View Detailed Forecast
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractAnalytics;
