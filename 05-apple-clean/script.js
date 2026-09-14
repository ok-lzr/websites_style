/* ===========================================================
   05-apple-clean · 交互脚本
   职责：主题切换 / 平滑滚动导航 / 滚动进入动画 / 技能条 /
        数字滚动 / 作品筛选 / 打字机 / 长沙实时时钟
   仅做行为，不写样式（样式通过切换类名或 CSS 变量实现）
   =========================================================== */
(function () {
  'use strict';

  /* 昼夜主题的参考基线：2026-09-14 22:07（UTC+8），来自网络查询的参考时刻。
     仅用于首屏判断该用深色还是浅色；时钟本身始终使用 new Date() 实时取时。 */
  var REFERENCE_MOMENT = '2026-09-14T22:07:00+08:00';

  var doc = document;
  var root = doc.documentElement;

  /* ===== 1. 主题：先按参考基线的昼夜，再按系统偏好与本地记忆 ===== */
  function timeInShanghai(date) {
    // 用 Intl 取 UTC+8 的小时与星期，避免依赖本机时区
    var parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hour12: false
    }).formatToParts(date);
    var hour = 0;
    parts.forEach(function (p) {
      if (p.type === 'hour') { hour = parseInt(p.value, 10) % 24; }
    });
    return hour;
  }

  function isNight(hour) {
    return hour >= 19 || hour < 6;
  }

  function initTheme() {
    var toggle = doc.getElementById('themeToggle');
    var icon = doc.getElementById('themeIcon');
    var stored = null;
    try { stored = window.localStorage.getItem('oklzr-theme'); } catch (e) { stored = null; }

    // 参考基线 22:07 → 夜间；同一天的其他时段按小时推断
    var night = isNight(timeInShanghai(new Date(REFERENCE_MOMENT)));
    var theme = stored || (night ? 'dark' : 'light');

    function apply(next) {
      root.setAttribute('data-theme', next);
      if (icon) { icon.textContent = next === 'dark' ? '☀' : '☾'; }
      if (toggle) {
        toggle.setAttribute('aria-label', next === 'dark' ? '切换到浅色主题' : '切换到深色主题');
      }
    }

    apply(theme);

    if (toggle) {
      toggle.addEventListener('click', function () {
        theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(theme);
        try { window.localStorage.setItem('oklzr-theme', theme); } catch (e) { /* 隐私模式忽略 */ }
      });
    }
  }

  /* ===== 2. 导航：平滑滚动 + 滚动高亮当前栏目 ===== */
  function initNav() {
    var links = Array.prototype.slice.call(doc.querySelectorAll('.nav__link'));
    if (!links.length) { return; }

    // 点击时手动平滑滚动（并对固定导航做偏移补偿）
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') { return; }
        var target = doc.querySelector(id);
        if (!target) { return; }
        event.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 76;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
        history.replaceState(null, '', id);
      });
    });

    // 用滚动位置判断当前栏目，高亮对应链接
    var sections = links
      .map(function (link) { return doc.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    function highlight() {
      var line = window.pageYOffset + window.innerHeight * 0.28;
      var current = sections[0];
      sections.forEach(function (section) {
        if (section.offsetTop <= line) { current = section; }
      });
      links.forEach(function (link) {
        link.classList.toggle('is-active', current && link.getAttribute('href') === '#' + current.id);
      });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () {
        highlight();
        ticking = false;
      });
    }, { passive: true });
    highlight();
  }

  /* ===== 3. 滚动进入动画：IntersectionObserver 添加 is-visible ===== */
  function initReveal() {
    var items = Array.prototype.slice.call(doc.querySelectorAll('.reveal'));
    if (!items.length) { return; }

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        // 同一批元素按顺序微错开，形成克制的层次感
        var index = items.indexOf(entry.target);
        entry.target.style.transitionDelay = Math.min(index % 6, 5) * 60 + 'ms';
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ===== 4. 技能条：把数值映射为等级类名，宽度交给 CSS ===== */
  function initSkills() {
    var rows = Array.prototype.slice.call(doc.querySelectorAll('.skills__row'));
    if (!rows.length) { return; }

    function paint(row) {
      var level = parseInt(row.getAttribute('data-level'), 10) || 0;
      var bucket = level >= 90 ? 5 : level >= 80 ? 4 : level >= 70 ? 3 : level >= 60 ? 2 : 1;
      row.classList.add('is-lv' + bucket);
    }

    if (!('IntersectionObserver' in window)) {
      rows.forEach(paint);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        paint(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    rows.forEach(function (row) { observer.observe(row); });
  }

  /* ===== 5. 数字滚动：进入视口后从 0 递增到目标值 ===== */
  function initCounters() {
    var nums = Array.prototype.slice.call(doc.querySelectorAll('.stat__num'));
    if (!nums.length) { return; }

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var duration = 1200;
      var start = null;

      function step(now) {
        if (start === null) { start = now; }
        var progress = Math.min((now - start) / duration, 1);
        // easeOutExpo：末尾更舒缓，符合克制的观感
        var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        el.textContent = Math.round(target * eased).toLocaleString('zh-CN');
        if (progress < 1) { window.requestAnimationFrame(step); }
      }
      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    nums.forEach(function (el) { observer.observe(el); });
  }

  /* ===== 6. 作品筛选：切换筛选按钮与卡片显隐 ===== */
  function initFilters() {
    var buttons = Array.prototype.slice.call(doc.querySelectorAll('.filter'));
    var cards = Array.prototype.slice.call(doc.querySelectorAll('.card'));
    var emptyTip = doc.getElementById('emptyTip');
    if (!buttons.length || !cards.length) { return; }

    function apply(filter) {
      var shown = 0;
      cards.forEach(function (card) {
        var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
        var match = filter === 'all' || tags.indexOf(filter) !== -1;
        card.classList.toggle('is-hidden', !match);
        if (match) { shown += 1; }
      });
      if (emptyTip) { emptyTip.hidden = shown > 0; }
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (other) {
          var active = other === button;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        apply(button.getAttribute('data-filter'));
      });
    });
  }

  /* ===== 7. 打字机：循环展示几行短语 ===== */
  function initTypewriter() {
    var el = doc.getElementById('typewriter');
    if (!el) { return; }

    var lines = ['用克制的动效讲清楚一件事。', '写能长期维护的界面。', '把数据画成一眼能懂的样子。'];
    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = lines[0];
      return;
    }

    function tick() {
      var line = lines[lineIndex];
      if (!deleting) {
        charIndex += 1;
        el.textContent = line.slice(0, charIndex);
        if (charIndex >= line.length) {
          deleting = true;
          window.setTimeout(tick, 1600);
          return;
        }
        window.setTimeout(tick, 90);
      } else {
        charIndex -= 1;
        el.textContent = line.slice(0, charIndex);
        if (charIndex <= 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % lines.length;
          window.setTimeout(tick, 320);
          return;
        }
        window.setTimeout(tick, 45);
      }
    }

    window.setTimeout(tick, 500);
  }

  /* ===== 8. 长沙时间：new Date() 每秒刷新，使用 zh-CN 显示 ===== */
  function initClock() {
    var dateEl = doc.getElementById('clockDate');
    var timeEl = doc.getElementById('clockTime');
    var weekEl = doc.getElementById('clockWeek');
    var metaEl = doc.getElementById('clockMeta');
    if (!dateEl || !timeEl || !weekEl) { return; }

    var dateFmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric'
    });
    var weekFmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', weekday: 'long'
    });
    var timeFmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    function pad(value) { return value < 10 ? '0' + value : String(value); }

    function render() {
      var now = new Date(); // 实时时间，非固定值

      // 时分秒单独取，保证补零后宽度稳定
      var parts = timeFmt.formatToParts(now);
      var h = '00', m = '00', s = '00';
      parts.forEach(function (p) {
        if (p.type === 'hour') { h = pad(parseInt(p.value, 10) % 24); }
        if (p.type === 'minute') { m = pad(parseInt(p.value, 10)); }
        if (p.type === 'second') { s = pad(parseInt(p.value, 10)); }
      });

      dateEl.textContent = dateFmt.format(now);
      weekEl.textContent = weekFmt.format(now);
      timeEl.textContent = h + ':' + m + ':' + s;

      if (metaEl) {
        var hour = parseInt(h, 10);
        var phase = hour < 6 ? '凌晨' : hour < 11 ? '上午' : hour < 14 ? '午间' : hour < 18 ? '下午' : hour < 23 ? '夜晚' : '深夜';
        metaEl.textContent = isNight(hour) ? phase + ' · 深色模式更护眼' : phase + ' · 浅色模式更清亮';
      }
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();
    initNav();
    initReveal();
    initSkills();
    initCounters();
    initFilters();
    initTypewriter();
    initClock();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
