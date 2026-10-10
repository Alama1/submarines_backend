import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil } from '../lib/utils';
import {
  Plus,
  Trash2,
  Ticket,
  Pencil,
  Copy,
  Check,
  X,
  AlertCircle,
  Dices,
} from 'lucide-react';
import {
  DiscountCode,
  DiscountCodeStatus,
  DiscountCodeType,
  CreateDiscountCodeDto,
} from '@ff14/types';

const statusBadgeClass: Record<DiscountCodeStatus, string> = {
  active: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  scheduled: 'bg-sky-50 border-sky-200 text-sky-700',
  expired: 'bg-slate-100 border-slate-200 text-slate-500',
  exhausted: 'bg-amber-50 border-amber-200 text-amber-700',
};

const statusLabel: Record<DiscountCodeStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  exhausted: 'Used up',
};

function codeStatus(dc: DiscountCode): DiscountCodeStatus {
  const now = Date.now();
  if (dc.activeFrom && now < new Date(dc.activeFrom).getTime()) return 'scheduled';
  if (dc.activeUntil && now > new Date(dc.activeUntil).getTime()) return 'expired';
  if (dc.usedCount >= dc.maxUses) return 'exhausted';
  return 'active';
}

function formatDiscount(dc: DiscountCode): string {
  return dc.discountType === 'percent'
    ? `${Number(dc.discountValue)}% OFF`
    : `${formatGil(Number(dc.discountValue))} OFF`;
}

function formatWindow(dc: DiscountCode): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  const from = fmt(dc.activeFrom);
  const until = fmt(dc.activeUntil);
  if (!from && !until) return 'Always active';
  if (from && until) return `${from} → ${until}`;
  if (from) return `From ${from}`;
  return `Until ${until}`;
}

function randomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const group = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => chars[b % chars.length])
      .join('');
  return `PROMO-${group()}-${group()}`;
}

const datetimeLocalValue = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface PromoDraft {
  code: string;
  discountType: DiscountCodeType;
  discountValue: number;
  maxUses: number;
  activeFrom: string;
  activeUntil: string;
}

const emptyDraft: PromoDraft = {
  code: '',
  discountType: 'percent',
  discountValue: 10,
  maxUses: 1,
  activeFrom: '',
  activeUntil: '',
};

const draftFromCode = (dc: DiscountCode): PromoDraft => ({
  code: dc.code,
  discountType: dc.discountType,
  discountValue: Number(dc.discountValue),
  maxUses: dc.maxUses,
  activeFrom: datetimeLocalValue(dc.activeFrom),
  activeUntil: datetimeLocalValue(dc.activeUntil),
});

const draftToPayload = (d: PromoDraft): CreateDiscountCodeDto => ({
  code: d.code.trim() ? d.code.trim().toUpperCase() : undefined,
  discountType: d.discountType,
  discountValue: d.discountValue,
  maxUses: Math.max(1, Math.min(999, Math.round(d.maxUses) || 1)),
  activeFrom: d.activeFrom ? new Date(d.activeFrom).toISOString() : null,
  activeUntil: d.activeUntil ? new Date(d.activeUntil).toISOString() : null,
});

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500';

interface PromoCodeFormProps {
  initial: PromoDraft;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (draft: PromoDraft) => void;
  onCancel?: () => void;
}

const PromoCodeForm: React.FC<PromoCodeFormProps> = ({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}) => {
  const [draft, setDraft] = useState<PromoDraft>(initial);
  const isPercent = draft.discountType === 'percent';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      className="space-y-3 text-xs"
    >
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-slate-600 mb-1">Code</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
            placeholder="Empty = auto-generate"
            maxLength={40}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setDraft({ ...draft, code: randomCode() })}
            className="px-2.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition flex-shrink-0"
            title="Generate a random code"
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 mb-1">Discount Type</label>
          <select
            value={draft.discountType}
            onChange={(e) =>
              setDraft({ ...draft, discountType: e.target.value as DiscountCodeType })
            }
            className={inputClass}
          >
            <option value="percent">Percentage (%)</option>
            <option value="flat">Flat gil amount</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-600 mb-1">
            {isPercent ? 'Discount (%)' : 'Discount (gil)'}
          </label>
          <input
            type="number"
            min={1}
            max={isPercent ? 100 : undefined}
            step={isPercent ? '0.5' : '1'}
            value={draft.discountValue}
            onChange={(e) =>
              setDraft({ ...draft, discountValue: parseFloat(e.target.value) || 0 })
            }
            placeholder={isPercent ? 'e.g. 10' : 'e.g. 100000'}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-slate-600 mb-1">Max uses (1–999)</label>
        <input
          type="number"
          min={1}
          max={999}
          step={1}
          value={draft.maxUses}
          onChange={(e) => setDraft({ ...draft, maxUses: parseInt(e.target.value, 10) || 0 })}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 mb-1">Active from (optional)</label>
          <input
            type="datetime-local"
            value={draft.activeFrom}
            onChange={(e) => setDraft({ ...draft, activeFrom: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Active until (optional)</label>
          <input
            type="datetime-local"
            value={draft.activeUntil}
            onChange={(e) => setDraft({ ...draft, activeUntil: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Leave both dates empty for immediate, unlimited-window activation. A code is only usable
        inside its window and while uses remain.
      </p>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export const PromoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: codes, isLoading } = useQuery<DiscountCode[]>({
    queryKey: ['promo-codes'],
    queryFn: async () => (await api.get('/promo-codes')).data,
  });

  const createMutation = useMutation({
    mutationFn: (draft: PromoDraft) => api.post('/promo-codes', draftToPayload(draft)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      setError(null);
    },
    onError: (err: any) =>
      setError(err.response?.data?.message || 'Failed to create the promo code'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PromoDraft }) =>
      api.put(`/promo-codes/${id}`, draftToPayload(draft)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      setEditing(null);
    },
    onError: (err: any) =>
      setError(err.response?.data?.message || 'Failed to update the promo code'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/promo-codes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promo-codes'] }),
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const list = Array.isArray(codes) ? codes : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Promo Codes</h2>
        <p className="text-xs text-slate-500">
          Discount codes customers can enter at checkout. Flat gil or percentage, limited uses and
          optional activation window. A code never stacks with bulk order discounts — the better
          discount is applied automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 self-start">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-600" />
            <span>Create Promo Code</span>
          </h3>
          <PromoCodeForm
            key="create"
            initial={emptyDraft}
            submitLabel="Create Code"
            submitting={createMutation.isPending}
            error={error}
            onSubmit={(draft) => createMutation.mutate(draft)}
          />
        </div>

        {/* Codes list — desktop table */}
        <div className="hidden md:block md:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Uses</th>
                <th className="px-5 py-3">Activation Window</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading promo codes...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No promo codes created yet.
                  </td>
                </tr>
              ) : (
                list.map((dc) => {
                  const status = codeStatus(dc);
                  return (
                    <tr key={dc.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {dc.code}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">
                        {formatDiscount(dc)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {dc.usedCount} / {dc.maxUses}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatWindow(dc)}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[status]}`}
                        >
                          {statusLabel[status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleCopy(dc.code)}
                          className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:bg-slate-50 transition inline-flex"
                          title="Copy code"
                        >
                          {copiedCode === dc.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setError(null);
                            setEditing(dc);
                          }}
                          className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition inline-flex"
                          title="Edit code"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(dc.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition inline-flex"
                          title="Delete code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Codes list — mobile cards */}
        <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">Loading promo codes...</div>
          ) : list.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              No promo codes created yet.
            </div>
          ) : (
            list.map((dc) => {
              const status = codeStatus(dc);
              return (
                <div key={dc.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm break-all">
                      {dc.code}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium flex-shrink-0 ${statusBadgeClass[status]}`}
                    >
                      {statusLabel[status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-emerald-600">
                      {formatDiscount(dc)}
                    </span>
                    <span className="font-mono text-slate-600">
                      {dc.usedCount} / {dc.maxUses} uses
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{formatWindow(dc)}</div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(dc.code)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 text-xs font-medium transition"
                    >
                      {copiedCode === dc.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        setEditing(dc);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 text-xs font-medium transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(dc.id)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setEditing(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Edit Promo Code</h3>
            </div>
            <p className="text-[11px] text-slate-400 -mt-2">
              {editing.usedCount} use{editing.usedCount !== 1 ? 's' : ''} recorded so far.
            </p>
            <PromoCodeForm
              key={editing.id}
              initial={draftFromCode(editing)}
              submitLabel="Save Changes"
              submitting={updateMutation.isPending}
              error={error}
              onSubmit={(draft) => updateMutation.mutate({ id: editing.id, draft })}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
