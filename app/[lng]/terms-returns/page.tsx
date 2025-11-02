'use client'

import React from 'react'
import Link from 'next/link'

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Terms & Returns Policy',
    lastUpdated: 'Last updated: January 2025',
    
    introduction: 'At Sako-Or, we strive to provide quality service, products/services that meet customer expectations, and ensure a convenient, transparent, and fair return process. This policy details consumer rights in accordance with the Consumer Protection Law, as well as our procedures for returning products or canceling transactions.',
    
    sections: {
      definitions: {
        title: 'Definitions',
        content: `"Consumer" – any person acting for personal consumption that is not part of a business activity.\n\n"Merchant" – Sako-Or Ltd.\n\n"Goods" – a product sold to a customer.\n\n"Service" – services provided to a customer according to an agreement between the parties.\n\n"Consumer transaction" – a transaction between the consumer and merchant for personal purposes such as purchasing a product or service.\n\n"Return", "Cancellation" – returning the product or canceling the transaction in accordance with legal provisions and regulations.`
      },
      displayPolicy: {
        title: 'Policy Display in Accessible Location',
        content: 'In accordance with Section 4c(a) of the Consumer Protection Law, we display in our place of business – in a prominent location, in clear and readable letters – a notice detailing the return policy, including whether the product can be returned, what the return conditions are, and the method and type of refund.'
      },
      rightToCancel: {
        title: 'Right to Cancel Transaction – Without Cause ("Regret")',
        content: `– When the transaction is performed at the place of business (not remote sale) – regulations determine that a consumer with a purchase above ₪50 has the right to cancel the transaction within 14 days from the date of receiving the product (in cases of a product), provided the product was not used and not damaged.\n\n– When the transaction is performed remotely (on the internet, by phone, etc.) – the right to cancel is within 14 days from the date of receiving the product or from the date of receiving the written agreement details, whichever is later.`
      },
      returnConditions: {
        title: 'Conditions for Return or Cancellation',
        content: `– The product is returned in reasonable condition, without damage or use beyond what is necessary for reasonable examination. Opening the packaging does not necessarily constitute use or damage, unless proven otherwise.\n\n– The consumer presents a receipt, invoice, or other documentation proving the transaction was performed, the date, the amount paid, and the payment method.`
      },
      refundMethod: {
        title: 'Refund and Credit Method',
        content: `– When the consumer requests cancellation or return in accordance with their rights under the law or this policy, we will return the full payment paid using the same payment method in which the transfer was made, within 14 days from the date of receiving the cancellation notice or receiving the product back.\n\n– If it is a continuous service and part of it has already been provided – proportional payment is required for the portion provided, and the refund will be given for what was not used.\n\n– In cases where the consumer simply chose to cancel without a defect or other reason, the merchant may charge a cancellation fee at a rate of up to 5% of the transaction price or ₪100, whichever is lower.`
      },
      returnToMerchant: {
        title: 'Returning the Product to the Merchant',
        content: `– The product will be returned to the merchant according to their instructions, and the return may be at the consumer's expense – unless otherwise agreed or if it is determined that the merchant is responsible for collection.\n\n– The merchant will be responsible for collecting the product from the place where it was delivered to the consumer if the cancellation was due to a defect or non-compliance.`
      },
      beyondLegal: {
        title: 'Return Policy Beyond Legal Minimum',
        content: 'If we allow returns beyond what is specified by law (e.g., within 30 days or regarding exchange), this policy obligates us to act according to what was published. If the consumer requested a return according to the policy that was presented and the merchant refused – the consumer may return within 7 days from the date of refusal and receive the full payment.'
      },
      ourProcedure: {
        title: 'Our Return Procedure',
        content: `– Contact avshi@sako-or.com or phone 08-9408848 with order details, purchase/receipt date, and a brief explanation of the return request.\n\n– Ensure the product is returned in its original packaging as much as possible, along with all parts, labels, booklets, or accessories.\n\n– After receiving the product and verifying it meets the conditions – we will perform the refund or credit according to the original payment method, within a reasonable time (up to 14 days).\n\n– Returning the product(s) includes a shipping cost of ₪45.\n\n– If a cancellation fee is required according to Section 6 above, this amount will be deducted from the refund.`
      },
      reservations: {
        title: 'Reservations',
        content: `– This policy does not infringe on consumer rights established by law, including rights due to a product defect, non-compliance, or misrepresentation, which sometimes give the right to return or repair beyond what is specified above.\n\n– Preserving the policy does not obligate us to a duty to refund beyond what is established by law, however, any policy condition we publish is binding on us.\n\n– Consumer rights under the law override any policy amendment or agreement that conflicts with them.`
      }
    },
    
    contact: {
      title: 'Contact Us',
      content: 'For inquiries, questions, or return requests:',
      email: 'info@sako-or.com',
      phone: '08-9408848',
      closing: 'We are at your service for any questions.'
    },
    
    backToHome: 'Back to Home'
  },
  he: {
    title: 'מדיניות החזרות והחזר כספי',
    lastUpdated: 'עודכן לאחרונה: ינואר 2025',
    
    introduction: 'אנו ב-סכו עור שואפים להעניק שירות איכותי, מוצר/שירות העומד בציפיות הלקוח, ולהבטיח תהליך החזרה נוח, שקוף והוגן. מדיניות זו מפרטת את זכויות הצרכן בהתחשב ב-חוק הגנת הצרכן, וכן את ההליך אצלנו להחזרת מוצרים או ביטול עסקה.',
    
    sections: {
      definitions: {
        title: 'הגדרות',
        content: '"צרכן" – כל אדם הפועל לצריכה אישית שאינה חלק מפעילות עסקית.\n\n"עוסק" – סכו עור בע"מ.\n\n"טובין" – מוצר הנמכר ללקוח.\n\n"שירות" – שירותים הניתנים ללקוח לפי הסכם בין הצדדים.\n\n"עסקה צרכנית" – עסקה בין הצרכן לעוסק לצורך אישי כגון רכישת מוצר או שירות.\n\n"החזרה", "ביטול" – החזרת המוצר או ביטול העסקה בהתאם להוראות החוק והתקנות.'
      },
      displayPolicy: {
        title: 'הצגת מדיניות במקום נגיש',
        content: 'בהתאם לסעיף 4ג(א) לחוק הגנת הצרכן, אנו מציגים במקום העסקנו – במקום בולט, באותיות ברורות וקריאות – מודעה המפרטת את מדיניות ההחזרה, כולל האם ניתן להחזיר את המוצר, מהם התנאים להחזרה, ואופן וסוג ההחזר.'
      },
      rightToCancel: {
        title: 'זכות ביטול עסקה – ללא סיבה ("חרטה")',
        content: '– כאשר העסקה בוצעה בבית העסק (ולא מכירה מרחוק) – התקנות קובעות כי לצרכן ערך מעל ₪50 יש זכות לבטל את העסקה תוך 14 ימים מיום קבלת המוצר (במקרים של מוצר) בתנאי שלא נעשה שימוש במוצר ולא נפגם.\n\n– כאשר העסקה בוצעה מרחוק (באינטרנט, בטלפון וכד\') – הזכות לבטל היא בתוך 14 ימים מיום קבלת המוצר או מיום קבלת פרטי ההסכם בכתב, לפי המאוחר.'
      },
      returnConditions: {
        title: 'תנאים להחזרה או ביטול',
        content: '– המוצר מוחזר במצב סביר, ללא פגיעה או שימוש מעבר מהנדרש לבחינה סבירה. פתיחת האריזה לא בהכרח תיחשב שימוש או פגיעה, אלא אם הוכח אחרת.\n\n– הצרכן מציג קבלה, חשבונית או תיעוד אחר שמוכיח את ביצוע העסקה, תאריך, הסכום ששולם ואמצעי התשלום.'
      },
      refundMethod: {
        title: 'אופן ההחזר והזיכוי',
        content: '– כאשר הצרכן מבקש ביטול או החזרה בהתאם לזכויותיו לפי החוק או לפי מדיניות זו, אנו נפעל להשיב לו את מלוא התמורה ששילם באותו אמצעי תשלום בו בוצעה ההעברה, בתוך 14 ימים מיום קבלת הודעת הביטול או קבלת המוצר בחזרה.\n\n– אם מדובר בשירות מתמשך והושקה עליו כבר חלקית – נדרש חיוב בתשלום יחסי בגין החלק שניתן, וההחזר יינתן בגין מה שלא נוצל.\n\n– במקרים בהם הצרכן פשוט בחר לבטל ללא פגם או סיבה אחרת, רשאי העוסק לגבות דמי ביטול בשיעור של עד 5% ממחיר העסקה או ₪100, לפי הנמוך מביניהם.'
      },
      returnToMerchant: {
        title: 'החזרת המוצר לעוסק',
        content: '– המוצר יוחזר לעוסק על-פי הוראותיו, ויתכן כי ההחזרה תהיה על חשבון הצרכן – אלא אם הוסכם אחרת או אם נקבע שהעוסק אחראי לאיסוף.\n\n– על העוסק יהיה לאסוף את המוצר במקום בו נמסר לצרכן אם הביטול נבע מפגם או אי-הספקה.'
      },
      beyondLegal: {
        title: 'מדיניות החזרה מעבר למינימום החוקי',
        content: 'אם אנו מאפשרים החזרה מעבר למה שנקבע בחוק (למשל: בתוך 30 ימים או מבחינת החלפה), מדיניות זו מחייבת אותנו לפעול לפי מה שפורסם. במקרה בו הצרכן ביקש החזרה בהתאם למדיניות שהוצגה והעוסק סירב – הצרכן רשאי להחזיר בתוך 7 ימים מיום הסירוב ולקבל את מלוא התמורה.'
      },
      ourProcedure: {
        title: 'הליך החזרה אצלנו',
        content: '– יש לפנות ל-avshi@sako-or.com או לטלפון 08-9408848 עם פרטי ההזמנה, תאריך הרכישה/קבלה, הסבר קצר לבקשת ההחזרה.\n\n– נוודא שהמוצר מוחזר באריזתו המקורית ככל שניתן, יחד עם כל החלקים, תוויות, חוברות או אביזרים.\n\n– לאחר קבלת המוצר ואימות עמידתו בתנאים – נבצע את ההחזר או הזיכוי בהתאם לאמצעי התשלום המקורי, בתוך זמן סביר (עד 14 ימים).\n\n– החזרת המוצר/ים כוללים עלות משלוח של 45 ש"ח.\n\n– אם נדרש דמי ביטול לפי סעיף 6 לעיל, גובה זה ינוכה מההחזר.'
      },
      reservations: {
        title: 'הסתייגויות',
        content: '– מדיניות זו אינה פוגעת בזכויות הצרכן הקבועות בחוק, לרבות זכויות בגין פגם במוצר, אי־התאמה או הטעיה, אשר נותנות לעיתים זכות החזרה או תיקון גם מעבר למה שנקבע לעיל.\n\n– שמירת המדיניות אינה מחייבת אותנו לחובת החזר מעבר למה שנקבע בחוק, אולם כל תנאי מדיניות שאנו מפרסמים הוא מחייב עבורנו.\n\n– זכויות הצרכן על פי החוק גוברות על כל תיקון מדיניות או הסכם שנוגד אותן.'
      }
    },
    
    contact: {
      title: 'יצירת קשר',
      content: 'להפניות, שאלות או בקשות החזרה:',
      email: 'info@sako-or.com',
      phone: '08-9408848',
      closing: 'אנו עומדים לרשותכם לכל שאלה.'
    },
    
    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function TermsAndReturns({ params }: { params: Promise<{ lng: string }> }) {
  const [lng, setLng] = React.useState<string>('en')
  
  // Initialize language from params
  React.useEffect(() => {
    params.then(({ lng: language }) => {
      setLng(language)
    })
  }, [params])
  
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  // Function to render multi-line content
  const renderContent = (content: string) => {
    return content.split('\n\n').map((paragraph, index) => (
      <p key={index} className={`text-gray-700 leading-relaxed ${index > 0 ? 'mt-4' : ''}`}>
        {paragraph}
      </p>
    ))
  }

  return (
    <div className={`bg-white pt-16 min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link 
            href={`/${lng}`}
            className={`inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <svg className={`${isRTL ? 'ml-2' : 'mr-2'} w-5 h-5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Sections */}
        <div className="space-y-8">
          {Object.values(t.sections).map((section, index) => (
            <div key={index} className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                {section.title}
              </h2>
              <div>
                {renderContent(section.content)}
              </div>
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
          <div className="space-y-2">
            <a 
              href={`mailto:${t.contact.email}`}
              className="block text-gray-900 hover:text-gray-600 transition-colors duration-200"
            >
              {t.contact.email}
            </a>
            <a 
              href={`tel:${t.contact.phone}`}
              className="block text-gray-900 hover:text-gray-600 transition-colors duration-200"
            >
              {t.contact.phone}
            </a>
          </div>
          <p className="text-gray-700 mt-4">
            {t.contact.closing}
          </p>
        </div>
      </div>
    </div>
  )
}

