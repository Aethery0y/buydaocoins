'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

function SubscriptionReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { discordId, server } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your subscription...');
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);

  useEffect(() => {
    const processPayment = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('No payment token found. Payment cancelled.');
          return;
        }

        const response = await fetch('/api/subscriptions/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, discordId, server: server || 'S0' })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Your subscription has been activated!');
          setSubscriptionDetails(data.subscription);
        } else {
          setStatus('error');
          setMessage(data.error || 'Payment failed. Please try again.');
        }
      } catch (error) {
        console.error('Payment processing error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your payment.');
      }
    };

    if (discordId) {
      processPayment();
    }
  }, [searchParams, discordId, server]);

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="glass rounded-3xl p-8 shadow-2xl text-center">
          {status === 'processing' && (
            <>
              <div className="spinner mx-auto mb-6"></div>
              <h1 className="text-2xl font-bold text-amber-400 mb-4">Processing Payment</h1>
              <p className="text-gray-300">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-6xl mb-6">✅</div>
              <h1 className="text-2xl font-bold text-green-400 mb-4">Subscription Activated!</h1>
              <p className="text-gray-300 mb-6">{message}</p>
              
              {subscriptionDetails && (
                <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                  <p className="text-amber-400 font-semibold">{subscriptionDetails.tierName}</p>
                  <p className="text-gray-300">+{subscriptionDetails.qiBoostPercent}% Qi Boost</p>
                  <p className="text-gray-400 text-sm">
                    Expires: {new Date(subscriptionDetails.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              <Link
                href="/shop/subscriptions"
                className="inline-block bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                Return to Subscriptions
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-6xl mb-6">❌</div>
              <h1 className="text-2xl font-bold text-red-400 mb-4">Payment Failed</h1>
              <p className="text-gray-300 mb-6">{message}</p>
              <Link
                href="/shop/subscriptions"
                className="inline-block bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                Try Again
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionReturnPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    }>
      <SubscriptionReturnContent />
    </Suspense>
  );
}
