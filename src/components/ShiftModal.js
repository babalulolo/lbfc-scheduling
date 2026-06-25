'use client';

import { useState } from 'react';

export default function ShiftModal({ shift, onClose, onSignup, onCancel, onClock }) {
  const [loading, setLoading] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  if (!shift) return null;

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const gcalUrl = (() => {
    const startDate = shift.date.replace(/-/g, '');
    const st = (shift.startTime || shift.start_time || '').replace(/:/g, '') + '00';
    const et = (shift.endTime || shift.end_time || '').replace(/:/g, '') + '00';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: shift.title,
      dates: `${startDate}T${st}/${startDate}T${et}`,
      location: shift.locationAddress || shift.location_address || shift.location,
      details: `${shift.notes || ''}\n\nLong Beach Food Coalition Volunteer Shift`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  async function handleAction() {
    setLoading(true);
    try {
      if (shift.isSignedUp) {
        await onCancel(shift.id);
      } else {
        await onSignup(shift.id);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Clock in/out state ──
  const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const isShiftToday = shift.date === todayLA;
  const clockedIn = !!shift.myClockInAt;
  const clockedOut = !!shift.myClockOutAt;

  const formatClock = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
    });
  };

  const clockedHours = (() => {
    if (!shift.myClockInAt || !shift.myClockOutAt) return null;
    const ms = new Date(shift.myClockOutAt) - new Date(shift.myClockInAt);
    return ms > 0 ? Math.round((ms / 3600000) * 10) / 10 : null;
  })();

  async function handleClock(action) {
    if (!onClock) return;
    setClockLoading(true);
    try {
      await onClock(shift.id, action);
    } finally {
      setClockLoading(false);
    }
  }

  return (
    <div className="modal-sheet bg-black/50 z-50" onClick={onClose}>
      <div
        className="modal-sheet-inner bg-white shadow-xl slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — visible on mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-[#2d5016] pr-4">{shift.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0"
            >
              &times;
            </button>
          </div>

          {shift.description && (
            <p className="text-gray-600 mb-4 text-sm">{shift.description}</p>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-lg">📅</span>
              <div>
                <p className="font-medium text-sm sm:text-base">{formatDate(shift.date)}</p>
                <p className="text-sm text-gray-500">
                  {formatTime(shift.startTime || shift.start_time)} – {formatTime(shift.endTime || shift.end_time)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">📍</span>
              <div>
                <p className="font-medium text-sm sm:text-base">{shift.location}</p>
                {(shift.locationAddress || shift.location_address) && (
                  <p className="text-sm text-gray-500">{shift.locationAddress || shift.location_address}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">👥</span>
              <p className="text-sm sm:text-base">
                <span className="font-medium">{shift.slotsRemaining}</span>
                <span className="text-gray-500"> of {shift.slotsTotal || shift.slots_total} spots remaining</span>
              </p>
            </div>

            {shift.notes && (
              <div className="flex items-start gap-3">
                <span className="text-lg">📝</span>
                <p className="text-gray-600 text-sm">{shift.notes}</p>
              </div>
            )}

            {shift.signups && shift.signups.length > 0 && (
              <div className="flex items-start gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="font-medium text-sm">Signed up:</p>
                  <p className="text-sm text-gray-500">
                    {shift.signups.map((s) => s.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {shift.isSignedUp && (
            <div className="mb-5 rounded-xl border border-[#e0efd6] bg-[#f7fbf2] p-4">
              <p className="text-sm font-semibold text-[#2d5016] mb-2">Your attendance</p>
              {clockedOut ? (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-[#2d5016]">Clocked out</span>
                  {clockedHours != null ? ` · ${clockedHours} hrs` : ''}
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {formatClock(shift.myClockInAt)} – {formatClock(shift.myClockOutAt)}
                  </span>
                </p>
              ) : clockedIn ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">Clocked in at {formatClock(shift.myClockInAt)}</p>
                  {isShiftToday ? (
                    <button onClick={() => handleClock('out')} disabled={clockLoading}
                      className="w-full py-2.5 px-4 rounded-xl font-medium text-white text-sm bg-[#b45309] hover:bg-[#92400e] transition disabled:opacity-50">
                      {clockLoading ? 'Saving…' : 'Clock Out'}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400">Still clocked in — ask an admin to finalize your hours.</p>
                  )}
                </>
              ) : isShiftToday ? (
                <button onClick={() => handleClock('in')} disabled={clockLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-white text-sm bg-[#2d5016] hover:bg-[#1a3a0a] transition disabled:opacity-50">
                  {clockLoading ? 'Saving…' : 'Clock In'}
                </button>
              ) : (
                <p className="text-sm text-gray-500">Clock in opens on the day of your shift.</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {shift.slotsRemaining > 0 || shift.isSignedUp ? (
              <button
                onClick={handleAction}
                disabled={loading}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition text-white text-sm sm:text-base ${
                  shift.isSignedUp
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#2d5016] hover:bg-[#1a3a0a]'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading
                  ? 'Processing...'
                  : shift.isSignedUp
                  ? 'Cancel My Signup'
                  : 'Sign Up for This Shift'}
              </button>
            ) : (
              <div className="flex-1 py-3 px-4 rounded-xl font-medium text-center bg-gray-100 text-gray-500 text-sm">
                This shift is full
              </div>
            )}

            {shift.isSignedUp && (
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl font-medium border-2 border-[#2d5016] text-[#2d5016] hover:bg-[#f0f7e6] transition text-center text-sm whitespace-nowrap"
              >
                + Cal
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
