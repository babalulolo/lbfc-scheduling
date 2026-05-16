'use client';

import { useState, useEffect, useCallback } from 'react';
import ShiftModal from './ShiftModal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }
  function goToToday() { setCurrentDate(new Date()); }

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

  // Build calendar grid data
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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

  // Mobile list: days in this month that have shifts, plus today if it has none
  const mobileListDays = calendarDays
    .filter(d => !d.otherMonth)
    .map(d => ({ ...d, dayShifts: getShiftsForDate(d.date) }))
    .filter(d => d.dayShifts.length > 0);

  const formatMobileDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return {
      weekday: SHORT_DAYS[d.getDay()],
      month: MONTHS[d.getMonth()].slice(0, 3),
      day: d.getDate(),
    };
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const Header = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-[#2d5016]">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={goToToday}
          className="text-xs bg-[#f0f7e6] text-[#2d5016] px-2.5 py-1 rounded-lg hover:bg-[#e0efd6] transition"
        >
          Today
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg"
        >‹</button>
        <button onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg"
        >›</button>
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

      {/* ── MOBILE LIST VIEW ── */}
      <div className="block sm:hidden">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading shifts...</p>
        ) : mobileListDays.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">No shifts this month</p>
            <p className="text-sm mt-1">Check back later or browse another month</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mobileListDays.map((d) => {
              const { weekday, month: mo, day } = formatMobileDate(d.date);
              const isToday = d.date === todayStr;
              return (
                <div key={d.date}>
                  {/* Date header */}
                  <div className={`flex items-center gap-3 px-1 py-2 ${isToday ? 'text-[#2d5016]' : 'text-gray-500'}`}>
                    <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-xs leading-tight flex-shrink-0 ${
                      isToday ? 'bg-[#2d5016] text-white' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{weekday.slice(0, 2)}</span>
                      <span className="font-bold text-sm">{day}</span>
                    </div>
                    <span className="text-sm font-medium">{mo} {day}</span>
                    {isToday && <span className="text-xs font-medium bg-[#f0f7e6] text-[#2d5016] px-2 py-0.5 rounded-full">Today</span>}
                  </div>

                  {/* Shifts for this day */}
                  <div className="space-y-2 ml-1">
                    {d.dayShifts.map((shift) => {
                      const statusClass = shift.isSignedUp ? 'signed-up-card' : shift.slotsRemaining > 0 ? 'available-card' : 'full-card';
                      return (
                        <button
                          key={shift.id}
                          onClick={() => setSelectedShift(shift)}
                          className={`w-full text-left rounded-xl p-3.5 border transition active:scale-[0.98] ${
                            shift.isSignedUp
                              ? 'bg-blue-50 border-blue-200'
                              : shift.slotsRemaining > 0
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{shift.title}</p>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {formatTime(shift.startTime || shift.start_time)} – {formatTime(shift.endTime || shift.end_time)}
                              </p>
                              <p className="text-sm text-gray-500 truncate">{shift.location}</p>
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
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 mt-5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200"></span> Available</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span> Signed up</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200"></span> Full</div>
        </div>
      </div>

      {/* ── DESKTOP GRID VIEW ── */}
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

      {loading && !shifts.length && (
        <div className="hidden sm:block text-center text-gray-400 py-8">Loading shifts...</div>
      )}

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
