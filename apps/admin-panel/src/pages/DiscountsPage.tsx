import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Trash2, Percent, AlertCircle } from 'lucide-react';
import { BulkDiscount, CrafterBulkDiscount } from '@ff14/types';

interface TierSectionProps {
  title: string;
  description: string;
  queryKey: string[];
  basePath: string;
  unitNoun: string;
  rateLabel: string;
  defaultThreshold: number;
  defaultPercent: number;
  percentClass: string;
  buttonClass: string;
}

const TierSection: React.FC<TierSectionProps> = ({
  title,
  description,
  queryKey,
  basePath,
  unitNoun,
  rateLabel,
  defaultThreshold,
  defaultPercent,
  percentClass,
  buttonClass,
}) => {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState<number>(defaultThreshold);
  const [discountPercent, setDiscountPercent] = useState<number>(defaultPercent);
  const [error, setError] = useState<string | null>(null);

  const { data: discounts, isLoading } = useQuery<(BulkDiscount | CrafterBulkDiscount)[]>({
    queryKey,
    queryFn: async () => (await api.get(basePath)).data,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post(basePath, { threshold, discountPercent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create discount tier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${basePath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const discountList = Array.isArray(discounts) ? discounts : [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Tier Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-600" />
            <span>Add Discount Tier</span>
          </h4>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">
                {unitNoun === 'parts' ? 'Parts Quantity Threshold (units)' : 'Items Quantity Threshold (units)'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                placeholder="e.g. 5000"
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
              className={`w-full py-2.5 rounded-lg text-white font-semibold transition shadow-sm disabled:opacity-50 ${buttonClass}`}
            >
              {createMutation.isPending ? 'Adding...' : 'Add Tier'}
            </button>
          </form>
        </div>

        {/* Existing Tiers List — desktop table */}
        <div className="hidden md:block md:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{unitNoun === 'parts' ? 'Parts Quantity Threshold' : 'Items Quantity Threshold'}</th>
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
                      ≥ {tier.threshold} {unitNoun}
                    </td>
                    <td className={`px-5 py-3.5 font-mono font-bold text-sm ${percentClass}`}>
                      {tier.discountPercent}% {rateLabel}
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

        {/* Existing Tiers — mobile cards */}
        <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              Loading discount tiers...
            </div>
          ) : discountList.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              No discount tiers defined.
            </div>
          ) : (
            discountList.map((tier) => (
              <div key={tier.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    ≥ {tier.threshold} {unitNoun}
                  </div>
                  <div className={`font-mono font-bold text-sm mt-0.5 ${percentClass}`}>
                    {tier.discountPercent}% {rateLabel}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(tier.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-medium transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const DiscountsPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Bulk Management</h2>
        <p className="text-xs text-slate-500">
          Tiered percentages applied automatically — discounts on customer submarine part orders and
          bonus payouts for crafters delivering materials in bulk.
        </p>
      </div>

      <TierSection
        title="Customer Order Discounts"
        description="Tiered discount percentages automatically applied when customer orders reach submarine part quantity milestones."
        queryKey={['discounts']}
        basePath="/discounts"
        unitNoun="parts"
        rateLabel="OFF"
        defaultThreshold={20}
        defaultPercent={5}
        percentClass="text-emerald-600"
        buttonClass="bg-emerald-600 hover:bg-emerald-700"
      />

      <TierSection
        title="Crafter Bulk Bonuses"
        description="Tiered bonus percentages added to crafter payouts when a calculator offer reaches material quantity milestones."
        queryKey={['crafter-discounts']}
        basePath="/crafter-discounts"
        unitNoun="items"
        rateLabel="BONUS"
        defaultThreshold={5000}
        defaultPercent={5}
        percentClass="text-sky-600"
        buttonClass="bg-sky-600 hover:bg-sky-700"
      />
    </div>
  );
};
