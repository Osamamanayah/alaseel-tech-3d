/**
 * assetUrl.js — يبني مسار أي ملف داخل مجلد public.
 *
 * لماذا لا نكتب '/images/...' مباشرة؟
 * لأن الموقع قد يُنشر تحت مسار فرعي، مثل صفحات GitHub:
 *   https://user.github.io/alaseel-tech-3d/
 * عندها يصبح المسار الصحيح '/alaseel-tech-3d/images/...'.
 *
 * Vite يعدّل المسارات داخل CSS وداخل الاستيرادات تلقائيًا، لكنه
 * لا يمسّ النصوص المكتوبة داخل ملفات JavaScript. فلو تركناها ثابتة
 * لاختفت كل الصور فور النشر — والموقع يبدو سليمًا محليًا فلا ننتبه.
 *
 * import.meta.env.BASE_URL يحمل مسار النشر ويُحسم وقت البناء.
 */
const BASE = import.meta.env.BASE_URL || '/';

/**
 * @param {string} path مسار الملف داخل public، بشرطة بادئة أو بدونها
 * @returns {string} مسار صالح في التطوير وفي النشر تحت مسار فرعي
 */
export function assetUrl(path) {
  const clean = String(path).replace(/^\/+/, '');
  return BASE.endsWith('/') ? BASE + clean : `${BASE}/${clean}`;
}
