import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { meetingApi } from '../services/api';
import { QrCode, Download, Calendar, Clock, MapPin, Users, CheckCircle, XCircle, Mail, Phone } from 'lucide-react';
import { formatDateTime, formatDuration } from '../utils/formatters';
import type { Meeting } from '../types';

export const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadMeeting(id);
  }, [id]);

  const loadMeeting = async (meetingId: string) => {
    try {
      const response = await meetingApi.getById(meetingId);
      const payload: any = response?.data;
      const data: any = payload?.data || payload;

      const normalizedVisitors = Array.isArray(data?.visitors)
        ? data.visitors.map((v: any) => ({
            id: v.id,
            meetingId: v.meetingId ?? v.meeting_id,
            name: v.name,
            email: v.email,
            phone: v.phone,
            company: v.company ?? undefined,
            city: v.city ?? undefined,
            state: v.state ?? undefined,
            visitorType: v.visitorType ?? v.visitor_type ?? 'guest',
            qrCode: v.qrCode ?? v.qr_code,
            qrCodeExpiresAt: v.qrCodeExpiresAt ?? v.qr_code_expires_at,
            checkInTime: v.checkInTime ?? v.check_in_time ?? undefined,
            checkOutTime: v.checkOutTime ?? v.check_out_time ?? undefined,
            photoUrl: v.photoUrl ?? v.photo_url ?? undefined,
            badgeNumber: v.badgeNumber ?? v.badge_number ?? undefined,
            idProofType: v.idProofType ?? v.id_proof_type ?? undefined,
            idProofNumber: v.idProofNumber ?? v.id_proof_number ?? undefined,
            purposeOfVisit: v.purposeOfVisit ?? v.purpose_of_visit ?? undefined,
            isBlacklisted: v.isBlacklisted ?? v.is_blacklisted ?? false,
            ndaSigned: v.ndaSigned ?? v.nda_signed ?? false,
            meeting: undefined,
          }))
        : undefined;

      const normalizedMeeting: Meeting = {
        id: data?.id,
        hostId: data?.hostId ?? data?.host_id,
        meetingTime: data?.meetingTime ?? data?.meeting_time,
        durationMinutes: data?.durationMinutes ?? data?.duration_minutes ?? 60,
        location: data?.location ?? '',
        roomNumber: data?.roomNumber ?? data?.room_number ?? undefined,
        purpose: data?.purpose ?? undefined,
        status: (data?.status ?? 'scheduled') as Meeting['status'],
        qrCodeUrl: data?.qrCodeUrl ?? data?.qr_code_url ?? undefined,
        qrCodeHash: data?.qrCodeHash ?? data?.qr_code_hash ?? undefined,
        hostCheckedIn: data?.hostCheckedIn ?? data?.host_checked_in ?? false,
        hostCheckInTime: data?.hostCheckInTime ?? data?.host_check_in_time ?? undefined,
        reminderSent: data?.reminderSent ?? data?.reminder_sent ?? false,
        notes: data?.notes ?? undefined,
        visitors: normalizedVisitors,
        host: data?.host ?? undefined,
        createdAt: data?.createdAt ?? data?.created_at ?? new Date().toISOString(),
      };

      setMeeting(normalizedMeeting);
    } catch (error) {
      console.error('Failed to load meeting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!id) return;
    try {
      await meetingApi.checkIn(id);
      loadMeeting(id);
    } catch (error) {
      console.error('Failed to check in:', error);
    }
  };

  const handleCancel = async () => {
    if (!id || !confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await meetingApi.cancel(id);
      navigate('/meetings');
    } catch (error) {
      console.error('Failed to cancel meeting:', error);
    }
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

  if (!meeting) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Meeting not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meeting Details</h1>
            <p className="text-gray-600 mt-1">View meeting information and QR codes</p>
          </div>
          <div className="flex gap-2">
            {meeting.status === 'scheduled' && !meeting.hostCheckedIn && (
              <button onClick={handleCheckIn} className="btn-primary">
                Check In
              </button>
            )}
            {meeting.status !== 'cancelled' && meeting.status !== 'completed' && (
              <button onClick={handleCancel} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
                Cancel Meeting
              </button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div>
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
            meeting.status === 'active' ? 'bg-green-100 text-green-700' :
            meeting.status === 'completed' ? 'bg-gray-100 text-gray-700' :
            'bg-red-100 text-red-700'
          }`}>
            {meeting.status === 'completed' ? <CheckCircle size={16} /> : meeting.status === 'cancelled' ? <XCircle size={16} /> : null}
            {(meeting.status || 'scheduled').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meeting Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Meeting Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-medium">{formatDateTime(meeting.meetingTime)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-medium">{formatDuration(meeting.durationMinutes)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-medium">{meeting.location}</p>
                    {meeting.roomNumber && <p className="text-sm text-gray-600">{meeting.roomNumber}</p>}
                  </div>
                </div>

                {meeting.purpose && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Purpose</p>
                    <p className="text-gray-900">{meeting.purpose}</p>
                  </div>
                )}

                {meeting.hostCheckedIn && meeting.hostCheckInTime && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 font-medium">✓ Host checked in at {formatDateTime(meeting.hostCheckInTime)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Visitors */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                <Users size={20} className="inline mr-2" />
                Visitors ({meeting.visitors?.length || 0})
              </h2>

              <div className="space-y-3">
                {meeting.visitors && meeting.visitors.length > 0 ? (
                  meeting.visitors.map((visitor) => (
                    <div key={visitor.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{visitor.name}</p>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p className="flex items-center gap-2">
                              <Mail size={14} />
                              {visitor.email}
                            </p>
                            <p className="flex items-center gap-2">
                              <Phone size={14} />
                              {visitor.phone}
                            </p>
                            {visitor.company && <p>{visitor.company}</p>}
                            {(visitor.city || visitor.state) && (
                              <p>
                                {[visitor.city, visitor.state].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          {visitor.checkInTime && (
                            <p className="text-xs text-green-600 mt-2">
                              ✓ Checked in at {formatDateTime(visitor.checkInTime)}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded capitalize ${
                          visitor.checkInTime ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {visitor.checkInTime ? 'Checked In' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">No visitors added</p>
                )}
              </div>
            </div>
          </div>

          {/* QR Code Sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                <QrCode size={20} className="inline mr-2" />
                QR Code
              </h2>

              {meeting.qrCodeUrl ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <img
                      src={meeting.qrCodeUrl || ''}
                      alt="Meeting QR Code"
                      className="w-full"
                    />
                  </div>

                  <a
                    href={meeting.qrCodeUrl || '#'}
                    download={`meeting-${meeting.id}-visitor-${meeting.visitors?.[0]?.id || 'qr'}.png`}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Download QR Code
                  </a>

                  <p className="text-xs text-gray-600 text-center">
                    Share this QR code with visitors for easy check-in
                  </p>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">QR code not generated</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
