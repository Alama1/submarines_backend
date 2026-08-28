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
