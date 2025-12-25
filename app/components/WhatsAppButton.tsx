'use client'

import { FaWhatsapp } from 'react-icons/fa'
import { usePathname } from 'next/navigation'

export default function WhatsAppButton() {
  const phoneNumber = '+972504487979'
  const pathname = usePathname()
  
  // Detect language from URL path
  const isHebrew = pathname?.startsWith('/he')
  const defaultMessage = isHebrew 
    ? 'היי, אשמח לעזרה' 
    : 'Hi, I would like to talk with you'
  
  const encodedMessage = encodeURIComponent(defaultMessage)
  const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
      aria-label="Contact us on WhatsApp"
    >
      <FaWhatsapp className="w-6 h-6 md:w-7 md:h-7" />
      <span className="sr-only">WhatsApp</span>
    </a>
  )
}

