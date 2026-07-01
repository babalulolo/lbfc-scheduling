'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Avatar from '@/components/Avatar';

// Resize an uploaded image to a small square-ish avatar and return a JPEG data URL.
function resizeImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [navUser, setNavUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', emergencyContactName: '', emergencyContactPhone: '',
  });
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);
  // undefined = unchanged, null = remove, string = new data URL
  const [pendingAvatar, setPendingAvatar] = useState(undefined);

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      if (!sessionData.user) {
        router.replace('/login');
        return;
      }
      setNavUser(sessionData.user);

      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.profile) {
        setForm({
          name: data.profile.name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          emergencyContactName: data.profile.emergencyContactName || '',
          emergencyContactPhone: data.profile.emergencyContactPhone || '',
        });
        setCurrentAvatarUrl(data.profile.avatarUrl || null);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { flash('error', 'Please choose an image file.'); return; }
    try {
      const dataUrl = await resizeImage(file);
      setPendingAvatar(dataUrl);
    } catch {
      flash('error', 'Could not read that image.');
    }
    e.target.value = ''; // allow re-selecting the same file
  }

  function removePhoto() {
    setPendingAvatar(null);
  }

  // What to show in the avatar preview right now.
  const previewSrc =
    pendingAvatar === undefined ? currentAvatarUrl : pendingAvatar; // null -> initials

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { flash('error', 'Name is required.'); return; }
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
      };
      if (pendingAvatar !== undefined) body.avatar = pendingAvatar; // string or null
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const freshUrl = data.profile.avatarUrl
          ? `${data.profile.avatarUrl}?v=${Date.now()}`
          : null;
        setCurrentAvatarUrl(freshUrl);
        setPendingAvatar(undefined);
        setNavUser((u) => (u ? { ...u, avatarUrl: freshUrl, name: data.profile.name } : u));
        flash('success', 'Profile saved');
      } else {
        flash('error', data.error || 'Could not save');
      }
    } catch {
      flash('error', 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none text-sm';

  return (
    <div className="min-h-screen">
      <Navbar user={navUser} />
      <main className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#2d5016] mb-4">My Profile</h1>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={save} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <Avatar src={previewSrc} name={form.name} size={72} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
                {previewSrc ? 'Change photo' : 'Add photo'}
              </button>
              {previewSrc && (
                <button type="button" onClick={removePhoto}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 transition">
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">A profile picture is optional. Photos are resized automatically.</p>

          {/* Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
            <input className={inputClass} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input className={`${inputClass} bg-gray-50 text-gray-500`} value={form.email} disabled />
            <p className="text-xs text-gray-400 mt-1">Email can't be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
            <input className={inputClass} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Emergency contact</label>
              <input className={inputClass} value={form.emergencyContactName} placeholder="Name"
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Emergency phone</label>
              <input className={inputClass} value={form.emergencyContactPhone} placeholder="Phone"
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="bg-[#2d5016] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a3a0a] transition disabled:opacity-40">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard')}
              className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
              Back
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
