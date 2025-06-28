import React from 'react';

interface TopProductsProps {
  orders: any[];
  products: any[];
}

export default function TopProducts({ orders, products }: TopProductsProps) {
  // Calculate product sales
  const productSales = products.map(product => {
    const sales = orders.reduce((total, order) => {
      const orderItem = order.items.find((item: any) => item.product_id === product.id);
      return total + (orderItem ? orderItem.quantity : 0);
    }, 0);
    return { ...product, sales };
  });

  // Sort by sales and get top 5
  const topProducts = productSales
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {topProducts.map((product) => (
        <div key={product.id} className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-600">
                {product.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-gray-500">{product.category}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">{product.sales} units</p>
            <p className="text-sm text-gray-500">₪{product.price}</p>
          </div>
        </div>
      ))}
    </div>
  );
} 