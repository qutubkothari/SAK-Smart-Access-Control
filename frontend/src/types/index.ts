export interface User {
  id: string;
  itsId: string;
  email: string;
  name: string;
  phone?: string;
  departmentId?: string;
  role: 'admin' | 'security' | 'receptionist' | 'host';
  profilePhotoUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Meeting {
  id: string;
  hostId: string;
  meetingTime: string;
  durationMinutes: number;
  location: string;
  roomNumber?: string;
  purpose?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  qrCodeUrl?: string;
  qrCodeHash?: string;
  hostCheckedIn: boolean;
  hostCheckInTime?: string;
  reminderSent: boolean;
  notes?: string;
  visitors?: Visitor[];
  host?: User;
  createdAt: string;
}

export interface Visitor {
  id: string;
  meetingId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  visitorType: 'guest' | 'vendor' | 'contractor' | 'vip';
  qrCode: string;
  qrCodeExpiresAt: string;
  checkInTime?: string;
  checkOutTime?: string;
  photoUrl?: string;
  badgeNumber?: string;
  idProofType?: string;
  idProofNumber?: string;
  purposeOfVisit?: string;
  isBlacklisted: boolean;
  ndaSigned: boolean;
  meeting?: Meeting;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  managerId?: string;
  floorNumber?: number;
  building?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: 'meeting_created' | 'meeting_reminder' | 'visitor_checkin' | 'visitor_waiting' | 'meeting_cancelled';
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'read';
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  todayMeetings: number;
  activeVisitors: number;
  pendingCheckIns: number;
  totalVisitorsToday: number;
  upcomingMeetings: Meeting[];
  recentVisitors: Visitor[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface CreateMeetingDto {
  host_id: string;
  meeting_time: string;
  duration_minutes: number;
  location: string;
  room_number?: string;
  purpose?: string;
  visitors: {
    its_id?: string;
    name: string;
    email: string;
    phone: string;
    company?: string;
    visitor_type?: string;
  }[];
}

export interface HostSearchResult {
  id: string;
  its_id: string;
  name: string;
  email: string;
  phone?: string;
  department_id?: string;
  department_name?: string;
  floor_number?: number;
  building?: string;
}

export interface LoginDto {
  its_id: string;
  password: string;
}

export interface RegisterDto {
  itsId: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  departmentId?: string;
}
