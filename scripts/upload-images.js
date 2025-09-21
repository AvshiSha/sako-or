const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const path = require('path');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Function to upload a file to Firebase Storage
async function uploadFile(filePath, storagePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, fileBuffer);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`✅ Uploaded: ${filePath} -> ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error(`❌ Error uploading ${filePath}:`, error);
    return null;
  }
}

// Function to recursively get all files from a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// Main upload function
async function uploadAllImages() {
  const imagesDir = path.join(__dirname, '../public/images');
  const allFiles = getAllFiles(imagesDir);
  
  console.log('🚀 Starting image upload to Firebase Storage...');
  console.log(`📁 Found ${allFiles.length} files to upload`);
  
  const uploadedUrls = {};
  
  for (const filePath of allFiles) {
    // Skip README files
    if (path.basename(filePath) === 'README.md') {
      continue;
    }
    
    // Create storage path (remove the public/images prefix)
    const relativePath = path.relative(path.join(__dirname, '../public/images'), filePath);
    const storagePath = `images/${relativePath.replace(/\\/g, '/')}`;
    
    // Upload file
    const downloadURL = await uploadFile(filePath, storagePath);
    
    if (downloadURL) {
      // Store the mapping from local path to Firebase URL
      const localPath = `/images/${relativePath.replace(/\\/g, '/')}`;
      uploadedUrls[localPath] = downloadURL;
    }
  }
  
  // Save the URL mappings to a JSON file
  const mappingsPath = path.join(__dirname, '../image-url-mappings.json');
  fs.writeFileSync(mappingsPath, JSON.stringify(uploadedUrls, null, 2));
  
  console.log('\n🎉 Upload complete!');
  console.log(`📄 URL mappings saved to: ${mappingsPath}`);
  console.log('\n📋 Uploaded URLs:');
  Object.entries(uploadedUrls).forEach(([localPath, firebaseUrl]) => {
    console.log(`${localPath} -> ${firebaseUrl}`);
  });
  
  return uploadedUrls;
}

// Run the upload
uploadAllImages().catch(console.error);
