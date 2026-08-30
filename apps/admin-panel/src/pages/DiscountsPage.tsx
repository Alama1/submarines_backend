import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil } from '../lib/utils';
import { Plus, Trash2, Percent, AlertCircle } from 'lucide-react';
import { BulkDiscount } from '@ff14/types';

export const DiscountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState<number>(20);
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);

  const { data: discounts, isLoading } = useQuery<BulkDiscount[]>({
    queryKey: ['discounts'],
    queryFn: async () => (await api.get('/discounts')).data,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/discounts', { threshold, discountPercent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create discount tier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const discountList = Array.isArray(discounts) ? discounts : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Bulk Discount Thresholds</h2>
        <p className="text-xs text-slate-500">
          Tiered discount percentages automatically applied when customer orders reach submarine part quantity milestones.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Tier Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-600" />
            <span>Add Discount Tier</span>
          </h3>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">Parts Quantity Threshold (units)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                placeholder="e.g. 20"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Discount Percentage (%)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Tier'}
            </button>
          </form>
        </div>

        {/* Existing Tiers List */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Parts Quantity Threshold</th>
                <th className="px-5 py-3">Discount Rate</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                    Loading discount tiers...
                  </td>
                </tr>
              ) : discountList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                    No discount tiers defined.
                  </td>
                </tr>
              ) : (
                discountList.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      ≥ {tier.threshold} parts
                    </td>
                    <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold text-sm">
                      {tier.discountPercent}% OFF
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(tier.id)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                        title="Delete Tier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
