'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscription?: {
    tier: number;
    tier_name: string;
    qi_boost_percent: number;
    expires_at: string;
  };
}

interface AutorenewStatus {
  hasPurchased: boolean;
}

export default function ShopPage() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [autorenewStatus, setAutorenewStatus] = useState<AutorenewStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      if (!isAuthenticated || !discordId) {
        setLoadingStatus(false);
        return;
      }

      try {
        const [subRes, autoRes] = await Promise.all([
          fetch(`/api/subscriptions/status?discordId=${discordId}&server=${server || 'S0'}`),
          fetch(`/api/autorenew/check-purchase?discordId=${discordId}&server=${server || 'S0'}`)
        ]);

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscriptionStatus(subData);
        }

        if (autoRes.ok) {
          const autoData = await autoRes.json();
          setAutorenewStatus(autoData);
        }
      } catch (err) {
        console.error('Error fetching statuses:', err);
      } finally {
        setLoadingStatus(false);
      }
    };

    if (isAuthenticated) {
      fetchStatuses();
    }
  }, [isAuthenticated, discordId, server]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="spinner"></div>
          <div className="text-base md:text-lg text-amber-400 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="glass rounded-2xl p-6 shadow-2xl text-center">
            <h1 className="text-2xl font-bold text-amber-400 mb-3">Sign In Required</h1>
            <p className="text-gray-300 mb-5 text-sm">Please sign in to access the shop</p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3 px-5 rounded-xl transition-all"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasSubscription = subscriptionStatus?.hasActiveSubscription;
  const hasAutorenew = autorenewStatus?.hasPurchased;

  return (
    <div className="min-h-screen p-4 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2 text-sm"
          >
            <span>←</span> Back
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-amber-400">Shop</h1>
          <div className="w-16"></div>
        </div>

        <div className="space-y-4">
          <Link href="/shop/subscriptions" className="block">
            <div className={`glass rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] ${hasSubscription ? 'border border-green-500/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xl">
                  🔮
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">Subscription</h3>
                    {hasSubscription && (
                      <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs truncate">
                    {hasSubscription 
                      ? `+${subscriptionStatus?.subscription?.qi_boost_percent}% Qi Boost`
                      : 'Boost Qi by 100-800%'
                    }
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-amber-400">$5+</div>
                  <div className="text-gray-500 text-[10px]">/month</div>
                </div>
              </div>
              {hasSubscription && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Exp: {new Date(subscriptionStatus?.subscription?.expires_at || '').toLocaleDateString()}
                  </span>
                  <span className="text-purple-400 font-medium">Manage →</span>
                </div>
              )}
            </div>
          </Link>

          <Link href="/shop/autorenew" className="block">
            <div className={`glass rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] ${hasAutorenew ? 'border border-green-500/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-xl">
                  ⚙️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">AutoRenew</h3>
                    {hasAutorenew && (
                      <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">OWNED</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs truncate">
                    {hasAutorenew ? 'Use /autorenew in Discord' : 'Auto-activate pills & boosts'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {hasAutorenew ? (
                    <div className="text-green-400 font-bold text-sm">Owned</div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-amber-400">$5</div>
                      <div className="text-gray-500 text-[10px]">one-time</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>

          <Link href="/payment" className="block">
            <div className="glass rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                  <Image src="/dao-coin.png" alt="DC" width={28} height={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white">DAO Coins</h3>
                  <p className="text-gray-400 text-xs truncate">Buy coins for in-game shop</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-amber-400">$1=1</div>
                  <div className="text-gray-500 text-[10px]">DC</div>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/offers" className="block">
            <div className="glass rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98] border border-red-500/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-xl">
                  🎁
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">Offers</h3>
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">SALE</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">Bulk packages up to 25% off</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-green-400">-25%</div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-6 glass rounded-2xl p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400 justify-center">
            <span className="flex items-center gap-1"><span className="text-green-400">✓</span> Instant delivery</span>
            <span className="flex items-center gap-1"><span className="text-green-400">✓</span> Secure PayPal</span>
            <span className="flex items-center gap-1"><span className="text-amber-400">•</span> Final sales</span>
          </div>
        </div>
      </div>
    </div>
  );
}
