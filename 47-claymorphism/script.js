/* =========================================================
   47-claymorphism · 交互脚本
   行为：实时时钟 / 主题切换 / 技能切换 / 作品筛选 /
         滚动进入动画 / 数字滚动 / 导航高亮 / 回到顶部
   ========================================================= */
(function () {
  'use strict';

  /* ===== 参考基线：网络查询得到的当天时刻（UTC+8）=====
     2026-09-14 星期一 22:07 —— 仅用于一次性推断昼夜主题，
     实时时钟本身始终由 new Date() 驱动。 */
  var BASELINE = {
    year: 2026,
    month: 9,       // 9 月
    day: 14,
    hour: 22,
    minute: 7,
    weekLabel: '星期一'
  };

  var body = document.body;
  var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  /* ===== 实时时钟：长沙时间（UTC+8）===== */
  var clockDate = document.getElementById('clockDate');
  var clockTime = document.getElementById('clockTime');
  var clockWeek = document.getElementById('clockWeek');
  var contactClock = document.getElementById('contactClock');
  var lastPeriod = null;

  // 取 UTC+8 的“墙上时间”，避免受访问者本地时区影响
  function nowInChangsha() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 8 * 3600000);
  }

  function renderClock() {
    var d = nowInChangsha();
    var h = d.getHours();
    var period = (h >= 6 && h < 18) ? 'day' : 'night';

    clockDate.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    clockWeek.textContent = WEEK_CN[d.getDay()];
    clockTime.textContent = pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());

    if (contactClock) {
      contactClock.textContent = pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    // 依据真实时段自动调整初始主题（用户手动切换后不再干预）
    if (period !== lastPeriod) {
      lastPeriod = period;
      if (!state.userThemed) {
        applyTheme(period === 'night' ? 'night' : 'day');
      }
    }
  }

  /* ===== 主题切换 ===== */
  var themeBtn = document.getElementById('themeBtn');
  var themeIcon = document.getElementById('themeIcon');
  var themeText = document.getElementById('themeText');

  var state = { userThemed: false, theme: 'day' };

  function applyTheme(theme) {
    state.theme = theme;
    body.classList.toggle('theme-night', theme === 'night');
    if (themeIcon) themeIcon.textContent = theme === 'night' ? '☀️' : '🌙';
    if (themeText) themeText.textContent = theme === 'night' ? '日灯' : '夜灯';
    if (themeBtn) themeBtn.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
  }

  function initTheme() {
    // 用基线时刻先给一个合理的初始主题，随后时钟会按真实时段接管
    var baseHour = BASELINE.hour;
    applyTheme((baseHour >= 6 && baseHour < 18) ? 'day' : 'night');

    themeBtn.addEventListener('click', function () {
      state.userThemed = true;   // 用户已手动选择，之后不再自动覆盖
      applyTheme(state.theme === 'night' ? 'day' : 'night');
    });
  }

  /* ===== 技能切换 + 技能条动画 ===== */
  var skillData = {
    html: {
      title: 'HTML / CSS',
      desc: '语义化结构 + 变量化样式，追求像素级的手感与可维护性。',
      value: 92
    },
    js: {
      title: 'JavaScript',
      desc: '原生 DOM、事件与异步流程，不依赖框架也能做出顺滑交互。',
      value: 85
    },
    design: {
      title: '视觉设计',
      desc: '偏爱厚实圆角与糖果配色，喜欢用阴影堆出立体的手感。',
      value: 78
    },
    data: {
      title: '数据可视化',
      desc: '把枯燥数字翻译成一眼能读懂的图形与色彩。',
      value: 74
    }
  };

  function initSkills() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.skill'));
    var bars = Array.prototype.slice.call(document.querySelectorAll('.bar'));
    var title = document.getElementById('skillTitle');
    var desc = document.getElementById('skillDesc');
    if (!buttons.length) return;

    function paint(key) {
      var info = skillData[key];
      if (!info) return;
      title.textContent = info.title;
      desc.textContent = info.desc;

      buttons.forEach(function (btn) {
        var on = btn.getAttribute('data-skill') === key;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      bars.forEach(function (bar) {
        var fill = bar.querySelector('.bar__fill');
        var on = bar.getAttribute('data-bar') === key;
        bar.classList.toggle('is-active', on);
        fill.style.width = (on ? info.value : 0) + '%';
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        paint(btn.getAttribute('data-skill'));
      });
    });

    // 首次进入：等技能区可见后再把默认条拉起来
    paint('html');
  }

  /* ===== 作品筛选 ===== */
  function initFilters() {
    var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.filter'));
    var works = Array.prototype.slice.call(document.querySelectorAll('.work'));
    if (!filterBtns.length) return;

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-filter');

        filterBtns.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });

        works.forEach(function (item) {
          var show = key === 'all' || item.getAttribute('data-cat') === key;
          item.classList.toggle('is-hidden', !show);
          if (show) {
            // 重新触发一次进入动画
            item.classList.remove('is-visible');
            window.requestAnimationFrame(function () {
              item.classList.add('is-visible');
            });
          }
        });
      });
    });
  }

  /* ===== 滚动进入动画（IntersectionObserver）===== */
  function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ===== 数字滚动 ===== */
  function initCounters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('.stat__num'));
    if (!nums.length) return;

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var start = null;
      var dur = 1200;

      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
        el.textContent = String(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { io.observe(el); });
  }

  /* ===== 导航高亮（滚动监听）===== */
  function initNavHighlight() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);
    if (!sections.length) return;

    function update() {
      var pos = window.scrollY + 160;
      var current = sections[0];
      sections.forEach(function (sec) {
        if (sec.offsetTop <= pos) current = sec;
      });
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + current.id);
      });
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ===== 回到顶部 ===== */
  function initToTop() {
    var btn = document.getElementById('toTop');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ===== 平滑滚动（对不支持 CSS smooth 的环境兜底）===== */
  function initSmoothScroll() {
    var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]'));
    anchors.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();
    renderClock();
    window.setInterval(renderClock, 1000);

    initSkills();
    initFilters();
    initReveal();
    initCounters();
    initNavHighlight();
    initToTop();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
