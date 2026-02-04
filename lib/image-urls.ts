// Image URL mappings from local paths to Firebase Storage URLs
const imageUrlMappings: Record<string, string> = {
  "/images/about/crafting(2).webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcrafting(2).webp?alt=media&token=5943c987-46d7-4fc3-bcaf-9f7dd1c2f444",
  "/images/placeholder.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fplaceholder.svg?alt=media&token=fe297841-0047-47c2-9523-823e98cd6e8f",
  "/images/logo/icon.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Ficon%2Ficon.png?alt=media&token=21a42254-77d1-40fe-a4c4-f6f4ab6f0cda",
  "men-jewls.jpeg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fmen-jewls.jpeg?alt=media&token=b71b8fe9-3e0f-4ef3-8494-554ae5ed185a",
  "low-boots.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Flow-boots.jpg?alt=media&token=2f310de9-0629-43cf-ba7c-2cabe6dd0ce9",
  "women-bags.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fwomen-bags.jpg?alt=media&token=296cda9d-af7c-4696-9f6b-cbbc4dcfce8f",
  "sako-men-shoes.webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-men-shoes.webp?alt=media&token=b32af041-8624-4c39-bb9e-ce6ca47afe6d",
  "sako-women-shoes.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-women-shoes.jpg?alt=media&token=702da283-bf49-4070-8b32-9c1f36fccc68",
  "sako-accs.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-accs.jpg?alt=media&token=f64145b0-00fb-459a-b2f1-1b4e103b9258",
  "high-heels.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fhigh-heels.jpg?alt=media&token=977d2f7d-ed75-4e9f-94ed-1c8f0eb5f590",
  "sako-women-sneakers.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-women-sneakers.jpg?alt=media&token=5be848ff-56f7-4ac2-8db9-e6fd9901f0f9",
  "sako-outlet.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-outlet.jpg?alt=media&token=58ad0bc4-bbee-4e33-b706-586c8e009761",
  "sako-women-belts.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fon-footer%2Fsako-women-belts.webp?alt=media&token=ab8da023-27b9-4851-93a6-974a21795bb5"
};

const videoUrlMappings: Record<string, string> = {
  "/videos/hero-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fend_of_season_desktop_fix.mp4?alt=media&token=67c85ea8-4a10-4ccd-8ab3-1b96d9b98425",
  "/videos/hero-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fsako_exclusive_mobile.mp4?alt=media&token=5d771fff-7cfb-4d3f-a733-0e2d1dabf160",
  "/videos/sako-or-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2FSAKO_OR_EDITION_mobile.mp4?alt=media&token=c816cf11-042a-49a0-a1c9-a0f1b7f63322",
  "/videos/sako-or-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2FSAKO_OR_EDITION.mp4?alt=media&token=84b2745c-0008-4c91-9c88-ea251489954c",
  "/videos/hero3-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fend_of_season_desktop_fix.mp4?alt=media&token=67c85ea8-4a10-4ccd-8ab3-1b96d9b98425",
  "/videos/hero3-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fsako_bogo.mp4?alt=media&token=b4774312-757a-4f91-93dc-faaa7974b1d7"
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
  return getImageUrl("/images/hero/main-hero.jpg");
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
  return getVideoUrl("/videos/sako-or-mobile.mp4");
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
