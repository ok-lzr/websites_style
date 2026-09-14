/* ==========================================================================
   11-swiss-grid — 行为层
   仅负责交互：实时时钟、导航高亮、平滑滚动、滚动进入动画、
   技能条 / 数字滚动、作品筛选、回到顶部。
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 参考基线：2026-09-14（星期一）22:07 UTC+8 =====
     仅用于昼夜判断的参考点；时钟本身始终使用 new Date() 实时刷新。 */
  var BASELINE = new Date('2026-09-14T22:07:00+08:00');

  /* ===== 工具：补零 ===== */
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ===== 实时时钟：长沙时间（UTC+8） =====
     用 UTC 时间戳加上 8 小时偏移计算，避免依赖本机时区设置。 */
  var elTime = document.getElementById('clock-time');
  var elDate = document.getElementById('clock-date');
  var elPhase = document.getElementById('clock-phase');
  var elContactTime = document.getElementById('contact-time');

  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function changshaParts() {
    var now = new Date();
    // 本机时间 → UTC 毫秒 → 加 8 小时，再用 UTC 取值得到长沙本地字段
    var shifted = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
    return {
      hours: shifted.getHours(),
      minutes: shifted.getMinutes(),
      seconds: shifted.getSeconds(),
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
      day: shifted.getDate(),
      week: shifted.getDay()
    };
  }

  /* 依据小时数给出昼 / 夜主题提示（使用基线时刻作为文案锚点） */
  function phaseOf(hours) {
    if (hours >= 6 && hours < 18) return '白昼模式 · 网格全亮';
    if (hours >= 18 && hours < 22) return '入夜 · 降低亮度';
    return '深夜 · 基线 22:07 参考';
  }

  function tick() {
    var t = changshaParts();
    var hhmmss = pad(t.hours) + ':' + pad(t.minutes) + ':' + pad(t.seconds);
    var dateText = t.year + '年' + t.month + '月' + t.day + '日 ' + WEEK[t.week];

    if (elTime) elTime.textContent = hhmmss;
    if (elDate) elDate.textContent = dateText;
    if (elPhase) elPhase.textContent = phaseOf(t.hours);
    if (elContactTime) elContactTime.textContent = dateText + ' ' + hhmmss;

    document.body.dataset.night = (t.hours >= 18 || t.hours < 6) ? 'true' : 'false';
  }

  tick();
  window.setInterval(tick, 1000);

  /* 基线仅用于在控制台留下可核对的参考时刻，不参与时钟显示 */
  if (window.console && console.info) {
    console.info('[swiss-grid] 参考基线：' + BASELINE.toString());
  }

  /* ===== 平滑滚动导航 + 当前区块高亮 ===== */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      var target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });

  /* 滚动时用 IntersectionObserver 决定哪个导航项处于激活态 */
  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle(
            'is-active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ===== 滚动进入动画 + 技能条 + 数字滚动 ===== */
  function runCounters(root) {
    var nums = root.querySelectorAll('.counter__num');
    Array.prototype.forEach.call(nums, function (el) {
      if (el.dataset.done === '1') return;
      el.dataset.done = '1';

      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var start = null;
      var duration = 900;

      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutCubic，让大号数字收尾更稳
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(step);
        else el.textContent = String(target);
      }
      window.requestAnimationFrame(step);
    });
  }

  function runBars(root) {
    var bars = root.querySelectorAll('.skill__bar');
    Array.prototype.forEach.call(bars, function (bar) {
      var level = parseInt(bar.getAttribute('data-level'), 10) || 0;
      bar.classList.add('is-on');
      bar.style.width = level + '%';
    });
  }

  var revealItems = document.querySelectorAll('.reveal, .skills, .counters');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        if (el.classList.contains('skills')) runBars(el);
        if (el.classList.contains('counters')) runCounters(el);
        observer.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(revealItems, function (el) {
      revealObserver.observe(el);
    });
  } else {
    // 不支持 IntersectionObserver 时直接呈现最终状态
    Array.prototype.forEach.call(revealItems, function (el) {
      el.classList.add('is-in');
    });
    runBars(document);
    runCounters(document);
  }

  /* ===== 作品筛选 ===== */
  var filterWrap = document.getElementById('work-filter');
  var workList = document.getElementById('work-list');
  var emptyHint = document.getElementById('work-empty');

  if (filterWrap && workList) {
    var buttons = filterWrap.querySelectorAll('.filter__btn');
    var works = workList.querySelectorAll('.work');

    filterWrap.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter__btn');
      if (!btn) return;

      var filter = btn.getAttribute('data-filter');
      var shown = 0;

      Array.prototype.forEach.call(buttons, function (b) {
        b.classList.toggle('is-active', b === btn);
      });

      Array.prototype.forEach.call(works, function (item) {
        var match = filter === 'all' || item.getAttribute('data-cat') === filter;
        item.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });

      if (emptyHint) emptyHint.hidden = shown > 0;
    });
  }

  /* ===== 回到顶部 ===== */
  var toTop = document.getElementById('to-top');

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var onScroll = function () {
      toTop.classList.toggle('is-visible', window.scrollY > 420);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
