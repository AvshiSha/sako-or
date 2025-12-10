// Image URL mappings from local paths to Firebase Storage URLs
const imageUrlMappings: Record<string, string> = {
  "/images/about/dad.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fdad.png?alt=media&token=YOUR_TOKEN_HERE",
  "/images/about/craftsmanship.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcraftsmanship.jpg?alt=media&token=7fa33bc1-0d6a-4956-b4cf-3223491beb22",
  "/images/about/heritage.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fheritage.jpg?alt=media&token=9dbdc603-e4ae-41bd-8a62-01659c431ec9",
  "/images/about/hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fhero.jpg?alt=media&token=007bce8d-fd7a-47f4-a4dd-e04846c8ccc5",
  "/images/about/team-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-1.jpg?alt=media&token=09f1c831-4cfd-401c-a994-3574e2dff468",
  "/images/about/team-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-2.jpg?alt=media&token=6b7ef6eb-2170-481d-83a9-8f45ccfde4e5",
  "/images/about/crafting(2).webp": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcrafting%282%29.webp?alt=media&token=YOUR_TOKEN_HERE",
  "/images/collections/classic-oxford.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.jpg?alt=media&token=87b9b812-16f0-483e-8ff9-4e97cd89cce6",
  "/images/collections/classic-oxford.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.svg?alt=media&token=2ae87b5b-4d53-4d7d-80cd-e287a6a6154d",
  "/images/collections/designer-boots.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.jpg?alt=media&token=84e3a0cc-7fed-472e-80e1-eac78487694a",
  "/images/collections/designer-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.svg?alt=media&token=22cab449-738f-4198-b319-11768bee38a5",
  "/images/collections/luxury-heels.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.jpg?alt=media&token=db0cf935-8e4d-4d91-986b-665008bb87fd",
  "/images/collections/luxury-heels.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.svg?alt=media&token=a9dbeb0e-2565-4106-b1f4-6c3b5dd8dc26",
  "/images/hero/main-hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.jpg?alt=media&token=1e779517-0de5-49a1-bb52-7be3bd0b0470",
  "/images/hero/main-hero.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.svg?alt=media&token=7c5d7feb-f470-457a-beee-3317d22969dd",
  "/images/logo/sako-logo.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Flogo%2Fsako-logo.png?alt=media&token=d4d75075-0ad6-4d79-80ce-6542b6465cd3",
  "/images/placeholder.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fplaceholder.svg?alt=media&token=fe297841-0047-47c2-9523-823e98cd6e8f",
  "/images/products/americas-cup-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-1.jpg?alt=media&token=f746dfd3-f7fc-49f9-b1cf-58ad2cf285b3",
  "/images/products/americas-cup-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-2.jpg?alt=media&token=7f19776d-63a1-42a7-899f-7f1fd938fdd2",
  "/images/products/crystal-embellished-pumps.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fcrystal-embellished-pumps.svg?alt=media&token=6730aa31-4fe0-4f27-9e50-d375199ba6a6",
  "/images/products/downtown-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-1.jpg?alt=media&token=3a5ff708-78fc-4db0-aadd-cd0c8ae18960",
  "/images/products/downtown-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-2.jpg?alt=media&token=db5936c8-953f-478d-9839-dd8bf6b9cf07",
  "/images/products/downtown-3.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-3.jpg?alt=media&token=7f23dbbc-e59a-4e9d-96ca-ae550d440836",
  "/images/products/italian-leather-stilettos.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fitalian-leather-stilettos.svg?alt=media&token=f602de4b-39a2-41dc-97e4-98f25027d5c4",
  "/images/products/suede-chelsea-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fsuede-chelsea-boots.svg?alt=media&token=3bf8c93a-4a5f-48e1-8485-474597a12759"
};

const videoUrlMappings: Record<string, string> = {
  "/videos/hero-desktop.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fend_of_season_desktop_fix.mp4?alt=media&token=67c85ea8-4a10-4ccd-8ab3-1b96d9b98425",
  "/videos/hero-mobile.mp4": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/videos%2Fend_of_season_mobile.mp4?alt=media&token=27de529b-9234-4560-8029-612d03794cef"
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
