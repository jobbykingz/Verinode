import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Save, 
  RefreshCcw,
  Check,
  X,
  Lock
} from 'lucide-react';
import rbacService, { IRole, IPermission } from '../../services/rbacService.ts';
import { toast } from 'react-hot-toast';

const PermissionMatrix: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Fetch roles and permissions
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery('roles', rbacService.getRoles);
  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery('permissions', rbacService.getPermissions);

  // Track pending changes locally before saving
  const [pendingChanges, setPendingChanges] = useState<{ [roleId: string]: string[] | null }>({});

  const modules = useMemo(() => {
    const mods = new Set(permissions.map(p => p.module));
    return Array.from(mods).sort();
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    return permissions.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchModule = !activeModule || p.module === activeModule;
      return matchSearch && matchModule;
    });
  }, [permissions, searchTerm, activeModule]);

  // Mutation for updating role permissions
  const updateMutation = useMutation(
    ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => 
      rbacService.updateRole(roleId, { permissions: permissionIds }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('roles');
        toast.success('Role permissions updated');
      },
      onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update permissions')
    }
  );

  const isPermissionInRole = (role: IRole, permissionId: string) => {
    // Check if we have pending changes for this role
    const pending = pendingChanges[role._id];
    if (pending !== undefined && pending !== null) {
      return pending.includes(permissionId);
    }
    
    // Fallback to server data
    return (role.permissions as any[]).some(p => 
      typeof p === 'string' ? p === permissionId : p._id === permissionId
    );
  };

  const togglePermission = (role: IRole, permissionId: string) => {
    if (role.isSystem) {
      toast.error('System roles cannot be modified directly');
      return;
    }

    const currentPermissions = (role.permissions as any[]).map(p => typeof p === 'string' ? p : p._id);
    const pending = pendingChanges[role._id] || currentPermissions;
    
    let next: string[];
    if (pending.includes(permissionId)) {
      next = pending.filter(id => id !== permissionId);
    } else {
      next = [...pending, permissionId];
    }
    
    setPendingChanges({ ...pendingChanges, [role._id]: next });
  };

  const handleSaveRole = (roleId: string) => {
    const nextPermissions = pendingChanges[roleId];
    if (nextPermissions) {
      updateMutation.mutate({ roleId, permissionIds: nextPermissions });
      // Reset pending changes for this role
      const nextPending = { ...pendingChanges };
      delete nextPending[roleId];
      setPendingChanges(nextPending);
    }
  };

  const handleReset = () => {
    setPendingChanges({});
    toast.primary('All unsaved changes cleared');
  };

  if (isLoadingRoles || isLoadingPermissions) return <div className="p-8 text-center text-gray-400">Loading matrix...</div>;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="text-emerald-500" size={32} />
            Permission Matrix
          </h1>
          <p className="text-gray-400 mt-1">Configure which roles have access to specific system actions.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            disabled={Object.keys(pendingChanges).length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-800 rounded-xl text-gray-400 hover:bg-gray-900 transition-colors disabled:opacity-30"
          >
            <RefreshCcw size={18} /> Reset
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 bg-gray-900/40 p-4 border border-gray-800 rounded-2xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setActiveModule(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!activeModule ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30' : 'bg-gray-950 text-gray-400 border border-gray-800 hover:border-gray-700'}`}
          >
            All Modules
          </button>
          {modules.map(mod => (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeModule === mod ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30' : 'bg-gray-950 text-gray-400 border border-gray-800 hover:border-gray-700'}`}
            >
              {mod.charAt(0).toUpperCase() + mod.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-3xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                <th className="p-6 text-left text-xs font-bold text-gray-500 uppercase tracking-widest min-w-[300px]">Permission</th>
                {roles.map(role => (
                  <th key={role._id} className="p-6 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-bold text-white capitalize">{role.name}</span>
                      {pendingChanges[role._id] && (
                        <motion.button
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          onClick={() => handleSaveRole(role._id)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 shadow-lg shadow-emerald-600/20"
                        >
                          <Save size={12} /> Save
                        </motion.button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.length > 0 ? (
                filteredPermissions.map((perm, idx) => (
                  <tr key={perm._id} className={`group hover:bg-gray-800/30 transition-colors border-b border-gray-800/50 ${idx % 2 === 1 ? 'bg-gray-900/20' : ''}`}>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-white font-semibold text-lg">{perm.name}</span>
                        <span className="text-gray-500 text-sm mt-0.5">{perm.description}</span>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono uppercase tracking-tight">
                            {perm.module}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono uppercase tracking-tight">
                            {perm.action}
                          </span>
                        </div>
                      </div>
                    </td>
                    {roles.map(role => {
                      const enabled = isPermissionInRole(role, perm._id);
                      const isPending = pendingChanges[role._id]?.includes(perm._id) !== 
                                       (role.permissions as any[]).some(p => typeof p === 'string' ? p === perm._id : p._id === perm._id);
                      
                      return (
                        <td key={`${role._id}-${perm._id}`} className="p-6 text-center">
                          <div className="flex justify-center">
                            {role.isSystem ? (
                              <div className="text-gray-700" title="System role fixed permission">
                                {enabled ? <Check size={20} className="text-emerald-500/30" /> : <Lock size={18} />}
                              </div>
                            ) : (
                              <button
                                onClick={() => togglePermission(role, perm._id)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                  enabled 
                                    ? 'bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-500/20' 
                                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                                } ${isPending ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 animate-pulse' : ''}`}
                              >
                                {enabled ? <Check size={18} strokeWidth={3} /> : <X size={16} />}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={roles.length + 1} className="p-20 text-center text-gray-600 flex flex-col items-center gap-4">
                    <Filter size={48} className="opacity-20" />
                    <p className="text-xl">No permissions found matching your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PermissionMatrix;
