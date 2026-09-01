// Single source of truth for CMS-managed static pages (Terms & Conditions,
// Policies, Shipping & Returns, and future pages). Adding a new page requires
// one entry here, one thin public route file delegating to
// app/components/StaticCmsPage.tsx (see app/(site)/[lng]/terms/page.tsx for the
// template), plus the path in app/sitemap.ts and, if it belongs there, the footer.

export interface StaticPageDefinition {
  /** Firestore doc ID in the `staticPages` collection. */
  key: string;
  /** Public path, rendered at /${lng}${publicPath}. */
  publicPath: string;
  /** Label shown in the admin content hub. */
  adminLabel: string;
}

export const STATIC_PAGE_DEFINITIONS: StaticPageDefinition[] = [
  { key: 'terms', publicPath: '/terms', adminLabel: 'Terms of Service' },
  { key: 'policies', publicPath: '/policies', adminLabel: 'Policies' },
  {
    key: 'shipping-and-returns',
    publicPath: '/shipping-and-returns',
    adminLabel: 'Shipping & Returns',
  },
];

export function getStaticPageDefinition(key: string): StaticPageDefinition | undefined {
  return STATIC_PAGE_DEFINITIONS.find((definition) => definition.key === key);
}
