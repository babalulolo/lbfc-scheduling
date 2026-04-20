'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if setup already done
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) router.replace('/dashboard');
        setChecking(false);
      });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2d5016]">First-Time Setup</h1>
          <p className="text-gray-500 mt-1">Create your admin account to get started</p>
        </div>

        {result ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#2d5016] mb-4">You&apos;re all set!</h2>
            <p className="text-gray-600 mb-4">Your admin account has been created. Here are your initial invite codes to share with volunteers:</p>
            <div className="bg-[#f0f7e6] rounded-xl p-4 mb-4">
              {result.inviteCodes.map((code) => (
                <div key={code} className="font-mono text-sm py-1">{code}</div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-4">Save these codes — you can always generate more from the admin panel.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-[#2d5016] text-white rounded-xl font-medium hover:bg-[#1a3a0a] transition"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
                placeholder="At least 6 characters" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#2d5016] text-white rounded-xl font-medium hover:bg-[#1a3a0a] transition disabled:opacity-50">
              {loading ? 'Setting up...' : 'Create Admin Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
