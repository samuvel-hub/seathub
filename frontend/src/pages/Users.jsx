import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/api';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/users')
      .then(res => setUsers(res.data.filter(u => u.role === 'admin')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Administrator Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Normal-user accounts have been discontinued in SEATHUB. Church attendees now access seating directly as <strong>Guests</strong> without needing an account or password.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-800 flex items-start gap-3">
        <span className="text-lg mt-0.5">ℹ</span>
        <div>
          <span className="font-semibold">Guest Authentication Active: </span>
          Attendees no longer require user accounts. They click <strong>Continue as Guest</strong> to view events, browse the seating map, and book seats with zero registration friction.
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading administrators...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-semibold text-sm text-gray-800">
            System Administrators ({users.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-green-700 font-semibold">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
