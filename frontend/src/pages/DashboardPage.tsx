import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Calendar, Users, UserCheck, Clock, Plus, TrendingUp, ArrowRight } from 'lucide-react';
import type { DashboardStats } from '../types';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = user?.role === 'host' 
        ? await dashboardApi.getHostStats()
        : await dashboardApi.getStats();
      const payload: any = response?.data;
      setStats((payload?.data ?? payload) as DashboardStats);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Today's Meetings",
      value: stats?.todayMeetings || 0,
      icon: Calendar,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Active Visitors',
      value: stats?.activeVisitors || 0,
      icon: Users,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: '+8%',
      trendUp: true,
    },
    {
      title: 'Pending Check-ins',
      value: stats?.pendingCheckIns || 0,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: '-3%',
      trendUp: false,
    },
    {
      title: 'Total Visitors',
      value: stats?.totalVisitorsToday || 0,
      icon: UserCheck,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: '+15%',
      trendUp: true,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary-500 border-t-transparent absolute top-0 left-0"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Clean Professional Header */}
      <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 px-6 py-6 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          {(user?.role === 'host' || user?.role === 'admin') && (
            <button
              onClick={() => navigate('/meetings/create')}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
            >
              <Plus size={20} />
              <span>New Meeting</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.iconBg} w-12 h-12 rounded-lg flex items-center justify-center`}>
                <card.icon className={`${card.iconColor} w-6 h-6`} strokeWidth={2} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                card.trendUp 
                  ? 'bg-green-50 text-green-700' 
                  : 'bg-red-50 text-red-700'
              }`}>
                <TrendingUp size={12} className={card.trendUp ? '' : 'rotate-180'} />
                {card.trend}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{card.title}</p>
              <h3 className="text-3xl font-semibold text-gray-900">
                {card.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Meetings */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="min-w-0 text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <Calendar className="text-primary-600" size={22} />
              </div>
              <span className="truncate">Upcoming Meetings</span>
            </h2>
            <button
              className="shrink-0 bg-transparent text-primary-700 hover:text-primary-800 font-medium text-sm hover:underline flex items-center gap-1 group"
              onClick={() => navigate('/meetings')}
            >
              View All
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Calendar className="text-gray-400" size={40} />
            </div>
            <h3 className="text-gray-900 font-bold text-lg mb-2">No Meetings Scheduled</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Start by creating your first meeting and invite visitors
            </p>
            <button
              onClick={() => navigate('/meetings/create')}
              className="btn-primary mx-auto"
            >
              <Plus size={18} />
              Create New Meeting
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Recent Visitors */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="min-w-0 text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Users className="text-emerald-600" size={22} />
              </div>
              <span className="truncate">Recent Visitors</span>
            </h2>
            <button
              className="shrink-0 bg-transparent text-primary-700 hover:text-primary-800 font-medium text-sm hover:underline flex items-center gap-1 group"
              onClick={() => navigate('/visitors')}
            >
              View All
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Users className="text-gray-400" size={40} />
            </div>
            <h3 className="text-gray-900 font-bold text-lg mb-2">No Visitor Activity</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Recent visitor check-ins and activity will appear here
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};
