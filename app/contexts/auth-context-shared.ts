'use client'

import { createContext } from 'react'
import type { User } from 'firebase/auth'

export interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  adminCheckPending: boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
