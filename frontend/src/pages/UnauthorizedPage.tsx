import React from 'react';
import { Link } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
        <p className="text-sm text-gray-600 mt-2">You don’t have permission to view this page.</p>
        <div className="mt-6">
          <Link to="/dashboard" className="text-primary-700 hover:text-primary-800 font-medium">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
