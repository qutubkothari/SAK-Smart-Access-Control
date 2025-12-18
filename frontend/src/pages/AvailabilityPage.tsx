import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Plus, Trash2, Clock, UserCheck, Edit2 } from 'lucide-react';
import api, { userApi } from '../services/api';

interface AvailabilityBlock {
  id: string;
  user_id: string;
  user_name?: string;
  user_its_id?: string;
  start_time: string;
  end_time: string;
  reason?: string;
  type: 'time_off' | 'busy' | 'meeting' | 'unavailable';
  all_day: boolean;
}

interface User {
  id: string;
  its_id: string;
  name: string;
  email: string;
  role: string;
}

export const AvailabilityPage: React.FC = () => {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSecretary, setIsSecretary] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    start_time: '',
    end_time: '',
    reason: '',
    type: 'busy' as 'time_off' | 'busy' | 'meeting' | 'unavailable',
    all_day: false
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = user.role === 'admin';
    const secretaryRole = user.role === 'secretary';
    setIsAdmin(adminRole);
    setIsSecretary(secretaryRole);
    
    if (adminRole) {
      loadUsers();
    } else if (secretaryRole) {
      loadAssignedEmployees();
    } else {
      loadBlocks();
    }
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response: any = await userApi.getAll();
      const userList = response.data?.data || response.data || [];
      setUsers(userList.filter((u: User) => u.role === 'host' || u.role === 'admin'));
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAssignedEmployees = async () => {
    setLoadingUsers(true);
    try {
      const response: any = await api.get('/users/my-employees');
      const employeeList = response.data?.data || response.data || [];
      setUsers(employeeList);
    } catch (error) {
      console.error('Failed to load assigned employees:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadBlocks = async (userId?: string) => {
    setLoading(true);
    try {
      const url = userId ? `/availability?user_id=${userId}` : '/availability';
      const response: any = await api.get(url);
      setBlocks(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load availability blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    if (userId) {
      loadBlocks(userId);
    } else {
      setBlocks([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((isAdmin || isSecretary) && !formData.user_id) {
      alert('Please select a user to block time for');
      return;
    }
    
    try {
      const payload = (isAdmin || isSecretary) ? formData : {
        start_time: formData.start_time,
        end_time: formData.end_time,
        reason: formData.reason,
        type: formData.type,
        all_day: formData.all_day
      };
      
      if (editingBlockId) {
        // Update existing block
        await api.put(`/availability/${editingBlockId}`, payload);
      } else {
        // Create new block
        await api.post('/availability', payload);
      }
      
      setFormData({
        user_id: '',
        start_time: '',
        end_time: '',
        reason: '',
        type: 'busy',
        all_day: false
      });
      setShowForm(false);
      setEditingBlockId(null);
      
      if ((isAdmin || isSecretary) && selectedUserId) {
        loadBlocks(selectedUserId);
      } else if (!isAdmin && !isSecretary) {
        loadBlocks();
      }
    } catch (error) {
      console.error('Failed to save availability block:', error);
      alert('Failed to save availability block. Please try again.');
    }
  };

  const handleEdit = (block: AvailabilityBlock) => {
    setEditingBlockId(block.id);
    setFormData({
      user_id: block.user_id,
      start_time: block.start_time,
      end_time: block.end_time,
      reason: block.reason || '',
      type: block.type,
      all_day: block.all_day
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this availability block?')) return;
    try {
      await api.delete(`/availability/${id}`);
      
      if ((isAdmin || isSecretary) && selectedUserId) {
        loadBlocks(selectedUserId);
      } else if (!isAdmin && !isSecretary) {
        loadBlocks();
      }
    } catch (error) {
      console.error('Failed to delete availability block:', error);
    }
  };

  return (
    <Layout>
      {/* Admin/Secretary User Selector */}
      {(isAdmin || isSecretary) && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserCheck size={20} className="text-primary-600" />
            {isSecretary ? 'Select Employee' : 'Select User'}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {isSecretary 
              ? 'Choose an employee to view and manage their availability blocks.'
              : 'Choose a user to view and manage their availability blocks.'}
          </p>
          {loadingUsers ? (
            <div className="text-center py-4 text-gray-500">Loading {isSecretary ? 'employees' : 'users'}...</div>
          ) : (
            <select
              value={selectedUserId}
              onChange={(e) => handleUserSelect(e.target.value)}
              className="input-field"
            >
              <option value="">-- Select {isSecretary ? 'an Employee' : 'a User'} --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.its_id}) - {user.email}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Availability</h1>
          <p className="text-sm text-gray-500 mt-1">
            {(isAdmin || isSecretary)
              ? 'Block time periods when selected user/employee is unavailable for meetings.' 
              : 'Block time periods when you\'re unavailable for meetings.'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
          disabled={(isAdmin || isSecretary) && !selectedUserId}
        >
          <Plus size={18} />
          Block Time
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingBlockId ? 'Edit' : 'Block'} Unavailable Time
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(isAdmin || isSecretary) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isSecretary ? 'Employee' : 'User'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">-- Select {isSecretary ? 'Employee' : 'User'} --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.its_id})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the {isSecretary ? 'employee' : 'user'} for whom you want to block time
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="input-field"
              >
                <option value="busy">Busy</option>
                <option value="time_off">Time Off</option>
                <option value="meeting">Meeting</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="input-field"
                placeholder="e.g., Vacation, Conference, Out of office"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="all_day"
                checked={formData.all_day}
                onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="all_day" className="text-sm text-gray-700">All day</label>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                {editingBlockId ? 'Update Block' : 'Save Block'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBlockId(null);
                  setFormData({
                    user_id: '',
                    start_time: '',
                    end_time: '',
                    reason: '',
                    type: 'busy',
                    all_day: false
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar size={20} />
          Blocked Time Periods
          {(isAdmin || isSecretary) && selectedUserId && (
            <span className="text-sm font-normal text-gray-600">
              - {users.find(u => u.id === selectedUserId)?.name}
            </span>
          )}
        </h2>

        {(isAdmin || isSecretary) && !selectedUserId ? (
          <div className="py-10 text-center text-gray-500">
            Please select {isSecretary ? 'an employee' : 'a user'} above to view their blocked time periods.
          </div>
        ) : loading ? (
          <div className="py-10 text-center text-gray-500">Loading...</div>
        ) : blocks.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            No blocked time periods. Click "Block Time" to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-900">
                      {new Date(block.start_time).toLocaleString()} - {new Date(block.end_time).toLocaleString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      block.type === 'time_off' ? 'bg-purple-100 text-purple-700' :
                      block.type === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {block.type.replace('_', ' ')}
                    </span>
                  </div>
                  {block.user_name && isAdmin && (
                    <p className="text-xs text-gray-500 mb-1">
                      User: {block.user_name} ({block.user_its_id})
                    </p>
                  )}
                  {block.reason && (
                    <p className="text-sm text-gray-600">{block.reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(block)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit block"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(block.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete block"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
