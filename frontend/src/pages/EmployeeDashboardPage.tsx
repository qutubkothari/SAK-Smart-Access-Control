import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Calendar, Clock, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

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

export const EmployeeDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [todaysMeetings, setTodaysMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load my meetings as host
      const meetingsResponse = await api.get('/meetings/my-meetings');
      console.log('My meetings response:', meetingsResponse);
      
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
      console.error('Failed to load employee dashboard:', error);
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
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-primary-100">Welcome back, {user?.name}!</p>
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
                <p className="text-sm text-gray-500">Schedule a visitor meeting</p>
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
                <h3 className="font-semibold text-gray-900">My Meetings</h3>
                <p className="text-sm text-gray-500">View all my meetings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/availability')}
            className="card hover:shadow-lg transition-shadow p-6 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Clock className="text-green-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Block Time</h3>
                <p className="text-sm text-gray-500">Manage my availability</p>
              </div>
            </div>
          </button>
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="text-gray-400" size={16} />
                        <span className="font-semibold text-gray-900">
                          {formatDateTime(meeting.meeting_time)}
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">{meeting.location}</p>
                      {meeting.purpose && (
                        <p className="text-sm text-gray-500 mt-1">{meeting.purpose}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                        <span>{meeting.visitor_count} visitor{meeting.visitor_count !== 1 ? 's' : ''}</span>
                        {meeting.visitors && meeting.visitors.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{meeting.visitors[0].name}</span>
                            {meeting.visitor_count > 1 && (
                              <span className="text-gray-400">+{meeting.visitor_count - 1} more</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {meeting.visitors?.some(v => v.check_in_time) ? (
                        <CheckCircle className="text-green-500" size={20} />
                      ) : (
                        <AlertCircle className="text-yellow-500" size={20} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold">Upcoming Meetings</h2>
            <span className="ml-auto bg-primary-100 text-primary-800 text-sm px-3 py-1 rounded-full">
              {upcomingMeetings.length} meeting{upcomingMeetings.length !== 1 ? 's' : ''}
            </span>
          </div>
          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto mb-2 text-gray-400" size={48} />
              <p>No upcoming meetings in the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="text-gray-400" size={16} />
                        <span className="font-semibold text-gray-900">
                          {formatDateTime(meeting.meeting_time)}
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">{meeting.location}</p>
                      {meeting.purpose && (
                        <p className="text-sm text-gray-500 mt-1">{meeting.purpose}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                        <span>{meeting.visitor_count} visitor{meeting.visitor_count !== 1 ? 's' : ''}</span>
                        {meeting.visitors && meeting.visitors.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{meeting.visitors[0].name}</span>
                            {meeting.visitor_count > 1 && (
                              <span className="text-gray-400">+{meeting.visitor_count - 1} more</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
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
