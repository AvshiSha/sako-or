import React from 'react';

interface RecentOrdersProps {
  orders: any[];
  customers: any[];
  isLoading: boolean;
}

export default function RecentOrders({ orders, customers, isLoading }: RecentOrdersProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4">Order ID</th>
            <th className="text-left py-3 px-4">Customer</th>
            <th className="text-left py-3 px-4">Date</th>
            <th className="text-left py-3 px-4">Status</th>
            <th className="text-right py-3 px-4">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const customer = customers.find(c => c.id === order.customer_id);
            return (
              <tr key={order.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">#{order.id}</td>
                <td className="py-3 px-4">{customer?.name || 'Unknown'}</td>
                <td className="py-3 px-4">
                  {new Date(order.created_date).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">₪{order.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
} 