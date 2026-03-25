import React from 'react';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, 
  ChevronDown, 
  Shield, 
  ArrowDown, 
  ChevronRight,
  Info,
  Lock,
  Package
} from 'lucide-react';
import rbacService, { IRole } from '../../services/rbacService.ts';

const RoleHierarchy: React.FC = () => {
  // Fetch roles
  const { data: roles = [], isLoading } = useQuery('roles', rbacService.getRoles);

  // Group roles by parent
  const roleNodes = React.useMemo(() => {
    const nodes: { [parentId: string]: IRole[] } = { root: [] };
    
    roles.forEach(role => {
      const parentId = typeof role.parentRole === 'string' 
        ? role.parentRole 
        : (role.parentRole?._id || 'root');
      
      if (!nodes[parentId]) nodes[parentId] = [];
      nodes[parentId].push(role);
    });
    
    return nodes;
  }, [roles]);

  const renderRoleTree = (parentId: string, depth: number = 0) => {
    const children = roleNodes[parentId];
    if (!children || children.length === 0) return null;

    return (
      <div className={`space-y-4 ${depth > 0 ? 'ml-12 border-l border-gray-800 pl-8 pt-4 relative' : ''}`}>
        {children.map(role => (
          <div key={role._id} className="relative group">
            {depth > 0 && (
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-[1px] bg-gray-800" />
            )}
            
            <motion.div
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-5 rounded-3xl border transition-all ${
                role.isSystem 
                  ? 'bg-blue-900/10 border-blue-500/20 shadow-blue-500/5' 
                  : 'bg-gray-950 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  role.isSystem ? 'bg-blue-500 text-white border-blue-400/20 shadow-lg shadow-blue-500/20' : 'bg-gray-900 text-gray-500 border-gray-800'
                }`}>
                  <Shield size={24} />
                </div>
                
                <div className="flex-1">
                   <div className="flex items-center gap-2">
                      <h4 className="text-xl font-bold text-white capitalize">{role.name}</h4>
                      {role.isSystem && (
                         <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase tracking-wider">
                           System
                         </span>
                      )}
                   </div>
                   <p className="text-gray-500 text-sm">{role.description}</p>
                </div>

                <div className="flex flex-col items-end text-xs text-gray-600 gap-1 font-mono">
                   <div className="flex items-center gap-1">
                      <Package size={14} /> {(role.permissions || []).length} PERMS
                   </div>
                   {role.isSystem && <Lock size={14} title="Immutable hierarchy" />}
                </div>
              </div>

              {/* Recursive call for children */}
              {renderRoleTree(role._id, depth + 1)}
            </motion.div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading hierarchy...</div>;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-500 mb-2">
           <GitBranch size={40} />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Role Hierarchy</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Inheritance allows higher-level roles to automatically gain all permissions of their children. 
          Modify the structure to create efficient permission groups.
        </p>
      </div>

      <div className="bg-gray-900/20 p-8 rounded-[3rem] border border-gray-800/50 backdrop-blur-3xl shadow-2xl">
        {renderRoleTree('root')}
        {roles.length === 0 && (
          <div className="p-20 text-center text-gray-700 italic border-2 border-dashed border-gray-800 rounded-3xl">
             <Info size={40} className="mx-auto mb-4 opacity-10" />
             <p>No roles defined yet. Create your first role to see the hierarchy.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
         <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-3xl flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 border border-emerald-500/20">
               <ArrowDown size={24} />
            </div>
            <div>
               <h5 className="text-white font-bold mb-1">Permission Flow</h5>
               <p className="text-gray-500 text-sm leading-relaxed">
                 Permissions flow <b>downward</b>. A parent role includes everything its child has, plus its own specific permissions.
               </p>
            </div>
         </div>
         <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-3xl flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0 border border-amber-500/20">
               <Shield size={24} />
            </div>
            <div>
               <h5 className="text-white font-bold mb-1">Administrative Override</h5>
               <p className="text-gray-500 text-sm leading-relaxed">
                 The <code>admin_all</code> permission ignores hierarchy and grants full system access immediately.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

export default RoleHierarchy;
