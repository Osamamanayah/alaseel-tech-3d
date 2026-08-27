/**
 * seed.js — «النواة»: اسم الاستوديو في مركز الفضاء.
 *
 * الاسم وحده بلا إطار ولا دائرة: يبدأ منه الموقع، ثم يبقى ثابتًا في
 * وسط الأقسام كنقطة ارتكاز بصرية، وإليه تعود دورة الإغلاق.
 *
 * النص مرسوم على canvas ثم يُستخدم كصورة داخل المشهد، لأن Three.js
 * لا يعرف كيف يصل الحروف. وهذا يمنحنا أيضًا تعبئة معدنية متدرّجة
 * وبروزًا سفليًا لا يمكن الحصول عليهما من خط ثلاثي الأبعاد جاهز.
 */
import * as THREE from 'three';
import { makeTextTexture } from '../core/textTexture.js';
import { BRAND } from '../data/content.js';

/** خط الشعار: هندسي مستقبلي، مع بدائل تعمل بلا إنترنت */
const LOGO_FONT = '"Orbitron", "Segoe UI", "Trebuchet MS", system-ui, sans-serif';

export class Seed {
  constructor() {
    this.group = new THREE.Group();
    this.labelBase = 0;
    this._opacity = 0;

    const { texture, aspect } = makeTextTexture(BRAND.name, {
      fontSize: 34,
      weight: 800,
      letterSpacing: 4.5,
      fontFamily: LOGO_FONT,
      // تعبئة معدنية: أبيض ناصع يتدرّج إلى أزرق فاتح ثم يعود
      gradient: [
        [0.00, '#ffffff'],
        [0.45, '#ffffff'],
        [0.68, '#c3e2ff'],
        [1.00, '#ffffff'],
      ],
      bevel: 2.5,               // بروز سفلي خفيف يعطي الحروف سماكة
      glow: '#7fd4ff',
      glowBlur: 18,             // توهج أوسع: الاسم وحده الآن، فهو يحمل المركز
      backing: null,            // بلا هالة داكنة حتى يبقى البياض ناصعًا
    });

    this.labelMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });

    const labelWidth = 18;
    this.label = new THREE.Mesh(
      new THREE.PlaneGeometry(labelWidth, labelWidth / aspect),
      this.labelMat
    );
    this.group.add(this.label);
    this.group.scale.setScalar(1);
  }

  /** يُنادى كل إطار */
  update(dt, elapsed) {
    // نبض هادئ في السطوع يمنع الاسم من أن يبدو صورة ثابتة ملصقة
    const pulse = (Math.sin(elapsed * 1.35) * 0.5 + 0.5) ** 1.6;
    this.labelMat.opacity = this.labelBase * (0.90 + pulse * 0.10);
  }

  set opacity(v) {
    this._opacity = v;
    this.labelBase = v;
    this.labelMat.opacity = v;
  }
  get opacity() { return this._opacity; }

  dispose() {
    this.label.geometry.dispose();
    this.labelMat.dispose();
  }
}
