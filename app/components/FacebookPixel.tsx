'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useUserProfile } from '@/app/hooks/useUserProfile';
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

/** The uid was already this component's local sync key; it is also Meta's external_id. */
function withUidAsExternalId(uid: string, matching: AdvancedMatchingInput): AdvancedMatchingInput {
  return { ...matching, externalId: uid };
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
  // No emptiness check any more: even with no email or phone on the Firebase user,
  // the uid alone is worth reporting as external_id.
  const authOnlyMatching = withUidAsExternalId(
    firebaseUser.uid,
    buildFirebaseAuthAdvancedMatching(firebaseUser)
  );

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
  const { profile, error: profileError } = useUserProfile();
  const lastSyncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      lastSyncedKeyRef.current = null;
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;

    if (profileError || !profile) {
      if (profileError) syncAuthOnlyAdvancedMatching(firebaseUser, lastSyncedKeyRef);
      return;
    }

    try {
      const profileMatching = withUidAsExternalId(
        firebaseUser.uid,
        omitNullAdvancedMatchingFields({
          email: profile.email ?? firebaseUser.email,
          phone: profile.phone ?? firebaseUser.phoneNumber,
          firstName: profile.firstName,
          lastName: profile.lastName,
          city: profile.addressCity,
          country: 'israel',
        })
      );
      const syncKey = buildScopedSyncKey('profile', firebaseUser.uid, profileMatching);

      if (lastSyncedKeyRef.current === syncKey) return;
      lastSyncedKeyRef.current = syncKey;

      setFacebookPixelAdvancedMatching(profileMatching);
    } catch {
      // Non-critical analytics enrichment
    }
  }, [authLoading, firebaseUser, profile, profileError]);

  return null;
}
