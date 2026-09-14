/* ============================================================
   26-high-contrast · script.js
   职责（结构 / 样式 / 行为三分离，这里只放行为）：
     1. 导航平滑滚动 + 当前区块高亮
     2. 滚动进入动画（IntersectionObserver）
     3. 数字滚动动画 + 技能条填充
     4. 长沙时间实时时钟（new Date() 每秒刷新）+ 夜 / 昼判断
     5. 反色模式切换、时钟卡片点击切换 12 / 24 小时制
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasObserver = 'IntersectionObserver' in window;

  /* ===== 1. 导航：平滑滚动 + 当前区块高亮 ===== */
  var hashLinks = Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]'));

  hashLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href');
      if (!hash || hash === '#') {
        return;
      }
      var target = document.querySelector(hash);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start'
      });
      // 地址栏同步锚点，方便分享
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', hash);
      }
    });
  });

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var navTargets = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (hasObserver && navTargets.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        navLinks.forEach(function (link) {
          var isCurrent = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', isCurrent);
          if (isCurrent) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    navTargets.forEach(function (target) { navObserver.observe(target); });
  }

  /* ===== 2. 滚动进入动画 + 数字动画触发 ===== */
  function countUp(el, target, suffix, duration) {
    if (prefersReduced || !window.requestAnimationFrame) {
      el.textContent = target + suffix;
      return;
    }
    var startTime = null;

    function step(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // 缓出，收尾更利落
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  // 技能条：把等级写进 CSS 变量 --level，样式仍由 CSS 负责
  function fillSkill(skill) {
    var level = parseFloat(skill.getAttribute('data-level')) || 0;
    skill.style.setProperty('--level', level);
  }

  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function activate(el) {
    el.classList.add('is-visible');
    Array.prototype.forEach.call(el.querySelectorAll('[data-count]'), function (counter) {
      if (counter.dataset.done === '1') {
        return;
      }
      counter.dataset.done = '1';
      countUp(
        counter,
        parseFloat(counter.getAttribute('data-count')) || 0,
        counter.getAttribute('data-suffix') || '',
        1100
      );
    });
    if (el.classList.contains('skill')) {
      fillSkill(el);
    }
  }

  if (hasObserver && !prefersReduced) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        activate(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  } else {
    // 不支持观察器或用户要求减少动效时，直接呈现最终状态
    revealItems.forEach(function (el) {
      activate(el);
      el.classList.add('is-visible');
    });
  }

  /* ===== 3. 长沙时间实时时钟（UTC+8） ===== */
  var clockValue = document.getElementById('clockValue');
  var clockHint = document.getElementById('clockValue2');
  var clockPhase = document.getElementById('clockPhase');
  var heroClock = document.getElementById('heroClock');
  var heroPhase = document.getElementById('heroPhase');
  var clockCard = document.getElementById('clockCard');
  var use12Hour = false;

  var dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  var time24Formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  var time12Formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // 用 new Date() 取当下时刻，再换算成东八区的小时，用于夜 / 昼判断
  function beijingHour(now) {
    return new Date(now.getTime() + 8 * 3600000).getUTCHours();
  }

  function describePhase(hour) {
    if (hour >= 19 || hour < 6) {
      return { key: 'night', label: '夜间 · 荧光黄全开' };
    }
    if (hour < 11) {
      return { key: 'day', label: '上午 · 清醒模式' };
    }
    if (hour < 14) {
      return { key: 'day', label: '正午 · 高强度输出' };
    }
    return { key: 'day', label: '下午 · 稳定推进' };
  }

  function renderClock() {
    var now = new Date();
    var hour = beijingHour(now);
    var phase = describePhase(hour);
    var timeText = (use12Hour ? time12Formatter : time24Formatter).format(now);
    var fullText = dateFormatter.format(now) + ' ' + timeText;

    // 页面可见的两处时钟文本
    if (clockValue) {
      clockValue.textContent = fullText;
    }
    if (heroClock) {
      heroClock.textContent = timeText;
    }
    if (clockPhase) {
      clockPhase.textContent = '当前时段：' + phase.label;
      clockPhase.classList.toggle('is-night', phase.key === 'night');
    }
    if (heroPhase) {
      heroPhase.textContent = phase.key === 'night' ? '夜间' : '昼间';
      heroPhase.classList.toggle('is-night', phase.key === 'night');
    }
    if (clockHint) {
      clockHint.textContent = '点击切换 · 当前 ' + (use12Hour ? '12' : '24') + ' 小时制';
    }
    // 夜 / 昼主题：夜间把斜切色块与强调都拉满
    body.setAttribute('data-phase', phase.key);
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  // 点击时间卡片：24 / 12 小时制切换
  if (clockCard) {
    clockCard.addEventListener('click', function () {
      use12Hour = !use12Hour;
      clockCard.setAttribute('aria-pressed', use12Hour ? 'true' : 'false');
      renderClock();
    });
  }

  /* ===== 4. 反色模式：黄底黑字 / 黑底黄字 ===== */
  var themeToggle = document.getElementById('themeToggle');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var inverted = root.classList.toggle('is-invert');
      themeToggle.setAttribute('aria-pressed', inverted ? 'true' : 'false');
      themeToggle.textContent = inverted ? '恢复纯黑' : '反色模式';
    });
  }
})();
