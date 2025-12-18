import { Request, Response } from 'express';
import db from '../config/database';

// Get all departments
export const getAllDepartments = async (_req: Request, res: Response) => {
  try {
    const departments = await db('departments as d')
      .leftJoin('users as u', function() {
        this.on('d.id', '=', 'u.department_id')
          .andOn('u.is_active', '=', db.raw('?', [true]));
      })
      .select(
        'd.id',
        'd.name',
        'd.code',
        'd.created_at',
        'd.updated_at'
      )
      .count('u.id as employee_count')
      .groupBy('d.id', 'd.name', 'd.code', 'd.created_at', 'd.updated_at')
      .orderBy('d.name', 'asc');

    res.json({
      success: true,
      data: departments
    });
  } catch (error: any) {
    console.error('Get all departments error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch departments',
        details: error.message
      }
    });
  }
};

// Get department by ID
export const getDepartmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const departments = await db('departments as d')
      .leftJoin('users as u', function() {
        this.on('d.id', '=', 'u.department_id')
          .andOn('u.is_active', '=', db.raw('?', [true]));
      })
      .select(
        'd.id',
        'd.name',
        'd.code',
        'd.created_at',
        'd.updated_at'
      )
      .count('u.id as employee_count')
      .where('d.id', id)
      .groupBy('d.id', 'd.name', 'd.code', 'd.created_at', 'd.updated_at');

    if (departments.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Department not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: departments[0]
    });
  } catch (error: any) {
    console.error('Get department by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch department',
        details: error.message
      }
    });
  }
};
