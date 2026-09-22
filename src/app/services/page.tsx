'use client';

import React, { useState } from 'react';
import { FormattedDate } from '@/components/common/FormattedDate';
import { useSeating } from '@/context/SeatingContext';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Plus, Play, CheckCircle, Radio, Clock } from 'lucide-react';

export default function ServicesPage() {
  const { services, activeService, createService, startService, completeService, setActiveServiceId } = useSeating();
  const { role } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceTime, setServiceTime] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !serviceTime) return;
    const created = await createService(serviceName, serviceTime);
    setServiceName('');
    setServiceTime('');
    setShowCreateModal(false);
    setActiveServiceId(created.id);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <span>Service Management</span>
          </h1>
          <p className="text-xs text-slate-500">
            Create, schedule, start, and archive church services.
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Service</span>
          </button>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <form onSubmit={handleCreate} className="bg-white border border-blue-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Create Church Service</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Service Name:</label>
              <input
                type="text"
                placeholder="e.g. Sunday Morning Service"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Date & Time:</label>
              <input
                type="datetime-local"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md"
            >
              Schedule Service
            </button>
          </div>
        </form>
      )}

      {/* Service Cards List */}
      <div className="space-y-4">
        {services.map((service) => {
          const isActive = activeService?.id === service.id;
          return (
            <div
              key={service.id}
              className={`bg-white border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
                isActive
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      service.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : service.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {service.status}
                  </span>

                  {isActive && (
                    <span className="flex items-center space-x-1 text-xs text-emerald-700 font-bold">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>Current Active Session</span>
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900">{service.name}</h3>
                <p className="text-xs text-slate-500 flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <FormattedDate date={service.service_time} />
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 w-full md:w-auto">
                {service.status === 'scheduled' && role === 'admin' && (
                  <button
                    onClick={() => startService(service.id)}
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Service</span>
                  </button>
                )}

                {service.status === 'active' && role === 'admin' && (
                  <button
                    onClick={() => completeService(service.id)}
                    className="py-2.5 px-5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center space-x-2 transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Complete & Archive</span>
                  </button>
                )}

                {!isActive && (
                  <button
                    onClick={() => setActiveServiceId(service.id)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Switch to This Service
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
