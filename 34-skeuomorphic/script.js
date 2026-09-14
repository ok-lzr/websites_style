/* =============================================================================
   34-skeuomorphic · 拟物皮革个人主页 —— script.js
   行为清单：
     1. 长沙时间实时时钟（new Date() 驱动，中文 zh-CN 格式）
     2. 昼夜主题判定（参考基线 2026-09-14 星期一 22:07 UTC+8）+ 手动切换与记忆
     3. 平滑滚动导航与当前栏目高亮
     4. 滚动进入动画 / 技能条上膛 / 数字滚动
     5. 顶部阅读进度、鼠标跟随高光、复制到剪贴板、回到顶部
   说明：所有样式都在 style.css 中，本文件只切换类名与 CSS 变量。
   ============================================================================= */
(function () {
  'use strict';

  /* ===== 通用小工具 ===== */
  function $(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }
  function $$(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }
  function setText(selector, text) {
    var el = $(selector);
    if (el) { el.textContent = text; }
  }
  function prefersReduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  var reduceMotion = prefersReduce();

  /* =========================================================================
     1 + 2. 长沙时间与昼夜主题
     ========================================================================= */

  /* 参考基线：来自网络查询的参考时刻 2026-09-14（星期一）22:07（UTC+8）。
     它属于夜间时段，用于在没有用户偏好时决定默认主题；
     时钟本身始终使用 new Date() 实时更新，与基线无关。 */
  var BASELINE = { month: 9, day: 14, hour: 22, minute: 7 };
  var BASELINE_TEXT = '2026-09-14（星期一）22:07';
  var NIGHT_FROM = 19.5; /* 19:30 之后算夜间 */
  var NIGHT_TO = 6;      /* 06:00 之前算夜间 */

  /* 按"当天"动态生成基线时刻：月日取基线、时分取 22:07 */
  function baselineOfDay(reference) {
    var d = new Date(reference.getTime());
    d.setMonth(BASELINE.month - 1, BASELINE.day);
    d.setHours(BASELINE.hour, BASELINE.minute, 0, 0);
    return d;
  }

  /* 取 UTC+8 的"墙上时间"：把本地时间偏移换算成东八区时间，
     这样无论访问者在哪个时区，看到的都是长沙时间 */
  function shanghaiWallClock() {
    var now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
  }

  function isNightHour(wall) {
    var h = wall.getHours() + wall.getMinutes() / 60;
    return h >= NIGHT_FROM || h < NIGHT_TO;
  }

  var themeSwitch = $('#themeSwitch');
  var userThemeChosen = false; /* 用户手动选过主题后，就不再跟随昼夜自动切换 */

  function applyTheme(theme, persist) {
    var isNight = theme === 'night';
    document.documentElement.setAttribute('data-theme', isNight ? 'night' : 'day');
    if (themeSwitch) {
      themeSwitch.setAttribute('aria-pressed', isNight ? 'true' : 'false');
      var icon = $('.theme-switch__icon', themeSwitch);
      var label = $('.theme-switch__text', themeSwitch);
      if (icon) { icon.textContent = isNight ? '☾' : '☀'; }
      if (label) { label.textContent = isNight ? '夜间皮革' : '日间皮革'; }
    }
    if (persist) {
      try { localStorage.setItem('oklzr-leather-theme', theme); } catch (e) { /* 隐私模式下忽略 */ }
    }
  }

  function storedTheme() {
    try { return localStorage.getItem('oklzr-leather-theme'); } catch (e) { return null; }
  }

  /* 实时刷新页面上的所有时钟节点 */
  function updateClock() {
    var wall = shanghaiWallClock();
    var weekList = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var ymd = wall.getFullYear() + '年' + (wall.getMonth() + 1) + '月' + wall.getDate() + '日';
    var hms = pad2(wall.getHours()) + ':' + pad2(wall.getMinutes()) + ':' + pad2(wall.getSeconds());
    var week = weekList[wall.getDay()];

    setText('[data-clock="time"]', hms);
    setText('[data-clock="date"]', ymd);
    setText('[data-clock="week"]', week);
    setText('[data-clock="full"]', ymd + ' ' + week + ' ' + hms);

    var night = isNightHour(wall);
    setText('#phaseInfo', night ? '夜间皮革 · 灯光已调暗' : '日间皮革 · 自然光模式');

    var baseline = baselineOfDay(wall);
    setText('#baselineInfo',
      '今天 ' + pad2(baseline.getHours()) + ':' + pad2(baseline.getMinutes()) +
      '（参考 ' + BASELINE_TEXT + '）');

    /* 未手动选择过主题时，按昼夜自动切换 */
    if (!userThemeChosen) {
      applyTheme(night ? 'night' : 'day', false);
    }
  }

  /* 时钟启动：立刻刷新一次，之后每秒刷新；标签页回到前台时补一次 */
  updateClock();
  window.setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { updateClock(); }
  });

  /* 初始主题：优先用户上次的选择，否则参考基线时刻所在的昼夜区间 */
  var savedTheme = storedTheme();
  if (savedTheme === 'day' || savedTheme === 'night') {
    userThemeChosen = true;
    applyTheme(savedTheme, false);
  } else {
    applyTheme(isNightHour(shanghaiWallClock()) ? 'night' : 'day', false);
  }

  if (themeSwitch) {
    themeSwitch.addEventListener('click', function () {
      userThemeChosen = true;
      var next = document.documentElement.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next, true);
      showToast(next === 'night' ? '已切换到夜间皮革' : '已切换到日间皮革');
    });
  }

  /* =========================================================================
     3. 平滑滚动 + 导航高亮
     ========================================================================= */

  /* 页面内锚点统一走 JS，滚动时避开吸顶页头 */
  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[href^="#"]') : null;
    if (!link) { return; }

    var hash = link.getAttribute('href');
    if (!hash || hash === '#') { return; }

    var section = document.querySelector(hash);
    if (!section) { return; }

    event.preventDefault();
    var header = $('#siteHeader');
    var offset = header ? header.offsetHeight + 8 : 0;
    var top = section.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', hash);
    }
  });

  var navLinks = $$('.nav__link');

  function markActiveNav(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
    });
  }

  if (navLinks.length && 'IntersectionObserver' in window) {
    var watched = navLinks
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { markActiveNav(entry.target.id); }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    watched.forEach(function (section) { navObserver.observe(section); });
  }

  /* =========================================================================
     4. 滚动进入动画 / 技能条 / 数字滚动
     ========================================================================= */

  /* 数字滚动：从 0 缓动到 data-count */
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) { return; }
    var decimals = (el.getAttribute('data-count').split('.')[1] || '').length;

    if (reduceMotion) {
      el.textContent = target.toFixed(decimals);
      return;
    }

    var duration = 1100;
    var startTime = 0;

    function step(timestamp) {
      if (!startTime) { startTime = timestamp; }
      var progress = Math.min(1, (timestamp - startTime) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (progress < 1) { window.requestAnimationFrame(step); }
    }
    window.requestAnimationFrame(step);
  }

  var revealEls = $$('.reveal');
  var skillEls = $$('.skill');
  var counterEls = $$('[data-count]');

  if ('IntersectionObserver' in window) {
    /* 先挂上"待入场"类，避免还没观察就闪一下 */
    revealEls.forEach(function (el) { el.classList.add('is-pending'); });
    skillEls.forEach(function (el) { el.classList.add('is-pending'); });
    counterEls.forEach(function (el) { el.textContent = '0'; });

    var viewObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;

        el.classList.remove('is-pending');
        el.classList.add('is-visible');

        if (el.classList.contains('skill')) {
          el.style.setProperty('--level', (el.getAttribute('data-level') || 0) + '%');
          el.classList.add('is-filled');
        }
        if (el.hasAttribute('data-count')) {
          runCounter(el);
        }
        observer.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) { viewObserver.observe(el); });
    skillEls.forEach(function (el) { viewObserver.observe(el); });
    counterEls.forEach(function (el) { viewObserver.observe(el); });
  } else {
    /* 老浏览器：直接给出最终状态 */
    skillEls.forEach(function (el) {
      el.style.setProperty('--level', (el.getAttribute('data-level') || 0) + '%');
      el.classList.add('is-filled');
    });
    counterEls.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* =========================================================================
     5. 阅读进度 / 页头状态 / 鼠标高光 / 回到顶部
     ========================================================================= */

  var header = $('#siteHeader');
  var scrollQueued = false;

  function updateScrollState() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;

    doc.style.setProperty('--progress', ratio.toFixed(4));
    if (header) {
      header.classList.toggle('is-scrolled', window.pageYOffset > 12);
    }
    scrollQueued = false;
  }

  window.addEventListener('scroll', function () {
    if (scrollQueued) { return; }
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollState);
  }, { passive: true });
  updateScrollState();

  /* 鼠标跟随的皮革高光：只写入 CSS 变量，样式全部由 CSS 负责 */
  var glowEl = $('#cursorGlow');
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (glowEl && canHover && !reduceMotion) {
    var glowX = 0;
    var glowY = 0;
    var glowQueued = false;

    document.addEventListener('mousemove', function (event) {
      glowX = event.clientX;
      glowY = event.clientY;
      glowEl.classList.add('is-active');
      if (glowQueued) { return; }
      glowQueued = true;
      window.requestAnimationFrame(function () {
        var root = document.documentElement;
        root.style.setProperty('--mx', glowX + 'px');
        root.style.setProperty('--my', glowY + 'px');
        glowQueued = false;
      });
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      glowEl.classList.remove('is-active');
    });
  }

  var backTop = $('#backTop');
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* =========================================================================
     6. 复制到剪贴板 + 提示气泡
     ========================================================================= */

  var toastEl = $('#toast');
  var toastTimer = null;

  function showToast(message) {
    if (!toastEl) { return; }
    toastEl.textContent = message;
    toastEl.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 2200);
  }

  /* 优先异步剪贴板 API，失败时退回离屏 textarea + execCommand */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var helper = document.createElement('textarea');
        helper.className = 'copy-helper';
        helper.value = text;
        helper.setAttribute('readonly', 'readonly');
        document.body.appendChild(helper);
        helper.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(helper);
        if (ok) { resolve(); } else { reject(new Error('execCommand copy failed')); }
      } catch (err) {
        reject(err);
      }
    });
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var btn = target && target.closest ? target.closest('[data-copy]') : null;
    if (!btn) { return; }

    var text = btn.getAttribute('data-copy');
    if (!text) { return; }

    copyText(text).then(function () {
      showToast('已复制：' + text);
    }, function () {
      showToast('复制失败，请手动选择：' + text);
    });
  });

  /* 时钟卡片上的复制按钮：整行实时时间 */
  var clockCopy = $('#clockCopy');
  if (clockCopy) {
    clockCopy.setAttribute('data-copy', '长沙时间');
    clockCopy.addEventListener('mouseenter', function () {
      var live = $('[data-clock="full"]');
      if (live) { clockCopy.setAttribute('data-copy', live.textContent); }
    });
    clockCopy.addEventListener('focus', function () {
      var live = $('[data-clock="full"]');
      if (live) { clockCopy.setAttribute('data-copy', live.textContent); }
    });
  }

  /* =========================================================================
     7. 打字机标语（装饰性文本，位于 aria-hidden 容器内）
     ========================================================================= */

  var typeEl = $('#typewriter');
  if (typeEl) {
    var lines = [
      '把界面当皮料打磨。',
      '缝线要对齐，手感要对。',
      '代码与手作，同样需要耐心。'
    ];

    if (reduceMotion) {
      typeEl.textContent = lines.join(' ');
    } else {
      var lineIndex = 0;
      var charIndex = 0;
      var deleting = false;

      var tick = function () {
        var line = lines[lineIndex];
        charIndex += deleting ? -1 : 1;
        typeEl.textContent = line.slice(0, charIndex);

        var delay = deleting ? 60 : 140;
        if (!deleting && charIndex === line.length) {
          deleting = true;
          delay = 1500; /* 打完一句停一下 */
        } else if (deleting && charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % lines.length;
          delay = 320;
        }
        window.setTimeout(tick, delay);
      };

      window.setTimeout(tick, 500);
    }
  }
})();
