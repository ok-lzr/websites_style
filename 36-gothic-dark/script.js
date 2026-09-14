/* =========================================================
   36-gothic-dark · 哥特暗黑个人主页 · 行为脚本
   ---------------------------------------------------------
   本文件只负责"行为"：昼夜主题、长沙时钟、平滑导航、滚动揭示、
   技能条、作品筛选、数字滚动、打字机、烛光跟随。
   结构在 index.html，样式在 style.css，此处不写大段样式。
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 通用小工具 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pad2 = function (n) { n = String(n); return n.length < 2 ? '0' + n : n; };

  /* =======================================================
     一、昼夜主题
     参考基准：2026-09-14 22:07（UTC+8，来自网络查询）→ 属于夜晚，
     因此首屏默认进入"夜之弥撒"；用户可随时手动切换。
     颜色令牌集中在 style.css 的 :root / [data-theme="day"]。
     ======================================================= */
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7, utcOffset: 8 };
  var NIGHT_START = 19; // 19:00 起算夜
  var NIGHT_END = 6;    // 06:00 前仍算夜

  var themeToggle = $('#themeToggle');
  var themeIcon = $('#themeIcon');
  var themeLabel = $('#themeLabel');

  function baselineTheme() {
    return (BASELINE.hour >= NIGHT_START || BASELINE.hour < NIGHT_END) ? 'night' : 'day';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var isNight = theme === 'night';
    if (themeIcon) { themeIcon.textContent = isNight ? '☾' : '☀'; }
    if (themeLabel) { themeLabel.textContent = isNight ? '夜之弥撒' : '日之弥撒'; }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isNight));
      themeToggle.setAttribute('aria-label', isNight ? '当前为夜间主题，点击切换到日间' : '当前为日间主题，点击切换到夜间');
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
    });
  }
  applyTheme(baselineTheme());

  /* =======================================================
     二、长沙实时时钟（UTC+8）
     显示：年月日 / 时:分:秒 / 星期，按 zh-CN 输出，每秒刷新。
     优先使用 Intl 的 Asia/Shanghai 时区，不支持时回退为手动偏移。
     ======================================================= */
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var shanghaiFormatter = null;
  try {
    shanghaiFormatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (err) {
    shanghaiFormatter = null; // 旧环境不支持时区参数，走手动换算
  }

  function readChangsha(now) {
    if (shanghaiFormatter) {
      var parts = {};
      shanghaiFormatter.formatToParts(now).forEach(function (part) {
        if (part.type !== 'literal') { parts[part.type] = part.value; }
      });
      var hour = Number(parts.hour);
      if (hour === 24) { hour = 0; }
      return {
        year: parts.year,
        month: Number(parts.month),
        day: Number(parts.day),
        weekday: parts.weekday,
        hour: hour,
        minute: pad2(parts.minute),
        second: pad2(parts.second)
      };
    }
    // 回退方案：用本地时间与 UTC 的差换算到 UTC+8
    var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    var t = new Date(utcMs + 8 * 3600000);
    return {
      year: String(t.getFullYear()),
      month: t.getMonth() + 1,
      day: t.getDate(),
      weekday: WEEKDAYS[t.getDay()],
      hour: t.getHours(),
      minute: pad2(t.getMinutes()),
      second: pad2(t.getSeconds())
    };
  }

  var clockDate = $('#clockDate');
  var clockTime = $('#clockTime');
  var clockWeekday = $('#clockWeekday');
  var clockPhase = $('#clockPhase');
  var contactClock = $('#contactClock');

  // 依据当前小时给夜/昼起个仪式化的名字
  function phaseName(hour) {
    if (hour < 6) { return '长夜未明'; }
    if (hour < 11) { return '晨祷'; }
    if (hour < 17) { return '白昼'; }
    if (hour < 19) { return '黄昏'; }
    return '夜之弥撒';
  }

  function tickClock() {
    var now = new Date();           // 每次都用 new Date() 取实时时刻
    var c = readChangsha(now);
    var timeText = pad2(c.hour) + ':' + c.minute + ':' + c.second;
    var dateText = c.year + ' 年 ' + c.month + ' 月 ' + c.day + ' 日';

    if (clockTime) {
      clockTime.textContent = timeText;
      clockTime.setAttribute('datetime', c.year + '-' + pad2(c.month) + '-' + pad2(c.day) + 'T' + timeText + '+08:00');
    }
    if (clockDate) { clockDate.textContent = dateText; }
    if (clockWeekday) { clockWeekday.textContent = c.weekday; }
    if (clockPhase) { clockPhase.textContent = phaseName(c.hour); }
    if (contactClock) { contactClock.textContent = timeText; }
  }

  tickClock();
  window.setInterval(tickClock, 1000);

  /* =======================================================
     三、平滑滚动导航（锚点 + 页头高度补偿由 CSS scroll-margin 处理）
     ======================================================= */
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href');
      if (!hash || hash.length < 2) { return; }
      var target = document.getElementById(hash.slice(1));
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      try { window.history.replaceState(null, '', hash); } catch (err) { /* file:// 下可能被拒绝，忽略即可 */ }
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* =======================================================
     四、滚动揭示动画（IntersectionObserver）
     同时在所有元素之外加一条兜底：脚本异常时不会留下隐藏内容。
     ======================================================= */
  var revealItems = $$('.reveal');

  function revealAll() {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealAll();
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
    // 兜底：3 秒后仍未进入视口的元素直接显示，避免内容被永久隐藏
    window.setTimeout(function () {
      var hidden = revealItems.filter(function (el) { return !el.classList.contains('is-visible'); });
      if (hidden.length === revealItems.length) { revealAll(); }
    }, 3000);
  }

  /* =======================================================
     五、导航高亮：当前所在区块对应的导航项点亮
     ======================================================= */
  var navLinks = $$('.nav-link');
  var linkById = {};
  navLinks.forEach(function (link) { linkById[link.getAttribute('href').slice(1)] = link; });

  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        navLinks.forEach(function (link) {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        });
        var active = linkById[entry.target.id];
        if (active) {
          active.classList.add('is-active');
          active.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    $$('main section[id]').forEach(function (section) { navObserver.observe(section); });
  }

  /* =======================================================
     六、数字滚动：技能百分比与统计数字
     ======================================================= */
  function countUp(el, to, duration) {
    if (reduceMotion || !window.requestAnimationFrame) {
      el.textContent = String(to);
      return;
    }
    var start = null;
    function step(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(to * eased));
      if (progress < 1) { window.requestAnimationFrame(step); }
    }
    window.requestAnimationFrame(step);
  }

  function lightUpSkill(skill) {
    var level = Number(skill.getAttribute('data-level')) || 0;
    skill.style.setProperty('--level', level + '%'); // 只传一个自定义属性，宽度规则仍在 CSS
    skill.classList.add('is-lit');
    $$('.count', skill).forEach(function (num) { countUp(num, Number(num.getAttribute('data-count')) || 0, 1100); });
  }

  var skillItems = $$('.skill');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var skillObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        lightUpSkill(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    skillItems.forEach(function (skill) { skillObserver.observe(skill); });
  } else {
    skillItems.forEach(lightUpSkill);
  }

  /* 统计数字：进入视口后一起滚动 */
  var statCounts = $$('.stat .count');
  if ('IntersectionObserver' in window && !reduceMotion && statCounts.length) {
    var statObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        countUp(el, Number(el.getAttribute('data-count')) || 0, 1300);
        observer.unobserve(el);
      });
    }, { threshold: 0.6 });
    statCounts.forEach(function (el) { statObserver.observe(el); });
  } else {
    statCounts.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* =======================================================
     七、作品筛选：按 data-tags 切换卡片显隐
     ======================================================= */
  var filterButtons = $$('.filter');
  var workCards = $$('.work-card');

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.getAttribute('data-filter');
      filterButtons.forEach(function (other) {
        var on = other === button;
        other.classList.toggle('is-active', on);
        other.setAttribute('aria-pressed', String(on));
      });
      workCards.forEach(function (card) {
        var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
        var show = filter === 'all' || tags.indexOf(filter) !== -1;
        card.classList.toggle('is-hidden', !show);
        if (show) {
          // 先复位再点亮，让被筛出来的卡片重新走一次入场动画
          card.classList.remove('is-visible');
          void card.offsetWidth; // 强制重排，保证动画能再次触发
          card.classList.add('is-visible');
        }
      });
    });
  });

  /* =======================================================
     八、打字机效果：循环打印几句自述
     ======================================================= */
  var typeText = $('#typeText');
  var PHRASES = [
    '在纯黑底上，用暗红与骨白写代码。',
    '喜欢直角、衬线，以及不会背叛你的原生 API。',
    '常驻长沙，惯于深夜，偶尔与朝阳对视。'
  ];

  if (typeText) {
    if (reduceMotion) {
      typeText.textContent = PHRASES[0];
    } else {
      var phraseIndex = 0;
      var charIndex = 0;
      var deleting = false;

      var typeLoop = function () {
        var phrase = PHRASES[phraseIndex];
        charIndex += deleting ? -1 : 1;
        typeText.textContent = phrase.slice(0, charIndex);

        var delay = deleting ? 42 : 96;
        if (!deleting && charIndex === phrase.length) {
          deleting = true;
          delay = 1800;               // 整句停顿
        } else if (deleting && charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % PHRASES.length;
          delay = 420;
        }
        window.setTimeout(typeLoop, delay);
      };
      typeLoop();
    }
  }

  /* =======================================================
     九、烛光跟随：把指针坐标写进 CSS 变量，由样式负责绘制光晕
     ======================================================= */
  var ember = $('#ember');
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  if (ember && canHover && !reduceMotion) {
    var pendingX = window.innerWidth / 2;
    var pendingY = window.innerHeight * 0.3;
    var emberQueued = false;

    var paintEmber = function () {
      ember.style.setProperty('--mx', pendingX + 'px');
      ember.style.setProperty('--my', pendingY + 'px');
      emberQueued = false;
    };

    window.addEventListener('pointermove', function (event) {
      pendingX = event.clientX;
      pendingY = event.clientY;
      ember.classList.add('is-lit');
      if (!emberQueued) {
        emberQueued = true;
        window.requestAnimationFrame(paintEmber);
      }
    });

    window.addEventListener('pointerleave', function () { ember.classList.remove('is-lit'); });
    paintEmber();
  }
})();
