import React, { useMemo, useState } from 'react';
import { Check, Copy, ScrollText } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import type { Order } from '@ff14/types';

/** Copies text even in non-secure contexts (plain-http LAN access). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface TradeConfirmationProps {
  order: Order;
  mannequinItem: string;
  onMannequinItemChange: (value: string) => void;
}

export const TradeConfirmation: React.FC<TradeConfirmationProps> = ({
  order,
  mannequinItem,
  onMannequinItemChange,
}) => {
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => {
    // Identical parts across builds are aggregated — the trade is about total units.
    const totals = new Map<string, number>();
    for (const item of order.items ?? []) {
      totals.set(item.partName, (totals.get(item.partName) ?? 0) + item.quantity);
    }
    const list = Array.from(totals.entries())
      .map(([name, qty]) => `${qty}× ${name}`)
      .join(', ');
    const item = mannequinItem.trim() || 'this item';
    return `Do you agree to transfer me ${formatNumber(order.total)} gil by buying ${item} from the mannequin after I trade you ${list}? (Order ${order.orderCode})`;
  }, [order, mannequinItem]);

  const handleCopy = async () => {
    if (await copyText(message)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5" />
          Trade Confirmation
        </h4>
        <span className="text-[11px] text-slate-400">
          Send this to the client before the trade
        </span>
      </div>
      <input
        type="text"
        value={mannequinItem}
        onChange={(e) => onMannequinItemChange(e.target.value)}
        placeholder="Item the client buys from your mannequin (e.g. Water Shards)"
        maxLength={60}
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
      />
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed break-words">
        {message}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 hover:text-emerald-600 transition flex items-center gap-1.5"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'Copied!' : 'Copy Message'}
        </button>
      </div>
    </div>
  );
};
