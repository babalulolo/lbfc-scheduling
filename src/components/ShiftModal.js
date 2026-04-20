'use client';

import { useState } from 'react';

export default function ShiftModal({ shift, onClose, onSignup, onCancel }) {
  const [loading, setLoading] = useState(false);

  if (!shift) return null;

  const formatTime = (t) => {
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-[#2d5016]">{shift.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          {shift.description && (
            <p className="text-gray-600 mb-4">{shift.description}</p>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-lg">📅</span>
              <div>
                <p className="font-medium">{formatDate(shift.date)}</p>
                <p className="text-sm text-gray-500">{formatTime(shift.startTime || shift.start_time)} – {formatTime(shift.endTime || shift.end_time)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">📍</span>
              <div>
                <p className="font-medium">{shift.location}</p>
                {(shift.locationAddress || shift.location_address) && (
                  <p className="text-sm text-gray-500">{shift.locationAddress || shift.location_address}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">👥</span>
              <p>
                <span className="font-medium">{shift.slotsRemaining}</span>
                <span className="text-gray-500"> of {shift.slotsTotal || shift.slots_total} spots remaining</span>
              </p>
            </div>

            {shift.notes && (
              <div className="flex items-start gap-3">
                <span className="text-lg">📝</span>
                <p className="text-gray-600">{shift.notes}</p>
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

          <div className="flex gap-3">
            {shift.slotsRemaining > 0 || shift.isSignedUp ? (
              <button
                onClick={handleAction}
                disabled={loading}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition text-white ${
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
              <div className="flex-1 py-3 px-4 rounded-xl font-medium text-center bg-gray-100 text-gray-500">
                This shift is full
              </div>
            )}

            {shift.isSignedUp && (
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl font-medium border-2 border-[#2d5016] text-[#2d5016] hover:bg-[#f0f7e6] transition text-center"
              >
                + Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
