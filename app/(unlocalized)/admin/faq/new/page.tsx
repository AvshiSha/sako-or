'use client'

import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import FaqForm from '../_components/FaqForm'

export default function NewFaqPage() {
  return (
    <div className={adminTheme.pageBg}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <FaqForm />
      </div>
    </div>
  )
}
