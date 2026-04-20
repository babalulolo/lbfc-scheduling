'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    inviteCode: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2d5016]">Join the Team</h1>
          <p className="text-gray-500 mt-1">Create your volunteer account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Code *</label>
            <input
              type="text"
              value={form.inviteCode}
              onChange={(e) => updateField('inviteCode', e.target.value.toUpperCase())}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition font-mono tracking-wider"
              placeholder="Enter your access code"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-3">Emergency Contact (optional)</p>
            <div className="space-y-3">
              <input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) => updateField('emergencyContactName', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
                placeholder="Emergency contact name"
              />
              <input
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
                placeholder="Emergency contact phone"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2d5016] text-white rounded-xl font-medium hover:bg-[#1a3a0a] transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#2d5016] font-medium hover:underline">
            Log in
          </Link>
        </p>

        <p className="text-center mt-2">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back</Link>
        </p>
      </div>
    </div>
  );
}
