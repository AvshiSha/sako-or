'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/lib/firebase'
import { profileTheme } from '@/app/components/profile/profileTheme'

const translations = {
  en: {
    title: 'Reset Password',
    subtitle: 'Enter your new password',
    newPassword: 'New Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter new password',
    resetPassword: 'Reset Password',
    working: 'Working…',
    invalidLink: 'This reset link is no longer valid',
    invalidLinkMessage:
      'Password reset links can only be used once. If you already reset your password, you can sign in now. Otherwise, request a new link.',
    requestNewLink: 'Request New Link',
    goToSignIn: 'Go to Sign In',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    verifying: 'Verifying reset link…',
    redirectingToSignIn: 'Redirecting to sign in…'
  },
  he: {
    title: 'איפוס סיסמה',
    subtitle: 'הזינו את הסיסמה החדשה שלכם',
    newPassword: 'סיסמה חדשה',
    newPasswordPlaceholder: 'הזינו סיסמה חדשה',
    confirmPassword: 'אימות סיסמה',
    confirmPasswordPlaceholder: 'הזינו שוב את הסיסמה',
    resetPassword: 'איפוס סיסמה',
    working: 'רגע…',
    invalidLink: 'הקישור לאיפוס כבר לא תקף',
    invalidLinkMessage:
      'קישורי איפוס סיסמה תקפים לשימוש חד-פעמי. אם כבר איפסתם את הסיסמה — תוכלו להתחבר עכשיו. אחרת, בקשו קישור חדש.',
    requestNewLink: 'בקשת קישור חדש',
    goToSignIn: 'מעבר להתחברות',
    passwordMismatch: 'הסיסמאות אינן תואמות',
    passwordTooShort: 'הסיסמה חייבת להכיל לפחות 6 תווים',
    verifying: 'מאמת קישור איפוס…',
    redirectingToSignIn: 'מעביר להתחברות…'
  }
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordClient />
    </Suspense>
  )
}

function ResetPasswordLoading() {
  return (
    <div className={profileTheme.pageBg}>
      <div className="mx-auto w-full max-w-md px-4 pt-28 pb-12">
        <div className="flex justify-center">
          <div className="rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-8 w-full">
            <div className="flex flex-col items-center">
              <Image
                src="/images/logo/sako-logo.png"
                alt="Sako-Or"
                width={180}
                height={60}
                priority
              />
              <div className="mt-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#856D55]" />
              <div className="mt-4 text-sm font-medium text-slate-900">Loading…</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordClient() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en

  const oobCode = searchParams?.get('oobCode') || ''
  const mode = searchParams?.get('mode') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [validCode, setValidCode] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Verify the reset code on mount
  useEffect(() => {
    // Once we've successfully reset, never re-verify the (now single-use) code.
    if (success) return

    if (!oobCode || mode !== 'resetPassword') {
      setVerifying(false)
      setValidCode(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const email = await authService.verifyPasswordResetCode(oobCode)
        if (!cancelled) {
          setUserEmail(email)
          setValidCode(true)
          setVerifying(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setValidCode(false)
          setVerifying(false)
          const code = typeof e?.code === 'string' ? e.code : ''
          if (code === 'auth/invalid-action-code') {
            setError(t.invalidLink)
          } else if (code === 'auth/expired-action-code') {
            setError(t.invalidLink)
          } else {
            setError(e?.message || t.invalidLink)
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oobCode, mode, success])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (newPassword.length < 6) {
      setError(t.passwordTooShort)
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    setBusy(true)
    setError(null)

    try {
      await authService.confirmPasswordReset(oobCode, newPassword)
      // Mark success to prevent any re-verification of the (single-use) code.
      setSuccess(true)
      // Redirect immediately to sign-in.
      router.replace(`/${lng}/signin?reset=success`)
      return
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === 'auth/invalid-action-code') {
        setError(t.invalidLink)
      } else if (code === 'auth/expired-action-code') {
        setError(t.invalidLink)
      } else if (code === 'auth/weak-password') {
        setError(t.passwordTooShort)
      } else {
        setError(e?.message || 'Failed to reset password')
      }
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = newPassword.length >= 6 && confirmPassword.length >= 6 && !busy

  // Once successful, redirecting happens immediately. Show a lightweight transition.
  if (success) {
    return (
      <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
        <div className="mx-auto w-full max-w-md px-4 pt-28 pb-12">
          <div className="flex justify-center">
            <div className="rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-8 w-full">
              <div className="flex flex-col items-center">
                <Image
                  src="/images/logo/sako-logo.png"
                  alt="Sako-Or"
                  width={180}
                  height={60}
                  priority
                />
                <div className="mt-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#856D55]" />
                <div className="mt-4 text-sm font-medium text-slate-900">{t.redirectingToSignIn}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Loading state while verifying
  if (verifying) {
    return (
      <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
        <div className="mx-auto w-full max-w-md px-4 pt-28 pb-12">
          <div className="flex justify-center">
            <div className="rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-8 w-full">
              <div className="flex flex-col items-center">
                <Image
                  src="/images/logo/sako-logo.png"
                  alt="Sako-Or"
                  width={180}
                  height={60}
                  priority
                />
                <div className="mt-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#856D55]" />
                <div className="mt-4 text-sm font-medium text-slate-900">{t.verifying}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Invalid code state
  if (!validCode) {
    const signinBase = `/${lng}/signin`
    const emailParam = userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''
    const requestNewLinkHref = `${signinBase}?forgotPassword=1${emailParam}`
    return (
      <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
        <div className="mx-auto w-full max-w-md px-4 pt-24 pb-12">
          <div className="flex justify-center">
            <Image
              src="/images/logo/sako-logo.png"
              alt="Sako-Or"
              width={180}
              height={60}
              priority
            />
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">{t.invalidLink}</h1>
          <p className="mt-2 text-center text-sm text-slate-500">{t.invalidLinkMessage}</p>

          <div className="mt-8 rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-6">
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <Link
                href={requestNewLinkHref}
                className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55]"
              >
                {t.requestNewLink}
              </Link>
              <Link
                href={`/${lng}/signin`}
                className="w-full inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#856D55]"
              >
                {t.goToSignIn}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Reset password form
  return (
    <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-md px-4 pt-24 pb-12">
        <div className="flex justify-center">
          <Image
            src="/images/logo/sako-logo.png"
            alt="Sako-Or"
            width={180}
            height={60}
            priority
          />
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{t.subtitle}</p>
        {userEmail && <p className="mt-1 text-center text-xs text-slate-400">{userEmail}</p>}

        <div className="mt-8 rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={profileTheme.label}>{t.newPassword}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.newPasswordPlaceholder}
                className={profileTheme.input}
              />
            </div>

            <div>
              <label className={profileTheme.label}>{t.confirmPassword}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPasswordPlaceholder}
                className={profileTheme.input}
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? t.working : t.resetPassword}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

