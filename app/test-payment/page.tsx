'use client';

import { useState } from 'react';
import PaymentButton from '../components/PaymentButton';

export default function TestPaymentPage() {
  const [amount, setAmount] = useState(100);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Test Payment System
        </h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (₪)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Email
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <PaymentButton
            orderId={`TEST-${Date.now()}`}
            amount={amount}
            currency="ILS"
            customerName={customerName}
            customerEmail={customerEmail}
            productName="Test Payment"
            createToken={true}
            createDocument={true}
            onSuccess={(result) => {
              console.log('Payment successful:', result);
              alert('Payment successful! Check the console for details.');
            }}
            onError={(error) => {
              console.error('Payment failed:', error);
              alert('Payment failed: ' + error);
            }}
            className="w-full"
          >
            Test Payment - ₪{amount}
          </PaymentButton>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Note:</strong> This is a test page. Make sure you have:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Set up your CardCom credentials in .env.local</li>
            <li>Database is running (SQLite)</li>
            <li>Payment API endpoints are working</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
