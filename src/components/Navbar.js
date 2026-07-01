'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

export default function Navbar({ user }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <nav className="bg-[#2d5016] text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold">LBFC</span>
          <span className="text-sm opacity-80 hidden sm:inline">Volunteer Portal</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
            >
              Admin
            </Link>
          )}
          <Link
            href="/dashboard"
            className="text-sm hover:bg-white/10 px-3 py-1.5 rounded-lg transition"
          >
            Calendar
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-lg transition" title="My Profile">
              <Avatar src={user?.avatarUrl} name={user?.name} size={28} />
              <span className="text-sm opacity-80 hidden sm:inline">{user?.name}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
