const fs = require('fs');
const path = require('path');

// Copy the entire app folder to build/app
const appSourceDir = path.join(__dirname, '../app');
const appTargetDir = path.join(__dirname, '../build/app');

// Copy public folder to build/public
const publicSourceDir = path.join(__dirname, '../public');
const publicTargetDir = path.join(__dirname, '../build/public');

// Copy other important folders and files
const additionalFiles = [
  { source: '../i18n', target: '../build/i18n' },
  { source: '../lib', target: '../build/lib' },
  { source: '../components', target: '../build/components' },
  { source: '../data', target: '../build/data' },
  { source: '../globals.css', target: '../build/globals.css' },
  { source: '../i18n.ts', target: '../build/i18n.ts' }
];

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
  // Copy app folder
  if (fs.existsSync(appSourceDir)) {
    copyRecursive(appSourceDir, appTargetDir);
    console.log('✅ App folder copied successfully to build/app/');
  }

  // Copy public folder
  if (fs.existsSync(publicSourceDir)) {
    copyRecursive(publicSourceDir, publicTargetDir);
    console.log('✅ Public folder copied successfully to build/public/');
  }

  // Copy additional files and folders
  additionalFiles.forEach(({ source, target }) => {
    const sourcePath = path.join(__dirname, source);
    const targetPath = path.join(__dirname, target);
    
    if (fs.existsSync(sourcePath)) {
      if (fs.statSync(sourcePath).isDirectory()) {
        copyRecursive(sourcePath, targetPath);
      } else {
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(sourcePath, targetPath);
      }
      console.log(`✅ ${source} copied successfully to ${target}`);
    }
  });

  console.log('✅ All app files copied successfully to build/');
} catch (error) {
  console.error('❌ Error copying files:', error);
  process.exit(1);
}
