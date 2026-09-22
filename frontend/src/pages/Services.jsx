import React, { useState } from 'react';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';

export default function Services() {
  const { services, createService, updateService, deleteService } = useSeating();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', time: '', type: 'Sunday Service' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createService({ ...form, isActive: false });
      setShowForm(false);
      setForm({ name: '', date: '', time: '', type: 'Sunday Service' });
    } catch (err) {
      alert('Error: ' + err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleSetActive = async (id) => {
    await updateService(id, { isActive: true });
  };

  const handleSetInactive = async (id) => {
    await updateService(id, { isActive: false });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500">Manage church services and activate them for live seating.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
            + New Service
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Create New Service</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Service Name</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Sunday Morning Service"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Sunday Service</option><option>Bible Study</option><option>Special Event</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Date</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Time</label>
              <input required value={form.time} onChange={e => setForm({...form, time: e.target.value})} placeholder="9:00 AM"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {services.map(s => (
          <div key={s._id} className={'bg-white border rounded-2xl p-5 shadow-sm ' + (s.isActive ? 'border-green-300 bg-green-50' : 'border-gray-200')}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  {s.isActive && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">● ACTIVE</span>}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {new Date(s.date).toLocaleDateString()} at {s.time} · {s.type}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  {s.isActive ? (
                    <button onClick={() => handleSetInactive(s._id)}
                      className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700">
                      Deactivate
                    </button>
                  ) : (
                    <button onClick={() => handleSetActive(s._id)}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                      Set Active
                    </button>
                  )}
                  <button onClick={() => deleteService(s._id)}
                    className="border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {services.length === 0 && <div className="text-center py-12 text-gray-400">No services found</div>}
      </div>
    </div>
  );
}
