/* =========================================================
   31-cosmic-space / script.js
   行为集中在这里：星场生成、实时时钟、昼夜主题、打字机、
   数字滚动、技能条、滚动动画、导航高亮、作品筛选、指针光晕
   ========================================================= */
'use strict';

/* ===== 固定参考基线 =====
   网络查询得到的参考时刻：2026-09-14（星期一）22:07 (UTC+8)。
   它只用于判断“当前应该用昼间还是夜间主题”，
   页面上的时钟始终由 new Date() 实时计算，与此基线无关。 */
var BASE_LINE = new Date('2026-09-14T22:07:00+08:00');
var HOUR_MS = 3600000;
var DAY_START_HOUR = 6;   // 06:00 之后算昼
var DAY_END_HOUR = 19;    // 19:00 之后算夜

/* 尊重用户的“减少动效”偏好 */
var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var raf = window.requestAnimationFrame
  ? function (fn) { return window.requestAnimationFrame(fn); }
  : function (fn) { return window.setTimeout(fn, 16); };

function $(selector, scope) {
  return (scope || document).querySelector(selector);
}
function $$(selector, scope) {
  return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
}
function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/* ===== 星场：三层不同大小与速度的星点 ===== */
function initStars() {
  var root = $('#bgStars');
  if (!root) return;

  var tints = [
    'rgba(255,255,255,0.95)',
    'rgba(190,225,255,0.9)',
    'rgba(169,123,255,0.9)',
    'rgba(79,209,255,0.9)'
  ];
  var ratio = Math.min(Math.max(window.innerWidth / 1440, 0.45), 1.4);
  var layers = [
    { count: Math.round(110 * ratio), size: [0.8, 1.4], dur: [2.2, 4.2], layer: 1 },
    { count: Math.round(70 * ratio), size: [1.3, 2.1], dur: [3.2, 6], layer: 2 },
    { count: Math.round(34 * ratio), size: [2, 3.2], dur: [4.6, 8.5], layer: 3 }
  ];

  var fragment = document.createDocumentFragment();
  layers.forEach(function (cfg) {
    var field = document.createElement('div');
    field.className = 'star-field layer-' + cfg.layer;
    for (var i = 0; i < cfg.count; i++) {
      var star = document.createElement('span');
      var bright = Math.random() > 0.86;
      star.className = 'star' + (bright ? ' is-bright' : '');
      star.style.setProperty('--x', (Math.random() * 100).toFixed(2) + '%');
      star.style.setProperty('--y', (Math.random() * 100).toFixed(2) + '%');
      star.style.setProperty('--size', (cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0])).toFixed(2) + 'px');
      star.style.setProperty('--dur', (cfg.dur[0] + Math.random() * (cfg.dur[1] - cfg.dur[0])).toFixed(2) + 's');
      star.style.setProperty('--delay', (Math.random() * 6).toFixed(2) + 's');
      if (bright) star.style.setProperty('--tint', tints[1 + Math.floor(Math.random() * (tints.length - 1))]);
      field.appendChild(star);
    }
    fragment.appendChild(field);
  });
  root.appendChild(fragment);
}

/* ===== 实时时钟：长沙（Asia/Shanghai）年月日 + 时分秒 + 星期 ===== */
function initClock() {
  var dateEl = $('#clockDate');
  var timeEl = $('#clockTime');
  var weekEl = $('#clockWeek');
  if (!dateEl || !timeEl || !weekEl) return;

  var chineseWeek = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var canIntl = false;
  try {
    canIntl = !!new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date());
  } catch (err) {
    canIntl = false;
  }
  var fmtDate = canIntl
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  var fmtTime = canIntl
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : null;
  var fmtWeek = canIntl
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'long' })
    : null;

  // 兜底：无 Intl 时区支持时，用 UTC+8 手动换算
  function fallbackUtc8(now) {
    var shifted = new Date(now.getTime() + 8 * HOUR_MS);
    return {
      date: shifted.getUTCFullYear() + '年' + (shifted.getUTCMonth() + 1) + '月' + shifted.getUTCDate() + '日',
      time: pad2(shifted.getUTCHours()) + ':' + pad2(shifted.getUTCMinutes()) + ':' + pad2(shifted.getUTCSeconds()),
      week: chineseWeek[shifted.getUTCDay()]
    };
  }

  function render() {
    var now = new Date();
    var parsed = canIntl
      ? { date: fmtDate.format(now), time: fmtTime.format(now), week: fmtWeek.format(now) }
      : fallbackUtc8(now);
    dateEl.textContent = parsed.date;
    timeEl.textContent = parsed.time;
    weekEl.textContent = parsed.week;
  }

  render();
  window.setInterval(render, 1000);
}

/* ===== 昼夜主题 =====
   参考基线 2026-09-14 22:07 (UTC+8) 落在夜间，因此默认启用深空夜航主题；
   同时用 new Date() 算出当前真实时段，在标签里给出昼/夜提示。 */
function initTheme() {
  var root = document.documentElement;
  var label = $('#themeLabel');
  var timeLabel = $('#themeTime');

  var baseHour = BASE_LINE.getUTCHours() + 8;              // 参考时刻的 UTC+8 小时数
  var baseIsNight = baseHour < DAY_START_HOUR || baseHour >= DAY_END_HOUR;
  root.setAttribute('data-theme', baseIsNight ? 'night' : 'day');
  if (label) label.textContent = baseIsNight ? '深空夜航' : '昼间巡航';

  // 当前真实时刻的时段提示（仅作说明，不反转主题，避免页面中途跳色）
  var shifted = new Date(Date.now() + 8 * HOUR_MS);
  var hour = shifted.getUTCHours();
  var phase = (hour >= DAY_START_HOUR && hour < DAY_END_HOUR) ? '昼间' : '夜间';
  if (timeLabel) {
    timeLabel.textContent = '基线 2026-09-14 22:07 · UTC+8 · 此刻' + phase;
  }
}

/* ===== 打字机：循环输出个人简介短句 ===== */
function initTypewriter() {
  var el = $('#typeText');
  if (!el) return;

  var lines = [
    '一句话简介：把想法写成能跑的页面。',
    '坐标长沙，白天写码，夜里看星星。',
    '原生 HTML / CSS / JavaScript，从零搭建。',
    '喜欢轻量、可读、加载得动的作品。'
  ];

  if (REDUCE) {
    el.textContent = lines[0];
    return;
  }

  var lineIndex = 0;
  var charIndex = 0;
  var deleting = false;

  function tick() {
    var line = lines[lineIndex];
    charIndex += deleting ? -1 : 1;
    el.textContent = line.slice(0, charIndex);

    var wait = deleting ? 34 : 86;
    if (!deleting && charIndex === line.length) {
      deleting = true;
      wait = 1700;                 // 打完停一会儿
    } else if (deleting && charIndex <= 0) {
      deleting = false;
      lineIndex = (lineIndex + 1) % lines.length;
      wait = 320;
    }
    window.setTimeout(tick, wait);
  }

  tick();
}

/* ===== 数字滚动：HUD 数据 ===== */
function initCounters() {
  $$('.hud-num').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';

    if (REDUCE) {
      el.textContent = target + suffix;
      return;
    }

    var duration = 1500;
    var startAt = 0;

    function step(now) {
      if (!startAt) startAt = now;
      var p = Math.min((now - startAt) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) raf(step);
    }
    raf(step);
  });
}

/* ===== 滚动进入动画 + 技能条动画 ===== */
function initReveal() {
  var items = $$('.reveal');
  var skills = $$('.skill');

  // 技能条：把百分比写进自定义属性，交给 CSS 过渡
  skills.forEach(function (skill) {
    var level = parseFloat(skill.getAttribute('data-level')) || 0;
    skill.style.setProperty('--w', level + '%');
  });

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    skills.forEach(function (el) { el.classList.add('is-filled'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      if (el.classList.contains('reveal')) {
        var siblings = el.parentElement ? $$('.reveal', el.parentElement) : [];
        var order = siblings.indexOf(el);
        el.style.transitionDelay = (order > 0 ? Math.min(order * 70, 350) : 0) + 'ms';
        el.classList.add('is-in');
      }
      if (el.classList.contains('skill')) {
        el.classList.add('is-filled');
      }
      observer.unobserve(el);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el) { observer.observe(el); });
  skills.forEach(function (el) { observer.observe(el); });
}

/* ===== 顶部导航：滚动进度 + 锚点高亮 ===== */
function initNav() {
  var header = $('#siteHeader');
  var progress = $('#scrollProgress');
  var links = $$('.site-nav a');
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (progress) {
      progress.style.width = (max > 0 ? Math.min(y / max, 1) * 100 : 0) + '%';
    }
    if (header) {
      header.classList.toggle('is-scrolled', y > 12);
    }

    // 当前可视区块高亮
    var current = sections[0];
    sections.forEach(function (sec) {
      if (sec.getBoundingClientRect().top <= window.innerHeight * 0.35) current = sec;
    });
    links.forEach(function (a) {
      a.classList.toggle('active', current && a.getAttribute('href') === '#' + current.id);
    });
  }

  // 平滑滚动（由 JS 接管，避免部分浏览器锚点跳变）
  links.forEach(function (a) {
    a.addEventListener('click', function (event) {
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + id);
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}

/* ===== 作品星图筛选 ===== */
function initFilters() {
  var buttons = $$('.filter');
  var cards = $$('#projectList .project');
  if (!buttons.length) return;

  function apply(key) {
    buttons.forEach(function (btn) {
      var on = btn.getAttribute('data-filter') === key;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (card) {
      var match = key === 'all' || card.getAttribute('data-cat') === key;
      card.classList.toggle('is-hidden', !match);
      if (match) {
        // 重放进入动画
        card.classList.remove('is-in');
        void card.offsetWidth;
        card.classList.add('is-in');
      }
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      apply(btn.getAttribute('data-filter'));
    });
  });
}

/* ===== 指针跟随光晕（仅桌面指针设备） ===== */
function initCursorGlow() {
  var glow = $('#cursorGlow');
  if (!glow || REDUCE) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var targetX = window.innerWidth / 2;
  var targetY = window.innerHeight * 0.22;
  var currentX = targetX;
  var currentY = targetY;

  window.addEventListener('mousemove', function (event) {
    targetX = event.clientX;
    targetY = event.clientY;
  }, { passive: true });

  (function loop() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    glow.style.setProperty('--mx', currentX.toFixed(1) + 'px');
    glow.style.setProperty('--my', currentY.toFixed(1) + 'px');
    raf(loop);
  })();
}

/* ===== 页脚年份与联络卡片点击反馈 ===== */
function initMisc() {
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  $$('a.contact-card').forEach(function (card) {
    card.addEventListener('click', function () {
      card.classList.add('is-copied');
      window.setTimeout(function () { card.classList.remove('is-copied'); }, 600);
    });
  });
}

/* ===== 启动 ===== */
function boot() {
  initStars();
  initClock();
  initTheme();
  initTypewriter();
  initCounters();
  initReveal();
  initNav();
  initFilters();
  initCursorGlow();
  initMisc();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
