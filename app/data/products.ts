export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  subcategory?: string;
  images: string[];
  sizes: string[];
  colors: string[];
  featured?: boolean;
  new?: boolean;
  sale?: {
    price: number;
    startDate: string;
    endDate: string;
  };
}

export const products: Product[] = [
  {
    id: "1",
    name: "Crystal Embellished Pumps",
    price: 299.99,
    description: "Elegant pumps adorned with crystal embellishments for a touch of luxury.",
    category: "women",
    subcategory: "boots",
    images: [
      "/images/products/americas-cup-1.jpg",
      "/images/products/americas-cup-2.jpg"
    ],
    sizes: ["36", "37", "38", "39", "40"],
    colors: ["Black", "Silver", "Gold"],
    featured: true,
    new: true
  },
  {
    id: "2",
    name: "Italian Leather Stilettos",
    price: 349.99,
    description: "Handcrafted stilettos made from premium Italian leather.",
    category: "women",
    subcategory: "shoes",
    images: [
      "/images/products/italian-leather-stilettos.svg",
      "/images/products/italian-leather-stilettos.svg"
    ],
    sizes: ["36", "37", "38", "39", "40"],
    colors: ["Nude", "Red", "Black"],
    featured: true
  },
  {
    id: "3",
    name: "Suede Chelsea Boots",
    price: 279.99,
    description: "Classic Chelsea boots in premium suede with elastic side panels.",
    category: "women",
    subcategory: "shoes",
    images: [
      "/images/products/suede-chelsea-boots.svg",
      "/images/products/suede-chelsea-boots.svg"
    ],
    sizes: ["36", "37", "38", "39", "40"],
    colors: ["Tan", "Navy", "Black"],
    new: true
  }
]; 