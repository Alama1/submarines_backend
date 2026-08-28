import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatGil } from '../lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  Play,
} from 'lucide-react';
import { Order, OrderStatus } from '@ff14/types';

export const OrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['orders', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' ? '/orders?limit=100' : `/orders?status=${statusFilter}&limit=100`;
      return (await api.get(url)).data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
      if (selectedOrder) setSelectedOrder(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
      if (selectedOrder) setSelectedOrder(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (selectedOrder) setSelectedOrder(null);
    },
  });

  const orders = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Customer Orders</h2>
          <p className="text-xs text-slate-400">
            View, confirm, and fulfill submarine vessel orders.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {['all', 'pending', 'in_progress', 'fulfilled', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              statusFilter === tab
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total (Gil)</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No orders found matching this filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-400">
                      {order.orderCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{order.clientName}</div>
                      {order.contactInfo && (
                        <div className="text-[11px] text-slate-500">{order.contactInfo}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {(order.items ?? []).length} parts
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-200">
                      {formatGil(order.total)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => confirmMutation.mutate(order.id)}
                            disabled={confirmMutation.isPending}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
                            title="Confirm & Process"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(order.id)}
                            disabled={cancelMutation.isPending}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                            title="Cancel Order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {order.status === 'in_progress' && (
                        <button
                          onClick={() =>
                            statusMutation.mutate({ id: order.id, status: 'fulfilled' })
                          }
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
                        >
                          Mark Fulfilled
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {selectedOrder.orderCode}
                </span>
                <h3 className="font-bold text-white text-lg mt-1">
                  {selectedOrder.clientName}
                </h3>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            {selectedOrder.contactInfo && (
              <p className="text-xs text-slate-400">
                Contact: <strong className="text-slate-200">{selectedOrder.contactInfo}</strong>
              </p>
            )}

            {/* Items Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Order Items & Snapshot Pricing
              </h4>
              <div className="bg-slate-950 rounded-lg border border-slate-800 divide-y divide-slate-800">
                {(selectedOrder.items ?? []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-white">{item.partName}</span>
                      {item.buildName && (
                        <span className="text-slate-500 ml-2">({item.buildName})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">
                        {item.quantity} × {formatGil(item.unitPrice)} =
                      </span>{' '}
                      <span className="font-mono font-bold text-slate-200">
                        {formatGil(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">{formatGil(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountPct > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Bulk Discount ({selectedOrder.discountPct}%):</span>
                  <span className="font-mono">-{formatGil(selectedOrder.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
                <span>Total Due:</span>
                <span className="font-mono text-emerald-400">{formatGil(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Actions in drawer */}
            <div className="flex justify-end gap-2 pt-2">
              {selectedOrder.status === 'pending' && (
                <button
                  onClick={() => confirmMutation.mutate(selectedOrder.id)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Confirm & Reserve Stock
                </button>
              )}
              {selectedOrder.status !== 'in_progress' && selectedOrder.status !== 'fulfilled' && (
                <button
                  onClick={() =>
                    statusMutation.mutate({ id: selectedOrder.id, status: 'in_progress' })
                  }
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Set In Progress
                </button>
              )}
              {selectedOrder.status === 'in_progress' && (
                <button
                  onClick={() =>
                    statusMutation.mutate({ id: selectedOrder.id, status: 'fulfilled' })
                  }
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Mark Fulfilled
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
