const mongoose = require('mongoose');
require('dotenv').config();

// Define a separate schema for migration seeding if needed, or require the models.
// For simplicity in a single file, we can define them if we want to run this outside the main app context.
const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  parentRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  isSystem: { type: Boolean, default: false }
});

const PermissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true }
});

const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);
const Permission = mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);

async function up() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verinode';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for RBAC migration');

    // 1. Create permissions
    const permissions = [
      { name: 'proofs:create', description: 'Issue new proofs', module: 'proofs', action: 'create' },
      { name: 'proofs:read', description: 'View proofs', module: 'proofs', action: 'read' },
      { name: 'proofs:verify', description: 'Verify existing proofs', module: 'proofs', action: 'verify' },
      { name: 'stellar:read', description: 'View Stellar transactions', module: 'stellar', action: 'read' },
      { name: 'rbac:manage', description: 'Manage roles and permissions', module: 'rbac', action: 'manage' },
      { name: 'users:manage', description: 'Manage users', module: 'users', action: 'manage' },
      { name: 'admin_all', description: 'Superuser access', module: 'system', action: 'admin' }
    ];

    const permissionMap = {};
    for (const p of permissions) {
      const created = await Permission.findOneAndUpdate({ name: p.name }, p, { upsert: true, new: true });
      permissionMap[p.name] = created._id;
      console.log(`- Created permission: ${p.name}`);
    }

    // 2. Create roles (User -> Manager -> Admin)
    
    // User role
    const userRole = await Role.findOneAndUpdate(
      { name: 'user' },
      { 
        name: 'user', 
        description: 'Standard end user', 
        isSystem: true,
        permissions: [permissionMap['proofs:read'], permissionMap['stellar:read']]
      },
      { upsert: true, new: true }
    );
    console.log(`- Created role: user`);

    // Manager role (inherits from user)
    const managerRole = await Role.findOneAndUpdate(
      { name: 'manager' },
      { 
        name: 'manager', 
        description: 'Organizational manager', 
        isSystem: true,
        parentRole: userRole._id,
        permissions: [permissionMap['proofs:create'], permissionMap['proofs:verify']]
      },
      { upsert: true, new: true }
    );
    console.log(`- Created role: manager`);

    // Admin role (inherits from manager)
    const adminRole = await Role.findOneAndUpdate(
      { name: 'admin' },
      { 
        name: 'admin', 
        description: 'System administrator', 
        isSystem: true,
        parentRole: managerRole._id,
        permissions: [permissionMap['admin_all'], permissionMap['rbac:manage'], permissionMap['users:manage']]
      },
      { upsert: true, new: true }
    );
    console.log(`- Created role: admin`);

    console.log('RBAC migration completed successfully');
  } catch (error) {
    console.error('RBAC migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Check if running directly
if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up };
