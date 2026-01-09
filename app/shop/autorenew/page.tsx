'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function AutoRenewPage() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasPurchased, setHasPurchased] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (discordId) {
      fetch(`/api/autorenew/check-purchase?discordId=${discordId}&server=${server}`)
        .then(res => res.json())
        .then(data => setHasPurchased(data.hasPurchased || false))
        .catch(console.error)
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, [discordId, server]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/');
    return null;
  }

  const handlePurchase = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: 'autorenew',
          amount: 5,
          description: 'AutoRenew Feature',
          discordId,
          server
        })
      });

      if (!res.ok) throw new Error('Failed to create order');
      
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
          <h1 className="text-xl font-bold text-amber-400">AutoRenew</h1>
          <div className="w-12"></div>
        </div>

        <div className="glass rounded-xl p-5 mb-4 text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <h2 className="text-2xl font-bold text-white mb-1">AutoRenew</h2>
          <p className="text-gray-400 text-sm mb-4">Never miss a boost again</p>
          
          {hasPurchased ? (
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <div className="text-green-400 font-bold text-lg">✓ Already Owned</div>
              <p className="text-gray-400 text-sm mt-1">Use /autorenew in Discord to manage</p>
            </div>
          ) : (
            <div className="text-3xl font-bold text-amber-400">$5.00</div>
          )}
          <p className="text-gray-500 text-xs mt-2">One-time purchase • Forever access</p>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-3 font-medium">What You Get</div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-amber-400">⚡</span>
              <div>
                <div className="text-white text-sm font-medium">Auto-Activate Pills</div>
                <div className="text-gray-500 text-xs">Uses your highest-rank pills automatically</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400">🔋</span>
              <div>
                <div className="text-white text-sm font-medium">Auto-Activate Qi Boosts</div>
                <div className="text-gray-500 text-xs">Never miss a boost opportunity</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400">⏱️</span>
              <div>
                <div className="text-white text-sm font-medium">24/7 Active</div>
                <div className="text-gray-500 text-xs">Works while you're offline</div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-2 font-medium">How It Works</div>
          <ol className="space-y-1 text-sm">
            <li className="text-gray-300"><span className="text-amber-400">1.</span> Purchase AutoRenew</li>
            <li className="text-gray-300"><span className="text-amber-400">2.</span> Stock pills & qi boosts in your inventory</li>
            <li className="text-gray-300"><span className="text-amber-400">3.</span> Use /autorenew in Discord to enable</li>
          </ol>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {!hasPurchased && (
          <button
            onClick={handlePurchase}
            disabled={loading || checking}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all ${
              loading || checking
                ? 'bg-gray-600'
                : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700'
            }`}
          >
            {checking ? 'Checking...' : loading ? 'Processing...' : 'Buy AutoRenew - $5.00'}
          </button>
        )}

        <p className="text-center text-gray-500 text-xs mt-4">
          Secure payment via PayPal
        </p>
      </div>
    </div>
  );
}
