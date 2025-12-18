import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { accessApi, visitorApi } from '../services/api';
import { QrCode, CheckCircle, User, Mail, Phone, Building, Camera } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';
import { WebcamCapture } from '../components/PhotoCapture';
import type { Visitor } from '../types';

export const ReceptionistPage: React.FC = () => {
  const [qrCode, setQrCode] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [checkoutConfirmation, setCheckoutConfirmation] = useState<any>(null);

  const [employeeMode, setEmployeeMode] = useState<'nfc' | 'manual_its'>('nfc');
  const [employeeCardNumber, setEmployeeCardNumber] = useState('');
  const [employeeItsId, setEmployeeItsId] = useState('');
  const [floorNumber, setFloorNumber] = useState<string>('');
  const [employeeResult, setEmployeeResult] = useState<any>(null);

  const handleEmployeeValidate = async () => {
    const floor = Number(floorNumber);
    if (!floorNumber.trim() || Number.isNaN(floor) || floor <= 0) {
      setError('Floor number is required for access validation');
      return;
    }

    const card = employeeCardNumber.trim();
    const its = employeeItsId.trim();
    if (employeeMode === 'nfc' && !card) return;
    if (employeeMode === 'manual_its' && !its) return;

    setError('');
    setLoading(true);
    setEmployeeResult(null);

    try {
      const response: any = await accessApi.validate({
        floor_number: floor,
        card_number: employeeMode === 'nfc' ? card : undefined,
        its_id: employeeMode === 'manual_its' ? its : undefined
      });
      setEmployeeResult(response.data?.data || response.data);
      setSuccess(true);
    } catch (err: any) {
      setEmployeeResult(null);
      setSuccess(false);
      setError(err.response?.data?.error?.message || 'Failed to validate employee access');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeLogEntry = async () => {
    const card = employeeCardNumber.trim();
    const its = employeeItsId.trim();
    const floor = floorNumber.trim() ? Number(floorNumber) : undefined;

    if (employeeMode === 'nfc' && !card) return;
    if (employeeMode === 'manual_its' && !its) return;

    setError('');
    setLoading(true);
    setEmployeeResult(null);

    try {
      const response: any = await accessApi.log({
        access_method: employeeMode === 'nfc' ? 'nfc' : 'manual_its',
        card_number: employeeMode === 'nfc' ? card : undefined,
        its_id: employeeMode === 'manual_its' ? its : undefined,
        floor_number: floor,
        is_entry: true
      });
      setEmployeeResult(response.data?.data || response.data);
      setSuccess(true);
      setEmployeeCardNumber('');
      setEmployeeItsId('');
    } catch (err: any) {
      setEmployeeResult(null);
      setSuccess(false);
      setError(err.response?.data?.error?.message || 'Failed to log employee access');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!qrCode.trim()) return;
    
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      if (capturedPhoto) {
        // Convert base64 to blob
        const photoBlob = await fetch(capturedPhoto).then(r => r.blob());
        const photoFile = new File([photoBlob], 'visitor-photo.jpg', { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('qr_code', qrCode);
        formData.append('photo', photoFile);
        
        const response: any = await visitorApi.checkInWithPhoto(formData);
        
        // Check if checkout confirmation is needed
        if (response.data?.action_required === 'CHECKOUT_CONFIRMATION') {
          setCheckoutConfirmation(response.data?.data || response.data);
          setQrCode('');
          return;
        }
        
        setVisitor(response.data?.data || response.data);
      } else {
        const response: any = await visitorApi.checkIn(qrCode);
        
        // Check if checkout confirmation is needed
        if (response.data?.action_required === 'CHECKOUT_CONFIRMATION') {
          setCheckoutConfirmation(response.data?.data || response.data);
          setQrCode('');
          return;
        }
        
        setVisitor(response.data?.data || response.data);
      }
      
      setSuccess(true);
      setQrCode('');
      setCapturedPhoto('');
      setShowPhotoCapture(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to check in visitor');
      setVisitor(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoCapture = (photoDataUrl: string) => {
    setCapturedPhoto(photoDataUrl);
    setShowPhotoCapture(false);
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

  const confirmCheckout = async () => {
    if (!checkoutConfirmation?.visitor_id) return;
    
    setLoading(true);
    try {
      await visitorApi.checkOut(checkoutConfirmation.visitor_id);
      setSuccess(true);
      setCheckoutConfirmation(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check out visitor');
    } finally {
      setLoading(false);
    }
  };

  const cancelCheckout = () => {
    setCheckoutConfirmation(null);
    setQrCode('');
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
                onClick={() => setShowPhotoCapture(true)}
                className="btn-secondary px-4"
                title="Capture Photo"
              >
                <Camera size={20} />
              </button>
              <button
                onClick={handleScan}
                disabled={loading || !qrCode.trim()}
                className="btn-primary px-6 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check In'}
              </button>
            </div>

            {capturedPhoto && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                <img src={capturedPhoto} alt="Visitor" className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">Photo captured</p>
                  <p className="text-xs text-green-600">Will be attached to check-in</p>
                </div>
                <button
                  onClick={() => setCapturedPhoto('')}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            )}

            {showPhotoCapture && (
              <div className="border-2 border-primary-200 rounded-lg p-4 bg-primary-50">
                <h3 className="font-medium text-gray-900 mb-4">Capture Visitor Photo</h3>
                <WebcamCapture
                  onCapture={handlePhotoCapture}
                  onCancel={() => setShowPhotoCapture(false)}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {checkoutConfirmation && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
                <div className="flex items-center gap-2 text-yellow-700 font-medium mb-4">
                  <CheckCircle size={24} />
                  <span className="text-lg">Visitor Already Checked In</span>
                </div>

                <div className="space-y-3 text-sm mb-4">
                  <div className="flex items-start gap-3">
                    <User className="text-yellow-600 mt-1" size={18} />
                    <div>
                      <p className="text-gray-600">Visitor Name</p>
                      <p className="font-medium text-gray-900">{checkoutConfirmation.visitor_name}</p>
                    </div>
                  </div>

                  {checkoutConfirmation.company && (
                    <div className="flex items-start gap-3">
                      <Building className="text-yellow-600 mt-1" size={18} />
                      <div>
                        <p className="text-gray-600">Company</p>
                        <p className="font-medium text-gray-900">{checkoutConfirmation.company}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-yellow-600 mt-1" size={18} />
                    <div>
                      <p className="text-gray-600">Checked In At</p>
                      <p className="font-medium text-gray-900">
                        {formatDateTime(checkoutConfirmation.check_in_time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 font-medium text-center">
                    Do you want to check out this visitor?
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={confirmCheckout}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50"
                  >
                    {loading ? 'Checking Out...' : 'Yes, Check Out'}
                  </button>
                  <button
                    onClick={cancelCheckout}
                    disabled={loading}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
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

        {/* Employee Access (NFC / Manual ITS) */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Employee Access</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="employeeMode"
                  checked={employeeMode === 'nfc'}
                  onChange={() => setEmployeeMode('nfc')}
                />
                NFC/Card Scan
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="employeeMode"
                  checked={employeeMode === 'manual_its'}
                  onChange={() => setEmployeeMode('manual_its')}
                />
                Manual ITS
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                {employeeMode === 'nfc' ? (
                  <input
                    type="text"
                    value={employeeCardNumber}
                    onChange={(e) => setEmployeeCardNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEmployeeLogEntry()}
                    placeholder="Scan NFC/card number"
                    className="input-field w-full"
                  />
                ) : (
                  <input
                    type="text"
                    value={employeeItsId}
                    onChange={(e) => setEmployeeItsId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEmployeeLogEntry()}
                    placeholder="Enter ITS ID"
                    className="input-field w-full"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Most NFC readers act like a keyboard and will type the card number here.
                </p>
              </div>

              <div>
                <input
                  type="number"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  placeholder="Floor # (optional for log)"
                  className="input-field w-full"
                  min={1}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleEmployeeValidate}
                disabled={loading}
                className="btn-secondary px-6 disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate Access'}
              </button>
              <button
                onClick={handleEmployeeLogEntry}
                disabled={
                  loading ||
                  (employeeMode === 'nfc' ? !employeeCardNumber.trim() : !employeeItsId.trim())
                }
                className="btn-primary px-6 disabled:opacity-50"
              >
                {loading ? 'Logging...' : 'Log Entry'}
              </button>
            </div>

            {employeeResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900">Result</p>
                  <p className="text-gray-600">
                    {employeeResult.access_granted ? 'Access granted' : 'Access denied'}
                  </p>
                </div>

                {employeeResult.employee && (
                  <p className="mt-2 text-gray-700">
                    Employee: <span className="font-medium">{employeeResult.employee.name}</span> ({employeeResult.employee.its_id})
                  </p>
                )}

                {employeeResult.access_details?.floor_number && (
                  <p className="text-gray-700">
                    Floor: <span className="font-medium">{employeeResult.access_details.floor_number}</span>
                  </p>
                )}

                {employeeResult.message && (
                  <p className="mt-2 text-gray-700">{employeeResult.message}</p>
                )}
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
