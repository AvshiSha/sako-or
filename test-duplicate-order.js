// Test script for duplicate order handling
// Run with: node test-duplicate-order.js

const testDuplicateOrder = async () => {
  const apiUrl = 'https://www.sako-or.com/api/payments/create-low-profile';
  // Or for local: 'http://localhost:3000/api/payments/create-low-profile'
  
  const payload = {
    orderId: "ORDER-1762503430385", // The problematic order ID
    amount: 100,
    currencyIso: 1,
    language: "he",
    productName: "Test Product",
    productSku: "TEST-001",
    quantity: 1,
    customer: {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      mobile: "0501234567",
      idNumber: "123456789"
    },
    deliveryAddress: {
      city: "Tel Aviv",
      streetName: "Dizengoff",
      streetNumber: "1",
      floor: "0",
      apartmentNumber: "",
      zipCode: ""
    },
    notes: "",
    ui: {
      isCardOwnerPhoneRequired: true,
      cssUrl: "https://www.sako-or.com/cardcom.css"
    },
    advanced: {
      jValidateType: 5,
      threeDSecureState: "Auto",
      minNumOfPayments: 1,
      maxNumOfPayments: 1
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: Duplicate order was handled correctly!');
      console.log('New order ID:', data.orderId);
    } else {
      console.log('\n❌ FAILED: Still getting error');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

testDuplicateOrder();

