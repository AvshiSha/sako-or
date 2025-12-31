'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  type?: 'success' | 'error' | 'info'
  duration?: number
}

export default function Toast({ 
  message, 
  isVisible, 
  onClose, 
  type = 'success', 
  duration = 3000 
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed top-12 right-2 z-50 animate-in slide-in-from-right-full duration-300">
      <div className={`flex items-center p-4 rounded-lg shadow-lg max-w-sm ${
        type === 'success' 
          ? 'bg-green-50 border border-green-200 text-green-800' 
          : type === 'error'
          ? 'bg-red-50 border border-red-200 text-red-800'
          : 'bg-blue-50 border border-blue-200 text-blue-800'
      }`}>
        {type === 'success' && (
          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
        )}
        <span className="text-sm font-medium flex-1">{message}</span>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 p-1 rounded-md hover:bg-black hover:bg-opacity-10 transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Hook for managing toast state
export function useToast() {
  const [toast, setToast] = useState<{
    message: string
    isVisible: boolean
    type: 'success' | 'error' | 'info'
  }>({
    message: '',
    isVisible: false,
    type: 'success'
  })

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({
      message,
      isVisible: true,
      type
    })
  }

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }))
  }

  return {
    toast,
    showToast,
    hideToast
  }
}
