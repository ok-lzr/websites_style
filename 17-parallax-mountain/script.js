/* ==========================================================================
   17-parallax-mountain · script.js
   职责：视差驱动（滚动 + 鼠标）、昼夜主题、长沙实时时钟、作品筛选、
        滚动进入动画、技能条、数字滚动、打字机、滚动进度与导航高亮。
   所有交互均通过 addEventListener 绑定，样式细节全部留在 style.css。
   ========================================================================== */
'use strict';

(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 工具函数 ===== */
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const pick = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, '0');

  /* 参考基线：来自网络查询的「当天」时刻 —— 2026-09-14（周一）22:07 UTC+8。
     仅用于昼夜主题的初始判断与偏差提示；时钟始终取 new Date() 实时值。 */
  const BASELINE = { y: 2026, m: 8, d: 14, hh: 22, mm: 7 };
  const BASELINE_LABEL = '2026-09-14 22:07';

  /* 长沙固定为 UTC+8：用 getTime 减去时区偏移差，保证任何设备上都是长沙时间 */
  function changshaNow() {
    const now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 8 * 3600000);
  }

  /* ===== 1. 视差：滚动位移写入 --scroll-y，鼠标位置写入 --mx / --my ===== */
  const scene = {
    lastScroll: 0,
    ticking: false
  };

  function applyScrollVar() {
    root.style.setProperty('--scroll-y', scene.lastScroll.toFixed(1) + 'px');
    scene.ticking = false;
  }

  function onScroll() {
    scene.lastScroll = window.scrollY || window.pageYOffset || 0;
    if (!scene.ticking) {
      scene.ticking = true;
      window.requestAnimationFrame(applyScrollVar);
    }
    updateProgress(scene.lastScroll);
    updateNavHighlight(scene.lastScroll);
  }

  if (!reduceMotion) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', function (event) {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      root.style.setProperty('--mx', clamp(nx, -1, 1).toFixed(3));
      root.style.setProperty('--my', clamp(ny, -1, 1).toFixed(3));
    }, { passive: true });
  }

  /* ===== 2. 滚动进度条 ===== */
  const progressBar = pick('scroll-progress-bar');
  function updateProgress(y) {
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? clamp(y / max, 0, 1) : 0;
    progressBar.style.width = (ratio * 100).toFixed(2) + '%';
  }

  /* ===== 3. 平滑滚动导航（含 fixed 导航高度补偿） ===== */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      const nav = document.querySelector('.nav');
      const offset = nav ? nav.getBoundingClientRect().height + 24 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ===== 4. 滚动进入动画（IntersectionObserver） ===== */
  const revealTargets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible', 'is-fallback'); });
  }

  /* ===== 5. 技能条 + 数字滚动 ===== */
  const skills = document.querySelectorAll('.skill');

  function fillSkill(skill) {
    const level = clamp(Number(skill.dataset.level) || 0, 0, 100);
    const fill = skill.querySelector('.skill__fill');
    const pct = skill.querySelector('.skill__pct');
    if (fill) fill.style.width = level + '%';
    if (!pct) return;
    // 数字与进度条同步上升，做出「读数」的感觉
    const duration = reduceMotion ? 0 : 1100;
    const start = performance.now();
    (function step(now) {
      const t = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
      pct.textContent = Math.round(level * (1 - Math.pow(1 - t, 3))) + '%';
      if (t < 1) window.requestAnimationFrame(step);
    })(start);
  }

  if ('IntersectionObserver' in window) {
    const skillObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        fillSkill(entry.target);
        skillObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    skills.forEach(function (el) { skillObserver.observe(el); });
  } else {
    skills.forEach(fillSkill);
  }

  /* ===== 6. 概览数字滚动 ===== */
  const counters = document.querySelectorAll('.stat__num');

  function countUp(el) {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = reduceMotion ? 0 : 1400;
    const start = performance.now();
    (function step(now) {
      const t = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) window.requestAnimationFrame(step);
    })(start);
  }

  if ('IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObserver.observe(el); });
  } else {
    counters.forEach(countUp);
  }

  /* ===== 7. 作品筛选（标签页行动） ===== */
  const filterButtons = document.querySelectorAll('.filter');
  const workItems = document.querySelectorAll('.work');

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const cat = button.dataset.filter;
      filterButtons.forEach(function (other) {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      workItems.forEach(function (item) {
        const show = cat === 'all' || item.dataset.cat === cat;
        item.classList.toggle('is-hidden', !show);
      });
    });
  });

  /* ===== 8. 昼夜主题：按长沙时间判断，也可手动切换 ===== */
  const themeToggle = pick('theme-toggle');
  const phaseLabel = pick('clock-phase');
  const clockBox = pick('clock');
  const heroHint = pick('hero-hint');

  function isBaselineDay() {
    const now = changshaNow();
    const sameDay = now.getFullYear() === BASELINE.y
      && now.getMonth() === BASELINE.m
      && now.getDate() === BASELINE.d;
    if (!sameDay) return now.getHours() >= 6 && now.getHours() < 19;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes < BASELINE.hh * 60 + BASELINE.mm;   // 早于基线时刻 → 白昼
  }

  function setTheme(theme, manual) {
    root.setAttribute('data-theme', theme);
    const isNight = theme === 'night';
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(manual === true));
      const icon = themeToggle.querySelector('.theme-toggle__icon');
      const text = themeToggle.querySelector('.theme-toggle__text');
      if (icon) icon.textContent = isNight ? '☾' : '☀';
      if (text) text.textContent = isNight ? '切到白天' : '切到夜晚';
    }
    if (phaseLabel) phaseLabel.textContent = isNight ? '夜' : '昼';
    if (clockBox) clockBox.dataset.phase = theme;
    if (heroHint) heroHint.textContent = isNight ? '向下滚动，山会慢慢让开 ↓' : '日头正高，山下有雾 ↓';
  }

  let manualTheme = false;
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      manualTheme = true;
      setTheme(root.getAttribute('data-theme') === 'night' ? 'day' : 'night', true);
    });
  }
  setTheme(isBaselineDay() ? 'day' : 'night', false);
  // 每 5 分钟重新校准一次自动主题（未手动切换时）
  window.setInterval(function () {
    if (!manualTheme) setTheme(isBaselineDay() ? 'day' : 'night', false);
  }, 300000);

  /* ===== 9. 长沙实时时钟（年月日 / 时:分:秒 / 星期，zh-CN） ===== */
  const dateEl = pick('clock-date');
  const timeEl = pick('clock-time');
  const echoEl = pick('clock-echo');
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  function renderClock() {
    const now = changshaNow();
    const dateText = dateFmt.format(now);
    const timeText = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    if (dateEl) {
      dateEl.setAttribute('datetime', now.toISOString().slice(0, 10));
      dateEl.textContent = dateText;
    }
    if (timeEl) timeEl.textContent = timeText;
    if (echoEl) echoEl.textContent = dateText + ' ' + timeText;
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ===== 10. 打字机：循环展示当前在做的事 ===== */
  const typedEl = pick('typed');
  const phrases = [
    '把日出做成 CSS 渐变',
    '给远山加第四层视差',
    '调长沙天气看板的图表',
    '整理今天的代码片段'
  ];

  if (typedEl) {
    if (reduceMotion) {
      typedEl.textContent = phrases[0];
    } else {
      let phraseIndex = 0;
      let charIndex = 0;
      let deleting = false;
      (function tick() {
        const phrase = phrases[phraseIndex];
        charIndex += deleting ? -1 : 1;
        typedEl.textContent = phrase.slice(0, charIndex);
        let delay = deleting ? 45 : 105;
        if (!deleting && charIndex === phrase.length) {
          deleting = true;
          delay = 1600;                       // 打完停一下
        } else if (deleting && charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          delay = 320;
        }
        window.setTimeout(tick, delay);
      })();
    }
  }

  /* ===== 11. 导航高亮：滚动到哪个区块就点亮哪个链接 ===== */
  const sections = Array.prototype.slice.call(document.querySelectorAll('main .section'));
  const navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));

  function updateNavHighlight(y) {
    if (!sections.length || !navLinks.length) return;
    const probe = y + window.innerHeight * 0.32;
    let currentId = '';
    sections.forEach(function (section) {
      if (section.offsetTop <= probe) currentId = section.id;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('is-current', link.getAttribute('href') === '#' + currentId);
    });
  }

  /* ===== 12. 初始化一次，保证首屏进度条与高亮状态正确 ===== */
  onScroll();
  window.addEventListener('resize', function () {
    onScroll();
  }, { passive: true });

  // 供控制台核对基线参考时刻（不影响页面显示）
  window.__mountainBaseline = BASELINE_LABEL;
})();
