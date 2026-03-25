import React from 'react';
import { IWidgetConfig } from '../../types/dashboard';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface RecentActivityProps {
  config: IWidgetConfig;
}

const ACTIVITIES = [
  { id: 1, type: 'success', status: 'Proof Issued', tenant: 'StarkBank', time: '2m ago' },
  { id: 2, type: 'warning', status: 'Quota Alert', tenant: 'JerryCorp', time: '15m ago' },
  { id: 3, type: 'success', status: 'New Node Join', tenant: 'UtilityDrip', time: '45m ago' },
  { id: 4, type: 'info', status: 'System Update', tenant: 'Global', time: '1h ago' },
  { id: 5, type: 'success', status: 'Proof Issued', tenant: 'StarkBank', time: '2h ago' },
];

const RecentActivity: React.FC<RecentActivityProps> = ({ config }) => {
  return (
    <div className="w-full h-full p-4 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm overflow-hidden flex flex-col">
      <h3 className="text-sm font-medium text-slate-300 mb-4">{config.title || 'Recent Activity'}</h3>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-3">
          {ACTIVITIES.map((activity) => (
            <div key={activity.id} className="flex items-center gap-3 p-2 group hover:bg-slate-800/30 rounded-lg transition-colors border-l-2 border-transparent hover:border-blue-500/50">
              <div className="shrink-0">
                {activity.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {activity.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                {(activity.type === 'info' || activity.type === 'default') && <Clock className="w-4 h-4 text-blue-500" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{activity.status}</p>
                <p className="text-[10px] text-slate-400 font-mono">{activity.tenant}</p>
              </div>
              
              <div className="shrink-0">
                <span className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase whitespace-nowrap">
                  {activity.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;
