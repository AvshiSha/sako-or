'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { profileTheme } from './profileTheme'

type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function ProfileShell({ title, subtitle, children }: Props) {
  return (
    <div className={profileTheme.pageBg}>
      <div className={profileTheme.shell}>
        <div className={profileTheme.card}>
          <div className={cn(profileTheme.header, "flex flex-col items-center justify-center")}>
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="h-20 w-40 relative flex-shrink-0">
                <Image
                  src="/images/logo/sako-logo.png"
                  alt="Sako Logo"
                  width={200}
                  height={200}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="text-center">
                <h1 className={profileTheme.title}>{title}</h1>
                {subtitle ? <p className={profileTheme.subtitle}>{subtitle}</p> : null}
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}


