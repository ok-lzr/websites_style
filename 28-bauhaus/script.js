/* ============================================================
   包豪斯个人主页 — 交互脚本（原生 JS，无任何依赖）
   职责：时钟、打字机、滚动动画、数字滚动、作品筛选、
        平滑滚动与导航高亮、深浅色切换、回到顶部
   ============================================================ */
'use strict';

/* ===== 工具：安全查询 ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* 尊重用户的"减少动效"偏好 */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   1) 长沙时间实时时钟
   参考基线：2026-09-14（星期一）22:07（UTC+8）来自网络查询，
   仅用于判断昼夜主题；真实时间始终取自 new Date() 实时刷新。
   ============================================================ */
const CLOCK_BASE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7 };
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/* 用 UTC 偏移 +8 计算长沙（东八区）时间，避免受本机时区影响 */
function getChangshaParts() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const cst = new Date(utcMs + 8 * 60 * 60 * 1000);

  const pad = (n) => String(n).padStart(2, '0');

  return {
    year: cst.getFullYear(),
    month: cst.getMonth() + 1,
    day: cst.getDate(),
    hour: cst.getHours(),
    minute: cst.getMinutes(),
    second: cst.getSeconds(),
    weekday: WEEKDAYS[cst.getDay()],
    text: cst.getFullYear() + '年' + pad(cst.getMonth() + 1) + '月' + pad(cst.getDate()) + '日 ' +
          WEEKDAYS[cst.getDay()] + ' ' +
          pad(cst.getHours()) + ':' + pad(cst.getMinutes()) + ':' + pad(cst.getSeconds()),
    iso: cst.getFullYear() + '-' + pad(cst.getMonth() + 1) + '-' + pad(cst.getDate()) + 'T' +
         pad(cst.getHours()) + ':' + pad(cst.getMinutes()) + ':' + pad(cst.getSeconds()) + '+08:00'
  };
}

function startClock() {
  const clockEl = $('#clock');
  const noteEl = $('#clockNote');
  if (!clockEl) return;

  let lastSecond = -1;

  const tick = () => {
    const p = getChangshaParts();
    if (p.second !== lastSecond) {
      lastSecond = p.second;
      clockEl.textContent = p.text;
      clockEl.setAttribute('datetime', p.iso);
      if (noteEl) {
        noteEl.textContent = '东八区 UTC+8 · 参考基线 2026-09-14 22:07';
      }
    }
  };

  tick();
  window.setInterval(tick, 250);
}

/* ============================================================
   2) 打字机效果（主标题循环输出）
   ============================================================ */
function startTypewriter() {
  const el = $('#typeLine');
  if (!el) return;

  const phrases = ['ok-lzr', '码上生活', '形式追随功能', '红 · 黄 · 蓝'];

  if (prefersReduced) {
    el.textContent = phrases[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const step = () => {
    const current = phrases[phraseIndex];

    if (!deleting) {
      charIndex += 1;
      el.textContent = current.slice(0, charIndex);
      if (charIndex >= current.length) {
        deleting = true;
        window.setTimeout(step, 1500);
        return;
      }
    } else {
      charIndex -= 1;
      el.textContent = current.slice(0, charIndex);
      if (charIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }

    window.setTimeout(step, deleting ? 60 : 130);
  };

  step();
}

/* ============================================================
   3) 滚动进入动画（IntersectionObserver）
   ============================================================ */
function initReveal() {
  const targets = $$('.reveal');
  if (!targets.length) return;

  if (prefersReduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  targets.forEach((el) => observer.observe(el));
}

/* ============================================================
   4) 能力条动画 + 数字滚动（进入视口时触发一次）
   ============================================================ */
function animateNumber(el, target) {
  if (prefersReduced) {
    el.textContent = String(target);
    return;
  }

  const duration = 1200;
  const startTime = performance.now();

  const frame = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    // easeOutCubic，让收尾更稳
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
}

function initCounters() {
  const nums = $$('.stat-num[data-count]');
  const fills = $$('.skill-fill[data-level]');

  const runFills = () => {
    fills.forEach((fill) => {
      const level = Number(fill.getAttribute('data-level')) || 0;
      fill.style.width = level + '%';
    });
  };

  if (!('IntersectionObserver' in window)) {
    nums.forEach((el) => { el.textContent = el.getAttribute('data-count'); });
    runFills();
    return;
  }

  const numObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.getAttribute('data-count')) || 0;
      animateNumber(el, target);
      numObserver.unobserve(el);
    });
  }, { threshold: 0.4 });

  nums.forEach((el) => numObserver.observe(el));

  const fillObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runFills();
      fillObserver.unobserve(entry.target);
    });
  }, { threshold: 0.25 });

  const skillList = $('.skill-list');
  if (skillList) fillObserver.observe(skillList);
  else runFills();
}

/* ============================================================
   5) 作品分类筛选
   ============================================================ */
function initFilter() {
  const buttons = $$('.filter-btn');
  const cards = $$('.work-card');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');

      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      cards.forEach((card) => {
        const cat = card.getAttribute('data-cat');
        const show = filter === 'all' || cat === filter;
        card.classList.toggle('is-hidden', !show);
      });
    });
  });
}

/* ============================================================
   6) 平滑滚动 + 导航高亮 + 回到顶部显隐
   ============================================================ */
function initScrollBehavior() {
  const header = $('.site-header');
  const navLinks = $$('.nav-link');
  const toTop = $('#toTop');

  // 平滑滚动（补齐粘性头部高度）
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      const offset = header ? header.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset - 8;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: prefersReduced ? 'auto' : 'smooth'
      });
    });
  });

  // 滚动时高亮当前区块 + 控制回到顶部按钮
  const sections = $$('main section[id]');
  let ticking = false;

  const onScroll = () => {
    const y = window.pageYOffset;
    const line = y + (header ? header.getBoundingClientRect().height : 0) + 60;

    let currentId = '';
    sections.forEach((section) => {
      if (section.offsetTop <= line) currentId = section.id;
    });

    navLinks.forEach((link) => {
      const match = link.getAttribute('href') === '#' + currentId;
      link.classList.toggle('is-current', match);
      if (match) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });

    if (toTop) toTop.classList.toggle('is-visible', y > 420);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  }
}

/* ============================================================
   7) 深浅色切换（按时间给默认值，用户选择记入 localStorage）
   ============================================================ */
function initTheme() {
  const btn = $('#themeBtn');
  if (!btn) return;

  const label = $('.theme-label', btn);
  const KEY = 'bauhaus-theme';

  const apply = (night, persist) => {
    document.body.classList.toggle('theme-night', night);
    btn.setAttribute('aria-pressed', night ? 'true' : 'false');
    if (label) label.textContent = night ? '日间模式' : '夜间模式';
    if (persist) {
      try { window.localStorage.setItem(KEY, night ? 'night' : 'day'); } catch (e) { /* 隐私模式忽略 */ }
    }
  };

  // 默认：优先读存储，其次按长沙当前时间判断昼夜（19:00—06:00 视为夜间）
  let initial = null;
  try { initial = window.localStorage.getItem(KEY); } catch (e) { initial = null; }

  if (initial === 'night' || initial === 'day') {
    apply(initial === 'night', false);
  } else {
    const h = getChangshaParts().hour;
    apply(h >= 19 || h < 6, false);
  }

  btn.addEventListener('click', () => {
    apply(!document.body.classList.contains('theme-night'), true);
  });

  // 参考基线仅用于说明：2026-09-14 22:07 属于夜间档
  void CLOCK_BASE;
}

/* ============================================================
   启动
   ============================================================ */
function init() {
  startClock();
  startTypewriter();
  initReveal();
  initCounters();
  initFilter();
  initScrollBehavior();
  initTheme();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
