import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  UserPlus, 
  X, 
  Shield, 
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers
} from 'lucide-react';
import rbacService, { IRole } from '../../services/rbacService.ts';
import { toast } from 'react-hot-toast';

// Mock list of users - replace with actual user search API
const DEMO_USERS = [
  { id: '1', email: 'admin@verinode.io', stellarAddress: 'GC3...ADMIN', createdAt: '2024-01-01' },
  { id: '2', email: 'manager-alice@google.com', stellarAddress: 'GD5...ALICE', createdAt: '2024-02-15' },
  { id: '3', email: 'user-bob@example.com', stellarAddress: 'GA9...BOB', createdAt: '2024-03-10' },
  { id: '4', email: 'new-dev@github.com', stellarAddress: 'GB2...DEV', createdAt: '2024-03-20' },
];

const UserRoleAssignment: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);

  // Fetch roles
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery('roles', rbacService.getRoles);

  // Mutation for assigning role
  const assignMutation = useMutation(
    ({ userId, roleId }: { userId: string, roleId: string }) => rbacService.assignRole(userId, roleId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-roles');
        toast.success('Role assigned successfully');
      },
      onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign role')
    }
  );

  const revokeMutation = useMutation(
    ({ userId, roleId }: { userId: string, roleId: string }) => rbacService.revokeRole(userId, roleId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-roles');
        toast.success('Role revoked successfully');
      },
      onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to revoke role')
    }
  );

  const handleBulkAssign = (roleId: string) => {
    if (bulkSelection.length === 0) {
      toast.error('Select at least one user first');
      return;
    }
    
    const promise = Promise.all(bulkSelection.map(userId => rbacService.assignRole(userId, roleId)));
    
    toast.promise(promise, {
      loading: 'Assigning roles in bulk...',
      success: 'Bulk assignment completed',
      error: 'Error in some assignments'
    });

    setBulkSelection([]);
    setIsBulkMode(false);
  };

  const toggleUserSelection = (userId: string) => {
    if (bulkSelection.includes(userId)) {
      setBulkSelection(bulkSelection.filter(id => id !== userId));
    } else {
      setBulkSelection([...bulkSelection, userId]);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Users className="text-indigo-500" size={32} />
            User Role Assignment
          </h1>
          <p className="text-gray-400 mt-2">Manage permissions by assigning roles to specific users.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setIsBulkMode(!isBulkMode)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              isBulkMode 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'bg-gray-900 text-gray-400 border border-gray-800'
            }`}
          >
            <Layers size={20} />
            {isBulkMode ? 'Bulk Actions Enabled' : 'Enable Bulk Mode'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Search List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search by email or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-indigo-500 ring-4 ring-transparent focus:ring-indigo-500/10 transition-all text-lg"
            />
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-3xl overflow-hidden backdrop-blur-xl">
            <div className="p-2">
              {DEMO_USERS
                .filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((u) => (
                  <motion.div
                    key={u.id}
                    onClick={() => !isBulkMode && setSelectedUser(u)}
                    whileHover={{ scale: 1.01 }}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer mb-1 ${
                      selectedUser?.id === u.id 
                        ? 'bg-indigo-600/10 border border-indigo-500/30' 
                        : 'bg-transparent border border-transparent hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {isBulkMode ? (
                        <div 
                          onClick={(e) => { e.stopPropagation(); toggleUserSelection(u.id); }}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                            bulkSelection.includes(u.id) 
                              ? 'bg-indigo-500 border-indigo-500' 
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          {bulkSelection.includes(u.id) && <CheckCircle2 size={16} strokeWidth={3} />}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/10">
                          {u.email[0].toUpperCase()}
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-bold text-white text-lg">{u.email}</h4>
                        <div className="flex items-center gap-2 text-gray-500 text-xs mt-0.5">
                          <code className="bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 tracking-tight">{u.stellarAddress}</code>
                          <span>•</span>
                          <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`text-gray-600 transition-transform ${selectedUser?.id === u.id ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Role Assignment */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {!isBulkMode && selectedUser ? (
              <motion.div
                key="user-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 sticky top-6 shadow-2xl"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <Shield className="text-indigo-500" />
                    <h3 className="text-xl font-bold text-white">Manage Roles</h3>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 mb-8">
                   <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Target Account</p>
                   <p className="text-white font-medium truncate">{selectedUser.email}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-gray-400 text-sm font-semibold mb-4 flex items-center gap-2">
                    <UserPlus size={16} /> Available Roles
                  </p>
                  
                  {roles.map(role => (
                    <button
                      key={role._id}
                      onClick={() => assignMutation.mutate({ userId: selectedUser.id, roleId: role._id })}
                      className="w-full flex items-center justify-between p-4 bg-gray-950/50 border border-gray-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left group"
                    >
                      <div>
                        <span className="text-white font-bold block">{role.name}</span>
                        <span className="text-gray-500 text-xs">{role.description}</span>
                      </div>
                      <PlusCircle className="text-gray-700 group-hover:text-indigo-500 transition-colors" size={20} />
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : isBulkMode ? (
              <motion.div
                 key="bulk-detail"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-6 sticky top-6 shadow-2xl backdrop-blur-md"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Layers className="text-indigo-400" />
                  <h3 className="text-xl font-bold text-white">Bulk Assign</h3>
                </div>
                
                <div className="bg-indigo-500/10 p-5 rounded-2xl mb-8 border border-indigo-500/10">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-indigo-300 text-sm font-bold uppercase tracking-widest">Selected Users</span>
                      <span className="bg-indigo-500 text-white px-2 py-0.5 rounded text-xs font-bold">{bulkSelection.length}</span>
                   </div>
                   <div className="text-gray-400 text-xs italic">
                     {bulkSelection.length === 0 ? 'No users selected yet' : `Adding roles to ${bulkSelection.length} accounts at once.`}
                   </div>
                </div>

                <div className="space-y-3">
                  <p className="text-indigo-300/60 text-sm font-semibold mb-4">Select Role to Assign</p>
                  {roles.map(role => (
                    <button
                      key={role._id}
                      disabled={bulkSelection.length === 0}
                      onClick={() => handleBulkAssign(role._id)}
                      className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                    >
                      Assign {role.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-800 rounded-3xl text-gray-600 text-center space-y-4">
                 <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center">
                    <Users size={32} className="opacity-20" />
                 </div>
                 <div>
                    <p className="font-bold text-gray-500">No User Selected</p>
                    <p className="text-sm">Search and select a user from the list to manage their roles.</p>
                 </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const PlusCircle = Plus; // Reuse plus icon

export default UserRoleAssignment;
