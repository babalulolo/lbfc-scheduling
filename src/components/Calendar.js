'use client';

import { useState, useEffect, useCallback } from 'react';
import ShiftModal from './ShiftModal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts?month=${monthStr}`);
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  async function handleSignup(shiftId) {
    const res = await fetch('/api/shifts/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: 'You\'re signed up! Check your email for confirmation.' });
      await fetchShifts();
      // Update the selected shift with new data
      const updated = shifts.find(s => s.id === shiftId);
      if (updated) setSelectedShift({ ...updated, isSignedUp: true, slotsRemaining: updated.slotsRemaining - 1, signupCount: updated.signupCount + 1 });
      else setSelectedShift(null);
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to sign up' });
    }
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleCancel(shiftId) {
    const res = await fetch('/api/shifts/signup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: 'Signup cancelled.' });
      await fetchShifts();
      setSelectedShift(null);
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to cancel' });
    }
    setTimeout(() => setMessage(null), 5000);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = [];

  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    calendarDays.push({ day, date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`, otherMonth: true });
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, date: dateStr, otherMonth: false, isToday: dateStr === todayStr });
  }

  // Next month's leading days
  const remaining = 42 - calendarDays.length;
  for (let day = 1; day <= remaining; day++) {
    const nextMo = month + 2 > 12 ? 1 : month + 2;
    const nextYear = month + 2 > 12 ? year + 1 : year;
    calendarDays.push({ day, date: `${nextYear}-${String(nextMo).padStart(2, '0')}-${String(day).padStart(2, '0')}`, otherMonth: true });
  }

  function getShiftsForDate(dateStr) {
    return shifts.filter((s) => s.date === dateStr);
  }

  return (
    <div>
      {/* Message banner */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium fade-in ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#2d5016]">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={goToToday}
            className="text-xs bg-[#f0f7e6] text-[#2d5016] px-3 py-1 rounded-lg hover:bg-[#e0efd6] transition"
          >
            Today
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition"
          >
            ‹
          </button>
          <button
            onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition"
          >
            ›
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="calendar-grid mb-0">
        {DAYS.map((day) => (
          <div key={day} className="bg-[#2d5016] text-white text-center py-2 text-sm font-medium">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((d, i) => {
          const dayShifts = getShiftsForDate(d.date);
          return (
            <div
              key={i}
              className={`calendar-day ${d.otherMonth ? 'other-month' : ''} ${d.isToday ? 'today' : ''}`}
            >
              <span className={`text-sm font-medium ${d.isToday ? 'bg-[#2d5016] text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                {d.day}
              </span>
              {dayShifts.map((shift) => (
                <div
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className={`shift-pill ${
                    shift.isSignedUp ? 'signed-up' : shift.slotsRemaining > 0 ? 'available' : 'full'
                  }`}
                  title={`${shift.title} (${shift.slotsRemaining} spots left)`}
                >
                  {(shift.startTime || shift.start_time || '').slice(0, 5)} {shift.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#dcfce7] border border-[#bbf7d0]"></span> Available
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#dbeafe] border border-[#bfdbfe]"></span> You&apos;re signed up
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#fee2e2] border border-[#fecaca]"></span> Full
        </div>
      </div>

      {/* Shift detail modal */}
      {selectedShift && (
        <ShiftModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSignup={handleSignup}
          onCancel={handleCancel}
        />
      )}

      {loading && (
        <div className="text-center text-gray-400 py-8">Loading shifts...</div>
      )}
    </div>
  );
}
