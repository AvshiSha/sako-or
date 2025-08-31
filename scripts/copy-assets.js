const fs = require('fs');
const path = require('path');

// Copy assets folder from public to build/public/assets
const sourceDir = path.join(__dirname, '../public/assets');
const targetDir1 = path.join(__dirname, '../build/public/assets');
const targetDir2 = path.join(__dirname, '../build/assets');

// Create target directories if they don't exist
if (!fs.existsSync(targetDir1)) {
  fs.mkdirSync(targetDir1, { recursive: true });
}
if (!fs.existsSync(targetDir2)) {
  fs.mkdirSync(targetDir2, { recursive: true });
}

// Copy files recursively
function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  // Copy to both locations
  copyRecursive(sourceDir, targetDir1);
  copyRecursive(sourceDir, targetDir2);
  console.log('✅ Assets copied successfully to build/public/assets/ and build/assets/');
} catch (error) {
  console.error('❌ Error copying assets:', error);
  process.exit(1);
}
