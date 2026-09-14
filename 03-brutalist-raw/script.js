/* =============================================================
   03-brutalist-raw · 交互脚本
   职责：昼/夜配色、长沙实时时钟、数字滚动、滚动进入动画、
         导航平滑滚动 + 当前区块高亮、打字机效果
   ============================================================= */
(function () {
  'use strict';

  var root = document.documentElement;

  /* =========================================================
     0. 常量：参考基线时间
     来自网络查询的参考时刻：2026-09-14（星期一）22:07（UTC+8）
     仅用于决定“初次进入时”的昼/夜主题；时钟本身始终用 new Date()
     ========================================================= */
  var BASELINE = {
    date: '2026-09-14',
    weekday: '星期一',
    time: '22:07',
    hour: 22,
    tz: 'UTC+8'
  };

  var KEY_THEME = 'brutalist-theme';

  function $(id) { return document.getElementById(id); }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* =========================================================
     1. 昼 / 夜主题
     初始值：优先用户上次选择，其次用基线时刻判断（22:07 属于夜间）
     ========================================================= */
  var themeToggle = $('theme-toggle');
  var themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;
  var themeLabel = themeToggle ? themeToggle.querySelector('.theme-label') : null;

  function readStoredTheme() {
    try { return window.localStorage.getItem(KEY_THEME); } catch (e) { return null; }
  }

  function storeTheme(name) {
    try { window.localStorage.setItem(KEY_THEME, name); } catch (e) { /* 隐私模式下忽略 */ }
  }

  // 基线 22:07 → 夜间；06:00~18:59 视为白天
  function baselineTheme() {
    return (BASELINE.hour >= 19 || BASELINE.hour < 6) ? 'night' : 'day';
  }

  function applyTheme(name, persist) {
    root.setAttribute('data-theme', name);

    if (themeIcon) { themeIcon.textContent = name === 'night' ? '☾' : '☀'; }
    if (themeLabel) { themeLabel.textContent = name === 'night' ? '夜间模式' : '白天模式'; }
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', name === 'night' ? 'true' : 'false'); }

    var period = $('panel-period');
    if (period) { period.textContent = name === 'night' ? '夜' : '昼'; }

    if (persist) { storeTheme(name); }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next, true);
    });
  }

  applyTheme(readStoredTheme() || baselineTheme(), false);

  /* =========================================================
     2. 长沙时间实时时钟（zh-CN，UTC+8）
     使用 new Date() 取当前时刻，再按 Asia/Shanghai 时区格式化
     ========================================================= */
  var clockTime = $('clock-time');
  var clockDate = $('clock-date');
  var clockWeek = $('clock-week');
  var heroTime = $('hero-time');
  var heroDate = $('hero-date');
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function clockParts(date) {
    try {
      var fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        weekday: 'long', hourCycle: 'h23'
      });
      var map = {};
      fmt.formatToParts(date).forEach(function (part) { map[part.type] = part.value; });

      return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour: map.hour || '00',
        minute: map.minute || '00',
        second: map.second || '00',
        week: map.weekday || WEEK[date.getDay()]
      };
    } catch (e) {
      // 极旧浏览器的兜底：仍基于当前时间计算
      return {
        year: String(date.getFullYear()),
        month: pad2(date.getMonth() + 1),
        day: pad2(date.getDate()),
        hour: pad2(date.getHours()),
        minute: pad2(date.getMinutes()),
        second: pad2(date.getSeconds()),
        week: WEEK[date.getDay()]
      };
    }
  }

  function tickClock() {
    var p = clockParts(new Date()); // 必须实时取值
    var hms = p.hour + ':' + p.minute + ':' + p.second;

    if (clockTime) { clockTime.textContent = hms; }
    if (clockDate) { clockDate.textContent = p.year + '年' + p.month + '月' + p.day + '日'; }
    if (clockWeek) { clockWeek.textContent = p.week; }
    if (heroTime) { heroTime.textContent = hms; }
    if (heroDate) { heroDate.textContent = p.month + '-' + p.day + ' ' + p.week; }

    var clockBox = $('clock');
    if (clockBox) {
      clockBox.setAttribute('aria-label', '长沙时间 ' + hms + ' ' + p.year + '年' + p.month + '月' + p.day + '日 ' + p.week);
    }
  }

  tickClock();
  window.setInterval(tickClock, 1000);

  /* =========================================================
     3. 数字滚动：个人数据区的统计数字
     ========================================================= */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-value')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1300;
    var start = null;

    function frame(now) {
      if (start === null) { start = now; }
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) { window.requestAnimationFrame(frame); }
    }

    window.requestAnimationFrame(frame);
  }

  var statNumbers = Array.prototype.slice.call(document.querySelectorAll('.stat-num'));

  if (statNumbers.length) {
    if (prefersReducedMotion() || !('requestAnimationFrame' in window)) {
      statNumbers.forEach(function (el) {
        el.textContent = el.getAttribute('data-value') + (el.getAttribute('data-suffix') || '');
      });
    } else {
      // 先归零，等卡片进入视口再滚动
      statNumbers.forEach(function (el) { el.textContent = '0' + (el.getAttribute('data-suffix') || ''); });
    }
  }

  /* =========================================================
     4. 滚动进入动画 + 统计数字触发（IntersectionObserver）
     ========================================================= */
  var observer = null;

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }

        var el = entry.target;
        el.classList.add('is-in');

        var nums = el.querySelectorAll ? el.querySelectorAll('.stat-num') : [];
        Array.prototype.forEach.call(nums, function (num) {
          if (!num.getAttribute('data-counted')) {
            num.setAttribute('data-counted', '1');
            countUp(num);
          }
        });

        observer.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  }

  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll('.project, .stat, .data-list, .clock, .about-text, .hero-panel, .section-title, .stats')
  );

  // 标记为观察对象（动画样式在 CSS 的 .observe 中定义）
  revealTargets.forEach(function (el) { el.classList.add('observe'); });

  if (observer && !prefersReducedMotion()) {
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    // 不支持或用户要求减少动画：直接显示最终状态
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
    statNumbers.forEach(function (el) {
      el.textContent = el.getAttribute('data-value') + (el.getAttribute('data-suffix') || '');
    });
  }

  /* =========================================================
     5. 导航：平滑滚动 + 当前区块高亮
     ========================================================= */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a'));

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href') || '';
      if (hash.charAt(0) !== '#' || hash.length < 2) { return; }

      var target = document.querySelector(hash);
      if (!target) { return; }

      event.preventDefault();

      var reduced = prefersReducedMotion();
      var header = document.querySelector('.site-header');
      var offset = header ? header.getBoundingClientRect().height + 12 : 12;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
      markActive(hash);
    });
  });

  function markActive(hash) {
    navLinks.forEach(function (link) {
      var on = link.getAttribute('href') === hash;
      link.classList.toggle('is-active', on);
    });
  }

  function updateNavState() {
    if (!navLinks.length) { return; }

    var header = document.querySelector('.site-header');
    var line = (header ? header.getBoundingClientRect().height : 0) + window.innerHeight * 0.28;
    var current = null;

    navLinks.forEach(function (link) {
      var id = (link.getAttribute('href') || '').slice(1);
      var section = id ? document.getElementById(id) : null;
      if (!section) { return; }

      var box = section.getBoundingClientRect();
      if (box.top <= line && box.bottom > line) { current = '#' + id; }
    });

    if (current) { markActive(current); }
  }

  var ticking = false;

  function onScroll() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () {
      updateNavState();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateNavState();

  /* =========================================================
     6. 打字机效果：首屏副标题循环打字
     ========================================================= */
  var typed = $('typed');
  var PHRASES = ['码上生活', '写页面的人', '长沙 / UTC+8'];

  if (typed) {
    if (prefersReducedMotion()) {
      typed.textContent = PHRASES[0];
    } else {
      var phraseIndex = 0;
      var charIndex = 0;
      var deleting = false;

      var typeStep = function () {
        var word = PHRASES[phraseIndex];
        charIndex += deleting ? -1 : 1;
        typed.textContent = word.slice(0, charIndex);

        var delay = deleting ? 70 : 140;

        if (!deleting && charIndex === word.length) {
          deleting = true;
          delay = 1500; // 打完停一下
        } else if (deleting && charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % PHRASES.length;
          delay = 320;
        }

        window.setTimeout(typeStep, delay);
      };

      typeStep();
    }
  }

  /* =========================================================
     7. 兜底：页面从缓存恢复时刷新一次时钟与导航状态
     ========================================================= */
  window.addEventListener('pageshow', function () {
    tickClock();
    updateNavState();
  });
})();
