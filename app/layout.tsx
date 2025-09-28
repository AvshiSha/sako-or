import './globals.css'
import { Inter } from 'next/font/google'
import ClientAuthProvider from './components/ClientAuthProvider'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin'] })

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
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
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
