'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CodeAuth {
  discordId: string;
  server: string;
  username?: string;
}

export default function Header() {
  const { data: session, status } = useSession();
  const [codeAuth, setCodeAuth] = useState<CodeAuth | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('codeAuth');
    if (stored) {
      try {
        setCodeAuth(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('codeAuth');
      }
    }
  }, []);

  const isAuthenticated = session?.user || codeAuth;
  const displayName = session?.user?.name || codeAuth?.username || 'Cultivator';
  const server = codeAuth?.server || 'S0';

  const handleLogout = async () => {
    if (codeAuth) {
      localStorage.removeItem('codeAuth');
      setCodeAuth(null);
    }
    setShowMenu(false);
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      window.location.href = '/';
    }
  };

  if (!isAuthenticated) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 md:left-64">
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-slate-900 font-bold text-sm">
                D
              </div>
              <span className="font-bold text-white">DaoVerse</span>
            </Link>
          </div>

          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-white">Shop</h2>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 py-1.5 px-3 rounded-xl hover:bg-slate-800/50 transition-colors"
            >
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-amber-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-slate-900 font-bold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white truncate max-w-[120px]">{displayName}</p>
                <p className="text-[10px] text-amber-400 font-medium">{server}</p>
              </div>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 card p-2 shadow-xl z-50 animate-scale-in">
                  <Link
                    href="/"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
