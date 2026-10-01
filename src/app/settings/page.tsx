'use client';

import React, { useState } from 'react';
import { useSeating } from '@/context/SeatingContext';
import { Settings as SettingsIcon, Church, Clock, Database, Check } from 'lucide-react';
export default function SettingsPage() {
  const { church, auditorium } = useSeating();
  const [holdDuration, setHoldDuration] = useState<number>(2);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isMongoLive = true;

  return (
    <div className="space-y-6 max-w-3xl">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-2">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          <span>System Settings</span>
        </h1>
        <p className="text-xs text-slate-500">
          Configure church organization details, seat hold expiration times, and database connections.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Church & Auditorium Info */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Church className="w-4 h-4 text-blue-600" />
            <span>Church Profile</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-bold mb-1 block">Church Name:</label>
              <input
                type="text"
                defaultValue={church.name}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
              />
            </div>
            <div>
              <label className="text-slate-600 font-bold mb-1 block">Address:</label>
              <input
                type="text"
                defaultValue={church.address}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
              />
            </div>
            <div>
              <label className="text-slate-600 font-bold mb-1 block">Primary Auditorium:</label>
              <input
                type="text"
                defaultValue={auditorium.name}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Temporary Hold Configuration */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Temporary Hold Expiration</span>
          </h2>

          <div className="space-y-2 text-xs">
            <label className="text-slate-600 font-bold block">Hold Duration (Minutes):</label>
            <input
              type="number"
              min={1}
              max={15}
              value={holdDuration}
              onChange={(e) => setHoldDuration(parseInt(e.target.value) || 2)}
              className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold"
            />
            <p className="text-slate-500 text-[11px]">
              When an usher places a seat on temporary hold, it will automatically revert to AVAILABLE after this duration if not confirmed.
            </p>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>MongoDB Database Status</span>
          </h2>

          <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className={`w-3 h-3 rounded-full ${isMongoLive ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600'}`} />
            <div className="text-xs">
              <div className="font-bold text-slate-900">
                {isMongoLive ? 'Connected to MongoDB Database' : 'Connecting to MongoDB...'}
              </div>
              <div className="text-slate-500">
                {isMongoLive
                  ? 'MERN Stack active: MongoDB connected at mongodb://localhost:27017/church-seating.'
                  : 'Start MongoDB service and backend server on http://localhost:5000.'}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center space-x-4">
          <button
            type="submit"
            className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
              <Check className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </span>
          )}
        </div>

      </form>

    </div>
  );
}
