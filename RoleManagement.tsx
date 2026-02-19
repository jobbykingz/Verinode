import React from 'react';

const RoleManagement: React.FC = () => {
    const roles = [
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
    ];

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Role Definitions</h2>
            <div className="grid gap-6 lg:grid-cols-3">
                {roles.map((role) => (
                    <div key={role.name} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <h3 className="text-lg font-medium text-gray-900">{role.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</h4>
                            <ul className="mt-2 list-disc list-inside text-sm text-gray-600">
                                {role.permissions.map(p => (
                                    <li key={p}>{p.replace('_', ' ')}</li>
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