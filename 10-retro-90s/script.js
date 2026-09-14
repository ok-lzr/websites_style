/* ============================================================
   10-retro-90s / script.js
   行为全部集中在此：星点背景、实时时钟、访客计数器、滚动动画、
   作品筛选、数字滚动、昼夜主题、平滑滚动导航。
   ============================================================ */
(function () {
  'use strict';

  /* ===== 小工具 ===== */
  var $ = function (sel, scope) {
    return (scope || document).querySelector(sel);
  };

  // 数字补零，用于计数器与时钟
  var pad = function (num, len) {
    return String(num).padStart(len || 2, '0');
  };

  // 站点统计的本地基数（无后端，纯浏览器记录）
  var VISIT_BASE = 1268;
  var STORE_KEY = 'oklzr-90s-visits';

  /* ===== 1. 星点背景：随机生成会闪烁的星星 ===== */
  function buildStars() {
    var field = $('#starField');
    if (!field) {
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 90; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      star.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
      if (i % 7 === 0) {
        star.style.background = '#ff8ef7';
      }
      frag.appendChild(star);
    }
    field.appendChild(frag);
  }

  /* ===== 2. 长沙时间：始终按 UTC+8 显示，含年月日、时分秒、星期 ===== */
  function getChangshaParts(date) {
    // 以系统时间为准，通过时区参数换算到长沙（UTC+8）
    var fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      hour12: false
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (item) {
      parts[item.type] = item.value;
    });
    return parts;
  }

  function updateClock() {
    var now = new Date();
    var t = getChangshaParts(now);
    var hour = parseInt(t.hour, 10) % 24;

    var timeText = pad(hour) + ':' + t.minute + ':' + t.second;
    var dateText = t.year + ' 年 ' + parseInt(t.month, 10) + ' 月 ' +
      parseInt(t.day, 10) + ' 日 ' + (t.weekday || '') + ' · 长沙时间';

    var clockEl = $('#clockTime');
    var dateEl = $('#clockDate');
    var dataClockEl = $('#dataClock');
    if (clockEl) {
      clockEl.textContent = timeText;
      clockEl.setAttribute('datetime', now.toISOString());
    }
    if (dateEl) {
      dateEl.textContent = dateText;
    }
    if (dataClockEl) {
      dataClockEl.textContent = timeText + ' · ' + dateText;
      dataClockEl.setAttribute('datetime', now.toISOString());
    }
  }

  function startClock() {
    updateClock();
    window.setInterval(updateClock, 1000);
  }

  /* ===== 3. 昼夜主题：按当前时段自动判定，可手动切换并记住选择 ===== */
  function periodOf(hour) {
    return hour >= 6 && hour < 18 ? '白昼' : '夜间';
  }

  function applyTheme(isNight, badgeText) {
    document.body.classList.toggle('is-day', !isNight);
    var icon = $('#themeIcon');
    var text = $('#themeText');
    var badge = $('#themeBadge');
    var btn = $('#themeToggle');
    if (icon) {
      icon.textContent = isNight ? '🌙' : '☀';
    }
    if (text) {
      text.textContent = isNight ? '夜间模式' : '白昼模式';
    }
    if (badge) {
      badge.textContent = badgeText || (isNight ? '夜间' : '白昼');
    }
    if (btn) {
      btn.setAttribute('aria-pressed', String(isNight));
    }
  }

  function initTheme() {
    var hour = parseInt(getChangshaParts(new Date()).hour, 10) % 24;
    var period = periodOf(hour);
    // 参考基线 2026-09-14 22:07（UTC+8）属于夜间，因此默认夜间更贴合 90 年代氛围
    var saved = null;
    try {
      saved = window.localStorage.getItem('oklzr-90s-theme');
    } catch (err) {
      saved = null;
    }
    var isNight = saved === 'day' ? false : saved === 'night' ? true : true;
    applyTheme(isNight, period + '时段');

    var periodEl = $('#periodText');
    if (periodEl) {
      periodEl.textContent = period;
    }

    var btn = $('#themeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var nowNight = document.body.classList.contains('is-day');
        applyTheme(nowNight, period + '时段');
        try {
          window.localStorage.setItem('oklzr-90s-theme', nowNight ? 'night' : 'day');
        } catch (err) {
          /* 隐私模式下写入失败可忽略 */
        }
      });
    }
  }

  /* ===== 4. 访客计数器：本地累加 + 里程表数字 ===== */
  function readVisits() {
    var value = VISIT_BASE;
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var saved = raw ? parseInt(raw, 10) : NaN;
      if (!isNaN(saved) && saved > 0) {
        value = saved + 1; // 每次打开 +1
      }
      window.localStorage.setItem(STORE_KEY, String(value));
    } catch (err) {
      value = VISIT_BASE + 1;
    }
    return value;
  }

  function renderHits(value) {
    var text = pad(value, 6);
    var counterEl = $('#hitCounter');
    if (counterEl) {
      counterEl.textContent = text;
    }

    var odometer = $('#odometer');
    if (!odometer) {
      return;
    }
    var old = odometer.textContent;
    odometer.textContent = '';
    text.split('').forEach(function (ch, idx) {
      var cell = document.createElement('span');
      cell.className = 'digit';
      cell.textContent = ch;
      // 数字发生变化时做一次下落动画
      if (old.charAt(idx) !== ch) {
        cell.classList.add('pop');
      }
      odometer.appendChild(cell);
    });
  }

  function initCounter() {
    var value = readVisits();
    renderHits(value);

    // 最后一次访问时间
    var lastEl = $('#lastVisit');
    try {
      var raw = window.localStorage.getItem('oklzr-90s-last');
      if (lastEl && raw) {
        lastEl.textContent = raw;
        lastEl.setAttribute('datetime', raw);
      }
      var stamp = new Date();
      var label = getChangshaParts(stamp);
      var nowText = label.year + '-' + label.month + '-' + label.day + ' ' +
        pad(parseInt(label.hour, 10)) + ':' + label.minute + ':' + label.second;
      if (lastEl && !raw) {
        lastEl.textContent = '本次为首次访问';
      }
      window.localStorage.setItem('oklzr-90s-last', nowText);
    } catch (err) {
      /* 忽略存储不可用的情况 */
    }

    var signBtn = $('#signBtn');
    if (signBtn) {
      signBtn.addEventListener('click', function () {
        var next = 0;
        try {
          next = parseInt(window.localStorage.getItem(STORE_KEY), 10) + 1 || VISIT_BASE + 2;
          window.localStorage.setItem(STORE_KEY, String(next));
        } catch (err) {
          next = VISIT_BASE + 2;
        }
        renderHits(next);
        signBtn.textContent = '签到成功 ✓';
        window.setTimeout(function () {
          signBtn.textContent = '签个到 +1';
        }, 1600);
      });
    }
  }

  /* ===== 5. 滚动进入动画 + 技能条动画 ===== */
  function fillSkill(skill) {
    var value = parseInt(skill.getAttribute('data-value'), 10) || 0;
    var fill = $('.bar-fill', skill);
    var valEl = $('.skill-val', skill);
    if (fill) {
      fill.style.width = value + '%';
    }
    if (!valEl) {
      return;
    }
    // 技能百分比数字跟随进度滚动
    var start = window.performance.now();
    var duration = 1100;
    var step = function (now) {
      var ratio = Math.min((now - start) / duration, 1);
      valEl.textContent = Math.round(value * ratio) + '%';
      if (ratio < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  function initReveal() {
    var targets = document.querySelectorAll('.reveal, .skill, .stat-card, .window');
    if (!('IntersectionObserver' in window)) {
      // 老浏览器直接显示全部内容
      Array.prototype.forEach.call(targets, function (el) {
        el.classList.add('is-visible');
      });
      Array.prototype.forEach.call(document.querySelectorAll('.skill'), fillSkill);
      return;
    }

    var skillObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          fillSkill(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    Array.prototype.forEach.call(targets, function (el) {
      if (el.classList.contains('skill')) {
        skillObserver.observe(el);
      } else {
        el.classList.add('reveal');
        revealObserver.observe(el);
      }
    });
  }

  /* ===== 6. 数字滚动：数据区统计卡片 ===== */
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var start = window.performance.now();
    var duration = 1200;
    var step = function (now) {
      var ratio = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - ratio, 3);
      el.textContent = Math.round(target * eased);
      if (ratio < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  function initCountUp() {
    var nums = document.querySelectorAll('.stat-num');
    if (!nums.length) {
      return;
    }
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nums, countUp);
      return;
    }
    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          countUp(entry.target);
          o.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(nums, function (el) {
      obs.observe(el);
    });
  }

  /* ===== 7. 作品筛选：按技术栈标签切换卡片 ===== */
  function initFilter() {
    var buttons = document.querySelectorAll('.filter-btn');
    var cards = document.querySelectorAll('#projectGrid .project');
    var countEl = $('#projectCount');
    var emptyTip = $('#emptyTip');
    if (!buttons.length) {
      return;
    }

    var apply = function (filter) {
      var shown = 0;
      Array.prototype.forEach.call(cards, function (card) {
        var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
        var hit = filter === 'all' || tags.indexOf(filter) !== -1;
        card.classList.toggle('is-hidden', !hit);
        if (hit) {
          shown++;
        }
      });
      if (countEl) {
        countEl.textContent = shown;
      }
      if (emptyTip) {
        emptyTip.hidden = shown !== 0;
      }
    };

    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(buttons, function (other) {
          other.classList.toggle('is-active', other === btn);
        });
        apply(btn.getAttribute('data-filter'));
      });
    });
  }

  /* ===== 8. 平滑滚动 + 当前栏目高亮 + 回到顶部 ===== */
  function initNav() {
    var links = document.querySelectorAll('.nav-link[href^="#"]');

    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        var target = id && id.length > 1 ? document.querySelector(id) : null;
        if (!target) {
          return;
        }
        event.preventDefault();
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) {
          history.replaceState(null, '', id);
        }
      });
    });

    var sections = document.querySelectorAll('main section[id]');
    if (!('IntersectionObserver' in window) || !sections.length) {
      return;
    }
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        Array.prototype.forEach.call(links, function (link) {
          link.classList.toggle('is-current', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Array.prototype.forEach.call(sections, function (section) {
      spy.observe(section);
    });

    var topBtn = $('#toTop');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ===== 启动：DOM 就绪后绑定全部行为 ===== */
  function boot() {
    buildStars();
    startClock();
    initTheme();
    initCounter();
    initReveal();
    initCountUp();
    initFilter();
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
