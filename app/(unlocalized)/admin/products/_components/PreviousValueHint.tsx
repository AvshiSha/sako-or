'use client'

interface PreviousValueHintProps {
  legacyEn?: string
  legacyHe?: string
}

/**
 * Shown next to a converted dropdown field when it has no value yet but the
 * legacy free-text field it replaced still holds data, so admins can manually
 * reconcile it into the closed vocabulary while editing.
 */
export default function PreviousValueHint({ legacyEn, legacyHe }: PreviousValueHintProps) {
  const text = legacyHe || legacyEn
  if (!text) return null

  return <p className="mt-1 text-xs text-amber-600">Previous value: {text}</p>
}
