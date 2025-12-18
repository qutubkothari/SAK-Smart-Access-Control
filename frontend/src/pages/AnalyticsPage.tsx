import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import { analyticsService } from '../services/analyticsService';
import type { SystemAnalytics, VisitorAnalytics, AttendanceAnalytics, MeetingRoomAnalytics } from '../services/analyticsService';
import { BarChart3, TrendingUp, Users, Calendar, Clock, MapPin, Award, Building2 } from 'lucide-react';

export const AnalyticsPage = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role as string | undefined;
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [systemData, setSystemData] = useState<SystemAnalytics | null>(null);
  const [visitorData, setVisitorData] = useState<VisitorAnalytics | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceAnalytics | null>(null);
  const [meetingData, setMeetingData] = useState<MeetingRoomAnalytics | null>(null);

  // Keep in sync with backend route guards in `backend/src/routes/analytics.routes.ts`
  const canViewSystem = role === 'admin' || role === 'manager';
  const canViewVisitors = role === 'admin' || role === 'manager' || role === 'receptionist';
  const canViewAttendance = role === 'admin' || role === 'manager' || role === 'hr';
  const canViewMeetingRooms = role === 'admin' || role === 'manager';

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [system, visitor, meeting] = await Promise.all([
        canViewSystem ? analyticsService.getSystemAnalytics(period) : Promise.resolve(null),
        canViewVisitors ? analyticsService.getVisitorAnalytics(period) : Promise.resolve(null),
        canViewMeetingRooms ? analyticsService.getMeetingRoomAnalytics(period) : Promise.resolve(null),
      ]);

      setSystemData(system);
      setVisitorData(visitor);
      setMeetingData(meeting);

      if (canViewAttendance) {
        const attendance = await analyticsService.getAttendanceAnalytics(period);
        setAttendanceData(attendance);
      } else {
        setAttendanceData(null);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-gray-600">Comprehensive insights into your access control system</p>
        </div>

        {/* Period Selector */}
        <div className="mb-6 flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>

        {/* System Overview */}
        {systemData && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              System Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-6 h-6 text-blue-600" />}
                label="Total Users"
                value={systemData.overview.total_users}
                color="blue"
              />
              <StatCard
                icon={<Calendar className="w-6 h-6 text-green-600" />}
                label="Total Meetings"
                value={systemData.overview.total_meetings}
                color="green"
              />
              <StatCard
                icon={<Users className="w-6 h-6 text-purple-600" />}
                label="Total Visitors"
                value={systemData.overview.total_visitors}
                color="purple"
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-orange-600" />}
                label="Active Meetings"
                value={systemData.overview.active_meetings}
                color="orange"
              />
            </div>

            {/* Check-in Statistics */}
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Check-in Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{systemData.check_in_stats.total}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{systemData.check_in_stats.checked_in}</p>
                  <p className="text-sm text-gray-600">Checked In</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{systemData.check_in_stats.checked_out}</p>
                  <p className="text-sm text-gray-600">Checked Out</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{systemData.check_in_stats.no_show}</p>
                  <p className="text-sm text-gray-600">No Show</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{systemData.check_in_stats.check_in_rate}%</p>
                  <p className="text-sm text-gray-600">Check-in Rate</p>
                </div>
              </div>
            </div>

            {/* Top Departments */}
            {systemData.top_departments.length > 0 && (
              <div className="mt-6 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Top Departments by Visitor Count
                </h3>
                <div className="space-y-3">
                  {systemData.top_departments.slice(0, 5).map((dept, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                        <span className="font-medium text-gray-800">{dept.department}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-purple-600 font-semibold">{dept.visitors} visitors</span>
                        <span className="text-gray-600">{dept.meetings} meetings</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visitor Analytics */}
        {visitorData && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Visitor Analytics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Visitors */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Most Frequent Visitors
                </h3>
                <div className="space-y-3">
                  {visitorData.top_visitors.slice(0, 5).map((visitor, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-gray-800">{visitor.name}</p>
                        <p className="text-sm text-gray-600">{visitor.company || 'No company'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-600">{visitor.visit_count} visits</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Companies */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Top Companies
                </h3>
                <div className="space-y-3">
                  {visitorData.top_companies.slice(0, 5).map((company, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <p className="font-medium text-gray-800">{company.company}</p>
                      <div className="text-right text-sm">
                        <p className="font-bold text-blue-600">{company.total_visits} visits</p>
                        <p className="text-gray-600">{company.unique_visitors} visitors</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visitor Types */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Visitor Types</h3>
                <div className="space-y-2">
                  {visitorData.visitor_types.map((type, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{type.type.replace('_', ' ')}</span>
                      <span className="font-semibold text-gray-900">{type.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geography */}
              {visitorData.geography.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    Geographic Distribution
                  </h3>
                  <div className="space-y-2">
                    {visitorData.geography.slice(0, 5).map((geo, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-gray-700">{geo.city}</span>
                        <span className="font-semibold text-gray-900">{geo.visitors} visitors</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Average Visit Duration */}
            <div className="mt-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg shadow p-6 text-white">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8" />
                <div>
                  <p className="text-sm opacity-90">Average Visit Duration</p>
                  <p className="text-3xl font-bold">{visitorData.avg_visit_duration_minutes} minutes</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Analytics */}
        {canViewAttendance && attendanceData && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Attendance Analytics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Users className="w-6 h-6 text-green-600" />}
                label="Present"
                value={attendanceData.overall.present}
                color="green"
              />
              <StatCard
                icon={<Users className="w-6 h-6 text-red-600" />}
                label="Absent"
                value={attendanceData.overall.absent}
                color="red"
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-yellow-600" />}
                label="Late"
                value={attendanceData.overall.late}
                color="yellow"
              />
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow p-6 text-white">
                <p className="text-sm opacity-90">Attendance Rate</p>
                <p className="text-3xl font-bold mt-2">{attendanceData.overall.attendance_rate}%</p>
                <p className="text-sm mt-1 opacity-75">Avg: {attendanceData.overall.avg_work_hours.toFixed(1)} hrs/day</p>
              </div>
            </div>

            {/* Department Stats */}
            {attendanceData.department_stats.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Department Attendance</h3>
                <div className="space-y-3">
                  {attendanceData.department_stats.slice(0, 5).map((dept, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{dept.department}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{dept.present}/{dept.total}</span>
                        <span className={`font-bold ${
                          dept.attendance_rate >= 90 ? 'text-green-600' :
                          dept.attendance_rate >= 75 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {dept.attendance_rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meeting Room Analytics */}
        {meetingData && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Meeting Room Utilization
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Calendar className="w-6 h-6 text-blue-600" />}
                label="Total Meetings"
                value={meetingData.duration_stats.total_meetings}
                color="blue"
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-green-600" />}
                label="Avg Duration"
                value={`${meetingData.duration_stats.avg_duration_minutes} min`}
                color="green"
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-gray-600" />}
                label="Min Duration"
                value={`${meetingData.duration_stats.min_duration} min`}
                color="gray"
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-purple-600" />}
                label="Max Duration"
                value={`${meetingData.duration_stats.max_duration} min`}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Hosts */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Most Active Hosts
                </h3>
                <div className="space-y-3">
                  {meetingData.active_hosts.slice(0, 5).map((host, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-gray-800">{host.name}</p>
                        <p className="text-sm text-gray-600">{host.department || 'No department'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-bold text-blue-600">{host.meetings} meetings</p>
                        <p className="text-gray-600">{host.visitors} visitors</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600" />
                  Popular Locations
                </h3>
                <div className="space-y-2">
                  {meetingData.location_distribution.slice(0, 5).map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-700">{loc.location}</span>
                      <span className="font-semibold text-gray-900">{loc.count} meetings</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    gray: 'from-gray-500 to-gray-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-lg shadow p-6 text-white`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-sm opacity-90">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
};
