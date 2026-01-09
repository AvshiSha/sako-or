'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { 
  UserIcon, 
  ShoppingBagIcon, 
  SparklesIcon, 
  HeartIcon,
  HomeIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/app/contexts/AuthContext'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetClose
} from '@/app/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ProfileNavProps {
  lng: string
  translations: {
    overview: string
    personalDetails: string
    myOrders: string
    myPoints: string
    myFavorites: string
    menu: string
    logout: string
  }
}

export default function ProfileNav({ lng, translations: t }: ProfileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isRTL = lng === 'he'

  const navItems: NavItem[] = [
    { href: `/${lng}/profile`, label: t.overview, icon: HomeIcon },
    { href: `/${lng}/profile/personal`, label: t.personalDetails, icon: UserIcon },
    { href: `/${lng}/profile/orders`, label: t.myOrders, icon: ShoppingBagIcon },
    { href: `/${lng}/profile/points`, label: t.myPoints, icon: SparklesIcon },
    { href: `/${lng}/profile/favorites`, label: t.myFavorites, icon: HeartIcon },
  ]

  const isActive = (href: string) => {
    if (href === `/${lng}/profile`) {
      return pathname === href
    }
    return pathname?.startsWith(href) || false
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push(`/${lng}/signin`)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Desktop Navigation
  const DesktopNav = () => (
    <nav className="hidden md:block md:w-64 lg:w-72 flex-shrink-0">
      <div className="sticky top-24 space-y-2">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm md:text-base ${
                active
                  ? 'bg-[#856D55] text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              } ${isRTL ? 'flex-row-reverse justify-end text-right' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm md:text-base text-gray-700 hover:bg-gray-100 ${
            isRTL ? 'flex-row-reverse justify-end text-right' : ''
          }`}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span className="font-medium">{t.logout}</span>
        </button>
      </div>
    </nav>
  )

  // Mobile Navigation
  const MobileNav = () => (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-50 bg-[#856D55] text-white p-4 rounded-full shadow-lg"
        aria-label={t.menu}
      >
        <Menu className="h-6 w-6" />
      </button>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side={isRTL ? 'right' : 'left'}
          className="w-80"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <SheetTitle className="text-lg font-semibold mb-6">
            {t.menu}
          </SheetTitle>
          
          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              
              return (
                <SheetClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-[#856D55] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </SheetClose>
              )
            })}
            
            {/* Logout Button */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false)
                handleLogout()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="font-medium">{t.logout}</span>
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )

  return (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  )
}

