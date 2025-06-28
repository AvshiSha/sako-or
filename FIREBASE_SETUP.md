# Firebase Setup Guide for Sako OR E-commerce

## Overview

This guide covers setting up Firebase for the Sako OR e-commerce platform, including Firestore database, Storage, Authentication, and Google Sheets integration.

## 1. Firebase Project Setup

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `sako-or`
4. Enable Google Analytics (optional)
5. Choose analytics account or create new one
6. Click "Create project"

### Get Configuration

1. Click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>)
5. Register app with nickname: `sako-or-web`
6. Copy the configuration object

## 2. Firestore Database Setup

### Create Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select location closest to your users
5. Click "Done"

### Security Rules

Update Firestore rules in the Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to all users
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'ADMIN';
    }

    match /categories/{categoryId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'ADMIN';
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /orders/{orderId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 3. Firebase Storage Setup

### Create Storage Bucket

1. In Firebase Console, go to "Storage"
2. Click "Get started"
3. Choose "Start in test mode" (we'll secure it later)
4. Select location closest to your users
5. Click "Done"

### Security Rules

Update Storage rules in the Firebase Console:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to all files
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'ADMIN';
    }

    // Specific rules for product images
    match /products/{imageId} {
      allow read: if true;
      allow write: if request.auth != null &&
                   request.auth.token.role == 'ADMIN' &&
                   request.resource.size < 10 * 1024 * 1024 && // 10MB max
                   request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Fix CORS Issues for Development

If you're getting CORS errors when uploading images from localhost, you need to configure CORS for your Firebase Storage bucket:

1. **Install Firebase CLI** (if not already installed):

   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:

   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:

   ```bash
   firebase init
   ```

   - Select "Storage" when prompted
   - Choose your project

4. **Create CORS configuration file** (`cors.json`):

   ```json
   [
     {
       "origin": [
         "http://localhost:3000",
         "http://localhost:3001",
         "https://your-production-domain.com"
       ],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": [
         "Content-Type",
         "Authorization",
         "Content-Length",
         "User-Agent",
         "x-goog-resumable"
       ]
     }
   ]
   ```

5. **Apply CORS configuration**:
   ```bash
   gsutil cors set cors.json gs://sako-or.firebasestorage.app
   ```

**Alternative: Quick Fix for Development**
If you want a quick fix just for development, you can temporarily allow all origins:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "User-Agent",
      "x-goog-resumable"
    ]
  }
]
```

⚠️ **Warning**: The `"*"` origin should only be used for development. For production, specify your exact domain.

## 4. Authentication Setup

### Enable Authentication Methods

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password"
5. Enable "Google" (optional)

### Create Admin User

1. Go to "Users" tab
2. Click "Add user"
3. Enter admin email and password
4. After creation, go to "Custom claims" in user details
5. Add custom claim: `{"role": "ADMIN"}`

## 5. Database Structure

### Collections

#### Products Collection

```javascript
{
  id: "auto-generated",
  name: "Product Name",
  slug: "product-slug",
  description: "Product description",
  price: 99.99,
  salePrice: 79.99, // optional
  saleStartDate: "2024-01-01", // optional
  saleEndDate: "2024-01-31", // optional
  sku: "SKU123", // optional
  stock: 100,
  featured: true,
  isNew: false,
  isActive: true,
  categoryId: "category-id",
  category: {
    id: "category-id",
    name: "Category Name",
    slug: "category-slug"
  },
  images: [
    {
      url: "https://firebasestorage.googleapis.com/...",
      alt: "Image description",
      isPrimary: true,
      order: 0,
      createdAt: "2024-01-01T00:00:00Z"
    }
  ],
  variants: [
    {
      size: "M",
      color: "Black",
      stock: 10,
      sku: "SKU123-M-BLK",
      price: 99.99
    }
  ],
  tags: ["tag1", "tag2"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

#### Categories Collection

```javascript
{
  id: "auto-generated",
  name: "Category Name",
  slug: "category-slug",
  description: "Category description", // optional
  image: "https://example.com/image.jpg", // optional
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

#### Users Collection

```javascript
{
  id: "user-uid",
  email: "user@example.com",
  name: "User Name", // optional
  role: "USER" | "ADMIN",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

## 6. Google Sheets Integration

### Setup Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Enable Google Sheets API
4. Create service account
5. Download JSON key file
6. Share your Google Sheet with the service account email

### Import Process

1. Format your Google Sheet with headers
2. Use the import functionality in the admin panel
3. Map columns to product fields
4. Import products in batches

## 7. Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
GOOGLE_SHEETS_PRIVATE_KEY=your_private_key
GOOGLE_SHEETS_CLIENT_EMAIL=your_client_email
```

## 8. Testing

### Test Authentication

1. Try logging in with admin credentials
2. Verify custom claims are working
3. Test protected routes

### Test Database Operations

1. Create a test product
2. Verify it appears in Firestore
3. Test image upload to Storage
4. Verify image URLs are accessible

### Test Google Sheets Import

1. Prepare a test sheet
2. Run import process
3. Verify products are created correctly

## 9. Deployment Considerations

### Production Security Rules

Update security rules for production:

```javascript
// Firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null &&
                   request.auth.token.role == 'ADMIN' &&
                   request.auth.token.email_verified == true;
    }
  }
}

// Storage
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{imageId} {
      allow read: if true;
      allow write: if request.auth != null &&
                   request.auth.token.role == 'ADMIN' &&
                   request.auth.token.email_verified == true &&
                   request.resource.size < 5 * 1024 * 1024 && // 5MB max
                   request.resource.contentType.matches('image/.*');
    }
  }
}
```

### CORS for Production

Update CORS configuration for your production domain:

```json
[
  {
    "origin": ["https://your-production-domain.com"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "User-Agent",
      "x-goog-resumable"
    ]
  }
]
```

## 10. Troubleshooting

### Common Issues

#### CORS Errors

- **Symptom**: "Access to XMLHttpRequest has been blocked by CORS policy"
- **Solution**: Update Firebase Storage CORS configuration (see section 3)

#### Authentication Errors

- **Symptom**: "Firebase: Error (auth/user-not-found)"
- **Solution**: Verify user exists and custom claims are set correctly

#### Storage Upload Failures

- **Symptom**: "Firebase Storage: User does not have permission"
- **Solution**: Check Storage security rules and user authentication

#### Firestore Permission Errors

- **Symptom**: "Missing or insufficient permissions"
- **Solution**: Verify Firestore security rules and user role

### Debug Steps

1. Check browser console for errors
2. Verify Firebase configuration
3. Test authentication status
4. Check security rules
5. Verify environment variables

## 11. Next Steps

1. **Set up monitoring** with Firebase Analytics
2. **Configure backups** for Firestore data
3. **Set up alerts** for critical errors
4. **Implement caching** strategies
5. **Add real-time features** with Firestore listeners
6. **Optimize performance** with pagination and indexing

## Support

For additional help:

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Community](https://firebase.google.com/community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase)
