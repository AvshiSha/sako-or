import { languages } from '../../../../i18n/settings'

export async function generateStaticParams() {
  // Generate static paths for common collection routes
  const categories = ['women', 'men'];
  const subcategories = ['shoes', 'accessories'];
  const productTypes = ['high-heels', 'boots', 'oxford', 'sneakers', 'sandals', 'slippers', 'coats', 'bags'];
  
  const paths: Array<{ lng: string; slug?: string[] }> = [];
  
  // Add language-only paths
  languages.forEach(lng => {
    paths.push({ lng, slug: undefined });
  });
  
  // Add category paths
  languages.forEach(lng => {
    categories.forEach(category => {
      paths.push({ lng, slug: [category] });
    });
  });
  
  // Add subcategory paths
  languages.forEach(lng => {
    categories.forEach(category => {
      subcategories.forEach(subcategory => {
        paths.push({ lng, slug: [category, subcategory] });
      });
    });
  });
  
  // Add product type paths
  languages.forEach(lng => {
    productTypes.forEach(productType => {
      if (['high-heels', 'boots', 'oxford', 'sneakers', 'sandals', 'slippers'].includes(productType)) {
        paths.push({ lng, slug: ['women', 'shoes', productType] });
      } else {
        paths.push({ lng, slug: ['women', 'accessories', productType] });
      }
    });
  });
  
  return paths;
}

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children;
}
