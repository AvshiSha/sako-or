# Vercel OAuth 500 Error Troubleshooting Guide

## Current Issue

You're getting a 500 Internal Server Error when trying to access `/api/google-drive/auth-url` in production, which means the environment variables are not properly configured in Vercel.

## Step-by-Step Fix

### 1. Check Current Environment Variables in Vercel

1. **Go to Vercel Dashboard**

   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your `sako-or` project

2. **Navigate to Environment Variables**

   - Go to Settings → Environment Variables
   - Check if you have these variables set:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`

3. **Check Environment Scope**
   - Make sure these variables are set for "Production" environment
   - If they're only set for "Development", that's the problem!

### 2. Add Missing Environment Variables

If the variables are missing or only set for development:

1. **Get Your Google OAuth Credentials**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" → "Credentials"
   - Find your OAuth 2.0 Client ID
   - Copy the Client ID and Client Secret

2. **Add to Vercel**

   - In Vercel dashboard, click "Add New"
   - Name: `GOOGLE_CLIENT_ID`
   - Value: Your Google Client ID
   - Environment: Select "Production" (and optionally "Preview")
   - Click "Save"

   - Repeat for `GOOGLE_CLIENT_SECRET`

### 3. Redeploy Your Application

After adding environment variables:

1. Go to the "Deployments" tab in Vercel
2. Click "Redeploy" on your latest deployment
3. Or push a new commit to trigger a redeploy

### 4. Test the Configuration

1. **Check Debug Endpoint**

   - Visit: `https://sako-or.vercel.app/api/google-drive/debug`
   - This will show you if the environment variables are properly set

2. **Check Auth URL Endpoint**
   - Visit: `https://sako-or.vercel.app/api/google-drive/auth-url`
   - This should now return a valid auth URL instead of a 500 error

### 5. Verify Google Cloud Console

Make sure your Google Cloud Console has the correct redirect URI:

1. **Go to Google Cloud Console**

   - Navigate to "APIs & Services" → "Credentials"
   - Click on your OAuth 2.0 Client ID

2. **Check Authorized Redirect URIs**
   - Make sure you have: `https://sako-or.vercel.app/api/google-drive/callback`
   - Also keep: `http://localhost:3000/api/google-drive/callback` for development

## Common Issues

### Issue: Variables Set for Development Only

**Symptoms:** Works locally but fails in production
**Solution:** Make sure environment variables are set for "Production" in Vercel

### Issue: Wrong Variable Names

**Symptoms:** 500 error with "credentials not configured"
**Solution:** Double-check variable names are exactly:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Issue: Missing Redeploy

**Symptoms:** Variables added but still getting 500 error
**Solution:** Redeploy your application after adding environment variables

### Issue: Incorrect Client ID/Secret

**Symptoms:** 500 error or "invalid_client"
**Solution:** Verify credentials in Google Cloud Console

## Testing Steps

1. **Test Debug Endpoint**

   ```
   GET https://sako-or.vercel.app/api/google-drive/debug
   ```

   Should return environment variable status

2. **Test Auth URL Endpoint**

   ```
   GET https://sako-or.vercel.app/api/google-drive/auth-url
   ```

   Should return a valid Google OAuth URL

3. **Test Full OAuth Flow**
   - Go to your admin panel
   - Try to connect to Google Drive
   - Should redirect to Google OAuth page

## Expected Results

After fixing the configuration:

- Debug endpoint should show `hasGoogleClientId: true` and `hasGoogleClientSecret: true`
- Auth URL endpoint should return a valid Google OAuth URL
- OAuth flow should work without 500 errors

## If Still Having Issues

1. **Check Vercel Logs**

   - Go to Vercel dashboard → Functions tab
   - Check the logs for your API routes
   - Look for the debug information we added

2. **Verify Google Cloud Console**

   - Make sure Google Drive API is enabled
   - Check that OAuth consent screen is configured
   - Verify redirect URIs are correct

3. **Test Locally First**
   - Make sure it works in development
   - Use the test script: `node scripts/test-google-oauth.js`

## Quick Checklist

- [ ] Environment variables set in Vercel for Production
- [ ] Application redeployed after adding variables
- [ ] Google Cloud Console has correct redirect URI
- [ ] Debug endpoint shows variables are loaded
- [ ] Auth URL endpoint returns valid URL
- [ ] Full OAuth flow works in production
