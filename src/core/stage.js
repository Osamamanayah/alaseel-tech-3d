/**
 * stage.js — «المسرح»: كل ما هو مشترك بين كل المشاهد.
 * الراسم (renderer)، الكاميرا، المشهد، حلقة الرسم، والمؤشر.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { quality } from './quality.js';

export const PALETTE = {
  void:   new THREE.Color('#04060f'),
  deep:   new THREE.Color('#070b1c'),
  violet: new THREE.Color('#7b5cff'),
  cyan:   new THREE.Color('#22d3ee'),
  white:  new THREE.Color('#e9edff'),
};

class Stage {
  constructor() {
    this.canvas = document.getElementById('scene');

    // بعض الأجهزة القديمة أو المتصفحات المقيّدة لا تدعم WebGL.
    // نلتقط الفشل هنا بدل أن تنهار الصفحة كلها وتبقى بيضاء.
    this.failed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: quality.tier !== 'low',
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (error) {
      console.error('[WebGL غير متاح]', error);
      this.failed = true;
      return;
    }
    // أسود خالص: القيمة الوحيدة التي لا تتأثر بتحويلات فضاء الألوان.
    // اللون الفعلي للخلفية تصنعه قبة التدرّج (backdrop.js).
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.void.getHex(), 0.018);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    this.camera.position.set(0, 0, 60);

    // إضاءة أساسية — تتغير لاحقًا حسب المنطقة النشطة
    this.ambient = new THREE.AmbientLight(0x223055, 1.2);
    this.keyLight = new THREE.PointLight(PALETTE.cyan.getHex(), 220, 400, 2);
    this.keyLight.position.set(0, 0, 30);
    this.rimLight = new THREE.PointLight(PALETTE.violet.getHex(), 160, 500, 2);
    this.rimLight.position.set(-40, 30, -40);
    this.scene.add(this.ambient, this.keyLight, this.rimLight);

    // --- المؤشر (ماوس/لمس) ---
    this.pointer = new THREE.Vector2(0, 0);        // الهدف الخام  (-1..1)
    this.pointerSmooth = new THREE.Vector2(0, 0);  // النسخة الناعمة (قصور ذاتي)
    this.pointerVelocity = new THREE.Vector2(0, 0);
    this.pointerPixel = new THREE.Vector2(0, 0);   // بالبكسل، لواجهة HTML
    this.raycaster = new THREE.Raycaster();

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.updaters = new Set();

    this._setupComposer();
    this._bindEvents();
    this.resize();
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // strength: شدة الوهج | radius: 0 = وهج ضيق ملتصق بالحواف، 1 = وهج واسع يغمر الشاشة
    // threshold: الحد الأدنى للسطوع الذي يبدأ التوهج عنده (يحمي الخلفية الداكنة)
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.70,  // strength
      0.08,  // radius
      0.50   // threshold
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.bloomEnabled = quality.preset.bloom;
  }

  /**
   * فقدان سياق WebGL شائع على الجوال: عند تبديل التطبيقات أو ضغط
   * الذاكرة يسحب النظام السياق من الصفحة. بدون هذا المعالج تبقى
   * الشاشة سوداء إلى الأبد ولا يفهم المستخدم ما حدث.
   */
  _bindContextRecovery() {
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();          // شرط أساسي كي يسمح المتصفح بالاستعادة
      this.contextLost = true;
      cancelAnimationFrame(this._raf);
      document.dispatchEvent(new CustomEvent('stage:contextlost'));
    }, false);

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      // three.js يعيد رفع الأشكال والصور تلقائيًا عند الاستعادة
      this.clock.getDelta();           // نتخلص من الفجوة الزمنية المتراكمة
      this.start();
      document.dispatchEvent(new CustomEvent('stage:contextrestored'));
    }, false);
  }

  _bindEvents() {
    this._bindContextRecovery();

    window.addEventListener('resize', () => this.resize(), { passive: true });

    // تبويب مخفي = لا حاجة للرسم. يوفّر بطارية الجوال ويمنع تراكم
    // فجوة زمنية ضخمة تُحدث قفزة في الحركة عند العودة.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this._raf);
        this._paused = true;
      } else if (this._paused && !this.contextLost) {
        this._paused = false;
        this.clock.getDelta();
        this.start();
      }
    });

    const onMove = (x, y) => {
      this.pointerPixel.set(x, y);
      this.pointer.set(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1
      );
    };

    window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerdown', (e) => onMove(e.clientX, e.clientY), { passive: true });
    // عند مغادرة المؤشر للنافذة نعيد المشهد لوضع السكون
    window.addEventListener('pointerleave', () => this.pointer.set(0, 0), { passive: true });

    document.addEventListener('quality:change', () => {
      this.bloomEnabled = quality.preset.bloom;
      this.resize();
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, quality.preset.dpr);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);

    this.camera.aspect = w / h;
    // على الشاشات الطويلة (الهاتف) نوسّع مجال الرؤية حتى لا تخرج العناصر
    this.camera.fov = w / h < 0.85 ? 68 : 52;
    this.camera.updateProjectionMatrix();
  }

  /** تسجيل دالة تُنادى كل إطار: fn(dt, elapsed) */
  onFrame(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  /**
   * كم يجب أن تبعد الكاميرا حتى يدخل مستطيل بنصف عرض halfW ونصف ارتفاع halfH
   * داخل الشاشة كاملًا؟
   *
   * هذه أهم دالة للتجاوب: شاشة الجوال طويلة وضيقة، فالعرض هو القيد.
   * بدونها تخرج نصف عناصر المشهد خارج حدود الشاشة على الهاتف.
   */
  fitDistance(halfW, halfH, margin = 1.12) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const t = Math.tan(vFov / 2);
    const byHeight = halfH / t;
    const byWidth = halfW / (t * this.camera.aspect);
    return Math.max(byHeight, byWidth) * margin;
  }

  /** نصف ارتفاع المشهد المرئي عند مسافة معيّنة — نحتاجه لإزاحة التأطير */
  visibleHalfHeight(distance) {
    return distance * Math.tan((this.camera.fov * Math.PI) / 180 / 2);
  }

  /** هل نحن على شاشة ضيقة (جوال)؟ */
  get isCompact() {
    return window.innerWidth <= 780 || window.innerHeight <= 560;
  }

  /** يحوّل نقطة ثلاثية الأبعاد إلى إحداثيات بكسل على الشاشة */
  project(vec3) {
    const v = vec3.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      visible: v.z < 1,
    };
  }

  start() {
    cancelAnimationFrame(this._raf);   // نمنع تشغيل حلقتين معًا بعد الاستعادة

    // --- مراقب الأداء: إذا هبط FPS نخفّض الجودة تلقائيًا ---
    let slowFrames = 0;
    let sampleTime = 0;
    let sampleFrames = 0;

    const loop = () => {
      this._raf = requestAnimationFrame(loop);

      const dt = Math.min(this.clock.getDelta(), 0.05); // نمنع القفزات بعد تبديل التبويب
      this.elapsed += dt;

      // قصور ذاتي خفيف للمؤشر (يعطي إحساس السلاسة)
      const prevX = this.pointerSmooth.x;
      const prevY = this.pointerSmooth.y;
      const k = 1 - Math.pow(0.001, dt); // تنعيم مستقل عن معدل الإطارات
      this.pointerSmooth.x += (this.pointer.x - this.pointerSmooth.x) * k;
      this.pointerSmooth.y += (this.pointer.y - this.pointerSmooth.y) * k;
      this.pointerVelocity.set(
        (this.pointerSmooth.x - prevX) / Math.max(dt, 1e-4),
        (this.pointerSmooth.y - prevY) / Math.max(dt, 1e-4)
      );

      for (const fn of this.updaters) fn(dt, this.elapsed);

      if (this.bloomEnabled) this.composer.render();
      else this.renderer.render(this.scene, this.camera);

      // قياس الأداء على نوافذ من ثانية واحدة
      sampleTime += dt;
      sampleFrames++;
      if (sampleTime >= 1) {
        const fps = sampleFrames / sampleTime;
        if (fps < 42) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames >= 3) { quality.downgrade(); slowFrames = 0; }
        sampleTime = 0;
        sampleFrames = 0;
      }
    };
    loop();
  }

  stop() { cancelAnimationFrame(this._raf); }
}

export const stage = new Stage();
