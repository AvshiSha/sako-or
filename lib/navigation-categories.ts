export type NavSubCategory = {
  id: string
  slug: string
  name: string
  subChildren?: Array<{ id: string; slug: string; name: string }>
}

export type NavCategory = {
  id: string
  slug: string
  name: string
  level: number
}

export type NavigationCategoriesData = {
  availableCategories: NavCategory[]
  womenSubcategories: NavSubCategory[]
  menSubcategories: NavSubCategory[]
}
