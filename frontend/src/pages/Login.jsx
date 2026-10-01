import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/api';

export default function Login() {
  const { login, register, guestLogin, user } = useAuth();
  const navigate = useNavigate();

  // Mode state: login vs register
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Admin form state
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Guest attendee state
  const [guestEventId, setGuestEventId] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [modalEventId, setModalEventId] = useState('');
  const [eventVerifying, setEventVerifying] = useState(false);
  const [eventModalError, setEventModalError] = useState('');
  const [guestError, setGuestError] = useState('');

  // If already authenticated as administrator, redirect to dashboard
  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      if (isRegisterMode) {
        if (!organization.trim()) {
          setAdminError('Organization name is required');
          setAdminLoading(false);
          return;
        }
        if (!name.trim()) {
          setAdminError('Admin name is required');
          setAdminLoading(false);
          return;
        }
        const registered = await register({
          name: name.trim(),
          organization: organization.trim(),
          email: email.trim(),
          password,
        });
        navigate('/dashboard');
      } else {
        const loggedIn = await login(email, password);
        if (loggedIn.role === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/find-seats');
        }
      }
    } catch (err) {
      setAdminError(
        err.response?.data?.message ||
        (isRegisterMode ? 'Registration failed. Please try again.' : 'Invalid administrator credentials')
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // Verify Event ID with backend and redirect to the admin-created event
  const handleVerifyAndRedirect = async (targetId) => {
    const cleanId = (targetId || '').trim().toUpperCase();
    if (!cleanId) {
      setEventModalError('Please enter an Event ID.');
      return;
    }
    setEventVerifying(true);
    setEventModalError('');
    setGuestError('');
    try {
      // 1. Verify Event ID matches an admin-created event
      const res = await API.get(`/events/${encodeURIComponent(cleanId)}`);
      const matchedEvent = res.data;
      if (!matchedEvent || !matchedEvent.eventId) {
        throw new Error('Event not found');
      }

      // 2. Establish guest session if not already active
      if (!user) {
        await guestLogin();
      }

      // 3. Redirect to the specific event created by admin
      navigate(`/guest/${matchedEvent.eventId}`);
    } catch (err) {
      console.error('Error verifying event ID:', err);
      const notFoundMsg = `Event ID "${cleanId}" not found. Please ensure the Event ID matches the event created by the administrator.`;
      const errMsg =
        err.response?.status === 404
          ? notFoundMsg
          : err.response?.data?.message || notFoundMsg;
      setEventModalError(errMsg);
      setGuestError(errMsg);
    } finally {
      setEventVerifying(false);
    }
  };

  const handleGuestContinue = () => {
    if (guestEventId && guestEventId.trim()) {
      handleVerifyAndRedirect(guestEventId);
    } else {
      setShowEventModal(true);
      setModalEventId('');
      setEventModalError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-blue-500/20">
            <span className="text-white font-black text-2xl tracking-tight">SH</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            SEATHUB
          </h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Event Seating & Management System
          </p>
        </div>

        {/* Two-Column Experience Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Guest Event Seating */}
          <div className="bg-white border-2 border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-500/5 flex flex-col justify-between transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  GUEST ATTENDEE
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50/50 px-2.5 py-0.5 rounded-md">
                  No account required
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Guest Event Seating
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Attending an event? Enter the Event ID created by your admin to proceed to seat selection.
                </p>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-2.5 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Instant access without registration</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Matches Admin Event ID for live layout</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Live interactive auditorium seating map</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Simple 1-click booking confirmation</span>
                </div>
              </div>

              {/* Event ID Input Box right on the Card */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Event ID</span>
                  <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    Created by Admin
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="input-guest-event-id"
                    value={guestEventId}
                    onChange={(e) => {
                      setGuestEventId(e.target.value.toUpperCase());
                      setGuestError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGuestContinue();
                      }
                    }}
                    placeholder="e.g. EVENT001"
                    className="w-full bg-slate-50 border border-gray-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-mono font-bold tracking-wider placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  {guestEventId && (
                    <button
                      type="button"
                      onClick={() => setGuestEventId('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none p-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Enter the Event ID given by the administrator to access the event
                </p>
              </div>

              {guestError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {guestError}
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="button"
                id="btn-continue-as-guest"
                onClick={handleGuestContinue}
                disabled={eventVerifying}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl py-3.5 px-4 font-semibold text-base transition-all duration-200 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {eventVerifying ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Verifying Event ID...</span>
                  </>
                ) : (
                  <>
                    <span>Continue as Guest</span>
                    <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-gray-400 mt-2">
                Click above to verify Event ID and proceed directly to seat selection
              </p>
            </div>
          </div>

          {/* Card 2: Administrator Login / Registration */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  ADMIN {isRegisterMode ? '• REGISTER' : '• LOGIN'}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  Multi-Organization
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isRegisterMode ? 'Register Organization Admin' : 'Admin Login'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {isRegisterMode
                    ? 'Create your organization account to manage isolated events'
                    : 'Login with your administrator account'}
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  id="tab-admin-login"
                  onClick={() => { setIsRegisterMode(false); setAdminError(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    !isRegisterMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Admin Login
                </button>
                <button
                  type="button"
                  id="tab-admin-register"
                  onClick={() => { setIsRegisterMode(true); setAdminError(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    isRegisterMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Register Organization
                </button>
              </div>

              {adminError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminSubmit} className="space-y-3.5" id="form-admin-login">
                {isRegisterMode && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        id="admin-org"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        required
                        placeholder="e.g. Apex College, Tech Innovators, Metro Center"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Administrator Full Name
                      </label>
                      <input
                        type="text"
                        id="admin-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="e.g. Jane Doe"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="admin-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={isRegisterMode ? "admin@myorg.com" : "admin@church.com"}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="admin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={isRegisterMode ? "At least 6 characters" : "••••••••"}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="btn-admin-submit"
                    disabled={adminLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl py-3 px-4 font-semibold text-sm transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {adminLoading
                      ? (isRegisterMode ? 'Registering Organization...' : 'Verifying Admin...')
                      : (isRegisterMode ? 'Register & Access Dashboard' : 'Login as Administrator')}
                  </button>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">
                {isRegisterMode ? (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegisterMode(false); setAdminError(''); }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Login here
                    </button>
                  </>
                ) : (
                  <>
                    Need a separate organization?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegisterMode(true); setAdminError(''); }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Register here
                    </button>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Global Footer Note */}
        <div className="text-center text-xs text-gray-400">
          SEATHUB &bull; Event Seating &amp; Management System &bull; Fast &amp; Frictionless
        </div>
      </div>

      {/* GUEST ATTENDEE EVENT ID MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-5 border border-gray-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shadow-xs">
                  🎫
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Enter Event ID</h3>
                  <p className="text-xs text-gray-500">Access your admin-created seating event</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  setEventModalError('');
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Please enter the <strong>Event ID</strong> provided by your administrator (e.g. <code>EVENT001</code>). Once matched, you will be redirected directly to that event's seating map.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyAndRedirect(modalEventId);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wide">
                  Event ID *
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  id="modal-input-event-id"
                  value={modalEventId}
                  onChange={(e) => {
                    setModalEventId(e.target.value.toUpperCase());
                    setEventModalError('');
                  }}
                  placeholder="e.g. EVENT001"
                  className="w-full bg-slate-50 border-2 border-gray-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-3 text-base font-mono font-bold tracking-wider text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition"
                />
              </div>

              {eventModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <span className="text-red-500 font-bold shrink-0">⚠</span>
                  <span className="font-medium leading-relaxed">{eventModalError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEventModal(false);
                    setEventModalError('');
                  }}
                  className="flex-1 py-3 border border-gray-200 rounded-2xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-modal-join-event"
                  disabled={eventVerifying}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {eventVerifying ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Verifying ID...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Event</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
