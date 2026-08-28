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
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatNumber } from '../lib/utils';
import { InProgressOrderFeedItem } from '@ff14/types';

export const DashboardPage: React.FC = () => {
  // Fetch in-progress orders (polled every 10s)
  const { data: inProgressData, isLoading: inProgressLoading } = useQuery<{
    orders: InProgressOrderFeedItem[];
  }>({
    queryKey: ['in-progress-orders'],
    queryFn: async () => (await api.get('/orders/in-progress')).data,
    refetchInterval: 10000,
  });

  // Fetch orders summary
  const { data: pendingOrders } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: async () => (await api.get('/orders?status=pending&limit=5')).data,
  });

  // Fetch missing materials count
  const { data: missingStock } = useQuery({
    queryKey: ['inventory', 'missing'],
    queryFn: async () => (await api.get('/inventory/missing?limit=5')).data,
  });

  const orders = inProgressData?.orders ?? [];

  return (
    <div className="space-y-8">
      {/* Top Welcome & KPI cards */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Workshop Operations Dashboard</h2>
        <p className="text-xs text-slate-400">
          Real-time submarine fabrication tracker and inventory monitor.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Active Crafts</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{orders.length}</div>
          <p className="text-xs text-cyan-400/80 mt-1">Simultaneous builds</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Pending Orders</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {pendingOrders?.total ?? 0}
          </div>
          <p className="text-xs text-amber-400/80 mt-1">Awaiting confirmation</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Stock Deficits</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {missingStock?.total ?? 0}
          </div>
          <p className="text-xs text-rose-400/80 mt-1">Materials below target</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Plugin Sync</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">Live</div>
          <p className="text-xs text-slate-400 mt-1">Retainer bags updated</p>
        </div>
      </div>

      {/* Live In-Progress Fabrication Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              Live Order Progress (In-Progress Builds)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Refreshed automatically every 10 seconds. Live stock from your retainers vs ordered quantities.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-400 font-mono">
            {orders.length} in crafting
          </span>
        </div>

        {inProgressLoading ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Loading crafting progress...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <ShoppingCart className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">No orders currently marked as in-progress.</p>
            <p className="text-xs text-slate-600">
              Confirm pending orders or change order status to "in_progress" in the Orders tab.
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
                  className="bg-slate-950 border border-slate-800/90 rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
                >
                  {/* Order header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          {order.orderCode}
                        </span>
                        <h4 className="font-semibold text-white text-sm">
                          {order.clientName}
                        </h4>
                      </div>
                      {order.contactInfo && (
                        <p className="text-xs text-slate-400 mt-1">
                          Contact: <span className="text-slate-300">{order.contactInfo}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-cyan-400">
                        {overallPct}%
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {totalCrafted} / {totalOrdered} parts
                      </p>
                    </div>
                  </div>

                  {/* Overall progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
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
                            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                              {isComplete ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0"></span>
                              )}
                              {item.partName}
                            </span>
                            <span
                              className={`font-mono text-xs ${
                                isComplete
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.stock} / {item.quantity}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isComplete ? 'bg-emerald-400' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${itemPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {order.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded border border-slate-800/60 italic">
                      "{order.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lower Row: Missing Materials Quick List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm">
              Top Material Deficits
            </h3>
            <p className="text-xs text-slate-400">
              Raw materials in high demand across your workshop.
            </p>
          </div>
          <a
            href="/inventory"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            View Full Inventory →
          </a>
        </div>

        <div className="divide-y divide-slate-800">
          {(missingStock?.items ?? []).map((mat: any) => (
            <div
              key={mat.id}
              className="py-3 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-medium text-slate-200">{mat.name}</span>
                <span className="text-slate-500 ml-2">({mat.whereToBuy})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400">
                  Stock: <strong className="text-slate-200">{formatNumber(mat.currentStock)}</strong> / {formatNumber(mat.desiredQuantity)}
                </span>
                <span className="font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                  Deficit: -{formatNumber(mat.deficit)}
                </span>
              </div>
            </div>
          ))}
          {(missingStock?.items?.length ?? 0) === 0 && (
            <div className="py-6 text-center text-slate-500 text-xs">
              All materials currently meet or exceed target inventory levels. 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
