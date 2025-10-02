// Test script for receipt/document creation
// Run with: node test-receipt-creation.js

const BASE_URL = 'http://localhost:3000'; // Change to your server URL

async function testReceiptCreation() {
  console.log('🧾 Testing Receipt/Document Creation');
  console.log('===================================');
  
  const testPaymentData = {
    amount: 100.00,
    currencyIso: 1, // ILS
    language: 'he', // Hebrew
    customer: {
      firstName: 'משה',
      lastName: 'שרבני',
      email: 'test@sako-or.com',
      mobile: '0525917979',
      identityNumber: '053375598' // This will be used as TaxId
    },
    deliveryAddress: {
      streetName: 'הרצל',
      streetNumber: '123',
      apartment: 'דירה 4',
      city: 'תל אביב'
    },
    productName: 'נעלי ספורט מעוצבות',
    productSku: 'SAKO-SPORT-001',
    quantity: 1
  };
  
  try {
    console.log('Creating payment with receipt...');
    console.log('Customer:', `${testPaymentData.customer.firstName} ${testPaymentData.customer.lastName}`);
    console.log('Product:', testPaymentData.productName);
    console.log('Amount:', testPaymentData.amount, 'ILS');
    console.log('Language:', testPaymentData.language);
    
    const response = await fetch(`${BASE_URL}/api/payments/create-low-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPaymentData)
    });
    
    const result = await response.json();
    
    console.log('\n📋 Payment Creation Result:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('✅ Payment URL created successfully!');
      console.log('Payment URL:', result.paymentUrl);
      console.log('Order ID:', result.orderId);
      console.log('Low Profile ID:', result.lowProfileId);
      
      console.log('\n🧾 Receipt Configuration:');
      console.log('- Document Type: TaxInvoiceAndReceipt');
      console.log('- Customer Name:', `${testPaymentData.customer.firstName} ${testPaymentData.customer.lastName}`);
      console.log('- Email:', testPaymentData.customer.email);
      console.log('- Tax ID:', testPaymentData.customer.identityNumber);
      console.log('- Address:', `${testPaymentData.deliveryAddress.streetName} ${testPaymentData.deliveryAddress.streetNumber}, ${testPaymentData.deliveryAddress.city}`);
      console.log('- Language:', testPaymentData.language);
      console.log('- Send by Email: true');
      
      console.log('\n📝 Next Steps:');
      console.log('1. Complete the payment using the payment URL');
      console.log('2. Check webhook logs for document creation confirmation');
      console.log('3. Customer should receive receipt via email');
      
    } else {
      console.log('❌ Payment creation failed:', result.error);
      console.log('Details:', result.details);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testEnglishReceipt() {
  console.log('\n🧾 Testing English Receipt Creation');
  console.log('===================================');
  
  const testPaymentData = {
    amount: 150.00,
    currencyIso: 1, // ILS
    language: 'en', // English
    customer: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      mobile: '0501234567'
    },
    deliveryAddress: {
      streetName: 'Main Street',
      streetNumber: '456',
      city: 'Tel Aviv'
    },
    productName: 'Designer Sports Shoes',
    productSku: 'SAKO-SPORT-002',
    quantity: 2
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/payments/create-low-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPaymentData)
    });
    
    const result = await response.json();
    
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('✅ English receipt payment created!');
      console.log('Payment URL:', result.paymentUrl);
      console.log('Language: English (en)');
    } else {
      console.log('❌ Failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runTests() {
  await testReceiptCreation();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  await testEnglishReceipt();
  
  console.log('\n✅ Receipt creation tests completed!');
  console.log('\n📋 Important Notes:');
  console.log('- Make sure to set the DepartmentId in the code when you get the value');
  console.log('- Test the actual payment flow to verify receipt generation');
  console.log('- Check CardCom dashboard for document creation logs');
}

// Run the tests
runTests().catch(console.error);
