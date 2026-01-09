'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import Lottie from 'lottie-react';
import Image from 'next/image';
import loadingAnimation from '@/public/animations/loading.json';
import successAnimation from '@/public/animations/success.json';
import failedAnimation from '@/public/animations/failed.json';
import { useAuth } from '@/lib/useAuth';

type PaymentState = 'idle' | 'processing' | 'success' | 'error';

const PRESETS = [1, 5, 10, 20, 50];

export default function PaymentPage() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState(5);
  const [error, setError] = useState('');
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [successData, setSuccessData] = useState({ coins: 0, txId: '' });
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const bonusCoins = couponData ? Math.floor(amount * (couponData.bonusPercentage / 100)) : 0;
  const totalCoins = amount + bonusCoins;

  useEffect(() => {
    if (!couponCode.trim()) {
      setCouponData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValidatingCoupon(true);
      try {
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponCode.trim(), amount }),
        });
        const data = await res.json();
        setCouponData(data.valid ? data : null);
      } catch {
        setCouponData(null);
      } finally {
        setValidatingCoupon(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [couponCode, amount]);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center"><div className="spinner"></div></div>;
  }

  if (!isAuthenticated) {
    router.push('/');
    return null;
  }

  const createOrder = async () => {
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, couponCode: couponData?.code || null, packages: [], discordId, server }),
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
      setSuccessData({ coins: result.daoCoins, txId: result.transactionId });
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
          <div className="w-40 h-40 mx-auto mb-4">
            <Lottie animationData={loadingAnimation} loop />
          </div>
          <h2 className="text-xl font-bold text-blue-400">Processing Payment</h2>
          <p className="text-gray-400 text-sm mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  if (paymentState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-48 h-48 mx-auto">
            <Lottie animationData={successAnimation} loop={false} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-bold text-amber-400">+{successData.coins}</span>
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
          <div className="w-40 h-40 mx-auto mb-4">
            <Lottie animationData={failedAnimation} loop={false} />
          </div>
          <h2 className="text-xl font-bold text-red-400">Payment Failed</h2>
          <p className="text-gray-400 text-sm mt-2 mb-4">{error || 'Something went wrong'}</p>
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
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/shop')} className="text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-amber-400">Buy DAO Coins</h1>
          <div className="w-12"></div>
        </div>

        <div className="glass rounded-xl p-5 mb-4 text-center">
          <Image src="/dao-coin.png" alt="DC" width={48} height={48} className="mx-auto mb-3" />
          <div className="text-3xl font-bold text-amber-400 mb-1">${amount} = {totalCoins} DC</div>
          {bonusCoins > 0 && <div className="text-green-400 text-sm">+{bonusCoins} bonus coins!</div>}
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-3 font-medium">Quick Select</div>
          <div className="grid grid-cols-5 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`py-2 rounded-lg font-bold text-sm transition-all ${
                  amount === p 
                    ? 'bg-amber-500 text-slate-900' 
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-2 font-medium">Custom Amount</div>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-white/5 text-white p-3 rounded-lg border border-white/10 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-400 mb-2 font-medium">Coupon Code (Optional)</div>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="w-full bg-white/5 text-white p-3 rounded-lg border border-white/10 focus:border-amber-400 focus:outline-none uppercase"
          />
          {couponData && <div className="text-green-400 text-xs mt-2">✓ {couponData.bonusPercentage}% bonus applied!</div>}
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
            disabled={amount < 1}
          />
        </div>

        <div className="text-center text-gray-500 text-xs space-y-1">
          <p>✓ Instant delivery • ✓ Secure payment</p>
          <p>All purchases are final</p>
        </div>
      </div>
    </div>
  );
}
