/* =========================================================
   25-pastel-dream · 交互脚本
   职责：实时时钟 / 主题切换 / 平滑滚动 / 进入动画 /
        作品筛选 / 技能条 / 数字滚动 / 鼠标跟随 / 回到顶部
   ========================================================= */
(function () {
  'use strict';

  // 参考基线：网络上查到的 2026-09-14（星期一）22:07 UTC+8
  // 仅用于判断「当前应显示昼还是夜」的默认主题，时钟本身使用实时 new Date()
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7 };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 工具函数 ===== */
  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * 返回一个「长沙时间」视图对象。
   * 不论访客在哪个时区，都换算成 UTC+8（Asia/Shanghai，无夏令时）。
   */
  function getChangshaNow() {
    var now = new Date();
    // 用 UTC 时间戳 + 8 小时偏移，再按 UTC 字段读取，即为东八区挂钟时间
    var shifted = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
    return {
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
      day: shifted.getDate(),
      hour: shifted.getHours(),
      minute: shifted.getMinutes(),
      second: shifted.getSeconds(),
      weekday: shifted.getDay(),
      period: shifted.getHours() < 12 ? '上午' : shifted.getHours() < 18 ? '下午' : '晚上'
    };
  }

  /* ===== 1. 长沙实时时钟 ===== */
  var clockTime = $('clockTime');
  var clockDate = $('clockDate');
  var clockMeta = $('clockMeta');
  var contactTime = $('contactTime');
  var lastDayKey = '';

  function renderClock() {
    var t = getChangshaNow();
    var timeText = pad(t.hour) + ':' + pad(t.minute) + ':' + pad(t.second);
    var dateText = t.year + ' 年 ' + t.month + ' 月 ' + t.day + ' 日 · ' + WEEKDAYS[t.weekday];

    if (clockTime) clockTime.textContent = timeText;
    if (clockDate) clockDate.textContent = dateText;
    if (clockMeta) clockMeta.textContent = t.period + '好 · UTC+8 东八区';
    if (contactTime) contactTime.textContent = dateText + ' ' + timeText;

    // 跨天时重新判断昼夜主题（只在日期变化时执行）
    var key = t.year + '-' + t.month + '-' + t.day;
    if (key !== lastDayKey) {
      lastDayKey = key;
      applyAutoTheme(t.hour);
    }
  }

  /* ===== 2. 昼夜主题切换 ===== */
  var themeToggle = $('themeToggle');
  var themeIcon = $('themeIcon');
  var themeText = $('themeText');
  var themeLocked = false; // 用户手动切换后，不再被自动主题覆盖

  function setTheme(isNight) {
    document.body.classList.toggle('theme-night', isNight);
    if (themeIcon) themeIcon.textContent = isNight ? '☀️' : '🌙';
    if (themeText) themeText.textContent = isNight ? '日间' : '夜间';
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isNight));
  }

  function applyAutoTheme(hour) {
    if (themeLocked) return;
    // 19:00 ~ 次日 06:00 视为夜间
    setTheme(hour >= 19 || hour < 6);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      themeLocked = true;
      setTheme(!document.body.classList.contains('theme-night'));
    });
  }

  // 首屏立即按参考基线时间（22:07）确定昼夜，随后由实时时钟接管
  (function initTheme() {
    var t = getChangshaNow();
    var baseHour = (t.year === BASELINE.year && t.month === BASELINE.month && t.day === BASELINE.day)
      ? BASELINE.hour
      : t.hour;
    setTheme(baseHour >= 19 || baseHour < 6);
  })();

  /* ===== 3. 平滑滚动 + 导航高亮 + 移动端收起 ===== */
  var header = $('siteHeader');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  function scrollToTarget(target) {
    if (!target) return;
    var offset = header ? header.offsetHeight + 12 : 0;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: prefersReduced ? 'auto' : 'smooth' });
  }

  // 事件委托：处理页内所有锚点跳转
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
    if (history.replaceState) history.replaceState(null, '', hash);
  });

  function syncNav() {
    var pos = window.pageYOffset + (header ? header.offsetHeight + 40 : 40);
    var current = null;
    sections.forEach(function (sec) {
      if (sec.offsetTop <= pos) current = sec.id;
    });

    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
    });

    if (header) header.classList.toggle('is-stuck', window.pageYOffset > 8);

    var toTop = $('toTop');
    if (toTop) toTop.classList.toggle('is-show', window.pageYOffset > 420);
  }

  /* ===== 4. 回到顶部 ===== */
  var toTopBtn = $('toTop');
  if (toTopBtn) {
    toTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  }

  /* ===== 5. 滚动进入动画 + 技能条 + 数字滚动 ===== */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var skillBars = Array.prototype.slice.call(document.querySelectorAll('.skill-bar'));
  var counters = Array.prototype.slice.call(document.querySelectorAll('.stat__num'));

  // 数字滚动
  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1200;
    var start = null;

    if (prefersReduced) {
      el.textContent = target + suffix;
      return;
    }

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 技能条生长
  function fillBars() {
    skillBars.forEach(function (bar, i) {
      var level = bar.getAttribute('data-level') || '0';
      window.setTimeout(function () {
        bar.style.width = level + '%';
      }, prefersReduced ? 0 : i * 130);
    });
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);

        // 元素进入视口时触发其内部动画
        var nums = entry.target.querySelectorAll ? entry.target.querySelectorAll('.stat__num') : [];
        Array.prototype.forEach.call(nums, runCounter);
        if (entry.target.classList.contains('skill-list')) fillBars();
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (el) {
      revealObserver.observe(el);
    });

    // 技能条区块兜底：即使外层没有 .reveal 也能触发
    var skillSection = document.getElementById('skills');
    if (skillSection && !skillSection.querySelector('.reveal')) {
      var skillObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          fillBars();
          skillObserver.disconnect();
        }
      }, { threshold: 0.3 });
      skillObserver.observe(skillSection);
    }

    counters.forEach(function (el) {
      if (el.closest('.reveal')) return;
      var obs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          runCounter(el);
          obs.disconnect();
        }
      }, { threshold: 0.5 });
      obs.observe(el);
    });
  } else {
    // 无 IntersectionObserver 支持时直接显示全部内容
    revealItems.forEach(function (el) {
      el.classList.add('is-visible');
    });
    counters.forEach(runCounter);
    fillBars();
  }

  /* ===== 6. 作品筛选 ===== */
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var workItems = Array.prototype.slice.call(document.querySelectorAll('.work'));

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');

      filterBtns.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });

      workItems.forEach(function (item) {
        var show = cat === 'all' || item.getAttribute('data-cat') === cat;
        item.classList.toggle('is-hidden', !show);
        // 重新显示时立即标记为可见，避免因 display:none 错过进入动画
        if (show) item.classList.add('is-visible');
      });
    });
  });

  /* ===== 7. 鼠标跟随柔光 ===== */
  var glow = $('cursorGlow');
  var glowOn = false;

  if (glow && !prefersReduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', function (e) {
      if (!glowOn) {
        glow.classList.add('is-on');
        glowOn = true;
      }
      glow.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
    });

    document.addEventListener('mouseleave', function () {
      glow.classList.remove('is-on');
      glowOn = false;
    });
  }

  /* ===== 8. 滚动节流 + 启动 ===== */
  var ticking = false;

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      syncNav();
      ticking = false;
    });
  }, { passive: true });

  window.addEventListener('resize', syncNav, { passive: true });

  renderClock();
  window.setInterval(renderClock, 1000); // 时钟每秒刷新
  syncNav();
})();
