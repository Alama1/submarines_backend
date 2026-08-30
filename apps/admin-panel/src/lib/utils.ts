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
      return 'bg-violet-50 border-violet-200 text-violet-700';
    case 'Craft':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    default:
      return 'bg-cyan-50 border-cyan-200 text-cyan-700';
  }
}
