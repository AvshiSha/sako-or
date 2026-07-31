// Single source of truth for CMS-managed static pages (Terms & Conditions,
// and future pages like Privacy Policy, Shipping, Returns, etc.). Adding a
// new page requires one entry here plus one thin public route file — see
// app/[lng]/terms/page.tsx for the template.

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
];

export function getStaticPageDefinition(key: string): StaticPageDefinition | undefined {
  return STATIC_PAGE_DEFINITIONS.find((definition) => definition.key === key);
}
