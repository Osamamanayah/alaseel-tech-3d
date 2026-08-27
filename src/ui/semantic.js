/**
 * semantic.js — يملأ النسخة النصية المخفية من نفس ملف البيانات.
 *
 * لماذا؟ محرّكات البحث وقارئات الشاشة لا ترى WebGL إطلاقًا.
 * هذه النسخة تجعل محتوى الموقع كاملًا قابلًا للقراءة والفهرسة،
 * وتبقى متطابقة مع المشهد لأنها تقرأ نفس المصدر.
 */
import { KEYWORDS, BRAND, projectsOf, isContactKeyword } from '../data/content.js';

export function renderSemanticContent() {
  const kwList = document.getElementById('semantic-keywords');
  const projWrap = document.getElementById('semantic-projects');
  if (!kwList || !projWrap) return;

  kwList.innerHTML = '';
  for (const k of KEYWORDS) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = k.title || k.label;
    li.append(strong, document.createTextNode(` — ${k.blurb}`));
    kwList.appendChild(li);
  }

  projWrap.innerHTML = '';
  for (const k of KEYWORDS) {
    const section = document.createElement('section');
    const h3 = document.createElement('h3');
    h3.textContent = isContactKeyword(k.id)
      ? `${k.label} — ${BRAND.phonePretty}`
      : (k.title || k.label);
    section.appendChild(h3);

    for (const p of projectsOf(k.id)) {
      const article = document.createElement('article');

      const h4 = document.createElement('h4');
      h4.textContent = p.name;

      // كوكب تواصل: عنوان + وصف + رابط فعلي (هاتف/بريد/واتساب)
      if (p.contact) {
        const desc = document.createElement('p');
        desc.textContent = p.description;
        article.append(h4, desc);
        if (p.contact.href) {
          const a = document.createElement('a');
          a.href = p.contact.href;
          a.textContent = `${p.contact.action}: ${p.contact.value}`;
          article.appendChild(a);
        } else {
          const note = document.createElement('p');
          note.textContent = `${p.contact.action} — ${BRAND.phonePretty}`;
          article.appendChild(note);
        }
        section.appendChild(article);
        continue;
      }

      const tagline = document.createElement('p');
      tagline.textContent = p.tagline;

      const desc = document.createElement('p');
      desc.textContent = p.description;

      // ما تشمله الخدمة
      const includes = document.createElement('ul');
      for (const item of p.includes ?? []) {
        const li = document.createElement('li');
        li.textContent = item;
        includes.appendChild(li);
      }

      const link = document.createElement('a');
      link.href = BRAND.whatsappWith(`السلام عليكم، أرغب بخدمة: ${k.title || k.label} — ${p.name}.`);
      link.textContent = `اطلب خدمة ${p.name}`;

      article.append(h4, tagline, desc, includes, link);
      section.appendChild(article);
    }
    projWrap.appendChild(section);
  }

  // روابط التواصل — تُبنى من BRAND فتبقى متطابقة مع الموقع دائمًا
  const contactList = document.getElementById('semantic-contact');
  if (contactList) {
    contactList.innerHTML = '';
    const links = [
      { href: BRAND.whatsappHref, text: `واتساب: ${BRAND.phonePretty}` },
      { href: BRAND.phoneHref, text: `هاتف: ${BRAND.phonePretty}` },
      { href: BRAND.emailHref, text: `بريد: ${BRAND.email}` },
    ];
    for (const l of links) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = l.text;
      li.appendChild(a);
      contactList.appendChild(li);
    }
  }

  // نحدّث وصف الصفحة أيضًا حتى يبقى متسقًا مع البيانات
  document.title = `${BRAND.name} — ${BRAND.tagline}`;
}
