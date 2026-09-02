import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Boxes,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Hammer,
  AlertTriangle,
  PackageX,
  TrendingUp,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatGil, formatNumber } from '../lib/utils';
import { InProgressAggregate, InProgressOrderFeedItem } from '@ff14/types';

export const DashboardPage: React.FC = () => {
  // Fetch in-progress orders (polled every 10s)
  const { data: inProgressData, isLoading: inProgressLoading } = useQuery<{
    orders: InProgressOrderFeedItem[];
    aggregate: InProgressAggregate;
  }>({
    queryKey: ['in-progress-orders'],
    queryFn: async () => (await api.get('/orders/in-progress')).data,
    refetchInterval: 10000,
  });

  // Fetch confirmed orders summary (pending orders stay hidden until activated by code)
  const { data: confirmedOrders } = useQuery({
    queryKey: ['orders', 'confirmed'],
    queryFn: async () => (await api.get('/orders?status=confirmed&limit=5')).data,
  });

  // Fetch missing materials count
  const { data: missingStock } = useQuery({
    queryKey: ['inventory', 'missing'],
    queryFn: async () => (await api.get('/inventory/missing?limit=5')).data,
  });

  const orders = inProgressData?.orders ?? [];
  const aggregate = inProgressData?.aggregate;
  const aggregateMaterials = aggregate?.materials ?? [];
  const shortfallCount = aggregateMaterials.filter((m) => m.missing > 0).length;

  return (
    <div className="space-y-8">
      {/* Top Welcome & KPI cards */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Workshop Operations Dashboard</h2>
        <p className="text-xs text-slate-500">
          Real-time submarine fabrication tracker and inventory monitor.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Active Crafts</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
          <p className="text-xs text-cyan-600 mt-1">Simultaneous builds</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Confirmed Orders</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {confirmedOrders?.total ?? 0}
          </div>
          <p className="text-xs text-blue-600 mt-1">Ready to start crafting</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Stock Deficits</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {missingStock?.total ?? 0}
          </div>
          <p className="text-xs text-rose-600 mt-1">Materials below target</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Plugin Sync</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">Live</div>
          <p className="text-xs text-slate-500 mt-1">Retainer bags updated</p>
        </div>
      </div>

      {/* Profit per Order Isle */}
      {orders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="min-w-40">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Profit per Order
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Revenue (after discount) vs current material prices.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-1">
              {orders.map((o) => (
                <span
                  key={o.id}
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  title={o.clientName}
                >
                  <span className="font-mono font-bold text-slate-700">
                    {o.orderCode}
                  </span>
                  <span
                    className={`font-bold ${
                      o.financials.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {o.financials.profit >= 0 ? '+' : ''}
                    {formatGil(o.financials.profit)}
                  </span>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 lg:border-l lg:border-slate-200 lg:pl-5">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  All In-Progress
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  Sale {formatGil(aggregate?.revenue ?? 0)} · Cost{' '}
                  {formatGil(aggregate?.materialCost ?? 0)}
                </p>
              </div>
              <span
                className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${
                  (aggregate?.profit ?? 0) >= 0
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}
              >
                {(aggregate?.profit ?? 0) >= 0 ? '+' : ''}
                {formatGil(aggregate?.profit ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live In-Progress Fabrication Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping"></span>
              Live Order Progress (In-Progress Builds)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Refreshed automatically every 10 seconds. Live stock from your retainers vs ordered quantities.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-500 font-mono">
            {orders.length} in crafting
          </span>
        </div>

        {inProgressLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading crafting progress...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm">No orders currently marked as in-progress.</p>
            <p className="text-xs text-slate-400">
              Confirm orders with their code (top bar) or set status to "In Progress" in the Orders tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orders.map((order) => {
              // Calculate overall completion percent
              let totalOrdered = 0;
              let totalCrafted = 0;
              for (const item of order.items) {
                totalOrdered += item.quantity;
                totalCrafted += Math.min(item.quantity, item.stock);
              }
              const overallPct =
                totalOrdered > 0 ? Math.round((totalCrafted / totalOrdered) * 100) : 0;

              return (
                <div
                  key={order.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition"
                >
                  {/* Order header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {order.orderCode}
                        </span>
                        <h4 className="font-semibold text-slate-900 text-sm">
                          {order.clientName}
                        </h4>
                      </div>
                      {order.contactInfo && (
                        <p className="text-xs text-slate-500 mt-1">
                          Contact: <span className="text-slate-700">{order.contactInfo}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-cyan-600">
                        {overallPct}%
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {totalCrafted} / {totalOrdered} parts
                      </p>
                      <span
                        className={`text-[11px] font-bold ${
                          order.financials.profit >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {order.financials.profit >= 0 ? '+' : ''}
                        {formatGil(order.financials.profit)}
                      </span>
                    </div>
                  </div>

                  {/* Overall progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>

                  {/* Individual parts breakdown */}
                  <div className="space-y-2.5 pt-1">
                    {order.items.map((item, idx) => {
                      const itemPct = Math.min(
                        100,
                        Math.round((item.stock / item.quantity) * 100)
                      );
                      const isComplete = item.stock >= item.quantity;

                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                              {isComplete ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0"></span>
                              )}
                              {item.partName}
                            </span>
                            <span
                              className={`font-mono text-xs ${
                                isComplete
                                  ? 'text-emerald-600 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {item.stock} / {item.quantity}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isComplete ? 'bg-emerald-500' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${itemPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Missing materials for the parts still to craft */}
                  <div className="pt-1">
                    {order.missingMaterials.length > 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                          <PackageX className="w-3.5 h-3.5" />
                          Missing Materials ({order.missingMaterials.length})
                        </div>
                        <div className="space-y-1.5">
                          {order.missingMaterials.map((mat) => (
                            <div
                              key={mat.materialId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-slate-700 font-medium flex items-center gap-1.5 min-w-0">
                                {mat.isPart ? (
                                  <Hammer className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                )}
                                <span className="truncate">{mat.name}</span>
                              </span>
                              <span className="font-mono text-[11px] whitespace-nowrap">
                                <span className="text-slate-500">
                                  have {formatNumber(mat.available)}
                                </span>{' '}
                                <span className="text-amber-700 font-bold">
                                  missing {formatNumber(mat.missing)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        All materials in stock — nothing missing to finish this order.
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200 italic">
                      "{order.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Combined Material Requirements Across All In-Progress Orders */}
      {orders.length > 0 && aggregateMaterials.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-600" />
                Materials Required — All In-Progress Orders
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Everything the active builds need combined, checked against current
                stock — not just what a single order is short of.
              </p>
            </div>
            {shortfallCount > 0 ? (
              <span className="text-xs px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                {shortfallCount} material{shortfallCount === 1 ? '' : 's'} short
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All covered
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {aggregateMaterials.map((mat) => (
              <div
                key={`${mat.materialId}-${mat.isPart}`}
                className={`py-3 flex items-center justify-between gap-3 text-xs ${
                  mat.missing > 0 ? '' : 'opacity-70'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {mat.isPart ? (
                    <Hammer className="w-3 h-3 text-amber-600 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-slate-800 truncate">
                    {mat.name}
                  </span>
                  {mat.isPart && (
                    <span className="text-[10px] text-slate-400">(part)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-slate-500 font-mono">
                    need <strong className="text-slate-800">{formatNumber(mat.needed)}</strong>
                    {' · '}have <strong className="text-slate-800">{formatNumber(mat.available)}</strong>
                  </span>
                  {mat.missing > 0 ? (
                    <span className="font-mono px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                      Missing: -{formatNumber(mat.missing)}
                    </span>
                  ) : (
                    <span className="font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      Covered
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lower Row: Missing Materials Quick List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Top Material Deficits
            </h3>
            <p className="text-xs text-slate-500">
              Raw materials in high demand across your workshop.
            </p>
          </div>
          <a
            href="/inventory"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View Full Inventory →
          </a>
        </div>

        <div className="divide-y divide-slate-100">
          {(missingStock?.items ?? []).map((mat: any) => (
            <div
              key={mat.id}
              className="py-3 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-medium text-slate-800">{mat.name}</span>
                <span className="text-slate-400 ml-2">({mat.whereToBuy})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-500">
                  Stock: <strong className="text-slate-800">{formatNumber(mat.currentStock)}</strong> / {formatNumber(mat.desiredQuantity)}
                </span>
                <span className="font-mono px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  Deficit: -{formatNumber(mat.deficit)}
                </span>
              </div>
            </div>
          ))}
          {(missingStock?.items?.length ?? 0) === 0 && (
            <div className="py-6 text-center text-slate-400 text-xs">
              All materials currently meet or exceed target inventory levels. 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
