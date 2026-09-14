/* ==========================================================================
   32-botanical · 交互脚本
   模块：主题切换 → 打字机 → 滚动进入动画 → 技能生长 → 作品筛选
        → 数字滚动 → 长沙实时时钟 → 导航高亮与回到顶部 → 鼠标跟随 → 落叶
   全部交互通过 addEventListener 绑定，样式细节交给 CSS 类名。
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  };

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 主题切换：日间 / 夜读 ===== */
  function initTheme() {
    var root = document.documentElement;
    var btn = $('#themeToggle');
    if (!btn) { return; }

    var icon = $('.theme-toggle__icon', btn);
    var label = $('.theme-toggle__label', btn);
    var STORE_KEY = 'oklzr-botanical-theme';

    function apply(theme) {
      root.setAttribute('data-theme', theme);
      var isNight = theme === 'night';
      btn.setAttribute('aria-pressed', String(isNight));
      if (icon) { icon.textContent = isNight ? '☀' : '☾'; }
      if (label) { label.textContent = isNight ? '日间模式' : '夜读模式'; }
    }

    // 优先使用上次选择，否则跟随系统偏好
    var saved = null;
    try { saved = window.localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
    var initial = saved || ((window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'night' : 'day');
    apply(initial);

    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      apply(next);
      try { window.localStorage.setItem(STORE_KEY, next); } catch (e) { /* 忽略隐私模式报错 */ }
    });
  }

  /* ===== 打字机：首屏一句话循环 ===== */
  function initTyping() {
    var el = $('#typingText');
    if (!el) { return; }

    var lines = [
      '一句话简介：把需求修枝，把界面养绿。',
      '做官网、做看板、做顺手的小工具。',
      '长沙 · 前端 · 常年窗台有光。'
    ];

    if (prefersReducedMotion) {
      el.textContent = lines[0];
      return;
    }

    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var current = lines[lineIndex];
      charIndex += deleting ? -1 : 1;
      el.textContent = current.slice(0, charIndex);

      var delay = deleting ? 45 : 105;
      if (!deleting && charIndex === current.length) {
        delay = 1600;              // 写完后停顿
        deleting = true;
        charIndex = current.length;
      } else if (deleting && charIndex <= 0) {
        deleting = false;
        charIndex = 0;
        lineIndex = (lineIndex + 1) % lines.length;
        delay = 420;
      }
      window.setTimeout(tick, delay);
    }

    tick();
  }

  /* ===== 滚动进入动画 + 技能生长条 ===== */
  function initReveal() {
    var targets = $$('.reveal');
    var skills = $$('.skill');

    function growSkills() {
      skills.forEach(function (skill, i) {
        var bar = $('.skill__bar', skill);
        if (!bar) { return; }
        var level = Math.max(0, Math.min(100, parseFloat(bar.getAttribute('data-level')) || 0));
        bar.style.setProperty('--level', level + '%');
        window.setTimeout(function () { skill.classList.add('is-grown'); }, i * 130);
      });
    }

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      growSkills();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (t) { observer.observe(t); });

    // 技能区单独观察：进入视口后一次性生长
    var skillWrap = $('#skills');
    if (skillWrap) {
      var skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          growSkills();
          skillObserver.disconnect();
        });
      }, { threshold: 0.2 });
      skillObserver.observe(skillWrap);
    } else {
      growSkills();
    }
  }

  /* ===== 作品筛选：标签按钮 ===== */
  function initFilter() {
    var bar = $('.filter-bar');
    var list = $('#workList');
    if (!bar || !list) { return; }

    var buttons = $$('.filter-btn', bar);
    var items = $$('.work-item', list);
    var empty = $('#filterEmpty');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-filter') || 'all';

        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });

        var shown = 0;
        items.forEach(function (item) {
          var tags = (item.getAttribute('data-tags') || '').split(/\s+/);
          var match = filter === 'all' || tags.indexOf(filter) !== -1;
          item.classList.toggle('is-hidden', !match);
          if (match) { shown += 1; }
        });

        if (empty) { empty.hidden = shown !== 0; }
      });
    });
  }

  /* ===== 数字滚动：首屏数据 ===== */
  function initCounters() {
    var nums = $$('.mini-stat__num');
    if (!nums.length) { return; }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';

      if (prefersReducedMotion) {
        el.textContent = target + suffix;
        return;
      }

      var duration = 1200;
      var start = null;

      function step(now) {
        if (start === null) { start = now; }
        var progress = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);   // 缓出，像生长
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) { window.requestAnimationFrame(step); }
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(run);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { observer.observe(el); });
  }

  /* ===== 长沙时间：实时时钟 =====
     参考基线（来自网络查询的参考时刻）：2026-09-14（星期一）22:07 UTC+8。
     基线用于昼夜判断的基准校准；时钟本身始终以 new Date() 实时推进。 */
  var REFERENCE = {
    localMs: Date.UTC(2026, 8, 14, 22, 7, 0),  // 2026-09-14 22:07 (UTC+8) 的等效时间戳
    epochMs: Date.UTC(2026, 8, 14, 14, 7, 0),   // 同一时刻的 UTC 时间戳
    weekday: 1                                   // 0 = 周日，1 = 星期一
  };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function pad(n, len) {
    var s = String(n);
    while (s.length < (len || 2)) { s = '0' + s; }
    return s;
  }

  // 把“当前真实时间”映射到参考日历上，保证显示日期落在 2026-09-14 起算的时段内
  function mapToReference(now) {
    var delta = now.getTime() - REFERENCE.epochMs;
    var local = new Date(REFERENCE.localMs + delta);
    return {
      year: local.getUTCFullYear(),
      month: local.getUTCMonth() + 1,
      day: local.getUTCDate(),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
      second: local.getUTCSeconds(),
      weekday: (REFERENCE.weekday + Math.floor(delta / 86400000)) % 7
    };
  }

  function phaseOf(hour) {
    if (hour >= 5 && hour < 8) { return { text: '🌅 清晨', note: '天刚亮，适合读文档、排计划。' }; }
    if (hour >= 8 && hour < 12) { return { text: '🌿 上午', note: '光照充足，写代码效率最高的时段。' }; }
    if (hour >= 12 && hour < 14) { return { text: '🍚 午间', note: '先吃饭，再顺手浇一下窗台的绿植。' }; }
    if (hour >= 14 && hour < 18) { return { text: '🌤 下午', note: '适合联调、改样式、清理技术债。' }; }
    if (hour >= 18 && hour < 22) { return { text: '🌆 傍晚', note: '天色转暖，适合整理今天的提交。' }; }
    return { text: '🌙 夜间', note: '夜深了，记得让屏幕也休息一会儿。' };
  }

  function initClock() {
    var timeEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var phaseEl = $('#clockPhase');
    var noteEl = $('#clockNote');
    if (!timeEl && !dateEl) { return; }

    function render() {
      var now = new Date();
      var t = mapToReference(now);
      var weekdayText = WEEKDAYS[((t.weekday % 7) + 7) % 7];

      if (timeEl) {
        timeEl.textContent = pad(t.hour) + ':' + pad(t.minute) + ':' + pad(t.second);
      }
      if (dateEl) {
        dateEl.textContent = t.year + ' 年 ' + t.month + ' 月 ' + t.day + ' 日 · ' + weekdayText;
      }

      var phase = phaseOf(t.hour);
      if (phaseEl) { phaseEl.textContent = phase.text; }
      if (noteEl) { noteEl.textContent = phase.note; }
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 导航高亮 + 回到顶部 ===== */
  function initNavAndTop() {
    var links = $$('.nav-link');
    var sections = links.map(function (link) {
      var id = link.getAttribute('href') || '';
      return id.charAt(0) === '#' ? $(id) : null;
    });
    var toTop = $('#toTop');

    function onScroll() {
      var pos = window.scrollY + window.innerHeight * 0.32;

      var currentIndex = -1;
      sections.forEach(function (section, i) {
        if (section && section.offsetTop <= pos) { currentIndex = i; }
      });

      links.forEach(function (link, i) {
        link.classList.toggle('is-current', i === currentIndex);
      });

      if (toTop) { toTop.classList.toggle('is-visible', window.scrollY > 420); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      });
    }
  }

  /* ===== 鼠标跟随暖光 ===== */
  function initCursorGlow() {
    var canvas = $('.bg-canvas');
    var glow = $('#cursorGlow');
    if (!canvas || !glow || prefersReducedMotion) { return; }
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) { return; }

    var x = window.innerWidth / 2;
    var y = window.innerHeight / 3;
    var ticking = false;

    function paint() {
      canvas.style.setProperty('--mx', x + 'px');
      canvas.style.setProperty('--my', y + 'px');
      ticking = false;
    }

    window.addEventListener('mousemove', function (event) {
      x = event.clientX;
      y = event.clientY;
      canvas.classList.add('is-tracking');
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(paint);
      }
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      canvas.classList.remove('is-tracking');
    });
  }

  /* ===== 飘落叶片：偶尔生成一片，纯装饰 ===== */
  function initFallingLeaves() {
    var canvas = $('.bg-canvas');
    if (!canvas || prefersReducedMotion) { return; }

    function spawn() {
      if (document.hidden || canvas.childElementCount > 8) { return; }

      var leaf = document.createElement('span');
      leaf.className = 'falling-leaf';
      leaf.style.left = Math.round(Math.random() * 96) + 'vw';
      leaf.style.animationDuration = (9 + Math.random() * 7).toFixed(1) + 's';
      leaf.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
      canvas.appendChild(leaf);

      leaf.addEventListener('animationend', function () { leaf.remove(); });
    }

    window.setInterval(spawn, 3600);
    window.setTimeout(spawn, 1200);
  }

  /* ===== 启动 ===== */
  function boot() {
    initTheme();
    initTyping();
    initReveal();
    initFilter();
    initCounters();
    initClock();
    initNavAndTop();
    initCursorGlow();
    initFallingLeaves();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
