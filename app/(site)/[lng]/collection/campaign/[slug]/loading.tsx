import CollectionListingSkeleton from "@/app/components/collection/CollectionListingSkeleton";

/**
 * The campaign listing's route fallback - the file that gives this route the same
 * loading state the collection listing has had all along.
 *
 * `fullHeight={false}` because layout.tsx already carries the min-h-screen ground
 * and the hero above this. Keeping min-h-screen here would reserve a viewport's
 * worth *below* the hero that a short campaign never fills, and hand the swap a
 * shrink to shift on.
 *
 * No hero placeholder, and this time for a good reason rather than an unavoidable
 * one: layout.tsx renders the real hero outside this boundary, so by the time this
 * fallback paints the banner's box is already correct for this campaign. The
 * earlier version of this file could not do that - it sat above the slug - which
 * is why it reserved nothing and the listing jumped when the banner landed.
 *
 * Safe here for the same reason it is safe on the collection listing: nothing
 * inside this boundary calls notFound() or redirect(). The one redirect this route
 * has lives in layout.tsx, above the boundary, where it still sets a real status.
 */
export default function Loading() {
  return (
    <CollectionListingSkeleton
      label="Loading campaign products"
      fullHeight={false}
    />
  );
}
