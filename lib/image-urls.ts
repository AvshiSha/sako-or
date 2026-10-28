// Image URL mappings from local paths to Firebase Storage URLs
const imageUrlMappings: Record<string, string> = {
  "/images/about/crafting(2).webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcrafting(2).webp?alt=media&token=5943c987-46d7-4fc3-bcaf-9f7dd1c2f444",
  "/images/placeholder.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fplaceholder.svg?alt=media&token=fe297841-0047-47c2-9523-823e98cd6e8f",
  "/images/logo/icon.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Ficon%2Ficon.png?alt=media&token=21a42254-77d1-40fe-a4c4-f6f4ab6f0cda",
  "men-jewls.jpeg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fmen-jewls.jpeg?alt=media&token=b71b8fe9-3e0f-4ef3-8494-554ae5ed185a",
  "women-bags.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fwomen-bags.jpg?alt=media&token=296cda9d-af7c-4696-9f6b-cbbc4dcfce8f",
  "sako-men-shoes.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhf_20260405_220729_6d371807-79a6-4187-8e4e-70a8dcaa709c.webp?alt=media&token=b83ad02b-454a-4be3-acb6-af6c7a0e397a",
  "sako-women-shoes.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-women-shoes.jpg?alt=media&token=702da283-bf49-4070-8b32-9c1f36fccc68",
  "sako-accs.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-accs.jpg?alt=media&token=f64145b0-00fb-459a-b2f1-1b4e103b9258",
  "sako-women-belts.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fbelts_tiles.webp?alt=media&token=db6c451c-0332-463f-9580-6e89b1190828",
  "/images/hero/shavout-2026-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fshavout-2026-desktop.webp?alt=media&token=e6d46a34-d6a4-4099-b3f1-defdf266549c",
  "/images/hero/shavout-2026-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fshavout-2026-mobile.webp?alt=media&token=b33dcc64-7b6d-4186-828e-feadf2f5eb13",
  "/images/hero/summer-sale-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fsummer_sale_2026_fix_desktop.webp?alt=media&token=05788250-422d-423e-aac9-64cbc4242c20",
  "/images/hero/summer-sale-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fsummer_Sale_2026_fix_mobile.webp?alt=media&token=35f144d2-4cd8-479b-a2ac-c42cd6d6cf36",
  "/images/hero/rosh-hashana-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FRosh_hashana_sale_dasktop_26.webp?alt=media&token=1efaaaac-25e1-44c3-9b5b-14d9d0bad2e7",
  "/images/hero/rosh-hashana-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FRosh_hashana_sale_mobile_26.webp?alt=media&token=c41dd395-600f-43ac-b9f2-542f6120f5e7",
  "/images/hero/bogo-700-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FBOGO_700_july_desktop.webp?alt=media&token=5d72e3bb-8725-44f3-8684-7b952cea9e41",
  "/images/hero/bogo-700-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FBOGO_700_July_mobile.webp?alt=media&token=ca86d263-d4b8-47ca-ac6c-a0166d700f98",
  "/images/hero/new-drop-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fnew_drop_26_aug_desktop.webp?alt=media&token=7bb97f09-3c45-4c0d-a332-e1e64b96ae1c",
  "/images/hero/new-drop-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fnew_drop_aug_26_mobile.webp?alt=media&token=981ce80f-e29e-4c58-8285-31ff41ff9951",
  "/images/hero/election-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FElection%2FElection_sale_desktop.webp?alt=media&token=a96c33f8-acc1-4089-a72a-c2fbf4d1ce42",
  "/images/hero/winter-27-poster.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fwinter-27-poster.webp?alt=media&token=36d5807f-cbb8-433b-8ee7-d6d86471ee51",
  "/images/hero/winter-27-poster-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fwinter-27-poster-mobile.webp?alt=media&token=9e408445-d2eb-429b-a556-015000e60f4b",
  "/images/hero/winter-27-poster-desktop.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fwinter-27-poster-desktop.webp?alt=media&token=d39ab5b5-8e0a-4aa8-9bce-5be0611e89fd",
  "/images/hero/election-mobile.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2FElection%2FElection_sale_mobile.webp?alt=media&token=f9ffa373-ede9-4c04-9b5d-f0837ae0d621",
  "/images/hero/main-hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fsummer_Sale_2026_fix_mobile.webp?alt=media&token=35f144d2-4cd8-479b-a2ac-c42cd6d6cf36",
  "/images/hero/bags-hero-poster.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fbags_image_hero_mobile.webp?alt=media&token=d55a6e62-028f-4793-988e-65aa54d63536",
  "home-collection-outlet.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Foutlet_collection.webp?alt=media&token=403aac3b-fd30-4412-bc84-14836f361038",
  "home-collection-accessories.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Facc_collection_v3.webp?alt=media&token=626b7742-4ed8-441c-a570-1eae9bb12c76",
  "home-collection-men.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Fmen_collection.webp?alt=media&token=4a5da825-aefe-48ce-952f-dc437c371a97",
  "home-category-sandals.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Fsandals_cate.webp?alt=media&token=fac73869-3b93-4838-a1c0-8a36635aae7d",
  "home-category-sneakers.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Fsneakers_cate.webp?alt=media&token=65d2a30e-1d29-434c-9f81-067aa8778c45",
  "home-category-low-boots.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Flow_boots_cate.webp?alt=media&token=a1702c1b-970f-4faa-8844-83f63bb4ceba",
  "home-category-loafers.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Floafer_cate.webp?alt=media&token=eba08b3f-3659-464b-97a9-57e826b13748",
  "home-category-slippers.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Fslippers_cate.webp?alt=media&token=77667666-4094-4e73-8d75-256b29426231",
  "home-category-oxford.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Foxford_cate.webp?alt=media&token=820a1a4f-2820-4481-a78d-64a8dd4da52d",
  "home-category-moccasin.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Fmoccasin_cate.webp?alt=media&token=d23ca4fc-beac-426e-93f0-6d43b5493bf9",
  "home-category-pumps.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_categories%2Fpumps_cate.webp?alt=media&token=42187046-fab8-47de-b15c-081739cc79ca",
};

const videoUrlMappings: Record<string, string> = {
  "/videos/hero-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fv3_desktop_hero_1.mp4?alt=media&token=5e806364-1ed4-415b-bdd3-e08396c9d850",
  "/videos/hero-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fv3_mobile_hero_1.mp4?alt=media&token=03068d08-1340-4f57-bb1b-3b5c525aefb5",
  "/videos/sako-or-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fsako_world_fab_2026.mp4?alt=media&token=5d5a19f1-316a-45a6-8f10-1eb9bbefc663",
  "/videos/sako-or-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2FSAKO_OR_EDITION.mp4?alt=media&token=84b2745c-0008-4c91-9c88-ea251489954c",
  "/videos/hero3-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2FSAKO_SALES_DESKTOP.mp4?alt=media&token=7b109db9-67f6-47c8-b8cd-99c072f68a02",
  "/videos/hero3-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fthird_section_new.mp4?alt=media&token=a049aaf7-08de-43be-ba86-1e4251ae6e53",
  // "Winter 27" homepage hero. Mobile is 1080x1920 (9:16), desktop 1920x1080
  // (16:9); HomeHero's aspect-ratio boxes are built from these numbers.
  //
  // These are the *_faststart cuts, not the originals the campaign shipped as.
  // The delivered files carried `moov` last (ftyp free mdat moov), so a browser
  // had to range-request the tail before it could decode a single frame. These
  // are the same files with `moov` moved in front of `mdat` and the stco chunk
  // offsets rebased - a pure remux, verified frame-identical to the originals,
  // same byte count, nothing re-encoded. The originals are still in the bucket
  // under their old names if these ever need to be rolled back.
  "/videos/home-hero-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Ffirst_hero_home%2FNov_vid_1_mobile_faststart.mp4?alt=media&token=04ab879c-d531-4916-b6c5-2bb9956dd690",
  "/videos/home-hero-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Ffirst_hero_home%2FNov_vid_1_desktop_faststart.mp4?alt=media&token=0e9a6f23-49b5-48c2-bffc-e0a8e8c96cc6",
};

/**
 * Get the Firebase Storage URL for a local image path
 * @param localPath - The local image path (e.g., "/images/hero/main-hero.jpg")
 * @returns The Firebase Storage URL or the original path if not found
 */
export function getImageUrl(localPath: string): string {
  return imageUrlMappings[localPath] || localPath;
}

/**
 * Get the Firebase Storage URL for a local video path
 * @param localPath - The local video path (e.g., "/videos/hero-desktop.mp4")
 * @returns The Firebase Storage URL or the original path if not found
 */
export function getVideoUrl(localPath: string): string {
  return videoUrlMappings[localPath] || localPath;
}

/**
 * Get Firebase Storage URL for hero image
 */
export function getHeroImageUrl(): string {
  return getElectionHeroDesktopImageUrl();
}

export function getBagsHeroPosterUrl(): string {
  return getImageUrl("/images/hero/bags-hero-poster.webp");
}

/**
 * Shavuot 2026 hero banners (desktop / mobile)
 */
export function getShavoutHeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/shavout-2026-desktop.webp");
}

export function getShavoutHeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/shavout-2026-mobile.webp");
}

/**
 * Summer sale hero banners (desktop / mobile)
 */
export function getSummerSaleHeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/summer-sale-desktop.webp");
}

export function getSummerSaleHeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/summer-sale-mobile.webp");
}

/**
 * Rosh Hashana 2026 sale hero banners (desktop / mobile). Locale-agnostic -
 * both EN and HE text is baked into the image itself.
 */
export function getRoshHashanaHeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/rosh-hashana-desktop.webp");
}

export function getRoshHashanaHeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/rosh-hashana-mobile.webp");
}

/**
 * "Two for 700" (BOGO 700) campaign hero banners (desktop / mobile).
 */
export function getBogo700HeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/bogo-700-desktop.webp");
}

export function getBogo700HeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/bogo-700-mobile.webp");
}

/**
 * "New Drop" (August 2026) campaign hero banners (desktop / mobile). Locale-
 * agnostic - the on-image copy is baked in.
 */
export function getNewDropHeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/new-drop-desktop.webp");
}

export function getNewDropHeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/new-drop-mobile.webp");
}

/**
 * "Election Sale" (October 2026) homepage hero banners (desktop / mobile).
 * Locale-agnostic - the headline, the 10% offer and the ELEC10 code are all
 * baked into the artwork, which is why the hero carries no text node of its own.
 *
 * Intrinsic sizes are 2048x878 (desktop) and 1152x2048 (mobile); HomeHero's
 * aspect-ratio boxes are built from exactly these, so neither cut is ever
 * cropped. Changing an asset means revisiting those constants.
 */
export function getElectionHeroDesktopImageUrl(): string {
  return getImageUrl("/images/hero/election-desktop.webp");
}

export function getElectionHeroMobileImageUrl(): string {
  return getImageUrl("/images/hero/election-mobile.webp");
}

/** Homepage mobile hero video (first fold, mobile only). */
export function getHomeHeroMobileVideoUrl(): string {
  return getVideoUrl("/videos/home-hero-mobile.mp4");
}

export function getHomeHeroDesktopVideoUrl(): string {
  return getVideoUrl("/videos/home-hero-desktop.mp4");
}

/**
 * "Winter 27" campaign key art: 1320x1854 portrait. OpenGraph/social only.
 *
 * Deliberately NOT the hero video's poster. It is a different frame from a
 * different setup, and it is portrait, so in the 2:1 desktop hero box
 * object-cover kept only the middle ~36% of its height - a headless crop that
 * then jump-cut to the video's wide opening shot. The posters below are the
 * videos' own first frames instead.
 */
export function getWinter27PosterUrl(): string {
  return getImageUrl("/images/hero/winter-27-poster.webp");
}

/**
 * Hero video posters: frame 0 of each cut, decoded from the exact MP4s that
 * ship and re-encoded as WebP (~51KB each, native 1080x1920 / 1920x1080).
 *
 * Being the first frame is the whole point - the poster and the first thing the
 * decoder paints are the same picture, so the handover is invisible rather than
 * a cut between two different images. Re-export these whenever the MP4s change
 * or the two will drift apart.
 */
export function getWinter27MobilePosterUrl(): string {
  return getImageUrl("/images/hero/winter-27-poster-mobile.webp");
}

export function getWinter27DesktopPosterUrl(): string {
  return getImageUrl("/images/hero/winter-27-poster-desktop.webp");
}

/**
 * Get Firebase Storage URL for the desktop hero video
 */
export function getHeroDesktopVideoUrl(): string {
  return getVideoUrl("/videos/hero-desktop.mp4");
}

/**
 * Get Firebase Storage URL for the mobile hero video
 */
export function getHeroMobileVideoUrl(): string {
  return getVideoUrl("/videos/hero-mobile.mp4");
}

/**
 * Get Firebase Storage URL for the sako or mobile video
 */
export function getSakoOrMobileVideoUrl(): string {
  return "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fbags_image_hero_mobile.webp?alt=media&token=d55a6e62-028f-4793-988e-65aa54d63536";
}

export function getSakoOrDesktopVideoUrl(): string {
  return getVideoUrl("/videos/sako-or-desktop.mp4");
}

/**
 * Get Firebase Storage URL for the third hero desktop video
 */
export function getHero3DesktopVideoUrl(): string {
  return getVideoUrl("/videos/hero3-desktop.mp4");
}

/**
 * Get Firebase Storage URL for the third hero mobile video
 */
export function getHero3MobileVideoUrl(): string {
  return getVideoUrl("/videos/hero3-mobile.mp4");
}

/**
 * Get Firebase Storage URL for logo
 */
export function getLogoUrl(): string {
  return getImageUrl("/images/logo/sako-logo.png");
}

export function getHomeCollectionOutletImageUrl(): string {
  return getImageUrl("home-collection-outlet.webp");
}

export function getHomeCollectionAccessoriesImageUrl(): string {
  return getImageUrl("home-collection-accessories.webp");
}

export function getHomeCollectionMenImageUrl(): string {
  return getImageUrl("home-collection-men.webp");
}

/*
 * Home banner artwork for the redesigned 438:3244 section. Full download URLs
 * rather than imageUrlMappings keys: these were uploaded straight to
 * images/home_collections/ and carry their own access tokens, so there is no
 * local path to map from.
 *
 * November 2026 refresh. The three *_nov_1 cuts match the aspect ratios of the
 * artwork they replace - 1792x2400 (0.747) for the tall slot, 2048x1376 (1.488)
 * for the two wide ones - so they drop into ShopByCollection's existing
 * aspect-[390/544] lg:aspect-[863/1149] and aspect-[3/2] lg:aspect-[863/574]
 * boxes with the same object-cover crop as before. Positions, headings, CTAs
 * and hrefs are untouched in lib/home-collections.ts.
 */
export function getHomeBannerPlatformLoafersImageUrl(): string {
  return "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Flaofers_nov_1.webp?alt=media&token=68c7147e-f0d4-4de2-ad38-0ba66a2a7b63";
}

export function getHomeBannerBagsImageUrl(): string {
  return "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Fbags_nov_1.webp?alt=media&token=eba96599-7a59-4065-8407-434d2272b586";
}

export function getHomeBannerLowBootsImageUrl(): string {
  return "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhome_collections%2Flow_boots_nov_1.webp?alt=media&token=f4061246-1b3f-447f-ba20-85642f4510c7";
}

/**
 * Get Firebase Storage URL for collection images
 */
export function getCollectionImageUrl(collectionName: string): string {
  const collectionMap: Record<string, string> = {
    "Luxury Heels": "/images/collections/pumps-collection.webp",
    "Designer Boots": "/images/collections/low-boots-collection.webp",
    "Classic Oxford": "/images/collections/oxford-collection.webp"
  };

  const localPath = collectionMap[collectionName];
  return localPath ? getImageUrl(localPath) : getImageUrl("/images/placeholder.svg");
}

/**
 * Get Firebase Storage URL for product images
 */
export function getProductImageUrl(productName: string): string {
  const productMap: Record<string, string> = {
    "Tan Suede Chunky Sneakers": "/images/products/4912-2169.webp",
    "Chic Ankle Boots": "/images/products/4926-2356.webp",
    "Suede Cowboy Boots": "/images/products/4925-2901.webp"
  };

  const localPath = productMap[productName];
  return localPath ? getImageUrl(localPath) : getImageUrl("/images/placeholder.svg");
}
