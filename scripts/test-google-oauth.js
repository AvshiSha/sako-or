#!/usr/bin/env node

/**
 * Test script to verify Google OAuth configuration
 * Run this script to check if your Google OAuth setup is correct
 */

const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function testGoogleOAuth() {
  console.log('🔍 Testing Google OAuth Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`   GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}\n`);

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('❌ Error: Missing required environment variables!');
    console.log('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.local file');
    process.exit(1);
  }

  // Determine redirect URI
  const redirectUri = process.env.NODE_ENV === 'production' 
    ? 'https://sako-or.vercel.app/api/google-drive/callback'
    : 'http://localhost:3000/api/google-drive/callback';

  console.log(`🔗 Redirect URI: ${redirectUri}\n`);

  try {
    // Initialize OAuth2 client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Generate auth URL
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent'
    });

    console.log('✅ OAuth configuration is valid!');
    console.log(`🔗 Auth URL: ${authUrl}\n`);

    console.log('📝 Next Steps:');
    console.log('   1. Make sure this redirect URI is added to your Google Cloud Console:');
    console.log(`      ${redirectUri}`);
    console.log('   2. If you\'re in production, make sure your Vercel environment variables are set');
    console.log('   3. Test the OAuth flow by visiting the auth URL above\n');

  } catch (error) {
    console.log('❌ Error testing OAuth configuration:');
    console.log(`   ${error.message}\n`);
    
    if (error.message.includes('invalid_client')) {
      console.log('💡 This usually means:');
      console.log('   - Your Client ID or Client Secret is incorrect');
      console.log('   - The redirect URI is not authorized in Google Cloud Console');
      console.log('   - Your OAuth client is not properly configured\n');
    }
    
    process.exit(1);
  }
}

// Run the test
testGoogleOAuth().catch(console.error);
