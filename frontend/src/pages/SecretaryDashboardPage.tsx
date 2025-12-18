import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Users, Calendar, UserPlus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Employee {
  id: string;
  its_id: string;
  name: string;
  email: string;
  department_id: string;
}

interface Meeting {
  id: string;
  meeting_time: string;
  location: string;
  purpose: string;
  status: string;
  host_id: string;
  host_name: string;
  visitor_count: number;
  visitors: Array<{
    id: string;
    name: string;
    email: string;
    check_in_time: string | null;
  }>;
}

export const SecretaryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [todaysMeetings, setTodaysMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load assigned employees
      const employeesResponse = await api.get('/secretaries/my-employees');
      console.log('Employees response:', employeesResponse);
      
      // axios returns response.data which contains {success, data: [...]}
      // So we need to access employeesResponse.data.data
      const employeesList: Employee[] = employeesResponse.data?.data || employeesResponse.data || [];
      setEmployees(employeesList);

      // Load meetings for assigned employees
      const meetingsResponse = await api.get('/meetings?role=secretary');
      console.log('Meetings response:', meetingsResponse);
      
      // axios returns response.data which contains {success, data: [...]}
      const meetingsList: Meeting[] = meetingsResponse.data?.data || meetingsResponse.data || [];
      console.log('Meetings list:', meetingsList);

      // Filter today's meetings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysFiltered = meetingsList.filter((meeting: Meeting) => {
        const meetingDate = new Date(meeting.meeting_time);
        return meetingDate >= today && meetingDate < tomorrow;
      });

      // Filter upcoming meetings (next 7 days)
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingFiltered = meetingsList.filter((meeting: Meeting) => {
        const meetingDate = new Date(meeting.meeting_time);
        return meetingDate >= tomorrow && meetingDate < nextWeek;
      });

      setTodaysMeetings(todaysFiltered);
      setUpcomingMeetings(upcomingFiltered);
    } catch (error) {
      console.error('Failed to load secretary dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Secretary Dashboard</h1>
          <p className="text-primary-100">Welcome back, {user?.name}!</p>
          <p className="text-sm text-primary-200 mt-1">
            Managing {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/meetings/create')}
            className="card hover:shadow-lg transition-shadow p-6 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                <UserPlus className="text-primary-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create Meeting</h3>
                <p className="text-sm text-gray-500">Schedule for your employees</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/meetings')}
            className="card hover:shadow-lg transition-shadow p-6 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Calendar className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">View All Meetings</h3>
                <p className="text-sm text-gray-500">See complete schedule</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/meetings/internal/book')}
            className="card hover:shadow-lg transition-shadow p-6 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Users className="text-green-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Book Meeting Room</h3>
                <p className="text-sm text-gray-500">Internal meetings</p>
              </div>
            </div>
          </button>
        </div>

        {/* Assigned Employees */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold">Your Assigned Employees</h2>
          </div>
          {employees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto mb-2 text-gray-400" size={48} />
              <p>No employees assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <div key={employee.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                      <p className="text-sm text-gray-500">{employee.its_id}</p>
                      <p className="text-xs text-gray-400 mt-1">{employee.email}</p>
                    </div>
                    <button
                      onClick={() => navigate('/meetings/create')}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      Book Meeting
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Meetings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Today's Meetings</h2>
            <span className="ml-auto bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
              {todaysMeetings.length} meeting{todaysMeetings.length !== 1 ? 's' : ''}
            </span>
          </div>
          {todaysMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto mb-2 text-gray-400" size={48} />
              <p>No meetings scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{meeting.purpose || 'No purpose specified'}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Host: {meeting.host_name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDateTime(meeting.meeting_time)}
                        </span>
                        <span>{meeting.location}</span>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {meeting.visitor_count} visitor{meeting.visitor_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  {meeting.visitors && meeting.visitors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Visitors:</p>
                      <div className="flex flex-wrap gap-2">
                        {meeting.visitors.map((visitor) => (
                          <div
                            key={visitor.id}
                            className="flex items-center gap-1 text-xs bg-gray-50 px-2 py-1 rounded"
                          >
                            {visitor.check_in_time ? (
                              <CheckCircle size={12} className="text-green-600" />
                            ) : (
                              <AlertCircle size={12} className="text-orange-600" />
                            )}
                            <span>{visitor.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings (Next 7 Days) */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-green-600" size={24} />
            <h2 className="text-xl font-bold">Upcoming Meetings</h2>
            <span className="ml-auto bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
              {upcomingMeetings.length} meeting{upcomingMeetings.length !== 1 ? 's' : ''}
            </span>
          </div>
          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto mb-2 text-gray-400" size={48} />
              <p>No upcoming meetings in the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{meeting.purpose || 'No purpose'}</h3>
                      <p className="text-xs text-gray-600">Host: {meeting.host_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{formatDateTime(meeting.meeting_time)}</span>
                        <span>{meeting.location}</span>
                        <span>{meeting.visitor_count} visitor{meeting.visitor_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(meeting.status)}`}>
                      {meeting.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
