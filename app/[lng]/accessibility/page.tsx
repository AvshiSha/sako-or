'use client'

import React from 'react'
import Link from 'next/link'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Accessibility Statement',
    lastUpdated: 'Date of Accessibility Statement Update: 05-10-2025',
    introduction: 'Sako-Or LTD, operating and managing the https://www.sako-or.com, is committed to ensuring the accessibility of its digital services to all citizens, with a special emphasis on improving access for individuals with disabilities.',
    
    commitment: 'Significant resources have been allocated to guarantee the accessibility of our website, aiming to enhance the experience for individuals with diverse needs, including but not limited to motor disabilities, cognitive impairments, myopia, blindness or color blindness, hearing impairments, and the elderly population.',
    
    implementation: 'The implementation of website accessibility has been carried out by "VEE - Website Accessibility." Our website has been optimized for accessibility at level AA, adhering to the guidelines established by the Equal Rights for Persons with Disabilities Regulations WCAG2.2.',
    
    technicalDetails: 'Vee Company, the provider of website accessibility solutions, has ensured compatibility with popular web browsers and mobile devices. Extensive testing has been conducted using Jaws and NVDA screen readers. Additionally, we have implemented WCAG2.2 recommendations by the W3C organization to further enhance accessibility standards.',
    
    howToUse: {
      title: 'How to Switch to Accessible Mode',
      content: 'Our website facilitates a straightforward process to switch to accessible mode. An accessibility icon is prominently placed on each webpage. Clicking on the icon opens the accessibility menu, allowing users to select desired accessibility functions. Please allow the page to load after making your selection to ensure the appropriate changes are applied.',
      revert: 'To revert the changes, simply click on the corresponding function in the menu again. Resetting the accessibility settings is also an option. The accessibility software is compatible with popular web browsers, such as Chrome, Firefox, Safari, and Opera.',
      recommendations: 'For an optimal experience with screen reader software, we recommend using the latest version of NVDA. The website\'s design includes a semantic structure supporting assistive technologies and adheres to accepted usage patterns for keyboard navigation.'
    },
    
    improvements: {
      title: 'Accessibility Improvements Made',
      content: 'Several improvements have been made to enhance accessibility on the site, including adaptation for screen readers, clear and intuitive navigation, organized content presentation, optimization for modern web browsers, compatibility with various screen sizes, and consistent structure across all pages. Alt text has been included for all images.',
      features: [
        'Adaptation for screen readers',
        'Flickering prevention',
        'Direct content access',
        'Keyboard navigation adjustment',
        'Text size adjustment',
        'Enhanced spacing',
        'Contrast and color options',
        'Legible font selection',
        'Highlighting links',
        'Reading guide',
        'Customizable mouse cursor',
        'Image descriptions'
      ]
    },
    
    exclusions: {
      title: 'Exclusions',
      content: 'While diligent efforts have been made to ensure the accessibility of all pages and elements, it is acknowledged that there may still be instances where certain parts or functionalities are not fully accessible. Continuous efforts are underway to enhance accessibility and ensure inclusivity for all individuals, including those with disabilities.'
    },
    
    contact: {
      title: 'Contact Us',
      content: 'If you encounter accessibility issues on the website, please contact us with complete details, including a problem description, the action you attempted, the link to the page you browsed, browser type and version, operating system, and the type of assistive technology used.',
      commitment: 'Sako-Or LTD is committed to addressing accessibility concerns promptly and professionally.',
      details: [
        'Problem description',
        'The action you attempted',
        'The link to the page you browsed',
        'Browser type and version',
        'Operating system',
        'Type of assistive technology used'
      ],
      contactPerson: 'אבשלום שהרבאני',
      email: 'avshi@sako-or.com'
    },
    
    backToHome: 'Back to Home'
  },
  he: {
    title: 'הצהרת נגישות',
    lastUpdated: 'תאריך עדכון הצהרת נגישות 05-10-2025',
    introduction: 'סכו עור בע, אחראית על הקמת והפעלת אתר https://www.sako-or.com. אנו רואים חשיבות רבה במתן שירות שוויוני לכלל האזרחים ובשיפור השירות הניתן לאזרחים עם מוגבלות.',
    
    commitment: 'אנו משקיעים משאבים רבים בהנגשת האתר והנכסים הדיגיטליים שלנו על מנת להפוך את שירותי החברה לזמינים יותר עבור אנשים עם מוגבלות. במדינת ישראל כ-20 אחוזים מקרב האוכלוסייה הינם אנשים עם מוגבלות הזקוקים לנגישות דיגיטלית, על מנת לצרוך מידע ושירותים כללים. הנגשת האתר של סכו עור בע, נועדה להפוך אותו לזמין, ידידותי ונוח יותר לשימוש עבור אוכלוסיות עם צרכים מיוחדים, הנובעים בין היתר ממוגבלויות מוטוריות שונות, לקויות קוגניטיביות, קוצר רואי, עיוורון או עיוורון צבעים, לקויות שמיעה וכן אוכלוסייה הנמנית על בני הגיל השלישי.',
    
    implementation: 'הנגשת אתר זה בוצעה על ידי חברת הנגשת האתרים "Vee הנגשת אתרים". רמת הנגישות באתר - AA',
    
    technicalDetails: 'חברת "Vee", התאימה את נגישות האתר לדפדפנים הנפוצים ולשימוש בטלפון הסלולרי ככל הניתן, והשתמשה בבדיקותיה בקוראי מסך מסוג Jaws ו- NVDA. מקפידה על עמידה בדרישות תקנות שוויון זכויות לאנשים עם מוגבלות 5568 התשע"ג 2013 ברמת AA. וכן, מיישמת את המלצות מסמך WCAG2.2 מאת ארגון W3C. בעברית: הנחיות לנגישות תכנים באינטרנט. באנגלית: Web Content Accessibility Guidelines (WCAG) 2.0. הנגשת האתר בוצעה בהתאם להנחיות רשות התקשוב להנגשת יישומים בדפדפני אינטרנט.',
    
    howToUse: {
      title: 'כיצד עוברים למצב נגיש?',
      content: 'באתר מוצב אייקון נגישות (בד"כ בדפנות האתר). לחיצה על האייקון מאפשרת פתיחת של תפריט הנגישות. לאחר בחירת הפונקציה המתאימה בתפריט יש להמתין לטעינת הדף ולשינוי הרצוי בתצוגה (במידת הצורך).',
      revert: 'במידה ומעוניינים לבטל את הפעולה, יש ללחוץ על הפונקציה בתפריט פעם שניה. בכל מצב, ניתן לאפס הגדרות נגישות. התוכנה פועלת בדפדפנים הפופולריים: Chrome, Firefox, Safari, Opera בכפוף (תנאי יצרן) הגלישה במצב נגישות מומלצת בדפדפן כרום.',
      recommendations: 'האתר מספק מבנה סמנטי עבור טכנולוגיות מסייעות ותמיכה בדפוס השימוש המקובל להפעלה עם מקלדת בעזרת מקשי החיצים, Enter ו- Esc ליציאה מתפריטים וחלונות. לצורך קבלת חווית גלישה מיטבית עם תוכנת הקראת מסך, אנו ממליצים לשימוש בתוכנת NVDA העדכנית ביותר.'
    },
    
    improvements: {
      title: 'תיקונים והתאמות שבוצעו באתר:',
      content: 'התאמה לקורא מסך - התאמת האתר עבור טכנולוגיות מסייעות כגון NVDA , JAWS. אמצעי הניווט באתר פשוטים וברורים. תכני האתר כתובים באופן ברור, מסודר והיררכי. האתר מותאם לצפייה בדפדפנים מודרניים. התאמת האתר לתצוגה תואמת מגוון מסכים ורזולוציות. כל הדפים באתר בעלי מבנה קבוע (1H/2H/3H וכו\'). לכל התמונות באתר יש הסבר טקסטואלי חלופי (alt).',
      features: [
        'התאמה לקורא מסך - התאמת האתר עבור טכנולוגיות מסייעות כגון NVDA , JAWS',
        'עצירת הבהובים - עצירת אלמנטים נעים וחסימת אנימציות',
        'דילוג ישיר לתוכן - דילוג על התפריט הראשי ישירות אל התוכן',
        'התאמה לניווט מקלדת',
        'הגדלה / הקטנה של טקסט',
        'ריווח בין אותיות / מילים / שורות',
        'ניגודיות וצבע - גבוהה, הפוכה, שחור לבן',
        'גופן קריא',
        'הדגשת קישורים',
        'מדריך קריאה',
        'שינוי אייקון סמן עכבר',
        'תיאור לתמונות'
      ]
    },
    
    exclusions: {
      title: 'החרגות',
      content: 'חשוב לציין, כי למרות מאמצינו להנגיש את כלל הדפים והאלמנטים באתר, ייתכן שיתגלו חלקים או יכולות שלא הונגשו כראוי או שטרם הונגשו. אנו פועלים לשפר את נגישות האתר שלנו כל העת, כחלק ממחויבותנו לאפשר לכלל האוכלוסייה להשתמש בו, כולל אנשים עם מוגבלות.'
    },
    
    contact: {
      title: 'יצירת קשר בנושא נגישות',
      content: 'במידה ונתקלתם בבעיה בנושא נגישות באתר, נשמח לקבל הערות ובקשות באמצעות פנייה לרכז הנגישות שלנו:',
      commitment: 'סכו עור בע תעשה ככל יכולה על מנת להנגיש את האתר בצורה המיטבית ולענות לפניות בצורה המקצועית והמהירה ביותר.',
      details: [
        'תיאור הבעיה',
        'מהי הפעולה שניסיתם לבצע',
        'קישור לדף שבו גלשתם',
        'סוג הדפדפן וגרסתו',
        'מערכת הפעלה',
        'סוג הטכנולוגיה המסייעת (במידהתמשתם)'
      ],
      contactPerson: 'אבשלום שהרבאני',
      email: 'avshi@sako-or.com'
    },
    
    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function AccessibilityStatement({ params }: { params: Promise<{ lng: string }> }) {
  const [lng, setLng] = React.useState<string>('en')
  
  // Initialize language from params
  React.useEffect(() => {
    params.then(({ lng: language }) => {
      setLng(language)
    })
  }, [params])
  
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  return (
    <div className={`bg-white pt-16 min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link 
            href={`/${lng}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200"
          >
            <svg className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
            {t.backToHome}
          </Link>
          
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            {t.title}
          </h1>
          <p className="text-gray-500 text-sm">
            {t.lastUpdated}
          </p>
        </div>

        {/* Introduction */}
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {t.introduction}
          </p>
        </div>

        {/* Commitment */}
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {t.commitment}
          </p>
        </div>

        {/* Implementation */}
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {t.implementation}
          </p>
        </div>

        {/* Technical Details */}
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {t.technicalDetails}
          </p>
        </div>

        {/* How to Use */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {t.howToUse.title}
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            {t.howToUse.content}
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed">
            {t.howToUse.revert}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t.howToUse.recommendations}
          </p>
        </div>

        {/* Improvements */}
        <div className="mb-8 p-6 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {t.improvements.title}
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            {t.improvements.content}
          </p>
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            {isRTL ? 'פונקציונליות תוכנת נגישות:' : 'Accessibility Software Functionality:'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {t.improvements.features.map((feature, index) => (
              <div key={index} className="flex items-center text-gray-700">
                <svg className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exclusions */}
        <div className="mb-8 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {t.exclusions.title}
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {t.exclusions.content}
          </p>
        </div>

        {/* Contact Information */}
        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {t.contact.title}
          </h2>
          <p className="text-gray-700 mb-4">
            {t.contact.content}
          </p>
          <p className="text-gray-700 mb-4">
            {t.contact.commitment}
          </p>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              {isRTL ? 'על מנת שנוכל לטפל בבעיה בדרך הטובה ביותר, אנו ממליצים מאוד לצרף פרטים מלאים ככל שניתן:' : 'To help us address the issue in the best way possible, we highly recommend including complete details such as:'}
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {t.contact.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-gray-700 mb-2">
              <strong>{isRTL ? 'רכז נגישות:' : 'Accessibility Coordinator:'}</strong>
            </p>
            <p className="text-gray-700 mb-2">{t.contact.contactPerson}</p>
            <a 
              href={`mailto:${t.contact.email}`}
              className="text-gray-900 hover:text-gray-600 transition-colors duration-200"
            >
              {t.contact.email}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
