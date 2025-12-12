import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import logger from '../utils/logger';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { its_id, password } = req.body;

    if (!its_id || !password) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ITS ID and password are required'
        }
      });
      return;
    }

    const user = await db('users').where({ its_id }).first();

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid ITS ID or password'
        }
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid ITS ID or password'
        }
      });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        its_id: user.its_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    logger.info(`User logged in: ${user.its_id}`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          its_id: user.its_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department_id
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed'
      }
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { its_id, email, password, name, phone, department_id } = req.body;

    // Check if user exists
    const existingUser = await db('users')
      .where({ its_id })
      .orWhere({ email })
      .first();

    if (existingUser) {
      res.status(422).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this ITS ID or email already exists'
        }
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS || '10')
    );

    // Create user
    const [user] = await db('users')
      .insert({
        its_id,
        email,
        password_hash: passwordHash,
        name,
        phone,
        department_id,
        role: 'host'
      })
      .returning(['id', 'its_id', 'name', 'email', 'role']);

    logger.info(`New user registered: ${its_id}`);

    res.status(201).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed'
      }
    });
  }
};

export const refresh = async (_req: Request, res: Response): Promise<void> => {
  // Implement token refresh logic
  res.json({ success: true, message: 'Token refresh endpoint' });
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  // Implement logout logic (blacklist token if needed)
  res.json({ success: true, message: 'Logged out successfully' });
};
