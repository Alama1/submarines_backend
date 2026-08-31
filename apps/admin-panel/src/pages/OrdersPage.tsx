import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatGil } from '../lib/utils';
import { Eye, X, XCircle } from 'lucide-react';
import { Order, OrderStatus } from '@ff14/types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finished', label: 'Finished' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusSelectClass =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50';

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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
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

  // Fresh copy of the selected order so the modal reflects status changes immediately
  const modalOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Customer Orders</h2>
          <p className="text-xs text-slate-500">
            View, confirm, and fulfill submarine vessel orders.
          </p>
        </div>
      </div>

      {/* Filter Tabs — pending orders are hidden until activated by code */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'confirmed', 'in_progress', 'finished', 'fulfilled', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              statusFilter === tab
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No orders found matching this filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">
                      {order.orderCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{order.clientName}</div>
                      {order.contactInfo && (
                        <div className="text-[11px] text-slate-400">{order.contactInfo}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {(order.items ?? []).length} parts
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-800">
                      {formatGil(order.total)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <select
                        value={order.status}
                        disabled={statusMutation.isPending}
                        onChange={(e) =>
                          statusMutation.mutate({ id: order.id, status: e.target.value as OrderStatus })
                        }
                        className={statusSelectClass}
                        title="Set Status"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <button
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancelMutation.isPending}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
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

      {/* Order Detail Modal — uses the live row from the list so status updates in place */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {modalOrder.orderCode}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">
                  {modalOrder.clientName}
                </h3>
              </div>
              <StatusBadge status={modalOrder.status} />
            </div>

            {modalOrder.contactInfo && (
              <p className="text-xs text-slate-500">
                Contact: <strong className="text-slate-700">{modalOrder.contactInfo}</strong>
              </p>
            )}

            {/* Items Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Order Items & Snapshot Pricing
              </h4>
              <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                {(modalOrder.items ?? []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{item.partName}</span>
                      {item.buildName && (
                        <span className="text-slate-400 ml-2">({item.buildName})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500">
                        {item.quantity} × {formatGil(item.unitPrice)} =
                      </span>{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {formatGil(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">{formatGil(modalOrder.subtotal)}</span>
              </div>
              {modalOrder.discountPct > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Bulk Discount ({modalOrder.discountPct}%):</span>
                  <span className="font-mono">-{formatGil(modalOrder.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Due:</span>
                <span className="font-mono text-emerald-600">{formatGil(modalOrder.total)}</span>
              </div>
            </div>

            {/* Status control */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-medium text-slate-500">Set Status:</span>
              <select
                value={modalOrder.status}
                disabled={statusMutation.isPending}
                onChange={(e) =>
                  statusMutation.mutate({ id: modalOrder.id, status: e.target.value as OrderStatus })
                }
                className={`${statusSelectClass} px-3 py-2`}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
