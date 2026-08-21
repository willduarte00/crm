import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { MetricComparison } from '../../types/dashboard';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  comparison?: MetricComparison | null;
  subtitle?: string;
  isDelinquency?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon: Icon,
  iconBgColor = 'bg-teal-50',
  iconColor = 'text-teal-600',
  comparison,
  subtitle,
  isDelinquency = false,
}) => {
  // RF-48: Comparativo só aparece quando comparison !== null
  const renderComparison = () => {
    if (!comparison) {
      if (subtitle) {
        return <p className="text-xs text-slate-500 mt-2">{subtitle}</p>;
      }
      return null;
    }

    const { percentage } = comparison;
    const isZero = percentage === 0;
    const isPositive = percentage > 0;

    // Para inadimplência, subir é ruim (vermelho) e cair é bom (verde)
    let badgeClass = 'text-slate-500';
    if (!isZero) {
      if (isDelinquency) {
        badgeClass = isPositive ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold';
      } else {
        badgeClass = isPositive ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold';
      }
    }

    return (
      <div className={`flex items-center gap-1 text-xs mt-2 ${badgeClass}`}>
        {isZero ? (
          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
        ) : isPositive ? (
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>
          {isPositive ? `+${percentage}%` : `${percentage}%`} vs mês anterior
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          {title}
        </h3>
        <div
          className={`w-9 h-9 rounded-lg ${iconBgColor} ${iconColor} flex items-center justify-center flex-shrink-0`}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-navy-900 tracking-tight tabular-nums">
          {value}
        </p>
        {renderComparison()}
      </div>
    </div>
  );
};
