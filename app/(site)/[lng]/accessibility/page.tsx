'use client'

import React from 'react'
import LegalPage, { LEGAL_ORDINALS, LegalSection } from '@/app/components/LegalPage'

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

  // Laid out from the Legal frames (438:4141 / 438:3872): the numbered heading
  // block, then one hairline-ruled block per section. The tinted info panels the
  // previous layout used - blue for "how to switch", green for improvements,
  // yellow for exclusions - are gone; the frames carry no panel, and the design
  // system has no tint for one. The back link went with them, since the site
  // header above already goes home.
  return (
    <LegalPage
      ordinal={LEGAL_ORDINALS.accessibility}
      title={t.title}
      lastUpdated={t.lastUpdated}
      body={
        <>
          <p>{t.introduction}</p>
          <p>{t.commitment}</p>
          <p>{t.implementation}</p>
          <p>{t.technicalDetails}</p>
        </>
      }
    >
      <LegalSection title={t.howToUse.title}>
        <p>{t.howToUse.content}</p>
        <p>{t.howToUse.revert}</p>
        <p>{t.howToUse.recommendations}</p>
      </LegalSection>

      <LegalSection title={t.improvements.title}>
        <p>{t.improvements.content}</p>
        <h3 className="font-bold">
          {isRTL ? 'פונקציונליות תוכנת נגישות:' : 'Accessibility Software Functionality:'}
        </h3>
        <ul className="grid list-disc gap-x-[30px] gap-y-[2px] ps-[18px] md:grid-cols-2">
          {t.improvements.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t.exclusions.title}>
        <p>{t.exclusions.content}</p>
      </LegalSection>

      <LegalSection title={t.contact.title}>
        <p>{t.contact.content}</p>
        <p>{t.contact.commitment}</p>
        <h3 className="font-bold">
          {isRTL
            ? 'על מנת שנוכל לטפל בבעיה בדרך הטובה ביותר, אנו ממליצים מאוד לצרף פרטים מלאים ככל שניתן:'
            : 'To help us address the issue in the best way possible, we highly recommend including complete details such as:'}
        </h3>
        <ul className="list-disc ps-[18px]">
          {t.contact.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <p className="font-bold">
          {isRTL ? 'רכז נגישות:' : 'Accessibility Coordinator:'}
        </p>
        <p>{t.contact.contactPerson}</p>
        <a
          href={`mailto:${t.contact.email}`}
          className="underline underline-offset-2 transition-opacity hover:opacity-70"
        >
          {t.contact.email}
        </a>
      </LegalSection>
    </LegalPage>
  )
}
