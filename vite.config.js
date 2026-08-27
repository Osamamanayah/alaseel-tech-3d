import { defineConfig } from 'vite';

/**
 * اسم المستودع على GitHub. صفحات GitHub تنشر الموقع تحت مسار فرعي
 * بهذا الاسم، لا على جذر النطاق:
 *   https://<اسم-المستخدم>.github.io/alaseel-tech-3d/
 *
 * إن نشرت على نطاق خاص بك لاحقًا، غيّر هذا إلى '/' فقط.
 */
const REPO_BASE = '/alaseel-tech-3d/';

export default defineConfig({
  /**
   * نفس المسار في التطوير والمعاينة والنشر — عمدًا.
   *
   * جرّبنا جعله '/' أثناء التطوير فقط، فنتج عنه خطأ خبيث: النسخة
   * المبنية تطلب '/alaseel-tech-3d/assets/...' بينما خادم المعاينة
   * يقدّم من الجذر، فيعيد صفحة HTML بدل ملف السكربت والموقع لا يقلع.
   * توحيد المسار يلغي فئة كاملة من أخطاء «يعمل محليًا ويتعطّل منشورًا».
   *
   * العنوان المحلي يصبح: http://localhost:5173/alaseel-tech-3d/
   * (فتح localhost:5173 وحده يحوّلك إليه تلقائيًا)
   */
  base: REPO_BASE,

  server: {
    watch: {
      // لا نراقب هذين المجلدين: أدوات الفحص المحلية ومخرجات البناء.
      // بدون هذا، أي تعديل فيهما يعيد تحميل الصفحة أثناء العمل بلا داعٍ.
      ignored: ['**/tools/**', '**/dist/**'],
    },
  },

  build: {
    // نفصل مكتبة Three.js في ملف مستقل.
    // السبب: هي الجزء الأكبر وأقلّه تغيّرًا، ففصلها يعني أن زوّار
    // الموقع لا يعيدون تنزيلها كلما عدّلنا نصًا أو لونًا.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('node_modules/qrcode-generator')) return 'qrcode';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
