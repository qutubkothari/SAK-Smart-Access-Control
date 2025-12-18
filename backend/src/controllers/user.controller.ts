import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import auditService from '../services/audit.service';
import db from '../config/database';
import logger from '../utils/logger';

export const searchHosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string || '').trim();

    if (!q || q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const hosts = await db('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .select(
        'users.id',
        'users.its_id',
        'users.name',
        'users.email',
        'users.phone',
        'users.department_id',
        'departments.name as department_name',
        'departments.floor_number',
        'departments.building'
      )
      .where('users.is_active', true)
      .where(function() {
        this.whereILike('users.name', `%${q}%`)
          .orWhereILike('users.its_id', `%${q}%`)
          .orWhereILike('users.email', `%${q}%`)
          .orWhereILike('users.card_number', `%${q}%`);
      })
      .limit(20);

    res.json({ success: true, data: hosts });
  } catch (error) {
    logger.error('Error searching hosts:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to search hosts' }
    });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, department_id, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('users')
      .select('id', 'its_id', 'email', 'name', 'phone', 'department_id', 'role', 'is_active', 'created_at')
      .orderBy('created_at', 'desc');

    if (role) {
      query = query.where('role', role as string);
    }

    if (department_id) {
      query = query.where('department_id', department_id as string);
    }

    // Create separate count query without SELECT columns
    let countQuery = db('users');
    if (role) {
      countQuery = countQuery.where('role', role as string);
    }
    if (department_id) {
      countQuery = countQuery.where('department_id', department_id as string);
    }
    
    const [{ count }] = await countQuery.count('* as count');
    const users = await query.limit(Number(limit)).offset(offset);

    // Fetch department assignments for all users
    const userIds = users.map(u => u.id);
    const deptAssignments = userIds.length > 0 ? await db('user_departments')
      .whereIn('user_id', userIds)
      .select('user_id', 'department_id') : [];
    
    // Group by user_id
    const deptMap = new Map<string, string[]>();
    for (const a of deptAssignments) {
      if (!deptMap.has(a.user_id)) deptMap.set(a.user_id, []);
      deptMap.get(a.user_id)!.push(a.department_id);
    }

    // Attach department_ids array to each user
    const enrichedUsers = users.map(u => ({
      ...u,
      department_ids: deptMap.get(u.id) || []
    }));

    res.json({
      success: true,
      data: enrichedUsers,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch users'
      }
    });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { its_id, email, password, name, phone, department_id, department_ids, role } = req.body;

    const existingUser = await db('users')
      .where({ its_id })
      .orWhere({ email })
      .first();

    if (existingUser) {
      res.status(422).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User already exists'
        }
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '10'));

    const [user] = await db('users')
      .insert({
        its_id,
        email,
        password_hash: passwordHash,
        name,
        phone,
        department_id,
        role: role || 'host'
      })
      .returning(['id', 'its_id', 'name', 'email', 'role']);

    // Handle multiple departments
    const deptIds = department_ids && Array.isArray(department_ids) && department_ids.length > 0
      ? department_ids
      : (department_id ? [department_id] : []);

    if (deptIds.length > 0) {
      await db('user_departments').insert(
        deptIds.map(deptId => ({ user_id: user.id, department_id: deptId }))
      );
    }

    // Log user creation
    await auditService.logCreate(
      req.user!.id,
      'user',
      user.id,
      { its_id, email, name, role: user.role, department_ids: deptIds },
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create user'
      }
    });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await db('users')
      .select('id', 'its_id', 'email', 'name', 'phone', 'department_id', 'role', 'is_active', 'created_at')
      .where({ id })
      .first();

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    // Fetch department assignments
    const deptAssignments = await db('user_departments')
      .where({ user_id: id })
      .select('department_id');
    
    const department_ids = deptAssignments.map(a => a.department_id);

    res.json({
      success: true,
      data: { ...user, department_ids }
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user'
      }
    });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get old user data before update
    const oldUser = await db('users').where({ id }).first();

    if (!oldUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, parseInt(process.env.BCRYPT_ROUNDS || '10'));
      delete updates.password;
    }

    // Handle department_ids if provided
    const deptIds = updates.department_ids;
    delete updates.department_ids;

    await db('users')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      });

    // Sync user_departments if department_ids provided
    if (deptIds !== undefined) {
      const newDeptIds = Array.isArray(deptIds) ? deptIds : (deptIds ? [deptIds] : []);
      
      // Delete old assignments
      await db('user_departments').where({ user_id: id }).del();
      
      // Insert new ones
      if (newDeptIds.length > 0) {
        await db('user_departments').insert(
          newDeptIds.map(deptId => ({ user_id: id, department_id: deptId }))
        );
      }
    } else if (updates.department_id !== undefined) {
      // Backward compat: if single department_id is provided, use it
      await db('user_departments').where({ user_id: id }).del();
      if (updates.department_id) {
        await db('user_departments').insert({
          user_id: id,
          department_id: updates.department_id
        });
      }
    }

    // Get updated user data
    const newUser = await db('users').where({ id }).first();

    // Log user update (excluding password)
    const oldValues = { ...oldUser };
    const newValues = { ...newUser };
    delete oldValues.password_hash;
    delete newValues.password_hash;

    await auditService.logUpdate(
      req.user!.id,
      'user',
      id,
      oldValues,
      newValues,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user'
      }
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get user data before deactivation
    const user = await db('users').where({ id }).first();

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    await db('users')
      .where({ id })
      .update({
        is_active: false,
        updated_at: new Date()
      });

    // Log user deactivation
    await auditService.logDelete(
      req.user!.id,
      'user',
      id,
      { name: user.name, email: user.email, role: user.role, is_active: user.is_active },
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to deactivate user'
      }
    });
  }
};

/**
 * Lookup user by ITS ID (for internal meeting participant auto-fill)
 */
export const lookupUserByITS = async (req: AuthRequest, res: Response) => {
  try {
    const { its_id } = req.params;

    if (!its_id || its_id.trim().length === 0) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ITS ID is required'
        }
      });
      return;
    }

    const user = await db('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .where('users.its_id', its_id.trim())
      .where('users.is_active', true)
      .select(
        'users.id',
        'users.its_id',
        'users.name',
        'users.email',
        'users.phone',
        'users.role',
        'users.department_id',
        'departments.name as department_name',
        'departments.floor_number',
        'departments.building'
      )
      .first();

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `No active user found with ITS ID: ${its_id}`
        }
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error looking up user by ITS:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to lookup user'
      }
    });
  }
};

export const getMyEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const secretaryId = req.user!.id;

    // Get all employees assigned to this secretary
    const employees = await db('users')
      .join('secretary_employee_assignments', 'users.id', 'secretary_employee_assignments.employee_id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .where('secretary_employee_assignments.secretary_id', secretaryId)
      .where('secretary_employee_assignments.is_active', true)
      .where('users.is_active', true)
      .select(
        'users.id',
        'users.its_id',
        'users.name',
        'users.email',
        'users.phone',
        'users.role',
        'users.department_id',
        'departments.name as department_name'
      )
      .orderBy('users.name', 'asc');

    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    logger.error('Error fetching secretary employees:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch assigned employees'
      }
    });
  }
};
