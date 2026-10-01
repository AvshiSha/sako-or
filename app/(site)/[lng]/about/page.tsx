import Image from 'next/image'
import { getImageUrl } from '@/lib/image-urls'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { languages } from '@/i18n/settings'
import { listFeaturedReviews } from '@/lib/reviews/featured-reviews'
import ReviewMarquee from '@/app/components/ReviewMarquee'

/**
 * About, rebuilt on the SAKO OR — Update design system (Figma
 * Q7WqJRF5rqxc4V7zqdpQUM).
 *
 * There is no About frame in the file, so nothing here is traced from an
 * artboard. Every block is instead assembled from constructions that were
 * approved on other screens, so the page is composed rather than invented:
 *
 *   - the cover band is the blog cover story's two-track geometry (438:3315) -
 *     42.5% text beside 57.5% image, 740px, text column first in the DOM so RTL
 *     lays it on the right and /en mirrors it;
 *   - the ruled section header is the blog list's (438:3332) - heading on the
 *     inline start, a label opposite, hairline above and below;
 *   - each chapter is the home page's About band (438:3234) - the label column
 *     on the inline start, the copy opposite - ruled off like the Legal
 *     documents' blocks (438:4148 / 438:4153).
 *
 * Type is the documented scale and nothing else: H2 116/100 for the title, H6
 * 48/34.56 for the section heading and the closing line, Price/Strong 20 Black
 * for chapter headings, Paragraph/Large 21/32.55 for the standfirst and lead,
 * Body/Regular 16 for chapter copy, Label/DemiBold 12 at 1.2px tracking for the
 * ordinals. No rounded corners, no shadows, no gradients - the page it replaces
 * had all three and none of them exist in this system.
 *
 * Direction is inherited from the `dir` the [lng] layout puts on <html>, never
 * resolved per node, matching LegalPage: copy that opens on the Latin brand
 * name would otherwise flip a whole Hebrew block to LTR.
 *
 * Copy is unchanged from the page this replaces; only its arrangement and the
 * ordinals are new. The eyebrow and title deliberately repeat the home page's
 * About teaser (HomeAboutSection, "ABOUT US / 01"), which links here.
 */

/** 3:2 at 6240x4160, so the cover crop has resolution to spare at any width. */
const COVER_IMAGE = '/images/about/crafting(2).webp'

const translations = {
  en: {
    title: 'About SAKO-OR',
    eyebrow: 'ABOUT US / 01',
    subtitle:
      'A name that represents quality, style, and tradition of over 50 years in the fashion industry.',
    storyTitle: 'Our story',
    storyRange: '1977 — TODAY',
    reviewsTitle: 'In their words',
    reviewsLabel: 'FROM OUR CUSTOMERS',
    intro:
      'Our story begins in 1977, when Moshe Shacharbani from Ness Ziona founded SAKO-OR out of love for the art of leather and meticulous craftsmanship. From the beginning, we focused on creating unique leather bags and handcrafted fashion accessories that combine classic design with uncompromising quality.',
    theBeginnings: 'The Beginning',
    beginningsText:
      'Success was not long in coming – and in the first year alone, we expanded our product range to include leather shoes and sandals, which quickly became symbols of comfort and elegance.',
    theExpansion: 'Global Expansion',
    expansionText:
      'During the 1990s, to provide our customers with the best, we began manufacturing our products in leading factories in Italy and Spain, where Italian-Spanish technology and tradition meet meticulous design with first-class materials. In the early 2000s, we expanded production to China, with strict quality control and technological innovation.',
    theGrowth: 'Retail Excellence',
    growthText:
      'In the first two decades of this century, we operated a network of 12 stores in major cities such as Tel Aviv, Haifa, Jerusalem, and Rishon LeZion, providing personalized service and a unique shopping experience for our customers.',
    theEvolution: 'Digital Transformation',
    evolutionText:
      'At the beginning of 2020, with a strategic vision for market trends and customer preferences, we decided to focus our operations and adapt to the digital age. We closed most stores and kept the flagship branch in Rishon LeZion, alongside a significant strengthening of online sales at sako-or.com, to offer customers a convenient, fast, and secure shopping experience from anywhere.',
    today: 'Today',
    todayText:
      'Today, under the management of Moshe Shacharbani, SAKO-OR continues to lead in the field with products of the highest quality, meticulous design, and advanced technology, accompanying our customers in every moment of daily life – from city walks to special events.',
    closing: 'SAKO-OR – The choice of those who appreciate quality, design, and tradition.',
  },
  he: {
    title: 'אודות סכו עור',
    eyebrow: 'ABOUT US / 01',
    subtitle: 'שם שמייצג איכות, סטייל ומסורת של למעלה מ-50 שנה בתחום האופנה.',
    storyTitle: 'הסיפור שלנו',
    storyRange: '1977 — היום',
    reviewsTitle: 'הלקוחות שלנו מספרים',
    reviewsLabel: 'מתוך ביקורות באתר',
    intro:
      'הסיפור שלנו מתחיל ב-1977, כאשר משה שהרבני מנס ציונה הקים את סכו עור מתוך אהבה לאמנות העור וליצירה מוקפדת. מהתחלה, התמקדנו ביצור תיקי עור ייחודיים ואביזרי אופנה בעבודת יד, שמשלבים בין עיצוב קלאסי לאיכות בלתי מתפשרת.',
    theBeginnings: 'ההתחלה',
    beginningsText:
      'ההצלחה לא איחרה לבוא – ובשנה הראשונה בלבד הרחבנו את מגוון המוצרים לנעליים וסנדלים מעור, שהפכו במהרה לסמל של נוחות ואלגנטיות.',
    theExpansion: 'ההתרחבות הגלובלית',
    expansionText:
      'במהלך שנות ה-90, כדי להעניק ללקוחותינו את הטוב ביותר, התחלנו לייצר את מוצרינו במפעלים מובילים באיטליה ובספרד, שם הטכנולוגיה והמסורת האיטלקית-ספרדית מפגישות בין עיצוב מוקפד לחומרים מהשורה הראשונה. בתחילת שנות ה-2000 הרחבנו את הייצור לסין, תוך הקפדה קפדנית על בקרת איכות וחדשנות טכנולוגית.',
    theGrowth: 'מצוינות קמעונאית',
    growthText:
      'בשני העשורים הראשונים של המאה הנוכחית פעלנו ברשת של 12 חנויות בערים מרכזיות כגון תל אביב, חיפה, ירושלים וראשון לציון, והענקנו שירות אישי וחוויית קנייה ייחודית ללקוחותינו.',
    theEvolution: 'הטרנספורמציה הדיגיטלית',
    evolutionText:
      'בתחילת שנת 2020, מתוך ראייה אסטרטגית למגמות השוק והעדפות הלקוחות, החלטנו למקד את פעילותנו ולהתאים את עצמנו לעידן הדיגיטלי. סגרנו את רוב החנויות, והשארנו את סניף הדגל בראשון לציון, לצד חיזוק משמעותי של מכירות און-ליין באתר sako-or.com, כדי להציע ללקוחות חוויית קנייה נוחה, מהירה ובטוחה מכל מקום.',
    today: 'היום',
    todayText:
      'כיום, תחת ניהולו של משה שהרבני, סכו עור ממשיכה להוביל בתחום עם מוצרים באיכות הגבוהה ביותר, עיצוב מוקפד וטכנולוגיה מתקדמת, ומלווה את לקוחותיה בכל רגע בחיי היום-יום – מהליכה בעיר ועד לאירועים מיוחדים.',
    closing: 'סכו עור – הבחירה של מי שמעריך איכות, עיצוב ומסורת.',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const t = translations[locale] || translations.en

  const title = locale === 'he' ? 'אודות סכו עור | SAKO-OR' : 'About SAKO-OR | SAKO-OR'

  return buildMetadata({
    title,
    description: t.subtitle,
    url: `/${lng}/about`,
    image: getImageUrl(COVER_IMAGE),
    type: 'website',
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({ locale: altLng, url: `/${altLng}/about` })),
  })
}

export default async function About({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const t = translations[locale] || translations.en

  // Curated in /admin/reviews ("Feature on About"). Returns [] if nothing is
  // featured or the database is unreachable, and the band then renders nothing -
  // the story above it is the page, and it must not depend on this query.
  const featuredReviews = await listFeaturedReviews(locale)

  /** 438:4148 numbers its blocks 01-04; the story runs to five. */
  const chapters = [
    { n: '01', heading: t.theBeginnings, body: t.beginningsText },
    { n: '02', heading: t.theExpansion, body: t.expansionText },
    { n: '03', heading: t.theGrowth, body: t.growthText },
    { n: '04', heading: t.theEvolution, body: t.evolutionText },
    { n: '05', heading: t.today, body: t.todayText },
  ]

  return (
    <div className="bg-surface-secondary">
      {/* Cover band - 438:3315's geometry. Text column first so RTL puts it on
          the right, as the blog frame draws it, and /en mirrors it. */}
      <section className="flex flex-col-reverse lg:grid lg:min-h-[740px] lg:grid-cols-[42.5%_57.5%]">
        <div className="flex flex-col items-start p-[16px] sm:p-[30px] lg:p-[54px]">
          {/* 438:3319 - Latin in both languages. */}
          <p className="font-ploni text-[14px] leading-[23.1px] tracking-[1.96px] text-text-primary">
            {t.eyebrow}
          </p>

          <div className="flex flex-1 flex-col justify-end pt-[24px] lg:pt-0">
            <h1 className="pb-[22px] font-ploni text-[48px] font-black leading-[44px] text-start text-text-primary md:text-[72px] md:leading-[66px] lg:text-[116px] lg:leading-[100px]">
              {t.title}
            </h1>
          </div>

          <div className="w-full py-[14px]">
            <p className="font-ploni text-[16px] leading-[26px] text-start text-text-primary lg:text-[21px] lg:leading-[32.55px]">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* 3:2 source in a 1.342 slot, so object-cover needs 1.5/1.342 = 1.12x
            the box width above lg, where the band's height is pinned at 740px
            and the needed width is therefore a constant 740 * 1.5 = 1110px. */}
        <div className="relative aspect-[3/2] w-full lg:aspect-auto lg:h-[740px]">
          <Image
            src={getImageUrl(COVER_IMAGE)}
            alt=""
            fill
            priority
            quality={85}
            sizes="(min-width: 1024px) 1110px, 150vw"
            className="object-cover"
          />
        </div>
      </section>

      {/* 438:3332 - heading on the inline start, label opposite, ruled above.
          The rule below comes from the lead block's own border-t. */}
      <header className="flex items-end justify-between gap-[16px] border-t border-sako-black px-[16px] py-[20px] lg:px-[36px] lg:py-[33px]">
        <h2 className="font-ploni text-[32px] font-black leading-[28px] text-text-primary lg:text-[48px] lg:leading-[34.56px]">
          {t.storyTitle}
        </h2>
        <p className="shrink-0 border-b border-border-default pb-[6px] font-ploni text-[12px] font-semibold tracking-[1.2px] text-text-primary">
          {t.storyRange}
        </p>
      </header>

      {/* Lead paragraph - Paragraph/Large, no ordinal, the way the Legal frames
          keep a document's opening copy in the heading block rather than in a
          numbered section. */}
      <div className="border-t border-sako-black px-[16px] py-[30px] lg:px-[36px] lg:py-[45px]">
        <p className="max-w-[1000px] font-ploni text-[17px] leading-[26px] text-start text-text-primary lg:text-[21px] lg:leading-[32.55px]">
          {t.intro}
        </p>
      </div>

      {chapters.map((c) => (
        <article
          key={c.n}
          className="grid grid-cols-1 gap-x-[60px] gap-y-[14px] border-t border-sako-black px-[16px] py-[30px] lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:px-[36px] lg:py-[45px]"
        >
          <div className="flex flex-col gap-[10px]">
            <p className="font-ploni text-[12px] font-semibold tracking-[1.2px] text-text-secondary">
              {c.n}
            </p>
            <h3 className="font-ploni text-[20px] font-black text-start text-text-primary">
              {c.heading}
            </h3>
          </div>
          {/* Capped at 760px: the chapter grid's second track runs to ~1300px at
              1728, and a 1300px measure is unreadable. The air that leaves on
              the inline end is the same air 438:3315 leaves around its heading. */}
          <p className="max-w-[760px] font-ploni text-[16px] leading-[26px] text-start text-text-primary">
            {c.body}
          </p>
        </article>
      ))}

      {/* Customer reviews, between the last chapter and the closing line: the
          story ends on "today", the customers answer it, and the brand line
          signs off. Curated per review in /admin/reviews. */}
      <ReviewMarquee
        reviews={featuredReviews}
        heading={t.reviewsTitle}
        label={t.reviewsLabel}
      />

      {/* Closing - the page's one inverse block. ink-900 and text-inverse are
          the system's dark pairing (438:3338's grid ground, 438:3371's labels);
          H6 is the largest size the scale offers below the page title. */}
      <section className="border-t border-sako-black bg-surface-dark px-[16px] py-[45px] lg:px-[36px] lg:py-[72px]">
        <p className="max-w-[1100px] font-ploni text-[28px] font-black leading-[30px] text-start text-text-inverse lg:text-[48px] lg:leading-[54px]">
          {t.closing}
        </p>
      </section>
    </div>
  )
}
