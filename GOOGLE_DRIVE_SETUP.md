# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for your admin panel, allowing you to import product images directly from Google Drive.

## Prerequisites

- Google Cloud Console account
- Firebase project (already set up)
- Admin access to your e-commerce platform

## Step 1: Google Cloud Console Setup

### 1.1 Create a New Project or Use Existing

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing Firebase project
3. Note down your Project ID

### 1.2 Enable Google Drive API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/google-drive/callback` (for development)
   - `https://yourdomain.com/api/google-drive/callback` (for production)
5. Click "Create"
6. Download the JSON file and note the Client ID and Client Secret

## Step 2: Environment Variables

Add these variables to your `.env.local` file:

```env
# Google Drive API Configuration
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# For production, also add:
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/google-drive/callback

# Optional: For server-side operations (if needed)
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

## Step 3: OAuth Scopes

The integration uses these Google Drive scopes:

- `https://www.googleapis.com/auth/drive.readonly` - Read access to files
- `https://www.googleapis.com/auth/drive.file` - Access to files created by the app

## Step 4: Testing the Integration

### 4.1 Start the Development Server

```bash
npm run dev
```

### 4.2 Test the Integration

1. Go to `/admin/products/new`
2. Create a new product with color variants
3. In the image upload section, click "Import from Google Drive"
4. Authenticate with your Google account
5. Select images from your Google Drive
6. Verify that images are imported correctly

## Step 5: Production Deployment

### 5.1 Update Redirect URIs

1. In Google Cloud Console, update the OAuth 2.0 credentials
2. Add your production domain to authorized redirect URIs
3. Update the environment variables in your production environment

### 5.2 Security Considerations

- Store OAuth tokens securely (consider using a database)
- Implement proper token refresh logic
- Add rate limiting to prevent abuse
- Consider implementing user-specific access controls

## Features

### What You Can Do

✅ **Browse Google Drive folders** - Navigate through your Google Drive folder structure
✅ **Search for images** - Search for specific images by name
✅ **Select multiple images** - Choose multiple images at once
✅ **Preview images** - See thumbnails before importing
✅ **Import directly** - Images are automatically converted and added to your product

### Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)
- TIFF (.tiff)

## Troubleshooting

### Common Issues

1. **"Not authenticated with Google Drive"**

   - Make sure you've completed the OAuth flow
   - Check that your environment variables are set correctly

2. **"Failed to load files from Google Drive"**

   - Verify that the Google Drive API is enabled
   - Check your OAuth credentials

3. **Images not importing**
   - Ensure the files are actually images
   - Check browser console for error messages
   - Verify file permissions in Google Drive

### Debug Mode

To enable debug logging, add this to your environment variables:

```env
NODE_ENV=development
```

## API Endpoints

The integration creates these API endpoints:

- `GET /api/google-drive/auth-url` - Get OAuth authorization URL
- `GET /api/google-drive/callback` - Handle OAuth callback
- `GET /api/google-drive/auth-status` - Check authentication status
- `GET /api/google-drive/files` - List files in a folder
- `GET /api/google-drive/search` - Search for files
- `POST /api/google-drive/download` - Download selected files

## Security Notes

- OAuth tokens should be stored securely
- Consider implementing token refresh logic
- Add proper error handling and logging
- Implement rate limiting for API calls

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify your Google Cloud Console setup
3. Ensure all environment variables are set correctly
4. Check that the Google Drive API is enabled

## Next Steps

After successful setup, you can:

1. **Customize the UI** - Modify the Google Drive picker component to match your brand
2. **Add batch operations** - Implement bulk image import features
3. **Add image processing** - Automatically resize or optimize imported images
4. **Add folder organization** - Create specific folders for different product types
5. **Add user management** - Allow different users to access different Google Drive folders
