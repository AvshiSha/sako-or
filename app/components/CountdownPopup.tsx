'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface CountdownPopupProps {
  isOpen: boolean
  onClose: () => void
  targetDate: string // ISO 8601 format
  ctaUrl: string
  lng: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const translations = {
  en: {
    title: 'December Sales🖤',
    subtitle: '30% off on selected products',
    subsubtitle: 'with code: DEC30 — Only till Tuesday ✨',
    ctaButton: 'Shop December Sales Collection',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds'
  },
  he: {
    title: 'December Sales🖤',
    subtitle: '30% הנחה על מוצרים נבחרים',
    subsubtitle: 'עם הקוד DEC30 — עד יום שלישי בלבד!',
    ctaButton: 'לקולקציית December Sales',
    days: 'ימים',
    hours: 'שעות',
    minutes: 'דקות',
    seconds: 'שניות'
  }
}

export default function CountdownPopup({ isOpen, onClose, targetDate, ctaUrl, lng }: CountdownPopupProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isClient, setIsClient] = useState(false)
  
  const t = translations[lng as keyof typeof translations] || translations.en
  const isRTL = lng === 'he'

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !isClient) return

    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime()
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [isOpen, targetDate, isClient])

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bf_popup_seen', 'true')
    }
    onClose()
  }

  const handleCtaClick = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bf_popup_seen', 'true')
    }
    window.location.href = ctaUrl
  }

  if (!isOpen || !isClient) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleClose}
    >
      <div 
        className="relative bg-white max-w-lg w-full p-8 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-gray-500 hover:text-gray-900 transition-colors`}
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div className={`text-center ${isRTL ? 'text-right' : 'text-left'}`}>
          <h2 className={`text-3xl md:text-4xl font-light text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t.title}
          </h2>
          <p className={`text-gray-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t.subtitle}
          </p>
          {'subsubtitle' in t && (
            <p className={`text-gray-600 font-bold mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.subsubtitle}
            </p>
          )}

          {/* Countdown Timer */}
          <div className="grid grid-cols-4 gap-4 mb-8" dir="ltr">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-light text-gray-900 mb-2">
                {String(timeLeft.days).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider">
                {t.days}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-light text-gray-900 mb-2">
                {String(timeLeft.hours).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider">
                {t.hours}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-light text-gray-900 mb-2">
                {String(timeLeft.minutes).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider">
                {t.minutes}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-light text-gray-900 mb-2">
                {String(timeLeft.seconds).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider">
                {t.seconds}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleCtaClick}
            className="w-full bg-gray-900 text-white py-4 px-8 text-lg font-light tracking-wider hover:bg-gray-800 transition-all duration-300"
          >
            {t.ctaButton}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}

