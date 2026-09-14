/* ==========================================================================
   盖茨比奢华 · Art Deco Gatsby —— 交互脚本
   包含：实时时钟 / 昼夜主题 / 滚动进入动画 / 数字滚动 / 技能条 / 作品筛选 / 导航高亮
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 参考基线时刻 =====
     来自网络查询的参考时刻：2026-09-14（星期一）22:07 UTC+8
     仅用于初次加载时判断昼 / 夜主题，时钟本身仍用 new Date() 实时更新。 */
  var BASELINE = new Date('2026-09-14T22:07:00+08:00');

  var root = document.documentElement;

  /* ===== 1. 长沙实时时钟 ===== */
  var clockTime = document.getElementById('clockTime');
  var clockDate = document.getElementById('clockDate');
  var clockWeekday = document.getElementById('clockWeekday');
  var clockPhase = document.getElementById('clockPhase');
  var contactClock = document.getElementById('contactClock');

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  // 取 UTC+8 的本地时间分量（长沙无夏令时，固定偏移）
  function changshaParts() {
    var now = new Date();
    var utc8 = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
    return {
      year: utc8.getFullYear(),
      month: utc8.getMonth() + 1,
      day: utc8.getDate(),
      hour: utc8.getHours(),
      minute: utc8.getMinutes(),
      second: utc8.getSeconds(),
      weekdayIndex: utc8.getDay()
    };
  }

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 根据小时判断时段标签
  function phaseOf(hour) {
    if (hour >= 5 && hour < 11) { return '清晨'; }
    if (hour >= 11 && hour < 14) { return '正午'; }
    if (hour >= 14 && hour < 18) { return '午后'; }
    if (hour >= 18 && hour < 22) { return '夜晚'; }
    return '深夜';
  }

  // 是否应使用昼间主题（06:00 - 18:00 为昼）
  function isDaytime(hour) {
    return hour >= 6 && hour < 18;
  }

  function tick() {
    var t = changshaParts();

    var hms = pad(t.hour) + ':' + pad(t.minute) + ':' + pad(t.second);
    var ymd = t.year + ' 年 ' + pad(t.month) + ' 月 ' + pad(t.day) + ' 日';

    if (clockTime) { clockTime.textContent = hms; }
    if (clockDate) { clockDate.textContent = ymd; }
    if (clockWeekday) { clockWeekday.textContent = WEEKDAYS[t.weekdayIndex]; }
    if (clockPhase) { clockPhase.textContent = phaseOf(t.hour); }
    if (contactClock) { contactClock.textContent = hms; }

    // 用户未手动选择过主题时，随昼夜变化自动切换
    if (!userPicked) {
      var mode = isDaytime(t.hour) ? 'day' : 'night';
      if (autoMode === null) {
        autoMode = mode; // 首次只记录，保留基线时刻给出的初始主题
      } else if (autoMode !== mode) {
        autoMode = mode;
        applyTheme(mode);
      }
    }
  }

  /* ===== 2. 昼夜主题切换 ===== */
  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var themeText = document.getElementById('themeText');
  var userPicked = false;  // 用户点击过开关后，不再自动跟随昼夜
  var autoMode = null;     // 上一次自动判断的昼夜状态

  function applyTheme(mode) {
    root.setAttribute('data-theme', mode);
    var isDay = mode === 'day';
    if (themeIcon) { themeIcon.textContent = isDay ? '☀' : '☾'; }
    if (themeText) { themeText.textContent = isDay ? '昼之宴' : '夜之宴'; }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      userPicked = true;
      var current = root.getAttribute('data-theme') === 'day' ? 'day' : 'night';
      applyTheme(current === 'day' ? 'night' : 'day');
    });
  }

  // 首次进入：用参考基线时刻（2026-09-14 22:07 UTC+8 → 夜）决定初始主题
  applyTheme(isDaytime((BASELINE.getUTCHours() + 8) % 24) ? 'day' : 'night');
  tick();
  window.setInterval(tick, 1000);

  /* ===== 3. 滚动进入动画（IntersectionObserver） ===== */
  var revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ===== 4. 数字滚动统计 ===== */
  var statNums = document.querySelectorAll('.stat-num');

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10) || 0;
    var duration = 1500;
    var start = null;

    function step(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      // 缓出曲线，末尾减速更自然
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString('zh-CN');
      if (progress < 1) { window.requestAnimationFrame(step); }
    }

    window.requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statNums.forEach(function (el) { statObserver.observe(el); });
  } else {
    statNums.forEach(function (el) {
      el.textContent = (parseInt(el.getAttribute('data-target'), 10) || 0).toLocaleString('zh-CN');
    });
  }

  /* ===== 5. 技能条动画 ===== */
  var skillFills = document.querySelectorAll('.skill-fill');

  if ('IntersectionObserver' in window) {
    var skillObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var level = entry.target.getAttribute('data-level') || '0';
          entry.target.style.width = level + '%'; /* 仅设置进度数值宽度 */
          skillObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    skillFills.forEach(function (el) { skillObserver.observe(el); });
  } else {
    skillFills.forEach(function (el) {
      el.style.width = (el.getAttribute('data-level') || '0') + '%';
    });
  }

  /* ===== 6. 作品筛选 ===== */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var workCards = document.querySelectorAll('.work-card');
  var filterEmpty = document.getElementById('filterEmpty');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-filter');
      var shown = 0;

      filterBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      workCards.forEach(function (card) {
        var match = key === 'all' || card.getAttribute('data-cat') === key;
        card.classList.toggle('is-hidden', !match);
        if (match) { shown += 1; }
      });

      if (filterEmpty) { filterEmpty.hidden = shown !== 0; }
    });
  });

  /* ===== 7. 平滑滚动 + 导航高亮 ===== */
  var navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#') { return; }
      var target = document.querySelector(href);
      if (!target) { return; }

      event.preventDefault();
      // 目标区块由 CSS 的 scroll-margin-top 预留吸顶导航高度
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var sections = document.querySelectorAll('main section[id]');

  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var id = entry.target.getAttribute('id');
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      });
    }, { threshold: 0.35 });

    sections.forEach(function (sec) { navObserver.observe(sec); });
  }
})();
