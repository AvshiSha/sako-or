// Test script for Resend email integration
const testEmail = async () => {
  const emailData = {
    customerEmail: 'avshi@sako-or.com', // Change to your email for testing
    customerName: 'John Doe',
    orderNumber: 'ORDER-TEST-123',
    orderDate: new Date().toLocaleDateString(),
    items: [
      {
        name: 'Test Product 1',
        quantity: 2,
        price: 50.00
      },
      {
        name: 'Test Product 2',
        quantity: 1,
        price: 75.00
      }
    ],
    total: 175.00,
    isHebrew: false // Set to true for Hebrew email
  };

  try {
    console.log('Testing Resend email...');
    const response = await fetch('http://localhost:3000/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();
    console.log('Email test result:', result);
    
    if (response.ok) {
      console.log('✅ Email test successful!');
    } else {
      console.log('❌ Email test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing email:', error);
  }
};

// Run the test
testEmail();
