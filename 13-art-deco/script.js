/* =========================================================
   13-art-deco · 交互脚本
   纯原生 JavaScript，无任何外部依赖
   职责：时钟 / 打字机 / 主题切换 / 滚动动效 / 技能条 / 筛选 / 数字滚动
   ========================================================= */

(function () {
  'use strict';

  /* ===== 参考基线时刻：来自网络查询的当天基线时间 =====
     2026-09-14（星期一）22:07（UTC+8）。
     仅用于「夜 / 昼」判定基准：现实现取 new Date() 实时计算。 */
  var BASELINE = {
    year: 2026,
    month: 9,          // 1-12
    day: 14,
    weekday: '星期一',
    hour: 22,
    minute: 7,
    utcOffset: 8
  };

  /* ===== 小工具 ===== */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  // 读取本地存储（隐私模式下可能抛错，做静默降级）
  function readStore(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* 忽略：不影响页面功能 */
    }
  }

  // 取 UTC+8（长沙）的日期时间分量，避免受访问者本机时区影响
  function changshaParts(date) {
    var offsetMs = BASELINE.utcOffset * 60 * 60 * 1000;
    var shifted = new Date(date.getTime() + offsetMs);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      weekday: shifted.getUTCDay(),        // 0 = 周日
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds()
    };
  }

  function pad2(num) {
    return num < 10 ? '0' + num : String(num);
  }

  /* ===== 1. 实时时钟：长沙时间（年月日 + 时:分:秒 + 星期） ===== */
  function initClock() {
    var timeEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var phaseEl = $('#clockPhase');
    var inlineEl = $('#clockInline');
    if (!timeEl && !inlineEl) { return; }

    var baselineMinutes = BASELINE.hour * 60 + BASELINE.minute;

    function render() {
      var now = new Date();                 // 实时取当前时间（不受固定基线影响）
      var p = changshaParts(now);

      // 使用 zh-CN 本地化输出，并显式指定长沙所属时区 UTC+8
      var timeText = now.toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      var dateText = now.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });

      if (timeEl) { timeEl.textContent = timeText; }
      if (dateEl) { dateEl.textContent = dateText; }
      if (inlineEl) { inlineEl.textContent = timeText; }

      // 夜 / 昼提示：以基线（22:07 夜）为参照，22:00 后或 06:30 前记为夜之厅
      if (phaseEl) {
        var minutes = p.hour * 60 + p.minute;
        var isNight = minutes >= 22 * 60 || minutes < 6 * 60 + 30;
        phaseEl.textContent = isNight
          ? '夜之厅 · NIGHT · 基线 ' + pad2(BASELINE.hour) + ':' + pad2(BASELINE.minute)
          : '白昼厅 · DAY · 基线 ' + pad2(Math.floor(baselineMinutes / 60)) + ':' + pad2(baselineMinutes % 60);
      }
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 2. 打字机效果：姓名逐字出现 ===== */
  function initTypewriter() {
    var el = $('#typeName');
    if (!el) { return; }

    var full = el.getAttribute('data-text') || el.textContent || '';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = full; return; }

    var index = 0;
    el.textContent = '';

    function step() {
      index += 1;
      el.textContent = full.slice(0, index);
      if (index < full.length) {
        window.setTimeout(step, 130);
      }
    }
    window.setTimeout(step, 300);
  }

  /* ===== 3. 深浅主题切换（夜之厅 / 白昼厅） ===== */
  function initTheme() {
    var btn = $('#themeToggle');
    var icon = $('#themeIcon');
    var label = $('#themeLabel');
    var root = document.documentElement;

    function apply(theme) {
      var isDay = theme === 'day';
      root.setAttribute('data-theme', isDay ? 'day' : 'night');
      if (icon) { icon.textContent = isDay ? '☀' : '☾'; }
      if (label) { label.textContent = isDay ? '白昼厅' : '夜之厅'; }
      if (btn) { btn.setAttribute('aria-pressed', isDay ? 'true' : 'false'); }
    }

    // 初次进入：优先用户选择，否则按长沙当前时刻自动判定
    var saved = readStore('artdeco-theme');
    if (saved === 'day' || saved === 'night') {
      apply(saved);
    } else {
      var p = changshaParts(new Date());
      var minutes = p.hour * 60 + p.minute;
      apply(minutes >= 7 * 60 && minutes < 19 * 60 ? 'day' : 'night');
    }

    if (!btn) { return; }
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'day' ? 'night' : 'day';
      apply(next);
      writeStore('artdeco-theme', next);
    });
  }

  /* ===== 4. 平滑滚动导航 + 当前栏目高亮 ===== */
  function initNav() {
    var links = $all('.nav__link');
    if (!links.length) { return; }

    // 平滑滚动（CSS scroll-behavior 之外再补一层，兼容旧浏览器）
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') { return; }
        var target = document.querySelector(id);
        if (!target) { return; }
        event.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });

    // 滚动位置高亮：取当前视口中最近的栏目
    var sections = links
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    function highlight() {
      var pos = window.pageYOffset + 140;
      var current = null;
      sections.forEach(function (section) {
        if (section.offsetTop <= pos) { current = section.id; }
      });
      links.forEach(function (link) {
        var on = link.getAttribute('href') === '#' + current;
        link.classList.toggle('is-active', on);
      });
    }

    window.addEventListener('scroll', highlight, { passive: true });
    highlight();
  }

  /* ===== 5. 滚动进场动画：IntersectionObserver ===== */
  function initReveal() {
    var items = $all('.reveal');
    if (!items.length) { return; }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        // 同屏元素依次错开入场，形成金色帷幕感
        window.setTimeout(function () { el.classList.add('is-visible'); }, i * 90);
        io.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (item) { io.observe(item); });
  }

  /* ===== 6. 技能条：进入视口或悬停时填充，并滚动数字 ===== */
  function initSkills() {
    var skills = $all('.skills__item');

    function fill(item) {
      if (item.dataset.filled === '1') { return; }
      var level = parseInt(item.getAttribute('data-level'), 10) || 0;
      var bar = $('.skills__bar', item);
      var num = $('.skills__num', item);
      item.dataset.filled = '1';

      if (bar) { bar.style.width = level + '%'; }
      countTo(num, level, 900, '%');
    }

    skills.forEach(function (item) {
      item.addEventListener('mouseenter', function () { fill(item); });
      item.addEventListener('focusin', function () { fill(item); });
    });

    if (!('IntersectionObserver' in window)) {
      skills.forEach(fill);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        fill(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    skills.forEach(function (item) { io.observe(item); });
  }

  /* ===== 7. 作品筛选（标签页式） ===== */
  function initFilter() {
    var buttons = $all('.filters__btn');
    var list = $('#worksList');
    var cards = $all('#worksList .card');
    var empty = $('#worksEmpty');
    if (!buttons.length || !cards.length) { return; }

    function apply(cat) {
      var shown = 0;
      // 标记进入筛选态：让卡片用 keyframes 重播动画（不依赖滚动进场状态）
      if (list) { list.classList.add('is-filtering'); }
      cards.forEach(function (card) {
        var match = cat === 'all' || card.getAttribute('data-cat') === cat;
        card.classList.toggle('is-hidden', !match);
        if (match) {
          shown += 1;
          card.classList.remove('is-visible');
          window.setTimeout(function () { card.classList.add('is-visible'); }, 30);
        }
      });
      if (empty) { empty.hidden = shown !== 0; }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (other) {
          var on = other === btn;
          other.classList.toggle('is-active', on);
          other.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        apply(btn.getAttribute('data-filter'));
      });
    });
  }

  /* ===== 8. 数字滚动（通用） ===== */
  function countTo(el, target, duration, suffix) {
    if (!el) { return; }
    var text = suffix || '';
    var start = performance.now();

    function frame(now) {
      var progress = Math.min((now - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + text;
      if (progress < 1) { window.requestAnimationFrame(frame); }
    }
    window.requestAnimationFrame(frame);
  }

  function initMetrics() {
    var items = $all('.metrics__item');

    function run(item) {
      if (item.dataset.counted === '1') { return; }
      item.dataset.counted = '1';
      var num = $('.metrics__num', item);
      countTo(num, parseInt(num.getAttribute('data-count'), 10) || 0, 1400);
    }

    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () { run(item); });
    });

    if (!('IntersectionObserver' in window)) {
      items.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    items.forEach(function (item) { io.observe(item); });
  }

  /* ===== 9. 返回顶部按钮 ===== */
  function initToTop() {
    var btn = $('#toTop');
    if (!btn) { return; }

    function sync() {
      btn.hidden = window.pageYOffset < 420;
    }

    window.addEventListener('scroll', sync, { passive: true });
    sync();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ===== 10. 鼠标跟随的金色光晕（桌面端装饰，不拦截点击） ===== */
  function initCursorGlow() {
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) { return; }

    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    document.addEventListener('mousemove', function (event) {
      glow.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)';
    }, { passive: true });
  }

  /* ===== 启动：DOM 就绪后统一绑定 ===== */
  function boot() {
    initClock();
    initTypewriter();
    initTheme();
    initNav();
    initReveal();
    initSkills();
    initFilter();
    initMetrics();
    initToTop();
    initCursorGlow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
