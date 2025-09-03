# Adding New Languages to SAKO-OR

This document explains how to extend the locale system to support additional languages.

## Current Languages

- **English (en)**: Default language, LTR direction
- **Hebrew (he)**: RTL direction

## Adding a New Language

### 1. Update Language Settings

Edit `i18n/settings.ts`:

```typescript
export const languages = ["en", "he", "ar"] as const; // Add new language code

export const languageMetadata = {
  en: {
    /* existing */
  },
  he: {
    /* existing */
  },
  ar: {
    // New language
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
    flag: "🇸🇦",
  },
} as const;
```

### 2. Create Translation File

Create `public/assets/i18n/ar.json`:

```json
{
  "navigation": {
    "home": "الرئيسية",
    "newCollection": "مجموعة جديدة",
    "women": "نساء",
    "men": "رجال",
    "about": "حول",
    "contact": "اتصل بنا"
  }
  // ... rest of translations
}
```

### 3. Update Components

Components will automatically support the new language through:

- `useLanguage()` hook
- `languageMetadata` object
- Dynamic routing with `[lng]` segment

### 4. Test the New Language

Visit `/ar` to test the new language support.

## Language Metadata Properties

Each language must have:

- `name`: English name of the language
- `nativeName`: Name in the language itself
- `direction`: 'ltr' or 'rtl'
- `flag`: Emoji flag representation

## RTL Language Considerations

For RTL languages like Arabic:

1. **CSS Classes**: Use `isRTL` helper from `useLanguage()`
2. **Text Alignment**: Apply `text-right` or `text-left` conditionally
3. **Margins/Padding**: Use `mr-` vs `ml-` conditionally
4. **Icons**: Flip icons horizontally if needed

## Example Usage

```typescript
import { useLanguage } from "@/app/hooks/useLanguage";

export default function MyComponent() {
  const { lng, isRTL, direction } = useLanguage();

  return (
    <div
      className={`text-${isRTL ? "right" : "left"}`}
      dir={direction}
      lang={lng}
    >
      {/* Component content */}
    </div>
  );
}
```

## Best Practices

1. **Always use the `useLanguage()` hook** instead of accessing params directly
2. **Test RTL languages thoroughly** - layout can break easily
3. **Keep translation keys consistent** across all languages
4. **Use semantic HTML attributes** (`dir`, `lang`) for accessibility
5. **Consider cultural differences** in UI/UX design
