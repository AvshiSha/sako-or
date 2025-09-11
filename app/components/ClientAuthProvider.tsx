'use client'

import { AuthProvider } from '@/app/contexts/AuthContext'

export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>
}
