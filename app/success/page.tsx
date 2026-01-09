'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';

function SuccessContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [daoCoins, setDaoCoins] = useState(0);
  const [txId, setTxId] = useState('');

  useEffect(() => {
    const coins = searchParams.get('coins');
    const transaction = searchParams.get('txId');
    
    if (coins) setDaoCoins(parseInt(coins));
    if (transaction) setTxId(transaction);
  }, [searchParams]);

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
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="glass rounded-3xl p-4 sm:p-5 shadow-2xl text-center animate-scale-in">
          <div className="space-y-4">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">✅</div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
              Payment Complete!
            </h1>
            
            <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-5">
              Your DAO Coins have been added
            </p>

            <div className="relative overflow-hidden glass rounded-2xl p-4 sm:p-5 mb-4 border-amber-400/30">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 animate-shimmer"></div>
              <div className="relative">
                <div className="flex justify-center mb-3">
                  <Image src="/dao-coin.png" alt="DAO Coin" width={80} height={80} className="w-20 h-20 sm:w-24 sm:h-24" />
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent mb-1">
                  +{daoCoins}
                </div>
                <p className="text-sm sm:text-base text-gray-400">DAO Coins</p>
              </div>
            </div>

            {txId && (
              <div className="glass rounded-2xl p-3 mb-4 animate-fade-in">
                <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Transaction ID</p>
                <p className="text-xs text-gray-500 font-mono break-all bg-black/30 p-2 rounded-lg">{txId}</p>
              </div>
            )}

            <div className="glass rounded-2xl p-3 sm:p-4 mb-4 text-left">
              <h3 className="font-bold mb-3 text-amber-400 text-center flex items-center justify-center gap-2 text-sm">
                <span>🎯</span> Next Steps
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 glass-hover rounded-xl transition-all">
                  <span className="text-green-400 text-base shrink-0">✓</span>
                  <div>
                    <p className="text-white font-semibold text-xs sm:text-sm">Ready to Use</p>
                    <p className="text-gray-400 text-xs">Available now in-game</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 glass-hover rounded-xl transition-all">
                  <span className="text-amber-400 text-base shrink-0">💼</span>
                  <div>
                    <p className="text-white font-semibold text-xs sm:text-sm">Browse Shop</p>
                    <p className="text-gray-400 text-xs">Use <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-400">/daoshop</code></p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 glass-hover rounded-xl transition-all">
                  <span className="text-blue-400 text-base shrink-0">🛒</span>
                  <div>
                    <p className="text-white font-semibold text-xs sm:text-sm">Purchase Items</p>
                    <p className="text-gray-400 text-xs">Use <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-400">/daobuy</code></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
              <Link
                href="/"
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-bold py-2.5 sm:py-3 px-5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-amber-500/50 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <span>👤</span> Profile
              </Link>
              <Link
                href="/payment"
                className="flex-1 glass glass-hover text-white font-semibold py-2.5 sm:py-3 px-5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm"
              >
                <Image src="/dao-coin.png" alt="DAO Coin" width={20} height={20} className="w-5 h-5" /> Buy More
              </Link>
            </div>

            <div className="glass rounded-2xl p-3">
              <p className="text-sm text-gray-300 mb-1">
                Thank you for supporting DAOverse!
              </p>
              <p className="text-xs text-gray-500">
                Your purchase helps us grow
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Success() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="spinner"></div>
          <div className="text-base md:text-lg text-amber-400 font-medium">Loading...</div>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
