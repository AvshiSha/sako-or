import './globals.css'
import { Inter } from 'next/font/google'
import ClientAuthProvider from './components/ClientAuthProvider'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html className="light">
      <body className={inter.className}>
        <ClientAuthProvider>
          {children}
        </ClientAuthProvider>
      </body>
    </html>
  )
}
