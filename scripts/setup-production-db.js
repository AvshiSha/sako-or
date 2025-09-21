#!/usr/bin/env node

/**
 * Production Database Setup Script
 * 
 * This script sets up the production database with the correct schema.
 * Run this after setting up your PostgreSQL database URL in Vercel.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up production database...');

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log('❌ This script should only be run in production');
  process.exit(1);
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Check if DATABASE_URL is a PostgreSQL URL
if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
  console.log('❌ DATABASE_URL must be a PostgreSQL connection string');
  process.exit(1);
}

console.log('✅ Environment checks passed');

try {
  // Copy production schema to main schema
  const productionSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.production.prisma');
  const mainSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  if (fs.existsSync(productionSchemaPath)) {
    fs.copyFileSync(productionSchemaPath, mainSchemaPath);
    console.log('✅ Production schema copied');
  }

  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Run migrations
  console.log('🗄️ Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('✅ Production database setup complete!');
  
} catch (error) {
  console.error('❌ Error setting up production database:', error.message);
  process.exit(1);
}
