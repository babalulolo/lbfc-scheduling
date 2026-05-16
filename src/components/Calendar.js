'use client';

import { useState, useEffect, useCallback } from 'react';
import ShiftModal from './ShiftModal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // for mobile day detail
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
    setSelectedDate(null);
  }, [fetchShifts]);

  // Auto-select today or first day with shifts when month loads
  useEffect(() => {
    if (loading || shifts.length === 0) return;
    const todayShifts = shifts.filter(s => s.date === todayStr);
    if (todayShifts.length > 0) {
      setSelectedDate(todayStr);
    } else {
      const first = shifts.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
      if (first) setSelectedDate(first.date);
    }
  }, [loading, shifts, todayStr]);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }
  function goToToday() {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  }

  async function handleSignup(shiftId) {
    const res = await fetch('/api/shifts/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: "You're signed up! Check your email for confirmation." });
      await fetchShifts();
      setSelectedShift(null);
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

  const calendarDays = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const pm = month === 0 ? 12 : month;
    const py = month === 0 ? year - 1 : year;
    calendarDays.push({ day, date: `${py}-${String(pm).padStart(2, '0')}-${String(day).padStart(2, '0')}`, otherMonth: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, date: dateStr, otherMonth: false, isToday: dateStr === todayStr });
  }
  const remaining = 42 - calendarDays.length;
  for (let day = 1; day <= remaining; day++) {
    const nm = month + 2 > 12 ? 1 : month + 2;
    const ny = month + 2 > 12 ? year + 1 : year;
    calendarDays.push({ day, date: `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`, otherMonth: true });
  }

  function getShiftsForDate(dateStr) {
    return shifts.filter((s) => s.date === dateStr);
  }

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatSelectedDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const selectedDayShifts = selectedDate ? getShiftsForDate(selectedDate) : [];

  // Dot color for a date
  function getDotColor(dateStr) {
    const dayShifts = getShiftsForDate(dateStr);
    if (dayShifts.length === 0) return null;
    if (dayShifts.some(s => s.isSignedUp)) return 'blue';
    if (dayShifts.some(s => s.slotsRemaining > 0)) return 'green';
    return 'red';
  }

  const Header = () => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-[#2d5016]">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={goToToday}
          className="text-xs bg-[#f0f7e6] text-[#2d5016] px-2.5 py-1 rounded-lg hover:bg-[#e0efd6] transition">
          Today
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg">‹</button>
        <button onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg">›</button>
      </div>
    </div>
  );

  return (
    <div>
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium fade-in ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <Header />

      {/* ── MOBILE VIEW: mini grid + day detail panel ── */}
      <div className="block sm:hidden">
        {/* Mini calendar grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="text-center py-2 text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((d, i) => {
              const dot = !d.otherMonth ? getDotColor(d.date) : null;
              const isSelected = d.date === selectedDate;
              return (
                <button
                  key={i}
                  onClick={() => !d.otherMonth && setSelectedDate(d.date)}
                  disabled={d.otherMonth}
                  className={`relative flex flex-col items-center justify-center py-1.5 transition ${
                    d.otherMonth ? 'opacity-0 pointer-events-none' : 'active:bg-gray-50'
                  }`}
                >
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition ${
                    isSelected
                      ? 'bg-[#2d5016] text-white'
                      : d.isToday
                      ? 'border-2 border-[#2d5016] text-[#2d5016]'
                      : 'text-gray-800'
                  }`}>
                    {d.day}
                  </span>
                  {/* Dot indicator */}
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    dot === 'green' ? 'bg-green-500' :
                    dot === 'blue' ? 'bg-blue-500' :
                    dot === 'red' ? 'bg-red-400' :
                    'invisible'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-3 text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Available</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Signed up</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Full</div>
        </div>

        {/* Day detail panel */}
        {selectedDate && (
          <div className="fade-in">
            <p className="text-sm font-semibold text-gray-500 mb-2 px-1">{formatSelectedDate(selectedDate)}</p>
            {selectedDayShifts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400 text-sm">
                No shifts on this day
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayShifts.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => setSelectedShift(shift)}
                    className={`w-full text-left rounded-xl p-4 border transition active:scale-[0.99] ${
                      shift.isSignedUp
                        ? 'bg-blue-50 border-blue-200'
                        : shift.slotsRemaining > 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{shift.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatTime(shift.startTime || shift.start_time)} – {formatTime(shift.endTime || shift.end_time)}
                        </p>
                        <p className="text-sm text-gray-400 truncate">{shift.location}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {shift.isSignedUp ? (
                          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Signed up ✓</span>
                        ) : shift.slotsRemaining > 0 ? (
                          <span className="text-xs font-medium text-green-700">{shift.slotsRemaining} spot{shift.slotsRemaining !== 1 ? 's' : ''} left</span>
                        ) : (
                          <span className="text-xs font-medium text-red-600">Full</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && (
          <p className="text-center text-gray-400 py-6 text-sm">Loading shifts...</p>
        )}
      </div>

      {/* ── DESKTOP VIEW: full grid ── */}
      <div className="hidden sm:block">
        <div className="calendar-grid mb-0">
          {DAYS.map((day) => (
            <div key={day} className="bg-[#2d5016] text-white text-center py-2 text-sm font-medium">
              {day}
            </div>
          ))}
          {calendarDays.map((d, i) => {
            const dayShifts = getShiftsForDate(d.date);
            return (
              <div key={i} className={`calendar-day ${d.otherMonth ? 'other-month' : ''} ${d.isToday ? 'today' : ''}`}>
                <span className={`text-sm font-medium ${d.isToday ? 'bg-[#2d5016] text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                  {d.day}
                </span>
                {dayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    onClick={() => setSelectedShift(shift)}
                    className={`shift-pill ${shift.isSignedUp ? 'signed-up' : shift.slotsRemaining > 0 ? 'available' : 'full'}`}
                    title={`${shift.title} (${shift.slotsRemaining} spots left)`}
                  >
                    {(shift.startTime || shift.start_time || '').slice(0, 5)} {shift.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="flex gap-6 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#dcfce7] border border-[#bbf7d0]"></span> Available</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#dbeafe] border border-[#bfdbfe]"></span> You&apos;re signed up</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#fee2e2] border border-[#fecaca]"></span> Full</div>
        </div>
      </div>

      {selectedShift && (
        <ShiftModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSignup={handleSignup}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
