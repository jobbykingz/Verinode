import React, { useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { IWidget } from '../../types/dashboard';
import ProofChart from '../Widgets/ProofChart';
import UsageStats from '../Widgets/UsageStats';
import RecentActivity from '../Widgets/RecentActivity';
import QuickActions from '../Widgets/QuickActions';
import { X, Settings, GripVertical } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  widgets: IWidget[];
  isEditing: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onRemoveWidget: (id: string) => void;
  onConfigureWidget: (widget: IWidget) => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  widgets,
  isEditing,
  onLayoutChange,
  onRemoveWidget,
  onConfigureWidget,
}) => {
  const layouts = useMemo(() => ({
    lg: widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h })),
  }), [widgets]);

  const renderWidget = (widget: IWidget) => {
    switch (widget.type) {
      case 'PROOF_CHART':
        return <ProofChart config={widget.config} />;
      case 'USAGE_STATS':
        return <UsageStats config={widget.config} />;
      case 'RECENT_ACTIVITY':
        return <RecentActivity config={widget.config} />;
      case 'QUICK_ACTIONS':
        return <QuickActions config={widget.config} />;
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-xl text-slate-500 italic text-sm border border-slate-700">
            Unknown Widget Type
          </div>
        );
    }
  };

  return (
    <div className="dashboard-grid min-h-[600px] pb-20">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        draggableHandle=".drag-handle"
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={(current) => isEditing && onLayoutChange(current)}
        margin={[16, 16]}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="relative group">
            {/* Widget Container with Controls */}
            <div className={`h-full w-full ${isEditing ? 'ring-2 ring-blue-500/30' : ''}`}>
              {renderWidget(widget)}
            </div>

            {/* Overlay Controls for Edit Mode */}
            {isEditing && (
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 transition-opacity">
                <div className="drag-handle cursor-grab active:cursor-grabbing p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                <button
                  onClick={() => onConfigureWidget(widget)}
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemoveWidget(widget.id)}
                  className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default DashboardGrid;
