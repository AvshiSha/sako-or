// Manual webhook test
const testWebhook = async () => {
  const webhookUrl = 'https://www.sako-or.com/api/webhook/cardcom?bypass=re_gy2QLLjm_MVfbTXEYW6SYPXAogH5VLzLo';
  
  const testData = {
    ResponseCode: 0,
    Description: "OK",
    LowProfileId: "test-manual-123",
    ReturnValue: "ORDER-MANUAL-TEST-123",
    Operation: 1,
    TranzactionId: "test-txn-manual-123",
    UIValues: {
      Language: "en"
    }
  };

  try {
    console.log('Testing webhook manually...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CardCom-Webhook/1.0' // Simulate CardCom user-agent
      },
      body: JSON.stringify(testData)
    });

    const result = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response:', result);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
};

// Run the test
testWebhook();
