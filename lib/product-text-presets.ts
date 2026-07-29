/**
 * Predefined Hebrew/English text pairs for admin fields that otherwise require
 * typing the same boilerplate per product (care instructions, sizing
 * recommendations). Selecting a preset fills both languages at once; the admin
 * can still edit either side freely, or pick "Custom" for free text.
 */

export interface TextPreset {
  id: string
  label_en: string
  label_he: string
  text_en: string
  text_he: string
}

export const CARE_INSTRUCTIONS_PRESETS: TextPreset[] = [
  {
    id: 'soft_nappa_leather',
    label_en: 'Soft Nappa Leather',
    label_he: 'עור נאפה רך',
    text_en:
      'Gently clean using a soft, clean and dry cloth. Avoid excessive water, alcohol or strong cleaning products. A leather conditioner suitable for soft leather may be used occasionally after testing it on a hidden area. Store in a cool, dry place away from direct sunlight.',
    text_he:
      'מומלץ לנקות בעדינות באמצעות מטלית רכה, נקייה ויבשה. אין להשתמש בכמות גדולה של מים, אלכוהול או חומרי ניקוי חזקים. ניתן להשתמש מדי פעם בחומר ייעודי להזנת עור. יש לאחסן במקום יבש ומוצל.',
  },
  {
    id: 'suede_leather',
    label_en: 'Suede Leather',
    label_he: 'זמש',
    text_en:
      'Gently clean using a dedicated suede brush, brushing in one consistent direction. Do not clean with water or a wet cloth. A suede protection spray is recommended before use, after testing it on a hidden area. Avoid contact with rain, oil and moisture.',
    text_he:
      'יש לנקות בעדינות באמצעות מברשת ייעודית לזמש ובכיוון אחיד. אין להשתמש במים או במטלית רטובה. מומלץ להשתמש בספריי הגנה ייעודי לזמש לפני השימוש. יש להימנע ממגע עם גשם, שמן ולחות.',
  },
  {
    id: 'patent_leather',
    label_en: 'Patent Leather',
    label_he: 'עור פטנט',
    text_en:
      'Clean using a soft, slightly damp cloth and dry immediately afterward. Do not use hard brushes, alcohol or strong cleaning products. Keep away from heat and prolonged sunlight, and avoid extended contact with materials or colors that may transfer onto the product.',
    text_he:
      'יש לנקות באמצעות מטלית רכה ולחה מעט, ולאחר מכן לייבש מיד. אין להשתמש במברשות קשות, אלכוהול או חומרי ניקוי חזקים. יש להרחיק מחום ומחשיפה ממושכת לשמש ולמנוע מגע ממושך עם חומרים או צבעים שעלולים לעבור למוצר.',
  },
  {
    id: 'rubber',
    label_en: 'Rubber',
    label_he: 'גומי',
    text_en:
      'Clean using a damp cloth with a small amount of mild soap. Remove any remaining soap and allow the product to air dry. Do not use bleach, alcohol or strong cleaning products, and do not dry using a direct heat source.',
    text_he:
      'ניתן לנקות באמצעות מטלית לחה עם מעט סבון עדין. לאחר הניקוי יש להסיר שאריות סבון ולייבש באוויר. אין להשתמש באקונומיקה, אלכוהול או חומרים חזקים, ואין לייבש באמצעות מקור חום ישיר.',
  },
]

export const SIZING_RECOMMENDATION_PRESETS: TextPreset[] = [
  {
    id: 'true_to_size',
    label_en: 'True to Size',
    label_he: 'מידה במידה',
    text_en: 'This style fits true to size. We recommend selecting your usual size.',
    text_he: 'הדגם תואם למידה. מומלץ לבחור במידה הרגילה שלך.',
  },
  {
    id: 'runs_small_size_up',
    label_en: 'Runs Small – Size Up',
    label_he: 'קטן במידה – להגדיל מידה',
    text_en: 'This style runs small. We recommend selecting one size larger than your usual size.',
    text_he: 'הדגם קטן יחסית. מומלץ לבחור מידה אחת מעל המידה הרגילה שלך.',
  },
  {
    id: 'runs_large_size_down',
    label_en: 'Runs Large – Size Down',
    label_he: 'גדול במידה – להקטין מידה',
    text_en: 'This style runs large. We recommend selecting one size smaller than your usual size.',
    text_he: 'הדגם גדול יחסית. מומלץ לבחור מידה אחת מתחת למידה הרגילה שלך.',
  },
  {
    id: 'narrow_foot',
    label_en: 'Suitable for a Narrow Foot',
    label_he: 'מתאים לכף רגל צרה',
    text_en:
      'This style is especially suitable for a narrow foot. Customers with a wider foot may consider selecting one size larger.',
    text_he: 'הדגם מתאים במיוחד לכף רגל צרה. לבעלות כף רגל רחבה מומלץ לשקול מידה אחת מעל.',
  },
  {
    id: 'wide_foot',
    label_en: 'Suitable for a Wide Foot',
    label_he: 'מתאים לכף רגל רחבה',
    text_en: 'This style is suitable for a wider foot. We recommend selecting your usual size.',
    text_he: 'הדגם מתאים גם לכף רגל רחבה. מומלץ לבחור במידה הרגילה שלך.',
  },
  {
    id: 'between_sizes_up',
    label_en: 'Between Sizes – Size Up',
    label_he: 'בין מידות – להגדיל',
    text_en: 'If you are between two sizes, we recommend selecting the larger size.',
    text_he: 'אם את מתלבטת בין שתי מידות, מומלץ לבחור במידה הגדולה יותר.',
  },
  {
    id: 'between_sizes_down',
    label_en: 'Between Sizes – Size Down',
    label_he: 'בין מידות – להקטין',
    text_en: 'If you are between two sizes, we recommend selecting the smaller size.',
    text_he: 'אם את מתלבטת בין שתי מידות, מומלץ לבחור במידה הקטנה יותר.',
  },
]
