/**
 * textTexture.js — يحوّل نصًا عربيًا إلى صورة (texture) صالحة للاستخدام في Three.js.
 *
 * لماذا؟ Three.js لا يعرف كيف يصل الحروف العربية ببعضها (الشكل الابتدائي/الوسطي/النهائي).
 * لكن المتصفح يعرف. لذلك نرسم النص على <canvas> ثم نستعمل الناتج كصورة.
 */
import * as THREE from 'three';

const cache = new Map();

const FONT_STACK = '"Noto Kufi Arabic", "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';

/**
 * @returns {{texture: THREE.CanvasTexture, aspect: number}}
 */
export function makeTextTexture(text, opts = {}) {
  const {
    fontSize = 72,
    weight = 700,
    color = '#e9edff',
    glow = '#22d3ee',
    glowBlur = 18,
    padding = 34,
    letterSpacing = 0,
    backing = 'rgba(3, 5, 14, 0.92)',   // هالة داكنة خلف الحروف لرفع التباين
    backingBlur = 14,
    fontFamily = FONT_STACK,   // يمكن تمرير خط مختلف للشعار
    gradient = null,           // [[موضع, لون], ...] لتعبئة معدنية لامعة
    bevel = 0,                 // ظل سفلي خفيف يعطي النص بروزًا
  } = opts;

  const key = [text, fontSize, weight, color, glow, glowBlur, padding, letterSpacing,
    backing, backingBlur, fontFamily, JSON.stringify(gradient), bevel].join("|");
  if (cache.has(key)) return cache.get(key);

  // نحدّ من دقة البكسل حتى لا نستهلك ذاكرة كبيرة على الهواتف
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${weight} ${fontSize}px ${fontFamily}`;

  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  const metrics = ctx.measureText(text);

  const w = Math.ceil(metrics.width) + padding * 2;
  const h = Math.ceil(fontSize * 1.55) + padding * 2;

  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);

  ctx.scale(dpr, dpr);
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.direction = 'rtl';          // اتجاه الكتابة من اليمين لليسار
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ثلاث تمريرات بالترتيب:
  // 1) هالة داكنة تفصل الحرف عن أي خلفية مضيئة خلفه (تباين مضمون)
  if (backing) {
    ctx.shadowColor = backing;
    ctx.shadowBlur = backingBlur;
    ctx.fillStyle = backing;
    ctx.fillText(text, w / 2, h / 2);
    ctx.fillText(text, w / 2, h / 2);   // تكرار يزيد كثافة الهالة
  }
  // 2) توهج ملوّن يعطي الطابع النيوني
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowBlur;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  }
  // 3) بروز سفلي: نسخة داكنة مزاحة للأسفل تعطي النص سماكة وعمقًا
  ctx.shadowBlur = 0;
  if (bevel) {
    ctx.fillStyle = 'rgba(2, 6, 20, 0.55)';
    ctx.fillText(text, w / 2, h / 2 + bevel);
  }

  // 4) الحرف نفسه: تعبئة معدنية متدرّجة إن طُلبت، وإلا لون واحد
  if (gradient) {
    const top = h / 2 - fontSize * 0.62;
    const bottom = h / 2 + fontSize * 0.52;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    for (const [stop, hex] of gradient) g.addColorStop(stop, hex);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  // anisotropy يمنع ضياع حدّة النص عند تصغيره أو ميلانه في العمق.
  // three.js يقصّها تلقائيًا إلى أقصى قيمة يدعمها الجهاز.
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const result = { texture, aspect: w / h };
  cache.set(key, result);
  return result;
}

/** ننتظر تحميل الخط قبل رسم أي نص، وإلا سيُرسم بخط بديل ثم لا يتحدث */
export async function waitForFonts(timeoutMs = 1500) {
  if (!document.fonts) return;
  // سباق: إمّا يجهز الخط، أو تنتهي المهلة ونكمل بالخط البديل.
  // بدون هذا السباق قد يتجمّد الموقع كليًا عند انقطاع الإنترنت.
  const ready = (async () => {
    try {
      await document.fonts.load('700 72px "Noto Kufi Arabic"');
      await document.fonts.load('400 48px "IBM Plex Sans Arabic"');
      await document.fonts.load('800 72px "Orbitron"');
      await document.fonts.ready;
    } catch { /* نكمل بالخط البديل */ }
  })();
  await Promise.race([ready, new Promise((r) => setTimeout(r, timeoutMs))]);
}
