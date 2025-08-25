// Image URL mappings from local paths to Firebase Storage URLs
const imageUrlMappings: Record<string, string> = {
  "/images/about/craftsmanship.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fcraftsmanship.jpg?alt=media&token=5bfa2ea4-84e8-4ad0-abb3-b02144ea4c74",
  "/images/about/heritage.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fheritage.jpg?alt=media&token=ad6b20d2-43f8-4bf5-b1e2-364ee63c2696",
  "/images/about/hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fhero.jpg?alt=media&token=62650389-1918-4881-ad84-1a9ab3e31b49",
  "/images/about/team-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-1.jpg?alt=media&token=d9df9bf5-0f04-4422-917f-aefc8bda4c78",
  "/images/about/team-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fabout%2Fteam-2.jpg?alt=media&token=c107ec31-0445-495d-b3e6-61dc8793c42a",
  "/images/collections/classic-oxford.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.jpg?alt=media&token=93730b7c-091b-45f0-a84c-c8e59d05c5e8",
  "/images/collections/classic-oxford.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fclassic-oxford.svg?alt=media&token=75c04056-c753-4e5f-9f18-ee9e108ceec2",
  "/images/collections/designer-boots.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.jpg?alt=media&token=f5a4b983-709e-45cf-88eb-f45309bbc514",
  "/images/collections/designer-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fdesigner-boots.svg?alt=media&token=d3c655b2-3eb8-468f-9e4f-b68cb5476b75",
  "/images/collections/luxury-heels.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.jpg?alt=media&token=073f13ca-0a6e-474f-a28d-03293a45e4cd",
  "/images/collections/luxury-heels.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fcollections%2Fluxury-heels.svg?alt=media&token=28112824-1c4f-41c5-a1ba-9fbc24d71859",
  "/images/hero/main-hero.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.jpg?alt=media&token=5351de9d-1afd-4556-8be2-55e3842e26d4",
  "/images/hero/main-hero.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fhero%2Fmain-hero.svg?alt=media&token=9d0de4d1-4af5-431e-8a43-e36c1308ca88",
  "/images/logo/sako-logo.png": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Flogo%2Fsako-logo.png?alt=media&token=ea320cc7-bb62-4d85-b398-5874bf01472b",
  "/images/placeholder.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fplaceholder.svg?alt=media&token=2254092f-62e5-48aa-824c-ae6eebf41d5b",
  "/images/products/americas-cup-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-1.jpg?alt=media&token=e90159a9-5993-48ba-b73f-a590a4a0996f",
  "/images/products/americas-cup-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Famericas-cup-2.jpg?alt=media&token=980fb081-7a23-4e66-bc2c-daca2b66463e",
  "/images/products/crystal-embellished-pumps.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fcrystal-embellished-pumps.svg?alt=media&token=252bca2e-0124-4778-bdec-581d2f93ad5a",
  "/images/products/downtown-1.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-1.jpg?alt=media&token=2eb6cb41-c977-4e89-9293-6a6a6c086acd",
  "/images/products/downtown-2.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-2.jpg?alt=media&token=29f397f8-1419-4ce6-81bb-b9f83210280b",
  "/images/products/downtown-3.jpg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fdowntown-3.jpg?alt=media&token=c1ead60e-dffc-4587-99a8-6e2eeb5ae13e",
  "/images/products/italian-leather-stilettos.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fitalian-leather-stilettos.svg?alt=media&token=0499b9d0-7b21-431a-a8b6-4efa7e4f226b",
  "/images/products/suede-chelsea-boots.svg": "https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fproducts%2Fsuede-chelsea-boots.svg?alt=media&token=f3cfc385-d315-4f41-bdb9-18bcaa262aff"
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
