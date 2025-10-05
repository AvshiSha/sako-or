'use client'

import { useEffect } from 'react'

export default function AccessibilityWidget() {
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return

    // Function to detect current language from URL
    function getCurrentLanguage() {
      const path = window.location.pathname
      const pathSegments = path.split('/').filter(segment => segment)
      
      // Check if first segment is a language code
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0]
        if (firstSegment === 'he') {
          return 'HE'
        } else if (firstSegment === 'en') {
          return 'EN'
        }
      }
      
      // Default to Hebrew if no language detected (for root pages)
      return 'HE'
    }

    function getCurrentAccessibilityLanguagePage() {
      const path = window.location.pathname
      const pathSegments = path.split('/').filter(segment => segment)
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0]
        if (firstSegment === 'he') {
          return 'https://sako-or.com/he/accessibility'
        } else if (firstSegment === 'en') {
          return 'https://sako-or.com/en/accessibility'
        }
      }
      return 'https://sako-or.com/he/accessibility'
    }

    // Initialize accessibility with dynamic language
    (window as any).args = {
      sitekey: '${process.env.ACCESSIBILITY_KEY}',
      position: 'Left',
      language: getCurrentLanguage(),
      container: '',
      icon: '',
      access: 'https://vee-crm.com',
      styles: {
        primary_color: '#177fab',
        secondary_color: '#b586ff',
        background_color: '#f6f6f6',
        primary_text_color: '#636363',
        headers_text_color: '#105675',
        primary_font_size: 14,
        slider_left_color: '#b586ff',
        slider_right_color: '#177fab',
        icon_vertical_position: 'top',
        icon_offset_top: 100,
        icon_offset_bottom: 0,
        highlight_focus_color: '#177fab',
        toggler_icon_color: '#ffffff',
      },
      links: {
        acc_policy: getCurrentAccessibilityLanguagePage(),
        additional_link: 'https://vee.co.il/pricing/'
      },
      options: {
        open: false,
        aaa: false,
        hide_tablet: false,
        hide_mobile: false,
        button_size_tablet: 44,
        button_size_mobile: 34,
        position_tablet: 'Right',
        position_mobile: 'Right',
        icon_vertical_position_tablet: 'top',
        icon_vertical_position_mobile: 'top',
        icon_offset_top_tablet: 100,
        icon_offset_bottom_tablet: 0,
        icon_offset_top_mobile: 100,
        icon_offset_bottom_mobile: 0,
        keyboard_shortcut: true,
        hide_purchase_link: false,
        display_checkmark_icon: false,
        active_toggler_color: '#118f38'
      },
      exclude: []
    }

    // Load the accessibility script
    const script = document.createElement('script')
    script.src = (window as any).args.access + '/js/'
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.setAttribute('data-cfasync', 'true')
    document.body.appendChild(script)

    // Cleanup function
    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  return null // This component doesn't render anything
}
