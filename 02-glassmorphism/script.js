/* ==========================================================================
   02-glassmorphism / script.js
   负责所有行为：实时时钟、昼夜主题、平滑滚动、滚动进入动画、
   技能条与数字滚动、作品筛选、移动端菜单、鼠标跟随光晕、打字机标题
   ========================================================================== */

(function () {
  'use strict';

  /* ===== 参考基线：2026-09-14（星期一）22:07（UTC+8） =====
     用途：作为"当天基线时刻"参与昼夜主题判断；时钟本身始终使用 new Date() 实时时间。 */
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7 };
  var OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

  /* 由基线推出"当前日期对应的基线时刻"，用于夜/昼判定（保持 22:07 的参考语义） */
  function baselineMomentFor(date) {
    var base = new Date(Date.UTC(BASELINE.year, BASELINE.month - 1, BASELINE.day, BASELINE.hour, BASELINE.minute));
    var drift = Math.round((date.getTime() - OFFSET_MS - base.getTime()) / 86400000);
    return new Date(base.getTime() + drift * 86400000);
  }

  /* ===== 实时时钟（长沙时间 UTC+8，zh-CN 显示） ===== */
  var clockTime = document.getElementById('clockTime');
  var clockDate = document.getElementById('clockDate');
  var clockWeekday = document.getElementById('clockWeekday');
  var clockPhase = document.getElementById('clockPhase');
  var contactClock = document.getElementById('contactClock');

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  function renderClock() {
    var now = new Date();
    var sh = new Date(now.getTime() + OFFSET_MS); // 偏移到 UTC+8 的"本地"视图

    var y = sh.getUTCFullYear();
    var mo = sh.getUTCMonth() + 1;
    var d = sh.getUTCDate();
    var hh = sh.getUTCHours();
    var mi = sh.getUTCMinutes();
    var ss = sh.getUTCSeconds();

    var timeText = pad(hh) + ':' + pad(mi) + ':' + pad(ss);
    if (clockTime) { clockTime.textContent = timeText; }
    if (contactClock) { contactClock.textContent = timeText; }

    if (clockDate) {
      clockDate.textContent = y + ' 年 ' + mo + ' 月 ' + d + ' 日';
    }
    if (clockWeekday) {
      // 用 zh-CN 取得"星期X"
      var week = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', timeZone: 'Asia/Shanghai' }).format(now);
      clockWeekday.textContent = week;
    }
    if (clockPhase) {
      clockPhase.textContent = hh >= 6 && hh < 18 ? '☀ 白天模式' : '☾ 夜间模式';
    }

    // 昼夜主题：以"基线时刻"的小时数作为判断参考
    var baseMoment = baselineMomentFor(now);
    var baseHour = new Date(baseMoment.getTime() + OFFSET_MS).getUTCHours();
    var isDay = baseHour >= 6 && baseHour < 18;
    document.body.classList.toggle('is-day', isDay);
    syncThemeButton(isDay);
  }

  /* ===== 深浅色（昼 / 夜）主题切换 ===== */
  var themeToggle = document.getElementById('themeToggle');
  var themeGlyph = document.getElementById('themeGlyph');
  var manualTheme = null; // null 表示跟随时间

  function syncThemeButton(isDay) {
    var day = manualTheme === null ? isDay : manualTheme === 'day';
    if (themeGlyph) { themeGlyph.textContent = day ? '☀' : '☾'; }
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', day ? 'true' : 'false'); }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var nowDay = document.body.classList.contains('is-day');
      manualTheme = nowDay ? 'night' : 'day';
      document.body.classList.toggle('is-day', !nowDay);
      syncThemeButton(!nowDay);
    });
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ===== 导航：平滑滚动 + 当前区块高亮 ===== */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') { return; }
      var target = document.querySelector(id);
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMenu();
      history.replaceState(null, '', id);
    });
  });

  /* 滚动时高亮当前所在的导航项 */
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  function highlightNav() {
    var offset = window.scrollY + window.innerHeight * 0.35;
    var currentId = '';
    sections.forEach(function (sec) {
      if (sec.offsetTop <= offset) { currentId = sec.id; }
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + currentId);
    });
  }

  /* ===== 移动端菜单 ===== */
  var menuToggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');

  function closeMenu() {
    if (!mobileNav || !menuToggle) { return; }
    mobileNav.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ===== 滚动进入动画（IntersectionObserver） ===== */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ===== 技能条填充 ===== */
  var skillPanel = document.getElementById('skillPanel');
  var skillsFilled = false;

  function fillSkills() {
    if (skillsFilled) { return; }
    skillsFilled = true;
    Array.prototype.forEach.call(document.querySelectorAll('.skill-fill'), function (bar) {
      var target = Number(bar.getAttribute('data-target')) || 0;
      window.setTimeout(function () { bar.style.width = target + '%'; }, 120);
    });
  }

  /* ===== 数字滚动统计 ===== */
  var statList = document.getElementById('statList');
  var statsDone = false;

  function runStats() {
    if (statsDone) { return; }
    statsDone = true;
    Array.prototype.forEach.call(document.querySelectorAll('.stat-num'), function (el) {
      var goal = Number(el.getAttribute('data-count')) || 0;
      var start = null;
      var duration = 1200;
      function step(ts) {
        if (start === null) { start = ts; }
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(goal * eased));
        if (p < 1) { window.requestAnimationFrame(step); }
      }
      window.requestAnimationFrame(step);
    });
  }

  if ('IntersectionObserver' in window) {
    var panelObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        fillSkills();
        runStats();
        panelObserver.disconnect();
      });
    }, { threshold: 0.25 });
    if (skillPanel) { panelObserver.observe(skillPanel); }
  } else {
    fillSkills();
    runStats();
  }

  /* ===== 作品筛选 ===== */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var works = Array.prototype.slice.call(document.querySelectorAll('.work'));
  var emptyHint = document.getElementById('emptyHint');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.getAttribute('data-filter');

      chips.forEach(function (c) {
        var active = c === chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      var shown = 0;
      works.forEach(function (card) {
        var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
        var hit = filter === 'all' || tags.indexOf(filter) !== -1;
        card.classList.toggle('is-hidden', !hit);
        if (hit) {
          shown += 1;
          // 重新播放入场动画，让筛选有反馈
          card.classList.remove('is-visible');
          window.requestAnimationFrame(function () { card.classList.add('is-visible'); });
        }
      });

      if (emptyHint) { emptyHint.hidden = shown !== 0; }
    });
  });

  /* ===== 鼠标跟随光晕 ===== */
  var glow = document.getElementById('cursorGlow');
  var glowOn = false;

  if (glow && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', function (event) {
      if (!glowOn) { glow.classList.add('is-on'); glowOn = true; }
      glow.style.transform = 'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0)';
    });
    document.addEventListener('mouseleave', function () {
      glow.classList.remove('is-on');
      glowOn = false;
    });
  }

  /* ===== 打字机效果（标题） ===== */
  var typedName = document.getElementById('typedName');
  if (typedName) {
    var full = typedName.getAttribute('data-text') || typedName.textContent;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      typedName.textContent = full;
      typedName.classList.add('is-done');
    } else {
      typedName.textContent = '';
      var idx = 0;
      window.setTimeout(function tick() {
        idx += 1;
        typedName.textContent = full.slice(0, idx);
        if (idx < full.length) {
          window.setTimeout(tick, 120);
        } else {
          typedName.classList.add('is-done');
        }
      }, 260);
    }
  }

  /* ===== 滚动节流：导航高亮 ===== */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () {
      highlightNav();
      ticking = false;
    });
  }, { passive: true });

  highlightNav();
})();
