'use client';

import { useState } from 'react';

export default function TestCardComPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testCardCom = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/create-low-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 10, // Test with small amount
          currency: 'ILS',
          items: [
            {
              productName: 'Test Product',
              productSku: 'TEST-001',
              quantity: 1,
              price: 10,
            }
          ],
          customerEmail: 'test@example.com',
          customerName: 'Test Customer',
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Test CardCom Integration</h1>
        
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Environment Variables:</h2>
          <div className="bg-gray-100 p-3 rounded text-sm">
            <p>Note: Environment variables are only available on the server side</p>
            <p>Check the server console for actual values</p>
          </div>
        </div>

        <button
          onClick={testCardCom}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test CardCom API'}
        </button>

        {result && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Result:</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
