import './globals.css'
import { Assistant } from 'next/font/google'  
import ClientAuthProvider from './components/ClientAuthProvider'
import WhatsAppButton from './components/WhatsAppButton'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'

const assistant = Assistant({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Sako Or",
  description: "Sako Or",
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
    shortcut: '/favicon.ico',
  }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html className="light">
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T6QKL299');`
          }}
        />
        {/* End Google Tag Manager */}
        
        {/* Cloudflare Turnstile */}
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        ></script>
        {/* End Cloudflare Turnstile */}
        
      </head>
      <body className={assistant.className} suppressHydrationWarning={true}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe 
            src="https://www.googletagmanager.com/ns.html?id=GTM-T6QKL299"
            height="0" 
            width="0" 
            style={{display:'none',visibility:'hidden'}}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <ClientAuthProvider>
          {children}
          <WhatsAppButton />
        </ClientAuthProvider>
        
        {/* Accessibility */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
// Function to detect current language from URL
function getCurrentLanguage() {
  const path = window.location.pathname;
  const pathSegments = path.split('/').filter(segment => segment);
  
  // Check if first segment is a language code
  if (pathSegments.length > 0) {
    const firstSegment = pathSegments[0];
    if (firstSegment === 'he') {
      return 'HE';
    } else if (firstSegment === 'en') {
      return 'EN';
    }
  }
  
  // Default to Hebrew if no language detected (for root pages)
  return 'HE';
}

function getCurrentAccessibilityLanguagePage() {
  const path = window.location.pathname;
  const pathSegments = path.split('/').filter(segment => segment);
  if (pathSegments.length > 0) {
    const firstSegment = pathSegments[0];
    if (firstSegment === 'he') {
      return 'https://sako-or.com/he/accessibility';
    } else if (firstSegment === 'en') {
      return 'https://sako-or.com/en/accessibility';
    }
  }
  return 'https://sako-or.com/he/accessibility';
}

// Wait for React hydration to complete before initializing accessibility
function initializeAccessibility() {
	try {
		// Get sitekey from environment variable (must be NEXT_PUBLIC_ prefixed)
		const sitekey = '${process.env.NEXT_PUBLIC_ACCESSIBILITY_KEY || ''}';
		
		// Check if sitekey is provided
		if (!sitekey || sitekey.trim() === '') {
			console.warn('Accessibility widget: ACCESSIBILITY_KEY is not set. Widget will not be initialized.');
			return;
		}
		
		// Initialize accessibility with dynamic language
		window.args = {
		sitekey   : sitekey,
		position  : 'Right',
		language : getCurrentLanguage(),
		container : '',
		icon : '',
		access : 'https://vee-crm.com',
		styles : {
			primary_color: '#177fab',
			secondary_color: '#b586ff',
			background_color: '#f6f6f6',
			primary_text_color: '#636363',
			headers_text_color: '#105675',
			primary_font_size: 14,
			slider_left_color:  '#b586ff',
			slider_right_color:  '#177fab',
			icon_vertical_position: 'top',
			icon_offset_top: 100,
			icon_offset_bottom: 0,
			highlight_focus_color: '#177fab',
			toggler_icon_color: '#ffffff',
		},
		links : {
			acc_policy: getCurrentAccessibilityLanguagePage(),
			additional_link: 'https://vee.co.il/pricing/'
		},
		options : {
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
		exclude : []
	};

	(function(doc, head, body){
		var embed = doc.createElement('script');
		embed.src = window.args['access'] + '/js/';
		embed.defer = true;
		embed.crossOrigin = 'anonymous';
		embed.setAttribute('data-cfasync', true );
		
		// Add error handling for network issues
		embed.onerror = function() {
			console.error('Accessibility widget failed to load. This might be due to network issues, service unavailability, or invalid sitekey.');
			console.error('Sitekey used:', sitekey ? sitekey.substring(0, 10) + '...' : 'NOT SET');
		};
		
		embed.onload = function() {
			console.log('Accessibility widget script loaded successfully');
		};
		
		body? body.appendChild(embed) : head.appendChild(embed);
	})(document, document.head, document.body);
	
	} catch (error) {
		console.error('Accessibility widget initialization failed:', error.message);
		console.error('Error details:', error);
	}
}

// Add comprehensive error handling for accessibility widget and other third-party scripts
window.addEventListener('error', function(e) {
	// Log accessibility errors but don't suppress them during development
	if (e.message && (
		e.message.includes('dataset') ||
		e.message.includes('Cannot read properties of null')
	)) {
		// Only suppress dataset errors (these are harmless)
		console.warn('Third-party script error caught and handled:', e.message);
		e.preventDefault();
		return false;
	}
	// Log but don't suppress accessibility/vee errors so we can debug
	if (e.message && (
		e.message.includes('focus') || 
		e.message.includes('accessibility') || 
		e.message.includes('vee')
	)) {
		console.warn('Accessibility widget error (not suppressed for debugging):', e.message);
		// Don't prevent default - let it log normally
	}
});

// Global error handler for unhandled promise rejections that might contain dataset errors
window.addEventListener('unhandledrejection', function(e) {
	if (e.reason && (
		(e.reason.message && (
			e.reason.message.includes('dataset') ||
			e.reason.message.includes('Cannot read properties of null')
		)) ||
		(typeof e.reason === 'string' && (
			e.reason.includes('dataset') ||
			e.reason.includes('Cannot read properties of null')
		))
	)) {
		console.warn('Unhandled promise rejection caught (likely from third-party script):', e.reason);
		e.preventDefault();
	}
});

// Delay initialization to prevent hydration conflicts
setTimeout(initializeAccessibility, 2000);
            `
          }}
        />
        {/* End Accessibility */}
        
        <Analytics mode="production" />
      </body>
    </html>
  )

  
}
