/* ==========================================================================
   24-monochrome · 交互脚本
   只负责行为：主题切换、平滑滚动、滚动动画、技能条、作品筛选、实时时钟
   所有样式都写在 style.css，这里只切换类名与写入 CSS 变量
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 工具：安全查询 ===== */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ===== 主题切换：在 <html> 上写 data-theme ===== */
  function initTheme() {
    var root = document.documentElement;
    var btn = $('[data-theme-toggle]');
    var saved = null;

    try {
      saved = window.localStorage.getItem('mono-theme');
    } catch (e) {
      saved = null; // 隐私模式下忽略存储
    }

    if (saved !== 'dark' && saved !== 'light') {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      saved = prefersDark ? 'dark' : 'light';
    }

    applyTheme(saved);

    if (!btn) return;

    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem('mono-theme', next);
      } catch (e) {
        /* 存储不可用则仅当前会话生效 */
      }
    });

    function applyTheme(mode) {
      root.setAttribute('data-theme', mode);
      if (btn) btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
    }
  }

  /* ===== 平滑滚动：接管页内锚点，并同步当前导航高亮 ===== */
  function initSmoothScroll() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('click', function (ev) {
      var link = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
      if (!link) return;

      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.getElementById(id.slice(1));
      if (!target) return;

      ev.preventDefault();
      target.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start'
      });
      // 让键盘与读屏焦点跟随，便于连续操作
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });

    var links = $$('.nav__link');
    var sections = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) return;

    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('is-active', on);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ===== 顶部滚动进度线 ===== */
  function initScrollProgress() {
    var bar = $('[data-progress-bar]');
    if (!bar) return;
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ===== 滚动进入动画 + 技能条 + 数字滚动 ===== */
  function initReveal() {
    var items = $$('[data-reveal]');

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) {
        el.classList.add('is-visible');
        fillSkill(el);
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        fillSkill(entry.target);
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    items.forEach(function (el) { observer.observe(el); });
  }

  // 技能条：写入宽度变量并让右侧数字递增
  function fillSkill(scope) {
    var fill = $('.skill__fill', scope);
    if (!fill || fill.dataset.done === '1') return;

    var level = parseFloat(fill.getAttribute('data-level')) || 0;
    fill.dataset.done = '1';
    fill.style.setProperty('--fill', level + '%');
    scope.classList.add('is-filled');

    countTo($('.skill__num', scope), level);
  }

  function countTo(el, target) {
    if (!el) return;
    var duration = 1200;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + '';
      if (p < 1) window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
  }

  /* ===== 作品筛选：标签页切换 ===== */
  function initWorksFilter() {
    var buttons = $$('[data-filter]');
    var works = $$('.work');
    var empty = $('[data-works-empty]');
    if (!buttons.length || !works.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-filter');
        var shown = 0;

        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        works.forEach(function (card) {
          var match = kind === 'all' || card.getAttribute('data-kind') === kind;
          card.classList.toggle('is-hidden', !match);
          if (match) shown++;
        });

        if (empty) empty.hidden = shown !== 0;
      });
    });
  }

  /* ===== 实时时钟：长沙时间（UTC+8），秒级刷新 ===== */
  function initClock() {
    var timeEl = $('[data-clock-time]');
    var dateEl = $('[data-clock-date]');
    var weekEl = $('[data-clock-week]');
    var liveEl = $('[data-clock-inline]');
    var periodEl = $('[data-period]');
    var card = $('[data-clock-card]');
    var lastPeriod = '';

    // 参考基线：查询得到 2026-09-14（星期一）22:07 UTC+8 为夜间，
    // 因此以小时区间划分昼夜，给页面一个默认的黑白基调。
    var BASE = { y: 2026, m: 9, d: 14, hh: 22, mm: 7 };

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function render() {
      // 真实当前时间，按 UTC+8 呈现长沙时间
      var now = new Date();
      var t = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);

      var hh = pad(t.getHours());
      var mm = pad(t.getMinutes());
      var ss = pad(t.getSeconds());

      if (timeEl) timeEl.textContent = hh + ':' + mm + ':' + ss;

      var dateText = t.toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      var weekText = t.toLocaleDateString('zh-CN', { weekday: 'long' });

      if (dateEl) dateEl.textContent = dateText;
      if (weekEl) weekEl.textContent = weekText;
      if (liveEl) liveEl.textContent = dateText + ' ' + hh + ':' + mm + ':' + ss + ' ' + weekText;

      // 昼夜判定：19:00 - 06:00 视为夜间
      var hour = t.getHours();
      var isNight = hour >= 19 || hour < 6;
      var period = isNight
        ? '夜间模式 · 基线 ' + BASE.y + '-' + pad(BASE.m) + '-' + pad(BASE.d) + ' ' + pad(BASE.hh) + ':' + pad(BASE.mm)
        : '日间模式 · 基线 ' + BASE.y + '-' + pad(BASE.m) + '-' + pad(BASE.d) + ' ' + pad(BASE.hh) + ':' + pad(BASE.mm);

      if (period !== lastPeriod) {
        lastPeriod = period;
        if (periodEl) periodEl.textContent = period;
        if (card) card.classList.toggle('is-night', isNight);
      }
    }

    render();
    window.setInterval(render, 1000);

    // 页面重新可见时立即校准，避免后台休眠造成的误差
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();
    initSmoothScroll();
    initScrollProgress();
    initReveal();
    initWorksFilter();
    initClock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
