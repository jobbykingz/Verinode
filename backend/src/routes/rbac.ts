import express, { Router, Request, Response } from 'express';
import Role from '../models/Role.ts';
import Permission from '../models/Permission.ts';
import UserRole from '../models/UserRole.ts';
import User from '../models/User.ts';
import { hasPermission } from '../middleware/rbac.ts';
import PermissionService from '../services/rbac/PermissionService.ts';
import RBACService from '../services/rbac/RBACService.ts';

const router: Router = express.Router();

/**
 * @route GET /api/rbac/roles
 * @desc Get all roles
 * @access Admin/Manager
 */
router.get('/roles', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const roles = await Role.find().populate('parentRole').populate('permissions');
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/rbac/roles
 * @desc Create new role
 * @access Admin
 */
router.post('/roles', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const role = await PermissionService.createRole(req.body);
    res.status(201).json(role);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route PUT /api/rbac/roles/:id
 * @desc Update role
 * @access Admin
 */
router.put('/roles/:id', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const { permissions, ...updateData } = req.body;
    let role = await Role.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    if (permissions) {
      role = await PermissionService.updateRolePermissions(req.params.id, permissions);
    }
    
    res.json(role);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /api/rbac/permissions
 * @desc Get all permissions
 * @access Admin/Manager
 */
router.get('/permissions', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/rbac/users/:userId/permissions
 * @desc Get resolved permissions for a user
 * @access Admin/Manager/Self
 */
router.get('/users/:userId/permissions', async (req: Request, res: Response) => {
  try {
    const permissions = await RBACService.getUserPermissions(req.params.userId);
    res.json(Array.from(permissions));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/rbac/users/:userId/roles
 * @desc Assign role to user
 * @access Admin
 */
router.post('/users/:userId/roles', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const { roleId } = req.body;
    const assignment = await PermissionService.assignRoleToUser(req.params.userId, roleId, (req as any).user?.id);
    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/rbac/users/:userId/roles/:roleId
 * @desc Revoke role from user
 * @access Admin
 */
router.delete('/users/:userId/roles/:roleId', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    await PermissionService.removeRoleFromUser(req.params.userId, req.params.roleId);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/rbac/bulk-assign
 * @desc Bulk assign roles to multiple users
 * @access Admin
 */
router.post('/bulk-assign', hasPermission('rbac:manage'), async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body;
    for (const a of assignments) {
      await PermissionService.assignRoleToUser(a.userId, a.roleId, (req as any).user?.id);
    }
    res.status(200).json({ success: true, count: assignments.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
