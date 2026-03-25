import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Shield, 
  ChevronRight, 
  Layout, 
  AlertCircle,
  X,
  PlusCircle,
  Lock
} from 'lucide-react';
import rbacService, { IRole } from '../../services/rbacService.ts';
import { toast } from 'react-hot-toast';

const RoleManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<IRole> | null>(null);

  // Fetch roles
  const { data: roles = [], isLoading, error } = useQuery('roles', rbacService.getRoles);

  // Mutations
  const createMutation = useMutation(rbacService.createRole, {
    onSuccess: () => {
      queryClient.invalidateQueries('roles');
      toast.success('Role created successfully');
      setIsModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create role')
  });

  const updateMutation = useMutation(
    (role: Partial<IRole>) => rbacService.updateRole(role._id!, role),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('roles');
        toast.success('Role updated successfully');
        setIsModalOpen(false);
      },
      onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update role')
    }
  );

  const deleteMutation = useMutation(rbacService.deleteRole, {
    onSuccess: () => {
      queryClient.invalidateQueries('roles');
      toast.success('Role deleted successfully');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete role')
  });

  const handleCreateNew = () => {
    setCurrentRole({ name: '', description: '', isSystem: false, permissions: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (role: IRole) => {
    setCurrentRole(role);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRole?.name || !currentRole?.description) return;

    if (currentRole._id) {
      updateMutation.mutate(currentRole);
    } else {
      createMutation.mutate(currentRole);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading roles...</div>;
  if (error) return <div className="p-8 text-center text-red-500 flex items-center justify-center gap-2">
    <AlertCircle size={20} /> Error loading roles
  </div>;

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Shield className="text-blue-500" size={32} />
            Role Management
          </h1>
          <p className="text-gray-400 mt-2">Define and manage hierarchical system roles and their permissions.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg hover:shadow-blue-500/20 transition-all"
        >
          <PlusCircle size={20} />
          Create New Role
        </motion.button>
      </div>

      {/* Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {roles.map((role) => (
            <motion.div
              key={role._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-colors group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                {!role.isSystem ? (
                  <>
                    <button onClick={() => handleEdit(role)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(role._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <div className="p-2 text-gray-600" title="System Role (Read-only)">
                    <Lock size={18} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white capitalize">{role.name}</h3>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 uppercase tracking-wider border border-gray-700">
                    {role.isSystem ? 'System' : 'Custom'}
                  </span>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
                {role.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div className="flex -space-x-2">
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Layout size={14} />
                    {typeof role.permissions[0] === 'string' 
                      ? role.permissions.length 
                      : (role.permissions as any[]).length} Permissions
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(role)}
                  className="text-blue-500 text-sm font-semibold flex items-center gap-1 hover:text-blue-400 transition-colors"
                >
                  Configure <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Role Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gray-950 border border-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                <h2 className="text-xl font-bold text-white">
                  {currentRole?._id ? 'Edit Role' : 'Create New Role'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Role Name
                  </label>
                  <input
                    required
                    type="text"
                    value={currentRole?.name || ''}
                    onChange={(e) => setCurrentRole({ ...currentRole!, name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="e.g., manager"
                    disabled={currentRole?.isSystem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={currentRole?.description || ''}
                    onChange={(e) => setCurrentRole({ ...currentRole!, description: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="Describe what this role allows users to do..."
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-800 text-gray-400 font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {createMutation.isLoading || updateMutation.isLoading ? 'Processing...' : currentRole?._id ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RoleManager;
