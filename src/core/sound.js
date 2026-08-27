/**
 * sound.js — نقرات لوحة المفاتيح، مولّدة بالكود لا بملفات صوت.
 *
 * لماذا نولّدها بدل تنزيل ملفات؟
 *   • صفر ملفات وصفر طلبات شبكة — النقرة تعمل فورًا وبلا انتظار.
 *   • نتحكم في كل خاصية: الحدّة، الطول، ودرجة الصوت لكل قسم.
 *   • لا مشاكل حقوق نشر لملفات صوت مأخوذة من أجهزة تجارية.
 *
 * النقرة على طراز Sony Xperia: صوت نغمي دافئ مستدير أشبه بقطرة،
 * لا نقرة زر ميكانيكية جافة. أربع طبقات تُعزف معًا وتنتهي كلها
 * خلال أقل من عُشر ثانية:
 *   1) «القطرة»  نغمة نقية تهبط بسرعة من حاد إلى دافئ ← الطابع المميّز.
 *   2) «الدفء»   نغمة منخفضة تعطي جسمًا للّمسة.
 *   3) «اللمسة»  ضجيج خافت جدًا ومكتوم يوحي بملامسة الزجاج.
 *   4) «البريق»  نغمة علوية خافتة تمنع الصوت من أن يبدو باهتًا.
 *
 * يمكن استبدال الصوت كله بملف تضعه في public/sounds/ — انظر أدناه.
 */

import { assetUrl } from './assetUrl.js';

const STORAGE_KEY = 'osama3d:sound';

class Clicker {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.sampleBuffer = null;   // ملف صوت اختياري يضعه مالك الموقع
    this._enabled = this._readPreference();
    this._unlocked = false;
  }

  /* ------------------------- تفضيل المستخدم ------------------------- */

  _readPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'on';
    } catch {
      return true;   // بعض المتصفحات تمنع التخزين في وضع التصفح الخاص
    }
  }

  get enabled() { return this._enabled; }

  set enabled(value) {
    this._enabled = !!value;
    try { localStorage.setItem(STORAGE_KEY, this._enabled ? 'on' : 'off'); } catch { /* تجاهل */ }
    if (this._enabled) this.unlock();
  }

  /* --------------------------- التهيئة --------------------------- */

  /**
   * المتصفحات تمنع تشغيل أي صوت قبل أول تفاعل من المستخدم.
   * لذلك ننشئ محرّك الصوت عند أول ضغطة، لا عند تحميل الصفحة.
   */
  unlock() {
    if (this._unlocked) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;                 // متصفح قديم جدًا: نتجاهل الصوت بهدوء

    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this._makeNoiseBuffer();
      this._unlocked = true;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;                     // لا نُسقط الموقع لأجل الصوت
    }
  }

  /** ضجيج أبيض قصير — الأساس الذي نبني منه «طقّة» الزر */
  _makeNoiseBuffer() {
    const seconds = 0.12;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /* ------------------ ملف صوت اختياري يضعه المالك ------------------ */

  /**
   * يبحث عن ملف نقرة في public/sounds/ ويستخدمه بدل الصوت المولّد.
   * لا يتعطّل شيء إن لم يوجد الملف — نعود للصوت المولّد بهدوء.
   *
   * ملاحظة: استخدم ملفًا تملك حقه. استخراج الأصوات من يوتيوب أو من
   * أجهزة تجارية يخالف شروطها وحقوق أصحابها.
   */
  async loadClickFile(
    sources = ['mp3', 'wav', 'ogg'].map((ext) => assetUrl(`sounds/click.${ext}`))
  ) {
    this.unlock();
    if (!this.ctx) return false;

    for (const url of sources) {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) continue;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 64) continue;          // ملف فارغ أو صفحة خطأ
        this.sampleBuffer = await this.ctx.decodeAudioData(bytes);
        return true;
      } catch {
        // صيغة غير مدعومة أو ملف غير موجود — نجرّب التالي
      }
    }
    return false;
  }

  /** يعزف الملف المحمّل، إن وُجد */
  _playSample(tone, gain) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.sampleBuffer;
    src.playbackRate.value = tone;      // درجة صوت مختلفة لكل قسم
    const g = ctx.createGain();
    g.gain.value = Math.min(1, gain);
    src.connect(g).connect(this.master);
    src.start(now);
  }

  /* ---------------------------- العزف ---------------------------- */

  /**
   * @param {object} options
   * @param {number} options.tone   معامل درجة الصوت (1 = الأساس)
   * @param {number} options.gain   شدة الصوت (1 = الأساس)
   * @param {number} options.body   وزن الطبقة المنخفضة
   */
  play({ tone = 1, gain = 1, body = 1 } = {}) {
    if (!this._enabled) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;

    // ملف المالك له الأولوية على الصوت المولّد
    if (this.sampleBuffer) { this._playSample(tone, gain); return; }

    const ctx = this.ctx;
    const now = ctx.currentTime;

    /* ---- 1) القطرة: النغمة الأساسية، تهبط بسرعة من حاد إلى دافئ ----
       هذه هي الطبقة التي تصنع طابع Xperia: نغمة نقية واضحة الدرجة
       لا ضجيج، وهبوط سريع في التردد يعطي إحساس «القطرة». */
    const drop = ctx.createOscillator();
    drop.type = 'triangle';
    drop.frequency.setValueAtTime(520 * tone, now);
    drop.frequency.exponentialRampToValueAtTime(310 * tone, now + 0.075);

    const dropGain = ctx.createGain();
    dropGain.gain.setValueAtTime(0.0001, now);
    // هجوم ناعم (3 مللي ثانية) لا فوري — الفرق بين «طقّة» و«لمسة»
    dropGain.gain.exponentialRampToValueAtTime(0.26 * gain, now + 0.006);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    drop.connect(dropGain).connect(this.master);
    drop.start(now);
    drop.stop(now + 0.20);

    /* ---- 2) الدفء: نغمة منخفضة تعطي جسمًا للّمسة ---- */
    const warm = ctx.createOscillator();
    warm.type = 'sine';
    warm.frequency.setValueAtTime(165 * tone, now);
    warm.frequency.exponentialRampToValueAtTime(92 * tone, now + 0.13);

    const warmGain = ctx.createGain();
    warmGain.gain.setValueAtTime(0.0001, now);
    warmGain.gain.exponentialRampToValueAtTime(0.20 * gain * body, now + 0.008);
    warmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    warm.connect(warmGain).connect(this.master);
    warm.start(now);
    warm.stop(now + 0.24);

    /* ---- 3) لمسة الإصبع: ضجيج خافت جدًا ومكتوم ----
       ضجيج قليل جدًا يوحي بملامسة الزجاج. لو زاد تحوّل الصوت
       إلى نقرة زر ميكانيكي، وهو ما لا نريده هنا. */
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'bandpass';
    lowpass.frequency.value = 980 * tone;
    lowpass.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.035 * gain, now + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    noise.connect(lowpass).connect(noiseGain).connect(this.master);
    noise.start(now);
    noise.stop(now + 0.07);

    /* ---- 4) بريق علوي خافت — يمنع الصوت من أن يبدو باهتًا ---- */
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(760 * tone, now + 0.012);
    shimmer.frequency.exponentialRampToValueAtTime(1180 * tone, now + 0.09);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.065 * gain, now + 0.018);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

    shimmer.connect(shimmerGain).connect(this.master);
    shimmer.start(now);
    shimmer.stop(now + 0.21);
  }

  /* ------------------ نقرات جاهزة لكل نوع تفاعل ------------------ */

  /** الضغط على قسم — لكل قسم درجة صوت مختلفة قليلًا كأزرار لوحة المفاتيح */
  section(index = 0) {
    // نطاق ضيق (0.88 إلى 1.18) حتى تبقى العائلة الصوتية واحدة
    const tone = 0.88 + ((index * 7) % 11) / 36;
    this.play({ tone, gain: 1, body: 1 });
  }

  /** الضغط على عنصر داخل القسم — أخفّ قليلًا */
  item(index = 0) {
    const tone = 1.06 + ((index * 5) % 7) / 40;
    this.play({ tone, gain: 0.82, body: 0.7 });
  }

  /** العودة للخلف — أخفض وأثقل */
  back() {
    this.play({ tone: 0.78, gain: 0.7, body: 1.15 });
  }

  /** لمسة خفيفة جدًا لبطاقات الرزنامة */
  tap() {
    this.play({ tone: 1.25, gain: 0.72, body: 0.45 });
  }

  /* ------------------- صوت تقليب الرزنامة ------------------- */

  /**
   * تقليب صفحات: نقرات ورقية متتابعة تتباعد تدريجيًا،
   * فتُسمع سريعة في البداية ثم تتباطأ — بنفس إيقاع حركة الصور.
   */
  riffle(count = 5) {
    if (!this._enabled) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      // نفس التوقيت الذي تستخدمه الصور، فيتطابق الصوت مع الصورة
      this._page(now + riffleDelay(i) / 1000, 1 - i * 0.05, 1 - i * 0.08);
    }
  }

  /** تقليب صفحة واحدة — يُستدعى عند قلب صورة في الرزنامة */
  flip() {
    if (!this._enabled) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    // صفحتان متتاليتان بفارق ضئيل: يعطي إحساس الورقة التي تُرفع ثم تستقر
    this._page(this.ctx.currentTime, 1.04, 1.15);
    this._page(this.ctx.currentTime + 0.055, 0.9, 0.6);
  }

  /** نقرة صفحة واحدة: ضجيج قصير مُرشَّح يشبه احتكاك الورق */
  _page(time, tone = 1, gain = 1) {
    const ctx = this.ctx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1900 * tone;
    band.Q.value = 0.9;

    // مرشّح ثانٍ يقطع الحدّة العالية فيصبح الصوت ورقيًا لا معدنيًا
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 4200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.16 * Math.max(gain, 0.25), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.026);

    noise.connect(band).connect(soften).connect(g).connect(this.master);
    noise.start(time);
    noise.stop(time + 0.06);
  }
}

/**
 * تأخير ظهور الصورة رقم i بالمللي ثانية.
 *
 * الفجوات تتسع كلما تقدّمنا (0, 38, 124, 248, 409...) فتبدو الحركة
 * سريعة في أولها ثم تتباطأ حتى تستقر. تستعملها الصور والصوت معًا
 * حتى لا ينفصل أحدهما عن الآخر.
 */
export function riffleDelay(index) {
  return Math.round(38 * Math.pow(index, 1.7));
}

export const sound = new Clicker();

/**
 * أول تفاعل من المستخدم يفتح محرّك الصوت.
 * نستخدم once حتى لا يبقى المستمع معلّقًا بلا فائدة.
 */
export function armSoundOnFirstGesture() {
  const arm = () => {
    sound.unlock();
    // نحاول تحميل ملف المالك مرة واحدة؛ الفشل يعني بقاء الصوت المولّد
    sound.loadClickFile().catch(() => {});
  };
  window.addEventListener('pointerdown', arm, { once: true, passive: true });
  window.addEventListener('keydown', arm, { once: true, passive: true });
  window.addEventListener('touchstart', arm, { once: true, passive: true });
}
