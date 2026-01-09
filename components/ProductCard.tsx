'use client';

import Link from 'next/link';

interface ProductCardProps {
  title: string;
  description: string;
  price?: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  featured?: boolean;
}

export default function ProductCard({ title, description, price, href, icon, badge, featured }: ProductCardProps) {
  return (
    <Link href={href} className="block group">
      <div className={`card card-hover card-glow p-5 h-full ${featured ? 'ring-2 ring-amber-500/50' : ''}`}>
        {badge && (
          <div className="absolute -top-2 -right-2 z-10">
            <span className="badge badge-amber text-[10px] px-2 py-1">{badge}</span>
          </div>
        )}
        
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
            featured 
              ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-900' 
              : 'bg-slate-800 text-amber-400'
          }`}>
            {icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors mb-1">
              {title}
            </h3>
            <p className="text-sm text-slate-400 line-clamp-2">{description}</p>
            
            {price && (
              <p className="mt-2 text-amber-400 font-bold">{price}</p>
            )}
          </div>
          
          <svg className="w-5 h-5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
