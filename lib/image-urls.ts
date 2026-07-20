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
  "/videos/home-hero-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Ffirst_hero_home%2Fhero_1_fix.mp4?alt=media&token=fa0c6485-eb87-4548-8be3-4f4e377fc686",
  "/videos/home-hero-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Ffirst_hero_home%2Fhero_desktop_fix.mp4?alt=media&token=3f52cdac-dead-49cb-90d9-ff64deec95f0",
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
  return getSummerSaleHeroMobileImageUrl();
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

/** Homepage mobile hero video (first fold, mobile only). */
export function getHomeHeroMobileVideoUrl(): string {
  return getVideoUrl("/videos/home-hero-mobile.mp4");
}

export function getHomeHeroDesktopVideoUrl(): string {
  return getVideoUrl("/videos/home-hero-desktop.mp4");
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
