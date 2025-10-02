// Test script for URL-based language detection
// Run with: node test-url-language.js

const BASE_URL = 'http://localhost:3000'; // Change to your server URL

async function testUrlLanguageDetection(langParam, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`URL Language Parameter: ${langParam}`);
  
  const testUrl = langParam 
    ? `${BASE_URL}/api/test-language-detection?lang=${langParam}`
    : `${BASE_URL}/api/test-language-detection`;
  
  try {
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerEmail: 'test@example.com'
      })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('URL Language:', result.urlLanguage);
    console.log('Detected Hebrew:', result.detectedHebrew);
    console.log('Detection Method:', result.detectionMethod);
    console.log('Email Sent:', result.emailSent);
    
    return {
      langParam,
      success: response.ok,
      result
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    return {
      langParam,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🚀 Starting URL-Based Language Detection Tests');
  console.log('==============================================');
  
  const testCases = [
    { langParam: 'he', description: 'Hebrew Language (lang=he)' },
    { langParam: 'en', description: 'English Language (lang=en)' },
    { langParam: 'fr', description: 'French Language (lang=fr) - should default to Hebrew' },
    { langParam: null, description: 'No Language Parameter - should default to Hebrew' },
  ];
  
  for (const testCase of testCases) {
    await testUrlLanguageDetection(testCase.langParam, testCase.description);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }
  
  console.log('\n✅ Tests completed!');
  console.log('\n📋 Expected Results:');
  console.log('- lang=he → if_he=true (Hebrew email)');
  console.log('- lang=en → if_he=false (English email)');
  console.log('- lang=fr or no param → if_he=true (Hebrew email, default)');
  console.log('\nCheck your server logs for detailed debug output.');
}

// Run the tests
runTests().catch(console.error);
