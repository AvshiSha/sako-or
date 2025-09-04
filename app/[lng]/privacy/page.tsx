'use client'

import React from 'react'
import Link from 'next/link'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: January 2025',
    introduction: 'At SAKO-OR, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website.',
    
    sections: {
      informationCollection: {
        title: '1. Information We Collect',
        content: 'We collect information you provide directly to us, such as when you create an account, make a purchase, subscribe to our newsletter, or contact us for support. This may include your name, email address, shipping address, and payment information.'
      },
      informationUse: {
        title: '2. How We Use Your Information',
        content: 'We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and communicate with you about products, services, and promotional offers.'
      },
      informationSharing: {
        title: '3. Information Sharing and Disclosure',
        content: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this Privacy Policy. We may share your information with trusted third parties who assist us in operating our website and conducting our business.'
      },
      dataSecurity: {
        title: '4. Data Security',
        content: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.'
      },
      cookies: {
        title: '5. Cookies and Tracking Technologies',
        content: 'We use cookies and similar tracking technologies to enhance your experience on our website, analyze usage patterns, and personalize content. You can control cookie settings through your browser preferences.'
      },
      thirdPartyServices: {
        title: '6. Third-Party Services',
        content: 'Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing any personal information.'
      },
      dataRetention: {
        title: '7. Data Retention',
        content: 'We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.'
      },
      yourRights: {
        title: '8. Your Rights',
        content: 'You have the right to access, update, or delete your personal information. You may also opt out of receiving promotional communications from us at any time by following the unsubscribe instructions in our emails.'
      },
      childrenPrivacy: {
        title: '9. Children\'s Privacy',
        content: 'Our services are not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it.'
      },
      policyChanges: {
        title: '10. Changes to This Privacy Policy',
        content: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.'
      }
    },
    
    contact: {
      title: 'Contact Us',
      content: 'If you have any questions about this Privacy Policy or our privacy practices, please contact us at:',
      email: 'privacy@sako-or.com'
    },
    
    backToHome: 'Back to Home'
  },
  he: {
    title: 'מדיניות פרטיות',
    lastUpdated: 'עודכן לאחרונה: ינואר 2025',
    introduction: 'בסכו עור, אנו מחויבים להגן על הפרטיות שלכם ולהבטיח את האבטחה של המידע האישי שלכם. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם כאשר אתם מבקרים באתר שלנו.',
    
    sections: {
      informationCollection: {
        title: '1. מידע שאנו אוספים',
        content: 'אנו אוספים מידע שאתם מספקים לנו ישירות, כגון כאשר אתם יוצרים חשבון, מבצעים רכישה, נרשמים לניוזלטר שלנו, או פונים אלינו לתמיכה. זה עשוי לכלול את השם שלכם, כתובת אימייל, כתובת משלוח ומידע תשלום.'
      },
      informationUse: {
        title: '2. כיצד אנו משתמשים במידע שלכם',
        content: 'אנו משתמשים במידע שאנו אוספים כדי לספק, לתחזק ולשפר את השירותים שלנו, לעבד עסקאות, לשלוח לכם הודעות טכניות והודעות תמיכה, ולתקשר איתכם על מוצרים, שירותים והצעות פרסום.'
      },
      informationSharing: {
        title: '3. שיתוף וחשיפת מידע',
        content: 'אנו לא מוכרים, סוחרים או מעבירים אחרת את המידע האישי שלכם לצדדים שלישיים ללא הסכמתכם, למעט כפי שמתואר במדיניות פרטיות זו. אנו עשויים לשתף את המידע שלכם עם צדדים שלישיים מהימנים המסייעים לנו בהפעלת האתר שלנו ובניהול העסק שלנו.'
      },
      dataSecurity: {
        title: '4. אבטחת נתונים',
        content: 'אנו מיישמים אמצעי אבטחה מתאימים כדי להגן על המידע האישי שלכם מפני גישה לא מורשית, שינוי, חשיפה או הרס. עם זאת, אין שיטת העברה דרך האינטרנט או אחסון אלקטרוני שהיא מאובטחת ב-100%.'
      },
      cookies: {
        title: '5. עוגיות וטכנולוגיות מעקב',
        content: 'אנו משתמשים בעוגיות וטכנולוגיות מעקב דומות כדי לשפר את החוויה שלכם באתר שלנו, לנתח דפוסי שימוש ולהתאים תוכן אישית. אתם יכולים לשלוט בהגדרות העוגיות דרך העדפות הדפדפן שלכם.'
      },
      thirdPartyServices: {
        title: '6. שירותי צד שלישי',
        content: 'האתר שלנו עשוי להכיל קישורים לאתרים או שירותים של צד שלישי. אנו לא אחראים לפרקטיקות הפרטיות של צדדים שלישיים אלה. אנו מעודדים אתכם לקרוא את מדיניות הפרטיות שלהם לפני מתן כל מידע אישי.'
      },
      dataRetention: {
        title: '7. שמירת נתונים',
        content: 'אנו שומרים את המידע האישי שלכם כל עוד נדרש כדי למלא את המטרות המפורטות במדיניות פרטיות זו, אלא אם כן נדרשת תקופת שמירה ארוכה יותר או מותרת על פי חוק.'
      },
      yourRights: {
        title: '8. הזכויות שלכם',
        content: 'יש לכם הזכות לגשת, לעדכן או למחוק את המידע האישי שלכם. אתם עשויים גם לבחור שלא לקבל תקשורת פרסומית מאיתנו בכל עת על ידי ביצוע הוראות הביטול בהודעות האימייל שלנו.'
      },
      childrenPrivacy: {
        title: '9. פרטיות ילדים',
        content: 'השירותים שלנו לא מכוונים לילדים מתחת לגיל 13. אנו לא אוספים במודע מידע אישי מילדים מתחת לגיל 13. אם נדע שאספנו מידע כזה, ננקוט צעדים למחוק אותו.'
      },
      policyChanges: {
        title: '10. שינויים במדיניות פרטיות זו',
        content: 'אנו עשויים לעדכן את מדיניות פרטיות זו מעת לעת. אנו נודיע לכם על כל שינוי על ידי פרסום מדיניות הפרטיות החדשה בדף זה ועדכון התאריך "עודכן לאחרונה".'
      }
    },
    
    contact: {
      title: 'צרו איתנו קשר',
      content: 'אם יש לכם שאלות כלשהן לגבי מדיניות פרטיות זו או פרקטיקות הפרטיות שלנו, אנא צרו איתנו קשר ב:',
      email: 'privacy@sako-or.com'
    },
    
    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function PrivacyPolicy({ params }: { params: Promise<{ lng: string }> }) {
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
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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

        {/* Sections */}
        <div className="space-y-8">
          {Object.values(t.sections).map((section, index) => (
            <div key={index} className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                {section.title}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Contact Information */}
        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {t.contact.title}
          </h2>
          <p className="text-gray-700 mb-2">
            {t.contact.content}
          </p>
          <a 
            href={`mailto:${t.contact.email}`}
            className="text-gray-900 hover:text-gray-600 transition-colors duration-200"
          >
            {t.contact.email}
          </a>
        </div>
      </div>
    </div>
  )
}
