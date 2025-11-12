'use client'

import React from 'react'
import WhatsAppButton from 'react-whatsapp-button'

const PHONE_NUMBER = '539648328'
const COUNTRY_CODE = '972'

export default function FloatingWhatsAppButton() {
  const button = (
    <WhatsAppButton
      phoneNumber={PHONE_NUMBER}
      countryCode={COUNTRY_CODE}
    />
  )

  return React.cloneElement(button, {
    'aria-label': 'Chat with Sako Or on WhatsApp',
    title: 'Chat with Sako Or on WhatsApp'
  })
}

