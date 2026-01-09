'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/lib/useAuth';

function PaymentReturnContent() {
  const { isAuthenticated, isLoading, discordId, server } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentStatus, setPaymentStatus] = useState('loading');
  const [message, setMessage] = useState('Processing payment...');
  
  const setStatus = setPaymentStatus;

  useEffect(() => {
    const processPayment = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('No payment token found. Payment cancelled.');
          return;
        }

        const response = await fetch('/api/payment/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, discordId, server })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Payment successful! Your purchase has been activated.');
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.message || 'Payment failed. Please try again.');
        }
      } catch (error) {
        console.error('Payment processing error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your payment.');
      }
    };

    if (!isLoading && isAuthenticated && discordId) {
      processPayment();
    } else if (!isLoading && !isAuthenticated) {
      setStatus('error');
      setMessage('Please sign in to complete your purchase.');
    }
  }, [isLoading, isAuthenticated, discordId, server, searchParams, router]);

  if (isLoading || paymentStatus === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="spinner"></div>
          <div className="text-base md:text-lg text-amber-400 font-medium">Processing Payment...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="glass rounded-3xl p-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-amber-400 mb-4">Sign in Required</h1>
            <p className="text-gray-300 mb-6">Please sign in to complete your payment</p>
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

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="glass rounded-3xl p-8 shadow-2xl text-center">
          <div className="mb-6">
            {paymentStatus === 'success' ? (
              <div className="text-6xl mb-4">✅</div>
            ) : (
              <div className="text-6xl mb-4">❌</div>
            )}
          </div>

          <h1 className={`text-2xl font-bold mb-3 ${
            paymentStatus === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {paymentStatus === 'success' ? 'Payment Successful!' : 'Payment Failed'}
          </h1>

          <p className="text-gray-300 mb-6 text-sm">
            {message}
          </p>

          {paymentStatus === 'success' ? (
            <p className="text-gray-400 text-xs mb-6">
              Redirecting to home page in 3 seconds...
            </p>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => router.back()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-5 rounded-xl transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-xl transition-all"
              >
                Return Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="spinner"></div>
        <div className="text-base md:text-lg text-amber-400 font-medium">Loading...</div>
      </div>
    </div>
  );
}

export default function PaymentReturn() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentReturnContent />
    </Suspense>
  );
}
