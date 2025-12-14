import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';

interface WebcamCaptureProps {
  onCapture: (photoDataUrl: string) => void;
  onCancel?: () => void;
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, onCancel }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(photoDataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const retake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const confirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      stopCamera();
    }
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedPhoto(null);
    if (onCancel) onCancel();
  };

  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        {!isStreaming && !capturedPhoto && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              className="btn-primary flex items-center gap-2"
            >
              <Camera size={20} />
              Start Camera
            </button>
          </div>
        )}

        {isStreaming && !capturedPhoto && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              <button
                onClick={capturePhoto}
                className="bg-white hover:bg-gray-100 text-gray-900 px-6 py-3 rounded-full font-medium shadow-lg"
              >
                <Camera size={24} />
              </button>
              <button
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-medium shadow-lg"
              >
                <X size={24} />
              </button>
            </div>
          </>
        )}

        {capturedPhoto && (
          <>
            <img
              src={capturedPhoto}
              alt="Captured"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              <button
                onClick={retake}
                className="bg-white hover:bg-gray-100 text-gray-900 px-6 py-3 rounded-full font-medium shadow-lg flex items-center gap-2"
              >
                <Camera size={20} />
                Retake
              </button>
              <button
                onClick={confirm}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-medium shadow-lg flex items-center gap-2"
              >
                <Check size={20} />
                Use Photo
              </button>
            </div>
          </>
        )}
      </div>

      <div className="text-center text-sm text-gray-600">
        <p>Position your face in the frame and click capture</p>
      </div>
    </div>
  );
};

interface PhotoUploadProps {
  onUpload: (file: File) => void;
  currentPhoto?: string;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ onUpload, currentPhoto }) => {
  const [preview, setPreview] = useState<string | undefined>(currentPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        onUpload(file);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-cover rounded-lg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-4 right-4 bg-white hover:bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium shadow-lg flex items-center gap-2"
          >
            <Upload size={18} />
            Change Photo
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-primary-600"
        >
          <Upload size={48} />
          <div className="text-center">
            <p className="font-medium">Upload Photo</p>
            <p className="text-sm">Click to select a file (Max 5MB)</p>
          </div>
        </button>
      )}
    </div>
  );
};
