# Sako OR E-commerce Platform

A modern, multilingual e-commerce platform built with Next.js, Firebase, and TypeScript.

## Features

- 🌐 Multilingual support (English/Hebrew)
- 🛍️ Product catalog with color variants
- 🛒 Shopping cart and favorites
- 📱 Responsive design
- 🔐 Admin dashboard
- 🚀 Firebase integration

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env.local` file with your Firebase configuration:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Project Structure

```
app/
├── [lng]/           # Internationalized routes
├── admin/           # Admin dashboard
├── api/             # API routes
├── components/      # Reusable components
└── contexts/        # React contexts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.
