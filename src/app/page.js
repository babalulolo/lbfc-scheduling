'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) router.replace('/dashboard');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#2d5016] mb-2">Long Beach<br />Food Coalition</h1>
          <p className="text-gray-500 text-lg">Volunteer Scheduling Portal</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full py-3 px-6 bg-[#2d5016] text-white rounded-xl font-medium hover:bg-[#1a3a0a] transition text-center"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="block w-full py-3 px-6 bg-white border-2 border-[#2d5016] text-[#2d5016] rounded-xl font-medium hover:bg-[#f0f7e6] transition text-center"
          >
            Sign Up with Access Code
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Need an access code? Contact your scheduling coordinator.
        </p>
      </div>
    </div>
  );
}
