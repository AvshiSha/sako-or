'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import Dashboard from '@/entities/Pages/Dashboard'

export default function DashboardPage() {
  const params = useParams()
  const lng = params.lng as string

  return <Dashboard />
} 