import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGil(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US').format(amount) + ' Gil';
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

export function sourceBadgeClass(source: string | null | undefined): string {
  switch (source) {
    case 'NPC':
      return 'bg-violet-500/10 border-violet-500/20 text-violet-300';
    case 'Craft':
      return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
    default:
      return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300';
  }
}
