import axios from 'axios';
import type { AuthResponse, User, Meeting, Visitor, DashboardStats, CreateMeetingDto, LoginDto, RegisterDto, Department, Notification } from '../types';

// Prefer relative URL so the same build works locally + behind Nginx on EC2.
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  console.log('🔍 API Request:', config.url);
  
  // Don't add token to login/register endpoints
  if (config.url?.includes('/auth/login') || config.url?.includes('/auth/register')) {
    console.log('⏭️ Skipping auth for login/register endpoint');
    return config;
  }
  
  const token = localStorage.getItem('accessToken') || localStorage.getItem('auth-token');
  console.log('🎫 Token from localStorage:', token ? token.substring(0, 30) + '...' : 'NULL');
  
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Authorization header set');
  } else {
    console.log('⚠️ No valid token found');
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.config?.url, error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      console.log('🚫 401 Unauthorized - clearing storage and redirecting to login');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-token');
      localStorage.removeItem('auth-user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  login: (data: LoginDto) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterDto) => api.post<AuthResponse>('/auth/register', data),
  getProfile: () => api.get<User>('/auth/profile'),
  updateProfile: (data: Partial<User>) => api.put<User>('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) => 
    api.post('/auth/change-password', data),
};

// Meeting APIs
export const meetingApi = {
  create: (data: CreateMeetingDto) => api.post<Meeting>('/meetings', data),
  getAll: (params?: { status?: string; date?: string }) => api.get<Meeting[]>('/meetings', { params }),
  getById: (id: string) => api.get<Meeting>(`/meetings/${id}`),
  update: (id: string, data: Partial<Meeting>) => api.put<Meeting>(`/meetings/${id}`, data),
  cancel: (id: string) => api.patch<Meeting>(`/meetings/${id}/cancel`),
  checkIn: (id: string) => api.post<Meeting>(`/meetings/${id}/check-in`),
  getMyMeetings: () => api.get<Meeting[]>('/meetings/my-meetings'),
};

// Visitor APIs
export const visitorApi = {
  lookup: (params: { its_id?: string; phone?: string }) => api.get('/visitors/lookup', { params }),
  checkIn: (qrCode: string, data?: { photoUrl?: string }) => 
    api.post<Visitor>('/visitors/check-in', { qrCode, ...data }),
  checkOut: (id: string) => api.post<Visitor>(`/visitors/${id}/check-out`),
  getById: (id: string) => api.get<Visitor>(`/visitors/${id}`),
  getAll: (params?: { status?: string; date?: string }) => api.get<Visitor[]>('/visitors', { params }),
  getActive: () => api.get<Visitor[]>('/visitors/active'),
};

// Dashboard APIs
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getHostStats: () => api.get<DashboardStats>('/dashboard/host-stats'),
  getReceptionistStats: () => api.get<DashboardStats>('/dashboard/receptionist-stats'),
};

// User APIs
export const userApi = {
  searchHosts: (q: string) => api.get('/users/search-hosts', { params: { q } }),
  getAll: () => api.get<User[]>('/users'),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: RegisterDto) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.put<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Department APIs
export const departmentApi = {
  getAll: () => api.get<Department[]>('/departments'),
  getById: (id: string) => api.get<Department>(`/departments/${id}`),
  create: (data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Department>('/departments', data),
  update: (id: string, data: Partial<Department>) => api.put<Department>(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
};

// Notification APIs
export const notificationApi = {
  getAll: () => api.get<Notification[]>('/notifications'),
  markAsRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export default api;
