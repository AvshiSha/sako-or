'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import Dashboard from '@/entities/Pages/Dashboard'

export default function DashboardPage() {
  const params = useParams()
  
  if (!params) {
    return <div>Loading...</div>;
  }
  
  // const lng = params.lng as string

  return <Dashboard />
} 