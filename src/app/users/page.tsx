'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSeating } from '@/context/SeatingContext';
import { UserRole } from '@/types/database';
import { Users, Plus, UserCheck } from 'lucide-react';

export default function UsersPage() {
  const { allProfiles, addUser, updateUserRole, updateUserStatus } = useAuth();
  const { sections, activeService, assignUsherToService } = useSeating();

  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');

  const [selectedUsherId, setSelectedUsherId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;
    addUser({
      full_name: fullName,
      email,
      role,
      status: 'active'
    });
    setFullName('');
    setEmail('');
    setShowAddModal(false);
  };

  const handleAssignUsher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsherId || !activeService) return;
    assignUsherToService(activeService.id, selectedUsherId, selectedSectionId || undefined);
    setSelectedUsherId('');
    setSelectedSectionId('');
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>User Management</span>
          </h1>
          <p className="text-xs text-slate-500">
            Manage user accounts, assign roles (Admin, User), and assign users to service sections.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add User Account</span>
        </button>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <form onSubmit={handleAddUser} className="bg-white border border-blue-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Add New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Full Name:</label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Email:</label>
              <input
                type="email"
                placeholder="john@gracechurch.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Role:</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
              >
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md"
            >
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* Assign User to Service Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <span>Assign User to Live Service Section</span>
        </h2>
        <p className="text-xs text-slate-500">
          Assign a user to monitor a specific section during {activeService?.name || 'current service'}.
        </p>

        <form onSubmit={handleAssignUsher} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-700 font-bold mb-1 block">Select User:</label>
            <select
              value={selectedUsherId}
              onChange={(e) => setSelectedUsherId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
              required
            >
              <option value="">Select User...</option>
              {allProfiles
                .filter((p) => p.role === 'user' && p.status === 'active')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-700 font-bold mb-1 block">Assigned Section:</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
            >
              <option value="">Entire Auditorium</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md"
            >
              Assign User
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Registered Users ({allProfiles.length})</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3">User Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-slate-900">{p.full_name}</td>
                  <td className="p-3 text-slate-500">{p.email}</td>
                  <td className="p-3">
                    <select
                      value={p.role}
                      onChange={(e) => updateUserRole(p.id, e.target.value as UserRole)}
                      className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => updateUserStatus(p.id, p.status === 'active' ? 'disabled' : 'active')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        p.status === 'active'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {p.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
