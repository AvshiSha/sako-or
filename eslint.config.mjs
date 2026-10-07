import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Files whose <Link>s all point at the collection/campaign listing routes. They
 * must go through ListingLink, so next/link is banned outright in them.
 *
 * Navigation.tsx is deliberately NOT here: it mixes listing links with /cart,
 * /favorites, /profile and /signin, which should keep prefetching. It imports
 * both, and the href rule below is what keeps its listing links honest.
 */
const LISTING_LINK_FILES = [
  "app/components/NavigationCategories.tsx",
  "app/components/CollectionTiles.tsx",
  "app/components/ShopByCollection.tsx",
  "app/components/HomeHero.tsx",
  "app/components/PromoSection.tsx",
];

const LISTING_LINK_REASON =
  "Links into /[lng]/collection/... must use ListingLink (app/components/ListingLink.tsx), " +
  "not next/link. Prefetching a listing route intermittently makes the router render the " +
  "segment's stale prefetch payload - which carries neither the page nor the loading " +
  "boundary - so the content area renders completely empty for seconds instead of showing " +
  "the skeleton. Reproduced 4 times in 66 Collection -> Collection navigations; 0 after. " +
  "This is a bug fix, not a performance setting, and it will not show up in local dev.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn"
    }
  },

  /**
   * Guard 1 - the known listing-link files cannot import next/link at all.
   *
   * Narrow and absolute: every Link in these files is a listing link, so there is
   * no legitimate reason for next/link to appear.
   */
  {
    files: LISTING_LINK_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: LISTING_LINK_REASON,
            },
          ],
        },
      ],
    },
  },

  /**
   * Guard 2 - any NEW listing link anywhere in the app, written with next/link.
   *
   * Guard 1 only protects files someone already thought about; this one catches
   * the case that actually caused the bug - a fresh <Link href="…/collection/…">
   * added months later by someone who has never read ListingLink.
   *
   * It keys on the element being named `Link`, which is why ListingLink is
   * imported under its own name rather than aliased to Link. `<ListingLink
   * href="/he/collection/…">` is invisible to this selector; `<Link href="…">`
   * to the same place is not. Both the string and template-literal forms of the
   * href are covered, since every call site in this repo builds it as
   * `/${lng}/collection/…`.
   *
   * Scoped to .tsx under app/ and lib/ - the only places JSX lives here.
   */
  {
    files: ["app/**/*.tsx", "lib/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name='Link'] JSXAttribute[name.name='href'] Literal[value=/\\u002Fcollection(\\u002F|$)/]",
          message: LISTING_LINK_REASON,
        },
        {
          selector:
            "JSXOpeningElement[name.name='Link'] JSXAttribute[name.name='href'] TemplateElement[value.raw=/\\u002Fcollection(\\u002F|$)/]",
          message: LISTING_LINK_REASON,
        },
      ],
    },
  },
];

export default eslintConfig;
