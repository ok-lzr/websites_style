/* ============================================================
   script.js —— 日式极简禅意 · 交互层
   职责：
     1. 昼夜主题（基线参考时刻 2026-09-14 22:07 UTC+8，判断昼/夜）
     2. 长沙时间实时钟（new Date() 每秒刷新，zh-CN 显示）
     3. 首屏打字机
     4. IntersectionObserver：滚动进场 + 导航滚动高亮
     5. 数字滚动、复制地点、平滑滚动、顶栏状态
   本文件只负责行为，样式一律写在 style.css，通过切换类名生效。
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;

  /* 是否偏好减少动态效果 */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 参考基线：来自网络查询的当天基线时刻 2026-09-14（星期一）22:07（UTC+8），
     仅用于页面载入时判断昼 / 夜主题；页面上的时钟仍以 new Date() 实时更新。 */
  var BASELINE = {
    date: '2026-09-14',
    weekday: '星期一',
    time: '22:07',
    hour: 22,
    minute: 7,
    offsetHours: 8
  };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var CHANGSHA_OFFSET_MS = BASELINE.offsetHours * 60 * 60 * 1000;

  /* 昼 / 夜分界：6:00 - 19:00 为昼 */
  var DAY_START_HOUR = 6;
  var NIGHT_START_HOUR = 19;

  /* ---------- 工具函数 ---------- */

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* 取“东八区（长沙）”当前时间，与访问者本地时区无关 */
  function changshaNow() {
    var now = new Date();
    var utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    return new Date(utcMs + CHANGSHA_OFFSET_MS);
  }

  function isNightHour(hour) {
    return hour < DAY_START_HOUR || hour >= NIGHT_START_HOUR;
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* ============================================================
     1. 昼夜主题
     ============================================================ */

  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var themeText = document.getElementById('themeText');
  var userPickedTheme = false; /* 用户手动切换后，不再由时钟接管 */

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var night = theme === 'night';
    if (themeIcon) { themeIcon.textContent = night ? '☾' : '☀'; }
    if (themeText) { themeText.textContent = night ? '夜' : '昼'; }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(night));
      themeToggle.setAttribute('aria-label', night ? '当前夜间主题，切换到昼间' : '当前昼间主题，切换到夜间');
    }
  }

  /* 依据小时数（东八区）套用主题 */
  function applyThemeByHour(hour) {
    if (userPickedTheme) { return; }
    applyTheme(isNightHour(hour) ? 'night' : 'day');
  }

  /* 首屏先用基线时刻决定主题，避免闪烁 */
  applyThemeByHour(BASELINE.hour);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      userPickedTheme = true;
      var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
    });
  }

  /* ============================================================
     2. 长沙时间实时钟（年月日 · 时:分:秒 · 星期，zh-CN）
     ============================================================ */

  var clockDateEl = document.getElementById('clockDate');
  var clockTimeEl = document.getElementById('clockTime');
  var clockPeriodEl = document.getElementById('clockPeriod');
  var clockDotEl = document.getElementById('clockDot');

  var dateFormatter = null;
  try {
    dateFormatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  } catch (err) {
    dateFormatter = null; /* 环境不支持时退化为手工拼接中文日期 */
  }

  function renderClock() {
    var d = changshaNow();
    var hour = d.getHours();

    var dateText;
    if (dateFormatter) {
      dateText = dateFormatter.format(d);
    } else {
      dateText = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAYS[d.getDay()];
    }
    var timeText = pad2(hour) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());

    if (clockDateEl) { clockDateEl.textContent = dateText; }
    if (clockTimeEl) {
      clockTimeEl.textContent = timeText;
      clockTimeEl.setAttribute('datetime', d.toISOString());
    }
    if (clockPeriodEl) { clockPeriodEl.textContent = isNightHour(hour) ? '夜间' : '昼间'; }
    if (clockDotEl) { clockDotEl.classList.toggle('is-night', isNightHour(hour)); }

    /* 时钟同时驱动主题（用户手动选择过则让位） */
    applyThemeByHour(hour);
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ============================================================
     3. 打字机效果（首屏一句话简介）
     ============================================================ */

  var typeTarget = document.getElementById('typeTarget');
  var caret = document.querySelector('.type-caret');

  if (typeTarget) {
    var fullText = typeTarget.textContent.trim();

    if (reduceMotion) {
      typeTarget.textContent = fullText;
      if (caret) { caret.classList.add('is-idle'); }
    } else {
      typeTarget.textContent = '';
      var index = 0;
      var typeTimer = window.setInterval(function () {
        index += 1;
        typeTarget.textContent = fullText.slice(0, index);
        if (index >= fullText.length) {
          window.clearInterval(typeTimer);
          if (caret) { caret.classList.add('is-idle'); }
        }
      }, 95);
    }
  }

  /* ============================================================
     4. 滚动相关：进场动画 / 导航高亮 / 顶栏状态
     ============================================================ */

  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  /* 先给根元素打标记，保证「无 JS 时内容照常可见」 */
  root.classList.add('js-reveal');

  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* 导航滚动高亮（滚动侦测） */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a'));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        navLinks.forEach(function (link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          if (active) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { spyObserver.observe(section); });
  }

  /* 顶栏：滚动后加一条更深的细线阴影 */
  var header = document.getElementById('siteHeader');
  function syncHeader() {
    if (!header) { return; }
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  /* ============================================================
     5. 平滑滚动（考虑固定顶栏高度）
     ============================================================ */

  var headerHeight = function () {
    return header ? header.offsetHeight : 0;
  };

  document.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) { return; }
    /* 跳转链接交给浏览器处理，保留焦点移动 */
    if (link.classList.contains('skip-link')) { return; }

    var hash = link.getAttribute('href');
    if (!hash || hash === '#') { return; }

    var target = document.querySelector(hash);
    if (!target) { return; }

    event.preventDefault();
    var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight() - 8;
    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  });

  /* ============================================================
     6. 数字滚动（进入视口后从 0 数到目标值）
     ============================================================ */

  var counters = Array.prototype.slice.call(document.querySelectorAll('.stat-num'));

  function animateCount(el) {
    var to = parseInt(el.getAttribute('data-count-to'), 10) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1100;
    var start = null;

    function paint(value) {
      el.textContent = prefix + value + suffix;
    }

    if (reduceMotion) {
      paint(to);
      return;
    }

    function step(timestamp) {
      if (start === null) { start = timestamp; }
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); /* easeOutCubic */
      paint(Math.round(to * eased));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && counters.length) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObserver.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* ============================================================
     7. 点击复制地点 + 轻提示
     ============================================================ */

  var copyBtn = document.getElementById('copyLocation');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function showToast(message) {
    if (!toast) { return; }
    toast.textContent = message;
    toast.classList.add('is-show');
    if (toastTimer) { window.clearTimeout(toastTimer); }
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-show');
    }, 1600);
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.className = 'visually-hidden';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = copyBtn.getAttribute('data-copy') || '';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('已复制：' + text);
        }, function () {
          showToast(legacyCopy(text) ? '已复制：' + text : '复制失败，请手动选择');
        });
      } else {
        showToast(legacyCopy(text) ? '已复制：' + text : '复制失败，请手动选择');
      }
    });
  }

  /* 页面载入提示：说明主题依据的基线时刻，便于核对 */
  window.setTimeout(function () {
    showToast('夜间主题参考 ' + BASELINE.date + ' ' + BASELINE.time + '（UTC+8）');
  }, 900);

})();
