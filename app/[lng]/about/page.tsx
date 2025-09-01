// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'About SAKO-OR',
    description: 'Discover the story behind our commitment to luxury footwear and exceptional craftsmanship.',
    mission: {
      title: 'Our Mission',
      description: 'To provide discerning customers with the finest footwear, combining European artistry with innovative design.'
    },
    vision: {
      title: 'Our Vision',
      description: 'To become the premier destination for luxury footwear, setting new standards in quality and style.'
    },
    heritage: 'Our Heritage',
    heritageText: 'Founded with a passion for excellence, SAKO-OR represents the pinnacle of footwear craftsmanship. Our journey began with a simple belief: that every step should be taken in comfort and style.',
    craftsmanship: 'Artisanal Craftsmanship',
    craftsmanshipText: 'Each piece in our collection is meticulously crafted by skilled artisans who have dedicated their lives to perfecting their craft. We source only the finest materials from around the world.'
  },
  he: {
    title: 'אודות סאקו אור',
    description: 'גלה את הסיפור מאחורי המחויבות שלנו לנעליים יוקרתיות ואומנות יוצאת דופן.',
    mission: {
      title: 'המשימה שלנו',
      description: 'לספק ללקוחות בררניים את הנעליים הטובות ביותר, שילוב של אומנות אירופאית עם עיצוב חדשני.'
    },
    vision: {
      title: 'החזון שלנו',
      description: 'להיות היעד המוביל לנעליים יוקרתיות, לקבוע סטנדרטים חדשים באיכות וסגנון.'
    },
    heritage: 'המורשת שלנו',
    heritageText: 'נוסד עם תשוקה למצוינות, סאקו אור מייצג את שיא האומנות של נעליים. המסע שלנו התחיל באמונה פשוטה: שכל צעד צריך להילקח בנוחות וסגנון.',
    craftsmanship: 'אומנות אומנותית',
    craftsmanshipText: 'כל חלק באוסף שלנו מעוצב בקפידה על ידי אומנים מיומנים שהקדישו את חייהם לשיפור האומנות שלהם. אנחנו מקור רק החומרים הטובים ביותר מכל העולם.'
  }
}

export default async function About({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const t = translations[lng as keyof typeof translations]

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            {t.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 transform transition duration-300 hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t.mission.title}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t.mission.description}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 transform transition duration-300 hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t.vision.title}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t.vision.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-24 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              {t.heritage}
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              {t.heritageText}
            </p>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">
              {t.craftsmanship}
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed">
              {t.craftsmanshipText}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 