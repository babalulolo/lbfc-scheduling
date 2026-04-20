'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

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
        <h1 className="text-2xl font-bold text-[#2d5016] mb-4">Admin Dashboard</h1>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium fade-in ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {['shifts', 'volunteers', 'access codes'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                tab === t ? 'bg-white shadow-sm text-[#2d5016]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Shifts Tab */}
        {tab === 'shifts' && (
          <ShiftsTab
            shifts={shifts}
            showNewShift={showNewShift}
            setShowNewShift={setShowNewShift}
            editingShift={editingShift}
            setEditingShift={setEditingShift}
            onRefresh={fetchData}
            flash={flash}
          />
        )}

        {/* Volunteers Tab */}
        {tab === 'volunteers' && (
          <VolunteersTab volunteers={volunteers} />
        )}

        {/* Invite Codes Tab */}
        {tab === 'access codes' && (
          <AccessCodesTab codes={accessCodes} onRefresh={fetchData} flash={flash} />
        )}
      </main>
    </div>
  );
}

function ShiftsTab({ shifts, showNewShift, setShowNewShift, editingShift, setEditingShift, onRefresh, flash }) {
  const [form, setForm] = useState({
    title: '', description: '', date: '', startTime: '', endTime: '',
    location: '', locationAddress: '', notes: '', slotsTotal: 5,
  });

  useEffect(() => {
    if (editingShift) {
      setForm({
        title: editingShift.title,
        description: editingShift.description || '',
        date: editingShift.date,
        startTime: editingShift.startTime || editingShift.start_time,
        endTime: editingShift.endTime || editingShift.end_time,
        location: editingShift.location,
        locationAddress: editingShift.locationAddress || editingShift.location_address || '',
        notes: editingShift.notes || '',
        slotsTotal: editingShift.slotsTotal || editingShift.slots_total,
      });
    }
  }, [editingShift]);

  function resetForm() {
    setForm({ title: '', description: '', date: '', startTime: '', endTime: '', location: '', locationAddress: '', notes: '', slotsTotal: 5 });
    setShowNewShift(false);
    setEditingShift(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const isEditing = !!editingShift;
    const url = '/api/admin/shifts';
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? { ...form, id: editingShift.id } : form;

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      flash('success', isEditing ? 'Shift updated' : 'Shift created');
      resetForm();
      onRefresh();
    } else {
      const data = await res.json();
      flash('error', data.error || 'Failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this shift? This will also remove all signups.')) return;
    const res = await fetch('/api/admin/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) {
      flash('success', 'Shift deleted');
      onRefresh();
    }
  }

  const formatTime = (t) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Manage Shifts</h2>
        {!showNewShift && !editingShift && (
          <button onClick={() => setShowNewShift(true)} className="bg-[#2d5016] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition">
            + New Shift
          </button>
        )}
      </div>

      {(showNewShift || editingShift) && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editingShift ? 'Edit Shift' : 'Create New Shift'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Title *</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none"
                placeholder="e.g., Food Rescue Pickup" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start *</label>
                <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End *</label>
                <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
              <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none"
                placeholder="e.g., Ralphs on 4th St" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.locationAddress} onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none"
                placeholder="Full street address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volunteer Slots</label>
              <input type="number" min="1" max="50" value={form.slotsTotal} onChange={(e) => setForm({ ...form, slotsTotal: parseInt(e.target.value) || 5 })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none"
                placeholder="Brief description of this shift" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none"
                placeholder="Any special instructions for volunteers (e.g., go to the back loading dock, ask for the manager)" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="bg-[#2d5016] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition">
              {editingShift ? 'Save Changes' : 'Create Shift'}
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
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
            <div key={shift.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{shift.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {shift.signupCount}/{shift.slotsTotal || shift.slots_total} signed up
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}
                  {formatTime(shift.startTime || shift.start_time)} – {formatTime(shift.endTime || shift.end_time)}
                  {' · '}
                  {shift.location}
                </p>
                {shift.signups && shift.signups.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Volunteers: {shift.signups.map(s => `${s.name} (${s.email})`).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => setEditingShift(shift)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                  Edit
                </button>
                <button onClick={() => handleDelete(shift.id)} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VolunteersTab({ volunteers }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Volunteers ({volunteers.length})</h2>
      {volunteers.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No volunteers yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
      )}
    </div>
  );
}

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
    if (res.ok) {
      flash('success', 'Access codes updated');
      onRefresh();
    } else {
      flash('error', 'Failed to update codes');
    }
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
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-[#2d5016]">Volunteer Code</h3>
              <p className="text-xs text-gray-400">Share with approved volunteers to let them sign up</p>
            </div>
            <button onClick={() => copyCode(volunteerCode, 'volunteer')}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#f0f7e6] text-[#2d5016] hover:bg-[#e0efd6] transition">
              Copy
            </button>
          </div>
          <input type="text" value={volunteerCode}
            onChange={(e) => setVolunteerCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none font-mono tracking-wider text-lg" />
        </div>

        <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-purple-700">Admin Code</h3>
              <p className="text-xs text-gray-400">Only share with coordinators who need admin access</p>
            </div>
            <button onClick={() => copyCode(adminCode, 'admin')}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition">
              Copy
            </button>
          </div>
          <input type="text" value={adminCode}
            onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-mono tracking-wider text-lg" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-[#2d5016] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
