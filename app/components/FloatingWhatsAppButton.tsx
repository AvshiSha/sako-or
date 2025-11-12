import { MessageCircle } from 'lucide-react'

const WHATSAPP_NUMBER = '972539648328'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`

export default function FloatingWhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Sako Or on WhatsApp"
      className="fixed bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 z-50"
    >
      <MessageCircle className="h-7 w-7 sm:h-6 sm:w-6" strokeWidth={2.5} />
      <span className="sr-only">Open WhatsApp chat</span>
    </a>
  )
}

