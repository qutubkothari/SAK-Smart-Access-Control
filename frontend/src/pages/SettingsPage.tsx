import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const res = await authApi.updateProfile({ name, email });
      updateUser({ name: (res.data as any).name ?? name, email: (res.data as any).email ?? email });
      setMsg('Profile updated');
    } catch (err: any) {
      console.error(err);
      setMsg(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile.</p>
      </div>

      <div className="card max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {msg && <p className="text-sm text-gray-600">{msg}</p>}
          <div className="flex gap-3">
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};
