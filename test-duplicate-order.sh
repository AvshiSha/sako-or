#!/bin/bash
# Test duplicate order handling
# Run with: bash test-duplicate-order.sh

echo "Testing duplicate order number handling..."
echo "=========================================="
echo ""

# Test with the existing problematic order ID
curl -X POST https://www.sako-or.com/api/payments/create-low-profile \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER-1762503430385",
    "amount": 100,
    "currencyIso": 1,
    "language": "he",
    "productName": "Test Product",
    "productSku": "TEST-001",
    "quantity": 1,
    "customer": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "mobile": "0501234567",
      "idNumber": "123456789"
    },
    "deliveryAddress": {
      "city": "Tel Aviv",
      "streetName": "Dizengoff",
      "streetNumber": "1",
      "floor": "",
      "apartmentNumber": "",
      "zipCode": ""
    },
    "notes": "",
    "ui": {
      "isCardOwnerPhoneRequired": true,
      "cssUrl": "https://www.sako-or.com/cardcom.css"
    },
    "advanced": {
      "jValidateType": 5,
      "threeDSecureState": "Auto",
      "minNumOfPayments": 1,
      "maxNumOfPayments": 1
    }
  }' | jq '.'

echo ""
echo "=========================================="
echo "Check the response above:"
echo "- Status 200 + orderId = ✅ SUCCESS"
echo "- Status 500 = ❌ FAILED"

