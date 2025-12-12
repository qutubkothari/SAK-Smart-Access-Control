import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { visitorApi } from '../services/api';
import { QrCode, CheckCircle, User, Mail, Phone, Building } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';
import type { Visitor } from '../types';

export const ReceptionistPage: React.FC = () => {
  const [qrCode, setQrCode] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleScan = async () => {
    if (!qrCode.trim()) return;
    
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await visitorApi.checkIn(qrCode);
      setVisitor(response.data);
      setSuccess(true);
      setQrCode('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check in visitor');
      setVisitor(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      await visitorApi.checkOut(visitorId);
      setVisitor(null);
      setSuccess(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check out visitor');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visitor Check-In</h1>
          <p className="text-gray-600 mt-1">Scan QR code to check in visitors</p>
        </div>

        {/* QR Scanner */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                placeholder="Scan or enter QR code"
                className="input-field flex-1"
                autoFocus
              />
              <button
                onClick={handleScan}
                disabled={loading || !qrCode.trim()}
                className="btn-primary px-6 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check In'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && visitor && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-4">
                  <CheckCircle size={24} />
                  <span className="text-lg">Check-in Successful!</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-3">
                    <User className="text-green-600 mt-1" size={18} />
                    <div>
                      <p className="text-gray-600">Visitor Name</p>
                      <p className="font-medium text-gray-900">{visitor.name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="text-green-600 mt-1" size={18} />
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{visitor.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="text-green-600 mt-1" size={18} />
                    <div>
                      <p className="text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{visitor.phone}</p>
                    </div>
                  </div>

                  {visitor.company && (
                    <div className="flex items-start gap-3">
                      <Building className="text-green-600 mt-1" size={18} />
                      <div>
                        <p className="text-gray-600">Company</p>
                        <p className="font-medium text-gray-900">{visitor.company}</p>
                      </div>
                    </div>
                  )}

                  {visitor.badgeNumber && (
                    <div className="flex items-start gap-3">
                      <div className="text-green-600 mt-1 font-bold">##</div>
                      <div>
                        <p className="text-gray-600">Badge Number</p>
                        <p className="font-medium text-gray-900">{visitor.badgeNumber}</p>
                      </div>
                    </div>
                  )}

                  {visitor.checkInTime && (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-green-600 mt-1" size={18} />
                      <div>
                        <p className="text-gray-600">Checked In</p>
                        <p className="font-medium text-gray-900">
                          {formatDateTime(visitor.checkInTime)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {visitor.meeting && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <p className="text-sm text-gray-600">Meeting Details</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {visitor.meeting.location}
                      {visitor.meeting.roomNumber && ` - ${visitor.meeting.roomNumber}`}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDateTime(visitor.meeting.meetingTime)}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => handleCheckOut(visitor.id)}
                  className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
                >
                  Check Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Ask the visitor to present their QR code</li>
            <li>Scan the QR code using a scanner or manually enter the code</li>
            <li>Verify visitor details on the screen</li>
            <li>Issue a visitor badge if required</li>
            <li>Direct the visitor to the meeting location</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};
