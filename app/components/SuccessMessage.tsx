'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface SuccessMessageProps {
  message: string
  onClose?: () => void
  autoHide?: boolean
  duration?: number
}

export default function SuccessMessage({ 
  message, 
  onClose, 
  autoHide = true, 
  duration = 5000 
}: SuccessMessageProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [autoHide, duration, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <CheckCircleIcon className="h-5 w-5 text-green-400" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-green-800">
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => {
                setIsVisible(false)
                onClose?.()
              }}
              className="inline-flex text-green-400 hover:text-green-600 focus:outline-none"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 