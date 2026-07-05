'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  buildAdvancedMatchingSyncKey,
  omitNullAdvancedMatchingFields,
  setFacebookPixelAdvancedMatching,
  type AdvancedMatchingInput,
} from '@/lib/facebookPixel';

/** Firebase auth fields only; omit missing keys so merge keeps checkout/profile data. */
function buildFirebaseAuthAdvancedMatching(firebaseUser: {
  email: string | null;
  phoneNumber: string | null;
}): AdvancedMatchingInput {
  const matching: AdvancedMatchingInput = {};
  if (firebaseUser.email?.trim()) matching.email = firebaseUser.email;
  if (firebaseUser.phoneNumber?.trim()) matching.phone = firebaseUser.phoneNumber;
  return matching;
}

function buildScopedSyncKey(
  scope: 'auth' | 'profile',
  uid: string,
  input: AdvancedMatchingInput
): string {
  return `${scope}:${buildAdvancedMatchingSyncKey(uid, input)}`;
}

function syncAuthOnlyAdvancedMatching(
  firebaseUser: { uid: string; email: string | null; phoneNumber: string | null },
  lastSyncedKeyRef: MutableRefObject<string | null>
): void {
  const authOnlyMatching = buildFirebaseAuthAdvancedMatching(firebaseUser);
  if (Object.keys(authOnlyMatching).length === 0) return;

  const syncKey = buildScopedSyncKey('auth', firebaseUser.uid, authOnlyMatching);
  if (lastSyncedKeyRef.current === syncKey) return;
  lastSyncedKeyRef.current = syncKey;

  setFacebookPixelAdvancedMatching(authOnlyMatching);
}

/**
 * Enriches Meta Pixel advanced matching when a signed-in user's profile is available.
 * Must render inside AuthProvider. For guest init, use FacebookPixelInit instead.
 */
export default function FacebookPixelAdvancedMatching() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const lastSyncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      lastSyncedKeyRef.current = null;
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;

    let cancelled = false;

    void (async () => {
      try {
        const token = await firebaseUser.getIdToken().catch(() => null);
        if (!token || cancelled) return;

        const res = await fetch('/api/me/profile', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          syncAuthOnlyAdvancedMatching(firebaseUser, lastSyncedKeyRef);
          return;
        }

        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!json?.user) {
          syncAuthOnlyAdvancedMatching(firebaseUser, lastSyncedKeyRef);
          return;
        }

        const profile = json.user;
        const profileMatching = omitNullAdvancedMatchingFields({
          email: profile.email ?? firebaseUser.email,
          phone: profile.phone ?? firebaseUser.phoneNumber,
          firstName: profile.firstName,
          lastName: profile.lastName,
          city: profile.addressCity,
          country: 'israel',
        });
        const syncKey = buildScopedSyncKey('profile', firebaseUser.uid, profileMatching);

        if (lastSyncedKeyRef.current === syncKey) return;
        lastSyncedKeyRef.current = syncKey;

        setFacebookPixelAdvancedMatching(profileMatching);
      } catch {
        // Non-critical analytics enrichment
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, firebaseUser]);

  return null;
}
