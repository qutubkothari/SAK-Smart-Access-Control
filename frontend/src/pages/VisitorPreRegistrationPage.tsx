import React, { useState } from 'react';
import { UserPlus, Mail, Phone, Building, Calendar, FileText, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { WebcamCapture, PhotoUpload } from '../components/PhotoCapture';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

interface PreRegisterForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  visitor_type: string;
  host_its_id: string;
  visit_date: string;
  purpose: string;
  id_proof_type: string;
  id_proof_number: string;
  nda_accepted: boolean;
}

export const VisitorPreRegistrationPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [showWebcam, setShowWebcam] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');

  const [formData, setFormData] = useState<PreRegisterForm>({
    name: '',
    email: '',
    phone: '',
    company: '',
    visitor_type: 'guest',
    host_its_id: '',
    visit_date: '',
    purpose: '',
    id_proof_type: '',
    id_proof_number: '',
    nda_accepted: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoCapture = (dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setShowWebcam(false);
  };

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      setError('Please fill in all required fields');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!formData.host_its_id || !formData.visit_date) {
      setError('Please fill in all required fields');
      return false;
    }

    const visitDate = new Date(formData.visit_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (visitDate < today) {
      setError('Visit date cannot be in the past');
      return false;
    }

    return true;
  };

  const nextStep = () => {
    setError('');
    
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      // Submit pre-registration
      const response = await axios.post(`${API_BASE_URL}/preregister/register`, formData);

      if (response.data.success) {
        setSuccess(true);
        setQrCode(response.data.data.qr_code);

        // Upload photo if captured
        if (photoDataUrl && response.data.data.visitor_id) {
          try {
            const photoBlob = await fetch(photoDataUrl).then(r => r.blob());
            const photoFile = new File([photoBlob], 'visitor-photo.jpg', { type: 'image/jpeg' });
            
            const formData = new FormData();
            formData.append('photo', photoFile);

            await axios.post(
              `${API_BASE_URL}/preregister/visitors/${response.data.data.visitor_id}/photo`,
              formData,
              {
                headers: { 'Content-Type': 'multipart/form-data' }
              }
            );
          } catch (photoErr) {
            console.error('Photo upload failed:', photoErr);
            // Continue anyway - photo is optional
          }
        }
      }
    } catch (err: any) {
      console.error('Pre-registration error:', err);
      setError(err.response?.data?.error?.message || 'Failed to complete pre-registration');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={48} />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Registration Successful!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Your visit has been pre-registered. Please check your email for the QR code and visit details.
          </p>

          {qrCode && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-600 mb-4">Your QR Code:</p>
              <img src={qrCode} alt="QR Code" className="mx-auto w-64 h-64" />
              <p className="text-sm text-gray-600 mt-4">
                Save this QR code or show it from your email when you arrive
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">What's next?</p>
            <ul className="text-blue-700 text-sm mt-2 space-y-1 text-left">
              <li>✓ QR code sent to your email</li>
              <li>✓ Host has been notified</li>
              <li>✓ Bring your QR code on visit date</li>
              <li>✓ Bring valid ID proof</li>
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Register Another Visitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Visitor Pre-Registration</h1>
          <p className="text-gray-600">Register your visit in advance and get your QR code</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((num) => (
            <React.Fragment key={num}>
              <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold ${
                step >= num ? 'bg-primary-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {num}
              </div>
              {num < 3 && (
                <div className={`w-24 h-1 ${step > num ? 'bg-primary-600' : 'bg-gray-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Personal Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="+1 234 567 8900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company/Organization
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="ABC Corporation"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visitor Type
                </label>
                <select
                  name="visitor_type"
                  value={formData.visitor_type}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="guest">Guest</option>
                  <option value="vendor">Vendor</option>
                  <option value="contractor">Contractor</option>
                  <option value="consultant">Consultant</option>
                  <option value="candidate">Job Candidate</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button onClick={nextStep} className="btn-primary">
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Visit Details */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Visit Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Host ITS ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="host_its_id"
                  value={formData.host_its_id}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="ITS123456"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Enter the ITS ID of the person you're visiting</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visit Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="datetime-local"
                    name="visit_date"
                    value={formData.visit_date}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purpose of Visit
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400" size={20} />
                  <textarea
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="input-field pl-10 min-h-[100px]"
                    placeholder="Meeting, Interview, Delivery, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Proof Type
                  </label>
                  <select
                    name="id_proof_type"
                    value={formData.id_proof_type}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    <option value="">Select ID Type</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="national_id">National ID</option>
                    <option value="employee_id">Employee ID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number
                  </label>
                  <input
                    type="text"
                    name="id_proof_number"
                    value={formData.id_proof_number}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="ID Number"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="nda_accepted"
                    checked={formData.nda_accepted}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  <span className="text-sm text-blue-900">
                    I agree to sign a Non-Disclosure Agreement (NDA) if required by the host organization
                  </span>
                </label>
              </div>

              <div className="flex justify-between">
                <button onClick={prevStep} className="btn-secondary">
                  ← Back
                </button>
                <button onClick={nextStep} className="btn-primary">
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Photo & Submit */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Your Photo (Optional)</h2>

              <p className="text-gray-600 mb-4">
                Adding your photo helps with faster check-in at the reception
              </p>

              {!showWebcam ? (
                <>
                  {photoDataUrl ? (
                    <div className="space-y-4">
                      <img src={photoDataUrl} alt="Your photo" className="w-full max-w-md mx-auto rounded-lg" />
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => setShowWebcam(true)}
                          className="btn-secondary flex items-center gap-2"
                        >
                          <Camera size={20} />
                          Retake Photo
                        </button>
                        <button
                          onClick={() => setPhotoDataUrl('')}
                          className="btn-secondary"
                        >
                          Remove Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setShowWebcam(true)}
                        className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex flex-col items-center gap-3"
                      >
                        <Camera size={48} className="text-gray-400" />
                        <span className="font-medium">Take Photo with Webcam</span>
                      </button>

                      <div>
                        <PhotoUpload onUpload={handlePhotoUpload} />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <WebcamCapture
                  onCapture={handlePhotoCapture}
                  onCancel={() => setShowWebcam(false)}
                />
              )}

              <div className="flex justify-between pt-6">
                <button onClick={prevStep} className="btn-secondary" disabled={loading}>
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-primary disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p>Need help? Contact reception at reception@company.com</p>
        </div>
      </div>
    </div>
  );
};
