import Image from 'next/image'
import { getImageUrl } from '@/lib/image-urls'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'About SAKO-OR',
    subtitle: 'A name that represents quality, style, and tradition of over 45 years in the fashion industry.',
    intro: 'Our story begins in 1977, when Moshe Shacharbani from Ness Ziona founded SAKO-OR out of love for the art of leather and meticulous craftsmanship. From the beginning, we focused on creating unique leather bags and handcrafted fashion accessories that combine classic design with uncompromising quality.',
    theBeginnings: 'The Beginning',
    beginningsText: 'Success was not long in coming – and in the first year alone, we expanded our product range to include leather shoes and sandals, which quickly became symbols of comfort and elegance.',
    theExpansion: 'Global Expansion',
    expansionText: 'During the 1990s, to provide our customers with the best, we began manufacturing our products in leading factories in Italy and Spain, where Italian-Spanish technology and tradition meet meticulous design with first-class materials. In the early 2000s, we expanded production to China, with strict quality control and technological innovation.',
    theGrowth: 'Retail Excellence',
    growthText: 'In the first two decades of this century, we operated a network of 12 stores in major cities such as Tel Aviv, Haifa, Jerusalem, and Rishon LeZion, providing personalized service and a unique shopping experience for our customers.',
    theEvolution: 'Digital Transformation',
    evolutionText: 'At the beginning of 2020, with a strategic vision for market trends and customer preferences, we decided to focus our operations and adapt to the digital age. We closed most stores and kept the flagship branch in Rishon LeZion, alongside a significant strengthening of online sales at sako-or.com, to offer customers a convenient, fast, and secure shopping experience from anywhere.',
    today: 'Today',
    todayText: 'Today, under the management of Moshe Shacharbani, SAKO-OR continues to lead in the field with products of the highest quality, meticulous design, and advanced technology, accompanying our customers in every moment of daily life – from city walks to special events.',
    closing: 'SAKO-OR – The choice of those who appreciate quality, design, and tradition.'
  },
  he: {
    title: 'אודות סכו עור',
    subtitle: 'שם שמייצג איכות, סטייל ומסורת של למעלה מ-45 שנה בתחום האופנה.',
    intro: 'הסיפור שלנו מתחיל ב-1977, כאשר משה שהרבני מנס ציונה הקים את סכו עור מתוך אהבה לאמנות העור וליצירה מוקפדת. מהתחלה, התמקדנו ביצור תיקי עור ייחודיים ואביזרי אופנה בעבודת יד, שמשלבים בין עיצוב קלאסי לאיכות בלתי מתפשרת.',
    theBeginnings: 'ההתחלה',
    beginningsText: 'ההצלחה לא איחרה לבוא – ובשנה הראשונה בלבד הרחבנו את מגוון המוצרים לנעליים וסנדלים מעור, שהפכו במהרה לסמל של נוחות ואלגנטיות.',
    theExpansion: 'ההתרחבות הגלובלית',
    expansionText: 'במהלך שנות ה-90, כדי להעניק ללקוחותינו את הטוב ביותר, התחלנו לייצר את מוצרינו במפעלים מובילים באיטליה ובספרד, שם הטכנולוגיה והמסורת האיטלקית-ספרדית מפגישות בין עיצוב מוקפד לחומרים מהשורה הראשונה. בתחילת שנות ה-2000 הרחבנו את הייצור לסין, תוך הקפדה קפדנית על בקרת איכות וחדשנות טכנולוגית.',
    theGrowth: 'מצוינות קמעונאית',
    growthText: 'בשני העשורים הראשונים של המאה הנוכחית פעלנו ברשת של 12 חנויות בערים מרכזיות כגון תל אביב, חיפה, ירושלים וראשון לציון, והענקנו שירות אישי וחוויית קנייה ייחודית ללקוחותינו.',
    theEvolution: 'הטרנספורמציה הדיגיטלית',
    evolutionText: 'בתחילת שנת 2020, מתוך ראייה אסטרטגית למגמות השוק והעדפות הלקוחות, החלטנו למקד את פעילותנו ולהתאים את עצמנו לעידן הדיגיטלי. סגרנו את רוב החנויות, והשארנו את סניף הדגל בראשון לציון, לצד חיזוק משמעותי של מכירות און-ליין באתר sako-or.com, כדי להציע ללקוחות חוויית קנייה נוחה, מהירה ובטוחה מכל מקום.',
    today: 'היום',
    todayText: 'כיום, תחת ניהולו של משה שהרבני, סכו עור ממשיכה להוביל בתחום עם מוצרים באיכות הגבוהה ביותר, עיצוב מוקפד וטכנולוגיה מתקדמת, ומלווה את לקוחותיה בכל רגע בחיי היום-יום – מהליכה בעיר ועד לאירועים מיוחדים.',
    closing: 'סכו עור – הבחירה של מי שמעריך איכות, עיצוב ומסורת.'
  }
}

export default async function About({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const t = translations[lng as keyof typeof translations]
  const isRTL = lng === 'he'

  return (
    <div style={{ backgroundColor: '#F6F3ED' }} className="min-h-screen">
      {/* Hero Section with Image */}
      <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={getImageUrl("/images/about/crafting(2).webp")}
            alt={t.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />
        </div>
        <div className={`relative h-full flex items-center justify-center ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 tracking-tight">
              {t.title}
            </h1>
            <p className="text-xl md:text-2xl text-white font-light max-w-3xl">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-18">
        {/* Introduction */}
        <div className="mb-8 md:mb-18">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
            <p className={`text-lg md:text-xl text-gray-700 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.intro}
            </p>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="space-y-8">
          {/* The Beginning */}
          {/* <div className="relative w-full h-100 md:h-80 rounded-3xl overflow-hidden shadow-xl md:flex-1">
              <Image
                src={getImageUrl('/images/about/dad.png')}
                alt={t.theBeginnings}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div> */}
          <div className={`flex flex-col md:flex-row gap-4 md:gap-8 md:items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1">
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 h-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold text-xl">
                    1
                  </div>
                  
                  <h2 className={`text-3xl md:text-4xl font-light text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t.theBeginnings}
                  </h2>
                </div>
                <p className={`text-lg text-gray-700 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.beginningsText}
                </p>
              </div>
            </div>
          </div>

          {/* The Expansion */}
          <div className={`flex flex-col md:flex-row gap-8 items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            {/* <div className="flex-1 relative h-64 md:h-80 rounded-3xl overflow-hidden shadow-xl">
              <Image
                src={getImageUrl("/images/about/craftsmanship.jpg")}
                alt={t.theExpansion}
                fill
                className="object-cover"
              />
            </div> */}
            <div className="flex-1">
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 h-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold text-xl">
                    2
                  </div>
                  <h2 className={`text-3xl md:text-4xl font-light text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t.theExpansion}
                  </h2>
                </div>
                <p className={`text-lg text-gray-700 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.expansionText}
                </p>
              </div>
            </div>
          </div>

          {/* The Growth */}
          <div className={`flex flex-col md:flex-row gap-8 md:items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1">
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 h-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold text-xl">
                    3
                  </div>
                  <h2 className={`text-3xl md:text-4xl font-light text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t.theGrowth}
                  </h2>
                </div>
                <p className={`text-lg text-gray-700 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.growthText}
                </p>
              </div>
            </div>
            {/* <div className="flex-1 relative h-64 md:h-80 rounded-3xl overflow-hidden shadow-xl">
              <Image
                src={getImageUrl("/images/hero/main-hero.jpg")}
                alt={t.theGrowth}
                fill
                className="object-cover"
              />
            </div> */}
          </div>

          {/* The Evolution */}
          <div className={`flex flex-col md:flex-row gap-8 md:items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            {/* <div className="flex-1 relative h-64 md:h-80 rounded-3xl overflow-hidden shadow-xl">
              <Image
                src={getImageUrl("/images/hero/main-hero.jpg")}
                alt={t.theEvolution}
                fill
                className="object-cover"
              />
            </div> */}
            <div className="flex-1">
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 h-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-bold text-xl">
                    4
                  </div>
                  <h2 className={`text-3xl md:text-4xl font-light text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t.theEvolution}
                  </h2>
                </div>
                <p className={`text-lg text-gray-700 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.evolutionText}
                </p>
              </div>
            </div>
          </div>

          {/* Today */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-gray-800 rounded-3xl shadow-2xl p-8 md:p-12 text-white">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-white text-[#1a1a1a] flex items-center justify-center font-bold text-xl">
                5
              </div>
              <h2 className={`text-3xl md:text-4xl font-light ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.today}
              </h2>
            </div>
            <p className={`text-lg leading-relaxed opacity-90 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.todayText}
            </p>
          </div>
        </div>

        {/* Closing Statement */}
        <div className="mt-20 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 inline-block max-w-4xl">
            <p className={`text-2xl md:text-3xl font-light text-gray-900 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.closing}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 