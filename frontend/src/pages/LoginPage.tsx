import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/authStore';
import { socketService } from '../services/socket';

export const LoginPage: React.FC = () => {
  const [itsId, setItsId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login({ its_id: itsId, password });
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }
      
      // Update store
      login(response.data.user, response.data.token);
      socketService.connect(response.data.token);
      
      // Navigate based on role
      switch (response.data.user.role) {
        case 'admin':
          navigate('/dashboard');
          break;
        case 'receptionist':
          navigate('/receptionist');
          break;
        case 'security':
          navigate('/dashboard');
          break;
        default:
          navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="https://www.its52.com/imgs/1447/ITS_Logo_White.png?v1"
            alt="ITS Logo"
            className="h-16 mx-auto mb-4 brightness-0"
          />
          <h1 className="text-3xl font-semibold text-gray-900">SAK Access Control</h1>
          <p className="text-primary-700 mt-2">Smart Visitor Management System</p>
        </div>

        {/* Login Card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="text-primary-600" size={24} />
            <h2 className="text-2xl font-bold">Login</h2>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ITS ID
              </label>
              <input
                type="text"
                value={itsId}
                onChange={(e) => setItsId(e.target.value)}
                className="input-field"
                placeholder="Enter your ITS ID"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Default credentials for testing:</p>
            <p className="mt-1 font-mono text-xs">
              Admin: ITS000001 / Admin123!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>© 2024 SAK Smart Access Control</p>
          <p className="mt-1">Powered by ITS52</p>
        </div>
      </div>
    </div>
  );
};
