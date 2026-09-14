/* ==========================================================================
   49-synthwave-neon / 交互脚本
   所有行为集中在此：时钟、打字机、滚动动画、技能条、数字滚动、
   导航（平滑滚动 / 高亮 / 移动端展开）、昼夜主题、作品筛选、鼠标光晕。
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 常量配置 ===== */

  // 长沙时区固定为 UTC+8（中国标准时间，无夏令时）
  var CHANGSHA_TZ = 'Asia/Shanghai';

  // 网络查询得到的参考基线时刻：2026-09-14（星期一）22:07 UTC+8
  // 仅用于判断「此刻应属夜还是昼」的基准，时钟本身始终用 new Date() 实时计算。
  var BASELINE = { hour: 22, minute: 7, isNight: true };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* ===== 工具函数 ===== */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // 补零：9 -> "09"
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // 取长沙当前时间各字段（用 Intl 拿到 UTC+8 的准确值）
  function getChangshaParts() {
    var now = new Date();
    var fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: CHANGSHA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short'
    });

    var map = {};
    fmt.formatToParts(now).forEach(function (part) {
      if (part.type !== 'literal') { map[part.type] = part.value; }
    });

    var hour = parseInt(map.hour, 10);
    if (hour === 24) { hour = 0; } // 个别环境会返回 24 点

    // weekday 用本地日期对象配合时区偏移换算，保证中文星期准确
    var shifted = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);

    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: hour,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
      weekday: WEEKDAYS[shifted.getDay()]
    };
  }

  /* ===== 1. 长沙实时时钟 ===== */

  var clockDateEl = $('#clockDate');
  var clockTimeEl = $('#clockTime');
  var clockZoneEl = $('#clockZone');
  var contactClockEl = $('#contactClock');

  function renderClock() {
    var t = getChangshaParts();
    var dateText = t.year + '年' + pad(t.month) + '月' + pad(t.day) + '日 ' + t.weekday;
    var timeText = pad(t.hour) + ':' + pad(t.minute) + ':' + pad(t.second);
    var isNight = t.hour >= 19 || t.hour < 6;

    if (clockDateEl) { clockDateEl.textContent = dateText; }
    if (clockTimeEl) { clockTimeEl.textContent = timeText; }
    if (contactClockEl) { contactClockEl.textContent = timeText; }
    if (clockZoneEl) {
      clockZoneEl.textContent = 'UTC+8 · ' + (isNight ? '夜' : '昼') +
        ' · 基线 ' + BASELINE.hour + ':' + pad(BASELINE.minute) + (BASELINE.isNight ? ' 夜' : ' 昼');
    }
  }

  // 每 500ms 刷新一次，秒数不会卡顿也不会浪费性能
  renderClock();
  setInterval(renderClock, 500);

  /* ===== 2. 打字机效果（首屏一句话轮播） ===== */

  var typeEl = $('#typewriter');
  var PHRASES = [
    '写一些打开就亮起来的页面。',
    '用原生三件套做轻量小站。',
    '把数据排成好看的形状。',
    '夜里的代码，也要有霓虹。'
  ];

  function startTypewriter() {
    if (!typeEl) { return; }

    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function step() {
      var current = PHRASES[phraseIndex];
      charIndex += deleting ? -1 : 1;
      typeEl.textContent = current.slice(0, charIndex);

      var delay = deleting ? 45 : 110;

      if (!deleting && charIndex === current.length) {
        deleting = true;
        delay = 1600; // 整句停留
      } else if (deleting && charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        delay = 320;
      }

      setTimeout(step, delay);
    }

    step();
  }

  startTypewriter();

  /* ===== 3. 滚动进入动画 + 技能条 + 数字滚动（IntersectionObserver） ===== */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fillSkillBar(skill) {
    var level = parseInt(skill.getAttribute('data-level'), 10) || 0;
    var bar = $('.skill-bar', skill);
    if (bar) { bar.style.width = level + '%'; }
  }

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1400;
    var start = null;

    if (reduceMotion) {
      el.textContent = target + suffix;
      return;
    }

    function frame(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic，收尾更自然
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) { requestAnimationFrame(frame); }
    }

    requestAnimationFrame(frame);
  }

  var revealTargets = $$('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        el.classList.add('is-visible');

        // 技能条：进入视口后填充
        if (el.classList.contains('skill')) { fillSkillBar(el); }

        // 数字滚动：每个计数器只跑一次
        $$('.stat-num', el).forEach(function (num) {
          if (num.dataset.done === '1') { return; }
          num.dataset.done = '1';
          runCounter(num);
        });

        obs.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    // 兜底：不支持观察器时直接显示全部内容
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
      if (el.classList.contains('skill')) { fillSkillBar(el); }
      $$('.stat-num', el).forEach(runCounter);
    });
  }

  /* ===== 4. 导航：粘顶阴影、滚动高亮、移动端展开、平滑滚动 ===== */

  var header = $('#siteHeader');
  var navToggle = $('#navToggle');
  var mainNav = $('#mainNav');
  var navLinks = $$('.main-nav a');
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  // 滚动时给页头加阴影
  function onScrollHeader() {
    if (!header) { return; }
    if (window.scrollY > 12) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }

  // 当前所在区块高亮对应导航项
  function updateActiveLink() {
    if (!sections.length) { return; }
    var offset = window.scrollY + (header ? header.offsetHeight : 0) + 90;
    var currentId = sections[0].id;

    sections.forEach(function (sec) {
      if (sec.offsetTop <= offset) { currentId = sec.id; }
    });

    // 滚到底部时高亮最后一项
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
      currentId = sections[sections.length - 1].id;
    }

    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + currentId);
    });
  }

  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (scrollTicking) { return; }
    scrollTicking = true;
    requestAnimationFrame(function () {
      onScrollHeader();
      updateActiveLink();
      scrollTicking = false;
    });
  }, { passive: true });

  onScrollHeader();
  updateActiveLink();

  // 移动端菜单展开 / 收起
  function closeNav() {
    if (!mainNav || !navToggle) { return; }
    mainNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // 点击导航链接后自动收起（保留 <a href="#..."> 的原生平滑滚动）
    mainNav.addEventListener('click', function (event) {
      if (event.target.closest('a')) { closeNav(); }
    });

    // 点击页面其他位置也收起菜单
    document.addEventListener('click', function (event) {
      if (!mainNav.classList.contains('is-open')) { return; }
      if (mainNav.contains(event.target) || navToggle.contains(event.target)) { return; }
      closeNav();
    });

    // Esc 关闭菜单
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeNav(); }
    });
  }

  /* ===== 5. 昼夜主题切换（默认按基线时刻落到夜间） ===== */

  var themeToggle = $('#themeToggle');
  var themeLabel = themeToggle ? $('.theme-label', themeToggle) : null;
  var themeIcon = themeToggle ? $('.theme-icon', themeToggle) : null;

  function applyTheme(mode, persist) {
    var isDay = mode === 'day';
    document.body.classList.toggle('theme-day', isDay);

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', isDay ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', isDay ? '切换夜间主题' : '切换昼间主题');
    }
    if (themeLabel) { themeLabel.textContent = isDay ? '昼间模式' : '夜行模式'; }
    if (themeIcon) { themeIcon.textContent = isDay ? '☀' : '🌙'; }

    if (persist) {
      try { localStorage.setItem('oklzr-theme', isDay ? 'day' : 'night'); } catch (e) { /* 隐私模式下忽略 */ }
    }
  }

  // 初始主题：优先读取访客上次选择，否则按长沙当前时刻（参照基线 22:07 的夜间设定）决定
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('oklzr-theme'); } catch (e) { saved = null; }

    if (saved === 'day' || saved === 'night') {
      applyTheme(saved, false);
      return;
    }

    var hour = getChangshaParts().hour;
    applyTheme((hour >= 6 && hour < 19) ? 'day' : 'night', false);
  })();

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isDay = document.body.classList.contains('theme-day');
      applyTheme(isDay ? 'night' : 'day', true);
    });
  }

  /* ===== 6. 作品筛选（标签页） ===== */

  var filterBtns = $$('.filter-btn');
  var workCards = $$('.work-card');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var filter = btn.getAttribute('data-filter');

      filterBtns.forEach(function (other) {
        var active = other === btn;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      workCards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-cat') === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  /* ===== 7. 鼠标跟随霓虹光晕（仅指针精确的设备） ===== */

  var glow = $('#cursorGlow');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (glow && finePointer && !reduceMotion) {
    var glowX = window.innerWidth / 2;
    var glowY = window.innerHeight / 2;
    var targetX = glowX;
    var targetY = glowY;
    var glowVisible = false;

    document.addEventListener('mousemove', function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!glowVisible) {
        glowVisible = true;
        glow.classList.add('is-on');
      }
    });

    document.addEventListener('mouseleave', function () {
      glowVisible = false;
      glow.classList.remove('is-on');
    });

    (function follow() {
      // 缓动跟随，光晕比鼠标慢半拍
      glowX += (targetX - glowX) * 0.12;
      glowY += (targetY - glowY) * 0.12;
      glow.style.transform = 'translate3d(' + glowX.toFixed(1) + 'px,' + glowY.toFixed(1) + 'px,0)';
      requestAnimationFrame(follow);
    })();
  }

})();
