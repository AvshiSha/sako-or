'use client'

import { useState } from 'react'
import { Checkbox } from './ProfileFormFields'
import { profileTheme } from './profileTheme'
import { useToast } from '@/app/components/Toast'

interface NewsletterSubscriptionBlockProps {
  isNewsletter: boolean
  onUpdate: (value: boolean) => Promise<void>
  disabled?: boolean
  translations: {
    newsletterSubscription: string
    newsletterDescription: string
    unableToSaveProfile: string
  }
  showAsSection?: boolean
}

export default function NewsletterSubscriptionBlock({
  isNewsletter: initialIsNewsletter,
  onUpdate,
  disabled = false,
  translations: t,
  showAsSection = true
}: NewsletterSubscriptionBlockProps) {
  const [isNewsletter, setIsNewsletter] = useState(initialIsNewsletter)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const handleChange = async (value: boolean) => {
    setIsNewsletter(value)
    setSaving(true)
    try {
      await onUpdate(value)
    } catch (e: any) {
      // Revert on error
      setIsNewsletter(!value)
      showToast(e?.message || t.unableToSaveProfile, 'error')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <Checkbox
      checked={isNewsletter}
      onChange={handleChange}
      disabled={disabled || saving}
      label={t.newsletterSubscription}
      description={t.newsletterDescription}
    />
  )

  if (!showAsSection) {
    return content
  }

  return (
    <div className={profileTheme.section}>
      <div className="pt-4 border-t border-gray-200">
        {content}
      </div>
    </div>
  )
}

