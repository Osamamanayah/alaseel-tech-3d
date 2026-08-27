/**
 * hud.js — عناصر التوجيه الدائمة فوق المشهد.
 *
 * في فضاء مستمر بلا صفحات، يفقد المستخدم إحساسه بالمكان بسهولة.
 * لذلك أربعة عناصر ثابتة تجيب دائمًا: أين أنا؟ وكيف أعود؟
 *   1) زر عودة واضح — يقول بالنص إلى أين سيعيدك.
 *   2) مسار (breadcrumb) يعرض موقعك في التسلسل.
 *   3) خريطة مصغّرة مجرّدة تُظهر المناطق وموقعك بينها.
 *   4) مؤشر عمق يبيّن كم توغّلت داخل الفضاء.
 */
import { KEYWORDS } from '../data/content.js';
import { sound } from '../core/sound.js';

export class Hud {
  constructor(root) {
    this.root = root;
    this.onBack = null;
    this.onJump = null;

    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud__top">
        <button class="hud__back" type="button" hidden>
          <span class="hud__back-arrow" aria-hidden="true">→</span>
          <span class="hud__back-label">العودة</span>
        </button>
        <nav class="hud__trail" aria-label="موقعك الحالي">
          <ol class="hud__trail-list"></ol>
        </nav>
        <button class="hud__sound" type="button" aria-pressed="true">
          <span class="hud__sound-icon" aria-hidden="true">🔊</span>
          <span class="sr-only">صوت النقرات</span>
        </button>
      </div>

      <div class="hud__map" aria-hidden="true">
        <canvas width="150" height="150"></canvas>
        <p class="hud__map-caption">الخريطة</p>
      </div>

      <div class="hud__depth" aria-hidden="true">
        <span class="hud__depth-label">العمق</span>
        <span class="hud__depth-track"><span class="hud__depth-fill"></span></span>
      </div>
    `;
    root.appendChild(this.el);

    this.backBtn = this.el.querySelector('.hud__back');
    this.backLabel = this.el.querySelector('.hud__back-label');
    this.trailList = this.el.querySelector('.hud__trail-list');
    this.canvas = this.el.querySelector('.hud__map canvas');
    this.ctx = this.canvas.getContext('2d');
    this.depthFill = this.el.querySelector('.hud__depth-fill');

    this.backBtn.addEventListener('click', () => this.onBack?.());

    // زر كتم النقرات — الاختيار يُحفظ في المتصفح
    this.soundBtn = this.el.querySelector('.hud__sound');
    this.soundIcon = this.el.querySelector('.hud__sound-icon');
    this.soundBtn.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      this.refreshSound();
      if (sound.enabled) sound.tap();     // معاينة فورية عند التفعيل
    });
    this.refreshSound();

    this._mapAccum = 0;
    this._depthNow = 0;
    this._state = null;
  }

  /** يعكس حالة الصوت على الزر */
  refreshSound() {
    const on = sound.enabled;
    this.soundIcon.textContent = on ? '🔊' : '🔇';
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.soundBtn.setAttribute('title', on ? 'إيقاف صوت النقرات' : 'تشغيل صوت النقرات');
    this.soundBtn.classList.toggle('is-off', !on);
  }

  /* ------------------------- تحديث الحالة ------------------------- */

  /**
   * @param {{state:string, keyword:object|null, project:object|null}} info
   */
  setLocation({ state, keyword, project }) {
    this._state = state;
    this._keyword = keyword;


    // النص المرئي كلمة واحدة فقط. الوصف التفصيلي يبقى لقارئ الشاشة
    // عبر aria-label، فلا يزدحم الزر بصريًا ولا يخسر مستخدمو
    // قارئات الشاشة معرفة وجهتهم.
    if (state === 'project') {
      this.backBtn.hidden = false;
      this.backLabel.textContent = 'العودة';
      this.backBtn.setAttribute('aria-label', `العودة إلى ${keyword?.label ?? 'المستوى السابق'}`);
    } else if (state === 'constellation') {
      this.backBtn.hidden = false;
      this.backLabel.textContent = 'العودة';
      this.backBtn.setAttribute('aria-label', 'العودة إلى المستوى السابق');
    } else {
      this.backBtn.hidden = true;
    }

    // المسار
    const crumbs = [{ label: 'الفضاء', active: !keyword }];
    if (keyword) crumbs.push({ label: keyword.label, active: !project, accent: keyword.accent });
    if (project) crumbs.push({ label: project.name, active: true, accent: keyword?.accent });

    this.trailList.innerHTML = crumbs
      .map((c, i) => `
        <li class="hud__crumb${c.active ? ' is-active' : ''}"${c.accent ? ` style="--crumb-accent:${safeColor(c.accent)}"` : ''}>
          ${i > 0 ? '<span class="hud__crumb-sep" aria-hidden="true">‹</span>' : ''}
          <span>${escapeHtml(c.label)}</span>
        </li>`)
      .join('');

    this.el.classList.toggle('is-deep', state !== 'grid' && state !== 'seed');
    this.el.classList.toggle('is-hidden', state === 'seed');
  }

  /* --------------------------- كل إطار --------------------------- */

  /**
   * @param {number} dt
   * @param {THREE.Vector3} cameraPos
   * @param {string|null} activeKeywordId
   */
  update(dt, cameraPos, activeKeywordId) {
    // العمق: كم ابتعدت الكاميرا عن نقطة البداية داخل الفضاء
    const depth = Math.min(1, cameraPos.length() / 70);
    this._depthNow += (depth - this._depthNow) * (1 - Math.pow(0.01, dt));
    this.depthFill.style.transform = `scaleY(${0.06 + this._depthNow * 0.94})`;

    // الخريطة لا تحتاج 60 إطارًا في الثانية — نرسمها 15 مرة فقط
    this._mapAccum += dt;
    if (this._mapAccum < 1 / 15) return;
    this._mapAccum = 0;
    this._drawMap(cameraPos, activeKeywordId);
  }

  _drawMap(cameraPos, activeKeywordId) {
    const ctx = this.ctx;
    const S = this.canvas.width;
    const R = S / 2;
    ctx.clearRect(0, 0, S, S);

    // مقياس يحوّل إحداثيات الفضاء إلى إحداثيات الخريطة
    const SPAN = 34;
    const toMap = (x, y) => [R + (x / SPAN) * (R - 16), R - (y / SPAN) * (R - 16)];

    // حلقة خارجية
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(R, R, R - 6, 0, Math.PI * 2);
    ctx.stroke();

    // خطوط بين المناطق
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.10)';
    ctx.beginPath();
    for (let i = 0; i < KEYWORDS.length; i++) {
      const a = toMap(KEYWORDS[i].position[0], KEYWORDS[i].position[1]);
      const b = toMap(
        KEYWORDS[(i + 1) % KEYWORDS.length].position[0],
        KEYWORDS[(i + 1) % KEYWORDS.length].position[1]
      );
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    // المناطق
    for (const k of KEYWORDS) {
      const [x, y] = toMap(k.position[0], k.position[1]);
      const active = k.id === activeKeywordId;
      ctx.fillStyle = active ? k.accent : 'rgba(159, 216, 255, 0.42)';
      ctx.beginPath();
      ctx.arc(x, y, active ? 4.5 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = k.accent;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // موقع الكاميرا
    const [cx, cy] = toMap(cameraPos.x, cameraPos.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** يقبل ألوان hex فقط — يمنع حقن CSS عبر حقل accent */
function safeColor(value) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value)) ? String(value) : '#22d3ee';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
