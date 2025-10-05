import './globals.css'
import { Assistant } from 'next/font/google'  
import ClientAuthProvider from './components/ClientAuthProvider'
import { Analytics } from '@vercel/analytics/next'

const assistant = Assistant({ subsets: ['latin'] })

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
        
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1BY36XK59X"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-1BY36XK59X');
            `
          }}
        />
        {/* End Google tag (gtag.js) */}
        
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

// Initialize accessibility with dynamic language
window.args = {
	sitekey   : 'da80490d069509de237fa1d90bd39164',
	position  : 'Left',
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
	body? body.appendChild(embed) : head.appendChild(embed);
})(document, document.head, document.body);
            `
          }}
        />
        {/* End Accessibility */}
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
        </ClientAuthProvider>
        <Analytics mode="production" />
      </body>
    </html>
  )

  
}
