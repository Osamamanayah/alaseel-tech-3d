/**
 * main.js — نقطة البداية ومدير الحالات.
 *
 * الموقع ليس صفحات، بل «حالات» داخل فضاء واحد:
 *   seed  → المربع الأول
 *   grid  → شبكة الكلمات المفتاحية
 *   (لاحقًا) constellation → project → contact → dissolve
 */
import * as THREE from 'three';
import gsap from 'gsap';

import { stage } from './core/stage.js';
import { quality } from './core/quality.js';
import { waitForFonts } from './core/textTexture.js';
import { CameraRig } from './core/cameraRig.js';
import { sound, armSoundOnFirstGesture } from './core/sound.js';

import { Backdrop } from './scenes/backdrop.js';
import { Starfield } from './scenes/starfield.js';
import { Seed } from './scenes/seed.js';
import { Lattice } from './scenes/lattice.js';
import { Constellation } from './scenes/constellation.js';
import { ParticleField } from './scenes/particles.js';

import { renderSemanticContent } from './ui/semantic.js';
import { Panels } from './ui/panels.js';
import { Hud } from './ui/hud.js';
import { KEYWORDS, keywordById, projectById } from './data/content.js';

/* ------------------------------------------------------------------ */

const boot = document.createElement('div');
boot.id = 'boot';
boot.innerHTML = '<div class="boot-mark"></div>';
document.body.appendChild(boot);

const app = {
  state: 'seed',        // الحالة الحالية
  keywordId: null,      // الكلمة المفتاحية النشطة
  projectId: null,      // المشروع النشط
  busy: false,          // يمنع تشغيل انتقالين معًا
};

/** الكوكبة المعروضة حاليًا (تُبنى عند الدخول وتُهدم عند الخروج) */
let constellation = null;

/* ------------------------------------------------------------------ */

/**
 * يفعّل خط Google بعد تحميله.
 * كان هذا سابقًا معالج onload مضمّنًا داخل HTML، لكن المعالجات
 * المضمّنة تُجبرنا على السماح بالسكربتات المضمّنة في سياسة الأمان،
 * وهي الثغرة التي تستغلها هجمات حقن السكربتات.
 */
function enableWebFont() {
  const link = document.getElementById('font-link');
  if (!link) return;
  const activate = () => { link.media = 'all'; };
  link.addEventListener('load', activate, { once: true });
  // لو كان محمّلًا مسبقًا من الذاكرة المؤقتة فلن يُطلق حدث load
  if (link.sheet) activate();
}

/**
 * يعرض رسالة واضحة بدل شاشة سوداء صامتة، ويكشف النسخة النصية
 * حتى يبقى محتوى الموقع كاملًا متاحًا للقراءة.
 */
function showFallback(title, detail) {
  document.getElementById('boot')?.remove();
  const semantic = document.getElementById('semantic-content');
  if (semantic) semantic.classList.remove('sr-only');

  let box = document.getElementById('fallback-note');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fallback-note';
    box.setAttribute('role', 'alert');
    document.body.appendChild(box);
  }
  box.innerHTML = `<strong></strong><span></span>
    <button type="button">إعادة المحاولة</button>`;
  box.querySelector('strong').textContent = title;
  box.querySelector('span').textContent = detail;
  box.querySelector('button').addEventListener('click', () => location.reload());
}

/** يخفي رسالة العطل بعد عودة الرسم */
function hideFallback() {
  document.getElementById('fallback-note')?.remove();
  document.getElementById('semantic-content')?.classList.add('sr-only');
}

async function init() {
  // لا يدعم الجهاز WebGL: نعرض المحتوى النصي بدل صفحة فارغة
  if (stage.failed) {
    showFallback(
      'جهازك لا يدعم الرسم ثلاثي الأبعاد',
      'محتوى الموقع كاملًا معروض أدناه، ويمكنك التواصل معنا مباشرة.'
    );
    renderSemanticContent();
    return;
  }

  // فقدان سياق الرسم: يحدث على الجوال عند تبديل التطبيقات
  document.addEventListener('stage:contextlost', () => {
    showFallback(
      'توقّف الرسم مؤقتًا',
      'حدث هذا لأن النظام استعاد ذاكرة كرت الشاشة. سيعود تلقائيًا، أو أعد المحاولة.'
    );
  });
  document.addEventListener('stage:contextrestored', () => hideFallback());

  enableWebFont();
  armSoundOnFirstGesture();
  renderSemanticContent();
  await waitForFonts();

  const rig = new CameraRig(stage.camera);

  const backdrop = new Backdrop();
  backdrop.follow(stage.camera);
  stage.scene.add(backdrop.group);

  const starfield = new Starfield();
  stage.scene.add(starfield.group);

  const lattice = new Lattice();
  lattice.grow = 0;
  stage.scene.add(lattice.group);

  const seed = new Seed();
  stage.scene.add(seed.group);

  // نمرّر مواقع كل الكلمات للكوكبة حتى ترسم خيوط العلاقات نحو المناطق الأخرى
  const keywordPositions = new Map(lattice.nodes.map((n) => [n.id, n.home.clone()]));

  // اللوحات الزجاجية (HTML) وحقل الجزيئات (WebGL)
  const panels = new Panels(document.getElementById('ui-root'));
  // لوحة التوجيه: زر عودة دائم + مسار + خريطة مصغّرة + مؤشر عمق
  const hud = new Hud(document.getElementById('ui-root'));
  hud.onBack = () => goBack();

  const particles = new ParticleField();
  stage.scene.add(particles.group);

  // حجم الكوكب وهو مستقرّ في مركز الشبكة
  const SEED_CORE_SCALE = 0.8;

  const stretch = new THREE.Vector2();
  let lastHudKey = '';

  /**
   * يحدّث لوحة التوجيه عند تغيّر الموقع فقط.
   * تُنادى من حلقة الرسم (شبكة أمان) ومباشرةً عند نهاية كل انتقال،
   * حتى لا ينتظر الزر إطارًا جديدًا كي يظهر على الأجهزة البطيئة.
   */
  function refreshHud() {
    const key = `${app.state}|${app.keywordId}|${app.projectId}`;
    if (key === lastHudKey) return;
    lastHudKey = key;
    hud.setLocation({
      state: app.state,
      keyword: app.keywordId ? keywordById(app.keywordId) : null,
      project: app.projectId ? projectById(app.projectId) : null,
    });
  }

  /* ------------------------- التأطير المتجاوب ------------------------- */

  // نصف امتداد الشبكة يُحسب من مواقع الأقسام الفعلية، لا برقم ثابت.
  // هكذا تبقى كل الأقسام داخل الإطار مهما أضفت أو حذفت أقسامًا.
  const GRID_EXTENT = KEYWORDS.reduce(
    (acc, k) => ({
      w: Math.max(acc.w, Math.abs(k.position[0]) + 6),
      h: Math.max(acc.h, Math.abs(k.position[1]) + 6),
    }),
    { w: 0, h: 0 }
  );
  const CONSTELLATION_EXTENT = { w: 21, h: 19 };

  const gridView = () => ({
    position: new THREE.Vector3(0, 0, stage.fitDistance(GRID_EXTENT.w, GRID_EXTENT.h)),
    look: new THREE.Vector3(0, 0, 0),
  });

  const keywordView = (home) => ({
    position: home.clone().add(new THREE.Vector3(0, 0, stage.fitDistance(CONSTELLATION_EXTENT.w, CONSTELLATION_EXTENT.h))),
    look: home.clone(),
  });

  /**
   * عرض مشروع. على الجوال تحتل اللوحات ثلثي الشاشة السفليين،
   * فنُزيح نقطة النظر للأسفل حتى يظهر النجم في الثلث العلوي بدل أن يختفي خلفها.
   */
  const projectView = (home) => {
    const distance = stage.fitDistance(14, 12);
    const look = home.clone();
    if (stage.isCompact) {
      look.y -= stage.visibleHalfHeight(distance) * 0.46;
    }
    return { position: home.clone().add(new THREE.Vector3(0, look.y - home.y, distance)), look };
  };

  /* ------------------------- حلقة الرسم ------------------------- */

  stage.onFrame((dt, elapsed) => {
    // شدّ لحظي في اتجاه حركة المؤشر، ثم استقرار مرن
    const s = quality.reducedMotion ? 0 : 1;
    stretch.set(
      THREE.MathUtils.clamp(stage.pointerVelocity.x * 1.1, -7, 7) * s,
      THREE.MathUtils.clamp(stage.pointerVelocity.y * 1.1, -7, 7) * s
    );

    backdrop.update(dt, elapsed);
    starfield.update(dt, elapsed, stretch);
    seed.update(dt, elapsed);

    lattice.update(dt, elapsed, {
      stretch,
      pointerPixel: stage.pointerPixel,
      project: (v) => stage.project(v),
      interactive: app.state === 'grid' && !app.busy,
    });

    if (constellation) {
      constellation.update(dt, elapsed, {
        pointerPixel: stage.pointerPixel,
        project: (v) => stage.project(v),
        interactive: app.state === 'constellation' && !app.busy,
      });
    }

    // اللوحات تلاحق موقع النجم المُسقَط على الشاشة
    if (panels.open && app.projectId && constellation) {
      const star = constellation.starById(app.projectId);
      if (star) panels.follow(stage.project(star.home), stage.pointerSmooth);
    }

    refreshHud();
    hud.update(dt, stage.camera.position, app.keywordId);

    rig.update(dt, stage.pointerSmooth);
    updateCursor(lattice, constellation);
  });

  stage.start();

  /* ------------------------ الظهور الأول ------------------------ */

  const intro = gsap.timeline();
  intro
    .to(starfield, { opacity: 0.75, duration: 1.2, ease: 'power2.out' })
    .to(seed, { opacity: 1, duration: 1.0, ease: 'power2.out' }, '-=0.7');

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 800);

  // نثبّت مدخلًا أوليًا في تاريخ المتصفح حتى يعرف زر الرجوع أين يعود
  history.replaceState({ kw: null, proj: null }, '', '#/');

  // المربع يتفتّح تلقائيًا بعد لحظة تأمّل — أو فورًا بنقرة/زر
  const autoOpen = setTimeout(() => openLattice(), 3200);

  /* --------------------------- الانتقالات --------------------------- */

  /** المربع يتوسّع ويتحول إلى شبكة */
  async function openLattice() {
    if (app.state !== 'seed' || app.busy) return;
    clearTimeout(autoOpen);
    app.busy = true;
    sound.section(0);

    const reduced = quality.reducedMotion;
    const tl = gsap.timeline({
      onComplete: () => {
        app.state = 'grid';
        app.busy = false;
        refreshHud();
        announce('أقسام الاستوديو جاهزة. مرّر المؤشر على قسم لاختياره.');
      },
    });

    // الكوكب يتوسّع كأنه يطلق الشبكة من داخله، ثم يستقرّ صغيرًا في
    // المركز ويبقى ظاهرًا باستمرار كنواة للفضاء — لا يختفي.
    tl.to(seed.group.scale, {
      x: 1.9, y: 1.9, z: 1.9,
      duration: reduced ? 0.2 : 0.9,
      ease: 'power2.in',
    }, 0);
    tl.to(seed.group.scale, {
      x: SEED_CORE_SCALE, y: SEED_CORE_SCALE, z: SEED_CORE_SCALE,
      duration: reduced ? 0.25 : 1.5,
      ease: 'power3.out',
    }, reduced ? 0.2 : 0.9);

    // وفي الوقت نفسه تمتد الخطوط من المركز نحو الأطراف
    tl.to(lattice, {
      grow: 1.35,
      duration: reduced ? 0.4 : 1.9,
      ease: 'power2.out',
    }, reduced ? 0 : 0.45);

    // الكاميرا تتراجع بالقدر الذي تتطلبه الشاشة الحالية لتستوعب الشبكة كاملة
    rig.flyTo({ ...gridView(), duration: 1.6, ease: 'power2.out' });

    await tl.then();
  }

  /** الكاميرا تتحرك داخل الفضاء نحو قسم، ثم تتشكّل كوكبة عناصره */
  let enterKeyword = async function enterKeyword(id, opts = {}) {
    if (app.state !== 'grid' || app.busy) return;
    const node = lattice.nodeById(id);
    if (!node) return;

    app.busy = true;
    app.keywordId = id;
    app.state = 'entering';
    sound.section(KEYWORDS.findIndex((k) => k.id === id));
    refreshHud();

    const home = node.home;
    const reduced = quality.reducedMotion;

    tintRegion(node.data);
    lattice.focusOn(id);        // أسماء الأقسام الأخرى تتلاشى

    // 1) الكاميرا تنتقل مكانيًا نحو العقدة — لا قطع ولا إعادة تحميل
    rig.flyTo({ ...keywordView(home), duration: 1.15, ease: 'power3.inOut' });

    // 2) بقية الشبكة تتراجع في العمق وتفقد وضوحها
    gsap.to(lattice, { opacity: 0.22, duration: 1.0, ease: 'power2.out' });
    // اسم الموقع يختفي داخل الأقسام حتى لا يزاحم المحتوى
    gsap.to(seed, { opacity: 0, duration: 0.7, ease: 'power2.out' });
    gsap.to(starfield, { opacity: 0.35, duration: 1.0, ease: 'power2.out' });

    // 3) الكوكبة تتشكّل: الخطوط تُرسم من المركز، ثم تسطع النجوم
    constellation = new Constellation(node.data, keywordPositions);
    constellation.opacity = 0;
    constellation.draw = 0;
    stage.scene.add(constellation.group);

    const tl = gsap.timeline();
    tl.to(constellation, { draw: 1, duration: reduced ? 0.3 : 1.1, ease: 'power2.out' }, reduced ? 0 : 0.45)
      .to(constellation, { opacity: 1, duration: reduced ? 0.3 : 0.9, ease: 'power2.out' }, reduced ? 0 : 0.7);

    await wait(reduced ? 400 : 1250);
    app.state = 'constellation';
    app.busy = false;
    refreshHud();
    if (opts.history !== false) syncHistory();

    announce(
      `قسم ${node.data.label}: ${constellation.stars.length} عناصر. ` +
      'استخدم الأسهم للتنقل و Enter للفتح و Escape للعودة.'
    );
  }

  /** العودة من الكوكبة إلى الشبكة الكاملة */
  let backToGrid = async function backToGrid(opts = {}) {
    if (app.state !== 'constellation' || app.busy) return;
    app.busy = true;
    app.state = 'leaving';
    refreshHud();

    const reduced = quality.reducedMotion;
    const leaving = constellation;
    constellation = null;              // نوقف التفاعل معها فورًا

    panels.hide({ instant: true });
    particles.clear();

    tintRegion(null);
    lattice.focusOn(null);      // تعود كل الأسماء
    rig.flyTo({ ...gridView(), duration: 1.1, ease: 'power3.inOut' });
    gsap.to(lattice, { opacity: 1, duration: 0.9, ease: 'power2.out' });
    gsap.to(seed, { opacity: 1, duration: 0.9, ease: 'power2.out' });
    gsap.to(starfield, { opacity: 0.75, duration: 0.9, ease: 'power2.out' });

    if (leaving) {
      // الكوكبة تنسحب عكس ظهورها: تخفت ثم تنكمش خطوطها نحو المركز
      gsap.to(leaving, { opacity: 0, duration: reduced ? 0.25 : 0.6, ease: 'power2.in' });
      gsap.to(leaving, {
        draw: 0,
        duration: reduced ? 0.25 : 0.75,
        ease: 'power2.in',
        onComplete: () => leaving.dispose(),
      });
    }

    await wait(reduced ? 350 : 1100);
    app.keywordId = null;
    app.state = 'grid';
    app.busy = false;
    refreshHud();
    if (opts.history !== false) syncHistory();
    announce('عدت إلى الفضاء.');
  }

  /** اختيار مشروع: الكاميرا تقترب والنص يفتح في لوحات زجاجية طافية */
  let selectProject = async function selectProject(id, opts = {}) {
    if (app.state !== 'constellation' || app.busy || !constellation) return;
    const star = constellation.starById(id);
    if (!star) return;

    app.busy = true;
    app.projectId = id;
    app.state = 'entering-project';
    sound.item(constellation.stars.findIndex((s) => s.id === id));
    refreshHud();

    const reduced = quality.reducedMotion;

    // الكاميرا تقترب من النجم — انتقال مكاني لا قطع
    rig.flyTo({ ...projectView(star.home), duration: 1.0, ease: 'power3.inOut' });

    // بقية الكوكبة تتراجع وتفقد وضوحها فيبقى التركيز على المشروع
    gsap.to(constellation, { opacity: 0.3, duration: 0.9, ease: 'power2.out' });
    gsap.to(lattice, { opacity: 0.1, duration: 0.9, ease: 'power2.out' });
    gsap.to(seed, { opacity: 0, duration: 0.6, ease: 'power2.out' });
    rig.parallaxAmount = 0.45;   // نهدّئ الحركة أثناء القراءة

    await wait(reduced ? 200 : 620);

    panels.snapTo(stage.project(star.home));
    panels.show(star.project, constellation.keyword);
    panels.onClose = () => closeProject();

    await wait(reduced ? 200 : 520);
    app.state = 'project';
    app.busy = false;
    refreshHud();
    if (opts.history !== false) syncHistory();
  }

  /** الخروج من مشروع: النصوص والصور تتفكك إلى جزيئات تنجذب نحو نجمه */
  let closeProject = async function closeProject(opts = {}) {
    if (app.state !== 'project' || app.busy || !constellation) return;
    const star = constellation.starById(app.projectId);
    app.busy = true;
    app.state = 'leaving-project';
    refreshHud();

    const reduced = quality.reducedMotion;

    if (star && !reduced) {
      // 1) نقيس مواقع اللوحات على الشاشة قبل إخفائها
      const rects = panels.captureRects();
      // 2) نحوّلها إلى جزيئات في نفس المكان تمامًا
      const count = particles.emitFromRects(
        rects, star.home, stage.camera, new THREE.Color(constellation.keyword.accent)
      );
      panels.hide({ instant: true });
      // 3) الجزيئات تنجذب نحو النجم وتعيد تشكيله
      if (count > 0) {
        particles.progress = 0;
        // ملاحظة مهمة: ننظّف عند اكتمال الحركة نفسها، لا بعد مدة زمنية ثابتة.
        // لو ربطناها بمؤقّت، فالأجهزة البطيئة تمسح الجزيئات وهي في منتصف الطريق.
        gsap.to(particles, {
          progress: 1,
          duration: 1.15,
          ease: 'power2.inOut',
          onComplete: () => particles.clear(),
        });
      }
    } else {
      panels.hide();
    }

    // الكوكبة تعود إلى وضوحها الكامل
    gsap.to(constellation, { opacity: 1, duration: 0.9, ease: 'power2.out' });
    gsap.to(lattice, { opacity: 0.22, duration: 0.9, ease: 'power2.out' });
    gsap.to(seed, { opacity: 0, duration: 0.9, ease: 'power2.out' });
    rig.parallaxAmount = 1;

    const node = lattice.nodeById(app.keywordId);
    rig.flyTo({ ...keywordView(node.home), duration: 1.1, ease: 'power3.inOut' });

    await wait(reduced ? 300 : 1150);
    app.projectId = null;
    app.state = 'constellation';
    app.busy = false;
    refreshHud();
    if (opts.history !== false) syncHistory();
    announce('عدت إلى القسم.');
  }

  /**
   * يغلّف أي انتقال بشبكة أمان.
   * بدونها، خطأ واحد داخل انتقال يترك app.busy = true إلى الأبد،
   * فيصبح الموقع غير قابل للاستخدام ولا يمكن الرجوع منه.
   */
  function guard(fn, recoverState) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error('[انتقال فشل]', error);
        app.busy = false;
        refreshHud();
        app.state = recoverState();
        lastHudKey = '';           // نجبر لوحة التوجيه على التحديث
        announce('حدث خطأ أثناء الانتقال. يمكنك المتابعة.');
      }
    };
  }

  /* ---------------------- التنقل والتاريخ ---------------------- */

  /**
   * يضيف الموقع الحالي إلى تاريخ المتصفح، فيعمل زر الرجوع فيه.
   *
   * ملاحظة: نضيف فقط ولا نستبدل. الاستبدال أثناء خطوة وسيطة
   * كان يمحو المدخل السابق، فيصير مدخلان متطابقان وزر الرجوع بلا أثر.
   */
  function syncHistory() {
    const path = app.projectId
      ? `#/${app.keywordId}/${app.projectId}`
      : app.keywordId
        ? `#/${app.keywordId}`
        : '#/';
    history.pushState({ kw: app.keywordId, proj: app.projectId }, '', path);
  }

  const untilIdle = async () => { while (app.busy) await wait(60); };

  /** ينتقل إلى أي موقع في الفضاء، مارًّا بكل الخطوات الوسيطة */
  async function navigateTo(kw, proj, { history: writeHistory = true } = {}) {
    await untilIdle();
    if (app.state === 'seed') { await openLattice(); await untilIdle(); }

    // نرجع للخلف حتى نصل إلى الجذر المشترك، ثم نتقدّم نحو الهدف
    if (app.projectId && app.projectId !== proj) { await closeProject({ history: false }); await untilIdle(); }
    if (app.keywordId && app.keywordId !== kw) { await backToGrid({ history: false }); await untilIdle(); }
    if (kw && app.keywordId !== kw) { await enterKeyword(kw, { history: false }); await untilIdle(); }
    if (proj && app.projectId !== proj) { await selectProject(proj, { history: false }); await untilIdle(); }

    if (writeHistory) syncHistory();
  }

  /**
   * خطوة واحدة للأعلى: فرع ← قسم ← الفضاء.
   * لا نستدعي history.back() هنا عمدًا: لو وصل المستخدم بقفزة
   * (من الرزنامة مثلًا) فإن «الخلف» في التاريخ ليس بالضرورة
   * المستوى الأعلى. الصعود مستوى واحد سلوك متوقّع دائمًا.
   */
  function goBack() {
    if (app.busy) return;
    sound.back();
    if (app.state === 'project') { navigateTo(app.keywordId, null); return; }
    if (app.state === 'constellation') { navigateTo(null, null); return; }
  }

  // نستبدل الانتقالات بنسخ محمية — أي خطأ لن يجمّد الموقع
  const rawEnterKeyword = enterKeyword;
  const rawBackToGrid = backToGrid;
  const rawSelectProject = selectProject;
  const rawCloseProject = closeProject;
  enterKeyword = guard(rawEnterKeyword, () => (app.keywordId ? 'constellation' : 'grid'));
  backToGrid = guard(rawBackToGrid, () => 'grid');
  selectProject = guard(rawSelectProject, () => (app.projectId ? 'project' : 'constellation'));
  closeProject = guard(rawCloseProject, () => 'constellation');

  /**
   * عند تدوير الجوال أو تغيير حجم النافذة، نعيد حساب التأطير فورًا.
   * بدون هذا، من يفتح الموقع أفقيًا ثم يدوّر جهازه تخرج عناصر المشهد
   * خارج الشاشة ولا تعود حتى ينتقل بين الأقسام.
   */
  let reframeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(reframeTimer);
    reframeTimer = setTimeout(() => {
      if (app.busy) return;
      let view = null;
      if (app.state === 'grid') view = gridView();
      else if (app.state === 'constellation' && app.keywordId) {
        view = keywordView(lattice.nodeById(app.keywordId).home);
      } else if (app.state === 'project' && constellation && app.projectId) {
        const star = constellation.starById(app.projectId);
        if (star) view = projectView(star.home);
      }
      if (view) rig.flyTo({ ...view, duration: 0.5, ease: 'power2.out' });
    }, 180);   // ننتظر استقرار القياسات: iOS يرسل عدة أحداث أثناء التدوير
  }, { passive: true });

  window.addEventListener('popstate', (event) => {
    const target = event.state || { kw: null, proj: null };
    navigateTo(target.kw, target.proj, { history: false });
  });

  /** تغيير لون الخلفية والإضاءة حسب المنطقة النشطة */
  function tintRegion(keyword) {
    const top = keyword ? keyword.backdrop.top : '#151d40';
    const bottom = keyword ? keyword.backdrop.bottom : '#080c1c';
    const accent = keyword ? keyword.accent : '#22d3ee';

    tweenColor(backdrop.colors.top, top, 1.1);
    tweenColor(backdrop.colors.bottom, bottom, 1.1);
    tweenColor(backdrop.colors.glow, keyword ? accent : '#1e3a68', 1.1, keyword ? 0.20 : 1);
    tweenColor(stage.keyLight.color, accent, 1.1);
  }

  /* --------------------------- التفاعل --------------------------- */

  window.addEventListener('pointerup', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (app.state === 'seed') { openLattice(); return; }

    // نحسب الهدف من موضع الإصبع/المؤشر لحظة الرفع مباشرة.
    // الاعتماد على hoveredId وحده يفشل في اللمس (لا يوجد تمرير قبل النقر).
    if (app.state === 'grid') {
      const id = lattice.pickAt(e.clientX, e.clientY) || lattice.hoveredId;
      if (id) enterKeyword(id);
      return;
    }
    if (app.state === 'constellation' && constellation) {
      const id = constellation.pickAt(e.clientX, e.clientY) || constellation.hoveredId;
      if (id) selectProject(id);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Backspace') {
      // العودة تتدرّج خطوة واحدة للخلف، فلا يفقد المستخدم مكانه
      goBack();
      return;
    }

    if (app.state === 'seed' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openLattice();
      return;
    }

    // التنقل داخل الكوكبة
    if (app.state === 'constellation' && constellation) {
      const stars = constellation.stars;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        constellation.focusedIndex = (constellation.focusedIndex + 1) % stars.length;
        announce(stars[constellation.focusedIndex].project.name);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        constellation.focusedIndex =
          (constellation.focusedIndex - 1 + stars.length) % stars.length;
        announce(stars[constellation.focusedIndex].project.name);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = constellation.focusedIndex >= 0 ? constellation.focusedIndex : 0;
        selectProject(stars[idx].id);
      }
      return;
    }

    if (app.state !== 'grid') return;

    // التنقل بالأسهم بين الكلمات — دعم كامل للوحة المفاتيح
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      lattice.focusedIndex = (lattice.focusedIndex + 1) % KEYWORDS.length;
      announce(KEYWORDS[lattice.focusedIndex].label);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      lattice.focusedIndex =
        (lattice.focusedIndex - 1 + KEYWORDS.length) % KEYWORDS.length;
      announce(KEYWORDS[lattice.focusedIndex].label);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const idx = lattice.focusedIndex >= 0 ? lattice.focusedIndex : 0;
      enterKeyword(KEYWORDS[idx].id);
    }
  });

  // للتشخيص أثناء التطوير (متاح من Console في المتصفح)
  window.__stage = stage;
  window.__app = {
    app, stage, rig, lattice, backdrop, starfield, seed,
    openLattice, enterKeyword, backToGrid, selectProject, closeProject,
    goBack, navigateTo,
    panels, particles, quality, hud, sound,
    get constellation() { return constellation; },
  };
}

/* --------------------------- أدوات مساعدة --------------------------- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** تحريك لون Three.js بسلاسة نحو لون جديد */
function tweenColor(colorRef, hex, duration, scale = 1) {
  const target = new THREE.Color(hex).multiplyScalar(scale);
  gsap.to(colorRef, { r: target.r, g: target.g, b: target.b, duration, ease: 'power2.out' });
}

/** يغيّر شكل المؤشر عندما يكون فوق عنصر قابل للاختيار */
function updateCursor(lattice, constellation) {
  const hovering = lattice.hoveredId || constellation?.hoveredId;
  const wanted = hovering ? 'pointer' : 'default';
  if (document.body.style.cursor !== wanted) document.body.style.cursor = wanted;
}

/** إعلان صوتي لقارئات الشاشة */
let liveRegion = null;
function announce(message) {
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = message;
}

init();
