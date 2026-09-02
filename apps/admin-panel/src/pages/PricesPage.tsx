import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil } from '../lib/utils';
import { RefreshCw, Edit2, Save, X, Search } from 'lucide-react';
import { PartSetsPanel } from '../components/PartSetsPanel';

export const PricesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [myPriceVal, setMyPriceVal] = useState<number | ''>('');

  const { data, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['prices', search],
    queryFn: async () => {
      const url = search ? `/prices?search=${encodeURIComponent(search)}&limit=100` : `/prices?limit=100`;
      return (await api.get(url)).data;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post('/prices/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) =>
      api.put(`/prices/${id}/my-price`, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      setEditingId(null);
    },
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setMyPriceVal(item.myPrice ?? '');
  };

  const saveEdit = (id: string) => {
    updatePriceMutation.mutate({
      id,
      price: myPriceVal === '' ? null : Number(myPriceVal),
    });
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PartSetsPanel />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Market Pricing & Valuation</h2>
          <p className="text-xs text-slate-500">
            Universalis live market sync with custom manual price overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 w-52"
            />
          </div>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Sync Universalis</span>
          </button>
        </div>
      </div>

      {/* Prices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3">Universalis Market Price</th>
                <th className="px-5 py-3">Manual Override (MyPrice)</th>
                <th className="px-5 py-3">NPC Vendor Price</th>
                <th className="px-5 py-3">Effective Valuation</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading pricing matrix...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No priced materials found.
                  </td>
                </tr>
              ) : (
                items.map((mat) => {
                  const isEditing = editingId === mat.id;

                  return (
                    <tr key={mat.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {mat.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {formatGil(mat.marketPrice)}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            placeholder="Clear to reset"
                            value={myPriceVal}
                            onChange={(e) =>
                              setMyPriceVal(e.target.value === '' ? '' : parseInt(e.target.value))
                            }
                            className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900"
                          />
                        ) : mat.myPrice != null ? (
                          <span className="text-amber-600 font-semibold">
                            {formatGil(mat.myPrice)} (Override)
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        {formatGil(mat.npcPrice)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">
                        {formatGil(mat.effectivePrice)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(mat.id)}
                              className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Save"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-500"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(mat)}
                            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
                            title="Edit Custom Price"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
