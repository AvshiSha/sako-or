'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

type SyncResponse =
  | {
      id: string
      firebaseUid: string | null
      email: string | null
      role: string
      lastLoginAt: string | null
      createdAt: string
      updatedAt: string
    }
  | { error: string }

export default function AuthDebugPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [syncStatus, setSyncStatus] = useState<number | null>(null)
  const [syncBody, setSyncBody] = useState<SyncResponse | null>(null)

  const [googleAuthStatus, setGoogleAuthStatus] = useState<string>('idle')
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null)
  const [pageUrl, setPageUrl] = useState<string>('')

  const lastSyncedUidRef = useRef<string | null>(null)

  const firebaseProjectId = auth.app.options.projectId ?? '(unknown)'
  const firebaseAuthDomain = auth.app.options.authDomain ?? '(unknown)'

  function formatAuthError(e: any, fallback: string) {
    const code = typeof e?.code === 'string' ? e.code : ''
    const msg = typeof e?.message === 'string' ? e.message : ''
    if (code && msg) return `${code}: ${msg}`
    if (code) return code
    if (msg) return msg
    return fallback
  }

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:61',message:'Page Load - URL check',data:{href:window.location.href,projectId:auth.app.options.projectId,authDomain:auth.app.options.authDomain},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.href)
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:67',message:'onAuthStateChanged listener fired',data:{uid:u?.uid,email:u?.email},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      setFirebaseUser(u)
      setAuthLoading(false)

      // Safety-net: after Google redirect (or any sign-in), ensure we sync once.
      // This covers cases where getRedirectResult() returns null but the session is still authenticated.
      if (u && lastSyncedUidRef.current !== u.uid) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:73',message:'Triggering safety-net syncToNeon',data:{uid:u.uid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        lastSyncedUidRef.current = u.uid
        setBusy(true)
        setError(null)
        setSyncStatus(null)
        setSyncBody(null)
        void syncToNeon(u)
          .catch((e: any) => {
            setError(typeof e?.message === 'string' ? e.message : 'Sync failed')
          })
          .finally(() => setBusy(false))
      }
    })
    return unsub
  }, [])

  const redirectCheckedRef = useRef(false)
  // Complete Google redirect sign-in (if user just came back from the consent screen)
  useEffect(() => {
    if (redirectCheckedRef.current) return
    redirectCheckedRef.current = true

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:91',message:'Google Redirect Effect started',data:{search:window.location.search,hash:window.location.hash},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    let cancelled = false
    ;(async () => {
      try {
        setGoogleAuthStatus('checking_redirect_result')
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:95',message:'Calling getRedirectResult',timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const result = await getRedirectResult(auth)
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:97',message:'getRedirectResult returned',data:{hasResult:!!result,hasUser:!!result?.user,uid:result?.user?.uid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (cancelled) return

        if (!result?.user) {
          setGoogleAuthStatus('no_redirect_result_found')
          return
        }

        setGoogleAuthError(null)
        setGoogleAuthStatus('redirect_result_received')
        setBusy(true)
        setError(null)
        setSyncStatus(null)
        setSyncBody(null)

        await syncToNeon(result.user)
      } catch (e: any) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:107',message:'getRedirectResult catch error',data:{error:e},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (cancelled) return
        // If there's no redirect in progress, Firebase can throw or return null depending on version.
        const formatted = formatAuthError(e, 'Google redirect sign-in failed')
        setGoogleAuthError(formatted)
        setGoogleAuthStatus('redirect_error')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 6 && !busy
  }, [email, password, busy])

  async function syncToNeon(user: User) {
    console.log('[DEBUG] syncToNeon started for:', user.uid);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:127',message:'syncToNeon started',data:{uid:user.uid,email:user.email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const token = await user.getIdToken()
    console.log('[DEBUG] Token obtained, calling /api/me/sync');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:130',message:'Fetching /api/me/sync',timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const res = await fetch('/api/me/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    setSyncStatus(res.status)
    const text = await res.text()
    console.log('[DEBUG] /api/me/sync response status:', res.status, 'body:', text);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:138',message:'/api/me/sync response',data:{status:res.status,body:text.slice(0, 100)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    let json: SyncResponse
    try {
      json = text ? (JSON.parse(text) as SyncResponse) : { error: 'Empty response from /api/me/sync' }
    } catch {
      json = { error: `Invalid JSON from /api/me/sync: ${text.slice(0, 200)}` }
    }

    setSyncBody(json)

    if (!res.ok) {
      const msg = 'error' in json ? json.error : 'Unable to sync user'
      throw new Error(msg)
    }

    // If the server replied 200 but body was empty/invalid, treat it as failure
    if ('error' in json) {
      throw new Error(json.error)
    }

    return json
  }

  async function handleSignUp() {
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await syncToNeon(cred.user)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      await syncToNeon(cred.user)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:191',message:'handleGoogleSignIn clicked',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    setGoogleAuthError(null)
    setGoogleAuthStatus('starting_redirect')
    try {
      const provider = new GoogleAuthProvider()
      // Always show account chooser so you can test multiple Google accounts.
      provider.setCustomParameters({ prompt: 'select_account' })
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:202',message:'Calling signInWithRedirect',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      await signInWithRedirect(auth, provider)
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:204',message:'signInWithRedirect error',data:{error:e},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === 'auth/account-exists-with-different-credential') {
        setError(
          'An account already exists with the same email but a different sign-in method. Please sign in with Email/Password first.'
        )
      } else {
        setError(formatAuthError(e, 'Google sign in failed'))
      }
      setGoogleAuthError(formatAuthError(e, 'Google sign in failed'))
      setGoogleAuthStatus('redirect_start_error')
    } finally {
      // Redirect flow navigates away; if it doesn't (error), unlock UI.
      setBusy(false)
    }
  }

  async function handleGooglePopupSignIn() {
    console.log('[DEBUG] handleGooglePopupSignIn clicked');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:220',message:'handleGooglePopupSignIn clicked',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    setGoogleAuthError(null)
    setGoogleAuthStatus('starting_popup')
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      console.log('[DEBUG] Calling signInWithPopup');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:231',message:'Calling signInWithPopup',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      const cred = await signInWithPopup(auth, provider)
      console.log('[DEBUG] signInWithPopup success:', cred.user.uid);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:233',message:'signInWithPopup success',data:{uid:cred.user.uid},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      setGoogleAuthStatus('popup_success')
      await syncToNeon(cred.user)
    } catch (e: any) {
      console.error('[DEBUG] signInWithPopup error:', e);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:237',message:'signInWithPopup error',data:{error:e},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      const formatted = formatAuthError(e, 'Google popup sign in failed')
      setError(formatted)
      setGoogleAuthError(formatted)
      setGoogleAuthStatus('popup_error')
    } finally {
      setBusy(false)
    }
  }

  async function handleResync() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:244',message:'handleResync clicked',data:{hasUser:!!firebaseUser},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    if (!firebaseUser) return
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    try {
      await syncToNeon(firebaseUser)
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc52a81b-1e67-4b90-bdf5-80492a19f8bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/[lng]/auth/page.tsx:254',message:'handleResync error',data:{error:e},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      setError(typeof e?.message === 'string' ? e.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    setSyncStatus(null)
    setSyncBody(null)
    try {
      await signOut(auth)
      lastSyncedUidRef.current = null
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Sign out failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Auth (Firebase → Neon) Debug (v2 - Logging Active)</h1>
      <p className="mt-2 text-sm text-gray-600">
        This page signs up / signs in with <b>Firebase Authentication</b>, then calls <code>/api/me/sync</code>{' '}
        to upsert the user in <b>Neon</b>. It does not create any Firestore <code>users</code> documents.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Firebase session</div>
            {authLoading ? (
              <div className="text-sm text-gray-600">Checking...</div>
            ) : firebaseUser ? (
              <div className="mt-1 text-sm text-gray-700">
                <div>
                  <b>uid:</b> <code>{firebaseUser.uid}</code>
                </div>
                <div>
                  <b>email:</b> {firebaseUser.email ?? '(none)'}
                </div>
                <div>
                  <b>emailVerified:</b> {String(firebaseUser.emailVerified)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">Not signed in.</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResync}
              disabled={!firebaseUser || busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
            >
              Re-sync to Neon
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={!firebaseUser || busy}
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold text-gray-900">Google Auth debug</div>
        <div className="mt-2 text-xs text-gray-700 space-y-1">
          <div>
            <b>Page URL:</b> <code>{pageUrl || '(unknown)'}</code>
          </div>
          <div>
            <b>Firebase projectId:</b> <code>{firebaseProjectId}</code>
          </div>
          <div>
            <b>Firebase authDomain:</b> <code>{firebaseAuthDomain}</code>
          </div>
          <div>
            <b>Status:</b> <code>{googleAuthStatus}</code>
          </div>
          <div>
            <b>Error:</b> <code>{googleAuthError ?? '(none)'}</code>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="min 6 chars"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Continue with Google → Sync (Neon)'}
          </button>
          <button
            type="button"
            onClick={handleGooglePopupSignIn}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Google (Popup) → Sync (Neon)'}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={!canSubmit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Sign up (Firebase) → Sync (Neon)'}
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={!canSubmit}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Sign in (Firebase) → Sync (Neon)'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold text-gray-900">/api/me/sync result</div>
        <div className="mt-2 text-sm text-gray-700">
          <div>
            <b>Status:</b> {syncStatus ?? '(not called yet)'}
          </div>
        </div>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
          {syncBody ? JSON.stringify(syncBody, null, 2) : 'No response yet.'}
        </pre>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <p>
          If <code>/api/me/sync</code> fails locally, ensure your <code>DATABASE_URL</code> (Neon/Postgres) and Firebase
          Admin env vars are set (<code>FIREBASE_PROJECT_ID</code>, <code>FIREBASE_CLIENT_EMAIL</code>,{' '}
          <code>FIREBASE_PRIVATE_KEY</code>).
        </p>
      </div>
    </div>
  )
}


