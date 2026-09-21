import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil } from '../lib/utils';
import {
  RefreshCw,
  Edit2,
  Save,
  X,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Hammer,
} from 'lucide-react';
import { PartSetsPanel } from '../components/PartSetsPanel';
import {
  AnomalyThresholds,
  PriceAnomaliesResponse,
  PriceAnomalyItem,
} from '@ff14/types';

interface AnomalyStatus {
  label: string;
  cls: string;
}

const statusOf = (
  item: PriceAnomalyItem,
  thresholds: AnomalyThresholds | undefined,
): AnomalyStatus => {
  if (item.incomplete) {
    return {
      label: 'Incomplete data',
      cls: 'bg-violet-50 border-violet-200 text-violet-700',
    };
  }
  if (item.myPrice == null || item.diffPct == null) {
    return {
      label: 'No custom price',
      cls: 'bg-slate-50 border-slate-200 text-slate-500',
    };
  }
  if (item.isAnomaly) {
    const viaGil =
      thresholds?.thresholdGil != null &&
      item.diff != null &&
      Math.abs(item.diff) > thresholds.thresholdGil;
    const suffix = viaGil ? `${formatGil(Math.abs(item.diff!))}` : `${Math.abs(item.diffPct).toFixed(0)}%`;
    return item.diff! > 0
      ? {
          label: `Underpriced ${suffix}`,
          cls: 'bg-rose-50 border-rose-200 text-rose-700',
        }
      : {
          label: `Overpriced ${suffix}`,
          cls: 'bg-amber-50 border-amber-200 text-amber-700',
        };
  }
  return {
    label: 'OK',
    cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
};

export const PricesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [myPriceVal, setMyPriceVal] = useState<number | ''>('');
  const [expandedAnomalyId, setExpandedAnomalyId] = useState<string | null>(null);
  const [pctInput, setPctInput] = useState<number | ''>('');
  const [gilInput, setGilInput] = useState<number | ''>('');

  const { data, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['prices', search],
    queryFn: async () => {
      const url = search ? `/prices?search=${encodeURIComponent(search)}&limit=100` : `/prices?limit=100`;
      return (await api.get(url)).data;
    },
  });

  const { data: anomalies, isLoading: anomaliesLoading } = useQuery<PriceAnomaliesResponse>({
    queryKey: ['price-anomalies'],
    queryFn: async () => (await api.get('/prices/anomalies')).data,
  });

  const { data: thresholdSettings } = useQuery<AnomalyThresholds>({
    queryKey: ['anomaly-thresholds'],
    queryFn: async () => (await api.get('/prices/anomalies/settings')).data,
  });

  // Seed the editor inputs once thresholds are loaded
  React.useEffect(() => {
    if (thresholdSettings) {
      setPctInput((prev) => (prev === '' ? thresholdSettings.thresholdPct ?? '' : prev));
      setGilInput((prev) => (prev === '' ? thresholdSettings.thresholdGil ?? '' : prev));
    }
  }, [thresholdSettings]);

  const refreshMutation = useMutation({
    mutationFn: () => api.post('/prices/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['price-anomalies'] });
    },
  });

  const saveThresholdsMutation = useMutation({
    mutationFn: () =>
      api.put('/prices/anomalies/settings', {
        thresholdPct: pctInput === '' ? null : Number(pctInput),
        thresholdGil: gilInput === '' ? null : Number(gilInput),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomaly-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['price-anomalies'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save anomaly thresholds.');
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) =>
      price === null
        ? api.delete(`/prices/${id}/my-price`)
        : api.put(`/prices/${id}/my-price`, { myPrice: price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['price-anomalies'] });
      setEditingId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save manual price override.');
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
  const anomalyItems = anomalies?.items ?? [];

  return (
    <div className="space-y-6">
      <PartSetsPanel />

      {/* Price Anomalies: craft cost vs custom price */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Price Anomalies</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Craft cost vs your custom price for materials used in submarine part crafting.
            {anomalies ? ` ${anomalies.anomalyCount} of ${anomalies.total} craftables currently flagged.` : ''}
          </p>
        </div>

        {/* Adjustable detector thresholds: % OR gil (empty = off) */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            Flag when diff
            <br />
            exceeds
          </span>
          <label className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="off"
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono placeholder:text-slate-300"
            />
            <span className="text-xs text-slate-600 font-medium">%</span>
          </label>
          <span className="text-slate-300 text-xs font-bold">OR</span>
          <label className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="off"
              value={gilInput}
              onChange={(e) => setGilInput(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono placeholder:text-slate-300"
            />
            <span className="text-xs text-slate-600 font-medium">Gil</span>
          </label>
          <button
            onClick={() => saveThresholdsMutation.mutate()}
            disabled={saveThresholdsMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition disabled:opacity-50"
            title="Empty = that check is disabled"
          >
            <Save className="w-3.5 h-3.5" />
            {saveThresholdsMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3">Craft Cost</th>
                <th className="px-5 py-3" title="Total craft operations: this item's own craft plus every craftable ingredient, recursively">Crafts</th>
                <th className="px-5 py-3">My Custom Price</th>
                <th className="px-5 py-3">Δ Gil</th>
                <th className="px-5 py-3">Δ %</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {anomaliesLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Computing craft costs...
                  </td>
                </tr>
              ) : anomalyItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No craftable materials used in submarine parts yet. Define recipes and
                    add the materials to a submarine part to unlock craft-cost validation.
                  </td>
                </tr>
              ) : (
                anomalyItems.map((item) => {
                  const status = statusOf(item, anomalies?.thresholds ?? thresholdSettings);
                  const isExpanded = expandedAnomalyId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {item.name}
                            {item.itemId != null && (
                              <span className="text-[10px] font-mono text-slate-400">#{item.itemId}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sky-700 font-bold">
                          {formatGil(item.craftCost)}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600" title="Total craft operations needed (own craft + craftable ingredients, recursively)">
                          <span className="inline-flex items-center gap-1">
                            <Hammer className="w-3 h-3 text-slate-400" />
                            {item.craftCount}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {item.myPrice != null ? (
                            <span className="text-amber-600 font-semibold">{formatGil(item.myPrice)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td
                          className={`px-5 py-3.5 font-mono ${
                            item.diff == null
                              ? 'text-slate-300'
                              : item.diff > 0
                                ? 'text-rose-600 font-semibold'
                                : 'text-emerald-600 font-semibold'
                          }`}
                        >
                          {item.diff == null ? '—' : `${item.diff > 0 ? '+' : ''}${formatGil(item.diff)}`}
                        </td>
                        <td
                          className={`px-5 py-3.5 font-mono ${
                            item.diffPct == null
                              ? 'text-slate-300'
                              : item.isAnomaly
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-500'
                          }`}
                        >
                          {item.diffPct == null ? '—' : `${item.diffPct > 0 ? '+' : ''}${item.diffPct.toFixed(1)}%`}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${status.cls}`}
                            title={
                              item.incomplete
                                ? 'Some ingredients have no price source — craft cost may be understated'
                                : undefined
                            }
                          >
                            {item.incomplete && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setExpandedAnomalyId(isExpanded ? null : item.id)}
                            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
                            title="Ingredient breakdown"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="space-y-1">
                              {item.ingredients.map((ing) => (
                                <div key={ing.ingredientMaterialId} className="flex items-center gap-2 text-[11px]">
                                  <span className="font-mono text-slate-500 w-12 text-right">
                                    x{ing.quantity}
                                  </span>
                                  <span className="font-medium text-slate-700">{ing.name}</span>
                                  {ing.crafted && (
                                    <span
                                      className="px-1 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-semibold uppercase flex items-center gap-0.5"
                                      title="Crafted ingredient — valued at min(buy, craft cost)"
                                    >
                                      <Hammer className="w-2.5 h-2.5" /> crafted
                                    </span>
                                  )}
                                  <span className="text-slate-400 ml-auto font-mono">
                                    {formatGil(ing.unitCost)} each = {formatGil(ing.totalCost)}
                                  </span>
                                </div>
                              ))}
                              <div className="pt-1 mt-1 border-t border-slate-200 flex items-center justify-end gap-2 text-[11px] font-semibold">
                                <span className="text-slate-500">Total craft cost:</span>
                                <span className="font-mono text-sky-700">{formatGil(item.craftCost)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Market Pricing &amp; Valuation</h2>
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
