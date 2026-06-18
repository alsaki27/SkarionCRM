import React from 'react';
import { clsx } from 'clsx';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  color?: 'primary' | 'green' | 'blue' | 'orange' | 'purple' | 'red';
  onClick?: () => void;
}

const colorMap: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  orange: 'bg-orange-50 text-orange-700',
  purple: 'bg-purple-50 text-purple-700',
  red: 'bg-red-50 text-red-700',
};

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  color = 'primary',
  onClick,
}: StatCardProps): React.ReactElement {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card transition-all duration-200',
        isClickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="card-body flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1">
              {changeType === 'positive' && (
                <>
                  <ArrowUpRight size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">{change}</span>
                </>
              )}
              {changeType === 'negative' && (
                <>
                  <ArrowDownRight size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-600">{change}</span>
                </>
              )}
              {changeType === 'neutral' && (
                <>
                  <Minus size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">{change}</span>
                </>
              )}
              <span className="text-xs text-gray-400 ml-1">vs last period</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg', colorMap[color])}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
