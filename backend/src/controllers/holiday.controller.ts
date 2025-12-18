import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';
import { io } from '../server';

/**
 * Create holiday
 */
export const createHoliday = async (req: AuthRequest, res: Response) => {
  try {
    const { name, date, description, applicable_to_department, is_optional } = req.body;

    // Check if holiday already exists for this date and department
    let existingQuery = db('holidays').where({ date });
    
    if (applicable_to_department) {
      existingQuery = existingQuery.where({ applicable_to_department });
    } else {
      existingQuery = existingQuery.whereNull('applicable_to_department');
    }

    const existing = await existingQuery.first();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HOLIDAY_EXISTS',
          message: 'Holiday already exists for this date'
        }
      });
    }

    const holiday = await db('holidays').insert({
      name,
      date,
      description,
      applicable_to_department: applicable_to_department || null,
      is_optional: is_optional || false,
      is_active: true,
      created_by: req.user!.id
    }).returning('*');

    // Notify all users about new holiday
    io.emit('holiday_added', {
      type: 'holiday_added',
      holiday: holiday[0]
    });

    logger.info(`Holiday created: ${name} on ${date}`);

    return res.status(201).json({
      success: true,
      data: holiday[0],
      message: 'Holiday created successfully'
    });
  } catch (error) {
    logger.error('Error creating holiday:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create holiday'
      }
    });
  }
};

/**
 * Get holidays
 */
export const getHolidays = async (req: AuthRequest, res: Response) => {
  try {
    const { year, month, department_id, is_optional } = req.query;

    let query = db('holidays')
      .leftJoin('departments', 'holidays.applicable_to_department', 'departments.id')
      .select(
        'holidays.*',
        'departments.name as department_name'
      )
      .where('holidays.is_active', true)
      .orderBy('holidays.date', 'asc');

    // Filter by year
    if (year) {
      const yearStart = new Date(parseInt(year as string), 0, 1);
      const yearEnd = new Date(parseInt(year as string), 11, 31);
      query = query.where('holidays.date', '>=', yearStart).where('holidays.date', '<=', yearEnd);
    }

    // Filter by month
    if (month && year) {
      const monthStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const monthEnd = new Date(parseInt(year as string), parseInt(month as string), 0);
      query = query.where('holidays.date', '>=', monthStart).where('holidays.date', '<=', monthEnd);
    }

    // Filter by department or show company-wide + department-specific
    if (department_id) {
      query = query.where(function(this: any) {
        this.where('holidays.applicable_to_department', department_id as string)
          .orWhereNull('holidays.applicable_to_department');
      });
    }

    // Filter by optional
    if (is_optional !== undefined) {
      query = query.where('holidays.is_optional', is_optional === 'true');
    }

    const holidays = await query;

    return res.json({
      success: true,
      data: holidays,
      meta: {
        total: holidays.length
      }
    });
  } catch (error) {
    logger.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch holidays'
      }
    });
  }
};

/**
 * Get upcoming holidays
 */
export const getUpcomingHolidays = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id, limit = 10 } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = db('holidays')
      .leftJoin('departments', 'holidays.applicable_to_department', 'departments.id')
      .select(
        'holidays.*',
        'departments.name as department_name'
      )
      .where('holidays.is_active', true)
      .where('holidays.date', '>=', today)
      .orderBy('holidays.date', 'asc')
      .limit(Number(limit));

    if (department_id) {
      query = query.where(function(this: any) {
        this.where('holidays.applicable_to_department', department_id as string)
          .orWhereNull('holidays.applicable_to_department');
      });
    }

    const holidays = await query;

    return res.json({
      success: true,
      data: holidays
    });
  } catch (error) {
    logger.error('Error fetching upcoming holidays:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch upcoming holidays'
      }
    });
  }
};

/**
 * Update holiday
 */
export const updateHoliday = async (req: AuthRequest, res: Response) => {
  try {
    const { holiday_id } = req.params;
    const { name, date, description, applicable_to_department, is_optional } = req.body;

    const holiday = await db('holidays').where({ id: holiday_id }).first();

    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HOLIDAY_NOT_FOUND',
          message: 'Holiday not found'
        }
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (date) updateData.date = date;
    if (description !== undefined) updateData.description = description;
    if (applicable_to_department !== undefined) updateData.applicable_to_department = applicable_to_department;
    if (is_optional !== undefined) updateData.is_optional = is_optional;

    await db('holidays').where({ id: holiday_id }).update(updateData);

    const updated = await db('holidays').where({ id: holiday_id }).first();

    logger.info(`Holiday ${holiday_id} updated by ${req.user!.id}`);

    return res.json({
      success: true,
      data: updated,
      message: 'Holiday updated successfully'
    });
  } catch (error) {
    logger.error('Error updating holiday:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update holiday'
      }
    });
  }
};

/**
 * Delete holiday
 */
export const deleteHoliday = async (req: AuthRequest, res: Response) => {
  try {
    const { holiday_id } = req.params;

    const holiday = await db('holidays').where({ id: holiday_id }).first();

    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HOLIDAY_NOT_FOUND',
          message: 'Holiday not found'
        }
      });
    }

    // Soft delete
    await db('holidays').where({ id: holiday_id }).update({ is_active: false });

    logger.info(`Holiday ${holiday_id} deleted by ${req.user!.id}`);

    return res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting holiday:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete holiday'
      }
    });
  }
};

/**
 * Bulk import holidays
 */
export const bulkImportHolidays = async (req: AuthRequest, res: Response) => {
  try {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'Holidays must be a non-empty array'
        }
      });
    }

    const insertData = holidays.map(h => ({
      name: h.name,
      date: h.date,
      description: h.description || null,
      applicable_to_department: h.applicable_to_department || null,
      is_optional: h.is_optional || false,
      is_active: true,
      created_by: req.user!.id
    }));

    const inserted = await db('holidays').insert(insertData).returning('*');

    logger.info(`${inserted.length} holidays imported by ${req.user!.id}`);

    return res.status(201).json({
      success: true,
      data: inserted,
      message: `${inserted.length} holidays imported successfully`
    });
  } catch (error) {
    logger.error('Error bulk importing holidays:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to import holidays'
      }
    });
  }
};

/**
 * Get holiday calendar
 */
export const getHolidayCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31);

    const holidays = await db('holidays')
      .leftJoin('departments', 'holidays.applicable_to_department', 'departments.id')
      .select(
        'holidays.*',
        'departments.name as department_name'
      )
      .where('holidays.is_active', true)
      .where('holidays.date', '>=', yearStart)
      .where('holidays.date', '<=', yearEnd)
      .orderBy('holidays.date', 'asc');

    // Group by month
    const calendar: any = {};
    for (let month = 0; month < 12; month++) {
      calendar[month + 1] = [];
    }

    holidays.forEach((holiday: any) => {
      const month = new Date(holiday.date).getMonth() + 1;
      calendar[month].push({
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        description: holiday.description,
        department_name: holiday.department_name || 'Company-wide',
        is_optional: holiday.is_optional
      });
    });

    return res.json({
      success: true,
      data: {
        year: targetYear,
        total_holidays: holidays.length,
        calendar
      }
    });
  } catch (error) {
    logger.error('Error fetching holiday calendar:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch holiday calendar'
      }
    });
  }
};
