'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { formatClockLA, isoToLocalInputLA, localInputToIsoLA, todayLA } from '@/lib/time';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateWeeklyDates(startDate, weeks) {
  if (!startDate || weeks < 1) return [];
  const result = [];
  // Noon-UTC + UTC stepping keeps this pure calendar-date math (no timezone drift).
  const d = new Date(startDate + 'T12:00:00Z');
  for (let i = 0; i < weeks; i++) {
    result.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return result;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('shifts');
  const [shifts, setShifts] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [accessCodes, setAccessCodes] = useState({ volunteer: '', admin: '' });
  const [showNewShift, setShowNewShift] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [shiftsRes, volunteersRes, codesRes] = await Promise.all([
      fetch('/api/shifts'),
      fetch('/api/admin/volunteers'),
      fetch('/api/invite-codes'),
    ]);
    const [shiftsData, volunteersData, codesData] = await Promise.all([
      shiftsRes.json(),
      volunteersRes.json(),
      codesRes.json(),
    ]);
    setShifts(shiftsData.shifts || []);
    setVolunteers(volunteersData.volunteers || []);
    setAccessCodes(codesData.codes || { volunteer: '', admin: '' });
  }, []);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.replace('/login');
        } else if (data.user.role !== 'admin') {
          router.replace('/dashboard');
        } else {
          setUser(data.user);
          fetchData();
        }
        setLoading(false);
      });
  }, [router, fetchData]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#2d5016] mb-4">Admin Dashboard</h1>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium fade-in ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="overflow-x-auto -mx-4 px-4 mb-6">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit min-w-max">
            {['shifts', 'volunteers', 'access codes'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize whitespace-nowrap ${
                  tab === t ? 'bg-white shadow-sm text-[#2d5016]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'shifts' && (
          <ShiftsTab
            shifts={shifts}
            volunteers={volunteers}
            showNewShift={showNewShift}
            setShowNewShift={setShowNewShift}
            editingShift={editingShift}
            setEditingShift={setEditingShift}
            onRefresh={fetchData}
            flash={flash}
          />
        )}
        {tab === 'volunteers' && <VolunteersTab volunteers={volunteers} />}
        {tab === 'access codes' && <AccessCodesTab codes={accessCodes} onRefresh={fetchData} flash={flash} />}
      </main>
    </div>
  );
}

// ─── Mini calendar for custom date picking ────────────────────────────────────

function CustomCalendar({ customDates, setCustomDates }) {
  const todayStr = todayLA(); // 'YYYY-MM-DD' in Pacific
  const [calYear, setCalYear] = useState(Number(todayStr.slice(0, 4)));
  const [calMonth, setCalMonth] = useState(Number(todayStr.slice(5, 7)) - 1);

  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0 = Sunday
  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  function toggleDate(dateStr) {
    const next = new Set(customDates);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    setCustomDates(next);
  }

  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const sortedSelected = [...customDates].sort();

  return (
    <div>
      <div className="bg-gray-50 rounded-xl p-3 w-full max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded-lg text-gray-600 text-sm">
            ‹
          </button>
          <span className="text-sm font-medium text-gray-700">{monthLabel}</span>
          <button type="button" onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded-lg text-gray-600 text-sm">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center mb-1">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
            <div key={d} className="text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const mPad = String(calMonth + 1).padStart(2, '0');
            const dPad = String(d).padStart(2, '0');
            const dateStr = `${calYear}-${mPad}-${dPad}`;
            const isSelected = customDates.has(dateStr);
            const isPast = dateStr < todayStr; // string compare, timezone-proof
            return (
              <button key={i} type="button"
                onClick={() => !isPast && toggleDate(dateStr)}
                className={`text-xs rounded-lg py-1.5 transition ${
                  isSelected ? 'bg-[#2d5016] text-white font-semibold' :
                  isPast ? 'text-gray-300 cursor-not-allowed' :
                  'hover:bg-[#e8f2db] text-gray-700'
                }`}>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {sortedSelected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {sortedSelected.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-[#2d5016] text-white rounded-full">
              {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              <button type="button" onClick={() => toggleDate(d)} className="hover:opacity-70 ml-0.5">×</button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-2">Click dates to select them.</p>
      )}
    </div>
  );
}

// ─── Shifts tab ───────────────────────────────────────────────────────────────

function ShiftsTab({ shifts, volunteers, showNewShift, setShowNewShift, editingShift, setEditingShift, onRefresh, flash }) {
  const [form, setForm] = useState({
    title: '', description: '', date: '', startTime: '', endTime: '',
    location: '', locationAddress: '', notes: '', slotsTotal: 5,
  });
  const [repeat, setRepeat] = useState('none');    // 'none' | 'weekly' | 'custom'
  const [weekCount, setWeekCount] = useState(8);
  const [customDates, setCustomDates] = useState(new Set());

  useEffect(() => {
    if (editingShift) {
      setForm({
        title: editingShift.title,
        description: editingShift.description || '',
        date: editingShift.date,
        startTime: editingShift.startTime || editingShift.start_time || '',
        endTime: editingShift.endTime || editingShift.end_time || '',
        location: editingShift.location,
        locationAddress: editingShift.locationAddress || editingShift.location_address || '',
        notes: editingShift.notes || '',
        slotsTotal: editingShift.slotsTotal || editingShift.slots_total || 5,
      });
      setRepeat('none');
    }
  }, [editingShift]);

  function resetForm() {
    setForm({ title: '', description: '', date: '', startTime: '', endTime: '', location: '', locationAddress: '', notes: '', slotsTotal: 5 });
    setRepeat('none');
    setWeekCount(8);
    setCustomDates(new Set());
    setShowNewShift(false);
    setEditingShift(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (editingShift) {
      // Single edit — always just this one
      const res = await fetch('/api/admin/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingShift.id }),
      });
      if (res.ok) { flash('success', 'Shift updated'); resetForm(); onRefresh(); }
      else { const d = await res.json(); flash('error', d.error || 'Failed'); }
      return;
    }

    // Build dates array based on repeat mode
    let dates = [];
    if (repeat === 'weekly') {
      dates = generateWeeklyDates(form.date, weekCount);
      if (dates.length === 0) { flash('error', 'Choose a start date first.'); return; }
    } else if (repeat === 'custom') {
      dates = [...customDates].sort();
      if (dates.length === 0) { flash('error', 'Select at least one date on the calendar.'); return; }
    } else {
      if (!form.date) { flash('error', 'Please select a date.'); return; }
      dates = [form.date];
    }

    const res = await fetch('/api/admin/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, dates }),
    });

    if (res.ok) {
      const data = await res.json();
      const count = data.count || 1;
      flash('success', count > 1 ? `${count} shifts created` : 'Shift created');
      resetForm();
      onRefresh();
    } else {
      const d = await res.json();
      flash('error', d.error || 'Failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this shift? This will also remove all signups.')) return;
    const res = await fetch('/api/admin/shifts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { flash('success', 'Shift deleted'); onRefresh(); }
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none text-sm';
  const weeklyDates = repeat === 'weekly' && form.date ? generateWeeklyDates(form.date, weekCount) : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Manage Shifts</h2>
        {!showNewShift && !editingShift && (
          <button onClick={() => setShowNewShift(true)}
            className="bg-[#2d5016] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition">
            + New Shift
          </button>
        )}
      </div>

      {(showNewShift || editingShift) && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 mb-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editingShift ? 'Edit Shift' : 'Create New Shift'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Title *</label>
              <input type="text" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass} placeholder="e.g., Food Rescue Pickup" />
            </div>

            {/* Date — hidden in custom mode (calendar replaces it) */}
            {repeat !== 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {repeat === 'weekly' ? 'Start Date *' : 'Date *'}
                </label>
                <input type="date" required value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={inputClass} />
              </div>
            )}

            {/* Time */}
            <div className={`flex gap-3 ${repeat === 'custom' ? 'sm:col-span-2' : ''}`}>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start *</label>
                <input type="time" required value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <input type="time" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className={inputClass} />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
              <input type="text" required value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={inputClass} placeholder="e.g., Ralphs on 4th St" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.locationAddress}
                onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
                className={inputClass} placeholder="Full street address" />
            </div>

            {/* Slots */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volunteer Slots</label>
              <input type="number" min="1" max="50" value={form.slotsTotal}
                onChange={(e) => setForm({ ...form, slotsTotal: parseInt(e.target.value) || 5 })}
                className={inputClass} />
            </div>

            {/* Description + Notes */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass} placeholder="Brief description of this shift" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Notes</label>
              <textarea value={form.notes} rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass} placeholder="Special instructions for volunteers" />
            </div>

            {/* ── Repeat section (new shifts only) ── */}
            {!editingShift && (
              <div className="sm:col-span-2 border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[
                    { val: 'none',   label: 'None' },
                    { val: 'weekly', label: 'Weekly' },
                    { val: 'custom', label: 'Custom Dates' },
                  ].map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setRepeat(val)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition ${
                        repeat === val
                          ? 'bg-[#2d5016] text-white border-[#2d5016]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Weekly options */}
                {repeat === 'weekly' && (
                  <div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <label className="text-sm text-gray-600">Repeat for</label>
                      <input type="number" min="2" max="52" value={weekCount}
                        onChange={(e) => setWeekCount(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none" />
                      <label className="text-sm text-gray-600">weeks</label>
                    </div>
                    {!form.date && (
                      <p className="text-xs text-amber-600 mb-2">↑ Choose a start date above to preview dates.</p>
                    )}
                    {weeklyDates.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">{weeklyDates.length} shifts will be created:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {weeklyDates.map((d, i) => (
                            <span key={d} className={`text-xs px-2.5 py-1 rounded-full ${
                              i === 0 ? 'bg-[#2d5016] text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom date picker */}
                {repeat === 'custom' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Click any dates to select them.</p>
                    <CustomCalendar customDates={customDates} setCustomDates={setCustomDates} />
                  </div>
                )}
              </div>
            )}

          </div>{/* end grid */}

          <div className="flex gap-3 mt-5">
            <button type="submit"
              className="bg-[#2d5016] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition">
              {editingShift ? 'Save Changes' : repeat === 'none' ? 'Create Shift' : `Create ${repeat === 'weekly' ? weeklyDates.length || weekCount : [...customDates].length || ''} Shifts`}
            </button>
            <button type="button" onClick={resetForm}
              className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Shift list */}
      <div className="space-y-3">
        {shifts.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No shifts yet. Create your first one above.</p>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold">{shift.title}</h3>
                    {(shift.recurrenceGroupId || shift.recurrence_group_id) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">↻ recurring</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                      {shift.signupCount}/{shift.slotsTotal || shift.slots_total} signed up
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {formatTime(shift.startTime || shift.start_time)}
                    {(shift.endTime || shift.end_time) ? ` – ${formatTime(shift.endTime || shift.end_time)}` : ''}
                  </p>
                  <p className="text-sm text-gray-400">{shift.location}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setEditingShift(shift)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(shift.id)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                    Delete
                  </button>
                </div>
              </div>

              <ManageVolunteers shift={shift} volunteers={volunteers} onRefresh={onRefresh} flash={flash} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Clock-time helpers ───────────────────────────────────────────────────────

// Pacific-time clock display (never browser-local / UTC).
function fmtClock(iso) {
  return formatClockLA(iso);
}

function clockHours(inIso, outIso) {
  if (!inIso || !outIso) return null;
  const ms = new Date(outIso) - new Date(inIso);
  return ms > 0 ? Math.round((ms / 3600000) * 10) / 10 : null;
}

// ISO → value for <input type="datetime-local">, shown as Pacific wall-clock.
function isoToInput(iso) {
  return isoToLocalInputLA(iso);
}

// datetime-local value (entered as Pacific wall-clock) → UTC ISO string.
function inputToIso(val) {
  return localInputToIsoLA(val);
}

function ClockRow({ shift, signup, onRemove, onRefresh, flash, busy }) {
  const [editing, setEditing] = useState(false);
  const [inVal, setInVal] = useState(isoToInput(signup.clockInAt));
  const [outVal, setOutVal] = useState(isoToInput(signup.clockOutAt));
  const [saving, setSaving] = useState(false);

  const hrs = clockHours(signup.clockInAt, signup.clockOutAt);
  let status;
  if (signup.clockOutAt) {
    status = `${hrs != null ? hrs + ' hrs' : 'done'} · ${fmtClock(signup.clockInAt)}–${fmtClock(signup.clockOutAt)}`;
  } else if (signup.clockInAt) {
    status = `Clocked in ${fmtClock(signup.clockInAt)} · still open`;
  } else {
    status = 'Not clocked in';
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/admin/shifts/clock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftId: shift.id,
        userId: signup.userId,
        clockInAt: inputToIso(inVal),
        clockOutAt: inputToIso(outVal),
      }),
    });
    const data = await res.json();
    if (res.ok) { flash('success', 'Hours updated'); setEditing(false); onRefresh(); }
    else { flash('error', data.error || 'Failed to update hours'); }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{signup.name}</p>
          <p className="text-xs text-gray-400">{status}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(!editing)}
            className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-white transition">
            {editing ? 'Close' : 'Edit hours'}
          </button>
          <button onClick={() => onRemove(signup.userId)} disabled={busy}
            className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition disabled:opacity-40"
            title={`Remove ${signup.name}`}>
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500">
            Clock in
            <input type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)}
              className="block mt-0.5 px-2 py-1 rounded-md border border-gray-200 text-xs" />
          </label>
          <label className="text-xs text-gray-500">
            Clock out
            <input type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)}
              className="block mt-0.5 px-2 py-1 rounded-md border border-gray-200 text-xs" />
          </label>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 rounded-md bg-[#2d5016] text-white text-xs font-medium hover:bg-[#1a3a0a] transition disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setInVal(''); setOutVal(''); }}
            className="px-2 py-1.5 rounded-md border border-gray-200 text-xs text-gray-500 hover:bg-white transition">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Per-shift volunteer management ───────────────────────────────────────────

function ManageVolunteers({ shift, volunteers, onRefresh, flash }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const signups = shift.signups || [];
  const slotsTotal = shift.slotsTotal || shift.slots_total;
  const signedUpIds = new Set(signups.map((s) => s.userId));
  const available = (volunteers || []).filter((v) => !signedUpIds.has(v.id));
  const isFull = signups.length >= slotsTotal;

  async function addVolunteer() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch('/api/admin/shifts/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: shift.id, userId: selected }),
    });
    const data = await res.json();
    if (res.ok) { flash('success', data.message || 'Volunteer added'); setSelected(''); onRefresh(); }
    else { flash('error', data.error || 'Failed to add volunteer'); }
    setBusy(false);
  }

  async function removeVolunteer(userId) {
    setBusy(true);
    const res = await fetch('/api/admin/shifts/signup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: shift.id, userId }),
    });
    const data = await res.json();
    if (res.ok) { flash('success', data.message || 'Volunteer removed'); onRefresh(); }
    else { flash('error', data.error || 'Failed to remove volunteer'); }
    setBusy(false);
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2">Volunteers ({signups.length}/{slotsTotal})</p>

      {signups.length > 0 ? (
        <div className="space-y-2 mb-3">
          {signups.map((s) => (
            <ClockRow key={s.userId} shift={shift} signup={s}
              onRemove={removeVolunteer} onRefresh={onRefresh} flash={flash} busy={busy} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">No volunteers signed up yet.</p>
      )}

      {isFull ? (
        <p className="text-xs text-gray-400">This shift is full. Remove someone or add slots to add more.</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-gray-400">All volunteers are already on this shift.</p>
      ) : (
        <div className="flex gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none">
            <option value="">Add a volunteer…</option>
            {available.map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.role === 'admin' ? ' (admin)' : ''}</option>
            ))}
          </select>
          <button onClick={addVolunteer} disabled={!selected || busy}
            className="px-4 py-1.5 rounded-lg bg-[#2d5016] text-white text-sm font-medium hover:bg-[#1a3a0a] transition disabled:opacity-40 whitespace-nowrap">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Volunteers tab ───────────────────────────────────────────────────────────

function VolunteersTab({ volunteers }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Volunteers ({volunteers.length})</h2>
      {volunteers.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No volunteers yet.</p>
      ) : (
        <>
          {/* Mobile: card view */}
          <div className="sm:hidden space-y-3">
            {volunteers.map((v) => (
              <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">{v.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${v.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {v.role}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{v.email}</p>
                {v.phone && <p className="text-sm text-gray-500">{v.phone}</p>}
                <p className="text-xs text-gray-400 mt-1">Joined {new Date(v.createdAt || v.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table view */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 px-4 font-medium">{v.name}</td>
                    <td className="py-3 px-4 text-gray-500">{v.email}</td>
                    <td className="py-3 px-4 text-gray-500">{v.phone || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {v.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{new Date(v.createdAt || v.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Access codes tab ─────────────────────────────────────────────────────────

function AccessCodesTab({ codes, onRefresh, flash }) {
  const [volunteerCode, setVolunteerCode] = useState(codes.volunteer || '');
  const [adminCode, setAdminCode] = useState(codes.admin || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVolunteerCode(codes.volunteer || '');
    setAdminCode(codes.admin || '');
  }, [codes]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/invite-codes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteer: volunteerCode, admin: adminCode }),
    });
    if (res.ok) { flash('success', 'Access codes updated'); onRefresh(); }
    else { flash('error', 'Failed to update codes'); }
    setSaving(false);
  }

  function copyCode(code, label) {
    navigator.clipboard.writeText(code);
    flash('success', `Copied ${label} code to clipboard`);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Access Codes</h2>
      <p className="text-sm text-gray-500 mb-6">Share these codes with people so they can create accounts. Everyone uses the same code — no need to generate individual ones.</p>

      <div className="space-y-4 max-w-lg">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-[#2d5016]">Volunteer Code</h3>
              <p className="text-xs text-gray-400">Share with approved volunteers</p>
            </div>
            <button onClick={() => copyCode(volunteerCode, 'volunteer')}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#f0f7e6] text-[#2d5016] hover:bg-[#e0efd6] transition">
              Copy
            </button>
          </div>
          <input type="text" value={volunteerCode}
            onChange={(e) => setVolunteerCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none font-mono tracking-wider text-base sm:text-lg" />
        </div>

        <div className="bg-white rounded-2xl border border-purple-100 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-purple-700">Admin Code</h3>
              <p className="text-xs text-gray-400">Only share with coordinators</p>
            </div>
            <button onClick={() => copyCode(adminCode, 'admin')}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition">
              Copy
            </button>
          </div>
          <input type="text" value={adminCode}
            onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-mono tracking-wider text-base sm:text-lg" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-[#2d5016] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition disabled:opacity-50 w-full sm:w-auto">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
