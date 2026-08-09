'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { campaignService, Campaign } from '@/lib/firebase'
import CampaignForm from '../_components/CampaignForm'

function EditCampaignPageContent() {
  const params = useParams()
  const slug = params?.slug as string
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const data = await campaignService.getCampaignBySlug(slug)
        if (!data) {
          alert('Campaign not found')
          window.location.href = '/admin/campaigns'
          return
        }
        setCampaign(data)
      } catch (error) {
        console.error('Error fetching campaign:', error)
        alert('Failed to load campaign')
        window.location.href = '/admin/campaigns'
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchCampaign()
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign...</p>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return null
  }

  return <CampaignForm initialData={campaign} isEdit={true} />
}

export default function EditCampaignPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <EditCampaignPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}

