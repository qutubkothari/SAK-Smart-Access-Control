import axios from 'axios';

// Prefer relative URL so the same build works locally + behind Nginx on EC2.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface SystemAnalytics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  overview: {
    total_users: number;
    total_meetings: number;
    total_visitors: number;
    active_meetings: number;
  };
  check_in_stats: {
    total: number;
    checked_in: number;
    checked_out: number;
    no_show: number;
    check_in_rate: number;
  };
  daily_trends: Array<{
    date: string;
    meetings: number;
  }>;
  daily_visitors: Array<{
    date: string;
    visitors: number;
  }>;
  top_departments: Array<{
    department: string;
    visitors: number;
    meetings: number;
  }>;
  peak_hours: Array<{
    hour: number;
    count: number;
  }>;
  meeting_status: Array<{
    status: string;
    count: number;
  }>;
}

export interface VisitorAnalytics {
  period_days: number;
  top_visitors: Array<{
    email: string;
    name: string;
    company: string | null;
    visit_count: number;
    last_visit: string;
  }>;
  top_companies: Array<{
    company: string;
    unique_visitors: number;
    total_visits: number;
  }>;
  visitor_types: Array<{
    type: string;
    count: number;
  }>;
  avg_visit_duration_minutes: number;
  geography: Array<{
    city: string;
    visitors: number;
  }>;
}

export interface AttendanceAnalytics {
  period_days: number;
  overall: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    leave: number;
    attendance_rate: number;
    avg_work_hours: number;
  };
  daily_trends: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
  }>;
  department_stats: Array<{
    department: string;
    total: number;
    present: number;
    attendance_rate: number;
  }>;
  late_patterns: Array<{
    hour: number;
    count: number;
  }>;
}

export interface MeetingRoomAnalytics {
  period_days: number;
  duration_stats: {
    total_meetings: number;
    avg_duration_minutes: number;
    min_duration: number;
    max_duration: number;
  };
  active_hosts: Array<{
    name: string;
    email: string;
    department: string | null;
    meetings: number;
    visitors: number;
  }>;
  location_distribution: Array<{
    location: string;
    count: number;
  }>;
  hourly_utilization: Array<{
    hour: number;
    meetings: number;
    total_minutes: number;
    avg_minutes: number;
  }>;
  top_purposes: Array<{
    purpose: string;
    count: number;
  }>;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('auth-token');
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const analyticsService = {
  getSystemAnalytics: async (period: number = 30, startDate?: string, endDate?: string): Promise<SystemAnalytics> => {
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.append('start_date', startDate);
      params.append('end_date', endDate);
    } else {
      params.append('period', period.toString());
    }
    
    const response = await axios.get(`${API_BASE_URL}/analytics/system?${params}`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  getVisitorAnalytics: async (period: number = 30): Promise<VisitorAnalytics> => {
    const response = await axios.get(`${API_BASE_URL}/analytics/visitors?period=${period}`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  getAttendanceAnalytics: async (period: number = 30, departmentId?: string): Promise<AttendanceAnalytics> => {
    const params = new URLSearchParams({ period: period.toString() });
    if (departmentId) {
      params.append('department_id', departmentId);
    }
    
    const response = await axios.get(`${API_BASE_URL}/analytics/attendance?${params}`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  getMeetingRoomAnalytics: async (period: number = 30): Promise<MeetingRoomAnalytics> => {
    const response = await axios.get(`${API_BASE_URL}/analytics/meeting-rooms?period=${period}`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },
};
