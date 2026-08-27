/** الصور الواقعية لخدمات الشركة — خمس لقطات لكل قسم. */
import { assetUrl } from '../core/assetUrl.js';

const five = (folder) => Array.from(
  { length: 5 },
  (_, index) => assetUrl(`images/services/${folder}/${String(index + 1).padStart(2, '0')}.webp`),
);

export const SERVICE_IMAGE_SETS = [
  { id: 'web-apps', label: 'إنشاء المواقع', images: five('web-apps') },
  { id: 'native-apps', label: 'إنشاء التطبيقات', images: five('desktop-mobile') },
  { id: 'databases', label: 'إدارة قواعد البيانات', images: five('databases') },
  { id: 'ai-data', label: 'تحليل البيانات وبناء أنظمة الذكاء الاصطناعي', images: five('data-ai') },
];

export const serviceImageSetById = (id) => SERVICE_IMAGE_SETS.find((set) => set.id === id);
