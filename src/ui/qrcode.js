/**
 * qrcode.js — يرسم رمز QR كصورة جاهزة للعرض.
 *
 * لماذا مكتبة ولسنا نكتبه بأنفسنا؟
 * رمز QR ليس مجرد شبكة مربعات: فيه تصحيح أخطاء Reed-Solomon حتى
 * يُقرأ رغم الخدوش والانعكاسات. كتابته يدويًا مصدر أخطاء صامتة —
 * رمز يبدو صحيحًا لكنه لا يُمسح. المكتبة هنا 30 كيلوبايت بلا تبعيات.
 */
import qrcode from 'qrcode-generator';

const cache = new Map();

/**
 * @param {string} text   النص المراد تشفيره (بطاقة اتصال، رابط، رقم...)
 * @param {number} pixels حجم الصورة الناتجة بالبكسل
 * @returns {string} data URL جاهز لـ <img src>
 */
export function makeQrDataUrl(text, pixels = 420) {
  const key = `${text}|${pixels}`;
  if (cache.has(key)) return cache.get(key);

  // 0 = اختيار تلقائي لأصغر إصدار يتّسع للنص
  // 'M' = تصحيح أخطاء متوسط (~15%): توازن جيد بين الحجم والموثوقية
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');   // Byte يدعم UTF-8 فيمرّ النص العربي سليمًا
  qr.make();

  const count = qr.getModuleCount();
  const QUIET = 4;                       // هامش صامت إلزامي حول الرمز
  const total = count + QUIET * 2;
  const scale = Math.max(2, Math.floor(pixels / total));
  const size = total * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // خلفية فاتحة صريحة: كاميرات الجوال تحتاج تباينًا عاليًا،
  // ورمز فاتح على خلفية داكنة يفشل مسحه على كثير من الأجهزة.
  ctx.fillStyle = '#f5f8ff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#06101f';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      ctx.fillRect((col + QUIET) * scale, (row + QUIET) * scale, scale, scale);
    }
  }

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
