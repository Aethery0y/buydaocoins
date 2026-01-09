'use client';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  color?: 'amber' | 'purple' | 'green' | 'blue';
}

export default function StatsCard({ label, value, icon, color = 'amber' }: StatsCardProps) {
  const colorClasses = {
    amber: 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/20',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/20',
    green: 'from-emerald-500/20 to-green-500/20 text-emerald-400 border-emerald-500/20',
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/20',
  };

  const iconBgClasses = {
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className={`card p-4 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBgClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-xs font-medium truncate">{label}</p>
          <p className="text-white font-bold text-lg truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
