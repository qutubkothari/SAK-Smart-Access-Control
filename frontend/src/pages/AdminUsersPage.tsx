import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { userApi, departmentApi, accessApi } from '../services/api';
import { Users, Plus, Edit, Trash2, Search, X } from 'lucide-react';
import type { User, Department } from '../types';
import { apiClient } from '../lib/api-client';

declare global {
  interface Window {
    __usersApiRaw?: unknown;
  }
}

export const AdminUsersPage: React.FC = () => {

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [createForm, setCreateForm] = useState({
    its_id: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    department_ids: [] as string[],
    role: 'host',
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    its_id: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    department_ids: [] as string[],
    role: 'host',
    is_active: true,
  });

  const [floorAccess, setFloorAccess] = useState<any[]>([]);
  const [floorAccessLoading, setFloorAccessLoading] = useState(false);
  const [floorAccessError, setFloorAccessError] = useState('');
  const [newFloorNumber, setNewFloorNumber] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        userApi.getAll(),
        departmentApi.getAll()
      ]);
      // Debug log to see what is being set
      const usersData: any = usersRes.data;
      const deptsData: any = deptsRes.data;
      // Expose for inspection in browser
      window.__usersApiRaw = usersData;
      // Always set users to an array
      let usersArr = [];
      if (Array.isArray(usersData?.data)) {
        usersArr = usersData.data;
      } else if (Array.isArray(usersData)) {
        usersArr = usersData;
      } else if (usersData?.data && typeof usersData.data === 'object') {
        usersArr = Object.values(usersData.data);
      }
      setUsers(usersArr);
      let deptsArr = [];
      if (Array.isArray(deptsData?.data)) {
        deptsArr = deptsData.data;
      } else if (Array.isArray(deptsData)) {
        deptsArr = deptsData;
      } else if (deptsData?.data && typeof deptsData.data === 'object') {
        deptsArr = Object.values(deptsData.data);
      }
      setDepartments(deptsArr);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setActionError('');
    setCreateError('');
    setCreateForm({
      its_id: '',
      name: '',
      email: '',
      password: '',
      phone: '',
      department_ids: [],
      role: 'host',
    });
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (createLoading) return;
    setIsCreateOpen(false);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setCreateError('');
    setCreateLoading(true);
    try {
      const payload: any = {
        its_id: createForm.its_id.trim(),
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      };

      if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
      if (createForm.department_ids.length > 0) payload.department_ids = createForm.department_ids;

      await apiClient.post('/users', payload);
      setIsCreateOpen(false);
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const loadFloorAccess = async (employeeId: string) => {
    setFloorAccessError('');
    setFloorAccessLoading(true);
    try {
      const res: any = await accessApi.getEmployeeFloors(employeeId);
      const payload = res?.data;
      const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      setFloorAccess(data);
    } catch (err: any) {
      setFloorAccess([]);
      setFloorAccessError(err?.response?.data?.error?.message || err?.message || 'Failed to load floor access');
    } finally {
      setFloorAccessLoading(false);
    }
  };

  const openEdit = (user: any) => {
    setActionError('');
    setEditError('');
    setEditUserId(user.id);
    setFloorAccess([]);
    setFloorAccessError('');
    setNewFloorNumber('');
    
    // Parse department_ids from API response
    let deptIds: string[] = [];
    if (Array.isArray(user.department_ids)) {
      deptIds = user.department_ids;
    } else if (Array.isArray(user.departmentIds)) {
      deptIds = user.departmentIds;
    } else if (user.departmentId || user.department_id) {
      deptIds = [user.departmentId || user.department_id];
    }

    setEditForm({
      its_id: user.itsId || user.its_id || '',
      name: user.name || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      department_ids: deptIds,
      role: user.role || 'host',
      is_active: typeof user.isActive === 'boolean' ? user.isActive : (typeof user.is_active === 'boolean' ? user.is_active : true),
    });
    setIsEditOpen(true);
    if (user?.id) {
      void loadFloorAccess(user.id);
    }
  };

  const closeEdit = () => {
    if (editLoading) return;
    setIsEditOpen(false);
  };

  const grantFloorAccess = async () => {
    if (!editUserId) return;
    setFloorAccessError('');
    const floor = Number.parseInt(newFloorNumber, 10);
    if (!Number.isFinite(floor)) {
      setFloorAccessError('Please enter a valid floor number');
      return;
    }
    setFloorAccessLoading(true);
    try {
      await accessApi.grantFloor({ employee_id: editUserId, floor_number: floor });
      setNewFloorNumber('');
      await loadFloorAccess(editUserId);
    } catch (err: any) {
      setFloorAccessError(err?.response?.data?.error?.message || err?.message || 'Failed to grant floor access');
    } finally {
      setFloorAccessLoading(false);
    }
  };

  const revokeFloorAccess = async (accessId: string) => {
    if (!editUserId) return;
    setFloorAccessError('');
    setFloorAccessLoading(true);
    try {
      await accessApi.revokeFloor(accessId);
      await loadFloorAccess(editUserId);
    } catch (err: any) {
      setFloorAccessError(err?.response?.data?.error?.message || err?.message || 'Failed to revoke floor access');
    } finally {
      setFloorAccessLoading(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId) return;
    setActionError('');
    setEditError('');
    setEditLoading(true);
    try {
      const updates: any = {
        its_id: editForm.its_id.trim(),
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        is_active: editForm.is_active,
        department_ids: editForm.department_ids,
      };
      if (editForm.phone.trim()) updates.phone = editForm.phone.trim();
      else updates.phone = null;
      if (editForm.password) updates.password = editForm.password;

      await apiClient.put(`/users/${editUserId}`, updates);
      setIsEditOpen(false);
      await loadData();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const deactivateUser = async (user: any) => {
    setActionError('');
    const name = user?.name || user?.email || user?.itsId || user?.its_id || 'this user';
    const ok = window.confirm(`Deactivate ${name}?`);
    if (!ok) return;
    try {
      await apiClient.delete(`/users/${user.id}`);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to deactivate user');
    }
  };


  let filteredUsers: typeof users = [];
  let usersArrayError = '';
  if (!Array.isArray(users)) {
    usersArrayError = 'Users data is not an array. Type: ' + typeof users;
  } else {
    try {
      filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.itsId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (e) {
      usersArrayError = 'Error filtering users: ' + (e as Error).message;
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-700',
      security: 'bg-blue-100 text-blue-700',
      receptionist: 'bg-green-100 text-green-700',
      host: 'bg-gray-100 text-gray-700',
    };
    return colors[role as keyof typeof colors] || colors.host;
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


  // Top-level fallback UI if users is not an array
  if (!Array.isArray(users)) {
    return (
      <Layout>
        <div className="bg-red-100 text-red-800 p-4 rounded-lg mt-8">
          <strong>Users Array Error:</strong> {usersArrayError}
          <br />
          <pre style={{ fontSize: 12, marginTop: 8 }}>{JSON.stringify(users, null, 2)}</pre>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage system users and permissions</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={20} />
            Add User
          </button>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {actionError}
          </div>
        )}

        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-xl bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={closeCreate}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitCreate} className="space-y-4 px-6 py-4">
                {createError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {createError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      className="input-field"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ITS ID</label>
                    <input
                      className="input-field"
                      value={createForm.its_id}
                      onChange={(e) => setCreateForm((p) => ({ ...p, its_id: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      className="input-field"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      className="input-field"
                      value={createForm.role}
                      onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                    >
                      <option value="admin">admin</option>
                      <option value="security">security</option>
                      <option value="receptionist">receptionist</option>
                      <option value="host">host</option>
                      <option value="secretary">secretary</option>
                      <option value="employee">employee</option>
                      <option value="manager">manager</option>
                      <option value="hr">hr</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {createForm.department_ids.map((dId) => {
                        const dept = departments.find(d => d.id === dId);
                        return (
                          <span
                            key={dId}
                            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
                          >
                            {dept?.name || dId}
                            <button
                              type="button"
                              className="text-gray-500 hover:text-gray-700"
                              onClick={() => setCreateForm(p => ({ ...p, department_ids: p.department_ids.filter(id => id !== dId) }))}
                              aria-label="Remove department"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        );
                      })}
                      {createForm.department_ids.length === 0 && (
                        <span className="text-sm text-gray-500">No departments selected</span>
                      )}
                    </div>
                    <select
                      className="input-field"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !createForm.department_ids.includes(val)) {
                          setCreateForm(p => ({ ...p, department_ids: [...p.department_ids, val] }));
                        }
                      }}
                    >
                      <option value="">— Add department —</option>
                      {departments
                        .filter(d => !createForm.department_ids.includes(d.id))
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                    <input
                      className="input-field"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="btn-secondary" onClick={closeCreate} disabled={createLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={createLoading}>
                    {createLoading ? 'Creating…' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name, email, or ITS ID..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ITS ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{user.itsId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const deptIds = Array.isArray(user.department_ids) ? user.department_ids : (user.departmentId ? [user.departmentId] : []);
                        if (deptIds.length === 0) return '-';
                        return (
                          <div className="flex flex-wrap gap-1">
                            {deptIds.map((dId: string) => {
                              const dept = departments.find(d => d.id === dId);
                              return (
                                <span key={dId} className="inline-block px-2 py-1 text-xs bg-gray-100 rounded">
                                  {dept?.name || dId.slice(0, 8)}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-primary-600 hover:text-primary-900 mr-3"
                        onClick={() => openEdit(user)}
                        aria-label="Edit user"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => deactivateUser(user)}
                        aria-label="Deactivate user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-2 opacity-50" />
              <p>No users found</p>
            </div>
          )}
        </div>

        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-xl bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={closeEdit}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitEdit} className="space-y-4 px-6 py-4">
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      className="input-field"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ITS ID</label>
                    <input
                      className="input-field"
                      value={editForm.its_id}
                      onChange={(e) => setEditForm((p) => ({ ...p, its_id: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password (optional)</label>
                    <input
                      type="password"
                      className="input-field"
                      value={editForm.password}
                      onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Leave blank to keep current"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      className="input-field"
                      value={editForm.role}
                      onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                    >
                      <option value="admin">admin</option>
                      <option value="security">security</option>
                      <option value="receptionist">receptionist</option>
                      <option value="host">host</option>
                      <option value="secretary">secretary</option>
                      <option value="employee">employee</option>
                      <option value="manager">manager</option>
                      <option value="hr">hr</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editForm.department_ids.map((dId) => {
                        const dept = departments.find(d => d.id === dId);
                        return (
                          <span
                            key={dId}
                            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
                          >
                            {dept?.name || dId}
                            <button
                              type="button"
                              className="text-gray-500 hover:text-gray-700"
                              onClick={() => setEditForm(p => ({ ...p, department_ids: p.department_ids.filter(id => id !== dId) }))}
                              aria-label="Remove department"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        );
                      })}
                      {editForm.department_ids.length === 0 && (
                        <span className="text-sm text-gray-500">No departments selected</span>
                      )}
                    </div>
                    <select
                      className="input-field"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !editForm.department_ids.includes(val)) {
                          setEditForm(p => ({ ...p, department_ids: [...p.department_ids, val] }));
                        }
                      }}
                    >
                      <option value="">— Add department —</option>
                      {departments
                        .filter(d => !editForm.department_ids.includes(d.id))
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                    <input
                      className="input-field"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      className="input-field"
                      value={editForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'active' }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">Floor Access</h3>
                    {floorAccessLoading && <span className="text-xs text-gray-500">Loading…</span>}
                  </div>

                  {floorAccessError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {floorAccessError}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {floorAccess.length === 0 ? (
                      <span className="text-sm text-gray-500">No floors granted</span>
                    ) : (
                      floorAccess.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
                        >
                          Floor {a.floor_number}{a.building ? ` (${a.building})` : ''}
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => revokeFloorAccess(String(a.id))}
                            aria-label="Revoke floor access"
                            disabled={floorAccessLoading}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Add floor</label>
                      <input
                        className="input-field"
                        inputMode="numeric"
                        placeholder="e.g. 1"
                        value={newFloorNumber}
                        onChange={(e) => setNewFloorNumber(e.target.value)}
                        disabled={floorAccessLoading}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="btn-primary w-full"
                        onClick={grantFloorAccess}
                        disabled={floorAccessLoading}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="btn-secondary" onClick={closeEdit} disabled={editLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={editLoading}>
                    {editLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
