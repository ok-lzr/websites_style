/* =========================================================
   18-geometric · 交互脚本
   职责：实时时钟、昼夜主题、滚动进入动画、技能条、
         作品筛选、导航高亮、移动端菜单、回到顶部
   ========================================================= */

(function () {
  'use strict';

  /* ===== 参考基线时刻 =====
     2026-09-14（星期一）22:07（UTC+8）是来自网络查询的参考时刻，
     仅用于在没有其他线索时判断夜/昼主题的默认值。
     页面时钟本身始终使用 new Date() 实时更新。 */
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7 };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ---------- 实时时钟 ---------- */
  var clockTimeEl = document.getElementById('clockTime');
  var clockDateEl = document.getElementById('clockDate');
  var clockWeekEl = document.getElementById('clockWeek');
  var clockPhaseEl = document.getElementById('clockPhase');
  var contactClockEl = document.getElementById('contactClock');

  // 依据小时数判断昼夜（6:00-18:00 视为白昼）
  function phaseOf(hour) {
    if (hour >= 6 && hour < 12) return '上午 · 白昼';
    if (hour >= 12 && hour < 18) return '下午 · 白昼';
    if (hour >= 18 && hour < 23) return '夜间 · 夜模式';
    return '深夜 · 夜模式';
  }

  function renderClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();
    var timeText = pad2(h) + ':' + pad2(m) + ':' + pad2(s);

    if (clockTimeEl) clockTimeEl.textContent = timeText;
    if (contactClockEl) contactClockEl.textContent = timeText;

    // 用 zh-CN 显示年月日与星期
    var dateText = now.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    if (clockDateEl) clockDateEl.textContent = dateText;
    if (clockWeekEl) clockWeekEl.textContent = WEEKDAYS[now.getDay()];

    if (clockPhaseEl) {
      var phase = phaseOf(h);
      clockPhaseEl.textContent = phase;
      clockPhaseEl.setAttribute('data-phase', phase.indexOf('夜') === -1 ? 'day' : 'night');
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ---------- 昼夜主题切换 ---------- */
  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var themeLabel = document.getElementById('themeLabel');
  var root = document.documentElement;

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    if (themeIcon) themeIcon.textContent = isDark ? '☀' : '◐';
    if (themeLabel) themeLabel.textContent = isDark ? '日模式' : '夜模式';
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
  }

  // 初始主题：优先 localStorage，其次参考基线时刻（22:07 → 夜）
  function initialTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem('geo-theme'); } catch (e) { saved = null; }
    if (saved === 'dark' || saved === 'light') return saved;

    var now = new Date();
    var refMinutes = BASELINE.hour * 60 + BASELINE.minute;
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    // 与 22:07 参考时刻同处夜间时段则用夜模式
    return (nowMinutes >= refMinutes - 240 || nowMinutes <= 6 * 60) ? 'dark' : 'light';
  }

  applyTheme(initialTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isDark = root.getAttribute('data-theme') === 'dark';
      var next = isDark ? 'light' : 'dark';
      applyTheme(next);
      try { window.localStorage.setItem('geo-theme', next); } catch (e) { /* 隐私模式忽略 */ }
    });
  }

  /* ---------- 移动端导航菜单 ---------- */
  var menuToggle = document.getElementById('menuToggle');
  var siteNav = document.getElementById('siteNav');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

  function closeMenu() {
    if (!siteNav) return;
    siteNav.classList.remove('is-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  }

  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', function () {
      var open = siteNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // 点击导航后收起菜单（平滑滚动由 CSS scroll-behavior 负责）
  navLinks.forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  /* ---------- 当前栏目高亮 ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));

  function highlightNav(id) {
    navLinks.forEach(function (link) {
      var match = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-current', match);
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) highlightNav(entry.target.id);
      });
    }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });

    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ---------- 滚动进入动画 + 技能条 ---------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var skillItems = Array.prototype.slice.call(document.querySelectorAll('.skill'));

  function fillSkill(skill) {
    if (skill.dataset.done === '1') return;
    skill.dataset.done = '1';
    var level = Number(skill.dataset.level) || 0;
    var fill = skill.querySelector('.skill-fill');
    if (fill) fill.style.width = level + '%';
  }

  function showImmediately(el) {
    el.classList.add('is-visible');
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        showImmediately(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    revealItems.forEach(function (item) { revealObserver.observe(item); });

    var skillObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) fillSkill(entry.target);
      });
    }, { threshold: 0.35 });

    skillItems.forEach(function (skill) { skillObserver.observe(skill); });
  } else {
    // 不支持观察器时直接呈现，保证内容可见
    revealItems.forEach(showImmediately);
    skillItems.forEach(fillSkill);
  }

  /* ---------- 数字滚动（个人数据区）---------- */
  var statsBox = document.getElementById('stats');

  function runCounters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('.stat-num'));
    nums.forEach(function (el) {
      if (el.dataset.done === '1') return;
      el.dataset.done = '1';

      var target = Number(el.dataset.count) || 0;
      var suffix = el.dataset.suffix || '';
      var duration = 1200;
      var start = null;

      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    });
  }

  if (statsBox) {
    if ('IntersectionObserver' in window) {
      var statObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounters();
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      statObserver.observe(statsBox);
    } else {
      runCounters();
    }
  }

  /* ---------- 作品筛选（标签页）---------- */
  var filterBar = document.getElementById('filterBar');
  var workList = document.getElementById('workList');
  var filterEmpty = document.getElementById('filterEmpty');

  if (filterBar && workList) {
    var filterBtns = Array.prototype.slice.call(filterBar.querySelectorAll('.filter-btn'));
    var works = Array.prototype.slice.call(workList.querySelectorAll('.work'));

    filterBar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter-btn');
      if (!btn) return;

      var key = btn.dataset.filter;
      filterBtns.forEach(function (item) {
        var active = item === btn;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });

      var visible = 0;
      works.forEach(function (work) {
        var match = key === 'all' || work.dataset.cat === key;
        work.classList.toggle('is-hidden', !match);
        if (match) visible += 1;
      });

      if (filterEmpty) filterEmpty.hidden = visible !== 0;
    });
  }

  /* ---------- 回到顶部 ---------- */
  var toTop = document.getElementById('toTop');

  function onScroll() {
    if (!toTop) return;
    toTop.classList.toggle('is-visible', window.scrollY > 400);
  }

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 点击空白处收起移动端菜单 ---------- */
  document.addEventListener('click', function (event) {
    if (!siteNav || !siteNav.classList.contains('is-open')) return;
    if (siteNav.contains(event.target) || (menuToggle && menuToggle.contains(event.target))) return;
    closeMenu();
  });
})();
