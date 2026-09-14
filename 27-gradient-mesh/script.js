/* =========================================================================
   27-gradient-mesh · script.js
   行为集中在此文件：昼夜主题、长沙实时时钟、打字机、滚动进入动画、
   进度条与数字滚动、作品筛选、导航高亮与折叠、鼠标跟随光晕。
   所有监听都在这里用 addEventListener 绑定，HTML 中不写内联事件。
   ========================================================================= */

(function () {
  'use strict';

  /* ===== 0. 小工具 ===== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 1. 参考基线时刻（来自网络查询）=====
     2026-09-14（星期一）22:07（UTC+8）用于昼夜主题判断；
     时钟本身始终用 new Date() 实时刷新。 */
  var REFERENCE_TIME = new Date('2026-09-14T22:07:00+08:00');
  var REFERENCE_TEXT = '2026-09-14 22:07 (UTC+8)';
  var CST_ZONE = 'Asia/Shanghai';

  // 用 Intl 把任意时间换算到东八区，避免依赖本机时区
  var cstFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CST_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long'
  });

  function cstParts(date) {
    var out = {};
    cstFormatter.formatToParts(date).forEach(function (part) {
      if (part.type !== 'literal') { out[part.type] = part.value; }
    });
    return out;
  }

  /* ===== 2. 昼夜主题：由参考基线的东八区小时数决定 ===== */
  var themeIcon = $('#themeIcon');
  var themeText = $('#themeText');
  var themeToggle = $('#themeToggle');
  var themeNote = $('#clockTheme');
  var themeName = { night: '夜间模式', day: '日间模式' };

  function themeFromHour(hour) {
    return (hour >= 19 || hour < 6) ? 'night' : 'day';
  }

  function applyTheme(theme, manual) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = 'theme-' + theme;

    var isNight = theme === 'night';
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', String(isNight)); }
    if (themeIcon) { themeIcon.textContent = isNight ? '🌙' : '☀️'; }
    if (themeText) { themeText.textContent = isNight ? '夜间' : '日间'; }
    if (themeNote) {
      themeNote.textContent = manual
        ? '已手动切换为' + themeName[theme]
        : '按参考基线 ' + REFERENCE_TEXT + ' 判定为' + themeName[theme];
    }
  }

  // 初始主题：取参考时刻的长沙小时（22 点 → 夜间）
  var referenceHour = parseInt(cstParts(REFERENCE_TIME).hour, 10);
  var referenceTheme = themeFromHour(referenceHour);
  applyTheme(referenceTheme, false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      applyTheme(now === 'night' ? 'day' : 'night', true);
    });
  }

  /* ===== 3. 长沙实时时钟 ===== */
  var clockTimeEl = $('#clockTime');
  var clockDateEl = $('#clockDate');
  var clockToggle = $('#clockToggle');
  var clockBaseEl = $('#clockBase');
  var use12Hour = false;

  if (clockBaseEl) { clockBaseEl.textContent = REFERENCE_TEXT; }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderClock() {
    var now = new Date();               // 实时取当前时间
    var p = cstParts(now);              // 换算为长沙（东八区）时间
    var hour = parseInt(p.hour, 10);
    var suffix = '';

    if (use12Hour) {
      suffix = hour < 12 ? ' AM' : ' PM';
      hour = hour % 12 || 12;
    }

    if (clockTimeEl) {
      clockTimeEl.textContent = pad2(hour) + ':' + p.minute + ':' + p.second + suffix;
    }
    if (clockDateEl) {
      // 中文日期：2026年9月14日 星期一
      clockDateEl.textContent =
        parseInt(p.year, 10) + '年' + parseInt(p.month, 10) + '月' + parseInt(p.day, 10) + '日 ' + p.weekday;
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  if (clockToggle) {
    clockToggle.addEventListener('click', function () {
      use12Hour = !use12Hour;
      clockToggle.setAttribute('aria-pressed', String(use12Hour));
      clockToggle.textContent = use12Hour ? '切换 24 小时制' : '切换 12 小时制';
      renderClock();
    });
  }

  /* ===== 4. 打字机：把一句话简介逐字打出来 ===== */
  var typewriter = $('#typewriter');
  if (typewriter) {
    var introText = typewriter.getAttribute('data-typing') || typewriter.textContent;
    if (prefersReduced) {
      typewriter.textContent = introText;
    } else {
      typewriter.textContent = '';
      var idx = 0;
      (function typeNext() {
        if (idx <= introText.length) {
          typewriter.textContent = introText.slice(0, idx);
          idx += 1;
          window.setTimeout(typeNext, 55 + Math.random() * 55);
        }
      })();
    }
  }

  /* ===== 5. 滚动进入动画（IntersectionObserver）===== */
  var revealItems = $$('.reveal');
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (el, i) {
      // 同一批元素之间做一点错峰，动效更自然
      el.style.setProperty('--reveal-delay', (i % 4) * 90 + 'ms');
      revealObserver.observe(el);
    });
  }

  /* ===== 6. 能力进度条：进入视口后展开到 data-fill ===== */
  var bars = $$('.bar__fill');
  function fillBar(el) {
    el.style.setProperty('--fill', (el.getAttribute('data-fill') || 0) + '%');
    el.classList.add('is-filled');
  }
  if (prefersReduced || !('IntersectionObserver' in window)) {
    bars.forEach(fillBar);
  } else {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        fillBar(entry.target);
        barObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    bars.forEach(function (el) { barObserver.observe(el); });
  }

  /* ===== 7. 数字滚动：概览区的计数动画 ===== */
  var nums = $$('.stat__num');
  function runCount(el) {
    var target = parseInt(el.getAttribute('data-count') || '0', 10);
    var suffix = el.getAttribute('data-suffix') || '';
    if (prefersReduced || target === 0) {
      el.textContent = target + suffix;
      return;
    }
    var start = null;
    var duration = 1200;
    function step(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) { window.requestAnimationFrame(step); }
    }
    window.requestAnimationFrame(step);
  }
  if (!('IntersectionObserver' in window)) {
    nums.forEach(runCount);
  } else {
    var numObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        runCount(entry.target);
        numObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { numObserver.observe(el); });
  }

  /* ===== 8. 作品筛选：按分类显示 / 隐藏卡片 ===== */
  var filterBar = $('#filterBar');
  var workGrid = $('#workGrid');
  var emptyTip = $('#filterEmpty');

  if (filterBar && workGrid) {
    var filterBtns = $$('.filter__btn', filterBar);
    var works = $$('.work', workGrid);

    filterBar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter__btn');
      if (!btn) { return; }

      var cat = btn.getAttribute('data-filter');
      var visible = 0;

      filterBtns.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });

      works.forEach(function (card) {
        var match = (cat === 'all' || card.getAttribute('data-cat') === cat);
        card.classList.toggle('is-hidden', !match);
        if (match) { visible += 1; }
      });

      if (emptyTip) { emptyTip.hidden = visible > 0; }
    });
  }

  /* ===== 9. 导航：滚动高亮（scrollspy）+ 手机端折叠 ===== */
  var navToggle = $('#navToggle');
  var navList = $('#navList');
  var navLinks = $$('.nav__link');

  function closeNav() {
    if (!navList) { return; }
    navList.classList.remove('is-open');
    if (navToggle) { navToggle.setAttribute('aria-expanded', 'false'); }
  }

  if (navToggle && navList) {
    navToggle.addEventListener('click', function () {
      var open = navList.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.forEach(function (link) { link.addEventListener('click', closeNav); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeNav(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) { closeNav(); }
    });
  }

  var sections = $$('main section[id]');
  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var id = entry.target.getAttribute('id');
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (section) { spyObserver.observe(section); });
  }

  /* ===== 10. 顶栏：滚动后加深背景 ===== */
  var header = $('#siteHeader');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ===== 11. 鼠标跟随光晕（指针设备才启用）===== */
  var glow = $('.cursor-glow');
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  if (glow && finePointer && !prefersReduced) {
    var pending = null;
    var applyGlow = function () {
      pending = null;
      document.documentElement.style.setProperty('--mx', glowX + 'px');
      document.documentElement.style.setProperty('--my', glowY + 'px');
    };
    var glowX = 0;
    var glowY = 0;

    window.addEventListener('pointermove', function (event) {
      glowX = event.clientX;
      glowY = event.clientY;
      glow.classList.add('is-active');
      if (pending === null) { pending = window.requestAnimationFrame(applyGlow); }
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      glow.classList.remove('is-active');
    });
  }
})();
