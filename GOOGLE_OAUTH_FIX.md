# Google OAuth 400 Error Fix Guide

## Problem

You're getting a "שגיאה 400: invalid_request" error when trying to connect to Google Drive on your production domain `sako-or.vercel.app`.

## Root Cause

The error occurs because your Google OAuth client is not properly configured for your production domain. The OAuth flow fails when the redirect URI doesn't match what's configured in Google Cloud Console.

## Step-by-Step Fix

### 1. Update Google Cloud Console

1. **Go to Google Cloud Console**

   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project (the same one used for Firebase)

2. **Navigate to OAuth Credentials**

   - Go to "APIs & Services" > "Credentials"
   - Find your OAuth 2.0 Client ID and click on it

3. **Add Production Redirect URI**

   - In the "Authorized redirect URIs" section, add:
     ```
     https://sako-or.vercel.app/api/google-drive/callback
     ```
   - Make sure you also have the development URI:
     ```
     http://localhost:3000/api/google-drive/callback
     ```

4. **Save Changes**
   - Click "Save" to update the configuration

### 2. Update Vercel Environment Variables

1. **Go to Vercel Dashboard**

   - Visit [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your `sako-or` project

2. **Navigate to Environment Variables**

   - Go to Settings > Environment Variables

3. **Add Required Variables**

   - Add `GOOGLE_CLIENT_ID` with your Google OAuth Client ID
   - Add `GOOGLE_CLIENT_SECRET` with your Google OAuth Client Secret
   - Make sure these are set for "Production" environment

4. **Redeploy**
   - After adding the environment variables, redeploy your application

### 3. Test the Configuration

1. **Run the Test Script**

   ```bash
   node scripts/test-google-oauth.js
   ```

2. **Check the Output**
   - The script will verify your configuration
   - It will show you the auth URL if everything is correct

### 4. Verify the Fix

1. **Test in Production**
   - Go to `https://sako-or.vercel.app/admin/products/new`
   - Try to connect to Google Drive
   - The OAuth flow should now work correctly

## Common Issues and Solutions

### Issue: "invalid_client" Error

**Solution:**

- Double-check your Client ID and Client Secret
- Ensure the redirect URI exactly matches what's in Google Cloud Console
- Make sure the OAuth client is enabled

### Issue: Environment Variables Not Set

**Solution:**

- Verify variables are set in Vercel dashboard
- Check that they're set for the correct environment (Production)
- Redeploy after adding variables

### Issue: Redirect URI Mismatch

**Solution:**

- Ensure the redirect URI in Google Cloud Console exactly matches:
  ```
  https://sako-or.vercel.app/api/google-drive/callback
  ```
- Check for typos or extra spaces

## Verification Checklist

- [ ] Google Cloud Console has the correct redirect URI
- [ ] Vercel environment variables are set
- [ ] Application has been redeployed
- [ ] Test script runs without errors
- [ ] OAuth flow works in production

## Additional Notes

- The error "flowName=GeneralOAuthFlow" is Google's internal error code for OAuth configuration issues
- This fix applies to both development and production environments
- Make sure to test both environments after making changes

## Support

If you continue to have issues:

1. Check the browser console for detailed error messages
2. Run the test script to verify configuration
3. Double-check all redirect URIs match exactly
4. Ensure environment variables are properly set in Vercel
