/* ==========================================================
   07-flat-material · script.js
   行为层：昼夜主题、涟漪反馈、平滑滚动与导航高亮、滚动入场、
          技能条填充、数字滚动、作品筛选、打字机、长沙实时时钟、
          复制提示、回到顶部。全部通过 addEventListener 绑定。
   ========================================================== */
(function () {
  'use strict';

  /* ===== 工具函数 ===== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 无剪贴板 API 时的降级方案
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'copy-helper';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  /* ===== 长沙时间与基线参考时刻 =====
     长沙固定 UTC+8，与访问者本地时区无关：
     先用 getTimezoneOffset 换回 UTC 毫秒，再整体加 8 小时。 */
  var CN_OFFSET_MS = 8 * 60 * 60 * 1000;
  var REFERENCE_ISO = '2026-09-14T22:07:00+08:00'; // 网络查询得到的基线参考时刻
  var REFERENCE_MS = Date.parse(REFERENCE_ISO);
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function toChangsha(date) {
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + CN_OFFSET_MS);
  }

  function phaseOf(date) {
    var h = date.getHours();
    return (h >= 19 || h < 6) ? 'night' : 'day';
  }

  /* ===== 1. 昼夜主题（初值来自基线参考时刻） ===== */
  var root = document.documentElement;
  var themeToggle = $('#themeToggle');
  var themeIcon = $('#themeIcon');
  var THEME_KEY = 'oklzr-flat-material-theme';
  var manualLock = false;
  var currentPhase = 'day';

  function readStoredTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function storeTheme(phase) {
    try { window.localStorage.setItem(THEME_KEY, phase); } catch (e) { /* 忽略隐私模式报错 */ }
  }

  function applyTheme(phase) {
    currentPhase = phase;
    root.setAttribute('data-theme', phase === 'night' ? 'dark' : 'light');
    if (themeIcon) themeIcon.textContent = phase === 'night' ? '☀' : '☾';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label',
        phase === 'night' ? '当前夜间主题，点击切换到日间' : '当前日间主题，点击切换到夜间');
    }
  }

  (function initTheme() {
    var stored = readStoredTheme();
    if (stored === 'night' || stored === 'day') {
      manualLock = true;
      applyTheme(stored);
      return;
    }
    // 无用户偏好时，用基线参考时刻判断昼夜
    applyTheme(phaseOf(toChangsha(new Date(REFERENCE_MS))));
  }());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      manualLock = true;
      var next = currentPhase === 'night' ? 'day' : 'night';
      applyTheme(next);
      storeTheme(next);
      showSnackbar(next === 'night' ? '已切换到夜间主题' : '已切换到日间主题');
    });
  }

  /* ===== 2. 涟漪反馈：为 .md-ripple 元素生成水波 ===== */
  document.addEventListener('pointerdown', function (event) {
    var host = event.target.closest ? event.target.closest('.md-ripple') : null;
    if (!host) return;

    var rect = host.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2;
    var ripple = document.createElement('span');

    ripple.className = 'ripple';
    // 只设置位置与尺寸，视觉全部由 CSS 负责
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';

    host.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  });

  /* ===== 3. 平滑滚动导航 + 当前区块高亮 ===== */
  var navLinks = $$('.nav__link');

  function scrollToTarget(hash) {
    var target = hash && hash.length > 1 ? $(hash) : null;
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href');
      if (scrollToTarget(hash)) event.preventDefault();
    });
  });

  var sections = $$('main section[id]');
  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ===== 4. 滚动入场动画 / 技能条 / 数字滚动 ===== */
  var revealItems = $$('.reveal');

  function fillBar(item) {
    var fill = $('.bar__fill', item);
    if (fill) fill.style.width = (item.getAttribute('data-level') || 0) + '%';
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-target')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1100;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.remove('is-armed');
        el.classList.add('is-visible');

        if (el.classList.contains('skill')) fillBar(el);
        var num = $('.stat__num', el);
        if (num && !num.dataset.done) {
          num.dataset.done = '1';
          countUp(num);
        }
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (el) {
      el.classList.add('is-armed');
      revealObserver.observe(el);
    });
  } else {
    // 老浏览器直接显示并填充
    revealItems.forEach(function (el) {
      el.classList.add('is-visible');
      if (el.classList.contains('skill')) fillBar(el);
    });
  }

  /* ===== 5. 作品筛选（标签页式 chips） ===== */
  var chips = $$('.chip');
  var projects = $$('.project');
  var projectCount = $('#projectCount');
  var projectsEmpty = $('#projectsEmpty');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.getAttribute('data-filter');
      var shown = 0;

      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });

      projects.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-category') === filter;
        card.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });

      if (projectCount) projectCount.textContent = String(shown);
      if (projectsEmpty) projectsEmpty.hidden = shown !== 0;
    });
  });

  /* ===== 6. 打字机效果 ===== */
  var typedEl = $('#typedText');
  var PHRASES = [
    '把想法做成能打开的页面。',
    '喜欢扁平色块与清晰的层级。',
    '在长沙写代码，也记录生活。'
  ];

  if (typedEl) {
    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    (function type() {
      var text = PHRASES[phraseIndex];
      charIndex += deleting ? -1 : 1;
      typedEl.textContent = text.slice(0, charIndex);

      var delay = deleting ? 45 : 105;
      if (!deleting && charIndex === text.length) {
        deleting = true;
        delay = 1600; // 打完停顿
      } else if (deleting && charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        delay = 350;
      }
      window.setTimeout(type, delay);
    }());
  }

  /* ===== 7. 长沙实时时钟 ===== */
  var clockDate = $('#clockDate');
  var clockTime = $('#clockTime');
  var clockRef = $('#clockRef');
  var profileClock = $('#profileClock');
  var formatToggle = $('#formatToggle');
  var use24Hour = true;
  var lastPhase = currentPhase;

  // 基线参考时刻的显示文本由 JS 动态生成
  if (clockRef) {
    var ref = toChangsha(new Date(REFERENCE_MS));
    clockRef.textContent = ref.getFullYear() + '-' + pad2(ref.getMonth() + 1) + '-' + pad2(ref.getDate()) +
      ' ' + pad2(ref.getHours()) + ':' + pad2(ref.getMinutes()) +
      '（' + WEEKDAYS[ref.getDay()] + '）';
  }

  function renderClock() {
    var now = toChangsha(new Date());
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var week = WEEKDAYS[now.getDay()];

    if (clockDate) clockDate.textContent = y + '年' + m + '月' + d + '日 ' + week;

    var timeText;
    if (use24Hour) {
      timeText = pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
    } else {
      var half = hh < 12 ? '上午' : '下午';
      var h12 = hh % 12 === 0 ? 12 : hh % 12;
      timeText = half + ' ' + pad2(h12) + ':' + pad2(mm) + ':' + pad2(ss);
    }
    if (clockTime) {
      clockTime.textContent = timeText;
      clockTime.setAttribute('title', '点击复制当前长沙时间');
    }
    if (profileClock) profileClock.textContent = timeText;

    // 未手动锁定主题时，跟随实际昼夜自动切换
    var phase = phaseOf(now);
    if (!manualLock && phase !== lastPhase) {
      lastPhase = phase;
      applyTheme(phase);
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  if (formatToggle) {
    formatToggle.addEventListener('click', function () {
      use24Hour = !use24Hour;
      formatToggle.textContent = use24Hour ? '切换 12 / 24 小时制' : '切回 24 小时制';
      renderClock();
      showSnackbar(use24Hour ? '已切换为 24 小时制' : '已切换为 12 小时制');
    });
  }

  if (clockTime) {
    clockTime.addEventListener('click', function () {
      var text = (clockDate ? clockDate.textContent + ' ' : '') + clockTime.textContent + '（长沙时间）';
      copyText(text).then(function () {
        showSnackbar('已复制长沙时间');
      }).catch(function () {
        showSnackbar('复制失败，请手动记录');
      });
    });
  }

  /* ===== 8. 复制地点等信息 ===== */
  var snackbarTimer = null;
  var snackbar = $('#snackbar');

  function showSnackbar(message) {
    if (!snackbar) return;
    snackbar.textContent = message;
    snackbar.classList.add('is-open');
    window.clearTimeout(snackbarTimer);
    snackbarTimer = window.setTimeout(function () {
      snackbar.classList.remove('is-open');
    }, 2200);
  }

  $$('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function () {
      var text = el.getAttribute('data-copy') || '';
      copyText(text).then(function () {
        showSnackbar('已复制：' + text);
      }).catch(function () {
        showSnackbar('复制失败，内容为：' + text);
      });
    });
  });

  /* ===== 9. 顶栏阴影与回到顶部 FAB ===== */
  var appBar = $('#appBar');
  var backToTop = $('#backToTop');

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (appBar) appBar.classList.toggle('is-scrolled', y > 8);
    if (backToTop) backToTop.classList.toggle('is-visible', y > 420);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}());
