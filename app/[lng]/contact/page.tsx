'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Contact Us',
    subtitle: 'Get in touch with our team',
    description: 'We\'d love to hear from you. Send us a message and we\'ll respond as soon as possible.',
    
    form: {
      name: 'Full Name',
      namePlaceholder: 'Enter your full name',
      email: 'Email Address',
      emailPlaceholder: 'Enter your email address',
      subject: 'Subject',
      subjectPlaceholder: 'What is this about?',
      message: 'Message',
      messagePlaceholder: 'Tell us how we can help you...',
      submit: 'Send Message',
      submitting: 'Sending...',
      success: 'Thank you! Your message has been sent successfully.',
      error: 'Sorry, there was an error sending your message. Please try again.'
    },
    
    contactInfo: {
      title: 'Contact Information',
      address: '51 Rothchild Street, Rishon-Lezion, Israel',
      phone: '+972-50-123-4567',
      email: 'info@sako-or.com',
      hours: 'Sunday - Thursday: 9:00 AM - 20:00 PM\nFriday: 9:00 AM - 15:00 PM\nSaturday: Closed'
    },
    
    backToHome: 'Back to Home'
  },
  he: {
    title: 'צור קשר',
    subtitle: 'התקשר עם הצוות שלנו',
    description: 'נשמח לשמוע מכם. שלחו לנו הודעה ונחזור אליכם בהקדם האפשרי.',
    
    form: {
      name: 'שם מלא',
      namePlaceholder: 'הזן את שמך המלא',
      email: 'כתובת אימייל',
      emailPlaceholder: 'הזן את כתובת האימייל שלך',
      subject: 'נושא',
      subjectPlaceholder: 'על מה זה?',
      message: 'הודעה',
      messagePlaceholder: 'ספרו לנו איך אנחנו יכולים לעזור לכם...',
      submit: 'שלח הודעה',
      submitting: 'שולח...',
      success: 'תודה! ההודעה שלכם נשלחה בהצלחה.',
      error: 'מצטערים, הייתה שגיאה בשליחת ההודעה. אנא נסו שוב.'
    },
    
    contactInfo: {
      title: 'פרטי יצירת קשר',
      address: 'רחוב רוטשילד 51, ראשון לציון, ישראל',
      phone: '08-9408848',
      email: 'info@sako-or.com',
      hours: 'יום ראשון - חמישי: 9:00 - 20:00\nשישי: 9:00 - 15:00\nשבת: סגור'
    },
    
    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function ContactPage({ params }: { params: Promise<{ lng: string }> }) {
  const [lng, setLng] = React.useState<string>('en')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  // Initialize language from params
  React.useEffect(() => {
    params.then(({ lng: language }) => {
      setLng(language)
    })
  }, [params])
  
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    
    try {
      // Simulate form submission (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSubmitStatus('success')
      setFormData({ name: '', email: '', subject: '', message: '' })
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`bg-white pt-16 min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link 
            href={`/${lng}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t.backToHome}
          </Link>
          
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            {t.title}
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            {t.subtitle}
          </p>
          <p className="text-gray-500 max-w-2xl">
            {t.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t.form.name}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={t.form.namePlaceholder}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t.form.email}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t.form.emailPlaceholder}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  {t.form.subject}
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder={t.form.subjectPlaceholder}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  {t.form.message}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder={t.form.messagePlaceholder}
                  required
                  disabled={isSubmitting}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-900 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-vertical placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-md hover:bg-gray-800 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t.form.submitting : t.form.submit}
              </button>

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">
                    {t.form.success}
                  </p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">
                    {t.form.error}
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-light text-gray-900 mb-8">
              {t.contactInfo.title}
            </h2>

            <div className="space-y-6">
              {/* Address */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <MapPin className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Address</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {t.contactInfo.address}
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Phone className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Phone</h3>
                  <a 
                    href={`tel:${t.contactInfo.phone}`}
                    className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  >
                    {t.contactInfo.phone}
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Mail className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Email</h3>
                  <a 
                    href={`mailto:${t.contactInfo.email}`}
                    className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  >
                    {t.contactInfo.email}
                  </a>
                </div>
              </div>

              {/* Hours */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Business Hours</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                    {t.contactInfo.hours}
                  </p>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="mt-8">
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 text-sm">
                  {isRTL ? 'מפה תגיע בקרוב' : 'Map coming soon'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
