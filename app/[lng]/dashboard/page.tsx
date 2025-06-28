'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import ClientLayout from '@/app/components/ClientLayout'
import Dashboard from '@/entities/Pages/Dashboard'

export default function DashboardPage() {
  const params = useParams()
  const lng = params.lng as string

  return (
    <ClientLayout lng={lng}>
      <Dashboard />
    </ClientLayout>
  )
} 