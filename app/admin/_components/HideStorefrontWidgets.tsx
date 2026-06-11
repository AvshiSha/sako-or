'use client'

import { useEffect } from 'react'

const BODY_CLASS = 'admin-panel'

export default function HideStorefrontWidgets() {
  useEffect(() => {
    document.body.classList.add(BODY_CLASS)
    return () => document.body.classList.remove(BODY_CLASS)
  }, [])

  return null
}
