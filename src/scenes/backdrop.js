/**
 * backdrop.js — قبة الخلفية: تدرّج لوني ناعم يعطي إحساس العمق.
 *
 * لماذا قبة بدل لون خلفية بسيط؟
 * لأن لون الخلفية (clearColor) يمرّ عبر تحويلات فضاء الألوان في مسار
 * ما بعد المعالجة فيخرج أفتح مما نريد. القبة مادة نتحكم بها بالكامل،
 * وتمنحنا فوق ذلك تدرّجًا يتغيّر لونه حسب المنطقة النشطة في الموقع.
 */
import * as THREE from 'three';

const vert = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vDir;
  void main() {
    vUv = uv;
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vDir;
  uniform vec3  uTop;
  uniform vec3  uBottom;
  uniform vec3  uGlow;
  uniform float uGlowStrength;
  uniform float uTime;

  // ضجيج خفيف جدًا يكسر «الأحزمة» (banding) في التدرجات الداكنة
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float h = smoothstep(0.30, 0.80, vUv.y);
    vec3 col = mix(uBottom, uTop, h);

    // هالة مركزية خافتة تعطي بؤرة بصرية
    float centre = 1.0 - clamp(length(vDir.xy) * 1.6, 0.0, 1.0);
    col += uGlow * pow(centre, 3.0) * uGlowStrength;

    col += (hash(gl_FragCoord.xy) - 0.5) * 0.0022;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Backdrop {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTop:          { value: new THREE.Color('#151d40') },
        uBottom:       { value: new THREE.Color('#080c1c') },
        uGlow:         { value: new THREE.Color('#1e3a68') },
        uGlowStrength: { value: 0.55 },
        uTime:         { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;   // يُرسم قبل كل شيء
    this.group = this.mesh;
  }

  /** تغيير ألوان الخلفية بسلاسة عند الانتقال بين المناطق */
  get colors() {
    return {
      top: this.material.uniforms.uTop.value,
      bottom: this.material.uniforms.uBottom.value,
      glow: this.material.uniforms.uGlow.value,
    };
  }

  update(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    // القبة تتبع الكاميرا حتى لا يخرج المستخدم منها أبدًا
    this.mesh.position.copy(this._camera ? this._camera.position : this.mesh.position);
  }

  follow(camera) { this._camera = camera; }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
