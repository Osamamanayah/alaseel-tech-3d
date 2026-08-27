/**
 * lattice.js — الشبكة المكانية: العقد والخطوط والكلمات المفتاحية.
 *
 * ثلاثة أجزاء:
 *  1) سحابة عقد صغيرة (Points واحدة = رسمة واحدة على كرت الشاشة).
 *  2) شبكة خطوط تصل كل عقدة بأقرب جيرانها (LineSegments واحدة).
 *  3) الكلمات المفتاحية الست كعقد رئيسية مضيئة تحمل نصًا عربيًا.
 *
 * كل شيء يظهر عبر uniform اسمه uGrow: يمتد من المركز إلى الأطراف.
 */
import * as THREE from 'three';
import { makeRandom } from '../core/random.js';
import { makeTextTexture } from '../core/textTexture.js';
import { quality } from '../core/quality.js';
import { KEYWORDS } from '../data/content.js';

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

const nodeVert = /* glsl */ `
  precision highp float;
  attribute float aSize;
  attribute float aSeed;
  attribute float aDist;      // المسافة من المركز، مُطبَّعة إلى 0..1
  uniform float uTime;
  uniform float uGrow;
  uniform float uPixelRatio;
  uniform vec2  uStretch;
  uniform float uDrift;
  varying float vSeed;
  varying float vReveal;

  void main() {
    vSeed = aSeed;
    // الظهور يمتد من المركز نحو الأطراف
    vReveal = 1.0 - smoothstep(uGrow - 0.28, uGrow + 0.02, aDist);

    vec3 pos = position;
    pos.x += sin(uTime * 0.28 + aSeed * 31.4) * uDrift;
    pos.y += cos(uTime * 0.23 + aSeed * 17.3) * uDrift;
    pos.z += sin(uTime * 0.19 + aSeed * 44.1) * uDrift * 0.6;
    pos.xy += uStretch * (0.3 + aSeed * 0.7);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (180.0 / max(-mv.z, 1.0)) * (0.4 + vReveal * 0.6);
  }
`;

const nodeFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  varying float vSeed;
  varying float vReveal;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, d);
    alpha *= 0.5 + 0.5 * sin(uTime * 1.1 + vSeed * 25.0);
    vec3 col = mix(uColorA, uColorB, vSeed);
    float a = alpha * uOpacity * vReveal;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(col, a);
  }
`;

const lineVert = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  attribute float aDist;
  attribute float aStrength;   // 1.0 لخطوط الكلمات، أقل لخطوط الخلفية
  attribute float aAlong;      // 0..1 على طول الخط، لتحريك النبض
  uniform float uTime;
  uniform float uGrow;
  uniform vec2  uStretch;
  uniform float uDrift;
  varying float vSeed;
  varying float vReveal;
  varying float vStrength;
  varying float vAlong;

  void main() {
    vSeed = aSeed;
    vStrength = aStrength;
    vAlong = aAlong;
    vReveal = 1.0 - smoothstep(uGrow - 0.30, uGrow, aDist);

    vec3 pos = position;
    pos.x += sin(uTime * 0.28 + aSeed * 31.4) * uDrift;
    pos.y += cos(uTime * 0.23 + aSeed * 17.3) * uDrift;
    pos.xy += uStretch * (0.3 + aSeed * 0.7);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const lineFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  varying float vSeed;
  varying float vReveal;
  varying float vStrength;
  varying float vAlong;

  void main() {
    // نبضة ضوء تسري على طول الخط
    float flow = 0.55 + 0.45 * sin(uTime * 1.6 - vAlong * 9.0 + vSeed * 6.28);
    vec3 col = mix(uColorA, uColorB, vSeed);
    float a = vReveal * vStrength * flow * uOpacity;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(col, a);
  }
`;

/* ------------------------------------------------------------------ */
/*  صورة الهالة حول كل كلمة مفتاحية                                    */
/* ------------------------------------------------------------------ */

function makeHaloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */

export class Lattice {
  constructor() {
    this.group = new THREE.Group();
    this.rand = makeRandom(20260827);
    this.nodes = [];              // الكلمات المفتاحية فقط
    this.hoveredId = null;
    this.focusedIndex = -1;       // للتنقل بلوحة المفاتيح
    this.focusId = null;          // عند دخول قسم: نُخفي أسماء بقية الأقسام
    this._grow = 0;
    this._screen = new THREE.Vector3();

    this._buildCloud();
    this._buildKeywords();
  }

  /* --------------------- سحابة العقد والخطوط --------------------- */

  _buildCloud() {
    const rand = this.rand;
    const count = quality.preset.latticeNodes;
    const RX = 40, RY = 27, RZ = 26;

    /** @type {THREE.Vector3[]} */
    const pts = [];
    for (let i = 0; i < count; i++) {
      // توزيع داخل قطع ناقص مفلطح — يملأ الإطار أفقيًا أكثر منه رأسيًا
      let x, y, z, r;
      do {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
        r = x * x + y * y + z * z;
      } while (r > 1);
      // نبعد العقد قليلًا عن المركز حتى لا تزدحم خلف المربع الأول
      const push = 0.35 + Math.cbrt(rand()) * 0.65;
      pts.push(new THREE.Vector3(x * RX * push, y * RY * push, z * RZ * push));
    }

    // نضيف الكلمات المفتاحية كعقد داخل نفس السحابة
    const keywordStart = pts.length;
    for (const k of KEYWORDS) pts.push(new THREE.Vector3(...k.position));

    const maxDist = Math.max(...pts.map((p) => p.length())) || 1;

    /* ---- العقد ---- */
    const positions = new Float32Array(pts.length * 3);
    const sizes = new Float32Array(pts.length);
    const seeds = new Float32Array(pts.length);
    const dists = new Float32Array(pts.length);

    pts.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const isKeyword = i >= keywordStart;
      sizes[i] = isKeyword ? 5.5 : 0.7 + rand() * 1.6;
      seeds[i] = rand();
      dists[i] = p.length() / maxDist;
    });

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    nodeGeo.setAttribute('aDist', new THREE.BufferAttribute(dists, 1));

    this.nodeMat = new THREE.ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uOpacity: { value: 1 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uStretch: { value: new THREE.Vector2() },
        uDrift: { value: 0.9 },
        uColorA: { value: new THREE.Color('#22d3ee') },
        uColorB: { value: new THREE.Color('#7b5cff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(nodeGeo, this.nodeMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    /* ---- الخطوط ---- */
    const seen = new Set();
    /** @type {Array<[number, number, number]>} [a, b, strength] */
    const edges = [];
    const addEdge = (a, b, strength) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push([a, b, strength]);
    };

    // كل عقدة تتصل بأقرب جارين لها
    const neighbours = (i, howMany, from = 0, to = pts.length) => {
      const list = [];
      for (let j = from; j < to; j++) {
        if (j === i) continue;
        list.push([j, pts[i].distanceToSquared(pts[j])]);
      }
      list.sort((m, n) => m[1] - n[1]);
      return list.slice(0, howMany).map((e) => e[0]);
    };

    for (let i = 0; i < keywordStart; i++) {
      for (const j of neighbours(i, 2, 0, keywordStart)) addEdge(i, j, 0.30);
    }
    // كل كلمة مفتاحية ترتبط بالعقد المحيطة بها (تبدو كأنها مركز جاذبية)
    for (let i = keywordStart; i < pts.length; i++) {
      for (const j of neighbours(i, 7, 0, keywordStart)) addEdge(i, j, 0.55);
    }
    // والكلمات تتصل ببعضها بخطوط أدق وأوضح
    for (let i = keywordStart; i < pts.length; i++) {
      for (const j of neighbours(i, 3, keywordStart, pts.length)) addEdge(i, j, 0.85);
    }

    const lp = new Float32Array(edges.length * 6);
    const ls = new Float32Array(edges.length * 2);
    const ld = new Float32Array(edges.length * 2);
    const lst = new Float32Array(edges.length * 2);
    const la = new Float32Array(edges.length * 2);

    edges.forEach(([a, b, strength], e) => {
      const pa = pts[a];
      const pb = pts[b];
      lp[e * 6] = pa.x; lp[e * 6 + 1] = pa.y; lp[e * 6 + 2] = pa.z;
      lp[e * 6 + 3] = pb.x; lp[e * 6 + 4] = pb.y; lp[e * 6 + 5] = pb.z;
      const s = rand();
      ls[e * 2] = s; ls[e * 2 + 1] = s;
      // نستخدم أبعد طرفي الخط حتى لا يظهر نصف خط أثناء النمو
      const d = Math.max(pa.length(), pb.length()) / maxDist;
      ld[e * 2] = d; ld[e * 2 + 1] = d;
      lst[e * 2] = strength; lst[e * 2 + 1] = strength;
      la[e * 2] = 0; la[e * 2 + 1] = 1;
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lineGeo.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
    lineGeo.setAttribute('aDist', new THREE.BufferAttribute(ld, 1));
    lineGeo.setAttribute('aStrength', new THREE.BufferAttribute(lst, 1));
    lineGeo.setAttribute('aAlong', new THREE.BufferAttribute(la, 1));

    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uOpacity: { value: 0.42 },
        uStretch: { value: new THREE.Vector2() },
        uDrift: { value: 0.9 },
        uColorA: { value: new THREE.Color('#22d3ee') },
        uColorB: { value: new THREE.Color('#7b5cff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.lines = new THREE.LineSegments(lineGeo, this.lineMat);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    this.edgeCount = edges.length;
    this.maxDist = maxDist;
  }

  /* ------------------ الكلمات المفتاحية (نص + هالة) ------------------ */

  _buildKeywords() {
    const haloTex = makeHaloTexture();

    for (const k of KEYWORDS) {
      const holder = new THREE.Group();
      holder.position.set(...k.position);

      // الهالة: Sprite دائمًا مواجه للكاميرا
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        color: new THREE.Color(k.accent),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(9);
      holder.add(halo);

      // النص: Sprite أيضًا — يبقى مواجهًا للكاميرا فلا يميل ولا تصعب قراءته
      const { texture, aspect } = makeTextTexture(k.label, {
        fontSize: 58,
        weight: 700,
        color: '#f2f6ff',
        glow: k.accent,
        glowBlur: 14,
      });
      const labelMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const label = new THREE.Sprite(labelMat);
      const width = 13.4;
      label.scale.set(width, width / aspect, 1);
      label.position.y = -4.1;
      holder.add(label);

      this.group.add(holder);
      this.nodes.push({
        id: k.id,
        data: k,
        holder,
        halo,
        haloMat,
        label,
        labelMat,
        home: new THREE.Vector3(...k.position),
        offset: new THREE.Vector3(),
        hover: 0,
        dim: 0,   // 1 = مخفي تمامًا لأن قسمًا آخر مفتوح
        screen: { x: 0, y: 0, visible: false },
      });
    }
  }

  /* ---------------------------- التشغيل ---------------------------- */

  /** يُنادى كل إطار. pointerPixel = موقع المؤشر بالبكسل، project = دالة الإسقاط */
  update(dt, elapsed, { stretch, pointerPixel, project, interactive }) {
    this.nodeMat.uniforms.uTime.value = elapsed;
    this.lineMat.uniforms.uTime.value = elapsed;

    const smoothing = 1 - Math.pow(0.002, dt);
    if (stretch) {
      this.nodeMat.uniforms.uStretch.value.lerp(stretch, smoothing);
      this.lineMat.uniforms.uStretch.value.lerp(stretch, smoothing);
    }

    // --- تأثير مغناطيسي: العقدة القريبة من المؤشر تكبر وتنجذب نحوه ---
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.16;
    let nearest = null;
    let nearestDist = Infinity;

    for (const n of this.nodes) {
      const s = project(n.home);
      n.screen = s;
      if (!interactive || !s.visible || !pointerPixel) continue;
      const dx = pointerPixel.x - s.x;
      const dy = pointerPixel.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius && dist < nearestDist) {
        nearestDist = dist;
        nearest = n;
      }
    }

    this.hoveredId = nearest ? nearest.id : null;

    const k = 1 - Math.pow(0.0005, dt);
    for (const n of this.nodes) {
      const isActive = n === nearest || (this.focusedIndex >= 0 && this.nodes[this.focusedIndex] === n);
      n.hover += ((isActive ? 1 : 0) - n.hover) * k;

      // الانجذاب نحو المؤشر (بمقدار صغير حتى لا يفقد المستخدم الاتجاه)
      if (isActive && pointerPixel && !quality.reducedMotion) {
        const pull = 1.6 * n.hover;
        n.offset.x += ((pointerPixel.x - n.screen.x) * 0.012 * pull - n.offset.x) * k;
        n.offset.y += ((-(pointerPixel.y - n.screen.y)) * 0.012 * pull - n.offset.y) * k;
      } else {
        n.offset.multiplyScalar(1 - k);
      }

      const breathe = Math.sin(elapsed * 0.9 + n.home.x * 0.1) * 0.35;
      n.holder.position.set(
        n.home.x + n.offset.x,
        n.home.y + n.offset.y + breathe,
        n.home.z
      );

      // عند فتح قسم، تتلاشى أسماء بقية الأقسام تمامًا حتى لا تزاحم المحتوى
      // تلاشٍ سريع مستقل عن معدل الإطارات: يكتمل خلال ~100 مللي ثانية
      // حتى على جهاز بطيء، فلا يبقى اسم قسم آخر ظاهرًا خلف المحتوى.
      const wantDim = this.focusId && n.id !== this.focusId ? 1 : 0;
      const dimK = 1 - Math.pow(1e-8, dt);
      n.dim += (wantDim - n.dim) * dimK;
      const visible = 1 - n.dim;

      const reveal = this._revealAt(n.home.length() / this.maxDist);
      n.haloMat.opacity = reveal * (0.55 + n.hover * 0.45) * this.opacity * visible;
      n.labelMat.opacity = reveal * (0.84 + n.hover * 0.16) * this.opacity * visible;
      n.halo.scale.setScalar(9 + n.hover * 5 + Math.sin(elapsed * 1.4 + n.home.y) * 0.5);
      const labelScale = 1 + n.hover * 0.14;
      const w = 13.4 * labelScale;
      n.label.scale.set(w, w / (n.label.material.map.image.width / n.label.material.map.image.height), 1);
    }
  }

  _revealAt(normalizedDist) {
    return 1 - THREE.MathUtils.smoothstep(normalizedDist, this._grow - 0.28, this._grow + 0.02);
  }

  /* ------------------------ خصائص متحركة ------------------------ */

  /** 0 = مخفي تمامًا، 1.35 = ظاهر بالكامل (نتجاوز 1 ليصل النمو لأبعد عقدة) */
  set grow(v) {
    this._grow = v;
    this.nodeMat.uniforms.uGrow.value = v;
    this.lineMat.uniforms.uGrow.value = v;
  }
  get grow() { return this._grow; }

  set opacity(v) {
    this._opacity = v;
    this.nodeMat.uniforms.uOpacity.value = v;
    this.lineMat.uniforms.uOpacity.value = 0.42 * v;
  }
  get opacity() { return this._opacity === undefined ? 1 : this._opacity; }

  set drift(v) {
    this.nodeMat.uniforms.uDrift.value = v;
    this.lineMat.uniforms.uDrift.value = v;
  }

/**
   * يحدّد أقرب كلمة مفتاحية إلى نقطة على الشاشة، فورًا وبلا انتظار إطار جديد.
   *
   * لماذا نحتاجها؟ الاختيار بالفأرة يعتمد على التمرير (hover) الذي
   * يُحسب في حلقة الرسم. لكن في اللمس لا يوجد تمرير: الإصبع ينزل
   * ويرتفع قبل أن يمرّ إطار، فلا يُختار شيء. هذه الدالة تحسب مباشرة.
   */
  pickAt(x, y) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // نوسّع دائرة الالتقاط في اللمس: الإصبع أقل دقة من مؤشر الفأرة
    const radius = Math.min(window.innerWidth, window.innerHeight) * (coarse ? 0.23 : 0.16);
    let best = null;
    let bestDist = Infinity;
    for (const item of this.nodes) {
      if (!item.screen.visible) continue;
      const dist = Math.hypot(x - item.screen.x, y - item.screen.y);
      if (dist < radius && dist < bestDist) { bestDist = dist; best = item; }
    }
    return best ? best.id : null;
  }

  /**
   * يُبقي اسم قسم واحد ظاهرًا ويُخفي البقية.
   * مرّر null لإعادة إظهار الجميع.
   */
  focusOn(id) { this.focusId = id; }

  nodeById(id) { return this.nodes.find((n) => n.id === id); }

  dispose() {
    this.points.geometry.dispose();
    this.nodeMat.dispose();
    this.lines.geometry.dispose();
    this.lineMat.dispose();
    for (const n of this.nodes) {
      n.haloMat.dispose();
      n.labelMat.dispose();
    }
  }
}
