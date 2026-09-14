/* ==========================================================================
   ok-lzr / 码上生活 —— 印刷粗野个人主页 交互脚本
   模块顺序：常量与工具 → 主题(夜/昼) → 长沙实时钟 → 打字机 → 滚动进入
            → 能力条 → 数字滚动 → 作品筛选 → 平滑滚动与导航高亮 → 鼠标跟随
   约定：本文件只切类名 / 写 CSS 变量 / 改文本，不写样式字符串。
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 常量与工具 ===== */

  var TZ_OFFSET_MIN = 8 * 60;                            // 长沙固定 UTC+8
  var REFERENCE_ISO = '2026-09-14T22:07:00+08:00';       // 网络查询得到的参考基线：星期一 22:07
  var NIGHT_START = 19;                                  // 19:00 起算夜间
  var NIGHT_END = 6;                                     // 06:00 前算夜间
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* 把任意时刻折算成长沙墙上时间，避免依赖本机时区设置 */
  function toChangsha(date) {
    var utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utcMs + TZ_OFFSET_MIN * 60000);
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* 星期用 zh-CN 输出，极端环境缺 Intl 时退回手工表 */
  function weekdayCN(date) {
    try {
      return new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date);
    } catch (err) {
      return '星期' + '日一二三四五六'.charAt(date.getDay());
    }
  }

  function isNightHour(hour) { return hour >= NIGHT_START || hour < NIGHT_END; }

  /* ===== 主题：夜 / 昼 ===== */

  var themeToggle = $('[data-theme-toggle]');
  var themeLabel = $('[data-theme-label]');
  var themeMode = 'auto';   // auto → 跟随长沙时间；day / night → 用户手动覆盖

  function applyTheme(mode) {
    var hour = toChangsha(new Date()).getHours();
    var night = mode === 'auto' ? isNightHour(hour) : mode === 'night';
    document.documentElement.setAttribute('data-theme', night ? 'night' : 'day');
    if (themeToggle) themeToggle.setAttribute('aria-pressed', night ? 'true' : 'false');
    if (themeLabel) {
      themeLabel.textContent = mode === 'auto'
        ? (night ? '自动·夜间' : '自动·日间')
        : (night ? '切换日间' : '切换夜间');
    }
  }

  if (themeToggle) {
    applyTheme(themeMode);
    themeToggle.addEventListener('click', function () {
      var nowNight = document.documentElement.getAttribute('data-theme') === 'night';
      themeMode = nowNight ? 'day' : 'night';
      applyTheme(themeMode);
    });
  } else {
    applyTheme(themeMode);
  }

  /* ===== 长沙实时钟 ===== */

  var clockTime = $('[data-clock-time]');
  var clockDate = $('[data-clock-date]');
  var clockWeek = $('[data-clock-week]');
  var periodEl = $('[data-period]');
  var baselineEl = $('[data-baseline]');

  function renderClock() {
    var now = toChangsha(new Date());
    var h = now.getHours();
    var night = isNightHour(h);

    if (clockTime) {
      clockTime.textContent = pad2(h) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    }
    if (clockDate) {
      clockDate.textContent = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日';
    }
    if (clockWeek) clockWeek.textContent = weekdayCN(now) + ' · 长沙';

    if (periodEl) {
      periodEl.textContent = night ? '夜间 ▮ 印版反转' : '日间 ▯ 黑墨白纸';
    }
    // 夜间时段自动跟随（用户手动切换后不再干预）
    if (themeMode === 'auto' && themeToggle) {
      var current = document.documentElement.getAttribute('data-theme');
      if ((night ? 'night' : 'day') !== current) applyTheme('auto');
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000);   // 每秒刷新，时钟始终来自 new Date()

  /* 参考基线提示：说明夜/昼判定依据 */
  if (baselineEl) {
    var ref = toChangsha(new Date(REFERENCE_ISO));
    baselineEl.textContent = '参考基线：' + ref.getFullYear() + ' 年 ' + (ref.getMonth() + 1) + ' 月 '
      + ref.getDate() + ' 日 ' + weekdayCN(ref) + ' ' + pad2(ref.getHours()) + ':' + pad2(ref.getMinutes())
      + '（UTC+8）· 该时刻被判为' + (isNightHour(ref.getHours()) ? '夜间' : '日间') + '；当前实时钟据此沿用同一套夜/昼规则。';
  }

  /* ===== 打字机效果（页头一句话简介） ===== */

  var typeTarget = $('[data-typing]');
  if (typeTarget) {
    var fullText = typeTarget.getAttribute('data-typing') || '';
    if (reduceMotion) {
      typeTarget.textContent = fullText;
    } else {
      var i = 0;
      (function type() {
        typeTarget.textContent = fullText.slice(0, i);
        i += 1;
        if (i <= fullText.length) window.setTimeout(type, 58);
      })();
    }
  }

  /* ===== 滚动进入动画 + 能力条触发 ===== */

  var revealItems = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
    $$('.bar__fill').forEach(function (el) {
      el.style.setProperty('--level', (el.getAttribute('data-level') || 0) + '%');
    });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });

    // 能力条：进入视口后把档位写进 CSS 变量，过渡交给 CSS
    var barObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var fill = entry.target;
        var level = fill.getAttribute('data-level') || 0;
        window.setTimeout(function () {
          fill.style.setProperty('--level', level + '%');
        }, 120);
        obs.unobserve(fill);
      });
    }, { threshold: 0.5 });

    $$('.bar__fill').forEach(function (el) { barObserver.observe(el); });
  }

  /* ===== 统计数字滚动 ===== */

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduceMotion) { el.textContent = String(target); return; }
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);           // 三次缓出
      el.textContent = String(Math.round(target * eased));
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var nums = $$('[data-count]');
  if (nums.length) {
    if (!('IntersectionObserver' in window)) {
      nums.forEach(countUp);
    } else {
      var numObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      nums.forEach(function (el) { numObserver.observe(el); });
    }
  }

  /* ===== 作品筛选（切类名，不写内联样式） ===== */

  var filterBtns = $$('[data-filter]');
  var cards = $$('[data-cards] .card');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-filter');

      filterBtns.forEach(function (other) {
        var on = other === btn;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      cards.forEach(function (card) {
        var match = key === 'all' || card.getAttribute('data-cat') === key;
        card.classList.toggle('is-hidden', !match);
        if (match) card.classList.add('is-visible');   // 重新显示时保证可见
      });
    });
  });

  /* ===== 平滑滚动 + 导航高亮 ===== */

  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  var navLinks = $$('.nav__link');
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var on = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', on);
          if (on) { link.setAttribute('aria-current', 'true'); }
          else { link.removeAttribute('aria-current'); }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (sec) { navObserver.observe(sec); });
  }

  /* ===== 鼠标跟随荧光方块（位置写进 CSS 变量） ===== */

  var cursor = $('.cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', function (event) {
      cursor.style.setProperty('--x', event.clientX + 'px');
      cursor.style.setProperty('--y', event.clientY + 'px');
      if (!cursor.classList.contains('is-on')) cursor.classList.add('is-on');
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      cursor.classList.remove('is-on');
    });
  }
})();
