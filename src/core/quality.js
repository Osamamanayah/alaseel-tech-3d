/**
 * quality.js — يقرّر «مستوى الجودة» المناسب للجهاز.
 *
 * الفكرة: الأجهزة الضعيفة (هواتف قديمة) لا تتحمل آلاف الجزيئات.
 * نقيس مؤشرات الجهاز مرة عند البدء، ثم نراقب معدل الإطارات (FPS)
 * أثناء التشغيل ونخفّض الكثافة تلقائيًا إذا تباطأ.
 */

const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

function detectTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;            // بالجيجابايت (تقريبي)
  const coarse = window.matchMedia('(pointer: coarse)').matches; // لمس
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 640;

  let score = 0;
  if (cores >= 8) score += 2; else if (cores >= 4) score += 1;
  if (mem >= 8) score += 2; else if (mem >= 4) score += 1;
  if (!coarse) score += 1;
  if (!smallScreen) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

const PRESETS = {
  //          particles = جزيئات التفكك | latticeNodes = عقد الشبكة | dpr = دقة الرسم
  //
  // dpr سقف دقة الرسم. شاشات الهواتف كثافتها 2.6 إلى 3، فالرسم بدقة
  // 1.6 يعني تكبير المشهد كله فيظهر النص ضبابيًا. رفعناها إلى 2 —
  // وهي دقة كافية بصريًا وأخف بكثير من 3. لو ثقُلت على جهاز ضعيف
  // فمراقب الأداء يخفضها تلقائيًا.
  high:   { particles: 9000, latticeNodes: 420, dpr: 2.0, bloom: true,  starCount: 2600 },
  medium: { particles: 4200, latticeNodes: 240, dpr: 2.0, bloom: true,  starCount: 1400 },
  low:    { particles: 1600, latticeNodes: 120, dpr: 1.5, bloom: false, starCount: 700  },
};

export const quality = {
  tier: detectTier(),
  reducedMotion: mqReduce.matches,
  get preset() { return PRESETS[this.tier]; },

  /** تخفيض درجة واحدة عند ضعف الأداء */
  downgrade() {
    if (this.tier === 'high') this.tier = 'medium';
    else if (this.tier === 'medium') this.tier = 'low';
    else return false;
    document.dispatchEvent(new CustomEvent('quality:change', { detail: this.tier }));
    return true;
  },
};

// المستخدم قد يغيّر تفضيل «تقليل الحركة» أثناء التصفح
mqReduce.addEventListener('change', (e) => {
  quality.reducedMotion = e.matches;
  document.dispatchEvent(new CustomEvent('motion:change', { detail: e.matches }));
});
