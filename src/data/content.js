/**
 * content.js — كل محتوى الموقع في ملف واحد.
 * عدّل هنا فقط؛ لا حاجة لتعديل كود المشهد إطلاقًا.
 *
 * البنية:
 *   BRAND            بيانات التواصل (الأرقام والبريد) — مصدر واحد للكل
 *   KEYWORDS         الأقسام العشرة + قسم التواصل، وهي عقد الفضاء
 *   DELIVERABLES     ما تشمله كل خدمة — تظهر كنجوم داخل كوكبة القسم
 *   CONTACT_PLANETS  كواكب قسم التواصل الأربعة
 */

/* ==================================================================
   ⚠️ غيّر الأرقام هنا فقط.
   أزرار الاتصال ورابط الواتساب وبطاقة QR والنسخة النصية
   كلها تقرأ من هذا المكان تلقائيًا.
   اكتب الرقم بصيغة دولية بلا رموز، مثال: 966501234567
   ================================================================== */
export const BRAND = {
  name: 'ALASEEL TECH',          // الاسم المعروض في الشعار والعنوان
  nameAr: 'الأصيل تِك',            // الاسم العربي، يُستخدم في الجمل العربية
  tagline: 'برمجة المواقع والتطبيقات وأنظمة البيانات',
  email: 'osamamaxman@gmail.com',

  phone: '962772499064',       // ← رقم الهاتف
  whatsapp: '962772499064',    // ← رقم الواتساب

  get phoneHref() { return `tel:+${this.phone}`; },
  get whatsappHref() { return `https://wa.me/${this.whatsapp}`; },
  get emailHref() { return `mailto:${this.email}`; },

  /** رابط واتساب برسالة مكتوبة مسبقًا */
  whatsappWith(message) {
    return `https://wa.me/${this.whatsapp}?text=${encodeURIComponent(message)}`;
  },

  /** يعرض الرقم مقروءًا: ‎+966 50 000 0000 */
  get phonePretty() {
    const d = this.phone;
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`.trim();
  },

  /** بطاقة اتصال قياسية — هذا ما يُشفَّر داخل رمز QR */
  get vcard() {
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${this.name};;;`,
      `FN:${this.name}`,
      `ORG:${this.name} (${this.nameAr})`,
      `TEL;TYPE=CELL:+${this.phone}`,
      `EMAIL;TYPE=INTERNET:${this.email}`,
      `URL:${this.whatsappHref}`,
      'END:VCARD',
    ].join('\r\n');   // معيار vCard يتطلب CRLF بين السطور
  },
};

import { serviceImageSetById } from './serviceImages.js';
import { assetUrl } from '../core/assetUrl.js';

/* ------------------------------------------------------------------ */

/** يمزج لونين — نشتق منه خلفية كل منطقة من لونها المميّز */
function mix(hexA, hexB, amount) {
  const toRgb = (h) => {
    const s = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** خلفية المنطقة: لونها المميّز مطفأ نحو الأسود المزرق */
const backdropFor = (accent) => ({
  top: mix(accent, '#05070f', 0.80),
  bottom: mix(accent, '#03040a', 0.93),
});

/* ==================================================================
   الأقسام = خدمات الاستوديو. كل قسم عقدة في الفضاء.
   position: [x, y, z] — z السالب أبعد في العمق.
   label:   الاسم القصير الظاهر في المشهد (يجب أن يبقى قصيرًا).
   title:   الاسم الكامل الظاهر داخل اللوحات.
   ================================================================== */
const SECTIONS = [
  {
    id: 'web-apps',
    image: assetUrl('images/sections/web-development.webp'),
    label: 'إنشاء المواقع',
    title: 'إنشاء المواقع',
    blurb: 'مواقع ومتاجر وأنظمة تعمل داخل المتصفح.',
    position: [-22.5, 10, -4],
    accent: '#22d3ee',
  },
  {
    id: 'native-apps',
    image: assetUrl('images/sections/applications.webp'),
    label: 'إنشاء التطبيقات',
    title: 'إنشاء التطبيقات',
    blurb: 'تطبيقات للهواتف وبرامج لأجهزة الكمبيوتر.',
    position: [-22.5, -10, -8],
    accent: '#4cc9f0',
  },
  {
    id: 'databases',
    label: 'قواعد البيانات',
    title: 'إدارة قواعد البيانات',
    blurb: 'تصميم قواعد البيانات وترحيلها ونسخها احتياطيًا.',
    position: [22.5, -10, -10],
    accent: '#5cb6f5',
  },
  {
    id: 'ai-data',
    image: assetUrl('images/sections/artificial-intelligence.webp'),
    label: 'ذكاء اصطناعي',
    title: 'الذكاء الاصطناعي وتحليل البيانات',
    blurb: 'معالجة البيانات وبناء أنظمة الذكاء الاصطناعي.',
    position: [0, 20, 5],
    accent: '#7b5cff',
  },
  {
    id: 'reviews',
    label: 'آراء العملاء',
    title: 'آراء العملاء',
    blurb: 'شهادات مكتوبة من عملاء في الأردن.',
    position: [22.5, 10, 5],
    accent: '#5cb6f5',
    kind: 'reviews',   // قسم شهادات لا قسم خدمات: بلا صور
  },
  {
    id: 'contact',
    label: 'تواصل معنا',
    title: 'تواصل معنا',
    blurb: 'واتساب، هاتف، بريد إلكتروني، وبطاقة اتصال.',
    position: [0, -20, 2],
    accent: '#c4b5fd',
    kind: 'contact',
  },
];

export const KEYWORDS = SECTIONS.map((s) => {
  // الصور الحقيقية للقسم (خمس لكل قسم). قسم التواصل بلا صور عمدًا.
  const set = serviceImageSetById(s.id);
  return {
    ...s,
    images: set?.images ?? (s.image ? [s.image] : []),
    backdrop: backdropFor(s.accent),
  };
});

/* ==================================================================
   ما تشمله كل خدمة. كل عنصر نجم داخل كوكبة قسمه.
   ================================================================== */
const RAW_DELIVERABLES = {
  'web-apps': [
    {
      id: 'site-corporate',
      name: 'موقع تعريفي',
      tagline: 'موقع تعريفي يعرض نشاط الجهة.',
      description:
        'صفحات بمحتوى عربي وبنية مهيّأة لمحركات البحث، مع لوحة لتحديث النصوص والصور.',
      includes: ['تصميم عربي متجاوب', 'تهيئة لمحركات البحث', 'لوحة تحديث المحتوى'],
    },
    {
      id: 'site-store',
      name: 'متجر إلكتروني',
      tagline: 'متجر إلكتروني بسلة ودفع.',
      description:
        'عرض المنتجات وإدارة المخزون والطلبات، وربط بوابة دفع، مع تقارير مبيعات أساسية.',
      includes: ['سلة وبوابة دفع', 'إدارة المخزون والطلبات', 'تقارير مبيعات'],
    },
    {
      id: 'site-webapp',
      name: 'تطبيق ويب',
      tagline: 'تطبيق ويب بحسابات مستخدمين.',
      description:
        'نظام يعمل داخل المتصفح بحسابات وصلاحيات وقاعدة بيانات، بلا حاجة إلى تثبيت.',
      includes: ['حسابات وصلاحيات', 'يعمل على أي جهاز', 'تحديث بلا تثبيت'],
    },
  ],


  'native-apps': [
    {
      id: 'app-mobile',
      name: 'تطبيق هاتف',
      tagline: 'تطبيق للهواتف يعمل على النظامين.',
      description:
        'قاعدة كود واحدة تُبنى لأندرويد وiOS، مع الإشعارات والنشر على المتاجر.',
      includes: ['أندرويد وiOS', 'إشعارات', 'النشر على المتاجر'],
    },
    {
      id: 'app-desktop',
      name: 'برنامج كمبيوتر',
      tagline: 'برنامج لأجهزة الكمبيوتر.',
      description:
        'تطبيق سطح مكتب لويندوز وماك، مع الوصول إلى الملفات والأجهزة الملحقة وتحديث تلقائي.',
      includes: ['ويندوز وماك', 'تحديث تلقائي', 'الوصول إلى الملفات والطابعات'],
    },
    {
      id: 'app-offline',
      name: 'عمل دون اتصال',
      tagline: 'عمل دون اتصال بالإنترنت.',
      description:
        'تخزين البيانات محليًا ومزامنتها مع الخادم عند توفّر الاتصال، مع معالجة التعارضات.',
      includes: ['تخزين محلي', 'مزامنة تلقائية', 'معالجة التعارضات'],
    },
  ],

  databases: [
    {
      id: 'db-design',
      name: 'تصميم البنية',
      tagline: 'تصميم بنية قاعدة البيانات.',
      description:
        'تحديد الجداول والعلاقات والفهارس والقيود بما يمنع تكرار البيانات وتضاربها.',
      includes: ['نمذجة الجداول والعلاقات', 'فهارس تسرّع البحث', 'قيود تحمي سلامة البيانات'],
    },
    {
      id: 'db-migrate',
      name: 'نقل البيانات',
      tagline: 'ترحيل البيانات بين الأنظمة.',
      description:
        'نقل البيانات من ملفات أو نظام قائم إلى قاعدة جديدة، مع تنظيفها والتحقق من اكتمالها.',
      includes: ['تنظيف البيانات وتوحيدها', 'تحقق قبل النقل وبعده', 'خطة تراجع عند الخطأ'],
    },
    {
      id: 'db-backup',
      name: 'نسخ احتياطي واستعادة',
      tagline: 'النسخ الاحتياطي والاستعادة.',
      description:
        'جدولة نسخ دورية تُخزَّن خارج الخادم، مع اختبار الاستعادة للتأكد من صلاحيتها.',
      includes: ['نسخ مجدولة', 'تخزين خارج الخادم', 'اختبار استعادة دوري'],
    },
  ],





  'ai-data': [
    {
      id: 'ai-assistant',
      name: 'مساعد يفهم العربية',
      tagline: 'مساعد يجيب من مستندات محدّدة.',
      description:
        'نظام استرجاع وتوليد يقرأ مستندات الجهة ويجيب بالعربية مع الإشارة إلى المصدر.',
      includes: ['قراءة المستندات', 'الإشارة إلى المصدر', 'رفض الإجابة بلا دليل'],
    },
    {
      id: 'ai-dashboards',
      name: 'لوحات تحليل',
      tagline: 'لوحات لعرض البيانات.',
      description:
        'عرض المؤشرات الأساسية ومقارنتها بالفترات السابقة، مع إمكانية تصدير التقارير.',
      includes: ['مؤشرات أساسية', 'مقارنة بالفترات السابقة', 'تصدير التقارير'],
    },
    {
      id: 'ai-predict',
      name: 'نماذج تنبؤ',
      tagline: 'نماذج تنبؤ من بيانات سابقة.',
      description:
        'تدريب نموذج على بيانات تاريخية لتقدير الطلب أو رصد الحالات غير المعتادة.',
      includes: ['تقدير الطلب والمخزون', 'رصد الحالات غير المعتادة', 'تفسير كل تنبؤ'],
    },
  ],

};

/** نُسطّح البيانات ونضيف لكل عنصر قسمَه وروابطه داخل الكوكبة */
export const DELIVERABLES = Object.entries(RAW_DELIVERABLES).flatMap(([keyword, items]) => {
  const photos = serviceImageSetById(keyword)?.images ?? [];
  return items.map((item, i) => ({
    ...item,
    keyword,
    service: true,
    // صورة حقيقية مختلفة لكل عنصر داخل القسم
    image: photos[(i + 1) % (photos.length || 1)],
    // كل عنصر يرتبط بالذي يليه داخل نفس القسم، فتتشكّل الكوكبة حلقة مغلقة
    related: [items[(i + 1) % items.length].id],
  }));
});


/* ==================================================================
   آراء العملاء — كل العملاء من الأردن، والاقتباسات باللهجة الأردنية
   لتكون أقرب إلى صوت العميل الحقيقي.

   ⚠️ النصوص أدناه نماذج للعرض فقط. استبدلها بشهادات حقيقية
   حصلت على إذن أصحابها قبل نشر الموقع. نشر شهادات غير حقيقية
   منسوبة إلى أشخاص أو شركات يضرّ بسمعتك وقد يعرّضك للمساءلة.
   ================================================================== */
export const REVIEWS = [
  {
    id: 'review-amman-retail',
    keyword: 'reviews',
    name: 'متجر تجزئة — عمّان',
    tagline: 'تحسّن سرعة المتجر على الهاتف.',
    review: {
      author: 'مدير التشغيل',
      org: 'شركة تجزئة',
      city: 'عمّان',
      quote:
        'المتجر كان بطيء كتير والزباين بيطلعوا قبل ما يشتروا. بعد ما انبنى من جديد صار يفتح على طول، وطلبات الموبايل زادت بشكل واضح.',
      rating: 5,
    },
    related: ['review-irbid-clinic'],
  },
  {
    id: 'review-irbid-clinic',
    keyword: 'reviews',
    name: 'مركز طبي — إربد',
    tagline: 'أتمتة حجز المواعيد.',
    review: {
      author: 'المدير الإداري',
      org: 'مركز طبي',
      city: 'إربد',
      quote:
        'كنّا نسجّل المواعيد بالدفتر وبنغلط كتير. هلأ النظام بينظّم الحجوزات وبيذكّر المريض لحاله، وقلّت الغيابات كتير.',
      rating: 5,
    },
    related: ['review-zarqa-factory'],
  },
  {
    id: 'review-zarqa-factory',
    keyword: 'reviews',
    name: 'مصنع — الزرقاء',
    tagline: 'تقارير إنتاج تُبنى تلقائيًا.',
    review: {
      author: 'مدير الإنتاج',
      org: 'مصنع مواد غذائية',
      city: 'الزرقاء',
      quote:
        'كنّا نضيّع ساعات لنجمّع تقارير الإنتاج. هلأ بتوصلنا جاهزة كل صبح بدون ما نعمل إشي، وبنفس الترتيب كل مرة.',
      rating: 5,
    },
    related: ['review-aqaba-tourism'],
  },
  {
    id: 'review-aqaba-tourism',
    keyword: 'reviews',
    name: 'شركة سياحة — العقبة',
    tagline: 'واجهة حجز عربية.',
    review: {
      author: 'صاحب الشركة',
      org: 'شركة رحلات بحرية',
      city: 'العقبة',
      quote:
        'الواجهة بالعربي واضحة وسهلة، وصار الزباين يحجزوا لحالهم بدون ما يتصلوا فينا بكل خطوة.',
      rating: 5,
    },
    related: ['review-salt-school'],
  },
  {
    id: 'review-salt-school',
    keyword: 'reviews',
    name: 'مدرسة خاصة — السلط',
    tagline: 'العلامات تصل إلى أولياء الأمور مباشرة.',
    review: {
      author: 'مدير المدرسة',
      org: 'مدرسة خاصة',
      city: 'السلط',
      quote:
        'كنّا نطبع كشوف العلامات ونوزّعها بالإيد. هلأ الأهل بيشوفوا علامات ولادهم وحضورهم من التلفون أول بأول.',
      rating: 5,
    },
    related: ['review-madaba-workshop'],
  },
  {
    id: 'review-madaba-workshop',
    keyword: 'reviews',
    name: 'ورشة صيانة — مأدبا',
    tagline: 'الفواتير ومخزون القطع في نظام واحد.',
    review: {
      author: 'صاحب الورشة',
      org: 'ورشة صيانة مركبات',
      city: 'مأدبا',
      quote:
        'كنت أتابع القطع والفواتير على دفتر. هلأ بشوف الكمية اللي عندي والفاتورة المستحقة بشاشة وحدة.',
      rating: 5,
    },
    related: ['review-karak-coop'],
  },
  {
    id: 'review-karak-coop',
    keyword: 'reviews',
    name: 'جمعية تعاونية — الكرك',
    tagline: 'الطلبات تصل عبر التطبيق.',
    review: {
      author: 'رئيس الجمعية',
      org: 'جمعية تعاونية زراعية',
      city: 'الكرك',
      quote:
        'الأعضاء كانوا يتصلوا عشان يسجّلوا طلباتهم. صاروا يسجّلوها بحالهم بالتطبيق، وخلصت اللخبطة بالكميات.',
      rating: 4,
    },
    related: ['review-amman-law'],
  },
  {
    id: 'review-amman-law',
    keyword: 'reviews',
    name: 'مكتب محاماة — عمّان',
    tagline: 'البحث في أرشيف القضايا صار بثوانٍ.',
    review: {
      author: 'المحامي المسؤول',
      org: 'مكتب محاماة',
      city: 'عمّان',
      quote:
        'كنّا ندوّر على الملف القديم نص يوم. بعد الأرشفة الرقمية والبحث بالنص صار الموضوع ثواني.',
      rating: 5,
    },
    related: ['review-amman-retail'],
  },
];

/* ==================================================================
   كواكب قسم «تواصل معنا»
   ================================================================== */
export const CONTACT_PLANETS = [
  {
    id: 'contact-whatsapp',
    keyword: 'contact',
    name: 'واتساب',
    tagline: 'مراسلة مباشرة عبر واتساب.',
    description: 'اكتب فكرة المشروع باختصار، ويصلك ردّ يوضّح الخطوات والمدة التقديرية.',
    contact: {
      type: 'link',
      action: 'فتح محادثة واتساب',
      get href() { return BRAND.whatsappWith('السلام عليكم، أرغب بالاستفسار عن خدماتكم.'); },
      get value() { return BRAND.phonePretty; },
    },
    icon: 'whatsapp',
    related: ['contact-phone'],
  },
  {
    id: 'contact-phone',
    keyword: 'contact',
    name: 'هاتف',
    tagline: 'اتصال هاتفي مباشر.',
    description: 'مكالمة قصيرة لمناقشة نطاق العمل ومدّته وتكلفته التقديرية.',
    contact: {
      type: 'tel',
      action: 'اتصال الآن',
      get href() { return BRAND.phoneHref; },
      get value() { return BRAND.phonePretty; },
    },
    icon: 'phone',
    related: ['contact-email'],
  },
  {
    id: 'contact-email',
    keyword: 'contact',
    name: 'البريد',
    tagline: 'بريد إلكتروني للتفاصيل والملفات.',
    description: 'أرسل وصف المشروع والمرفقات، ويصلك ردّ مكتوب.',
    contact: {
      type: 'mail',
      action: 'إرسال بريد',
      get href() { return BRAND.emailHref; },
      get value() { return BRAND.email; },
    },
    icon: 'email',
    related: ['contact-qr'],
  },
  {
    id: 'contact-qr',
    keyword: 'contact',
    name: 'بطاقة اتصال',
    tagline: 'بطاقة اتصال قابلة للمسح.',
    description: 'مسح الرمز يضيف الاسم والهاتف والبريد إلى جهات الاتصال مباشرة.',
    contact: {
      type: 'qr',
      action: 'امسح الرمز بكاميرا هاتفك',
      get value() { return BRAND.vcard; },
    },
    icon: 'qr',
    related: ['contact-whatsapp'],
  },
];

/* ==================================================================
   دوال البحث
   ================================================================== */

export const keywordById = (id) => KEYWORDS.find((k) => k.id === id);

export const isContactKeyword = (keywordId) => keywordById(keywordId)?.kind === 'contact';

export const isReviewsKeyword = (keywordId) => keywordById(keywordId)?.kind === 'reviews';

/** عناصر كوكبة قسم ما: كواكب التواصل، أو ما تشمله الخدمة */
export const projectsOf = (keywordId) => {
  if (isContactKeyword(keywordId)) return CONTACT_PLANETS;
  if (isReviewsKeyword(keywordId)) return REVIEWS;
  return DELIVERABLES.filter((d) => d.keyword === keywordId);
};

export const projectById = (id) =>
  DELIVERABLES.find((d) => d.id === id)
  || CONTACT_PLANETS.find((p) => p.id === id)
  || REVIEWS.find((r) => r.id === id);

/** يبقى مُصدَّرًا للتوافق: كل عناصر الكوكبات مجتمعة */
export const PROJECTS = DELIVERABLES;
