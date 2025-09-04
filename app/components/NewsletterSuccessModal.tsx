'use client'

import { useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface NewsletterSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  lng: string
}

const translations = {
  en: {
    successTitle: 'Welcome to our newsletter!',
    successMessage: 'Thank you for subscribing. You\'ll receive exclusive updates and early access to new collections.',
    closeButton: 'Close'
  },
  he: {
    successTitle: 'ברוכים הבאים לניוזלטר שלנו!',
    successMessage: 'תודה על ההרשמה. תקבלו עדכונים בלעדיים וגישה מוקדמת לקולקציות חדשות.',
    closeButton: 'סגור'
  }
}

export default function NewsletterSuccessModal({ isOpen, onClose, email, lng }: NewsletterSuccessModalProps) {
  const t = translations[lng as keyof typeof translations]
  const isRTL = lng === 'he'

  // Auto-close after 5 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all duration-300 ease-out ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } ${isRTL ? 'text-right' : 'text-left'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
          aria-label={t.closeButton}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Success icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Title */}
          <h2 
            id="success-title"
            className="text-xl font-semibold text-gray-900 mb-2 text-center"
          >
            {t.successTitle}
          </h2>

          {/* Email confirmation */}
          <p className="text-sm text-gray-600 mb-4 text-center">
            <span className="font-medium">{email}</span>
          </p>

          {/* Message */}
          <p className="text-gray-600 mb-6 text-center leading-relaxed">
            {t.successMessage}
          </p>

          {/* Close button */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              {t.closeButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
