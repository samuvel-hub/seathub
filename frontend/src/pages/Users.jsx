import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/api';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    API.get('/users').then(res => setUsers(res.data)).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.post('/users', form);
      setUsers(prev => [...prev, res.data]);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'user' });
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating user');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (id === user?._id || !confirm('Delete this user?')) return;
    await API.delete('/users/' + id);
    setUsers(prev => prev.filter(u => u._id !== id));
  };

  const handleRoleChange = async (id, role) => {
    const res = await API.patch('/users/' + id, { role });
    setUsers(prev => prev.map(u => u._id === id ? res.data : u));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Manage system users and their roles.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
          + New User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Create New User</h2>
          <div className="grid grid-cols-2 gap-4">
            {[['name','Name','John Smith'],['email','Email','john@church.com'],['password','Password','••••••'],].map(([field, label, ph]) => (
              <div key={field}>
                <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                <input required={field !== 'password'} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} placeholder={ph}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="admin">Admin</option><option value="user">User</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-semibold">{u.name?.[0]}</div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <select value={u.role} onChange={e => handleRoleChange(u._id, e.target.value)}
                      disabled={u._id === user?._id}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50">
                      <option value="admin">Admin</option><option value="user">User</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleDelete(u._id)} disabled={u._id === user?._id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-30">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
