/* ==========================================================================
   39-typographic · 交互脚本
   职责：只做行为，不写大段样式；样式切换一律通过 class / CSS 变量完成。
   模块：
     1. 工具函数
     2. 夜 / 昼主题（基线 2026-09-14 22:07 UTC+8）
     3. 长沙实时时钟
     4. 阅读进度条
     5. 平滑滚动导航 + 当前栏目高亮
     6. 滚动进入动画（IntersectionObserver）
     7. 首屏数字滚动
     8. 字距实验开关
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 1. 工具函数 ===== */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  // 是否开启了"减少动效"的系统偏好
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 安全读取 localStorage（隐私模式可能抛错）
  var store = {
    read: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    write: function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* 忽略 */ }
    }
  };

  // 页面初始的时钟偏移量：用真实系统时间渲染，保证时钟"活"着
  var CLOCK_SKEW_MS = 0;

  /* ===== 2. 夜 / 昼主题 =====
     参考基线：2026 年 9 月 14 日（星期一）22:07（UTC+8）。
     基线时刻落在夜间区间，因此首屏默认进入"夜读"主题；
     用户手动切换后写入 localStorage，后续访问以用户选择为准。 */
  var BASELINE = {
    iso: '2026-09-14T22:07:00+08:00',
    hour: 22,
    minute: 7,
    label: '2026 年 9 月 14 日（星期一）22:07 UTC+8'
  };

  var NIGHT_START = 19; // 19:00 之后视为夜间
  var NIGHT_END = 6;    // 06:00 之前视为夜间

  // 基线时刻是否为夜间
  function baselineIsNight() {
    return BASELINE.hour >= NIGHT_START || BASELINE.hour < NIGHT_END;
  }

  // 任意时刻（0-23）是否为夜间，用于实时判断
  function hourIsNight(hour) {
    return hour >= NIGHT_START || hour < NIGHT_END;
  }

  function initTheme() {
    var root = document.documentElement;
    var toggle = $('#themeToggle');
    var stateLabel = $('#themeState');
    var saved = store.read('oklzr-theme');

    function apply(theme, persist) {
      var isDark = theme === 'dark';
      root.setAttribute('data-theme', theme);
      if (toggle) {
        toggle.textContent = isDark ? '日间' : '夜间';
        toggle.setAttribute('aria-pressed', String(isDark));
      }
      if (stateLabel) { stateLabel.textContent = isDark ? '夜读模式' : '白昼模式'; }
      // 同步浏览器 UI 主题色，避免地址栏与页面割裂
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) { meta.setAttribute('content', isDark ? '#12110e' : '#f4f2ed'); }
      if (persist) { store.write('oklzr-theme', theme); }
    }

    // 初始主题：用户选择优先，否则按基线参考时刻判断
    apply(saved || (baselineIsNight() ? 'dark' : 'light'), false);

    if (toggle) {
      toggle.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(next, true);
      });
    }
  }

  /* ===== 3. 长沙实时时钟 =====
     始终使用 new Date() 实时更新；以 UTC+8 输出年月日、时:分:秒、星期。 */
  function initClock() {
    var box = $('#clock');
    var dateEl = $('#clockDate');
    var timeEl = $('#clockTime');
    var weekEl = $('#clockWeek');
    if (!box || !dateEl || !timeEl || !weekEl) { return; }

    var dateFmt;
    var weekFmt;
    try {
      dateFmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric'
      });
      weekFmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', weekday: 'long'
      });
    } catch (e) {
      dateFmt = null;
      weekFmt = null;
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    // 把 Date 换算成 UTC+8 的年月日时分秒与星期
    function partsOf(date) {
      var shifted = new Date(date.getTime() + CLOCK_SKEW_MS);
      var utc8 = new Date(shifted.getTime() + (shifted.getTimezoneOffset() * 60000) + (8 * 3600000));
      return {
        year: utc8.getFullYear(),
        month: utc8.getMonth() + 1,
        day: utc8.getDate(),
        hours: utc8.getHours(),
        minutes: utc8.getMinutes(),
        seconds: utc8.getSeconds(),
        weekIndex: utc8.getDay()
      };
    }

    var fallbackWeek = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var lastSecond = -1;

    function render() {
      var now = new Date();
      var p = partsOf(now);
      var stamp = pad(p.hours) + ':' + pad(p.minutes) + ':' + pad(p.seconds);

      dateEl.textContent = p.year + '年' + p.month + '月' + p.day + '日';
      timeEl.textContent = stamp;
      weekEl.textContent = fallbackWeek[p.weekIndex];

      // 机器可读时间，便于复用与无障碍
      box.setAttribute('datetime', now.toISOString());

      // 秒数变化时给一个极轻的跳动反馈
      if (p.seconds !== lastSecond) {
        lastSecond = p.seconds;
        if (!reduceMotion && box.classList) {
          timeEl.classList.remove('is-tick');
          // 强制重排以重启动画
          void timeEl.offsetWidth;
          timeEl.classList.add('is-tick');
        }
      }
    }

    // 若能拿到 Intl 的中文星期/日期，用它覆盖默认文案，保证 zh-CN 习惯
    if (dateFmt) {
      var nativeRender = render;
      render = function () {
        nativeRender();
        var now = new Date();
        try {
          dateEl.textContent = dateFmt.format(now);
          weekEl.textContent = weekFmt.format(now);
        } catch (e) { /* 保留回退文案 */ }
      };
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 4. 阅读进度条 ===== */
  function initProgress() {
    var bar = $('#progressBar');
    if (!bar) { return; }

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? (window.scrollY || doc.scrollTop) / max : 0;
      bar.style.width = Math.min(1, Math.max(0, ratio)) * 100 + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ===== 5. 平滑滚动导航 + 当前栏目高亮 ===== */
  function initNavigation() {
    var links = $$('.nav__link');
    if (!links.length) { return; }

    // 5.1 点击后平滑滚动，并补偿吸顶导航高度
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href') || '';
        if (hash.charAt(0) !== '#') { return; }
        var target = document.getElementById(hash.slice(1));
        if (!target) { return; }

        event.preventDefault();
        var head = $('#siteHead');
        var offset = head ? head.offsetHeight + 12 : 0;
        var top = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
          top: Math.max(0, top),
          behavior: reduceMotion ? 'auto' : 'smooth'
        });

        // 更新地址栏但不产生跳动
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hash);
        }
      });
    });

    // 5.2 滚动时高亮当前所在栏目
    var sections = links
      .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
      .filter(Boolean);

    function setActive(id) {
      links.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
      });
    }

    if ('IntersectionObserver' in window && sections.length) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { setActive(entry.target.id); }
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      sections.forEach(function (section) { obs.observe(section); });
    }

    // 5.3 滚动时给页眉加一点浮起感
    var head = $('#siteHead');
    if (head) {
      var onScroll = function () {
        head.classList.toggle('is-scrolled', window.scrollY > 8);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ===== 6. 滚动进入动画 ===== */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) { return; }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var obs = new IntersectionObserver(function (entries, self) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        // 同组元素依次入场，形成排印节奏
        var siblings = el.parentElement ? $$('[data-reveal]', el.parentElement) : [el];
        var index = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(index, 6) * 70 + 'ms';
        el.classList.add('is-in');
        self.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    items.forEach(function (el) { obs.observe(el); });
  }

  /* ===== 7. 首屏数字滚动 ===== */
  function initCounters() {
    var nums = $$('[data-count-to]');
    if (!nums.length) { return; }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count-to')) || 0;
      if (reduceMotion) { el.textContent = String(target); return; }

      var duration = 1100;
      var start = null;

      function step(ts) {
        if (start === null) { start = ts; }
        var t = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        el.textContent = String(Math.round(target * eased));
        if (t < 1) { window.requestAnimationFrame(step); }
        else { el.textContent = String(target); }
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(run);
      return;
    }

    var obs = new IntersectionObserver(function (entries, self) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        run(entry.target);
        self.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { obs.observe(el); });
  }

  /* ===== 8. 字距实验开关 =====
     只切换 CSS 变量 --tracking-scale，样式仍全部留在 CSS 里。 */
  function initTrackingToggle() {
    var btn = $('#trackingToggle');
    if (!btn) { return; }

    var saved = store.read('oklzr-tracking');
    var loose = saved === 'loose';

    function apply(isLoose, persist) {
      document.documentElement.style.setProperty('--tracking-scale', isLoose ? '1.9' : '1');
      btn.setAttribute('aria-pressed', String(isLoose));
      btn.textContent = isLoose ? '字距收紧' : '字距实验';
      if (persist) { store.write('oklzr-tracking', isLoose ? 'loose' : 'tight'); }
    }

    apply(loose, false);

    btn.addEventListener('click', function () {
      loose = !loose;
      apply(loose, true);
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();
    initClock();
    initProgress();
    initNavigation();
    initReveal();
    initCounters();
    initTrackingToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
