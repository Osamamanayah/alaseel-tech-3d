/**
 * random.js — مولّد أرقام عشوائية «ثابت» (deterministic).
 *
 * لماذا لا نستخدم Math.random؟
 * لأن شكل الشبكة سيتغيّر في كل مرة يُفتح فيها الموقع، فلا نستطيع
 * ضبط التصميم. هذا المولّد يعطي نفس التسلسل دائمًا لنفس البذرة (seed).
 */
export function makeRandom(seed = 1337) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
