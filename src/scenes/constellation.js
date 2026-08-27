/**
 * constellation.js — كوكبة المشاريع داخل منطقة كلمة مفتاحية.
 *
 * كل مشروع = نجم مضيء يحمل اسمه. العلاقات بين المشاريع = خطوط
 * «تُرسم» تدريجيًا من نجم إلى نجم. العلاقات مع مشاريع خارج المنطقة
 * تظهر كخيوط تمتد نحو منطقتها في الشبكة — فيبقى الإحساس بأن
 * الفضاء واحد متصل، لا صفحات منفصلة.
 */
import * as THREE from 'three';
import { makeRandom } from '../core/random.js';
import { makeTextTexture } from '../core/textTexture.js';
import { quality } from '../core/quality.js';
import { projectsOf, projectById, keywordById } from '../data/content.js';

/* ----------------------------- Shaders ----------------------------- */

const lineVert = /* glsl */ `
  precision highp float;
  attribute float aAlong;     // 0 عند بداية الخط، 1 عند نهايته
  attribute float aSeed;
  attribute float aStrength;
  varying float vAlong;
  varying float vSeed;
  varying float vStrength;

  void main() {
    vAlong = aAlong;
    vSeed = aSeed;
    vStrength = aStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uDraw;      // 0..1 — كم رُسم من الخط
  uniform float uOpacity;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  varying float vAlong;
  varying float vSeed;
  varying float vStrength;

  void main() {
    // الخط يُرسم من بدايته نحو نهايته بدل الظهور دفعة واحدة
    if (vAlong > uDraw) discard;
    float tip = smoothstep(uDraw, uDraw - 0.12, vAlong);   // رأس الخط أسطع
    float flow = 0.5 + 0.5 * sin(uTime * 2.0 - vAlong * 12.0 + vSeed * 6.28);
    vec3 col = mix(uColorA, uColorB, vSeed);
    float a = (0.28 + flow * 0.34) * vStrength * uOpacity * (0.7 + tip * 0.6);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(col, a);
  }
`;

/* ------------------------- صور مساعدة ------------------------- */

function makeStarTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.10, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.22)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRingTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const starTexture = { value: null };
const ringTexture = { value: null };

/* ------------------------------------------------------------------ */

export class Constellation {
  /**
   * @param {object} keyword  الكلمة المفتاحية النشطة
   * @param {Map<string, THREE.Vector3>} keywordPositions مواقع كل الكلمات في الشبكة
   */
  constructor(keyword, keywordPositions) {
    if (!starTexture.value) starTexture.value = makeStarTexture();
    if (!ringTexture.value) ringTexture.value = makeRingTexture();

    this.keyword = keyword;
    this.group = new THREE.Group();
    this.stars = [];
    this.hoveredId = null;
    this.focusedIndex = -1;
    this._opacity = 0;
    this._draw = 0;

    const rand = makeRandom(hashString(keyword.id));
    const origin = new THREE.Vector3(...keyword.position);
    const projects = projectsOf(keyword.id);

    /* ----------------------- النجوم (المشاريع) ----------------------- */

    const RADIUS = 15;
    // قسم التواصل يُعرض ككواكب: حلقة ظاهرة دائمًا ووهج أوسع
    const isContact = keyword.kind === 'contact';

    projects.forEach((project, i) => {
      // توزيع على شكل حلقة مائلة حول العقدة، بعمق مختلف لكل نجم
      const angle = (i / projects.length) * Math.PI * 2 + rand() * 0.5 - 0.25;
      const tilt = (rand() - 0.5) * 0.7;
      const r = RADIUS * (0.82 + rand() * 0.36);

      const local = new THREE.Vector3(
        Math.cos(angle) * r,
        Math.sin(angle) * r * 0.72 + tilt * 4,
        (rand() - 0.5) * 16
      );
      const home = origin.clone().add(local);

      const holder = new THREE.Group();
      holder.position.copy(home);

      // وهج النجم
      const starMat = new THREE.SpriteMaterial({
        map: starTexture.value,
        color: new THREE.Color(keyword.accent),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const star = new THREE.Sprite(starMat);
      star.scale.setScalar(isContact ? 6.4 : 5.4);
      holder.add(star);

      // حلقة رفيعة تظهر عند التمرير — إشارة «هذا قابل للاختيار»
      const ringMat = new THREE.SpriteMaterial({
        map: ringTexture.value,
        color: new THREE.Color('#e9edff'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const ring = new THREE.Sprite(ringMat);
      ring.scale.setScalar(isContact ? 9.5 : 9);
      holder.add(ring);

      // اسم المشروع
      const { texture, aspect } = makeTextTexture(project.name, {
        fontSize: 50,
        weight: 700,
        color: '#f4f7ff',
        glow: keyword.accent,
        glowBlur: 12,
      });
      const labelMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const label = new THREE.Sprite(labelMat);
      const w = 10.2;
      label.scale.set(w, w / aspect, 1);
      label.position.y = -4.9;
      holder.add(label);

      this.group.add(holder);
      this.stars.push({
        isContact,
        id: project.id,
        project,
        holder,
        star, starMat,
        ring, ringMat,
        label, labelMat,
        home,
        labelAspect: aspect,
        labelWidth: w,
        hover: 0,
        seed: rand(),
        screen: { x: 0, y: 0, visible: false },
      });
    });

    /* --------------------- خطوط العلاقات --------------------- */

    const segments = [];
    const seen = new Set();
    const starById = new Map(this.stars.map((s) => [s.id, s]));

    for (const s of this.stars) {
      for (const relId of s.project.related) {
        const key = [s.id, relId].sort().join('_');
        if (seen.has(key)) continue;
        seen.add(key);

        const partner = starById.get(relId);
        if (partner) {
          // علاقة داخل نفس المنطقة: خط واضح بين نجمين
          segments.push([s.home, partner.home, 1.0]);
        } else {
          // علاقة مع منطقة أخرى: خيط يمتد نحوها ويتلاشى
          const other = projectById(relId);
          const otherKeyword = other && keywordById(other.keyword);
          const dest = otherKeyword && keywordPositions.get(otherKeyword.id);
          if (!dest) continue;
          const direction = dest.clone().sub(s.home).normalize();
          const tip = s.home.clone().add(direction.multiplyScalar(13));
          segments.push([s.home, tip, 0.22]);
        }
      }
      // خيط رفيع يربط كل نجم بمركز منطقته
      segments.push([origin, s.home, 0.5]);
    }

    const pos = new Float32Array(segments.length * 6);
    const along = new Float32Array(segments.length * 2);
    const seeds = new Float32Array(segments.length * 2);
    const strengths = new Float32Array(segments.length * 2);

    segments.forEach(([a, b, strength], i) => {
      pos[i * 6] = a.x; pos[i * 6 + 1] = a.y; pos[i * 6 + 2] = a.z;
      pos[i * 6 + 3] = b.x; pos[i * 6 + 4] = b.y; pos[i * 6 + 5] = b.z;
      along[i * 2] = 0; along[i * 2 + 1] = 1;
      const sd = rand();
      seeds[i * 2] = sd; seeds[i * 2 + 1] = sd;
      strengths[i * 2] = strength; strengths[i * 2 + 1] = strength;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aStrength', new THREE.BufferAttribute(strengths, 1));

    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: {
        uTime: { value: 0 },
        uDraw: { value: 0 },
        uOpacity: { value: 0 },
        uColorA: { value: new THREE.Color(keyword.accent) },
        uColorB: { value: new THREE.Color('#9fd8ff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.lines = new THREE.LineSegments(geo, this.lineMat);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    this.origin = origin;
  }

  /* ---------------------------- التشغيل ---------------------------- */

  update(dt, elapsed, { pointerPixel, project, interactive }) {
    this.lineMat.uniforms.uTime.value = elapsed;

    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.14;
    let nearest = null;
    let nearestDist = Infinity;

    for (const s of this.stars) {
      const scr = project(s.home);
      s.screen = scr;
      if (!interactive || !scr.visible || !pointerPixel) continue;
      const dist = Math.hypot(pointerPixel.x - scr.x, pointerPixel.y - scr.y);
      if (dist < radius && dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }
    this.hoveredId = nearest ? nearest.id : null;

    const k = 1 - Math.pow(0.0005, dt);
    for (const s of this.stars) {
      const focused = this.focusedIndex >= 0 && this.stars[this.focusedIndex] === s;
      const active = s === nearest || focused;
      s.hover += ((active ? 1 : 0) - s.hover) * k;

      // طفو خفيف يمنع الإحساس بالجمود
      const float = quality.reducedMotion ? 0 : Math.sin(elapsed * 0.8 + s.seed * 6.28) * 0.7;
      s.holder.position.set(s.home.x, s.home.y + float, s.home.z);

      const o = this._opacity;
      s.starMat.opacity = o * (0.75 + s.hover * 0.25);
      s.labelMat.opacity = o * (0.8 + s.hover * 0.2);
      // نجوم المشاريع: الحلقة تظهر عند التمرير فقط.
      // كواكب التواصل: الحلقة جزء من شكلها، فتبقى ظاهرة دائمًا.
      s.ringMat.opacity = s.isContact
        ? o * (0.34 + s.hover * 0.46)
        : o * s.hover * 0.7;

      const starBase = s.isContact ? 6.4 : 5.4;
      s.star.scale.setScalar(starBase + s.hover * 2.8 + Math.sin(elapsed * 1.6 + s.seed * 9) * 0.3);
      const ringBase = s.isContact ? 10.5 : 10;
      s.ring.scale.setScalar(ringBase + s.hover * 4 + Math.sin(elapsed * 1.2 + s.seed * 5) * 0.4);

      const w = s.labelWidth * (1 + s.hover * 0.12);
      s.label.scale.set(w, w / s.labelAspect, 1);
    }
  }

  /* -------------------------- خصائص متحركة -------------------------- */

  set opacity(v) {
    this._opacity = v;
    this.lineMat.uniforms.uOpacity.value = v * 0.85;
  }
  get opacity() { return this._opacity; }

  /** 0 = لم يُرسم أي خط، 1 = كل الخطوط مكتملة */
  set draw(v) {
    this._draw = v;
    this.lineMat.uniforms.uDraw.value = v;
  }
  get draw() { return this._draw; }

/**
   * يحدّد أقرب نجم مشروع إلى نقطة على الشاشة، فورًا وبلا انتظار إطار جديد.
   *
   * لماذا نحتاجها؟ الاختيار بالفأرة يعتمد على التمرير (hover) الذي
   * يُحسب في حلقة الرسم. لكن في اللمس لا يوجد تمرير: الإصبع ينزل
   * ويرتفع قبل أن يمرّ إطار، فلا يُختار شيء. هذه الدالة تحسب مباشرة.
   */
  pickAt(x, y) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // نوسّع دائرة الالتقاط في اللمس: الإصبع أقل دقة من مؤشر الفأرة
    const radius = Math.min(window.innerWidth, window.innerHeight) * (coarse ? 0.21000000000000002 : 0.14);
    let best = null;
    let bestDist = Infinity;
    for (const item of this.stars) {
      if (!item.screen.visible) continue;
      const dist = Math.hypot(x - item.screen.x, y - item.screen.y);
      if (dist < radius && dist < bestDist) { bestDist = dist; best = item; }
    }
    return best ? best.id : null;
  }

  starById(id) { return this.stars.find((s) => s.id === id); }

  dispose() {
    this.lines.geometry.dispose();
    this.lineMat.dispose();
    for (const s of this.stars) {
      s.starMat.dispose();
      s.ringMat.dispose();
      s.labelMat.dispose();
    }
    this.group.removeFromParent();
  }
}

/* ------------------------------------------------------------------ */

/** يحوّل نصًا إلى رقم ثابت — لنعطي كل منطقة توزيعًا مختلفًا لكنه ثابت */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
