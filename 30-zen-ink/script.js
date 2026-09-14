/* =========================================================
   水墨中国 · 个人主页交互
   仅负责行为：导航、主题、动画、筛选、时钟
   ========================================================= */
(function () {
  'use strict';

  /* ===== 工具函数 ===== */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  // 参考基线：2026-09-14（星期一）22:07（UTC+8）—— 来自网络查询的参考时刻
  var BASE_LOCAL = new Date(2026, 8, 14, 22, 7, 0); // 月从 0 计，8 = 9 月
  var BASE_HOUR = BASE_LOCAL.getHours(); // 22 时，用于推断昼/夜

  /* ===== 1. 导航：平滑滚动 + 当前区块高亮 ===== */
  function initSmoothNav() {
    var links = $$('.nav__link');

    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return;
        var target = document.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', id);
      });
    });

    // 滚动时同步高亮对应导航项
    var sections = links
      .map(function (l) { return document.getElementById(l.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) return;

    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle('is-current', l.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ===== 2. 昼夜墨色切换（参考基线 22:07 → 默认夜） ===== */
  function initTheme() {
    var body = document.body;
    var toggle = $('#themeToggle');
    var icon = $('.theme-toggle__icon', toggle);
    var label = $('.theme-toggle__label', toggle);
    var STORAGE_KEY = 'zen-ink-night';

    function apply(isNight, save) {
      body.classList.toggle('is-night', isNight);
      icon.textContent = isNight ? '☀' : '☾';
      label.textContent = isNight ? '昼' : '夜';
      toggle.setAttribute('aria-pressed', String(isNight));
      if (save) {
        try { localStorage.setItem(STORAGE_KEY, isNight ? '1' : '0'); } catch (err) { /* 隐私模式下忽略 */ }
      }
    }

    // 优先级：本地偏好 > 参考时刻（22 时视为夜）
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) { stored = null; }

    if (stored === '1' || stored === '0') {
      apply(stored === '1', false);
    } else {
      var isNightByBase = BASE_HOUR >= 18 || BASE_HOUR < 6;
      apply(isNightByBase, false);
    }

    toggle.addEventListener('click', function () {
      apply(!body.classList.contains('is-night'), true);
    });
  }

  /* ===== 3. 滚动进入动画（IntersectionObserver） ===== */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ===== 4. 技能条与数字滚动动画 ===== */
  function initCounters() {
    var counters = $$('[data-count]');
    var bars = $$('.skill__fill');
    if (!counters.length && !bars.length) return;

    function animateNumber(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var duration = 1400;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('zh-CN');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function activate(el) {
      if (el.dataset.animated === '1') return;
      el.dataset.animated = '1';
      if (el.hasAttribute('data-count')) {
        animateNumber(el);
      } else {
        var level = parseInt(el.getAttribute('data-level'), 10) || 0;
        el.style.width = level + '%';
      }
    }

    if (!('IntersectionObserver' in window)) {
      counters.concat(bars).forEach(activate);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        activate(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.3 });

    counters.concat(bars).forEach(function (el) { observer.observe(el); });
  }

  /* ===== 5. 作品筛选（标签页式按钮） ===== */
  function initFilter() {
    var buttons = $$('.filter__btn');
    var cards = $$('#worksList .card');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-filter');

        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', String(active));
        });

        cards.forEach(function (card) {
          var show = key === 'all' || card.getAttribute('data-cat') === key;
          card.classList.toggle('is-hidden', !show);
        });
      });
    });
  }

  /* ===== 6. 长沙时间实时时钟（UTC+8） ===== */
  function initClock() {
    var timeEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var periodEl = $('#clockPeriod');
    if (!timeEl || !dateEl) return;

    var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    // 取 UTC+8 的长沙本地时间，不依赖访问者所在时区
    function changshaNow() {
      var d = new Date();
      var utc8 = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + 8 * 3600000);
      return utc8;
    }

    function render() {
      var d = changshaNow();
      var h = d.getHours();

      timeEl.textContent = pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      dateEl.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];

      // 昼 / 夜 提示：6:00–17:59 为昼，其余为夜
      var isDay = h >= 6 && h < 18;
      periodEl.textContent = isDay ? '昼' : '夜';
      periodEl.classList.toggle('is-night', !isDay);
    }

    render();
    setInterval(render, 1000);
  }

  /* ===== 7. 回到顶部按钮 ===== */
  function initToTop() {
    var btn = $('#toTop');
    if (!btn) return;

    function onScroll() {
      btn.classList.toggle('is-visible', window.scrollY > 480);
    }

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ===== 8. 标题打字机效果 ===== */
  function initTypewriter() {
    var el = $('#typedLine');
    if (!el) return;

    var text = el.textContent.trim();
    var caret = document.createElement('span');
    caret.className = 'caret';
    el.textContent = '';
    el.appendChild(caret);

    var i = 0;
    function type() {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text.charAt(i)), caret);
        i += 1;
        setTimeout(type, 55);
      }
    }
    setTimeout(type, 400);
  }

  /* ===== 9. 鼠标跟随墨点（桌面端，样式在 CSS，JS 只切类与坐标） ===== */
  function initInkCursor() {
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var dot = document.createElement('div');
    dot.className = 'ink-cursor';
    document.body.appendChild(dot);

    var x = 0, y = 0, cx = 0, cy = 0;

    window.addEventListener('mousemove', function (e) {
      x = e.clientX;
      y = e.clientY;
      dot.classList.add('is-on');
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', function () {
      dot.classList.remove('is-on');
    });

    // 缓动跟随：仅写入 translate 坐标
    (function loop() {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      requestAnimationFrame(loop);
    })();
  }

  /* ===== 启动 ===== */
  function init() {
    initSmoothNav();
    initTheme();
    initReveal();
    initCounters();
    initFilter();
    initClock();
    initToTop();
    initTypewriter();
    initInkCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
