/* =========================================================
   20-synthwave / script.js
   负责：长沙实时时钟、昼夜主题切换、打字机、滚动进场动画、
        技能条动画、滚动进度条、首屏视差
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 0. 工具 ---------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* 2 位补零 */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------- 1. 长沙时间（UTC+8 实时时钟） ----------
     页面基线：2026-09-14 22:07（UTC+8），来源为网络查询的参考时刻。
     时钟依旧用 new Date() 实时走时：以基线为锚点、以系统时钟为增量，
     这样在 2026-09-14 当天打开时看到的就是 22:07 起的真实推进。       */
  var BASELINE_EPOCH = Date.UTC(2026, 8, 14, 14, 7, 0); // 2026-09-14 22:07（UTC+8）
  var LOAD_EPOCH = Date.now();
  var CN_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  var clockDateEl = $('#clock-date');
  var clockTimeEl = $('#clock-time');
  var clockWeekdayEl = $('#clock-weekday');
  var clockZoneEl = $('#clock-zone');

  /* 返回当前"长沙时间"拆解后的各字段（日期已按 UTC+8 换算） */
  function cnParts() {
    var shifted = new Date(BASELINE_EPOCH + (Date.now() - LOAD_EPOCH) + 8 * 3600 * 1000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hours: shifted.getUTCHours(),
      minutes: shifted.getUTCMinutes(),
      seconds: shifted.getUTCSeconds(),
      weekday: shifted.getUTCDay()
    };
  }

  /* 数字滚动：让时/分/秒换值时有一段"咔哒"上浮，而不是硬跳 */
  function rollNumber(el, text) {
    if (!el || el.textContent === text) { return; }
    el.textContent = text;
    if (reduceMotion) { return; }
    el.classList.remove('is-rolling');
    void el.offsetWidth; // 强制重排，使动画可以重复播放
    el.classList.add('is-rolling');
  }

  /* 用一次采样同时刷新时钟文本与昼夜主题标记 */
  function renderClock() {
    var t = cnParts();

    if (clockDateEl) {
      clockDateEl.textContent = t.year + ' 年 ' + pad2(t.month) + ' 月 ' + pad2(t.day) + ' 日';
    }
    rollNumber(clockTimeEl, pad2(t.hours) + ':' + pad2(t.minutes) + ':' + pad2(t.seconds));
    if (clockWeekdayEl) {
      clockWeekdayEl.textContent = CN_WEEKDAYS[t.weekday];
    }
    if (clockZoneEl) {
      clockZoneEl.textContent = isDaytime(t.hours) ? '白昼信号' : '夜场模式';
    }
    return t;
  }

  /* UTC+8 的 06:00 - 17:59 视作白昼 */
  function isDaytime(hours) {
    return hours >= 6 && hours < 18;
  }

  /* ---------- 2. 昼夜主题切换 ---------- */
  var themeToggle = $('#theme-toggle');
  var themeIcon = $('#theme-icon');
  var themeText = $('#theme-text');

  function applyTheme(isDay) {
    document.body.classList.toggle('is-day', isDay);
    if (themeIcon) { themeIcon.textContent = isDay ? '☀' : '☾'; }
    if (themeText) { themeText.textContent = isDay ? '白昼亮色' : '夜间霓虹'; }
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', isDay ? 'true' : 'false'); }
  }

  /* 首次进入时用当前（长沙）小时决定夜/昼 */
  var bootTime = renderClock();
  applyTheme(isDaytime(bootTime.hours));

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(!document.body.classList.contains('is-day'));
    });
  }

  /* 时钟每秒推进一次；页脚年份跟着时间走 */
  var yearEl = $('#year');

  function syncYear(y) {
    if (yearEl && yearEl.textContent !== String(y)) { yearEl.textContent = String(y); }
  }

  syncYear(bootTime.year);

  window.setInterval(function () {
    syncYear(renderClock().year);
  }, 1000);

  /* ---------- 3. 首屏打字机（一句简介循环出现） ---------- */
  var typedEl = $('#typed');
  var LINES = [
    '用代码把城市、数据与夜晚连成一条霓虹带。',
    '把重复劳动交出去，把有趣的部分留下来。',
    '像素级在意细节，霓虹级在意手感。'
  ];

  if (typedEl) {
    if (reduceMotion) {
      typedEl.textContent = LINES[0];
    } else {
      var lineIndex = 0;
      var charIndex = 0;
      var deleting = false;

      var typeStep = function () {
        var line = LINES[lineIndex];
        if (deleting) {
          charIndex -= 1;
        } else {
          charIndex += 1;
        }
        typedEl.textContent = line.slice(0, charIndex);

        var delay = deleting ? 32 : 72;
        if (!deleting && charIndex === line.length) {
          deleting = true;
          delay = 1900; // 整句停留
        } else if (deleting && charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % LINES.length;
          delay = 420;
        }
        window.setTimeout(typeStep, delay);
      };

      window.setTimeout(typeStep, 600);
    }
  }

  /* ---------- 4. 滚动进场动画 + 技能条 ---------- */
  var revealEls = $$('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        // 依次亮起（同组元素的错峰延迟交给 CSS 的 nth-child 处理）
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  var skillEls = $$('.skill');

  /* 把技能条从 0 推到 data-level 指定的百分比 */
  function fillSkill(el) {
    var level = Number(el.dataset.level || 0);
    var bar = el.querySelector('.skill__bar');
    if (bar) { bar.style.width = Math.max(0, Math.min(100, level)) + '%'; }
  }

  if ('IntersectionObserver' in window) {
    var skillObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        fillSkill(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.45 });

    skillEls.forEach(function (el) { skillObserver.observe(el); });
  } else {
    skillEls.forEach(fillSkill);
  }

  /* ---------- 5. 滚动进度条 + 导航高亮 + 首屏视差 ---------- */
  var progressEl = $('#progress');
  var navLinks = $$('.nav__link');
  var sectionEls = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);
  var heroSun = $('#hero-sun');
  var heroGrid = $('#hero-grid');
  var ticking = false;

  function setActiveLink() {
    var probe = window.scrollY + window.innerHeight * 0.3;
    var current = null;

    sectionEls.forEach(function (section) {
      if (section.offsetTop <= probe) { current = section; }
    });

    navLinks.forEach(function (link) {
      var id = link.getAttribute('href');
      link.classList.toggle('is-active', !!current && id === '#' + current.id);
    });
  }

  function updateOnScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? window.scrollY / max : 0;
    if (progressEl) { progressEl.style.width = (ratio * 100).toFixed(2) + '%'; }

    // 首屏元素轻微下移，制造纵深
    if (!reduceMotion && window.scrollY < window.innerHeight * 1.3) {
      var offset = window.scrollY;
      if (heroSun) { heroSun.style.transform = 'translateX(-50%) translateY(' + (offset * 0.12).toFixed(1) + 'px)'; }
      if (heroGrid) { heroGrid.style.transform = 'perspective(360px) rotateX(66deg) translateY(' + (-offset * 0.18).toFixed(1) + 'px)'; }
    }

    setActiveLink();
  }

  function onScroll() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () {
      updateOnScroll();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* 导航点击：平滑滚动交给 CSS，这里只负责立刻高亮并同步地址栏 */
  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      var target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      if (!target) { return; }

      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', id);
      }
      navLinks.forEach(function (other) { other.classList.remove('is-active'); });
      link.classList.add('is-active');
      updateOnScroll();
    });
  });

  /* 首次渲染时同步一次进度条与高亮 */
  updateOnScroll();
}());
