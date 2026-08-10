'use client'

import ProtectedRoute from '@/app/components/ProtectedRoute'
import CampaignForm from '../_components/CampaignForm'

export default function NewCampaignPage() {
  return (
    <ProtectedRoute>
      <CampaignForm isEdit={false} />
    </ProtectedRoute>
  )
}

