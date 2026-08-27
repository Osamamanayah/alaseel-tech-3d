/**
 * artwork.js — يرسم صور القسم بالكود عندما لا تتوفر صورة حقيقية.
 *
 * لماذا بالكود؟
 *  - صفر طلبات شبكة وصفر ملفات ثقيلة → تفتح فورًا.
 *  - تتبع لون كل قسم تلقائيًا فتبقى الهوية موحّدة.
 *  - ثابتة: نفس القسم يعطي نفس الصور دائمًا (عشوائية ببذرة).
 *
 * لاستبدالها بصور حقيقية: ضع الملفات في public/images/sections/
 * وأضف مساراتها في حقل images داخل content.js — تحلّ محلها فورًا.
 */
import { makeRandom } from '../core/random.js';

const cache = new Map();

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/*  خمسة تكوينات مختلفة — حتى لا تبدو صور القسم الواحد متطابقة        */
/* ------------------------------------------------------------------ */

/** 0 — شبكة عقد متصلة: صدى لشكل الموقع نفسه */
function drawNetwork(ctx, W, H, rand, accent) {
  const nodes = [];
  const count = 8 + Math.floor(rand() * 5);
  for (let i = 0; i < count; i++) {
    nodes.push({ x: 60 + rand() * (W - 120), y: 50 + rand() * (H - 100) });
  }
  ctx.strokeStyle = hexToRgba(accent, 0.4);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < nodes.length; i++) {
    const near = nodes
      .map((n, j) => ({ n, j, d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const o of near) {
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(o.n.x, o.n.y);
      ctx.stroke();
    }
  }
  for (const n of nodes) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 17);
    g.addColorStop(0, hexToRgba('#ffffff', 0.95));
    g.addColorStop(0.35, hexToRgba(accent, 0.55));
    g.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 17, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 1 — طبقات أفقية: توحي بالبنية والطبقات */
function drawLayers(ctx, W, H, rand, accent) {
  const rows = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < rows; i++) {
    const y = (H / rows) * i + 18 + rand() * 12;
    const w = W * (0.35 + rand() * 0.55);
    const x = (W - w) / 2 + (rand() - 0.5) * 60;
    const h = 14 + rand() * 22;
    ctx.fillStyle = hexToRgba(accent, 0.10 + rand() * 0.20);
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.10);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** 2 — مدارات: حلقات متداخلة حول مركز */
function drawOrbits(ctx, W, H, rand, accent) {
  const cx = W / 2 + (rand() - 0.5) * 80;
  const cy = H / 2 + (rand() - 0.5) * 50;
  const rings = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < rings; i++) {
    const r = 46 + i * (34 + rand() * 18);
    ctx.strokeStyle = hexToRgba(accent, 0.34 - i * 0.04);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * (0.42 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
  g.addColorStop(0, hexToRgba('#ffffff', 0.85));
  g.addColorStop(0.3, hexToRgba(accent, 0.45));
  g.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();
}

/** 3 — تدفّق: خطوط منحنية متوازية */
function drawFlow(ctx, W, H, rand, accent) {
  const lines = 10 + Math.floor(rand() * 8);
  for (let i = 0; i < lines; i++) {
    const y = (H / lines) * i + rand() * 10;
    ctx.strokeStyle = hexToRgba(accent, 0.12 + rand() * 0.3);
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(
      W * 0.3, y + (rand() - 0.5) * 120,
      W * 0.7, y + (rand() - 0.5) * 120,
      W + 20, y + (rand() - 0.5) * 40
    );
    ctx.stroke();
  }
}

/** 4 — كتل: شبكة مربعات بأحجام متفاوتة */
function drawBlocks(ctx, W, H, rand, accent) {
  const cols = 6;
  const rows = 4;
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.42) continue;
      const pad = 8 + rand() * 16;
      ctx.fillStyle = hexToRgba(accent, 0.08 + rand() * 0.26);
      roundRect(ctx, c * cw + pad, r * ch + pad, cw - pad * 2, ch - pad * 2, 8);
      ctx.fill();
      if (rand() < 0.3) {
        ctx.strokeStyle = hexToRgba('#ffffff', 0.22);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}

const STYLES = [drawNetwork, drawLayers, drawOrbits, drawFlow, drawBlocks];

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */

/**
 * @param {string} id      بذرة ثابتة (معرّف القسم أو العنصر)
 * @param {string} accent  لون القسم
 * @param {number} variant رقم التكوين (0..4) — يعطي صورًا مختلفة لنفس القسم
 * @returns {string} data URL جاهز لـ <img src>
 */
export function makeArtwork(id, accent, variant = 0) {
  const key = `${id}|${accent}|${variant}`;
  if (cache.has(key)) return cache.get(key);

  const W = 720;
  const H = 480;
  const rand = makeRandom(hashString(`${id}#${variant}`));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1) خلفية متدرّجة عميقة
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#070c1e');
  bg.addColorStop(1, '#04060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2) هالات ضوئية ناعمة بلون القسم
  for (let i = 0; i < 3; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const r = 150 + rand() * 240;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hexToRgba(i === 0 ? accent : '#7b5cff', 0.3));
    g.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 3) شبكة أفقية دقيقة توحي بالعمق
  ctx.strokeStyle = hexToRgba('#9fd8ff', 0.06);
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // 4) التكوين المميّز لهذه الصورة
  STYLES[variant % STYLES.length](ctx, W, H, rand, accent);

  // 5) تعتيم الأطراف لتندمج مع الواجهة الداكنة
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(3,5,14,0.78)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const url = canvas.toDataURL('image/webp', 0.8);
  cache.set(key, url);
  return url;
}

/**
 * يبني قائمة صور قسم: الصور الحقيقية أولًا ثم صور مولّدة
 * حتى يبلغ العدد الأدنى المطلوب.
 */
export function sectionImages(section, minimum = 5) {
  const real = section.images ?? (section.image ? [section.image] : []);
  const out = real.map((src, i) => ({ src, real: true, index: i }));
  for (let v = 0; out.length < minimum; v++) {
    out.push({ src: makeArtwork(section.id, section.accent, v), real: false, index: out.length });
  }
  return out;
}
