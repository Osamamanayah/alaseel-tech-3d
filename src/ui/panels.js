/**
 * panels.js — لوحة تفاصيل الفرع.
 *
 * اللوحة HTML عادي فوق المشهد، لا داخل WebGL. السبب:
 *   • النص العربي يبقى حادًا تمامًا في أي دقة شاشة.
 *   • يمكن تحديده ونسخه، والروابط تعمل فعليًا.
 *   • قارئات الشاشة ولوحة المفاتيح تتعامل معه بشكل طبيعي.
 *
 * التنظيم: لوحة واحدة مقسّمة داخليًا إلى عمودين — الرزنامة والنص.
 * كانت سابقًا ثلاث لوحات منفصلة تطفو حول النجم، فكانت تتراكب على
 * بعضها عند ضيق المساحة. عمود واحد منظّم يمنع التراكب تمامًا.
 *
 * الرزنامة: الصور مكدّسة فوق بعضها وتنقلب واحدة تلو الأخرى كرزنامة
 * مكتب، بفواصل زمنية تتسع تدريجيًا (سريع ثم بطيء) مع صوت تقليب.
 */
import { makeArtwork } from './artwork.js';
import { makeQrDataUrl } from './qrcode.js';
import { icon } from './icons.js';
import { BRAND } from '../data/content.js';
import { quality } from '../core/quality.js';
import { sound, riffleDelay } from '../core/sound.js';

export class Panels {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'panels';
    this.el.setAttribute('aria-hidden', 'true');
    root.appendChild(this.el);

    this.open = false;
    this.project = null;
    this.onClose = null;
    this._anchor = { x: 0, y: 0 };
    this._flip = null;       // حالة الرزنامة الحالية
    this._needsSnap = false; // أول إطار بعد الفتح يثبّت الموضع بلا انزلاق
  }

  /* ----------------------------- الفتح ----------------------------- */

  show(project, keyword) {
    this.project = project;
    this.open = true;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.style.setProperty('--accent', safeColor(keyword.accent));
    this.el.innerHTML = this._markup(project, keyword);
    this.el.classList.remove('is-leaving', 'is-dealt');
    this.el.classList.add('is-open');

    this.el.querySelector('[data-close]')?.addEventListener('click', () => this.onClose?.());

    // نقل التركيز إلى العنوان حتى يقرأه مستخدم لوحة المفاتيح فورًا
    const heading = this.el.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }

    this._needsSnap = true;
    this._startCalendar();
  }

  /* --------------------------- الرزنامة --------------------------- */

  _startCalendar() {
    const stack = this.el.querySelector('.flipcal');
    if (!stack) return;

    const pages = [...stack.querySelectorAll('.flipcal__page')];
    if (!pages.length) return;

    // نُجبر المتصفح على قياس التخطيط أولًا، وإلا ظهرت الصفحات
    // في وضعها النهائي بلا حركة على الإطلاق.
    void stack.offsetHeight;
    this.el.classList.add('is-dealt');

    if (!quality.reducedMotion) sound.riffle(pages.length);

    this._flip = { stack, pages, top: pages.length - 1 };

    // النقر يقلب الصفحة العليا إلى الخلف — كتقليب رزنامة مكتب
    stack.addEventListener('click', () => this._flipNext());
    stack.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._flipNext(); }
    });
  }

  /** يقلب الصفحة العليا فتنكشف التي تحتها */
  _flipNext() {
    const f = this._flip;
    if (!f || f.pages.length < 2) return;

    const page = f.pages[f.top];
    page.classList.add('is-flipped');
    // الصفحة المقلوبة تنزل إلى أسفل الكومة لتعود في الدورة التالية
    page.style.zIndex = String(Number(page.dataset.z) - f.pages.length);

    f.top = (f.top - 1 + f.pages.length) % f.pages.length;

    const next = f.pages[f.top];
    if (next.classList.contains('is-flipped')) {
      next.classList.remove('is-flipped');
      next.style.zIndex = next.dataset.z;
    }
    sound.flip();     // صوت تقليب صفحة الرزنامة
  }

  /* ---------------------------- الإغلاق ---------------------------- */

  /** يقيس موضع اللوحة على الشاشة قبل إخفائها — تحتاجه الجزيئات */
  captureRects() {
    return [...this.el.querySelectorAll('.panel')].map((card) => {
      const r = card.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  }

  hide({ instant = false } = {}) {
    this.open = false;
    this._flip = null;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.classList.remove('is-open', 'is-dealt');
    if (instant) {
      this.el.innerHTML = '';
      this.el.classList.remove('is-leaving');
      return;
    }
    this.el.classList.add('is-leaving');
    setTimeout(() => {
      if (!this.open) {
        this.el.innerHTML = '';
        this.el.classList.remove('is-leaving');
      }
    }, 320);
  }

  /* --------------------------- كل إطار --------------------------- */

  /**
   * يثبّت اللوحة قرب النجم، مع حصرها داخل الشاشة.
   * الحصر ضروري: بدونه تخرج اللوحة من الإطار عندما يكون النجم
   * قرب الحافة، فيرى المستخدم نصف لوحة مقطوعة.
   */
  follow(screen, pointerSmooth) {
    if (!this.open) return;

    const sheet = this.el.querySelector('.panel--sheet');
    const w = sheet ? sheet.offsetWidth : 640;
    const h = sheet ? sheet.offsetHeight : 420;
    const margin = 24;

    const half = { x: w / 2, y: h / 2 };
    const target = {
      x: clamp(screen.x, half.x + margin, window.innerWidth - half.x - margin),
      y: clamp(screen.y, half.y + margin, window.innerHeight - half.y - margin),
    };

    if (this._needsSnap) {
      // أول إطار: نضع اللوحة في موضعها النهائي مباشرة.
      // الانزلاق التدريجي وحده يترك اللوحة خارج الشاشة لحظات على
      // الأجهزة البطيئة، فيرى المستخدم لوحة مقطوعة عند الفتح.
      this._anchor.x = target.x;
      this._anchor.y = target.y;
      this._needsSnap = false;
    } else {
      this._anchor.x += (target.x - this._anchor.x) * 0.22;
      this._anchor.y += (target.y - this._anchor.y) * 0.22;
    }

    // parallax محدود جدًا: يوحي بالعمق دون أن يزعزع القراءة
    const px = quality.reducedMotion ? 0 : pointerSmooth.x * 5;
    const py = quality.reducedMotion ? 0 : pointerSmooth.y * 3;

    this.el.style.setProperty('--anchor-x', `${this._anchor.x + px}px`);
    this.el.style.setProperty('--anchor-y', `${this._anchor.y - py}px`);
  }

  snapTo(screen) {
    this._anchor.x = screen.x;
    this._anchor.y = screen.y;
    this._needsSnap = true;
  }

  /* ---------------------------- المحتوى ---------------------------- */

  _markup(p, keyword) {
    if (p.contact) return this._contactMarkup(p, keyword);
    if (p.review) return this._reviewMarkup(p, keyword);
    return this._serviceMarkup(p, keyword);
  }

  /** كومة صور تنقلب كرزنامة مكتب */
  _calendarMarkup(photos, label) {
    const pages = photos.map((src, i) => `
      <figure class="flipcal__page" data-z="${i + 1}" style="z-index:${i + 1};
              --delay:${quality.reducedMotion ? 0 : riffleDelay(i)}ms">
        <img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" />
        <span class="flipcal__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      </figure>`).join('');

    return `
      <div class="flipcal" role="button" tabindex="0"
           aria-label="رزنامة صور ${escapeHtml(label)} — اضغط لتقليب الصفحة">
        ${pages}
        <span class="flipcal__hint" aria-hidden="true">اضغط للتقليب</span>
      </div>`;
  }

  _serviceMarkup(p, keyword) {
    const photos = keyword.images?.length
      ? keyword.images
      : [0, 1, 2, 3, 4].map((v) => makeArtwork(keyword.id, keyword.accent, v));

    const includes = p.includes.map((x) => `<li>${isolateNumbers(x)}</li>`).join('');
    const ask = BRAND.whatsappWith(
      `السلام عليكم، أرغب بخدمة: ${keyword.title || keyword.label} — ${p.name}.`
    );

    return `
      <article class="panel panel--sheet" role="dialog"
               aria-label="${escapeHtml(p.name)}">
        <div class="sheet__media">
          ${this._calendarMarkup(photos, keyword.title || keyword.label)}
        </div>

        <div class="sheet__body">
          <p class="panel__eyebrow">${escapeHtml(keyword.title || keyword.label)}</p>
          <h2 class="panel__title">${escapeHtml(p.name)}</h2>
          <p class="panel__tagline">${isolateNumbers(p.tagline)}</p>
          <p class="panel__desc">${isolateNumbers(p.description)}</p>

          <h3 class="panel__subtitle">ما تشمله</h3>
          <ul class="results">${includes}</ul>

          <div class="panel__actions">
            <a class="btn btn--primary" href="${escapeAttr(safeUrl(ask))}"
               target="_blank" rel="noopener">اطلب هذه الخدمة</a>
            <button class="btn btn--ghost" type="button" data-close
                    aria-label="العودة إلى المستوى السابق">العودة</button>
          </div>
        </div>
      </article>`;
  }

  /**
   * لوحة شهادة عميل.
   * بلا صور عمدًا: اختلاق صور لأشخاص أو أماكن ونسبتها إلى عملاء
   * حقيقيين تضليل. الاقتباس والاسم والمدينة تكفي.
   */
  _reviewMarkup(p, keyword) {
    const r = p.review;
    const stars = '★'.repeat(Math.min(5, r.rating)) + '☆'.repeat(Math.max(0, 5 - r.rating));

    return `
      <article class="panel panel--sheet panel--review" role="dialog"
               aria-label="رأي عميل: ${escapeHtml(p.name)}">
        <div class="sheet__media">
          <figure class="review-card">
            <span class="review-card__mark" aria-hidden="true">”</span>
            <figcaption>
              <strong>${escapeHtml(r.author)}</strong>
              <span>${escapeHtml(r.org)} — ${escapeHtml(r.city)}</span>
              <span class="review-card__stars" aria-label="تقييم ${r.rating} من 5">${stars}</span>
            </figcaption>
          </figure>
        </div>

        <div class="sheet__body">
          <p class="panel__eyebrow">${escapeHtml(keyword.title || keyword.label)}</p>
          <h2 class="panel__title">${escapeHtml(p.name)}</h2>
          <blockquote class="review-quote">${isolateNumbers(r.quote)}</blockquote>
          <div class="panel__actions">
            <button class="btn btn--ghost" type="button" data-close
                    aria-label="العودة إلى المستوى السابق">العودة</button>
          </div>
        </div>
      </article>`;
  }

  _contactMarkup(p, keyword) {
    const c = p.contact;
    const isQr = c.type === 'qr';

    const media = isQr
      ? `<figure class="contact-qr">
           <img src="${makeQrDataUrl(c.value, 460)}"
                alt="رمز QR يحتوي بطاقة اتصال ${escapeHtml(BRAND.name)}"
                width="460" height="460" />
           <figcaption>${escapeHtml(c.action)}</figcaption>
         </figure>`
      : `<figure class="contact-glyph">
           <span class="panel__glyph">${icon(p.icon, p.name)}</span>
           <figcaption><bdi>${escapeHtml(c.value)}</bdi></figcaption>
         </figure>`;

    const action = isQr
      ? ''
      : `<a class="btn btn--primary" href="${escapeAttr(safeUrl(c.href))}"
             ${c.type === 'link' ? 'target="_blank" rel="noopener"' : ''}>
           ${escapeHtml(c.action)}
         </a>`;

    return `
      <article class="panel panel--sheet panel--contact" role="dialog"
               aria-label="${escapeHtml(p.name)}">
        <div class="sheet__media">${media}</div>

        <div class="sheet__body">
          <p class="panel__eyebrow">${escapeHtml(keyword.label)}</p>
          <h2 class="panel__title">${escapeHtml(p.name)}</h2>
          <p class="panel__tagline">${isolateNumbers(p.tagline)}</p>
          <p class="panel__desc">${isolateNumbers(p.description)}</p>
          <p class="panel__value"><bdi>${escapeHtml(
            c.value.startsWith('BEGIN:VCARD') ? BRAND.phonePretty : c.value
          )}</bdi></p>

          <div class="panel__actions">
            ${action}
            <button class="btn btn--ghost" type="button" data-close
                    aria-label="العودة إلى المستوى السابق">العودة</button>
          </div>
        </div>
      </article>`;
  }
}

/* --------------------------- أدوات مساعدة --------------------------- */

const clamp = (v, min, max) => (min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const escapeAttr = escapeHtml;

/** يقبل ألوان hex فقط — يمنع حقن CSS عبر حقل accent */
function safeColor(value) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value)) ? String(value) : '#22d3ee';
}

/**
 * يسمح فقط بأنواع الروابط الآمنة.
 *
 * لماذا؟ الروابط تأتي من content.js وهو ملف يُعدَّل يدويًا.
 * رابط مثل javascript:... يعمل ككود عند النقر. هذه الدالة تمنعه
 * حتى لو دخل الملف بالخطأ، فيتحوّل إلى رابط معطّل بدل ثغرة.
 */
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'sms:'];

function safeUrl(url) {
  const raw = String(url ?? '').trim();
  if (raw === '' || raw === '#') return '#';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    return SAFE_PROTOCOLS.includes(parsed.protocol) ? raw : '#';
  } catch {
    return '#';
  }
}

/**
 * يعزل الأرقام واللاتينية داخل النص العربي.
 * بدونه تنتقل علامة % إلى الجهة الخطأ فتظهر «%99.9» بدل «99.9%».
 * الرقم يبتلع علامة النسبة إن وُجدت، لكنه لا يبتلع المسافة التي تليه.
 */
const ISOLATE_RE = /\d[\d.,٫]*(?:\s?[%×+])?|[A-Za-z][A-Za-z0-9.+#-]*/g;

function isolateNumbers(str) {
  const text = String(str);
  let out = '';
  let last = 0;

  // نرمّز كل مقطع على حدة. لو رمّزنا النص كله أولًا ثم بحثنا فيه،
  // لكسرنا رموز HTML مثل &#39; لأنها تحتوي أرقامًا وحروفًا لاتينية.
  for (const match of text.matchAll(ISOLATE_RE)) {
    out += escapeHtml(text.slice(last, match.index));
    out += `<bdi>${escapeHtml(match[0])}</bdi>`;
    last = match.index + match[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}
