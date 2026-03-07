'use client'

import React, { createContext, useContext, useState } from 'react'

interface PromoContextType {
  countdownVisible: boolean
  setCountdownVisible: (v: boolean) => void
}

const PromoContext = createContext<PromoContextType | undefined>(undefined)

export function PromoProvider({ children }: { children: React.ReactNode }) {
  const [countdownVisible, setCountdownVisible] = useState(false)
  return (
    <PromoContext.Provider value={{ countdownVisible, setCountdownVisible }}>
      {children}
    </PromoContext.Provider>
  )
}

export function usePromo() {
  const context = useContext(PromoContext)
  if (context === undefined) {
    throw new Error('usePromo must be used within a PromoProvider')
  }
  return context
}
