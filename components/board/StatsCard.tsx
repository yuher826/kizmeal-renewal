'use client';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  trend?: string;
}

export default function StatsCard({ icon, label, value, sub, highlight, trend }: StatsCardProps) {
  return (
    <div className={`rounded-2xl p-5 border transition-shadow hover:shadow-md ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {highlight && (
          <span className="text-red-500 text-xs font-semibold bg-red-100 px-2 py-0.5 rounded-full">주의</span>
        )}
        {trend && !highlight && (
          <span className="text-[#2D6A4F] text-xs font-medium bg-[#E8F5E9] px-2 py-0.5 rounded-full">{trend}</span>
        )}
      </div>
      <div className={`font-bold text-4xl mb-1 leading-none ${highlight ? 'text-red-600' : 'text-[#1C2B1E]'}`}>
        {value}
      </div>
      <div className="text-gray-500 text-sm mt-2">{label}</div>
      {sub && <div className="text-gray-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
