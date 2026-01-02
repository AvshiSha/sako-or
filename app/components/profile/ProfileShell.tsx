'use client'

import React from 'react'
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
          <div className={profileTheme.header}>
            <div className={profileTheme.avatar} aria-hidden="true">
              <div className="h-9 w-9 rounded-full bg-slate-200" />
            </div>
            <div>
              <h1 className={profileTheme.title}>{title}</h1>
              {subtitle ? <p className={profileTheme.subtitle}>{subtitle}</p> : null}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}


