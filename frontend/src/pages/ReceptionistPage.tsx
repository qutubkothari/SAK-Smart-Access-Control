import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { visitorApi } from '../services/api';
import { QrCode, CheckCircle, User, Mail, Phone, Building, Camera } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';
import { WebcamCapture } from '../components/PhotoCapture';
import type { Visitor } from '../types';
import { BrowserQRCodeReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export const ReceptionistPage: React.FC = () => {
  const [qrCode, setQrCode] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scannerStatus, setScannerStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const barcodeLoopRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const handleScan = async (overrideQrCode?: string) => {
    const qrToUse = (overrideQrCode ?? qrCode).trim();
    if (!qrToUse) return;
    
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      if (capturedPhoto) {
        // Convert base64 to blob
        const photoBlob = await fetch(capturedPhoto).then(r => r.blob());
        const photoFile = new File([photoBlob], 'visitor-photo.jpg', { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('qr_code', qrToUse);
        formData.append('photo', photoFile);
        
        const response = await visitorApi.checkInWithPhoto(formData);
        setVisitor(response.data);
      } else {
        const response = await visitorApi.checkIn(qrToUse);
        setVisitor(response.data);
      }
      
      setSuccess(true);
      setQrCode('');
      setCapturedPhoto('');
      setShowPhotoCapture(false);

      // Auto-refresh after a successful scan so the page is ready for the next visitor.
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to check in visitor');
      setVisitor(null);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (barcodeLoopRef.current) {
      window.clearTimeout(barcodeLoopRef.current);
      barcodeLoopRef.current = null;
    }

    try {
      stopScanRef.current?.();
    } catch {
      // ignore
    }
    stopScanRef.current = null;

    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerStatus('');
  };

  const startCameraStream = async (): Promise<MediaStream> => {
    const videoConstraints: any = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    };
    if (selectedCameraId) {
      videoConstraints.deviceId = { exact: selectedCameraId };
    }
    return navigator.mediaDevices.getUserMedia({ video: videoConstraints });
  };

  const startWithBarcodeDetector = async () => {
    // BarcodeDetector is supported in Chrome/Edge (Android) and is usually more reliable.
    const AnyWindow = window as any;
    const Detector = AnyWindow.BarcodeDetector as
      | (new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<any[]> })
      | undefined;
    if (!Detector) return false;

    const stream = await startCameraStream();
    if (!videoRef.current) throw new Error('Camera is not available.');
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    const detector = new Detector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Scanner unavailable.');

    setScannerStatus('Scanning…');

    const tick = async () => {
      if (!videoRef.current || !cameraOpen) return;
      const v = videoRef.current;
      if (v.readyState < 2) {
        barcodeLoopRef.current = window.setTimeout(tick, 120);
        return;
      }

      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 720;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

      try {
        const codes = await detector.detect(canvas);
        const first = codes?.[0];
        const raw = first?.rawValue;
        if (raw && typeof raw === 'string') {
          setQrCode(raw);
          setCameraOpen(false);
          stopCamera();
          await handleScan(raw);
          return;
        }
      } catch {
        // ignore frame errors
      }

      barcodeLoopRef.current = window.setTimeout(tick, 120);
    };

    barcodeLoopRef.current = window.setTimeout(tick, 100);
    stopScanRef.current = () => {
      // loop is cleaned in stopCamera
    };

    return true;
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
    setSuccess(false);

    if (!window.isSecureContext) {
      setCameraError('Camera scanning requires HTTPS (secure context).');
      return;
    }

    if (!videoRef.current) {
      setCameraError('Camera is not available.');
      return;
    }

    try {
      // Prefer native detector when available (Android Chrome)
      const startedNative = await startWithBarcodeDetector();
      if (startedNative) return;

      if (!readerRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        readerRef.current = new BrowserQRCodeReader(hints, {
          delayBetweenScanAttempts: 100,
          delayBetweenScanSuccess: 750,
          tryPlayVideoTimeout: 5000
        });
      }

      stopCamera();

      setScannerStatus('Scanning…');

      const videoConstraints: any = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      };
      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
      }

      const controls = await readerRef.current.decodeFromConstraints(
        { video: videoConstraints },
        videoRef.current,
        async (result, err, ctrl) => {
          if (result) {
            const text = result.getText();
            setQrCode(text);
            setCameraOpen(false);
            try {
              ctrl.stop();
            } catch {
              // ignore
            }
            stopCamera();
            await handleScan(text);
            return;
          }

          if (err) {
            const name = typeof (err as any)?.name === 'string' ? (err as any).name : '';
            if (name && /notfound/i.test(name)) return;
          }
        }
      );

      stopScanRef.current = () => {
        try {
          controls.stop();
        } catch {
          // ignore
        }
      };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : 'Failed to access camera.';
      setCameraError(message);
      setCameraOpen(false);
      stopCamera();
    }
  };

  useEffect(() => {
    const loadCameras = async () => {
      try {
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        setCameras(devices);
        if (!selectedCameraId && devices.length > 0) {
          const preferred =
            devices.find((d) => /back|rear|environment/i.test(d.label)) ??
            devices[devices.length - 1] ??
            devices[0];
          if (preferred?.deviceId) setSelectedCameraId(preferred.deviceId);
        }
      } catch {
        // ignore
      }
    };

    if (cameraOpen) loadCameras();
  }, [cameraOpen, selectedCameraId]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

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
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                placeholder="Scan or enter QR code"
                className="input-field flex-1"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCameraOpen((v) => !v);
                    setCameraError('');
                    if (cameraOpen) {
                      stopCamera();
                    }
                  }}
                  className="btn-secondary px-4"
                  type="button"
                  title="Scan with Camera"
                >
                  <QrCode size={20} />
                </button>

                <button
                  onClick={() => setShowPhotoCapture(true)}
                  className="btn-secondary px-4"
                  type="button"
                  title="Capture Photo"
                >
                  <Camera size={20} />
                </button>

                <button
                  onClick={() => handleScan()}
                  disabled={loading || !qrCode.trim()}
                  className="btn-primary px-6 disabled:opacity-50"
                  type="button"
                >
                  {loading ? 'Checking...' : 'Check In'}
                </button>
              </div>
            </div>

            {cameraOpen && (
              <div className="border-2 border-primary-200 rounded-lg p-4 bg-primary-50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">Camera Scanner</p>
                  <div className="flex gap-2">
                    <button
                      onClick={startCamera}
                      className="btn-primary"
                      type="button"
                      disabled={loading}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => {
                        setCameraOpen(false);
                        stopCamera();
                      }}
                      className="btn-secondary"
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {cameras.length > 1 && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="text-sm text-gray-700">Camera</label>
                    <select
                      className="input-field"
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                    >
                      {cameras.map((d, idx) => (
                        <option key={d.deviceId || String(idx)} value={d.deviceId}>
                          {d.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  muted
                  playsInline
                  autoPlay
                />

                <p className="text-sm text-gray-600">
                  {scannerStatus ? scannerStatus : 'Point the camera at the visitor’s QR code.'}
                </p>
              </div>
            )}

            {cameraError && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                {cameraError}
              </div>
            )}

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
            <li>Tap the QR button to scan with camera, or manually enter the code</li>
            <li>Verify visitor details on the screen</li>
            <li>Issue a visitor badge if required</li>
            <li>Direct the visitor to the meeting location</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};
