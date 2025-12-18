import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Layout } from '../components/Layout';
import { meetingApi } from '../services/api';
import { socketService } from '../services/socket';
import type { Meeting } from '../types';

export const MeetingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('meeting_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const normalizeMeeting = (m: any): Meeting => ({
    id: m?.id,
    hostId: m?.hostId ?? m?.host_id,
    hostName: m?.hostName ?? m?.host_name,
    meetingTime: m?.meetingTime ?? m?.meeting_time ?? m?.start_time,
    durationMinutes: m?.durationMinutes ?? m?.duration_minutes ?? 60,
    location: m?.location ?? '',
    roomNumber: m?.roomNumber ?? m?.room_number,
    purpose: m?.purpose,
    status: (m?.status ?? 'scheduled') as Meeting['status'],
    qrCodeUrl: m?.qrCodeUrl ?? m?.qr_code_url,
    qrCodeHash: m?.qrCodeHash ?? m?.qr_code_hash,
    hostCheckedIn: m?.hostCheckedIn ?? m?.host_checked_in ?? false,
    hostCheckInTime: m?.hostCheckInTime ?? m?.host_check_in_time,
    reminderSent: m?.reminderSent ?? m?.reminder_sent ?? false,
    notes: m?.notes,
    visitors: m?.visitors,
    visitorCount: m?.visitorCount ?? m?.visitor_count,
    host: m?.host,
    createdAt: m?.createdAt ?? m?.created_at ?? new Date().toISOString(),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await meetingApi.getAll();
        const payload: any = res?.data;
        const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        const normalized = Array.isArray(list) ? list.map(normalizeMeeting) : [];
        setMeetings(normalized);
      } catch (e) {
        console.error('Failed to load meetings', e);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Real-time updates
    const handleMeetingCreated = () => {
      load();
    };
    const handleMeetingUpdated = () => {
      load();
    };

    socketService.on('meeting:created', handleMeetingCreated);
    socketService.on('meeting:updated', handleMeetingUpdated);

    return () => {
      socketService.off('meeting:created', handleMeetingCreated);
      socketService.off('meeting:updated', handleMeetingUpdated);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Array.isArray(meetings) ? meetings : [];
    
    // Filter by status
    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }
    
    // Filter by search query
    if (q) {
      list = list.filter((m) => {
        const title = (m as any).title ?? m.purpose ?? 'Meeting';
        const location = m.location ?? '';
        const hostName = m.hostName ?? '';
        return [title, location, hostName].some((v) => String(v).toLowerCase().includes(q));
      });
    }
    
    // Sort
    list.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortBy === 'meeting_time') {
        aVal = new Date(a.meetingTime).getTime();
        bVal = new Date(b.meetingTime).getTime();
      } else if (sortBy === 'location') {
        aVal = a.location?.toLowerCase() || '';
        bVal = b.location?.toLowerCase() || '';
      } else if (sortBy === 'status') {
        aVal = a.status || '';
        bVal = b.status || '';
      } else {
        return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return list;
  }, [meetings, query, statusFilter, sortBy, sortOrder]);

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage visitor meetings.</p>
        </div>
        <button
          onClick={() => navigate('/meetings/create')}
          className="btn-primary"
        >
          <Plus size={18} />
          Create Meeting
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-900 font-medium">
              <Calendar size={18} className="text-primary-700" />
              All Meetings
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1 sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input-field pl-9 w-full"
                  placeholder="Search meetings..."
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowUpDown size={16} className="text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="meeting_time">Date</option>
                <option value="location">Location</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No meetings found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-4 font-medium">Purpose</th>
                  <th className="py-3 pr-4 font-medium">Host</th>
                  <th className="py-3 pr-4 font-medium">Visitors</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Location</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-medium text-gray-900">{m.purpose || 'Meeting'}</td>
                    <td className="py-3 pr-4 text-gray-700">{m.hostName || '-'}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {m.visitorCount ? `${m.visitorCount} visitor${m.visitorCount > 1 ? 's' : ''}` : '-'}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{m.meetingTime ? new Date(m.meetingTime).toLocaleString() : '-'}</td>
                    <td className="py-3 pr-4 text-gray-700">{m.location || '-'}</td>
                    <td className="py-3 pr-4">
                      <span className="badge badge-primary">{m.status || 'scheduled'}</span>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        className="text-primary-700 hover:text-primary-800 font-medium"
                        onClick={() => navigate(`/meetings/${m.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};
