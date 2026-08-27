/**
 * particles.js — حقل جزيئات لتفكيك العناصر وإعادة تجميعها.
 *
 * الفكرة الأساسية للأداء: لا نحرّك أي جزيء على المعالج.
 * نخزّن لكل جزيء نقطة البداية ونقطة النهاية داخل الذاكرة مرة واحدة،
 * ثم نحرّك متغيّرًا واحدًا فقط (uProgress) من 0 إلى 1.
 * كرت الشاشة يحسب باقي المسار — فآلاف الجزيئات بتكلفة رقم واحد.
 */
import * as THREE from 'three';
import { quality } from '../core/quality.js';

const vert = /* glsl */ `
  precision highp float;
  attribute vec3  aStart;
  attribute vec3  aEnd;
  attribute float aSeed;
  attribute float aSize;
  attribute float aDelay;    // تأخير كل جزيء، ليتفكك التجمّع تدريجيًا
  attribute float aBright;   // سطوع متفاوت يمنع ظهورها ككتلة واحدة
  uniform float uProgress;
  uniform float uPixelRatio;
  uniform float uSwirl;
  varying float vSeed;
  varying float vFade;

  void main() {
    vSeed = aSeed;

    float t = clamp((uProgress - aDelay) / max(1.0 - aDelay, 0.0001), 0.0, 1.0);
    // تسارع ثم تباطؤ (easeInOutCubic): تبدأ الجزيئات بالانفصال بهدوء
    // ثم تنجذب، ثم تستقر — بدل أن تقفز فورًا نحو الهدف
    float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;

    vec3 pos = mix(aStart, aEnd, e);

    // انحراف جانبي يجعل المسار قوسًا لا خطًا مستقيمًا
    float arc = sin(t * 3.14159);
    pos.x += sin(aSeed * 31.4) * uSwirl * arc;
    pos.y += cos(aSeed * 17.7) * uSwirl * arc;
    pos.z += sin(aSeed * 44.1) * uSwirl * arc * 0.6;

    // تظهر بسرعة ثم تخفت وهي تقترب من الهدف
    vFade = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.84, 1.0, t)) * aBright;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (105.0 / max(-mv.z, 1.0));
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.08, d) * vFade * uOpacity * 0.62;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed * 0.5), alpha);
  }
`;

export class ParticleField {
  constructor() {
    this.capacity = quality.preset.particles;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.capacity), 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.capacity), 1));
    geo.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(this.capacity), 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(this.capacity), 1));
    geo.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uProgress: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uSwirl: { value: 3.5 },
        uOpacity: { value: 1 },
        uColorA: { value: new THREE.Color('#22d3ee') },
        uColorB: { value: new THREE.Color('#e9edff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.group = this.points;
    this.geometry = geo;
  }

  /**
   * يملأ الحقل بجزيئات موزّعة داخل مستطيلات شاشة، متجهة نحو هدف واحد.
   * @param {Array<{x,y,w,h}>} rects مستطيلات اللوحات بالبكسل
   * @param {THREE.Vector3} target النقطة التي تنجذب إليها كل الجزيئات
   * @param {THREE.Camera} camera
   * @param {THREE.Color} colorA
   */
  emitFromRects(rects, target, camera, colorA) {
    if (!rects.length) return 0;

    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    if (totalArea <= 0) return 0;

    const budget = Math.min(this.capacity, Math.round(quality.preset.particles * 0.32));
    const start = this.geometry.getAttribute('aStart');
    const end = this.geometry.getAttribute('aEnd');
    const seed = this.geometry.getAttribute('aSeed');
    const size = this.geometry.getAttribute('aSize');
    const delay = this.geometry.getAttribute('aDelay');
    const bright = this.geometry.getAttribute('aBright');

    // نحوّل نقطة شاشة إلى نقطة في الفضاء على مستوى عمق الهدف
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const planeDist = target.clone().sub(camera.position).dot(forward);
    const ndc = new THREE.Vector3();
    const dir = new THREE.Vector3();

    let i = 0;
    for (const r of rects) {
      const share = Math.round((r.w * r.h / totalArea) * budget);
      for (let n = 0; n < share && i < budget; n++, i++) {
        const sx = r.x + Math.random() * r.w;
        const sy = r.y + Math.random() * r.h;

        ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5);
        ndc.unproject(camera);
        dir.copy(ndc).sub(camera.position).normalize();
        const dist = planeDist / dir.dot(forward);
        const world = camera.position.clone().add(dir.multiplyScalar(dist));

        start.setXYZ(i, world.x, world.y, world.z);
        // الهدف: نثر خفيف حول النقطة حتى لا تنهار كلها في نقطة واحدة
        end.setXYZ(
          i,
          target.x + (Math.random() - 0.5) * 1.6,
          target.y + (Math.random() - 0.5) * 1.6,
          target.z + (Math.random() - 0.5) * 1.6
        );
        seed.setX(i, Math.random());
        size.setX(i, 0.55 + Math.random() * 1.35);
        delay.setX(i, Math.random() * 0.34);
        bright.setX(i, 0.35 + Math.random() * 0.65);
      }
    }

    start.needsUpdate = end.needsUpdate = seed.needsUpdate = true;
    size.needsUpdate = delay.needsUpdate = bright.needsUpdate = true;
    this.geometry.setDrawRange(0, i);

    if (colorA) this.material.uniforms.uColorA.value.copy(colorA);
    this.material.uniforms.uProgress.value = 0;
    this.points.visible = true;
    return i;
  }

  /**
   * يملأ الحقل بجزيئات من مواقع ثلاثية الأبعاد جاهزة (تستعملها دورة الإغلاق).
   * @param {THREE.Vector3[]} sources
   * @param {THREE.Vector3} target
   */
  emitFromPoints(sources, target, colorA) {
    const budget = Math.min(this.capacity, sources.length);
    const start = this.geometry.getAttribute('aStart');
    const end = this.geometry.getAttribute('aEnd');
    const seed = this.geometry.getAttribute('aSeed');
    const size = this.geometry.getAttribute('aSize');
    const delay = this.geometry.getAttribute('aDelay');
    const bright = this.geometry.getAttribute('aBright');

    for (let i = 0; i < budget; i++) {
      const s = sources[i];
      start.setXYZ(i, s.x, s.y, s.z);
      end.setXYZ(
        i,
        target.x + (Math.random() - 0.5) * 1.2,
        target.y + (Math.random() - 0.5) * 1.2,
        target.z + (Math.random() - 0.5) * 1.2
      );
      seed.setX(i, Math.random());
      size.setX(i, 0.5 + Math.random() * 1.5);
      delay.setX(i, Math.random() * 0.4);
      bright.setX(i, 0.35 + Math.random() * 0.65);
    }

    start.needsUpdate = end.needsUpdate = seed.needsUpdate = true;
    size.needsUpdate = delay.needsUpdate = bright.needsUpdate = true;
    this.geometry.setDrawRange(0, budget);

    if (colorA) this.material.uniforms.uColorA.value.copy(colorA);
    this.material.uniforms.uProgress.value = 0;
    this.points.visible = true;
    return budget;
  }

  set progress(v) {
    this.material.uniforms.uProgress.value = v;
    if (v >= 1) this.points.visible = false;
  }
  get progress() { return this.material.uniforms.uProgress.value; }

  set swirl(v) { this.material.uniforms.uSwirl.value = v; }

  clear() {
    this.points.visible = false;
    this.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
