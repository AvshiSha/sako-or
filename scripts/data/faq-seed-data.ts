/**
 * Initial FAQ content.
 *
 * Two deliberately different categories:
 *
 *  1. PUBLISHED educational answers. Every factual claim is grounded in data
 *     this codebase already holds — the size conversion table in
 *     app/components/SizeChart.tsx, and the per-product attribute vocabularies
 *     in lib/product-enums.ts (size fit, foot width, arch, heel type, heel
 *     height, upper material). Nothing about how SAKO-OR trades is asserted.
 *
 *  2. DRAFT policy questions. Shipping costs, delivery times, the returns
 *     window, the store address and so on are commercial commitments. There is
 *     no approved copy for them anywhere in this repository — no shipping page,
 *     no returns page — so inventing plausible-sounding wording would be
 *     inventing policy. These ship as drafts whose entire answer is an
 *     instruction to replace it. The Firestore rule keeps drafts out of every
 *     public query, so they cannot leak even if someone forgets they exist.
 *
 * Reviewed as a diff and reused by tests, hence a data module rather than
 * literals inside the seed script.
 */

import type { FaqAudience, FaqStatus, FaqTopic } from '../../lib/faq-types';

export interface FaqSeedItem {
  slug: string;
  audience: FaqAudience;
  topic: FaqTopic;
  status: FaqStatus;
  question: { he: string; en: string };
  shortAnswer?: { he: string; en: string };
  answerHtml: { he: string; en: string };
  relatedLinks?: Array<{ label: { he: string; en: string }; href: string }>;
}

/** Closing line every educational answer ends with — true, and it earns a click. */
const CHECK_PRODUCT_PAGE = {
  he: (href: string) =>
    `<p>בכל עמוד מוצר מופיעים הנתונים הספציפיים של אותו דגם — התאמת המידה, רוחב כף הרגל, סוג העקב וגובהו וחומר הגלם. כדאי לעבור עליהם לפני ההזמנה. <a href="${href}">לצפייה בקולקציה</a>.</p>`,
  en: (href: string) =>
    `<p>Every product page lists that style's own details — size fit, foot width, heel type and height, and upper material. It is worth reading them before you order. <a href="${href}">Browse the collection</a>.</p>`,
};

const POLICY_PLACEHOLDER = {
  he: (topic: string) =>
    `<blockquote class="faq-callout"><strong>נדרשת פעולה — אין לפרסם.</strong> יש להחליף טקסט זה בנוסח המאושר של סכו עור בנושא ${topic}. לא נכתב כאן דבר על המדיניות בפועל; השאלה נשארת בטיוטה עד שגורם מורשה ימלא אותה.</blockquote>`,
  en: (topic: string) =>
    `<blockquote class="faq-callout"><strong>ACTION REQUIRED — DO NOT PUBLISH.</strong> Replace this with SAKO-OR's approved wording for ${topic}. Nothing about the actual policy has been written here; this question stays in draft until an authorised person fills it in.</blockquote>`,
};

const policyDraft = (
  slug: string,
  topic: FaqTopic,
  question: { he: string; en: string },
  subject: { he: string; en: string }
): FaqSeedItem => ({
  slug,
  audience: 'general',
  topic,
  status: 'draft',
  question,
  answerHtml: {
    he: POLICY_PLACEHOLDER.he(subject.he),
    en: POLICY_PLACEHOLDER.en(subject.en),
  },
});

// ── Women ────────────────────────────────────────────────────────────────────

const WOMEN: FaqSeedItem[] = [
  {
    slug: 'how-do-i-choose-the-correct-shoe-size',
    audience: 'women',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'איך בוחרים את מידת הנעל הנכונה?',
      en: 'How do I choose the correct shoe size?',
    },
    shortAnswer: {
      he: 'מדדו את אורך כף הרגל בסנטימטרים והשוו לטבלת המידות. המידה בעמודה הראשונה היא המידה הפנימית בפועל של הנעל.',
      en: 'Measure your foot in centimetres and compare it to the conversion table. The first column is the shoe\'s actual internal measurement.',
    },
    answerHtml: {
      he: `<p>הנעליים שלנו מיוצרות לפי מידות אירופאיות, בטווח 35 עד 46. הדרך המדויקת ביותר לבחור מידה היא למדוד את אורך כף הרגל בסנטימטרים ולהשוות אותו לטבלה שלמטה — ולא להסתמך על המידה שאתם לובשים במותגים אחרים, שנבדלת ביניהם.</p>
<p>שימו לב: המספר בעמודה הראשונה הוא <strong>המידה הפנימית של הנעל</strong> (עקב-בוהן), כלומר אורך כף הרגל שהיא מיועדת להכיל.</p>
<table><caption>המרת מידות SAKO</caption><thead><tr><th scope="col">מידת SAKO</th><th scope="col">מידה אמריקאית</th><th scope="col">אורך כף רגל (ס"מ)</th></tr></thead><tbody><tr><th scope="row">35</th><td>5</td><td>22.5</td></tr><tr><th scope="row">36</th><td>6</td><td>23.0</td></tr><tr><th scope="row">37</th><td>7</td><td>23.5</td></tr><tr><th scope="row">38</th><td>8</td><td>24.0</td></tr><tr><th scope="row">39</th><td>9</td><td>24.5</td></tr><tr><th scope="row">40</th><td>10</td><td>25.0</td></tr><tr><th scope="row">41</th><td>11</td><td>25.5</td></tr><tr><th scope="row">42</th><td>12</td><td>26.0</td></tr><tr><th scope="row">43</th><td>13</td><td>26.5</td></tr><tr><th scope="row">44</th><td>14</td><td>27.0</td></tr><tr><th scope="row">45</th><td>15</td><td>27.5</td></tr><tr><th scope="row">46</th><td>16</td><td>28.0</td></tr></tbody></table>
<p>אנחנו ממליצים להשאיר 5 עד 10 מ"מ של מקום פנוי בין הבוהן הארוכה ביותר לקצה הנעל. זה מה שמאפשר לכף הרגל להתפשט קלות במהלך היום בלי שהנעל תלחץ.</p>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Our footwear is made to European sizing, from 35 to 46. The most reliable way to choose is to measure your foot in centimetres and compare it to the table below — rather than relying on the size you take in other brands, which varies between them.</p>
<p>Note that the number in the first column is the <strong>shoe's internal measurement</strong> (heel-to-toe): the foot length it is built to hold.</p>
<table><caption>SAKO size conversion</caption><thead><tr><th scope="col">SAKO size</th><th scope="col">US size</th><th scope="col">Foot length (cm)</th></tr></thead><tbody><tr><th scope="row">35</th><td>5</td><td>22.5</td></tr><tr><th scope="row">36</th><td>6</td><td>23.0</td></tr><tr><th scope="row">37</th><td>7</td><td>23.5</td></tr><tr><th scope="row">38</th><td>8</td><td>24.0</td></tr><tr><th scope="row">39</th><td>9</td><td>24.5</td></tr><tr><th scope="row">40</th><td>10</td><td>25.0</td></tr><tr><th scope="row">41</th><td>11</td><td>25.5</td></tr><tr><th scope="row">42</th><td>12</td><td>26.0</td></tr><tr><th scope="row">43</th><td>13</td><td>26.5</td></tr><tr><th scope="row">44</th><td>14</td><td>27.0</td></tr><tr><th scope="row">45</th><td>15</td><td>27.5</td></tr><tr><th scope="row">46</th><td>16</td><td>28.0</td></tr></tbody></table>
<p>We recommend leaving 5 to 10 mm of spare room between your longest toe and the end of the shoe. That is what lets the foot spread slightly through the day without the shoe pressing on it.</p>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
    relatedLinks: [
      { label: { he: 'קולקציית הנשים', en: "Women's collection" }, href: '/collection/women' },
    ],
  },
  {
    slug: 'how-do-i-measure-my-foot-at-home',
    audience: 'women',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'איך מודדים כף רגל בבית?',
      en: 'How do I measure my foot at home?',
    },
    shortAnswer: {
      he: 'עמדו על דף נייר כשהעקב צמוד לקיר, סמנו את הבוהן הארוכה ביותר ומדדו בסרגל. מדדו את שתי הרגליים.',
      en: 'Stand on a sheet of paper with your heel against a wall, mark your longest toe and measure with a ruler. Do both feet.',
    },
    answerHtml: {
      he: `<p>נדרשים דף נייר, עיפרון וסרגל. חמש דקות מספיקות.</p>
<ol><li>עמדו זקופים על משטח קשה כשהעקב צמוד לקיר.</li><li>הדביקו דף נייר ריק לרצפה מתחת לכף הרגל, וסמנו עליו את הנקודה של החלק הארוך ביותר של כף הרגל. זהו אורך ה"עקב-בוהן".</li><li>חזרו על הפעולה עם כף הרגל השנייה — אצל רוב האנשים יש הפרש קטן בין שתי הרגליים.</li><li>מדדו בסרגל את המרחק שסימנתם, בסנטימטרים.</li><li>השוו את המספר הגדול מבין השתיים לטבלת המידות.</li></ol>
<blockquote class="faq-callout">שתי טעויות נפוצות: מדידה בישיבה, שנותנת תוצאה קטנה מדי כי כף הרגל לא נושאת משקל, ומדידה בבוקר. כדאי למדוד בשעות אחר הצהריים, כשכף הרגל בנפחה המלא.</blockquote>
<p>אם המדידה נופלת בדיוק על גבול בין שתי מידות, ראו את התשובה על מידת ביניים.</p>`,
      en: `<p>You need a sheet of paper, a pencil and a ruler. Five minutes is enough.</p>
<ol><li>Stand up straight on a hard surface with your heel against a wall.</li><li>Tape a blank sheet of paper to the floor beneath your foot and mark the longest part of your foot on it. That distance is your "heel-to-toe" length.</li><li>Repeat with the other foot — most people have a small difference between the two.</li><li>Measure the marked distance with a ruler, in centimetres.</li><li>Compare the larger of the two numbers to the size conversion table.</li></ol>
<blockquote class="faq-callout">Two common mistakes: measuring while seated, which reads short because the foot is not bearing weight, and measuring first thing in the morning. Afternoon is better, when the foot is at its fullest.</blockquote>
<p>If your measurement lands exactly between two sizes, see the answer on being between sizes.</p>`,
    },
  },
  {
    slug: 'what-if-i-am-between-two-sizes',
    audience: 'women',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'מה עושים כשאני בין שתי מידות?',
      en: 'What should I do if I am between two sizes?',
    },
    shortAnswer: {
      he: 'ברוב המקרים עדיף לעלות מידה — קל יותר למלא נעל מרווחת מאשר להרחיב נעל צרה.',
      en: 'In most cases size up. Filling a slightly roomy shoe is easier than stretching a tight one.',
    },
    answerHtml: {
      he: `<p>כשהמדידה נופלת בין שתי מידות, ברוב המקרים עדיף לבחור את הגדולה מביניהן. אפשר להוסיף מדרס דק או כרית עקב לנעל מעט מרווחת; נעל שצרה מלכתחילה כמעט לא מתקנים.</p>
<h3>מתי כדאי דווקא לרדת מידה</h3>
<ul><li><strong>סנדלים ונעליים פתוחות</strong> — כף הרגל עלולה לחרוג מהסוליה בקדמה או בעקב אם הנעל גדולה מדי.</li><li><strong>נעליים ללא רצועה או אבזם</strong>, כמו בלרינה או מוקסין, שנשענות על התאמה צמודה כדי להישאר על הרגל.</li><li><strong>דגמים המסומנים בעמוד המוצר כ"המידה קטנה מהרגיל"</strong> — שם הסימון כבר מגלם את ההפרש.</li></ul>
<p>בעמוד המוצר מופיע שדה התאמת מידה עם אחת מארבע אפשרויות: מידה במידה, המידה קטנה מהרגיל, המידה גדולה מהרגיל, או תלוי במבנה כף הרגל. זהו הנתון הרלוונטי ביותר להחלטה בדגם ספציפי.</p>
<p>אם עדיין לא ברור, אנחנו זמינים ב<a href="https://wa.me/972504487979">וואטסאפ</a> ובעמוד <a href="/he/contact">צור קשר</a>.</p>`,
      en: `<p>When your measurement falls between two sizes, sizing up is usually the better choice. A thin insole or heel grip can take up a little extra room; a shoe that is tight from the start rarely becomes comfortable.</p>
<h3>When to size down instead</h3>
<ul><li><strong>Sandals and open styles</strong> — the foot can overhang the sole at the front or the heel if the shoe is too long.</li><li><strong>Styles with no strap or buckle</strong>, such as ballet flats and moccasins, which rely on a close fit to stay on.</li><li><strong>Styles marked "runs small" on the product page</strong> — that marking already accounts for the difference.</li></ul>
<p>Each product page carries a size fit field with one of four values: true to size, runs small, runs large, or depends on foot shape. For a specific style, that is the most useful thing to read.</p>
<p>If you are still unsure, we are reachable on <a href="https://wa.me/972504487979">WhatsApp</a> and through our <a href="/en/contact">contact page</a>.</p>`,
    },
  },
  {
    slug: 'which-shoes-suit-wide-feet',
    audience: 'women',
    topic: 'fit',
    status: 'published',
    question: {
      he: 'אילו נעליים מתאימות לכף רגל רחבה?',
      en: 'Which shoes are suitable for wide feet?',
    },
    shortAnswer: {
      he: 'חפשו דגמים המסומנים "כף רגל רחבה" או "מתאימה לרוב כף הרגל", ודגמים עם אמצעי כוונון כמו אבזם, שרוכים או גומי.',
      en: 'Look for styles marked "wide feet" or "suitable for most foot widths", and for anything with a buckle, laces or elastic.',
    },
    answerHtml: {
      he: `<p>אורך אינו הבעיה היחידה. בכל עמוד מוצר יש שדה רוחב כף רגל שמסווג את הדגם לאחת מהאפשרויות: כף רגל צרה, רוחב רגיל, כף רגל רחבה, צרה עד רגילה, רגילה עד רחבה, מתאימה לרוב כף הרגל, או התאמה מתכווננת. זה השדה שכדאי לסנן לפיו.</p>
<h3>מה עוזר בפועל</h3>
<ul><li><strong>אמצעי כוונון.</strong> אבזם, שרוכים, גומי, סקוץ' או רצועה מתכווננת מאפשרים להרחיב או לצמצם את הפתח בהתאם לרגל.</li><li><strong>חומר גמיש.</strong> עור נאפה ועור זמש מתגמשים עם השימוש הרבה יותר מעור פטנט או מחומרים סינתטיים נוקשים.</li><li><strong>קדמת נעל מעוגלת או מרובעת</strong> נותנת לאצבעות רוחב לעומת חרטום מחודד, שמצמצם אותן לנקודה.</li><li><strong>עקב בלוק או טריז</strong> מפזר את המשקל על שטח גדול יותר מסטילטו, מה שמפחית לחץ על קדמת כף הרגל.</li></ul>
<blockquote class="faq-callout">עלייה במידה כדי לפתור בעיית רוחב עובדת רק חלקית: הנעל תהיה רחבה יותר, אבל גם ארוכה יותר, והעקב עלול להחליק. עדיף לבחור דגם שהרוחב שלו מתאים מלכתחילה.</blockquote>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Length is not the only issue. Every product page carries a foot width field classifying the style as one of: narrow feet, regular width, wide feet, narrow to regular, regular to wide, suitable for most foot widths, or adjustable fit. That is the field to filter on.</p>
<h3>What actually helps</h3>
<ul><li><strong>An adjustment.</strong> A buckle, laces, elastic, velcro or an adjustable strap all let you open or close the fit to suit your foot.</li><li><strong>A yielding material.</strong> Nappa and suede relax with wear far more than patent leather or a stiff synthetic.</li><li><strong>A round or square toe</strong> gives the toes width, where a pointed toe narrows them to a point.</li><li><strong>A block or wedge heel</strong> spreads weight over a larger area than a stiletto, which reduces pressure across the forefoot.</li></ul>
<blockquote class="faq-callout">Sizing up to solve a width problem only half works: the shoe gets wider, but also longer, and the heel can then slip. Choosing a style whose width suits you in the first place is the better fix.</blockquote>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
    relatedLinks: [
      { label: { he: 'קולקציית הנשים', en: "Women's collection" }, href: '/collection/women' },
    ],
  },
  {
    slug: 'how-do-i-choose-comfortable-heels',
    audience: 'women',
    topic: 'heels',
    status: 'published',
    question: {
      he: 'איך בוחרים עקבים נוחים?',
      en: 'How do I choose comfortable heels?',
    },
    shortAnswer: {
      he: 'שטח מגע גדול, גובה מתון וקדמת נעל שאינה לוחצת — שלושת אלה משפיעים על הנוחות יותר מהגובה לבדו.',
      en: 'A wide contact area, a moderate height and a toe box that does not pinch matter more than height alone.',
    },
    answerHtml: {
      he: `<p>נוחות בעקב נקבעת פחות מהגובה עצמו ויותר משלושה גורמים.</p>
<h3>שטח המגע עם הקרקע</h3>
<p>ככל שבסיס העקב רחב יותר, כך המשקל מתפזר על שטח גדול יותר והיציבות עולה. עקב בלוק, עקב טריז ועקב פלטפורמה יציבים משמעותית מסטילטו באותו גובה.</p>
<h3>גובה העקב</h3>
<p>בעמוד המוצר מצוין גובה העקב בסנטימטרים, בטווח 0 עד 12. ככלל, ככל שהעקב גבוה יותר כך יותר משקל עובר לקדמת כף הרגל. עד כ-5 ס"מ רוב האנשים הולכים בנוחות למשך שעות; מעל 8 ס"מ מדובר בדרך כלל בנעליים לאירוע ולא ליום עבודה.</p>
<h3>קדמת הנעל</h3>
<p>עקב גבוה דוחף את האצבעות קדימה. חרטום מחודד מצמצם אותן בדיוק לאזור שאליו הן נדחפות, ולכן שילוב של עקב גבוה עם חרטום צר מורגש הרבה יותר מכל אחד מהם בנפרד.</p>
<blockquote class="faq-callout">עקב פלטפורמה מקטין את ההפרש בפועל בין העקב לקדמת הנעל. פלטפורמה של 2 ס"מ תחת עקב של 10 ס"מ מרגישה בערך כמו עקב של 8 ס"מ.</blockquote>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Comfort in a heel depends less on the height itself than on three things.</p>
<h3>The contact area with the ground</h3>
<p>The wider the base of the heel, the more the weight is spread and the more stable the shoe. A block heel, a wedge and a platform are all noticeably steadier than a stiletto of the same height.</p>
<h3>Heel height</h3>
<p>Each product page states heel height in centimetres, from 0 to 12. As a rule, the higher the heel the more weight shifts onto the forefoot. Up to about 5 cm most people walk comfortably for hours; above 8 cm you are generally looking at an occasion shoe rather than a working day.</p>
<h3>The toe box</h3>
<p>A high heel pushes the toes forward. A pointed toe narrows exactly the area they are being pushed into, which is why a high heel and a narrow toe together are felt far more than either on its own.</p>
<blockquote class="faq-callout">A platform reduces the effective difference between heel and forefoot. A 2 cm platform under a 10 cm heel feels closer to an 8 cm heel.</blockquote>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
  },
  {
    slug: 'difference-between-block-stiletto-and-platform-heels',
    audience: 'women',
    topic: 'heels',
    status: 'published',
    question: {
      he: 'מה ההבדל בין עקב בלוק, סטילטו ופלטפורמה?',
      en: 'What is the difference between block heels, stilettos and platform heels?',
    },
    shortAnswer: {
      he: 'הם נבדלים בשטח המגע עם הקרקע, וזה מה שקובע יציבות ואת סוג האירוע שמתאים להם.',
      en: 'They differ in how much of the heel meets the ground, which is what decides stability and the occasions they suit.',
    },
    answerHtml: {
      he: `<p>סוג העקב מופיע בכל עמוד מוצר. אלה הסוגים שאנחנו מסמנים ומה שמאפיין כל אחד מהם:</p>
<table><caption>סוגי עקבים ומה שמאפיין אותם</caption><thead><tr><th scope="col">סוג</th><th scope="col">מאפיין</th><th scope="col">מתאים במיוחד ל</th></tr></thead><tbody><tr><th scope="row">שטוחה</th><td>ללא הפרש גובה או כמעט ללא</td><td>שימוש יומיומי ממושך</td></tr><tr><th scope="row">עקב בלוק</th><td>בסיס רחב ומרובע, יציב</td><td>יום עבודה, הליכה, אירוע ארוך</td></tr><tr><th scope="row">עקב קיטן</th><td>נמוך וצר, בדרך כלל עד 5 ס"מ</td><td>מראה מוקפד עם גובה מתון</td></tr><tr><th scope="row">עקב סטילטו</th><td>דק ומחודד, שטח מגע קטן</td><td>ערב ואירועים</td></tr><tr><th scope="row">עקב טריז</th><td>רציף מהעקב עד קדמת הסוליה</td><td>יציבות בגובה, גם על משטח לא ישר</td></tr><tr><th scope="row">עקב פלטפורמה</th><td>הגבהה גם בקדמת הנעל</td><td>גובה עם פחות שיפוע לכף הרגל</td></tr><tr><th scope="row">עקב קוני</th><td>מתרחב כלפי מעלה</td><td>ביניים בין סטילטו לבלוק</td></tr><tr><th scope="row">עקב טרפז</th><td>גיאומטרי, מתרחב כלפי חוץ</td><td>מראה עכשווי עם בסיס יציב</td></tr></tbody></table>
<p>אנחנו מסמנים גם עקב גיאומטרי, עקב עץ ועקב שקוף — אלה מאפיינים חזותיים של העקב ולא סוגי מבנה שונים.</p>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Heel type appears on every product page. These are the types we mark, and what characterises each:</p>
<table><caption>Heel types and what characterises them</caption><thead><tr><th scope="col">Type</th><th scope="col">Character</th><th scope="col">Best suited to</th></tr></thead><tbody><tr><th scope="row">Flat</th><td>Little or no height difference</td><td>All-day everyday wear</td></tr><tr><th scope="row">Block heel</th><td>Wide, squared base; stable</td><td>A working day, walking, a long event</td></tr><tr><th scope="row">Kitten heel</th><td>Low and slim, usually up to 5 cm</td><td>A polished look at a moderate height</td></tr><tr><th scope="row">Stiletto</th><td>Fine and tapered, small contact area</td><td>Evening and occasions</td></tr><tr><th scope="row">Wedge</th><td>Continuous from heel to forefoot</td><td>Height with stability, including on uneven ground</td></tr><tr><th scope="row">Platform</th><td>Raised at the front as well</td><td>Height with less pitch through the foot</td></tr><tr><th scope="row">Cone heel</th><td>Widens towards the top</td><td>A middle ground between stiletto and block</td></tr><tr><th scope="row">Trapeze heel</th><td>Geometric, flaring outwards</td><td>A contemporary look on a stable base</td></tr></tbody></table>
<p>We also mark geometric, wooden and transparent heels — those describe the heel's appearance rather than a different structure.</p>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
  },
  {
    slug: 'how-do-i-choose-shoes-for-an-evening-event',
    audience: 'women',
    topic: 'occasion',
    status: 'published',
    question: {
      he: 'איך בוחרים נעליים לאירוע ערב?',
      en: 'How do I choose shoes for an evening event?',
    },
    shortAnswer: {
      he: 'התאימו את סוג העקב למשטח ולמשך העמידה, ונעלו את הנעליים בבית לפני האירוע.',
      en: 'Match the heel type to the surface and how long you will be standing, and wear them at home first.',
    },
    answerHtml: {
      he: `<p>שתי שאלות מכריעות לפני שמסתכלים על העיצוב: כמה זמן תעמדו, ועל איזה משטח.</p>
<ul><li><strong>חתונה בגן או אירוע על דשא או חצץ</strong> — עקב סטילטו שוקע. עקב בלוק, טריז או פלטפורמה מתמודדים עם זה הרבה יותר טוב.</li><li><strong>אירוע באולם, ישיבה רוב הזמן</strong> — כאן אפשר לבחור עקב דק בלי להתפשר.</li><li><strong>ערב ארוך בעמידה</strong> — כדאי להישאר בטווח שבו אתם כבר יודעים שנוח לכם, ולא לנסות גובה חדש בערב עצמו.</li></ul>
<h3>חומרי גלם לערב</h3>
<p>עור פטנט, עור מטאלי וקטיפה הם החומרים שנוטים לשמש לאירועי ערב. שימו לב שעור פטנט כמעט אינו מתגמש עם השימוש, ולכן ההתאמה בהתחלה היא ההתאמה שתקבלו.</p>
<blockquote class="faq-callout">נעלו את הנעליים בבית לשעה-שעתיים על שטיח לפני האירוע. זה מגלה נקודות לחץ בזמן שעוד אפשר לעשות משהו בנידון, ולא פוגם בסוליה.</blockquote>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Two questions decide this before you look at any design: how long you will be on your feet, and on what surface.</p>
<ul><li><strong>A garden wedding, or anything on grass or gravel</strong> — a stiletto sinks. A block heel, wedge or platform copes far better.</li><li><strong>An indoor venue where you will mostly be seated</strong> — here a fine heel costs you nothing.</li><li><strong>A long evening standing</strong> — stay within a height you already know suits you rather than trying a new one on the night.</li></ul>
<h3>Materials for evening</h3>
<p>Patent leather, metallic leather and velvet are the materials that tend to be used for evening styles. Note that patent leather barely relaxes with wear, so the fit you get at the start is the fit you keep.</p>
<blockquote class="faq-callout">Wear them at home on carpet for an hour or two beforehand. It reveals pressure points while there is still time to do something about them, and it does not mark the sole.</blockquote>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
  },
  {
    slug: 'how-do-i-clean-leather-suede-and-patent-shoes',
    audience: 'women',
    topic: 'care',
    status: 'published',
    question: {
      he: 'איך מנקים נעלי עור, זמש ולכה?',
      en: 'How should leather, suede and patent leather shoes be cleaned?',
    },
    shortAnswer: {
      he: 'לכל חומר גלם טיפול שונה. הכלל המשותף: לתת לנעל להתייבש באוויר, לעולם לא ליד מקור חום.',
      en: 'Each material needs different care. The shared rule: let shoes air-dry, never near a heat source.',
    },
    answerHtml: {
      he: `<p>סוג העור שממנו עשוי החלק העליון מצוין בעמוד המוצר. הטיפול שונה מהותית בין הסוגים.</p>
<h3>עור חלק ועור נאפה</h3>
<ol><li>נגבו אבק במטלית רכה ויבשה.</li><li>נקו בעדינות במטלית לחה במעט מים, ותנו להתייבש באוויר.</li><li>מרחו קרם מזין בגוון תואם פעם בכמה שבועות, בהתאם לתדירות השימוש.</li><li>הבריקו במברשת רכה.</li></ol>
<h3>עור זמש ונובוק</h3>
<p>לא להשתמש במים. מברישים בעדינות במברשת ייעודית לזמש, תמיד בכיוון אחד, כדי להרים את המרקם. כתם קל מוסר בגומי ייעודי לזמש. תרסיס דוחה מים לפני השימוש הראשון חוסך חלק ניכר מהתחזוקה מאוחר יותר.</p>
<h3>עור פטנט (לכה)</h3>
<p>מנגבים במטלית לחה ומייבשים מיד. לא להשתמש בקרם עור: הוא לא נספג בשכבת הגימור ומשאיר שאריות. סימני חיכוך שחורים מהמדרכה יורדים לרוב בעדינות במטלית לחה.</p>
<blockquote class="faq-callout">נעל שנרטבה מתייבשת באוויר, בטמפרטורת החדר, רחוק מרדיאטור, מייבש או שמש ישירה. חום מייבש את השומנים שבעור וגורם לו להתקשות ולהיסדק. מילוי הנעל בנייר עיתון סופג לחות ושומר על הצורה.</blockquote>
<p>בעמוד המוצר מופיעות גם הוראות טיפול ספציפיות לדגם, כשיש כאלה.</p>`,
      en: `<p>The upper material is listed on each product page, and the care differs substantially between types.</p>
<h3>Smooth and nappa leather</h3>
<ol><li>Wipe off dust with a soft dry cloth.</li><li>Clean gently with a barely damp cloth and let the shoe air-dry.</li><li>Apply a matching conditioning cream every few weeks, depending on how often you wear them.</li><li>Buff with a soft brush.</li></ol>
<h3>Suede and nubuck</h3>
<p>Do not use water. Brush gently with a suede brush, always in one direction, to lift the nap. A light mark comes off with a suede eraser. A water-repellent spray before the first wear saves a good deal of the later maintenance.</p>
<h3>Patent leather</h3>
<p>Wipe with a damp cloth and dry immediately. Do not use leather cream: it cannot penetrate the finish and leaves residue. Black scuff marks from pavements usually lift with a gently damp cloth.</p>
<blockquote class="faq-callout">A wet shoe dries in air, at room temperature, away from a radiator, a dryer or direct sun. Heat drives out the oils in the leather, which then hardens and cracks. Stuffing the shoe with newspaper absorbs moisture and holds its shape.</blockquote>
<p>Where a style has its own care instructions, they appear on that product page too.</p>`,
    },
  },
  {
    slug: 'do-leather-shoes-stretch-with-wear',
    audience: 'women',
    topic: 'materials',
    status: 'published',
    question: {
      he: 'האם נעלי עור מתרחבות עם השימוש?',
      en: 'Do leather shoes expand with wear?',
    },
    shortAnswer: {
      he: 'עור מתגמש ברוחב, אך כמעט לא באורך. נעל קצרה לא תהפוך לארוכה יותר.',
      en: 'Leather gives across the width, but hardly at all in length. A short shoe will not become longer.',
    },
    answerHtml: {
      he: `<p>כן, אבל רק בכיוון אחד. עור טבעי מתגמש ברוחב ומתאים את עצמו לצורת כף הרגל תוך כמה נעילות. <strong>באורך הוא כמעט אינו משתנה</strong>, כי שם הוא נמתח על גבי הסוליה. זו ההבחנה החשובה: נעל שלוחצת מהצדדים בדרך כלל תשתפר, ונעל שקצרה מדי תישאר קצרה מדי.</p>
<h3>כמה זה משתנה לפי חומר</h3>
<ul><li><strong>עור נאפה</strong> — רך יחסית, מתגמש הכי מהר.</li><li><strong>עור חלק</strong> — מתגמש בהדרגה, לרוב תוך כמה נעילות.</li><li><strong>עור זמש</strong> — גמיש כבר מלכתחילה.</li><li><strong>עור פטנט</strong> — שכבת הגימור הנוקשה כמעט אינה מאפשרת התגמשות.</li><li><strong>חומרים סינתטיים</strong> — אינם מתגמשים כמו עור טבעי.</li></ul>
<blockquote class="faq-callout">כדאי לנעול נעליים חדשות בבית לפרקי זמן קצרים לפני יום שלם מחוץ לבית. זה מאפשר לעור להתאים את עצמו בהדרגה, ואם מתברר שהמידה אינה נכונה, הנעל עדיין במצב שמאפשר לפנות אלינו לגבי החלפה.</blockquote>
${CHECK_PRODUCT_PAGE.he('/he/collection/women')}`,
      en: `<p>Yes, but only in one direction. Natural leather gives across the width and moulds to the shape of the foot within a few wears. <strong>In length it barely changes</strong>, because there it is stretched over the sole. That distinction is the useful one: a shoe pressing at the sides will usually improve, and a shoe that is too short will stay too short.</p>
<h3>How much, by material</h3>
<ul><li><strong>Nappa leather</strong> — relatively soft, gives fastest.</li><li><strong>Smooth leather</strong> — gives gradually, usually within a few wears.</li><li><strong>Suede</strong> — supple to begin with.</li><li><strong>Patent leather</strong> — the rigid finish allows almost no give.</li><li><strong>Synthetics</strong> — do not relax the way natural leather does.</li></ul>
<blockquote class="faq-callout">Wear new shoes at home for short stretches before a full day out. It lets the leather adapt gradually — and if the size turns out to be wrong, the shoes are still in a condition that lets you talk to us about an exchange.</blockquote>
${CHECK_PRODUCT_PAGE.en('/en/collection/women')}`,
    },
  },
  {
    slug: 'how-can-i-tell-if-a-style-runs-small-or-large',
    audience: 'women',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'איך יודעים אם דגם מסוים קטן או גדול מהמידה?',
      en: 'How can I tell whether a style runs small or large?',
    },
    shortAnswer: {
      he: 'בכל עמוד מוצר מופיע שדה התאמת מידה עם אחת מארבע אפשרויות מוגדרות.',
      en: 'Every product page has a size fit field with one of four defined values.',
    },
    answerHtml: {
      he: `<p>אין צורך לנחש. בכל עמוד מוצר מופיע שדה התאמת מידה עם אחד מהערכים הבאים:</p>
<ul><li><strong>מידה במידה</strong> — הזמינו את המידה שחישבתם מטבלת המידות.</li><li><strong>המידה קטנה מהרגיל</strong> — שקלו לעלות מידה, במיוחד אם המדידה שלכם קרובה לגבול העליון.</li><li><strong>המידה גדולה מהרגיל</strong> — שקלו לרדת מידה, בעיקר בדגם ללא רצועה או אבזם.</li><li><strong>תלוי במבנה כף הרגל</strong> — הדגם מתנהג שונה לפי רוחב כף הרגל וגובה הקשת. כאן כדאי לקרוא גם את שדות רוחב כף הרגל וקשת כף הרגל באותו עמוד.</li></ul>
<p>שדה נוסף שכדאי לקרוא הוא קשת כף הרגל, שמסווג את הדגם כמתאים לקשת נמוכה, רגילה, גבוהה או לרוב סוגי הקשת.</p>
<p>אם דגם עדיין מסומן "טרם הוגדר", פשוט <a href="/he/contact">פנו אלינו</a> ונבדוק עבורכם.</p>`,
      en: `<p>There is no need to guess. Each product page carries a size fit field with one of these values:</p>
<ul><li><strong>True to size</strong> — order the size the conversion table gives you.</li><li><strong>Runs small</strong> — consider sizing up, particularly if your measurement is near the top of a size.</li><li><strong>Runs large</strong> — consider sizing down, especially in a style with no strap or buckle.</li><li><strong>Depends on foot shape</strong> — the style behaves differently according to foot width and arch height. Read the foot width and arch fields on the same page.</li></ul>
<p>The arch field is worth reading too: it classifies a style as suiting a low, regular or high arch, or most arch types.</p>
<p>If a style is still marked "not yet defined", just <a href="/en/contact">get in touch</a> and we will check for you.</p>`,
    },
  },
];

// ── Men ──────────────────────────────────────────────────────────────────────

const MEN: FaqSeedItem[] = [
  {
    slug: 'how-do-i-choose-the-correct-size-for-mens-shoes',
    audience: 'men',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'איך בוחרים מידה נכונה בנעלי גברים?',
      en: "How do I choose the correct size for men's shoes?",
    },
    shortAnswer: {
      he: 'אותה שיטה: מדדו אורך כף רגל בסנטימטרים והשוו לטבלה. טווח המידות אצלנו הוא 35 עד 46.',
      en: 'The same method: measure your foot in centimetres and compare it to the table. Our range is 35 to 46.',
    },
    answerHtml: {
      he: `<p>טבלת המידות זהה לכל הקולקציה — היא מבוססת על אורך כף הרגל בפועל, ולא על מגדר. מדדו את אורך כף הרגל בסנטימטרים והשוו לעמודת אורך כף הרגל.</p>
<table><caption>המרת מידות SAKO</caption><thead><tr><th scope="col">מידת SAKO</th><th scope="col">מידה אמריקאית</th><th scope="col">אורך כף רגל (ס"מ)</th></tr></thead><tbody><tr><th scope="row">40</th><td>10</td><td>25.0</td></tr><tr><th scope="row">41</th><td>11</td><td>25.5</td></tr><tr><th scope="row">42</th><td>12</td><td>26.0</td></tr><tr><th scope="row">43</th><td>13</td><td>26.5</td></tr><tr><th scope="row">44</th><td>14</td><td>27.0</td></tr><tr><th scope="row">45</th><td>15</td><td>27.5</td></tr><tr><th scope="row">46</th><td>16</td><td>28.0</td></tr></tbody></table>
<p>הטווח המלא מתחיל ב-35. השאירו 5 עד 10 מ"מ מקום פנוי מקצה הבוהן הארוכה ביותר.</p>
<blockquote class="faq-callout">נעל גברים קלאסית נמדדת בדרך כלל בגרב שבו תנעלו אותה בפועל. גרב חורף עבה יכול להוסיף עד חצי מידה מבחינת התחושה.</blockquote>
${CHECK_PRODUCT_PAGE.he('/he/collection/men')}`,
      en: `<p>The conversion table is the same across the whole collection — it is based on actual foot length, not on gender. Measure your foot in centimetres and read across from the foot length column.</p>
<table><caption>SAKO size conversion</caption><thead><tr><th scope="col">SAKO size</th><th scope="col">US size</th><th scope="col">Foot length (cm)</th></tr></thead><tbody><tr><th scope="row">40</th><td>10</td><td>25.0</td></tr><tr><th scope="row">41</th><td>11</td><td>25.5</td></tr><tr><th scope="row">42</th><td>12</td><td>26.0</td></tr><tr><th scope="row">43</th><td>13</td><td>26.5</td></tr><tr><th scope="row">44</th><td>14</td><td>27.0</td></tr><tr><th scope="row">45</th><td>15</td><td>27.5</td></tr><tr><th scope="row">46</th><td>16</td><td>28.0</td></tr></tbody></table>
<p>The full range starts at 35. Leave 5 to 10 mm of room beyond your longest toe.</p>
<blockquote class="faq-callout">Measure in the socks you will actually wear with the shoes. A thick winter sock can be worth up to half a size in how the fit feels.</blockquote>
${CHECK_PRODUCT_PAGE.en('/en/collection/men')}`,
    },
    relatedLinks: [
      { label: { he: 'קולקציית הגברים', en: "Men's collection" }, href: '/collection/men' },
    ],
  },
  {
    slug: 'how-should-mens-loafers-and-moccasins-fit',
    audience: 'men',
    topic: 'fit',
    status: 'published',
    question: {
      he: 'איך צריכה להיות ההתאמה של מוקסינים ולופרים?',
      en: 'How should loafers or moccasins fit?',
    },
    shortAnswer: {
      he: 'צמוד יותר מנעל עם שרוכים — אין שרוך שיהדק אותה, אז ההתאמה עצמה מחזיקה אותה על הרגל.',
      en: 'Closer than a laced shoe. There is no lace to tighten, so the fit itself is what holds it on.',
    },
    answerHtml: {
      he: `<p>לופר או מוקסין נשענים על ההתאמה בלבד — אין שרוך, אבזם או סקוץ' שיפצו על נעל רחבה מדי. לכן ההתאמה הנכונה צמודה יותר משל נעל עם שרוכים.</p>
<h3>מה לבדוק</h3>
<ul><li><strong>העקב.</strong> החלקה קלה של העקב בנעילה הראשונה היא נורמלית, ובעור טבעי היא נפתרת ברוב המקרים תוך כמה נעילות כשהעור מתגמש סביב הרגל. עקב שיוצא מהנעל לגמרי בכל צעד מעיד על נעל גדולה מדי.</li><li><strong>הפתח.</strong> צריך להיות אפשר להכניס את הרגל בלי מאמץ, אבל בלי רווח פעור מהצדדים.</li><li><strong>קדמת הנעל.</strong> האצבעות צריכות לשכב שטוח, בלי לחץ מלמעלה.</li></ul>
<p>אם בין שתי מידות — בלופר זו אחת מהמצבים שבהם דווקא כדאי לשקול את המידה הקטנה, כי הנעל תתגמש ברוחב אבל לא תתהדק חזרה.</p>
<p>בעמוד המוצר מצוין גם אם לדגם יש אמצעי כוונון כלשהו, כמו גומי, שמשנה את התמונה.</p>
${CHECK_PRODUCT_PAGE.he('/he/collection/men')}`,
      en: `<p>A loafer or moccasin relies on fit alone — there is no lace, buckle or strap to compensate for a shoe that is too roomy. The right fit is therefore closer than it would be on a laced shoe.</p>
<h3>What to check</h3>
<ul><li><strong>The heel.</strong> A little heel slip on the first wear is normal, and in natural leather it usually resolves within a few wears as the leather moulds to the foot. A heel that lifts clear at every step means the shoe is too big.</li><li><strong>The opening.</strong> Your foot should go in without effort, but without a gaping gap at the sides.</li><li><strong>The toe box.</strong> Toes should lie flat, with no pressure from above.</li></ul>
<p>If you are between sizes, a loafer is one of the cases where the smaller size is worth considering: the shoe will give across the width, but it will not tighten back up.</p>
<p>The product page also states whether a style has any adjustment, such as elastic, which changes the picture.</p>
${CHECK_PRODUCT_PAGE.en('/en/collection/men')}`,
    },
  },
  {
    slug: 'difference-between-leather-and-other-upper-materials',
    audience: 'men',
    topic: 'materials',
    status: 'published',
    question: {
      he: 'מה ההבדל בין עור לחומרי גלם אחרים?',
      en: 'What is the difference between leather and other upper materials?',
    },
    shortAnswer: {
      he: 'עור טבעי נושם, מתגמש לצורת כף הרגל ומתוחזק לאורך שנים. חומרים אחרים קלים יותר אך אינם מתאימים את עצמם.',
      en: 'Natural leather breathes, moulds to the foot and can be maintained for years. Other materials are lighter but do not adapt.',
    },
    answerHtml: {
      he: `<p>סוג החומר של החלק העליון מצוין בכל עמוד מוצר. אלה ההבדלים המעשיים:</p>
<table><caption>חומרי גלם והמאפיינים שלהם</caption><thead><tr><th scope="col">חומר</th><th scope="col">מאפיין</th><th scope="col">תחזוקה</th></tr></thead><tbody><tr><th scope="row">עור חלק</th><td>עמיד, מתגמש לצורת הרגל, נושם</td><td>ניקוי והזנה תקופתית בקרם</td></tr><tr><th scope="row">עור נאפה</th><td>רך ובעל מגע עדין</td><td>כמו עור חלק, ברגישות גבוהה יותר</td></tr><tr><th scope="row">עור זמש</th><td>מרקם מט, גמיש מלכתחילה</td><td>מברשת ייעודית, ללא מים</td></tr><tr><th scope="row">עור נובוק</th><td>דומה לזמש, עמיד יותר</td><td>מברשת ותרסיס דוחה מים</td></tr><tr><th scope="row">עור פטנט</th><td>גימור מבריק ונוקשה</td><td>מטלית לחה בלבד</td></tr><tr><th scope="row">טקסטיל וקנבס</th><td>קל ואוורירי</td><td>ניקוי נקודתי</td></tr><tr><th scope="row">חומר סינתטי</th><td>אחיד, עמיד למים</td><td>ניקוי פשוט, אינו מתגמש</td></tr></tbody></table>
<p>ההבדל המשמעותי ביותר לשימוש יומיומי הוא שעור טבעי מתאים את עצמו לכף הרגל, וחומר סינתטי לא. נעל עור שלוחצת מעט בהתחלה בדרך כלל משתפרת; נעל סינתטית שלוחצת תמשיך ללחוץ.</p>
${CHECK_PRODUCT_PAGE.he('/he/collection/men')}`,
      en: `<p>The upper material is stated on every product page. These are the practical differences:</p>
<table><caption>Materials and their characteristics</caption><thead><tr><th scope="col">Material</th><th scope="col">Character</th><th scope="col">Maintenance</th></tr></thead><tbody><tr><th scope="row">Smooth leather</th><td>Durable, moulds to the foot, breathes</td><td>Periodic cleaning and conditioning</td></tr><tr><th scope="row">Nappa leather</th><td>Soft, fine to the touch</td><td>As smooth leather, more gently</td></tr><tr><th scope="row">Suede</th><td>Matte nap, supple from the start</td><td>Suede brush, no water</td></tr><tr><th scope="row">Nubuck</th><td>Similar to suede, more hard-wearing</td><td>Brush and water-repellent spray</td></tr><tr><th scope="row">Patent leather</th><td>High-gloss, rigid finish</td><td>Damp cloth only</td></tr><tr><th scope="row">Textile and canvas</th><td>Light and breathable</td><td>Spot cleaning</td></tr><tr><th scope="row">Synthetic</th><td>Uniform, water-resistant</td><td>Simple to clean, does not relax</td></tr></tbody></table>
<p>The difference that matters most day to day: natural leather adapts to your foot and a synthetic does not. A leather shoe that presses slightly at first usually improves; a synthetic one that presses will keep pressing.</p>
${CHECK_PRODUCT_PAGE.en('/en/collection/men')}`,
    },
  },
  {
    slug: 'which-shoes-suit-work-or-formal-occasions',
    audience: 'men',
    topic: 'occasion',
    status: 'published',
    question: {
      he: 'אילו נעליים מתאימות לעבודה או לאירוע רשמי?',
      en: 'Which shoes are suitable for work or formal occasions?',
    },
    shortAnswer: {
      he: 'ככל שהנעל חלקה, כהה ומינימלית יותר — כך היא רשמית יותר. עור חלק שחור הוא הבחירה הרשמית ביותר.',
      en: 'The smoother, darker and plainer the shoe, the more formal it reads. Black smooth leather is the most formal choice.',
    },
    answerHtml: {
      he: `<p>יש כלל פשוט שעובד כמעט תמיד: <strong>ככל שהנעל חלקה, כהה ומינימלית יותר, כך היא רשמית יותר.</strong></p>
<h3>מהרשמי ביותר לפחות רשמי</h3>
<ol><li><strong>עור חלק שחור, גימור מבריק, עיטור מינימלי</strong> — אירועים רשמיים, חליפה כהה.</li><li><strong>עור חלק חום או בורדו</strong> — יום עבודה עסקי, מתאים גם לחליפה בהירה יותר.</li><li><strong>לופר בעור חלק</strong> — סמארט קז'ואל, יום עבודה במשרד ללא קוד לבוש נוקשה.</li><li><strong>עור זמש או נובוק</strong> — קז'ואל מוקפד. פחות מתאים לאירוע רשמי.</li><li><strong>טקסטיל, קנבס וסניקרס</strong> — יומיומי.</li></ol>
<h3>שיקולים מעשיים ליום עבודה ארוך</h3>
<ul><li>סוליה עם ריפוד סופגת טוב יותר עמידה ממושכת מסוליה נוקשה.</li><li>לסירוגין בין שני זוגות מאריך משמעותית את חיי שניהם: לעור נדרש זמן להתייבש מלחות מלאה בין נעילות.</li><li>עור חלק סובל פחות מגשם מזמש, שדורש תרסיס דוחה מים לפני החורף.</li></ul>
${CHECK_PRODUCT_PAGE.he('/he/collection/men')}`,
      en: `<p>One rule covers most of it: <strong>the smoother, darker and plainer the shoe, the more formal it reads.</strong></p>
<h3>Most to least formal</h3>
<ol><li><strong>Black smooth leather, polished finish, minimal detailing</strong> — formal occasions, a dark suit.</li><li><strong>Brown or burgundy smooth leather</strong> — business days, and lighter suits.</li><li><strong>A smooth-leather loafer</strong> — smart casual, and offices without a strict dress code.</li><li><strong>Suede or nubuck</strong> — considered casual. Less suited to a formal occasion.</li><li><strong>Textile, canvas and sneakers</strong> — everyday.</li></ol>
<h3>Practical points for a long working day</h3>
<ul><li>A cushioned sole handles prolonged standing better than a rigid one.</li><li>Alternating between two pairs extends the life of both considerably: leather needs time to dry out fully between wears.</li><li>Smooth leather copes with rain better than suede, which wants a water-repellent spray before winter.</li></ul>
${CHECK_PRODUCT_PAGE.en('/en/collection/men')}`,
    },
    relatedLinks: [
      { label: { he: 'קולקציית הגברים', en: "Men's collection" }, href: '/collection/men' },
    ],
  },
  {
    slug: 'how-should-mens-leather-shoes-be-maintained',
    audience: 'men',
    topic: 'care',
    status: 'published',
    question: {
      he: 'איך מתחזקים נעלי עור לאורך זמן?',
      en: 'How should leather shoes be maintained?',
    },
    shortAnswer: {
      he: 'לסירוגין בין זוגות, לנקות אחרי שימוש, להזין בקרם תקופתית, ולייבש תמיד באוויר.',
      en: 'Alternate pairs, clean after wear, condition periodically, and always dry in air.',
    },
    answerHtml: {
      he: `<p>נעלי עור מתוחזקות מחזיקות שנים. ארבעה הרגלים עושים את רוב העבודה.</p>
<h3>לסירוגין בין זוגות</h3>
<p>ההרגל היחיד המשמעותי ביותר. כף רגל מפרישה לחות במשך יום שלם, ולעור נדרש זמן להתייבש. נעילה של אותו זוג יום אחר יום מקצרת את חייו בצורה ניכרת.</p>
<h3>ניקוי אחרי שימוש</h3>
<p>נגבו אבק ולכלוך במטלית רכה בסוף היום. לכלוך שנשאר על העור סופג ממנו לחות ומייבש אותו.</p>
<h3>הזנה תקופתית</h3>
<p>קרם עור בגוון תואם, פעם בכמה שבועות בשימוש קבוע. הקרם מחזיר לעור את השומנים שאובדים בשימוש ומונע יובש וסדקים.</p>
<h3>שמירה על הצורה</h3>
<p>אימומי עץ (בעיקר ארז) סופגים לחות ומחזיקים את הנעל בצורתה בין נעילות. אם אין, נייר עיתון מגולגל עושה עבודה סבירה.</p>
<blockquote class="faq-callout">אף פעם לא לייבש נעל רטובה ליד רדיאטור, מייבש או בשמש ישירה. חום מוציא מהעור את השומנים, והוא מתקשה ונסדק — נזק שכבר לא מתקנים.</blockquote>
<p>הוראות טיפול ספציפיות לדגם, כשקיימות, מופיעות בעמוד המוצר.</p>`,
      en: `<p>Maintained leather shoes last for years. Four habits do most of the work.</p>
<h3>Alternate between pairs</h3>
<p>The single most effective habit. A foot puts out moisture across a full day, and leather needs time to dry. Wearing the same pair day after day shortens its life appreciably.</p>
<h3>Clean after wear</h3>
<p>Wipe off dust and dirt with a soft cloth at the end of the day. Dirt left on leather draws moisture out of it and dries it.</p>
<h3>Condition periodically</h3>
<p>A matching leather cream every few weeks in regular wear. It replaces the oils that wear takes out and prevents drying and cracking.</p>
<h3>Hold the shape</h3>
<p>Wooden shoe trees, cedar in particular, absorb moisture and hold the shoe's shape between wears. Failing that, rolled newspaper does a reasonable job.</p>
<blockquote class="faq-callout">Never dry wet shoes near a radiator, a dryer or in direct sun. Heat drives the oils out of the leather, which then hardens and cracks — and that damage cannot be undone.</blockquote>
<p>Where a style has its own care instructions, they appear on its product page.</p>`,
    },
  },
  {
    slug: 'what-should-men-do-when-between-sizes',
    audience: 'men',
    topic: 'sizing',
    status: 'published',
    question: {
      he: 'מה עושים כשאני בין מידות בנעלי גברים?',
      en: 'What should I do if I am between sizes?',
    },
    shortAnswer: {
      he: 'בנעל עם שרוכים עלו מידה; בלופר ובמוקסין שקלו את המידה הקטנה.',
      en: 'Size up in a laced shoe; in a loafer or moccasin consider the smaller size.',
    },
    answerHtml: {
      he: `<p>התשובה תלויה בסוג הסגירה של הנעל, כי היא קובעת כמה אפשר לתקן אחר כך.</p>
<ul><li><strong>נעל עם שרוכים</strong> — עלו מידה. השרוך מהדק את הפתח ומפצה על רווח קל, ומדרס דק סוגר את השאר.</li><li><strong>לופר או מוקסין</strong> — שקלו את המידה הקטנה. אין מה שיהדק נעל רחבה, והעור יתגמש ברוחב בכל מקרה.</li><li><strong>נעל עם אבזם או רצועה מתכווננת</strong> — עלו מידה. הכוונון קיים בדיוק בשביל זה.</li><li><strong>סנדל</strong> — עלייה במידה מסכנת חריגה של כף הרגל מהסוליה. בדקו את שדה רוחב כף הרגל בעמוד המוצר.</li></ul>
<p>קראו גם את שדה התאמת המידה בעמוד המוצר: דגם המסומן "המידה קטנה מהרגיל" כבר עונה על השאלה.</p>
<p>לא בטוחים? <a href="https://wa.me/972504487979">כתבו לנו בוואטסאפ</a> עם המידה שמדדתם ושם הדגם.</p>`,
      en: `<p>The answer depends on how the shoe fastens, because that decides how much can be corrected afterwards.</p>
<ul><li><strong>A laced shoe</strong> — size up. The lace closes the gap, and a thin insole takes up the rest.</li><li><strong>A loafer or moccasin</strong> — consider the smaller size. Nothing tightens a roomy one, and the leather will give across the width regardless.</li><li><strong>A shoe with a buckle or adjustable strap</strong> — size up. That is what the adjustment is for.</li><li><strong>A sandal</strong> — sizing up risks the foot overhanging the sole. Check the foot width field on the product page.</li></ul>
<p>Read the size fit field on the product page as well: a style marked "runs small" has already answered the question.</p>
<p>Still unsure? <a href="https://wa.me/972504487979">Message us on WhatsApp</a> with your measurement and the style name.</p>`,
    },
  },
];

// ── General (educational, publishable) ───────────────────────────────────────

const GENERAL_PUBLISHED: FaqSeedItem[] = [
  {
    slug: 'what-shoe-size-range-does-sako-or-carry',
    audience: 'general',
    topic: 'store',
    status: 'published',
    question: {
      he: 'אילו מידות יש בסכו עור?',
      en: 'What shoe sizes does SAKO-OR carry?',
    },
    shortAnswer: {
      he: 'טווח המידות הוא 35 עד 46 במידות אירופאיות. הזמינות בפועל משתנה בין דגמים.',
      en: 'The range is 35 to 46 in European sizing. Actual availability varies by style.',
    },
    answerHtml: {
      he: `<p>הקולקציה נבנית בטווח מידות אירופאיות של 35 עד 46, שמקביל ל-22.5 עד 28.0 ס"מ באורך כף הרגל.</p>
<p>הזמינות בפועל שונה בין דגם לדגם: לא כל דגם מיוצר בכל הטווח, ומידות נוטות להיגמר במהלך העונה. בעמוד המוצר מוצגות המידות הזמינות באותו רגע — מידה שאינה מופיעה כזמינה אינה במלאי כרגע.</p>
<p>אם המידה שלכם אזלה בדגם שאתם רוצים, <a href="/he/contact">פנו אלינו</a> ונבדוק אם היא צפויה לחזור.</p>`,
      en: `<p>The collection is built in European sizes 35 to 46, which corresponds to a foot length of 22.5 to 28.0 cm.</p>
<p>Actual availability differs from style to style: not every style is made across the whole range, and sizes tend to sell through during a season. Each product page shows the sizes available at that moment — a size not shown as available is not currently in stock.</p>
<p>If your size has sold out in a style you want, <a href="/en/contact">get in touch</a> and we will check whether it is expected back.</p>`,
    },
  },
  {
    slug: 'how-do-i-know-if-a-size-is-in-stock',
    audience: 'general',
    topic: 'store',
    status: 'published',
    question: {
      he: 'איך יודעים אם מידה קיימת במלאי?',
      en: 'How do I know whether a size is in stock?',
    },
    shortAnswer: {
      he: 'עמוד המוצר מציג רק את המידות הזמינות כרגע לאותו צבע.',
      en: 'The product page shows only the sizes currently available in that colour.',
    },
    answerHtml: {
      he: `<p>בעמוד כל מוצר מוצגות המידות הזמינות לאותו דגם ואותו צבע. המלאי מנוהל ברמת הצבע והמידה, ולכן ייתכן שמידה 38 זמינה בצבע אחד ולא בצבע אחר של אותו דגם — כדאי לבדוק את שני הצבעים.</p>
<p>מידה שאינה מופיעה כזמינה אינה במלאי באותו רגע.</p>
<p>אם מה שחיפשתם אינו זמין, <a href="/he/contact">פנו אלינו</a> — לפעמים דגם קיים בחנות הפיזית או צפוי לחזור.</p>`,
      en: `<p>Each product page lists the sizes available in that style and that colour. Stock is tracked per colour and size, so size 38 can be available in one colour of a style and not in another — it is worth checking both.</p>
<p>A size that is not shown as available is not in stock at that moment.</p>
<p>If what you wanted is unavailable, <a href="/en/contact">get in touch</a> — a style is sometimes in the physical store or expected back.</p>`,
    },
  },
];

// ── General (policy — DRAFTS, awaiting approved copy) ────────────────────────

const GENERAL_DRAFTS: FaqSeedItem[] = [
  policyDraft(
    'how-much-does-shipping-cost',
    'shipping',
    { he: 'כמה עולה המשלוח?', en: 'How much does shipping cost?' },
    { he: 'עלויות המשלוח', en: 'shipping costs' }
  ),
  policyDraft(
    'how-long-does-delivery-take',
    'shipping',
    { he: 'תוך כמה זמן מגיע המשלוח?', en: 'How long does delivery take?' },
    { he: 'זמני האספקה', en: 'delivery times' }
  ),
  policyDraft(
    'how-do-i-exchange-an-item',
    'returns',
    { he: 'איך מבצעים החלפה?', en: 'How do I exchange an item?' },
    { he: 'תהליך ההחלפה, חלון הזמן ומצב המוצר הנדרש', en: 'the exchange process, the time window and the required condition' }
  ),
  policyDraft(
    'what-is-the-returns-and-refunds-policy',
    'returns',
    { he: 'מהי מדיניות ההחזרות והזיכויים?', en: 'What is the returns and refunds policy?' },
    { he: 'החזרות, זיכויים וחלון הזמן להחזרה', en: 'returns, refunds and the return window' }
  ),
  policyDraft(
    'how-do-i-track-my-order',
    'shipping',
    { he: 'איך עוקבים אחרי הזמנה?', en: 'How do I track my order?' },
    { he: 'מעקב אחר הזמנות', en: 'order tracking' }
  ),
  policyDraft(
    'where-is-the-physical-store',
    'store',
    { he: 'איפה נמצאת החנות ומה שעות הפעילות?', en: 'Where is the store and what are its opening hours?' },
    { he: 'כתובת החנות ושעות הפעילות', en: 'the store address and opening hours' }
  ),
  policyDraft(
    'which-payment-methods-are-accepted',
    'payment',
    { he: 'באילו אמצעי תשלום אפשר לשלם?', en: 'Which payment methods are accepted?' },
    { he: 'אמצעי התשלום המתקבלים', en: 'accepted payment methods' }
  ),
  policyDraft(
    'how-do-i-contact-customer-service',
    'contact',
    { he: 'איך יוצרים קשר עם שירות הלקוחות?', en: 'How do I contact customer service?' },
    { he: 'ערוצי הפנייה לשירות הלקוחות ושעות המענה', en: 'customer service channels and hours' }
  ),
];

export const FAQ_SEED_ITEMS: FaqSeedItem[] = [
  ...WOMEN,
  ...MEN,
  ...GENERAL_PUBLISHED,
  ...GENERAL_DRAFTS,
];
