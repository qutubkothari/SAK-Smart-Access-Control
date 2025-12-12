import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
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
          .orWhereILike('users.email', `%${q}%`);
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

    const [{ count }] = await query.clone().count('* as count');
    const users = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: users,
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
    const { its_id, email, password, name, phone, department_id, role } = req.body;

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

    res.json({
      success: true,
      data: user
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

    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, parseInt(process.env.BCRYPT_ROUNDS || '10'));
      delete updates.password;
    }

    await db('users')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      });

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

    await db('users')
      .where({ id })
      .update({
        is_active: false,
        updated_at: new Date()
      });

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
