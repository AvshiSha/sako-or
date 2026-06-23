interface HomeHeroLinksProps {
  lng: 'en' | 'he'
}

export default function HomeHeroLinks({ lng }: HomeHeroLinksProps) {
  return (
    <div className="relative h-full flex flex-col items-center text-center">
      <div className="absolute bottom-[15%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight text-center uppercase">
          SAKO OR
        </h1>
      </div>
      <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex flex-row justify-center items-center px-4">
        <span className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4">
          {lng === 'he' ? 'לצפייה' : 'Shop now'}
        </span>
      </div>
    </div>
  )
}
