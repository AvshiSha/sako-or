'use client'

import React from 'react'
import Link from 'next/link'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: January 2025',
    introduction: 'Welcome to SAKO-OR. These Terms of Service ("Terms") govern your use of our website and services.',
    
    sections: {
      acceptance: {
        title: '1. Acceptance of Terms',
        content: 'By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.'
      },
      useLicense: {
        title: '2. Use License',
        content: 'Permission is granted to temporarily download one copy of the materials on SAKO-OR\'s website for personal, non-commercial transitory viewing only.'
      },
      disclaimer: {
        title: '3. Disclaimer',
        content: 'The materials on SAKO-OR\'s website are provided on an \'as is\' basis. SAKO-OR makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.'
      },
      limitations: {
        title: '4. Limitations',
        content: 'In no event shall SAKO-OR or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on SAKO-OR\'s website.'
      },
      accuracy: {
        title: '5. Accuracy of Materials',
        content: 'The materials appearing on SAKO-OR\'s website could include technical, typographical, or photographic errors. SAKO-OR does not warrant that any of the materials on its website are accurate, complete, or current.'
      },
      links: {
        title: '6. Links',
        content: 'SAKO-OR has not reviewed all of the sites linked to our website and is not responsible for the contents of any such linked site.'
      },
      modifications: {
        title: '7. Modifications',
        content: 'SAKO-OR may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.'
      },
      governingLaw: {
        title: '8. Governing Law',
        content: 'These terms and conditions are governed by and construed in accordance with the laws of Israel and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.'
      }
    },
    
    contact: {
      title: 'Contact Information',
      content: 'If you have any questions about these Terms of Service, please contact us at:',
      email: 'info@sako-or.com'
    },
    
    backToHome: 'Back to Home'
  },
  he: {
    title: 'תנאי שירות',
    lastUpdated: 'עודכן לאחרונה: ינואר 2025',
    introduction: 'ברוכים הבאים לסכו עור. תנאי שירות אלה ("התנאים") מסדירים את השימוש שלכם באתר ובשירותים שלנו.',
    
    sections: {
      acceptance: {
        title: '1. קבלת התנאים',
        content: 'על ידי גישה לשימוש באתר זה, אתם מקבלים ומסכימים להיות מחויבים לתנאים והוראות של הסכם זה.'
      },
      useLicense: {
        title: '2. רישיון שימוש',
        content: 'ניתנת הרשאה להוריד זמנית עותק אחד של החומרים באתר סכו עור לצפייה אישית ולא מסחרית זמנית בלבד.'
      },
      disclaimer: {
        title: '3. הצהרת פטור',
        content: 'החומרים באתר סכו עור מסופקים "כפי שהם". סכו עור לא נותן אחריות, מפורשת או משתמעת, ומכאן פוטר ומבטל כל אחריות אחרת.'
      },
      limitations: {
        title: '4. הגבלות',
        content: 'בשום מקרה סכו עור או הספקים שלו לא יהיו אחראים לכל נזק (כולל, ללא הגבלה, נזקים לאובדן נתונים או רווח, או עקב הפרעה עסקית) הנובעים מהשימוש או חוסר היכולת להשתמש בחומרים באתר סכו עור.'
      },
      accuracy: {
        title: '5. דיוק החומרים',
        content: 'החומרים המופיעים באתר סכו עור יכולים לכלול שגיאות טכניות, טיפוגרפיות או צילומיות. סכו עור לא מתחייב שכל החומרים באתר שלו מדויקים, שלמים או עדכניים.'
      },
      links: {
        title: '6. קישורים',
        content: 'סכו עור לא בדק את כל האתרים המקושרים לאתר שלנו ואינו אחראי לתוכן של כל אתר מקושר כזה.'
      },
      modifications: {
        title: '7. שינויים',
        content: 'סכו עור רשאי לעדכן את תנאי השירות האלה לאתר שלו בכל עת ללא הודעה מוקדמת. על ידי שימוש באתר זה אתם מסכימים להיות מחויבים לגרסה הנוכחית של תנאי השירות האלה.'
      },
      governingLaw: {
        title: '8. דין שולט',
        content: 'התנאים וההוראות האלה נשלטים ומפורשים בהתאם לחוקי ישראל ואתם מצהירים על כניעה בלעדית לסמכות השיפוט של בתי המשפט במדינה או מיקום זה.'
      }
    },
    
    contact: {
      title: 'פרטי יצירת קשר',
      content: 'אם יש לכם שאלות כלשהן לגבי תנאי השירות האלה, אנא צרו איתנו קשר ב:',
      email: 'info@sako-or.com'
    },
    
    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function TermsOfService({ params }: { params: Promise<{ lng: string }> }) {
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
    <div className={`bg-white pt-[104px] min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}>
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
