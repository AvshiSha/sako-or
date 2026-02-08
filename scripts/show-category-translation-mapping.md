# Category Translation Mapping

## Current Situation

**Products table stores:**

- `category`: Firebase category ID (e.g., "QGgLBvi0nlm2ubt5nKKN")
- `subCategory`: Firebase category ID (e.g., "eKedLsbjfWh7qywuslaB")
- `subSubCategory`: Firebase category ID (e.g., "zDcCOySVjYVdcFqvHX5U")
- `categories_path_id`: Array of Firebase IDs in hierarchy order (e.g., ["Women_ID", "Shoes_ID", "Pumps_ID"])

**Categories table has:**

- `name_en` and `name_he` (bilingual names)
- `id` (Neon DB ID, different from Firebase ID)
- `parentId` (for hierarchy)
- `level` (0, 1, or 2)

## Important Note: Categories Can Have Multiple Parents

⚠️ **A category name like "Pumps" can exist under different parents:**

- "Pumps" under "Shoes" (Women → Shoes → Pumps)
- "Pumps" under "Outlet" (Women → Outlet → Pumps)

So we **must resolve using the hierarchy path**, not just by name!

## Translation Strategy

We need to:

1. **Resolve Firebase IDs → Category Names** using `categories_path_id` array (preserves hierarchy)
2. **Look up Hebrew names** from categories table by English name + parent relationship
3. **Store Hebrew names** in new `category_he`, `subCategory_he`, `subSubCategory_he` fields

## Category Name Translations (from Categories Table)

### Main Categories (Level 0)

| English   | Hebrew  |
| --------- | ------- |
| Women     | נשים    |
| Men       | גברים   |
| Home      | בית     |
| About     | אודות   |
| Contact   | צרו קשר |
| discounts | מבצעים  |

### Sub Categories (Level 1)

| English     | Hebrew   | Parent |
| ----------- | -------- | ------ |
| Shoes       | נעליים   | Women  |
| Accessories | אקססוריז | Women  |
| Outlet      | אאוטלט   | Women  |

### Sub-Sub Categories (Level 2)

| English           | Hebrew               | Parent          |
| ----------------- | -------------------- | --------------- |
| Pumps             | נעלי סירה            | Shoes           |
| Pumps             | נעלי סירה            | Outlet          |
| Ofxord            | אוקספורד             | Shoes or outlet |
| Sneakers          | סניקרס               | Shoes or outlet |
| moccasin          | מוקסין               | Shoes or outlet |
| Low Boots         | מגפונים              | Shoes or outlet |
| Flip Flops        | כפכפים               | Shoes or outlet |
| Sandals           | סנדלים               | Shoes or outlet |
| Ballerina & Flats | בלרינה וסירות שטוחות | Shoes or outlet |
| boots             | מגפיים               | Shoes or outlet |
| bags              | תיקים                | Accessories     |
| Coats             | מעילים               | Accessories     |

## Implementation Approach

### Recommended: Use categories_path_id Array

Products have `categories_path_id` array that contains Firebase category IDs in **hierarchy order**:

```
categories_path_id = ["Women_FirebaseID", "Shoes_FirebaseID", "Pumps_FirebaseID"]
```

**Resolution Logic:**

1. **For each product, resolve the path:**

   ```typescript
   // Get Firebase categories
   const firebaseCategories = await categoryService.getAllCategories();
   const firebaseCategoryMap = new Map<string, Category>();
   firebaseCategories.forEach((cat) => {
     if (cat.id) firebaseCategoryMap.set(cat.id, cat);
   });

   // Resolve path IDs to names
   const categoryPath = product.categories_path_id
     .map((firebaseId) => {
       const firebaseCat = firebaseCategoryMap.get(firebaseId);
       return firebaseCat
         ? {
             en:
               typeof firebaseCat.name === "object"
                 ? firebaseCat.name.en
                 : firebaseCat.name,
             he:
               typeof firebaseCat.name === "object"
                 ? firebaseCat.name.he
                 : firebaseCat.name,
           }
         : null;
     })
     .filter(Boolean);

   // Now we have: categoryPath[0] = {en: "Women", he: "נשים"}
   //              categoryPath[1] = {en: "Shoes", he: "נעליים"}
   //              categoryPath[2] = {en: "Pumps", he: "נעלי סירה"}
   ```

2. **Look up Hebrew names from Neon categories table:**

   ```typescript
   // For main category (level 0)
   const mainCategory = await prisma.category.findFirst({
     where: {
       name_en: categoryPath[0].en,
       level: 0,
     },
   });
   const category_he = mainCategory?.name_he || null;

   // For sub category (level 1) - match by name AND parent
   const subCategory = await prisma.category.findFirst({
     where: {
       name_en: categoryPath[1].en,
       level: 1,
       parentId: mainCategory?.id,
     },
   });
   const subCategory_he = subCategory?.name_he || null;

   // For sub-sub category (level 2) - match by name AND parent
   const subSubCategory = await prisma.category.findFirst({
     where: {
       name_en: categoryPath[2].en,
       level: 2,
       parentId: subCategory?.id,
     },
   });
   const subSubCategory_he = subSubCategory?.name_he || null;
   ```

3. **Store in products table:**
   ```typescript
   productData = {
     category: categoryPath[0].en, // "Women"
     category_he: categoryPath[0].he, // "נשים"
     subCategory: categoryPath[1]?.en || null, // "Shoes"
     subCategory_he: categoryPath[1]?.he || null, // "נעליים"
     subSubCategory: categoryPath[2]?.en || null, // "Pumps"
     subSubCategory_he: categoryPath[2]?.he || null, // "נעלי סירה"
   };
   ```

## Why This Works

✅ **Preserves hierarchy** - Uses `categories_path_id` array which maintains the correct parent-child relationship

✅ **Handles duplicates** - "Pumps" under "Shoes" vs "Pumps" under "Outlet" are resolved correctly

✅ **Bilingual search** - Both English and Hebrew names stored, search works in both languages

✅ **Fast lookup** - Hebrew names stored directly in products table, no JOINs needed for search

## Example

**Product with:**

```
categories_path_id = ["Women_FB_ID", "Shoes_FB_ID", "Pumps_FB_ID"]
```

**Resolved to:**

```
category = "Women"           | category_he = "נשים"
subCategory = "Shoes"        | subCategory_he = "נעליים"
subSubCategory = "Pumps"     | subSubCategory_he = "נעלי סירה"
```

**Search for "נעלי סירה"** → Finds products with `subSubCategory_he = "נעלי סירה"` ✅
