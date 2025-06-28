import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../app/components/ui/card";
import { 
  ShoppingBag, 
  Users, 
  TrendingUp,
  Package,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import RecentOrders from "./components/dashboard/RecentOrders";
import TopProducts from "./components/dashboard/TopProducts";
import SalesChart from "./components/dashboard/SalesChart";

interface Stat {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Mock data for now
        const mockOrders = [
          { id: 1, customer_id: 1, created_date: '2024-03-01', total: 1200, status: 'completed', items: [{ product_id: 1, quantity: 2 }] },
          { id: 2, customer_id: 2, created_date: '2024-03-02', total: 800, status: 'pending', items: [{ product_id: 2, quantity: 1 }] },
        ];
        const mockCustomers = [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' },
        ];
        const mockProducts = [
          { id: 1, name: 'Product 1', category: 'Category 1', price: 600 },
          { id: 2, name: 'Product 2', category: 'Category 2', price: 800 },
        ];

        setOrders(mockOrders);
        setCustomers(mockCustomers);
        setProducts(mockProducts);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const stats: Stat[] = [
    {
      title: "Total Orders",
      value: orders.length,
      icon: ShoppingBag,
      trend: "+12.5%",
      trendUp: true
    },
    {
      title: "Total Customers",
      value: customers.length,
      icon: Users,
      trend: "+5.2%",
      trendUp: true
    },
    {
      title: "Products",
      value: products.length,
      icon: Package,
      trend: "-2.4%",
      trendUp: false
    },
    {
      title: "Revenue",
      value: `₪${orders.reduce((sum, order) => sum + order.total, 0).toLocaleString()}`,
      icon: TrendingUp,
      trend: "+8.4%",
      trendUp: true
    }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  stat.trendUp ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.trendUp ? (
                    <ArrowUpCircle className="w-4 h-4" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4" />
                  )}
                  {stat.trend}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart orders={orders} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProducts orders={orders} products={products} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentOrders orders={orders} customers={customers} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
} 