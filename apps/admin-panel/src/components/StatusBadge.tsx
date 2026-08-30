import React from 'react';
import { cn } from '../lib/utils';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStyle = () => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'in_progress':
      case 'processing':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 animate-pulse';
      case 'fulfilled':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
        getStyle()
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
};
