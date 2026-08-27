/**
 * cameraRig.js — «حامل الكاميرا».
 *
 * لا نحرّك الكاميرا مباشرة أبدًا. بدلًا من ذلك نحرّك موقعًا أساسيًا (base)
 * عبر GSAP، ثم نضيف فوقه إزاحة parallax صغيرة تتبع المؤشر كل إطار.
 * هكذا لا يتعارك الانتقال السينمائي مع حركة المؤشر.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { quality } from './quality.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;

    this.base = new THREE.Vector3(0, 0, 60);   // الموقع الذي تتحرك إليه الانتقالات
    this.look = new THREE.Vector3(0, 0, 0);    // النقطة التي تنظر إليها الكاميرا
    this.parallaxAmount = 1;                   // 0 = بلا parallax

    this._offset = new THREE.Vector3();
    this._lookNow = new THREE.Vector3().copy(this.look);
    this._tween = null;
  }

  /**
   * انتقال سينمائي إلى موقع جديد.
   * المدة الافتراضية 1000ms ضمن النطاق المطلوب (600–1200ms).
   */
  flyTo({ position, look, duration = 1.0, ease = 'power3.inOut' } = {}) {
    if (this._tween) this._tween.kill();

    // في وضع تقليل الحركة نقصّر المدة بشدة بدل إلغاء الانتقال كليًا،
    // حتى لا يفقد المستخدم إحساسه بالمكان.
    const d = quality.reducedMotion ? 0.25 : duration;

    const targets = {};
    if (position) Object.assign(targets, { bx: position.x, by: position.y, bz: position.z });
    if (look) Object.assign(targets, { lx: look.x, ly: look.y, lz: look.z });

    const proxy = {
      bx: this.base.x, by: this.base.y, bz: this.base.z,
      lx: this.look.x, ly: this.look.y, lz: this.look.z,
    };

    return new Promise((resolve) => {
      this._tween = gsap.to(proxy, {
        ...targets,
        duration: d,
        ease: quality.reducedMotion ? 'power1.out' : ease,
        onUpdate: () => {
          this.base.set(proxy.bx, proxy.by, proxy.bz);
          this.look.set(proxy.lx, proxy.ly, proxy.lz);
        },
        onComplete: resolve,
      });
    });
  }

  /** يُنادى كل إطار بعد تحديث المؤشر */
  update(dt, pointerSmooth) {
    const amount = quality.reducedMotion ? 0 : this.parallaxAmount;

    // parallax محدود: يعطي إحساس العمق دون أن يزعزع القراءة
    const targetX = pointerSmooth.x * 2.2 * amount;
    const targetY = pointerSmooth.y * 1.5 * amount;
    const k = 1 - Math.pow(0.02, dt);
    this._offset.x += (targetX - this._offset.x) * k;
    this._offset.y += (targetY - this._offset.y) * k;

    this.camera.position.set(
      this.base.x + this._offset.x,
      this.base.y + this._offset.y,
      this.base.z
    );

    // نقطة النظر تتحرك بلطف أيضًا — يمنع الشعور بالكاميرا «الجامدة»
    this._lookNow.lerp(this.look, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(
      this._lookNow.x + this._offset.x * 0.25,
      this._lookNow.y + this._offset.y * 0.25,
      this._lookNow.z
    );
  }
}
