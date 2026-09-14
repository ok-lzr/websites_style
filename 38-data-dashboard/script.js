/* =========================================================
   38-data-dashboard · 交互脚本
   模块：主题切换 / 实时时钟 / 侧边栏抽屉 / 平滑滚动
        / 滚动进入动画 / 技能条与柱状图 / 数字滚动
        / 项目筛选 / 返回顶部
   ========================================================= */
(function () {
  'use strict';

  /* ===== 主题切换（记忆到 localStorage） ===== */
  var themeToggle = document.getElementById('themeToggle');
  var themeLabel = themeToggle ? themeToggle.querySelector('.theme-label') : null;
  var themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
    if (themeLabel) themeLabel.textContent = isDark ? '日间模式' : '夜间模式';
    if (themeIcon) themeIcon.textContent = isDark ? '☀' : '☾';
  }

  var savedTheme = null;
  try { savedTheme = window.localStorage.getItem('dash-theme'); } catch (e) { savedTheme = null; }
  // 参考基线：2026-09-14 22:07（UTC+8）为夜间，故无记忆时默认夜间
  applyTheme(savedTheme || 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { window.localStorage.setItem('dash-theme', next); } catch (e) { /* 忽略隐私模式报错 */ }
    });
  }

  /* ===== 实时时钟（始终使用 new Date()，每秒刷新） ===== */
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var clockTime = document.getElementById('clockTime');
  var clockDate = document.getElementById('clockDate');
  var topClock = document.getElementById('topClock');
  var contactClock = document.getElementById('contactClock');
  var contactDate = document.getElementById('contactDate');
  var dayPhase = document.getElementById('dayPhase');
  var clockTrackFill = document.getElementById('clockTrackFill');
  var clockProgress = document.getElementById('clockProgress');

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function tick() {
    var now = new Date();
    var hh = pad(now.getHours());
    var mm = pad(now.getMinutes());
    var ss = pad(now.getSeconds());
    var timeText = hh + ':' + mm + ':' + ss;
    var dateText = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEK[now.getDay()];

    if (clockTime) clockTime.textContent = timeText;
    if (clockDate) clockDate.textContent = dateText;
    if (topClock) topClock.textContent = timeText;
    if (contactClock) contactClock.textContent = timeText;
    if (contactDate) contactDate.textContent = dateText;

    // 昼夜判断：6:00-17:59 视为白天
    if (dayPhase) {
      var h = now.getHours();
      var isDay = h >= 6 && h < 18;
      dayPhase.textContent = isDay ? '☀ 白天' : '☾ 夜间';
    }

    // 今日进度条
    var passed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    var percent = Math.round((passed / 86400) * 100);
    if (clockTrackFill) clockTrackFill.style.width = percent + '%';
    if (clockProgress) clockProgress.textContent = '今日进度 ' + percent + '%';
  }

  tick();
  window.setInterval(tick, 1000);

  /* ===== 侧边栏抽屉 + 平滑滚动 + 导航高亮 ===== */
  var navToggle = document.getElementById('navToggle');
  var sidebar = document.getElementById('sidebar');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (navToggle && sidebar) {
    navToggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  function closeSidebar() {
    if (sidebar && sidebar.classList.contains('is-open')) {
      sidebar.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeSidebar();
    });
  });

  // 滚动时高亮当前区块
  function highlightNav() {
    var offset = window.scrollY + 120;
    var current = sections[0];
    sections.forEach(function (section) {
      if (section.offsetTop <= offset) current = section;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', current && link.getAttribute('href') === '#' + current.id);
    });
  }
  window.addEventListener('scroll', highlightNav, { passive: true });
  highlightNav();

  /* ===== 滚动进入动画（IntersectionObserver） ===== */
  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll('.section, .card, .metric-card, .project-card')
  );

  if ('IntersectionObserver' in window) {
    revealTargets.forEach(function (el) { el.classList.add('reveal'); });
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ===== 技能条动画 + 数字滚动 + 柱状图 ===== */
  function animateCount(el) {
    var target = Number(el.getAttribute('data-count')) || 0;
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString('zh-CN');
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  function animateBar(item) {
    var fill = item.querySelector('.bar-fill');
    var num = item.querySelector('.bar-num');
    var width = Number(fill && fill.getAttribute('data-width')) || 0;
    if (fill) fill.style.width = width + '%';
    if (num) {
      var target = Number(num.getAttribute('data-target')) || width;
      var count = 0;
      var timer = window.setInterval(function () {
        count += Math.max(1, Math.round(target / 26));
        if (count >= target) { count = target; window.clearInterval(timer); }
        num.textContent = count + '%';
      }, 34);
    }
  }

  function animateChart(card) {
    Array.prototype.slice.call(card.querySelectorAll('.chart-bar')).forEach(function (bar, index) {
      var height = bar.getAttribute('data-height') || 0;
      window.setTimeout(function () { bar.style.height = height + '%'; }, index * 90);
    });
  }

  // 统计类元素进入视口后各触发一次
  var statTargets = [];
  Array.prototype.slice.call(document.querySelectorAll('.bar-item')).forEach(function (item) {
    statTargets.push({ el: item, run: function () { animateBar(item); } });
  });
  Array.prototype.slice.call(document.querySelectorAll('.metric-value')).forEach(function (el) {
    statTargets.push({ el: el, run: function () { animateCount(el); } });
  });
  Array.prototype.slice.call(document.querySelectorAll('.chart-card')).forEach(function (card) {
    statTargets.push({ el: card, run: function () { animateChart(card); } });
  });

  if ('IntersectionObserver' in window) {
    var statObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var match = statTargets.filter(function (item) { return item.el === entry.target; })[0];
        if (match) match.run();
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    statTargets.forEach(function (item) { statObserver.observe(item.el); });
  } else {
    statTargets.forEach(function (item) { item.run(); });
  }

  /* ===== 进度环交互 ===== */
  var STATUS_MIN = 42;
  var STATUS_MAX = 96;
  var status = 68;
  var ring = document.getElementById('statusRing');
  var ringValue = document.getElementById('statusRingValue');
  var ringBoost = document.getElementById('ringBoost');

  function renderRing() {
    if (ringValue) ringValue.textContent = status + '%';
    if (ring) {
      var deg = Math.round((status / 100) * 360);
      ring.style.background =
        'conic-gradient(var(--accent) 0deg, var(--accent-2) ' + deg + 'deg, var(--surface-3) ' + deg + 'deg)';
    }
  }

  if (ringBoost) {
    ringBoost.addEventListener('click', function () {
      status = status >= STATUS_MAX ? STATUS_MIN : Math.min(STATUS_MAX, status + 7);
      renderRing();
      ringBoost.textContent = status >= STATUS_MAX ? '已满 · 重新校准' : '+ 提升活跃度';
    });
  }
  renderRing();

  /* ===== 项目筛选（标签页式） ===== */
  var filterBar = document.getElementById('filterBar');
  var projectCards = Array.prototype.slice.call(document.querySelectorAll('.project-card'));
  var filterEmpty = document.getElementById('filterEmpty');

  if (filterBar) {
    var filterBtns = Array.prototype.slice.call(filterBar.querySelectorAll('.filter-btn'));
    filterBar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter-btn');
      if (!btn) return;
      var filter = btn.getAttribute('data-filter');
      var visible = 0;

      filterBtns.forEach(function (item) {
        var active = item === btn;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });

      projectCards.forEach(function (card) {
        var cats = (card.getAttribute('data-cat') || '').split(/\s+/);
        var show = filter === 'all' || cats.indexOf(filter) !== -1;
        card.classList.toggle('is-hidden', !show);
        if (show) visible++;
      });

      if (filterEmpty) filterEmpty.hidden = visible > 0;
    });
  }

  /* ===== 返回顶部 ===== */
  var toTop = document.getElementById('toTop');

  function syncToTop() {
    if (!toTop) return;
    toTop.classList.toggle('is-show', window.scrollY > 420);
  }
  window.addEventListener('scroll', syncToTop, { passive: true });
  syncToTop();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
