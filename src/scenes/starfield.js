/**
 * starfield.js — غبار كوني خافت يملأ الفضاء ويعطي إحساس العمق والحركة.
 * نستخدم Points واحدة (رسمة واحدة على كرت الشاشة) بدل آلاف الأجسام = أداء عالٍ.
 */
import * as THREE from 'three';
import { quality } from '../core/quality.js';

const vert = /* glsl */`
  precision highp float;
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2  uStretch;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    vec3 pos = position;
    // انجراف بطيء جدًا يمنع الإحساس بالجمود
    pos.x += sin(uTime * 0.05 + aSeed * 6.28) * 1.2;
    pos.y += cos(uTime * 0.04 + aSeed * 4.71) * 1.2;
    // عند الحركة السريعة تنزاح النقاط في اتجاه الحركة (إحساس بالسحب)
    pos.xy += uStretch * (0.4 + aSeed * 0.6);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (140.0 / max(-mv.z, 1.0));
  }
`;

const frag = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= 0.35 + 0.65 * (sin(uTime * 0.8 + vSeed * 20.0) * 0.5 + 0.5); // تلألؤ
    vec3 col = mix(uColorA, uColorB, vSeed);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

export class Starfield {
  constructor(radius = 260) {
    const count = quality.preset.starCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // توزيع داخل قشرة كروية حتى تحيط بالكاميرا من كل الجهات
      const r = radius * (0.35 + Math.random() * 0.65);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.6 + Math.random() * 2.2;
      seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime:        { value: 0 },
        uOpacity:     { value: 0 },
        uPixelRatio:  { value: Math.min(window.devicePixelRatio || 1, 2) },
        uStretch:     { value: new THREE.Vector2(0, 0) },
        uColorA:      { value: new THREE.Color('#22d3ee') },
        uColorB:      { value: new THREE.Color('#7b5cff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group = this.points;
  }

  update(dt, elapsed, stretch) {
    this.material.uniforms.uTime.value = elapsed;
    if (stretch) this.material.uniforms.uStretch.value.lerp(stretch, 1 - Math.pow(0.002, dt));
    this.points.rotation.y += dt * 0.006;
  }

  set opacity(v) { this.material.uniforms.uOpacity.value = v; }
  get opacity() { return this.material.uniforms.uOpacity.value; }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
