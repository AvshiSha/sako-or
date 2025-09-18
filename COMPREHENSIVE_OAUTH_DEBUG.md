# Comprehensive OAuth Debug Guide

## Current Status

You've added environment variables to Vercel and redeployed, but still getting the same 500 error. Let's systematically debug this.

## Step 1: Check Environment Variables Again

First, let's verify the environment variables are actually loaded:

**Visit this URL:** `https://sako-or.vercel.app/api/google-drive/debug`

**Expected result after adding variables:**

```json
{
  "hasGoogleClientId": true,
  "hasGoogleClientSecret": true,
  "clientIdLength": [number > 0],
  "clientSecretLength": [number > 0]
}
```

**If still showing `false`:** The variables weren't added correctly to Vercel.

## Step 2: Test OAuth Configuration

**Visit this URL:** `https://sako-or.vercel.app/api/google-drive/test-auth`

This will test the complete OAuth setup and show exactly where the problem is.

## Step 3: Check Vercel Environment Variables Setup

### Common Issues:

1. **Wrong Environment Selected**

   - Make sure you selected "Production" when adding variables
   - Not "Development" or "Preview"

2. **Variable Names Case-Sensitive**

   - Must be exactly: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Not: `google_client_id` or `Google_Client_Id`

3. **Missing Redeploy**

   - After adding variables, you MUST redeploy
   - Go to Deployments → Click "Redeploy"

4. **Wrong Project**
   - Make sure you're adding variables to the correct Vercel project
   - Should be `sako-or`

## Step 4: Verify Google Cloud Console

### Check OAuth Client Configuration:

1. **Go to Google Cloud Console**

   - [console.cloud.google.com](https://console.cloud.google.com)
   - APIs & Services → Credentials

2. **Check OAuth 2.0 Client ID**

   - Click on your OAuth client
   - Verify "Authorized redirect URIs" includes:
     ```
     https://sako-or.vercel.app/api/google-drive/callback
     ```

3. **Check OAuth Consent Screen**
   - Go to "OAuth consent screen"
   - Make sure it's configured (even for testing)

## Step 5: Check Vercel Logs

1. **Go to Vercel Dashboard**

   - Select your project
   - Go to "Functions" tab
   - Look for recent function logs

2. **Look for Error Messages**
   - Check logs for `/api/google-drive/auth-url`
   - Look for the debug information we added

## Step 6: Test Different Scenarios

### Test 1: Debug Endpoint

```
GET https://sako-or.vercel.app/api/google-drive/debug
```

### Test 2: Auth Test Endpoint

```
GET https://sako-or.vercel.app/api/google-drive/test-auth
```

### Test 3: Original Auth URL

```
GET https://sako-or.vercel.app/api/google-drive/auth-url
```

## Common Solutions

### If Environment Variables Still Not Loading:

1. **Double-check Vercel Setup:**

   - Go to Settings → Environment Variables
   - Make sure variables are there and set for "Production"
   - Delete and re-add them if needed

2. **Force Redeploy:**

   - Go to Deployments
   - Click "Redeploy" on latest deployment
   - Or push a new commit to trigger redeploy

3. **Check Variable Values:**
   - Make sure Client ID starts with numbers
   - Make sure Client Secret is a long string
   - No extra spaces or quotes

### If OAuth Client Issues:

1. **Check Google Cloud Console:**

   - Make sure Google Drive API is enabled
   - Verify OAuth consent screen is configured
   - Check redirect URIs are correct

2. **Test with Different Client:**
   - Create a new OAuth client in Google Cloud Console
   - Use the new credentials

## Debugging Checklist

- [ ] Environment variables set in Vercel for Production
- [ ] Application redeployed after adding variables
- [ ] Debug endpoint shows variables are loaded
- [ ] Test auth endpoint works
- [ ] Google Cloud Console has correct redirect URI
- [ ] Google Drive API is enabled
- [ ] OAuth consent screen is configured

## Next Steps

1. **Check the debug endpoint first** - this will tell us if variables are loaded
2. **Check the test auth endpoint** - this will show us exactly where the problem is
3. **Share the results** - let me know what both endpoints return

## If Still Not Working

If both endpoints still show errors, the issue might be:

1. **Vercel caching** - try a hard refresh or wait a few minutes
2. **Wrong Google Cloud project** - make sure you're using the right project
3. **API not enabled** - make sure Google Drive API is enabled in Google Cloud Console
4. **OAuth consent screen** - make sure it's properly configured

Let me know what the debug and test endpoints show, and I'll help you identify the exact issue!
