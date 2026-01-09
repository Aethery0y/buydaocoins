'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface CodeAuth {
  discordId: string;
  server: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  discordId: string | null;
  server: string | null;
  userName: string | null;
  userImage: string | null;
  isCodeAuth: boolean;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { data: session, status } = useSession();
  const [codeAuth, setCodeAuth] = useState<CodeAuth | null>(null);
  const [codeAuthChecked, setCodeAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('codeAuth');
      if (stored) {
        try {
          setCodeAuth(JSON.parse(stored));
        } catch (e) {
          localStorage.removeItem('codeAuth');
        }
      }
      setCodeAuthChecked(true);
    }
  }, []);

  const logout = () => {
    if (codeAuth) {
      localStorage.removeItem('codeAuth');
      setCodeAuth(null);
      window.location.reload();
    }
  };

  const isLoading = status === 'loading' || !codeAuthChecked;
  
  if (session?.user) {
    return {
      isAuthenticated: true,
      isLoading: false,
      discordId: (session.user as any).id || null,
      server: 'S0',
      userName: session.user.name || null,
      userImage: session.user.image || null,
      isCodeAuth: false,
      logout: () => {}
    };
  }

  if (codeAuth) {
    return {
      isAuthenticated: true,
      isLoading: false,
      discordId: codeAuth.discordId,
      server: codeAuth.server,
      userName: null,
      userImage: null,
      isCodeAuth: true,
      logout
    };
  }

  return {
    isAuthenticated: false,
    isLoading,
    discordId: null,
    server: null,
    userName: null,
    userImage: null,
    isCodeAuth: false,
    logout: () => {}
  };
}
