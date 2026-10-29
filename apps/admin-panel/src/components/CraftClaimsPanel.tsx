import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber, formatGil } from '../lib/utils';
import {
  Hammer,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { CRAFT_CLAIM_STATUSES, CraftClaim, CraftClaimStatus } from '@ff14/types';
import { StatusBadge } from './StatusBadge';

const STATUS_FILTERS: Array<{ value: CraftClaimStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusSelectClass: Record<CraftClaimStatus, string> = {
  pending: 'text-amber-700',
  confirmed: 'text-blue-700',
  completed: 'text-emerald-700',
  cancelled: 'text-slate-500',
};

/** Crafter claim requests (code-based) — confirm, re-status or cancel them here. */
export const CraftClaimsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<CraftClaimStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: CraftClaim[]; total: number }>({
    queryKey: ['craft-claims', statusFilter],
    queryFn: async () =>
      (
        await api.get(
          statusFilter === 'all'
            ? '/inventory/claims/admin'
            : `/inventory/claims/admin?status=${statusFilter}`
        )
      ).data,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['craft-claims'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const onError = (err: any) => {
    alert(err.response?.data?.message || 'Failed to update the claim.');
  };

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/inventory/claims/admin/${id}/confirm`),
    onSuccess: invalidate,
    onError,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CraftClaimStatus }) =>
      api.patch(`/inventory/claims/admin/${id}/status`, { status }),
    onSuccess: invalidate,
    onError,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/claims/admin/${id}`),
    onSuccess: invalidate,
    onError,
  });

  const claims = data?.items ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 flex-shrink-0">
            <Hammer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm">Craft Claims</h3>
            <p className="text-xs text-slate-500">
              Claim requests from crafters — a claim only takes effect once you confirm it.
            </p>
          </div>
        </div>
        {claims.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold flex-shrink-0">
            {claims.length} claim{claims.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              statusFilter === value
                ? 'bg-cyan-600 border-cyan-600 text-white'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-xs text-slate-400">Loading claims...</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          No claims {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Nickname</th>
                <th className="px-3 py-2.5">Items</th>
                <th className="px-3 py-2.5">Payout</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {claims.map((claim) => {
                const expanded = expandedId === claim.id;
                const isActive = claim.status === 'pending' || claim.status === 'confirmed';
                return (
                  <React.Fragment key={claim.id}>
                    <tr className={`hover:bg-slate-50 transition ${expanded ? 'bg-slate-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setExpandedId(expanded ? null : claim.id)}
                          className="flex items-center gap-1 font-mono font-bold text-cyan-700 hover:text-cyan-900"
                          title="Show items"
                        >
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {claim.claimCode}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{claim.nickname}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-slate-600">
                          {claim.items.length} mat{claim.items.length === 1 ? '' : 's'} ·{' '}
                          {formatNumber(claim.items.reduce((s, i) => s + i.quantity, 0))} units
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-700">
                        {formatGil(claim.total)} G
                        {claim.bonusPct > 0 && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            incl. +{Number(claim.bonusPct)}% bonus
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {claim.status === 'pending' && (
                            <button
                              onClick={() => confirmMutation.mutate(claim.id)}
                              disabled={confirmMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition disabled:opacity-50"
                              title="Approve this claim"
                            >
                              <Check className="w-3 h-3" /> Confirm
                            </button>
                          )}
                          {claim.status === 'confirmed' && (
                            <button
                              onClick={() =>
                                statusMutation.mutate({ id: claim.id, status: 'completed' })
                              }
                              disabled={statusMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold transition disabled:opacity-50"
                              title="Mark as delivered / completed"
                            >
                              <CheckCircle className="w-3 h-3" /> Complete
                            </button>
                          )}
                          <select
                            value={claim.status}
                            onChange={(e) =>
                              statusMutation.mutate({
                                id: claim.id,
                                status: e.target.value as CraftClaimStatus,
                              })
                            }
                            className={`px-1.5 py-1 bg-white border border-slate-300 rounded text-[10px] font-semibold focus:outline-none focus:border-emerald-500 ${statusSelectClass[claim.status]}`}
                            title="Set status (full control)"
                          >
                            {CRAFT_CLAIM_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {isActive && (
                            <button
                              onClick={() => cancelMutation.mutate(claim.id)}
                              disabled={cancelMutation.isPending}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                              title="Cancel claim"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="flex items-start gap-2 mb-2">
                            <Users className="w-3.5 h-3.5 text-cyan-600 mt-0.5" />
                            <div className="text-[11px] text-slate-500">
                              Claim <span className="font-mono font-bold text-slate-700">{claim.claimCode}</span>{' '}
                              by <span className="font-semibold text-slate-700">{claim.nickname}</span>
                              {claim.confirmedAt && ` · confirmed ${new Date(claim.confirmedAt).toLocaleString()}`}
                              {claim.completedAt && ` · completed ${new Date(claim.completedAt).toLocaleString()}`}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead className="text-slate-400 uppercase tracking-wide">
                                <tr>
                                  <th className="py-1 pr-4">Material</th>
                                  <th className="py-1 pr-4 text-right">Qty</th>
                                  <th className="py-1 pr-4 text-right">Price / Unit</th>
                                  <th className="py-1 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {claim.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-1.5 pr-4 font-medium text-slate-700">
                                      {item.materialName}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-slate-600">
                                      {formatNumber(item.quantity)}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-slate-500">
                                      {formatGil(item.unitPrice)} G
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-slate-700">
                                      {formatGil(item.lineTotal)} G
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="text-slate-600">
                                <tr className="border-t border-slate-200">
                                  <td colSpan={3} className="py-1.5 text-right pr-4">
                                    Subtotal
                                  </td>
                                  <td className="py-1.5 text-right font-mono">{formatGil(claim.subtotal)} G</td>
                                </tr>
                                {claim.bonusPct > 0 && (
                                  <tr>
                                    <td colSpan={3} className="py-1.5 text-right pr-4 text-emerald-600">
                                      Bulk bonus (+{Number(claim.bonusPct)}%)
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-emerald-600">
                                      +{formatGil(claim.bonusAmount)} G
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-t border-slate-200">
                                  <td colSpan={3} className="py-1.5 text-right pr-4 font-bold">
                                    Total payout
                                  </td>
                                  <td className="py-1.5 text-right font-mono font-bold text-emerald-700">
                                    {formatGil(claim.total)} G
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
