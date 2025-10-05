import './globals.css'
import { Assistant } from 'next/font/google'  
import ClientAuthProvider from './components/ClientAuthProvider'
import AccessibilityWidget from './components/AccessibilityWidget'
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
        <AccessibilityWidget />
        <Analytics mode="production" />
      </body>
    </html>
  )

  
}
