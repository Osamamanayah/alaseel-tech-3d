import { defineConfig } from 'vite';

export default defineConfig({
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
