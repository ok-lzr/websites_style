/* ==========================================================================
   44-sidebar-vertical / script.js
   1. 工具函数        2. 打字机       3. 长沙实时时钟
   4. 滚动进入动画    5. 导航高亮     6. 作品筛选
   7. 技能条动画      8. 深浅色主题   9. 回到顶部
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 1. 工具函数 ===== */
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var two = function (n) { return n < 10 ? '0' + n : String(n); };

  /* 当天基线参考时刻：2026-09-14 22:07（UTC+8），来自网络查询。
     仅用于判断"昼夜主题"，实时时钟本身一律使用 new Date()。 */
  var REFERENCE = new Date('2026-09-14T22:07:00+08:00');
  var REF_HOUR = REFERENCE.getHours();

  /* 系统是否要求减少动效 */
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 2. 打字机效果（首屏一句话） ===== */
  function initTypewriter() {
    var el = $('#typeLine');
    if (!el) { return; }
    var full = el.getAttribute('data-text') || el.textContent || '';
    if (reduceMotion) { el.textContent = full; el.classList.add('is-done'); return; }

    el.textContent = '';
    var i = 0;
    var timer = window.setInterval(function () {
      el.textContent = full.slice(0, ++i);
      if (i >= full.length) {
        window.clearInterval(timer);
        el.classList.add('is-done');
      }
    }, 70);
  }

  /* ===== 3. 长沙实时时钟（年月日 + 时:分:秒 + 星期，zh-CN） ===== */
  var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function phaseOf(hour) {
    if (hour >= 6 && hour < 12) { return '清晨'; }
    if (hour >= 12 && hour < 18) { return '白天'; }
    if (hour >= 18 && hour < 23) { return '夜间'; }
    return '深夜';
  }

  function renderClock() {
    var now = new Date();
    var y = now.getFullYear();
    var m = two(now.getMonth() + 1);
    var d = two(now.getDate());
    var h = two(now.getHours());
    var mi = two(now.getMinutes());
    var s = two(now.getSeconds());
    var week = WEEK_CN[now.getDay()];

    var timeStr = h + ':' + mi + ':' + s;
    var dateStr = y + '年' + m + '月' + d + '日 ' + week;

    var timeEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var phaseEl = $('#clockPhase');
    var clockBox = $('#clock');

    if (timeEl) { timeEl.textContent = timeStr; }
    if (dateEl) { dateEl.textContent = dateStr; }

    /* 昼夜判断用当前真实小时；若整点未变则沿用参考时刻的初值做兜底 */
    var hour = now.getHours();
    var phase = phaseOf(hour);
    if (phaseEl) { phaseEl.textContent = phase; }
    if (clockBox) {
      var isNight = hour >= 19 || hour < 6;
      /* 与参考时刻（2026-09-14 22:07）同处 22 点这一小时，仍按夜间基线呈现 */
      if (hour === REF_HOUR) { isNight = true; }
      clockBox.classList.toggle('is-night', isNight);
      clockBox.setAttribute('data-phase', isNight ? 'night' : 'day');
    }

    /* 个人数据区里的时间同步显示 */
    var mini = $('#dataClock');
    if (mini) { mini.textContent = dateStr + ' ' + timeStr; }
  }

  function initClock() {
    renderClock();
    window.setInterval(renderClock, 1000);
  }

  /* ===== 4. 滚动进入动画（IntersectionObserver） ===== */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) { return; }

    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ===== 5. 侧栏导航高亮（滚动位置 -> 竖排导航） ===== */
  function initNavSpy() {
    var links = $$('.vnav__link');
    var sections = links.map(function (a) {
      return document.getElementById(a.getAttribute('data-nav'));
    });
    if (!links.length) { return; }

    function sync() {
      var probe = window.scrollY + window.innerHeight * 0.32;
      var current = 0;
      sections.forEach(function (sec, i) {
        if (sec && sec.offsetTop <= probe) { current = i; }
      });
      links.forEach(function (a, i) {
        a.classList.toggle('is-active', i === current);
      });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () { sync(); ticking = false; });
    }, { passive: true });

    window.addEventListener('resize', sync);
    sync();
  }

  /* ===== 6. 作品筛选（按分类） ===== */
  function initFilter() {
    var group = $('#workFilter');
    var list = $('#workList');
    if (!group || !list) { return; }

    var chips = $$('.chip', group);
    var works = $$('.work', list);
    var empty = $('#worksEmpty');

    group.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.chip') : null;
      if (!btn) { return; }

      var key = btn.getAttribute('data-filter');
      chips.forEach(function (c) { c.classList.toggle('is-on', c === btn); });

      var shown = 0;
      works.forEach(function (w) {
        var match = key === 'all' || w.getAttribute('data-cat') === key;
        w.classList.toggle('is-hidden', !match);
        if (match) { shown++; }
      });

      if (empty) { empty.hidden = shown !== 0; }
    });
  }

  /* ===== 7. 技能条：进入视口后增长 + 数字滚动 ===== */
  function initBars() {
    var bars = $$('.bar');
    if (!bars.length) { return; }

    function play(bar) {
      var fill = $('.bar__fill', bar);
      var val = $('.bar__val', bar);
      var target = parseInt((val && val.getAttribute('data-val')) || '0', 10);

      if (fill) { fill.style.width = ((fill.getAttribute('data-w') || target) + '%'); }
      if (!val) { return; }

      if (reduceMotion) { val.textContent = target + '%'; return; }

      var start = null;
      var DUR = 1100;
      function step(ts) {
        if (start === null) { start = ts; }
        var p = Math.min((ts - start) / DUR, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        val.textContent = Math.round(target * eased) + '%';
        if (p < 1) { window.requestAnimationFrame(step); }
      }
      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      bars.forEach(play);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          play(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    bars.forEach(function (b) { io.observe(b); });
  }

  /* ===== 8. 深浅色主题切换（记忆到 localStorage） ===== */
  var THEME_KEY = 'oklzr-sidebar-theme';

  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

    var btn = $('#themeToggle');
    var icon = $('#themeIcon');
    var txt = btn ? $('.themeBtn__txt', btn) : null;
    if (btn) { btn.setAttribute('aria-pressed', dark ? 'true' : 'false'); }
    if (icon) { icon.textContent = dark ? '☀' : '☾'; }
    if (txt) { txt.textContent = dark ? '日间' : '夜间'; }
  }

  function initTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }

    var prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    /* 首次访问：默认跟随系统；参考时刻 22:07 属夜间，兜底为深色 */
    var initial = saved || ((prefersDark || phaseOf(REF_HOUR) === '夜间') ? 'dark' : 'light');
    applyTheme(initial);

    var btn = $('#themeToggle');
    if (!btn) { return; }
    btn.addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      var next = now === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch (e) { /* 忽略隐私模式报错 */ }
    });
  }

  /* ===== 9. 回到顶部按钮 + 平滑锚点兜底 ===== */
  function initToTop() {
    var btn = $('#toTop');
    if (btn) {
      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });

      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) { return; }
        ticking = true;
        window.requestAnimationFrame(function () {
          btn.hidden = window.scrollY < 420;
          ticking = false;
        });
      }, { passive: true });
    }

    /* 锚点平滑滚动：不依赖 CSS scroll-behavior，兼容旧浏览器 */
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var id = a.getAttribute('href').slice(1);
        if (!id) { return; }
        var target = document.getElementById(id);
        if (!target) { return; }
        ev.preventDefault();
        var top = id === 'top' ? 0 : target.offsetTop;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        history.replaceState(null, '', '#' + id);
      });
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();       /* 主题先应用，避免闪烁 */
    initTypewriter();
    initClock();
    initReveal();
    initNavSpy();
    initFilter();
    initBars();
    initToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
