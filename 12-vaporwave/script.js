/* =========================================================
   12-vaporwave · 交互脚本
   职责：实时时钟 / 主题切换 / 滚动进场 / 技能条 / 作品筛选
        / 打字机 / 鼠标光晕 / 导航高亮 / 数字滚动
   全部通过 addEventListener 绑定，无内联事件。
   ========================================================= */
(function () {
  'use strict';

  /* ===== 工具函数 ===== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  /* ===== 1. 长沙时间实时时钟（UTC+8） =====
     用 new Date() 实时驱动，日期与星期用 zh-CN 显示。
     注意：本地时区偏移被换算为固定的 UTC+8，保证显示的是长沙时间。 */
  var clockTime = $('#clockTime');
  var clockDate = $('#clockDate');
  var clockMeta = $('#clockMeta');

  // 参考基线：2026-09-14 22:07 (UTC+8)，用于判断当前是否属于夜间时段
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7 };

  function nowInChangsha() {
    var d = new Date();
    // 取 UTC 毫秒数后加 8 小时，得到长沙（UTC+8）的"墙上时间"
    return new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (8 * 3600000));
  }

  function renderClock() {
    var d = nowInChangsha();
    var y = d.getFullYear();
    var mo = d.getMonth() + 1;
    var day = d.getDate();
    var h = d.getHours();
    var mi = d.getMinutes();
    var s = d.getSeconds();
    var weekday = d.toLocaleDateString('zh-CN', { weekday: 'long' });

    if (clockTime) clockTime.textContent = pad2(h) + ':' + pad2(mi) + ':' + pad2(s);
    if (clockDate) clockDate.textContent = y + ' 年 ' + mo + ' 月 ' + day + ' 日 · ' + weekday;
    if (clockMeta) {
      var isNight = h >= 19 || h < 6;
      clockMeta.textContent = 'UTC+8 · 长沙 · ' + (isNight ? '夜间模式时段 ☾' : '白昼模式时段 ☀');
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000); // 每秒刷新

  /* ===== 2. 主题切换（夜行 / 白昼） =====
     参考基线时刻 22:07 属于夜间，因此默认加载为夜行模式。 */
  var body = document.body;
  var themeToggle = $('#themeToggle');
  var themeLabel = $('#themeLabel');
  var themeIcon = themeToggle ? $('.theme-toggle__icon', themeToggle) : null;

  function applyTheme(isDay) {
    body.classList.toggle('is-day', isDay);
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDay));
    if (themeLabel) themeLabel.textContent = isDay ? '白昼模式' : '夜行模式';
    if (themeIcon) themeIcon.textContent = isDay ? '☀' : '☾';
  }

  // 基线时刻 22:07 → 夜间；若当前长沙时间处于 6:00-18:59 则用白昼
  var startHour = nowInChangsha().getHours();
  applyTheme(startHour >= 6 && startHour < 19);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(!body.classList.contains('is-day'));
    });
  }

  /* ===== 3. 鼠标跟随光晕 ===== */
  var aura = document.createElement('div');
  aura.className = 'cursor-aura';
  aura.setAttribute('aria-hidden', 'true');
  document.body.appendChild(aura);

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    window.addEventListener('mousemove', function (e) {
      aura.classList.add('is-on');
      aura.style.setProperty('--mx', e.clientX + 'px');
      aura.style.setProperty('--my', e.clientY + 'px');
    });
    document.addEventListener('mouseleave', function () { aura.classList.remove('is-on'); });
  }

  /* ===== 4. 滚动进入动画 + 技能条 + 数字滚动 =====
     使用 IntersectionObserver；不支持时直接全部显示。 */
  var revealItems = $$('.reveal');

  function runBars(scope) {
    $$('.bar__fill', scope).forEach(function (fill) {
      var val = Number(fill.getAttribute('data-value')) || 0;
      fill.style.width = val + '%';
    });
    $$('.bar__value', scope).forEach(function (out) {
      var target = Number(out.getAttribute('data-count')) || 0;
      var start = null;
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / 900, 1);
        out.textContent = Math.round(target * p) + '%';
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        runBars(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (el) { io.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
    runBars(document);
  }

  /* ===== 5. 打字机效果（循环播放几条自我介绍） ===== */
  var typerText = $('#typerText');
  var LINES = [
    '在长沙写代码，把界面做成 80 年代的梦。',
    '原生 HTML / CSS / JavaScript，零依赖。',
    '喜欢像素、霓虹、落日与网格地平线。'
  ];

  if (typerText) {
    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    var tick = function () {
      var line = LINES[lineIndex];
      if (!deleting) {
        charIndex++;
        typerText.textContent = line.slice(0, charIndex);
        if (charIndex === line.length) {
          deleting = true;
          window.setTimeout(tick, 1600); // 打完停留
          return;
        }
        window.setTimeout(tick, 78);
      } else {
        charIndex--;
        typerText.textContent = line.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % LINES.length;
          window.setTimeout(tick, 320);
          return;
        }
        window.setTimeout(tick, 34);
      }
    };
    tick();
  }

  /* ===== 6. 作品筛选 ===== */
  var filterBtns = $$('.filter');
  var works = $$('.work');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kind = btn.getAttribute('data-filter');

      filterBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });

      works.forEach(function (card) {
        var match = kind === 'all' || card.getAttribute('data-kind') === kind;
        card.classList.toggle('is-hidden', !match);
        if (match) {
          // 重新播放一次进场动画
          card.classList.remove('is-visible');
          window.requestAnimationFrame(function () { card.classList.add('is-visible'); });
        }
      });
    });
  });

  /* ===== 7. 平滑滚动导航 + 当前区块高亮 ===== */
  var navLinks = $$('.nav__link');
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('pulse');
      window.setTimeout(function () { target.classList.remove('pulse'); }, 950);
    });
  });

  // 滚动时根据可视区块切换导航高亮
  var setActive = function (id) {
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
    });
  };

  if ('IntersectionObserver' in window && sections.length) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { threshold: 0.35 });
    sections.forEach(function (s) { navIo.observe(s); });
  }

  /* ===== 8. 网格视差（滚动时背景网格轻微位移） ===== */
  var grid = $('.grid');
  if (grid && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var onScroll = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      if (y < 900) grid.style.transform = 'perspective(340px) rotateX(66deg) translateY(' + (y * 0.05) + 'px)';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
