/* ==========================================================================
   08-neubrutalism · 交互脚本
   职责：实时时钟 / 平滑滚动与导航高亮 / 滚动进入动画 / 技能条动画 /
         作品分类筛选 / 深浅色切换 / 打字机
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 工具：安全取元素 ===== */
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* 把数字补成两位，例如 9 -> "09" */
  var pad2 = function (n) {
    return n < 10 ? '0' + n : String(n);
  };

  /* ===== 长沙时间时钟 =====
     说明：本机时区可能不是东八区，因此优先用 Intl 按 Asia/Shanghai 取值，
     取值失败时退回“本机时间 + 时区差补偿”，仍然基于 new Date() 实时刷新。
     参考基线：2026-09-14（星期一）22:07（UTC+8）用于夜/昼主题判断逻辑校验。 */
  var CHINA_OFFSET_MIN = 8 * 60;
  var WEEK_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* 返回一个“长沙当地”的时间字段集合 */
  function getChangshaParts() {
    var now = new Date();
    try {
      var fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        weekday: 'short'
      });
      var parts = {};
      fmt.formatToParts(now).forEach(function (p) {
        parts[p.type] = p.value;
      });
      if (parts.hour && parts.minute && parts.second) {
        var hour = parseInt(parts.hour, 10) % 24;
        return {
          year: parseInt(parts.year, 10),
          month: parseInt(parts.month, 10),
          day: parseInt(parts.day, 10),
          hour: hour,
          minute: parseInt(parts.minute, 10),
          second: parseInt(parts.second, 10),
          weekday: WEEK_ZH[getChangshaWeekday(now)]
        };
      }
    } catch (err) {
      /* 进入兜底分支 */
    }
    return getChangshaPartsFallback(now);
  }

  /* 用 UTC 时间戳加 8 小时推算星期，避免依赖本机时区 */
  function getChangshaWeekday(dateObj) {
    var shifted = new Date(dateObj.getTime() + CHINA_OFFSET_MIN * 60000);
    return shifted.getUTCDay();
  }

  /* 兜底方案：直接用时间戳换算 */
  function getChangshaPartsFallback(dateObj) {
    var shifted = new Date(dateObj.getTime() + CHINA_OFFSET_MIN * 60000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      weekday: WEEK_ZH[shifted.getUTCDay()]
    };
  }

  /* 根据小时判断昼夜，用于卡片上的主题提示 */
  function phaseOf(hour) {
    if (hour >= 6 && hour < 12) return { key: 'morning', text: '☀ 上午好' };
    if (hour >= 12 && hour < 18) return { key: 'day', text: '🌤 下午好' };
    if (hour >= 18 && hour < 23) return { key: 'evening', text: '🌆 晚上好' };
    return { key: 'night', text: '🌙 深夜了' };
  }

  function initClock() {
    var timeEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var weekEl = $('#clockWeek');
    var phaseEl = $('#clockPhase');
    var dataClockEl = $('#dataClock');
    if (!timeEl) return;

    var render = function () {
      var p = getChangshaParts();
      var timeText = pad2(p.hour) + ':' + pad2(p.minute) + ':' + pad2(p.second);

      timeEl.textContent = timeText;
      dateEl.textContent = p.year + ' 年 ' + p.month + ' 月 ' + p.day + ' 日';
      weekEl.textContent = p.weekday;

      if (phaseEl) {
        var ph = phaseOf(p.hour);
        phaseEl.textContent = ph.text;
        phaseEl.setAttribute('data-phase', ph.key);
      }
      if (dataClockEl) {
        dataClockEl.textContent = timeText;
      }
    };

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 平滑滚动 + 当前栏目高亮 ===== */
  function initSmoothScroll() {
    var header = $('.site-header');
    var links = $$('.nav-link, .btn[href^="#"], .back-top');

    var scrollToTarget = function (hash) {
      var target = hash === '#top' ? document.body : $(hash);
      if (!target) return;
      var headerH = header ? header.offsetHeight : 0;
      var top = hash === '#top'
        ? 0
        : target.getBoundingClientRect().top + window.pageYOffset - headerH - 14;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    };

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href');
        if (!hash || hash.charAt(0) !== '#') return;
        event.preventDefault();
        scrollToTarget(hash);
        if (history.replaceState) history.replaceState(null, '', hash);
      });
    });

    /* 滚动时高亮当前所在区块对应的导航项 */
    var sections = $$('main section[id]');
    var navLinks = $$('.nav-link');
    if (!sections.length || !navLinks.length || !('IntersectionObserver' in window)) return;

    var syncNav = function () {
      var line = (header ? header.offsetHeight : 0) + window.innerHeight * 0.28;
      var currentId = sections[0].id;
      sections.forEach(function (sec) {
        if (sec.getBoundingClientRect().top <= line) currentId = sec.id;
      });
      navLinks.forEach(function (link) {
        var on = link.getAttribute('href') === '#' + currentId;
        link.classList.toggle('is-current', on);
        if (on) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        syncNav();
        ticking = false;
      });
    }, { passive: true });
    syncNav();
  }

  /* ===== 滚动进入动画（IntersectionObserver） ===== */
  var revealObserver = null;

  function observeReveal(el) {
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
    }
    revealObserver.observe(el);
  }

  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    /* 首屏元素错峰出现，视觉上更有节奏 */
    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
      observeReveal(el);
    });
  }

  /* ===== 技能条：进入视口后宽度与数字一起增长 ===== */
  function animateSkillItem(item) {
    var fill = $('.skill-fill', item);
    var valEl = $('.skill-val', item);
    if (!fill) return;

    var value = parseInt(fill.getAttribute('data-value'), 10) || 0;
    fill.style.width = value + '%';

    if (!valEl) return;
    var duration = 1000;
    var start = null;

    var step = function (ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      /* easeOutCubic，和 CSS 的过渡手感接近 */
      var eased = 1 - Math.pow(1 - progress, 3);
      valEl.textContent = Math.round(value * eased) + '%';
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  function initSkills() {
    var items = $$('.skill-item');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(animateSkillItem);
      return;
    }
    var obs = new IntersectionObserver(function (entries, self) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateSkillItem(entry.target);
        self.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    items.forEach(function (item) { obs.observe(item); });
  }

  /* ===== 作品分类筛选 ===== */
  function initFilter() {
    var bar = $('#filterBar');
    var grid = $('#workGrid');
    var empty = $('#filterEmpty');
    if (!bar || !grid) return;

    var cards = $$('.work-card', grid);

    bar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter-btn');
      if (!btn) return;

      var cat = btn.getAttribute('data-filter');
      $$('.filter-btn', bar).forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });

      var shown = 0;
      cards.forEach(function (card) {
        var match = cat === 'all' || card.getAttribute('data-cat') === cat;
        card.classList.toggle('is-hidden', !match);
        if (match) shown += 1;
      });

      if (empty) empty.hidden = shown !== 0;
    });
  }

  /* ===== 深浅色切换（记忆在 localStorage） ===== */
  function initTheme() {
    var btn = $('#themeToggle');
    var KEY = 'oklzr-neubrutalism-theme';

    var apply = function (mode) {
      var night = mode === 'night';
      document.body.classList.toggle('theme-night', night);
      if (btn) {
        btn.setAttribute('aria-pressed', night ? 'true' : 'false');
        var icon = $('.theme-icon', btn);
        var label = $('.theme-label', btn);
        if (icon) icon.textContent = night ? '🌙' : '☀';
        if (label) label.textContent = night ? '夜间' : '日间';
      }
    };

    var saved = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch (err) {
      saved = null;
    }
    apply(saved === 'night' ? 'night' : 'day');

    if (!btn) return;
    btn.addEventListener('click', function () {
      var night = !document.body.classList.contains('theme-night');
      apply(night ? 'night' : 'day');
      try {
        window.localStorage.setItem(KEY, night ? 'night' : 'day');
      } catch (err) {
        /* 隐私模式下忽略存储失败 */
      }
    });
  }

  /* ===== 打字机：把姓名逐字敲出来 ===== */
  function initTyping() {
    var el = $('#typeName');
    if (!el) return;

    var full = el.getAttribute('data-typing') || el.textContent;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = full;
      return;
    }

    el.textContent = '';
    el.classList.add('is-typing');
    var i = 0;
    var timer = window.setInterval(function () {
      i += 1;
      el.textContent = full.slice(0, i);
      if (i >= full.length) {
        window.clearInterval(timer);
        el.classList.remove('is-typing');
      }
    }, 110);
  }

  /* ===== 启动 ===== */
  function boot() {
    initClock();
    initTyping();
    initSmoothScroll();
    initReveal();
    initSkills();
    initFilter();
    initTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
