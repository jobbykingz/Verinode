import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  Settings, 
  Users, 
  Table, 
  GitBranch,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import RoleManager from '../../components/Admin/RoleManager.tsx';
import PermissionMatrix from '../../components/Admin/PermissionMatrix.tsx';
import UserRoleAssignment from '../../components/Admin/UserRoleAssignment.tsx';
import RoleHierarchy from '../../components/Admin/RoleHierarchy.tsx';

const TABS = [
  { id: 'roles', label: 'Roles', icon: Settings, component: RoleManager, desc: 'Define basic roles' },
  { id: 'matrix', label: 'Permission Matrix', icon: Table, component: PermissionMatrix, desc: 'Map permissions' },
  { id: 'users', label: 'User Assignments', icon: Users, component: UserRoleAssignment, desc: 'Assign to accounts' },
  { id: 'hierarchy', label: 'Hierarchy', icon: GitBranch, component: RoleHierarchy, desc: 'Visual inheritance' },
];

const RBACDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('roles');

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || RoleManager;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      {/* Sidebar/Drawer (Minimalist modern style) */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Modern Sidebar Tabs */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
               <ShieldCheck size={80} />
             </div>
             <h2 className="text-2xl font-black tracking-tighter mb-1 select-none">RBAC ENGINE</h2>
             <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest opacity-60">Enterprise Controls</p>
          </div>

          <nav className="space-y-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-5 rounded-3xl transition-all group ${
                  activeTab === tab.id 
                    ? 'bg-gray-900 border border-gray-800 shadow-xl shadow-black/50 text-white translate-x-1' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl transition-colors ${
                    activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'bg-gray-900/50 group-hover:bg-gray-800 text-gray-600 group-hover:text-gray-400'
                  }`}>
                    <tab.icon size={20} />
                  </div>
                  <div className="text-left">
                    <span className="font-bold block">{tab.label}</span>
                    <span className="text-[10px] uppercase font-bold tracking-tighter opacity-40">{tab.desc}</span>
                  </div>
                </div>
                {activeTab === tab.id && <ChevronRight size={18} className="text-indigo-500" />}
              </button>
            ))}
          </nav>

          <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl mt-12 flex gap-4 items-start">
             <ShieldAlert className="text-amber-500 flex-shrink-0" size={24} />
             <p className="text-amber-500/60 text-xs leading-relaxed">
               Modifying system roles may affect core platform stability. Always review the hierarchy before applying changes.
             </p>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="lg:col-span-9 bg-gray-950/30 border border-gray-900 rounded-[3rem] p-4 min-h-[80vh] backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Decorative Background Elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
          
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default RBACDashboard;
