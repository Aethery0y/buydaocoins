'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import ProductCard from '@/components/ProductCard';

interface PlayerStats {
  userId: string;
  realm: number;
  stage: number;
  qi: string;
  prestige: number;
  daoCoins: number;
  daoCoinsSpent: number;
  spiritStones: string;
  server?: string;
}

interface CodeAuth {
  discordId: string;
  server: string;
  username?: string;
}

interface Subscription {
  tier: number;
  tier_name: string;
  qi_boost_percent: number;
  expires_at: string;
}

const REALM_NAMES = [
  'Mortal', 'Qi Condensation', 'Foundation', 'Core Formation', 'Nascent Soul',
  'Soul Transformation', 'Void Tribulation', 'Body Integration', 'Mahayana', 'Tribulation',
];

export default function Home() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeAuth, setCodeAuth] = useState<CodeAuth | null>(null);
  const [showCodeLogin, setShowCodeLogin] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [selectedServer, setSelectedServer] = useState('S0');
  const [codeLoginLoading, setCodeLoginLoading] = useState(false);
  const [codeLoginError, setCodeLoginError] = useState('');

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

  useEffect(() => {
    if (codeAuth) {
      fetchStatsWithCode();
      fetchSubscription();
    } else if (session?.user) {
      fetchStats();
      fetchSubscription();
    }
  }, [session, codeAuth]);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user/stats?discordId=${session?.user?.id}&server=S0`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Player not found. Register in Discord first using /register');
          return;
        }
        throw new Error('Failed to fetch stats');
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsWithCode = async () => {
    if (!codeAuth) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user/stats-by-code?discordId=${codeAuth.discordId}&server=${codeAuth.server}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Player not found on this server');
          return;
        }
        throw new Error('Failed to fetch stats');
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    const userId = codeAuth?.discordId || session?.user?.id;
    const server = codeAuth?.server || 'S0';
    if (!userId) return;
    
    try {
      const res = await fetch(`/api/subscriptions/status?discordId=${userId}&server=${server}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveSubscription) {
          setSubscription(data.subscription);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription');
    }
  };

  const handleCodeLogin = async () => {
    if (!loginCode.trim()) {
      setCodeLoginError('Please enter your login code');
      return;
    }
    
    setCodeLoginLoading(true);
    setCodeLoginError('');
    
    try {
      const res = await fetch('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: loginCode, server: selectedServer }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setCodeLoginError(data.error || 'Invalid code');
        return;
      }
      
      const authData = { discordId: data.discordId, server: selectedServer, username: data.username };
      localStorage.setItem('codeAuth', JSON.stringify(authData));
      setCodeAuth(authData);
      setShowCodeLogin(false);
      setLoginCode('');
    } catch (err) {
      setCodeLoginError('Login failed. Please try again');
    } finally {
      setCodeLoginLoading(false);
    }
  };

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session && !codeAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-slate-900 font-bold text-3xl mx-auto mb-4 animate-float">
              D
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">DaoVerse Shop</h1>
            <p className="text-slate-400">Power up your cultivation journey</p>
          </div>

          <div className="card p-6 animate-slide-up">
            {!showCodeLogin ? (
              <>
                <button
                  onClick={() => signIn('discord')}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3.5 px-5 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-[#5865F2]/25"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Continue with Discord
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 text-xs text-slate-500 bg-slate-900">or use login code</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCodeLogin(true)}
                  className="w-full btn-secondary"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Login with Code
                  </span>
                </button>

                <p className="text-center text-xs text-slate-500 mt-4">
                  Use <code className="text-amber-400">/code</code> in Discord to get your login code
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setShowCodeLogin(false); setCodeLoginError(''); }}
                  className="btn-ghost mb-4 -ml-2"
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </span>
                </button>

                {codeLoginError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                    <p className="text-red-400 text-sm text-center">{codeLoginError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Login Code</label>
                    <input
                      type="text"
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                      placeholder="ABC-12345"
                      className="input-field text-center text-lg tracking-wider font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Server</label>
                    <select
                      value={selectedServer}
                      onChange={(e) => setSelectedServer(e.target.value)}
                      className="input-field"
                    >
                      <option value="S0" className="bg-slate-800">Origin Server (S0)</option>
                      <option value="DS1" className="bg-slate-800">DaoVerse Server 1 (DS1)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCodeLogin}
                    disabled={codeLoginLoading}
                    className="w-full btn-primary mt-2"
                  >
                    {codeLoginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="spinner"></div>
                        Logging in...
                      </span>
                    ) : 'Login'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {loading && (
        <div className="text-center py-12">
          <div className="spinner spinner-lg mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your profile...</p>
        </div>
      )}

      {error && (
        <div className="card bg-red-500/10 border-red-500/30 p-4">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      )}

      {stats && (
        <>
          <section className="card p-6">
            <div className="flex items-center gap-4 mb-6">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={64}
                  height={64}
                  className="rounded-2xl ring-4 ring-amber-500/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-slate-900 font-bold text-2xl">
                  {(session?.user?.name || codeAuth?.username || 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {session?.user?.name || codeAuth?.username || `Cultivator`}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-amber">
                    {REALM_NAMES[stats.realm - 1] || `Realm ${stats.realm}`} Stage {stats.stage}
                  </span>
                  <span className="badge badge-purple">{codeAuth?.server || 'S0'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatsCard
                label="DAO Coins"
                value={formatNumber(stats.daoCoins)}
                color="amber"
                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z"/></svg>}
              />
              <StatsCard
                label="Spirit Stones"
                value={formatNumber(stats.spiritStones)}
                color="blue"
                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/></svg>}
              />
              <StatsCard
                label="Qi"
                value={formatNumber(stats.qi)}
                color="purple"
                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>}
              />
              <StatsCard
                label="Prestige"
                value={stats.prestige}
                color="green"
                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
              />
            </div>

            {subscription && (
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-purple-400 font-semibold">{subscription.tier_name}</span>
                    <span className="text-slate-400 text-sm">+{subscription.qi_boost_percent}% Qi</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Expires {new Date(subscription.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title">Quick Shop</h3>
                <p className="section-subtitle">Power up your cultivation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProductCard
                title="DAO Coins"
                description="Purchase coins to unlock premium features and boosts"
                price="From $1"
                href="/shop"
                featured
                icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z"/></svg>}
              />
              <ProductCard
                title="Qi Boosts"
                description="Subscribe for permanent qi generation multipliers"
                price="From $5/mo"
                href="/shop/subscriptions"
                badge="Popular"
                icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>}
              />
              <ProductCard
                title="Special Offers"
                description="Limited time bundles and discounts"
                href="/offers"
                icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd"/><path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"/></svg>}
              />
              <ProductCard
                title="Auto Renew"
                description="Never run out of cultivation resources"
                href="/shop/autorenew"
                icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>}
              />
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-slate-300 font-medium">Secure Payments</p>
                <p className="text-slate-500 text-xs">All transactions are processed securely via PayPal</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
