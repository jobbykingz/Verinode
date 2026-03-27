import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Gauge, Zap, Globe, HardDrive } from 'lucide-react';

interface Metric {
  time: string;
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
}

/**
 * Performance Monitoring Dashboard component for Verinode developers
 */
const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [currentVitals, setCurrentVitals] = useState({
    fcp: 0.8,
    lcp: 1.2,
    cls: 0.02,
    fid: 24,
    bundleSize: '1.2MB'
  });

  useEffect(() => {
    // Simulated live metrics monitoring
    const generateData = () => {
      const data = [];
      const now = new Date();
      for (let i = 20; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        data.push({
          time,
          fcp: 0.7 + Math.random() * 0.3,
          lcp: 1.1 + Math.random() * 0.4,
          cls: 0.01 + Math.random() * 0.05
        });
      }
      setMetrics(data);
    };
    generateData();
  }, []);

  const vitals = [
    { name: 'FCP', val: `${currentVitals.fcp}s`, color: 'text-emerald-400', icon: <Zap className="w-4 h-4" /> },
    { name: 'LCP', val: `${currentVitals.lcp}s`, color: 'text-blue-400', icon: <Globe className="w-4 h-4" /> },
    { name: 'CLS', val: `${currentVitals.cls}`, color: 'text-amber-400', icon: <Gauge className="w-4 h-4" /> },
    { name: 'FID', val: `${currentVitals.fid}ms`, color: 'text-purple-400', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="p-8 bg-slate-950 border border-slate-900 rounded-3xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <HardDrive className="w-24 h-24 text-blue-500" />
      </div>
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Performance Core Vitals
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium tracking-wide">Live bundle and rendering health analysis</p>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-tighter animate-pulse">
          Optimization Active
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {vitals.map((v, i) => (
          <div key={i} className="p-5 bg-slate-900/40 border border-slate-800/50 rounded-2xl group-hover:border-blue-500/30 transition-all">
            <div className="flex items-center space-x-2 mb-2">
              <span className={v.color}>{v.icon}</span>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{v.name}</span>
            </div>
            <div className={`text-2xl font-black ${v.color}`}>{v.val}</div>
          </div>
        ))}
      </div>

      <div className="h-[250px] bg-slate-900/20 rounded-2xl border border-slate-800/30 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={metrics}>
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
              itemStyle={{ fontSize: '10px' }}
            />
            <XAxis dataKey="time" hide />
            <Line type="monotone" dataKey="fcp" stroke="#10b981" strokeWidth={3} dot={false} animationDuration={1000} />
            <Line type="monotone" dataKey="lcp" stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={2000} />
            <Line type="monotone" dataKey="cls" stroke="#f59e0b" strokeWidth={1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 flex items-center justify-between text-xs font-medium text-slate-500 bg-slate-900/40 p-4 rounded-xl">
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          Optimized Bundle: <span className="text-blue-400 ml-1 font-bold">{currentVitals.bundleSize}</span>
        </div>
        <div className="flex items-center">
          Code Splitting Efficiency: <span className="text-emerald-400 ml-1 font-bold">94%</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
