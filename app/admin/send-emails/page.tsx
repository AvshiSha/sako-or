'use client';

import { useState } from 'react';

export default function SendEmailsPage() {
  const [orderId, setOrderId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const sendEmail = async () => {
    if (!orderId) {
      setResult('Please enter an order ID');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(`✅ Email sent successfully! ${JSON.stringify(data)}`);
      } else {
        setResult(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Send Confirmation Emails</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Order ID:
          </label>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g., ORDER-1759221732643"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <button
          onClick={sendEmail}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Email'}
        </button>
        
        {result && (
          <div className={`p-4 rounded ${result.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {result}
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <h3 className="font-bold mb-2">Recent Orders:</h3>
        <ul className="text-sm">
          <li>• ORDER-1759221732643 (completed)</li>
          <li>• ORDER-1759221333655 (processing)</li>
          <li>• ORDER-1759221270664 (pending)</li>
        </ul>
      </div>
    </div>
  );
}
