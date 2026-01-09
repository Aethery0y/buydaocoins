'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

const TIERS = [
  { id: 1, name: 'Cultivator', emoji: '🌟', price: 5, boost: 100, color: 'from-green-500 to-emerald-600' },
  { id: 2, name: 'Dao Seeker', emoji: '⭐', price: 10, boost: 200, color: 'from-amber-500 to-yellow-600' },
  { id: 3, name: 'Immortal', emoji: '💎', price: 15, boost: 400, color: 'from-purple-500 to-pink-600' },
  { id: 4, name: 'Divine', emoji: '👑', price: 22, boost: 800, color: 'from-rose-500 to-red-600' },
];

const DURATIONS = [
  { months: 1, label: '1 Month', discount: 0 },
  { months: 6, label: '6 Months', discount: 10 },
  { months: 12, label: '1 Year', discount: 20 },
];

export default function SubscriptionsPage() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSub, setCurrentSub] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && discordId) {
      fetch(`/api/subscriptions/status?discordId=${discordId}&server=${server || 'S0'}`)
        .then(res => res.json())
        .then(data => {
          if (data.hasActiveSubscription) {
            setCurrentSub(data.subscription);
          }
        })
        .catch(console.error);
    }
  }, [isAuthenticated, discordId, server]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  const tier = TIERS.find(t => t.id === selectedTier)!;
  const duration = DURATIONS.find(d => d.months === selectedDuration)!;
  const basePrice = tier.price * duration.months;
  const finalPrice = Math.round(basePrice * (1 - duration.discount / 100) * 100) / 100;
  const savings = basePrice - finalPrice;

  const currentTierId = currentSub?.tier || 0;
  const isUpgrade = selectedTier > currentTierId;
  const isExtend = selectedTier === currentTierId && currentTierId > 0;

  const handlePurchase = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscriptions/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: selectedTier,
          months: selectedDuration,
          amount: finalPrice,
          discordId,
          server: server || 'S0'
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create order');
      }

      const data = await res.json();
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-24 md:pb-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/shop')} className="text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-amber-400">Subscriptions</h1>
          <div className="w-12"></div>
        </div>

        {currentSub && (
          <div className="glass rounded-xl p-4 mb-6 border border-green-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TIERS.find(t => t.id === currentSub.tier)?.emoji}</span>
              <div className="flex-1">
                <div className="text-white font-bold">{currentSub.tier_name}</div>
                <div className="text-green-400 text-sm">+{currentSub.qi_boost_percent}% Active</div>
              </div>
              <div className="text-right text-xs text-gray-400">
                Expires<br />{new Date(currentSub.expires_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-3 font-medium">Select Tier</div>
          <div className="space-y-2">
            {TIERS.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTier(t.id)}
                className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${selectedTier === t.id
                    ? 'bg-amber-500/20 border border-amber-500'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="text-left">
                    <div className="text-white font-medium flex items-center gap-2">
                      {t.name}
                      {t.id === currentTierId && (
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">CURRENT</span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">+{t.boost}% Qi Boost</div>
                  </div>
                </div>
                <div className="text-amber-400 font-bold">${t.price}/mo</div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-3 font-medium">Select Duration</div>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.months}
                onClick={() => setSelectedDuration(d.months)}
                className={`p-3 rounded-lg text-center transition-all ${selectedDuration === d.months
                    ? 'bg-amber-500/20 border border-amber-500'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
              >
                <div className="text-white font-medium text-sm">{d.label}</div>
                {d.discount > 0 && (
                  <div className="text-green-400 text-xs font-bold">-{d.discount}%</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">{tier.name} × {duration.label}</span>
            {savings > 0 && <span className="text-green-400 text-sm font-bold">Save ${savings.toFixed(2)}</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white font-bold text-lg">Total</span>
            <span className="text-amber-400 font-bold text-2xl">${finalPrice.toFixed(2)}</span>
          </div>
          {isUpgrade && currentSub && (
            <div className="text-purple-400 text-xs mt-2">Upgrading from {currentSub.tier_name}</div>
          )}
          {isExtend && (
            <div className="text-green-400 text-xs mt-2">Extending your current subscription</div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={loading}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all ${loading ? 'bg-gray-600' :
              isUpgrade ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700' :
                isExtend ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' :
                  'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
            }`}
        >
          {loading ? 'Processing...' :
            isUpgrade ? `Upgrade - $${finalPrice.toFixed(2)}` :
              isExtend ? `Extend - $${finalPrice.toFixed(2)}` :
                `Subscribe - $${finalPrice.toFixed(2)}`}
        </button>

        <p className="text-center text-gray-500 text-xs mt-4">
          Secure payment via PayPal
        </p>
      </div>
    </div>
  );
}
