'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { campaignService, Campaign } from '@/lib/firebase'
import SuccessMessage from '@/app/components/SuccessMessage'

function CampaignsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaigns()
    
    // Check for success message in URL
    if (searchParams) {
      const success = searchParams.get('success')
      if (success) {
        setSuccessMessage(decodeURIComponent(success))
        setShowSuccess(true)
        // Clean up URL
        window.history.replaceState({}, '', '/admin/campaigns')
      }
    }
  }, [searchParams])

  const fetchCampaigns = async () => {
    try {
      const campaignsData = await campaignService.getAllCampaigns()
      setCampaigns(campaignsData)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (slug: string, currentActive: boolean) => {
    setTogglingCampaign(slug)
    try {
      await campaignService.toggleCampaignActive(slug, !currentActive)
      
      // Update local state
      setCampaigns(campaigns.map(c => 
        c.slug === slug ? { ...c, active: !currentActive } : c
      ))
      
      // Check if multiple campaigns are now active
      const activeCount = campaigns.filter(c => 
        c.slug === slug ? !currentActive : c.active
      ).length
      
      if (!currentActive && activeCount > 1) {
        setSuccessMessage(`Note: There are ${activeCount} active campaigns now.`)
        setShowSuccess(true)
      } else {
        setSuccessMessage(`Campaign ${!currentActive ? 'activated' : 'deactivated'} successfully!`)
        setShowSuccess(true)
      }
    } catch (error) {
      console.error('Error toggling campaign:', error)
      alert('Failed to update campaign status')
    } finally {
      setTogglingCampaign(null)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return

    try {
      await campaignService.deleteCampaign(slug)
      setCampaigns(campaigns.filter(c => c.slug !== slug))
      setSuccessMessage('Campaign deleted successfully!')
      setShowSuccess(true)
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert('Failed to delete campaign')
    }
  }

  const getCampaignStatus = (campaign: Campaign): { label: string; color: string; icon: any } => {
    const now = new Date()
    const startAt = campaign.startAt ? new Date(campaign.startAt) : null
    const endAt = campaign.endAt ? new Date(campaign.endAt) : null

    if (!campaign.active) {
      return { label: 'Inactive', color: 'text-gray-500', icon: XCircleIcon }
    }

    if (startAt && now < startAt) {
      return { label: 'Scheduled', color: 'text-blue-500', icon: ClockIcon }
    }

    if (endAt && now > endAt) {
      return { label: 'Expired', color: 'text-red-500', icon: XCircleIcon }
    }

    return { label: 'Active', color: 'text-green-500', icon: CheckCircleSolidIcon }
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Invalid date'
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const titleEn = campaign.title?.en || ''
    const titleHe = campaign.title?.he || ''
    const matchesSearch = 
      campaign.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      titleEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      titleHe.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'active' && campaign.active) ||
      (filter === 'inactive' && !campaign.active)

    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Success Message */}
      {showSuccess && (
        <SuccessMessage
          message={successMessage}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage promotional campaigns and landing pages
              </p>
            </div>
            <div className="flex gap-2 justify-end ml-auto mr-2">
              <Link
                href="/admin"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Dashboard
              </Link>
            </div>
            <Link
              href="/admin/campaigns/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Campaign
            </Link>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by slug or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'all'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'active'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'inactive'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <TicketIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filter !== 'all'
                  ? 'No campaigns match your filters.'
                  : 'Get started by creating a new campaign.'}
              </p>
              {!searchTerm && filter === 'all' && (
                <div className="mt-6">
                  <Link
                    href="/admin/campaigns/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Campaign
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filter Mode
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCampaigns.map((campaign) => {
                    const status = getCampaignStatus(campaign)
                    const StatusIcon = status.icon
                    return (
                      <tr key={campaign.slug} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {campaign.title?.en || campaign.title?.he || 'Untitled'}
                          </div>
                          {campaign.subtitle && (
                            <div className="text-sm text-gray-500">
                              {campaign.subtitle.en || campaign.subtitle.he}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">
                            {campaign.slug}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <StatusIcon className={`h-5 w-5 ${status.color} mr-2`} />
                            <span className={`text-sm ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(campaign.slug, campaign.active)}
                            disabled={togglingCampaign === campaign.slug}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              campaign.active ? 'bg-indigo-600' : 'bg-gray-200'
                            } ${togglingCampaign === campaign.slug ? 'opacity-50' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                campaign.active ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(campaign.startAt)} - {formatDate(campaign.endAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {campaign.priority}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 capitalize">
                            {campaign.productFilter?.mode || 'N/A'}
                            {campaign.productFilter?.mode === 'tag' && campaign.productFilter?.tag && (
                              <span className="text-gray-500 ml-1">
                                ({campaign.productFilter.tag})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/en/collection/campaign?slug=${campaign.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Preview (EN)"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </Link>
                            <Link
                              href={`/admin/campaigns/${campaign.slug}`}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(campaign.slug)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignsPage() {
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
        <CampaignsPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}

