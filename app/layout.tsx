import './globals.css'
import { Assistant } from 'next/font/google'  
import ClientAuthProvider from './components/ClientAuthProvider'
import WhatsAppButton from './components/WhatsAppButton'
import FacebookPixel from './components/FacebookPixel'
import CookieConsent from './components/CookieConsent'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'

const assistant = Assistant({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "SAKO OR",
  description: "SAKO OR",
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
  // Get the accessibility key at build time (server-side)
  const accessibilityKey = process.env.NEXT_PUBLIC_ACCESSIBILITY_KEY || '';
  const facebookPixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
  
  return (
    <html className="light" suppressHydrationWarning>
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
      <body className={assistant.className} suppressHydrationWarning>
        {/* Strip viewport/font-scaling extension attributes before React hydrates. Extension often runs after our first strip, so we keep stripping via MutationObserver + short polling. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function stripExtensionHydrationMismatch() {
  function strip() {
    try {
      var all = document.querySelectorAll ? document.querySelectorAll('[class*="vp-"], [data-vp-has-lh], [style*="--vp-base-"], [id="_vp_speechIndicator"], ._vp_speechIndicator') : [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.classList && el.classList.contains('vp-font-scaled')) el.classList.remove('vp-font-scaled');
        if (el.removeAttribute) el.removeAttribute('data-vp-has-lh');
        if (el.style && el.style.removeProperty) {
          for (var k = el.style.length - 1; k >= 0; k--) {
            var prop = el.style[k];
            if (prop && prop.indexOf('--vp-base-') === 0) el.style.removeProperty(prop);
          }
        }
        if (el.id === '_vp_speechIndicator' || (el.classList && el.classList.contains('_vp_speechIndicator'))) {
          el.removeAttribute('id');
          if (el.classList) el.classList.remove('_vp_speechIndicator');
          el.setAttribute('hidden', 'true');
        }
      }
    } catch (e) {}
  }
  function runStripAndSchedule() {
    strip();
    if (window.__vpStripDone) return;
    window.__vpStripCount = (window.__vpStripCount || 0) + 1;
    if (window.__vpStripCount > 60) { window.__vpStripDone = true; return; }
    setTimeout(runStripAndSchedule, 50);
  }
  if (document.body) runStripAndSchedule();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runStripAndSchedule);
  } else {
    runStripAndSchedule();
  }
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var obs = new MutationObserver(function() {
      if (window.__vpStripDone) return;
      strip();
    });
    var startObs = function() {
      if (!document.body || window.__vpStripObserving) return;
      window.__vpStripObserving = true;
      obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-vp-has-lh', 'id', 'hidden'], subtree: true, childList: true });
      setTimeout(function() { try { obs.disconnect(); } catch (e) {} }, 2500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObs);
    else startObs();
  }
})();
            `.trim(),
          }}
        />
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
        
        {/* Facebook Pixel (noscript) */}
        {facebookPixelId && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${facebookPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        {/* End Facebook Pixel (noscript) */}
        <ClientAuthProvider>
          <FacebookPixel />
          <CookieConsent />
          {children}
          <WhatsAppButton />
        </ClientAuthProvider>
        
        {/* Accessibility */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.args = {
	sitekey   : ` + JSON.stringify(accessibilityKey) + `,
	position  : 'Left',
	container : '',
	icon : '',
	access : 'https://vee-crm.com',
	styles : {
		primary_color: '#856D55',
		secondary_color: '#b586ff',
		background_color: '#856D55',
		primary_text_color: '#636363',
		headers_text_color: '#105675',
		primary_font_size: 14,
		slider_left_color:  '#b586ff',
		slider_right_color:  '#177fab',
		icon_vertical_position: 'bottom',
		icon_offset_top: 0,
		icon_offset_bottom: 90,
		highlight_focus_color: '#177fab',
		toggler_icon_color: '#ffffff',
	},
	links : {
		acc_policy: '',
		additional_link: 'https://vee.co.il/pricing/'
	},
	options : {
		open: false,
		aaa: false,
		hide_tablet: false,
		hide_mobile: false,
		button_size_tablet: 44,
		button_size_mobile: 34,
		position_tablet: 'Left',
		position_mobile: 'Left',
		icon_vertical_position_tablet: 'bottom',
		icon_vertical_position_mobile: 'bottom',
		icon_offset_top_tablet: 0,
		icon_offset_bottom_tablet: 60,
		icon_offset_top_mobile: 0,
		icon_offset_bottom_mobile: 120,
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
        
        <Analytics mode="production" />
      </body>
    </html>
  )

  
}
