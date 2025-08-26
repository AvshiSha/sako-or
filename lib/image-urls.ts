// Image URL mappings from local paths to Firebase Storage URLs
const imageUrlMappings: Record<string, string> = {
  "/images/about/craftsmanship.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcraftsmanship.jpg?alt=media&token=ae9c4224-6f38-41d8-bb28-bda79156636d",
  "/images/about/heritage.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fheritage.jpg?alt=media&token=bb1239da-414a-4a68-8763-a26968399bf9",
  "/images/about/hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fhero.jpg?alt=media&token=6fb9ad19-0e68-4216-ae72-86056fdb1552",
  "/images/about/team-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-1.jpg?alt=media&token=2bc0b469-83d7-40f8-ba04-88d877de7e5e",
  "/images/about/team-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-2.jpg?alt=media&token=0bc9b45f-de4a-4f04-beda-c7ed6dcb2b7b",
  "/images/collections/classic-oxford.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.jpg?alt=media&token=5ab4f81f-d460-419f-8924-a2fe0314b0d2",
  "/images/collections/classic-oxford.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.svg?alt=media&token=36f5e393-d420-40d4-92d0-3b76cf3924d6",
  "/images/collections/designer-boots.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.jpg?alt=media&token=39f1ee59-d11a-42c0-a38a-e24f96c0f6bc",
  "/images/collections/designer-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.svg?alt=media&token=c51b666b-3c0d-423d-88d4-08ba17d8d435",
  "/images/collections/luxury-heels.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.jpg?alt=media&token=131be293-4311-47c7-833a-05ebc8008ecf",
  "/images/collections/luxury-heels.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.svg?alt=media&token=3a4e5656-2a4a-4f83-95b0-a64c7419eea4",
  "/images/hero/main-hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.jpg?alt=media&token=5e88ef66-15f8-43c6-a423-e7c5f177ee0f",
  "/images/hero/main-hero.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.svg?alt=media&token=ab881762-dcb2-4abc-b906-c10386b81501",
  "/images/logo/sako-logo.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Flogo%2Fsako-logo.png?alt=media&token=84e0d43d-7225-4372-b932-b736476424bf",
  "/images/placeholder.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fplaceholder.svg?alt=media&token=0f16f114-7f6a-4ed1-bbea-779754ae8ec9",
  "/images/products/americas-cup-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-1.jpg?alt=media&token=62e6db32-a717-46a9-84f2-6a51e7d4c999",
  "/images/products/americas-cup-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-2.jpg?alt=media&token=7b03092b-7b8a-4b72-89f9-fc74b53b919c",
  "/images/products/crystal-embellished-pumps.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fcrystal-embellished-pumps.svg?alt=media&token=edb6bcb5-9374-4c41-9b48-d57368833712",
  "/images/products/downtown-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-1.jpg?alt=media&token=a521e671-7093-4f2f-a6a6-e8eef2b85bdf",
  "/images/products/downtown-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-2.jpg?alt=media&token=aa5951b5-0601-4b87-97ae-bb30e288ac9f",
  "/images/products/downtown-3.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-3.jpg?alt=media&token=bfc519f9-f698-4a7e-b5d2-efacfb4c112b",
  "/images/products/italian-leather-stilettos.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fitalian-leather-stilettos.svg?alt=media&token=475d4714-ca61-4c05-9d29-6b509176ed90",
  "/images/products/suede-chelsea-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fsuede-chelsea-boots.svg?alt=media&token=e066c7fd-429f-424e-9ace-d4daae8561f1"
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
 * Get Firebase Storage URL for hero image
 */
export function getHeroImageUrl(): string {
  return getImageUrl("/images/hero/main-hero.jpg");
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
    "Luxury Heels": "/images/collections/luxury-heels.jpg",
    "Designer Boots": "/images/collections/designer-boots.jpg",
    "Classic Oxford": "/images/collections/classic-oxford.jpg"
  };
  
  const localPath = collectionMap[collectionName];
  return localPath ? getImageUrl(localPath) : getImageUrl("/images/placeholder.svg");
}

/**
 * Get Firebase Storage URL for product images
 */
export function getProductImageUrl(productName: string): string {
  const productMap: Record<string, string> = {
    "Italian Leather Stilettos": "/images/products/italian-leather-stilettos.svg",
    "Crystal Embellished Pumps": "/images/products/crystal-embellished-pumps.svg",
    "Suede Chelsea Boots": "/images/products/suede-chelsea-boots.svg"
  };
  
  const localPath = productMap[productName];
  return localPath ? getImageUrl(localPath) : getImageUrl("/images/placeholder.svg");
}
