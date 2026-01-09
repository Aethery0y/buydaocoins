'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { PayPalButtons } from '@paypal/react-paypal-js';
import Lottie from 'lottie-react';
import loadingAnimation from '@/public/animations/loading.json';
import successAnimation from '@/public/animations/success.json';
import failedAnimation from '@/public/animations/failed.json';
import { useAuth } from '@/lib/useAuth';

type PaymentState = 'idle' | 'processing' | 'success' | 'error';

const PACKAGES = [
  { id: 'pkg1', name: 'Starter', coins: 50, price: 40, regular: 50, discount: 20 },
  { id: 'pkg2', name: 'Popular', coins: 100, price: 80, regular: 100, discount: 20, badge: 'POPULAR' },
  { id: 'pkg3', name: 'Great Value', coins: 150, price: 125, regular: 150, discount: 17, badge: 'BEST VALUE' },
  { id: 'pkg4', name: 'Ultimate', coins: 200, price: 150, regular: 200, discount: 25 },
];

export default function OffersPage() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<{ [id: string]: number }>({});
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [error, setError] = useState('');
  const [successCoins, setSuccessCoins] = useState(0);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center"><div className="spinner"></div></div>;
  }

  if (!isAuthenticated) {
    router.push('/');
    return null;
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev[id]) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: 1 };
    });
  };

  const adjust = (id: string, delta: number) => {
    setSelected(prev => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const items = Object.entries(selected).map(([id, qty]) => {
    const pkg = PACKAGES.find(p => p.id === id)!;
    return { ...pkg, qty };
  });

  const totalPrice = items.reduce((s, p) => s + p.price * p.qty, 0);
  const totalCoins = items.reduce((s, p) => s + p.coins * p.qty, 0);
  const totalSavings = items.reduce((s, p) => s + (p.regular - p.price) * p.qty, 0);

  const createOrder = async () => {
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: totalPrice, couponCode: null, packages: items, discordId, server }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.orderId;
  };

  const onApprove = async (data: any) => {
    setPaymentState('processing');
    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderID, discordId, server }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSuccessCoins(result.daoCoins);
      setPaymentState('success');
      setTimeout(() => router.push(`/success?coins=${result.daoCoins}&txId=${result.transactionId}`), 2500);
    } catch (err: any) {
      setError(err.message);
      setPaymentState('error');
    }
  };

  if (paymentState === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-40 h-40 mx-auto mb-4"><Lottie animationData={loadingAnimation} loop /></div>
          <h2 className="text-xl font-bold text-blue-400">Processing Payment</h2>
        </div>
      </div>
    );
  }

  if (paymentState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-48 h-48 mx-auto"><Lottie animationData={successAnimation} loop={false} /></div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-bold text-amber-400">+{successCoins}</span>
            <Image src="/dao-coin.png" alt="DC" width={28} height={28} />
          </div>
          <p className="text-gray-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (paymentState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-40 h-40 mx-auto mb-4"><Lottie animationData={failedAnimation} loop={false} /></div>
          <h2 className="text-xl font-bold text-red-400">Payment Failed</h2>
          <p className="text-gray-400 text-sm mt-2 mb-4">{error}</p>
          <button
            onClick={() => { setPaymentState('idle'); setError(''); }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-6 rounded-xl"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/shop')} className="text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-amber-400">Special Offers</h1>
          <div className="w-12"></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {PACKAGES.map(pkg => {
            const qty = selected[pkg.id] || 0;
            const isSelected = qty > 0;
            
            return (
              <div
                key={pkg.id}
                onClick={() => toggle(pkg.id)}
                className={`relative glass rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-amber-400' : 'hover:bg-white/5'
                }`}
              >
                {pkg.badge && (
                  <div className={`absolute -top-2 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pkg.badge === 'POPULAR' ? 'bg-purple-500' : 'bg-green-500'
                  }`}>
                    {pkg.badge}
                  </div>
                )}
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-1">
                    {pkg.coins} <Image src="/dao-coin.png" alt="DC" width={20} height={20} />
                  </div>
                  <div className="text-lg font-bold text-white">${pkg.price}</div>
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className="text-gray-500 line-through">${pkg.regular}</span>
                    <span className="text-red-400 font-bold">-{pkg.discount}%</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => adjust(pkg.id, -1)} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg font-bold">-</button>
                    <span className="text-white font-bold w-6 text-center">{qty}</span>
                    <button onClick={() => adjust(pkg.id, 1)} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg font-bold">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <>
            <div className="glass rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Packages</span>
                <span className="text-white">{items.map(i => `${i.name} ×${i.qty}`).join(', ')}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">You Save</span>
                  <span className="text-green-400 font-bold">${totalSavings}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <div>
                  <div className="text-white font-bold text-lg">${totalPrice}</div>
                  <div className="text-gray-500 text-xs">Total</div>
                </div>
                <div className="flex items-center gap-1 text-2xl font-bold text-amber-400">
                  {totalCoins} <Image src="/dao-coin.png" alt="DC" width={24} height={24} />
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden mb-4">
              <PayPalButtons
                createOrder={createOrder}
                onApprove={onApprove}
                onError={(err) => {
                  console.error(err);
                  setError('Payment failed');
                  setPaymentState('error');
                }}
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
              />
            </div>
          </>
        )}

        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Tap a package to select it
          </div>
        )}

        <p className="text-center text-gray-500 text-xs">
          ✓ Instant delivery • ✓ Secure payment
        </p>
      </div>
    </div>
  );
}
