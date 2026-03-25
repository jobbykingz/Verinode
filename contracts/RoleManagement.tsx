import React, { useState } from 'react';

interface Role {
    name: string;
    description: string;
    permissions: string[];
}

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([
        {
            name: 'Admin',
            description: 'Full access to all resources and billing.',
            permissions: ['manage_users', 'manage_billing', 'create_proofs', 'delete_proofs', 'view_analytics']
        },
        {
            name: 'Editor',
            description: 'Can create and edit proofs, but cannot manage users or billing.',
            permissions: ['create_proofs', 'edit_proofs', 'view_analytics']
        },
        {
            name: 'Viewer',
            description: 'Read-only access to proofs and analytics.',
            permissions: ['view_proofs', 'view_analytics']
        }
    ]);

    const allPermissions = ['manage_users', 'manage_billing', 'create_proofs', 'edit_proofs', 'delete_proofs', 'view_proofs', 'view_analytics'];

    const togglePermission = (roleName: string, permission: string) => {
        setRoles(roles.map(role => {
            if (role.name === roleName) {
                const hasPermission = role.permissions.includes(permission);
                return {
                    ...role,
                    permissions: hasPermission 
                        ? role.permissions.filter(p => p !== permission)
                        : [...role.permissions, permission]
                };
            }
            return role;
        }));
    };

    const handleSave = () => {
        console.log('Saving role configuration:', roles);
        alert('Role permissions updated successfully.');
    };

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Role Management</h2>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                    Save Changes
                </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                {roles.map((role) => (
                    <div key={role.name} className="border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col h-full">
                        <h3 className="text-lg font-medium text-gray-900">{role.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        <div className="mt-4 pt-4 border-t">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</h4>
                            <ul className="space-y-2">
                                {allPermissions.map(p => (
                                    <li key={p} className="flex items-center text-sm text-gray-600">
                                        <input 
                                            type="checkbox"
                                            className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                                            checked={role.permissions.includes(p)}
                                            onChange={() => togglePermission(role.name, p)}
                                        />
                                        {p.replace('_', ' ')}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoleManagement;