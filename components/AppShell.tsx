'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Navigation from './Navigation';
import Header from './Header';

interface CodeAuth {
  discordId: string;
  server: string;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [codeAuth, setCodeAuth] = useState<CodeAuth | null>(null);

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

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <Navigation />
      <main className="pt-16 pb-20 md:pb-8 md:pl-64">
        <div className="px-4 py-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
