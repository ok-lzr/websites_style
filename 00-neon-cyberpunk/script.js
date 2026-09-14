/* =========================================================
   00-neon-cyberpunk / script.js
   职责：时钟 / 打字机 / 滚动动画 / 数字滚动 / 技能条 /
         项目筛选 / 导航高亮 / 深浅色切换 / 鼠标光晕 / 霓虹雨
   ========================================================= */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* 参考基线：2026-09-14（星期一）22:07（UTC+8），仅用于昼夜主题初值判断 */
  var BASE_TIME = new Date('2026-09-14T22:07:00+08:00');
  var NIGHT_START = 18; // 18 点后视为夜间
  var NIGHT_END = 6;    // 6 点前视为夜间

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 1. 长沙时间实时时钟（new Date() 驱动） ===== */
  var clockTime = $('#clockTime');
  var clockDate = $('#clockDate');
  var clockWeek = $('#clockWeek');
  var clockMode = $('#clockMode');
  var contactClock = $('#contactClock');
  var clockLed = $('#clockLed');

  var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function renderClock() {
    var now = new Date();
    var hh = pad(now.getHours());
    var mm = pad(now.getMinutes());
    var ss = pad(now.getSeconds());
    var timeText = hh + ':' + mm + ':' + ss;

    if (clockTime) { clockTime.textContent = timeText; }
    if (contactClock) { contactClock.textContent = '长沙时间 ' + timeText; }

    if (clockDate) {
      clockDate.textContent = now.getFullYear() + ' 年 ' +
        pad(now.getMonth() + 1) + ' 月 ' + pad(now.getDate()) + ' 日';
    }
    if (clockWeek) { clockWeek.textContent = WEEK_CN[now.getDay()]; }

    // 用实时小时数判断昼夜，并同步指示灯颜色（类名由 CSS 控制外观）
    var isNight = now.getHours() >= NIGHT_START || now.getHours() < NIGHT_END;
    if (clockMode) { clockMode.textContent = isNight ? '夜' : '昼'; }
    if (clockLed) { clockLed.classList.toggle('is-night', isNight); }
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ===== 2. 打字机效果（首屏一句话简介轮播） ===== */
  var typed = $('#typed');
  var PHRASES = [
    '前端开发 / 数据可视化 / 自动化脚本',
    '把想法编译成霓虹，把重复交给脚本。',
    '坐标：湖南省长沙市 · 常年夜行'
  ];

  function startTyping() {
    if (!typed) { return; }
    if (reduceMotion) { typed.textContent = PHRASES[0]; return; }

    var pIndex = 0;
    var cIndex = 0;
    var deleting = false;

    function tick() {
      var text = PHRASES[pIndex];
      cIndex += deleting ? -1 : 1;
      typed.textContent = text.slice(0, cIndex);

      var delay = deleting ? 34 : 72;
      if (!deleting && cIndex === text.length) {
        deleting = true;
        delay = 1600;
      } else if (deleting && cIndex === 0) {
        deleting = false;
        pIndex = (pIndex + 1) % PHRASES.length;
        delay = 380;
      }
      window.setTimeout(tick, delay);
    }

    tick();
  }

  startTyping();

  /* ===== 3. 滚动进入动画（IntersectionObserver） ===== */
  var revealItems = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ===== 4. 数字滚动（个人数据区） ===== */
  var counters = $$('.stat-num');

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduceMotion) { el.textContent = String(target); return; }

    var duration = 1200;
    var start = null;

    function step(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) { window.requestAnimationFrame(step); }
    }

    window.requestAnimationFrame(step);
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach(runCounter);
  } else {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach(function (el) { counterObserver.observe(el); });
  }

  /* ===== 5. 技能条充能动画 ===== */
  var bars = $$('.bar-fill');

  function fillBar(el) {
    var value = Math.max(0, Math.min(100, parseInt(el.getAttribute('data-value'), 10) || 0));
    el.style.width = value + '%';
  }

  if (!('IntersectionObserver' in window)) {
    bars.forEach(fillBar);
  } else {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          fillBar(entry.target);
          barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    bars.forEach(function (el) { barObserver.observe(el); });
  }

  /* ===== 6. 项目分类筛选 ===== */
  var filterBar = $('#filterBar');
  var cards = $$('#projectGrid .card');
  var filterEmpty = $('#filterEmpty');

  if (filterBar) {
    filterBar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter-btn');
      if (!btn) { return; }

      var filter = btn.getAttribute('data-filter');
      var shown = 0;

      $$('.filter-btn', filterBar).forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      cards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-cat') === filter;
        card.classList.toggle('is-hidden', !match);
        if (match) {
          shown += 1;
          // 重新触发一次进入动画，让筛选结果有反馈
          card.classList.remove('is-visible');
          window.requestAnimationFrame(function () { card.classList.add('is-visible'); });
        }
      });

      if (filterEmpty) { filterEmpty.hidden = shown !== 0; }
    });
  }

  /* ===== 7. 导航平滑滚动 + 当前区段高亮 ===== */
  var navLinks = $$('.nav-link');
  var sections = navLinks
    .map(function (link) { return $(link.getAttribute('href')); })
    .filter(Boolean);

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var target = $(link.getAttribute('href'));
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  });

  function syncActiveNav() {
    if (!sections.length) { return; }
    var offset = window.scrollY + window.innerHeight * 0.32;
    var current = sections[0];

    sections.forEach(function (section) {
      if (section.offsetTop <= offset) { current = section; }
    });

    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + current.id);
    });
  }

  /* ===== 8. 滚动进度条 ===== */
  var progress = $('#scrollProgress');

  function syncProgress() {
    if (!progress) { return; }
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? (window.scrollY / max) : 0;
    progress.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(2) + '%';
  }

  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) { return; }
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      syncActiveNav();
      syncProgress();
      scrollTicking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ===== 9. 深浅色（夜 / 昼）主题切换 ===== */
  var themeToggle = $('#themeToggle');
  var themeIcon = $('#themeIcon');
  var themeText = $('#themeText');
  var root = document.documentElement;
  var STORE_KEY = 'ok-lzr-neon-theme';

  function paintThemeSwitcher(theme) {
    var night = theme !== 'day';
    if (themeIcon) { themeIcon.textContent = night ? '☾' : '☀'; }
    if (themeText) { themeText.textContent = night ? '夜间模式' : '日间模式'; }
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', night ? 'false' : 'true'); }
  }

  function applyTheme(theme, remember) {
    root.setAttribute('data-theme', theme);
    paintThemeSwitcher(theme);
    if (remember) {
      try { window.localStorage.setItem(STORE_KEY, theme); } catch (e) { /* 隐私模式忽略 */ }
    }
  }

  function initialTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
    if (saved === 'day' || saved === 'night') { return saved; }

    // 没有存档时：以参考基线时刻 2026-09-14 22:07 的昼夜规律决定初值
    var hour = BASE_TIME.getHours();
    var night = hour >= NIGHT_START || hour < NIGHT_END;
    return night ? 'night' : 'day';
  }

  applyTheme(initialTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'day' ? 'night' : 'day';
      applyTheme(next, true);
    });
  }

  /* ===== 10. 鼠标跟随光晕 ===== */
  var glow = $('#bgGlow');

  if (glow && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    var gx = 0;
    var gy = 0;
    var cx = 0;
    var cy = 0;
    var glowOn = false;

    window.addEventListener('mousemove', function (event) {
      gx = event.clientX;
      gy = event.clientY;
      if (!glowOn) {
        glowOn = true;
        glow.classList.add('is-on');
      }
    });

    (function followGlow() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      window.requestAnimationFrame(followGlow);
    })();
  }

  /* ===== 11. 霓虹雨背景（Canvas，纯装饰） ===== */
  var canvas = $('#neonRain');

  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var drops = [];
    var COLORS = ['0, 240, 255', '255, 43, 214', '139, 92, 255'];
    var fontSize = 14;
    var step = 18;

    function resizeCanvas() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.ceil(w / step);
      drops = [];
      for (var i = 0; i < count; i += 1) {
        drops.push({
          x: i * step + 4,
          y: Math.random() * h,
          speed: 0.6 + Math.random() * 1.6,
          len: 4 + Math.floor(Math.random() * 12),
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }

    function drawRain() {
      if (document.hidden) { window.requestAnimationFrame(drawRain); return; }

      var h = window.innerHeight;
      ctx.clearRect(0, 0, window.innerWidth, h);
      ctx.font = fontSize + 'px ' + 'monospace';
      ctx.textAlign = 'center';

      drops.forEach(function (drop) {
        for (var k = 0; k < drop.len; k += 1) {
          var alpha = (1 - k / drop.len) * 0.5;
          ctx.fillStyle = 'rgba(' + drop.color + ',' + alpha.toFixed(2) + ')';
          ctx.fillText(k === 0 ? '1' : '0', drop.x, drop.y - k * step);
        }
        drop.y += drop.speed * fontSize * 0.55;
        if (drop.y - drop.len * step > h) {
          drop.y = -Math.random() * 200;
          drop.speed = 0.6 + Math.random() * 1.6;
        }
      });

      window.requestAnimationFrame(drawRain);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    drawRain();
  }
})();
