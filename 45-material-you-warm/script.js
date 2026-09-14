/* ==========================================================================
   ok-lzr / 码上生活 —— 交互脚本
   包含：长沙实时时钟、深浅色主题、打字机、滚动进入动画、
        技能条动画、作品筛选、导航高亮、阅读进度、回到顶部
   ========================================================================== */
(function () {
  'use strict';

  /* 参考基线：2026-09-14（星期一）22:07 UTC+8 —— 来自网络查询的参考时刻，
     仅用于判断页面初次的昼夜主题倾向；时钟本身始终使用 new Date() 实时更新。 */
  var REFERENCE_BASELINE = '2026-09-14T22:07:00+08:00';

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* ===== 长沙实时时钟 ===== */
  // 长沙无夏令时，固定 UTC+8，用 UTC 时间戳加偏移得到当地时间
  function getChangshaDate() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function renderClock() {
    var d = getChangshaDate();
    var timeText = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    var dateText = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    // 用 zh-CN 取星期文本，取不到时回退到本地表
    var weekText = '';
    try {
      weekText = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(d);
    } catch (e) {
      weekText = WEEKDAYS[d.getDay()];
    }

    var timeEl = document.getElementById('clockTime');
    var dateEl = document.getElementById('clockDate');
    var weekEl = document.getElementById('clockWeek');
    var contactEl = document.getElementById('contactClock');
    var sunEl = document.getElementById('clockSun');

    if (timeEl) timeEl.textContent = timeText;
    if (dateEl) dateEl.textContent = dateText;
    if (weekEl) weekEl.textContent = weekText;
    if (contactEl) contactEl.textContent = timeText;

    // 白天显示太阳，夜间显示月亮
    if (sunEl) sunEl.textContent = (d.getHours() >= 6 && d.getHours() < 19) ? '🌤' : '🌙';

    updateGreeting(d.getHours());
  }

  // 首屏问候语随时段变化
  function updateGreeting(hour) {
    var el = document.getElementById('greeting');
    if (!el) return;
    var text;
    if (hour < 6) text = '凌晨好，还没休息呀';
    else if (hour < 11) text = '早上好，今天也要顺顺利利';
    else if (hour < 14) text = '中午好，记得吃点东西';
    else if (hour < 18) text = '下午好，欢迎来到我的小站';
    else if (hour < 23) text = '晚上好，慢慢逛一逛';
    else text = '夜深了，早点休息';
    el.textContent = text;
  }

  /* ===== 深浅色主题 ===== */
  var THEME_KEY = 'oklzr-warm-theme';

  function applyTheme(theme) {
    var root = document.documentElement;
    var icon = document.getElementById('themeIcon');
    var label = document.getElementById('themeLabel');
    root.setAttribute('data-theme', theme);
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀';
    if (label) label.textContent = theme === 'dark' ? '夜间' : '日间';
  }

  function initTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }

    var theme;
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else {
      // 无本地记录时，用参考基线时刻（22:07）判断：夜间 → 深色
      var ref = new Date(REFERENCE_BASELINE);
      var refHour = isNaN(ref.getTime()) ? 22 : ref.getHours();
      theme = (refHour >= 19 || refHour < 6) ? 'dark' : 'light';
    }
    applyTheme(theme);

    var toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { window.localStorage.setItem(THEME_KEY, next); } catch (e) { /* 忽略隐私模式写入失败 */ }
      });
    }
  }

  /* ===== 打字机效果 ===== */
  function initTypewriter() {
    var el = document.getElementById('typewriter');
    if (!el) return;
    var full = el.getAttribute('data-text') || el.textContent;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = full; el.classList.add('is-done'); return; }

    el.textContent = '';
    var i = 0;
    function step() {
      el.textContent = full.slice(0, i);
      i += 1;
      if (i <= full.length) {
        window.setTimeout(step, 68);
      } else {
        el.classList.add('is-done');
      }
    }
    window.setTimeout(step, 420);
  }

  /* ===== 滚动进入动画 ===== */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, idx) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // 同批元素做轻微错峰延迟，视觉更柔和
        window.setTimeout(function () { el.classList.add('is-in'); }, idx * 70);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ===== 技能条动画 + 数字滚动 ===== */
  function animateCount(el, target, duration) {
    var start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + '%';
      if (p < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function fillSkill(skill) {
    var level = parseInt(skill.getAttribute('data-level'), 10) || 0;
    var bar = skill.querySelector('.skill-bar');
    var num = skill.querySelector('.skill-num');
    if (bar) bar.style.width = level + '%';
    if (num) animateCount(num, level, 1100);
  }

  function initSkills() {
    var skills = Array.prototype.slice.call(document.querySelectorAll('.skill'));
    if (!skills.length) return;

    if (!('IntersectionObserver' in window)) {
      skills.forEach(fillSkill);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        fillSkill(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    skills.forEach(function (s) { io.observe(s); });
  }

  /* ===== 作品筛选 ===== */
  function initFilter() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.filter-btn'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.work-card'));
    var empty = document.getElementById('filterEmpty');
    if (!buttons.length || !cards.length) return;

    function applyFilter(key) {
      var visible = 0;
      cards.forEach(function (card) {
        var match = key === 'all' || card.getAttribute('data-cat') === key;
        card.classList.toggle('is-hidden', !match);
        if (match) visible += 1;
      });
      if (empty) empty.hidden = visible !== 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        applyFilter(btn.getAttribute('data-filter'));
      });
    });
  }

  /* ===== 导航平滑滚动 + 当前区块高亮 ===== */
  function initNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

    links.forEach(function (link) {
      link.addEventListener('click', function (ev) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        ev.preventDefault();
        var header = document.getElementById('siteHeader');
        var offset = header ? header.offsetHeight + 12 : 0;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      });
    });

    var sections = links
      .map(function (l) { return document.querySelector(l.getAttribute('href')); })
      .filter(Boolean);
    if (!sections.length) return;

    function syncActive() {
      var line = (document.getElementById('siteHeader') || {}).offsetHeight || 72;
      var current = sections[0];
      sections.forEach(function (sec) {
        if (sec.getBoundingClientRect().top - line - 40 <= 0) current = sec;
      });
      links.forEach(function (l) {
        l.classList.toggle('is-active', l.getAttribute('href') === '#' + current.id);
      });
    }

    return syncActive;
  }

  /* ===== 阅读进度条 + 回到顶部 + 头部阴影 ===== */
  function initScrollUI(syncActive) {
    var progress = document.getElementById('scrollProgress');
    var toTop = document.getElementById('toTop');
    var header = document.getElementById('siteHeader');
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(window.pageYOffset / max, 1) : 0;
      if (progress) progress.style.width = (ratio * 100).toFixed(2) + '%';

      var scrolled = window.pageYOffset > 40;
      if (header) header.classList.toggle('is-scrolled', scrolled);
      if (toTop) toTop.classList.toggle('is-visible', window.pageYOffset > 360);

      if (typeof syncActive === 'function') syncActive();
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', update);
    update();

    if (toTop) {
      toTop.addEventListener('click', function () {
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      });
    }
  }

  /* ===== 卡片指针跟随光晕（纯类名与 CSS 变量，不写样式字符串） ===== */
  function initPointerGlow() {
    var cards = Array.prototype.slice.call(
      document.querySelectorAll('.work-card, .contact-card')
    );
    if (!cards.length) return;
    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;

    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((ev.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((ev.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
        card.classList.add('is-glowing');
      });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-glowing');
      });
    });
  }

  /* ===== 启动 ===== */
  function init() {
    renderClock();
    window.setInterval(renderClock, 1000);

    initTheme();
    initTypewriter();
    initReveal();
    initSkills();
    initFilter();
    var syncActive = initNav();
    initScrollUI(syncActive);
    initPointerGlow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
