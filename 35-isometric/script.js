/* ==========================================================================
   35-isometric · 交互脚本（纯原生，无任何外部依赖）
   职责：
     1. 主题：根据参考时刻 2026-09-14 22:07（UTC+8，夜）推算夜 / 昼并切换
     2. 时钟：用 new Date() 实时刷新长沙时间（年月日 / 时:分:秒 / 星期）
     3. 导航：平滑滚动、滚动高亮当前区块、移动端折叠、页脚回顶
     4. 滚动：IntersectionObserver 逐块浮现 + 技能条填充 + 数字滚动
     5. 作品：分类筛选与卡片展开
     6. 鼠标：跟随指针轻微旋转等距场景（轴测视差）
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 常量与工具 ---------- */
  // 参考基线：2026-09-14（星期一）22:07 UTC+8 —— 用于判断夜 / 昼主题
  var REFERENCE_LOCAL = '2026-09-14T22:07:00+08:00';
  var NIGHT_START = 19; // 19 点后算夜
  var DAY_START = 7;    // 7 点前算夜

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  /* ---------- 1. 主题：夜视图 / 日视图 ---------- */
  var themeToggle = $('#themeToggle');
  var themeIcon = $('#themeIcon');
  var themeLabel = $('#themeLabel');

  // 取参考时刻的小时数，作为默认主题依据
  function referenceHour() {
    var ref = new Date(REFERENCE_LOCAL);
    return isNaN(ref.getTime()) ? 22 : ref.getHours();
  }

  function isNightHour(hour) {
    return hour >= NIGHT_START || hour < DAY_START;
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var night = theme === 'night';
    if (themeIcon) {
      themeIcon.textContent = night ? '☾' : '☀';
    }
    if (themeLabel) {
      themeLabel.textContent = night ? '夜视图' : '日视图';
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', night ? 'true' : 'false');
      themeToggle.setAttribute('title', night ? '当前：夜视图（点击切到日视图）' : '当前：日视图（点击切到夜视图）');
    }
  }

  function initTheme() {
    var saved = null;
    try {
      saved = window.localStorage.getItem('oklzr-iso-theme');
    } catch (err) {
      saved = null;
    }
    // 默认跟随参考时刻（2026-09-14 22:07 → 夜视图），用户手动切换后记住选择
    applyTheme(saved === 'day' || saved === 'night' ? saved : (isNightHour(referenceHour()) ? 'night' : 'day'));

    if (!themeToggle) {
      return;
    }
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
      try {
        window.localStorage.setItem('oklzr-iso-theme', next);
      } catch (err) {
        /* 隐私模式下忽略存储失败 */
      }
    });
  }

  /* ---------- 2. 时钟：长沙时间（UTC+8）实时刷新 ---------- */
  var clockTime = $('#clockTime');
  var clockDate = $('#clockDate');
  var clockWeek = $('#clockWeek');
  var contactClock = $('#contactClock');

  // 用 Intl 固定按 Asia/Shanghai 显示，保证任何时区访问都看到"长沙时间"
  // 星期也交给 Intl 计算，避免跨时区取到前一天
  var weekFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'long' });

  var timeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  function readParts(date) {
    var map = {};
    timeFormatter.formatToParts(date).forEach(function (part) {
      map[part.type] = part.value;
    });
    return map;
  }

  function updateClock() {
    var now = new Date();
    var parts = readParts(now);

    // 星期：交给 Intl 按长沙当地日期计算
    var week = weekFormatter.format(now);

    var ymd = parts.year + '年' + parts.month + '月' + parts.day + '日';
    var hms = pad(parseInt(parts.hour, 10) % 24) + ':' + parts.minute + ':' + parts.second;

    if (clockTime) {
      clockTime.textContent = hms;
    }
    if (clockDate) {
      clockDate.textContent = ymd;
    }
    if (clockWeek) {
      clockWeek.textContent = week;
    }
    if (contactClock) {
      contactClock.textContent = ymd + ' ' + week + ' ' + hms;
    }
  }

  function initClock() {
    updateClock();
    window.setInterval(updateClock, 1000);
  }

  /* ---------- 3. 导航：平滑滚动 + 当前位置高亮 + 移动端折叠 ---------- */
  var header = $('.site-header');
  var nav = $('#siteNav');
  var menuToggle = $('#menuToggle');
  var navLinks = $all('.nav-link');
  var sections = $all('main section[id]');

  function headerOffset() {
    return (header ? header.offsetHeight : 72) + 16;
  }

  function closeMenu() {
    if (!nav) {
      return;
    }
    nav.classList.remove('is-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  // 页内链接统一走 scrollIntoView，避免依赖 CSS 的平滑滚动实现差异
  function initSmoothScroll() {
    $all('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        if (!id || id === '#') {
          return;
        }
        var target = document.querySelector(id);
        if (!target) {
          return;
        }
        event.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset();
        window.scrollTo({ top: top < 0 ? 0 : top, behavior: reduceMotion ? 'auto' : 'smooth' });
        closeMenu();
      });
    });
  }

  function initMenu() {
    if (!menuToggle || !nav) {
      return;
    }
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // 点击导航外部区域收起折叠菜单
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) {
        return;
      }
      if (!nav.contains(event.target) && !menuToggle.contains(event.target)) {
        closeMenu();
      }
    });
  }

  // 滚动时高亮当前区块对应的导航项
  function initScrollSpy() {
    if (!sections.length || !navLinks.length) {
      return;
    }

    function highlight() {
      var line = window.pageYOffset + headerOffset() + 40;
      var currentId = sections[0].id;

      sections.forEach(function (section) {
        if (section.offsetTop <= line) {
          currentId = section.id;
        }
      });

      navLinks.forEach(function (link) {
        var active = link.getAttribute('href') === '#' + currentId;
        link.classList.toggle('is-active', active);
        if (active) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(function () {
        highlight();
        ticking = false;
      });
    }, { passive: true });

    highlight();
  }

  /* ---------- 4. 滚动进入动画 / 技能条 / 数字滚动 ---------- */
  var skillItems = $all('.skill-item');
  var counters = $all('[data-count]');

  function showAllReveals() {
    $all('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
    fillSkills();
    runCounters();
  }

  function fillSkills() {
    skillItems.forEach(function (item) {
      var value = parseInt(item.getAttribute('data-value'), 10) || 0;
      item.style.setProperty('--value', value + '%');
      item.classList.add('is-filled');
    });
  }

  function runCounters() {
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var suffix = el.getAttribute('data-suffix') || '';

      if (reduceMotion) {
        el.textContent = target + suffix;
        return;
      }

      var duration = 1100;
      var start = null;

      function step(timestamp) {
        if (start === null) {
          start = timestamp;
        }
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    });
  }

  function initReveal() {
    var reveals = $all('.reveal');
    var skillPanel = $('#skillPanel');

    if (!('IntersectionObserver' in window) || reduceMotion) {
      showAllReveals();
      return;
    }

    // 逐块浮现：同组元素用索引做一点错峰
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    reveals.forEach(function (el, index) {
      // 同一容器内相邻卡片略微错开，形成"逐块垒起来"的观感
      var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(siblings * 70 + (index % 3) * 20, 420) + 'ms';
      revealObserver.observe(el);
    });

    // 技能条与数字滚动：进入视口后一次性触发
    if (skillPanel) {
      var skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          fillSkills();
          runCounters();
          skillObserver.disconnect();
        });
      }, { threshold: 0.3 });
      skillObserver.observe(skillPanel);
    } else {
      fillSkills();
      runCounters();
    }
  }

  /* ---------- 5. 作品：分类筛选 + 展开详情 ---------- */
  function initFilter() {
    var bar = $('#filterBar');
    var cards = $all('.work-card');
    if (!bar || !cards.length) {
      return;
    }

    var buttons = Array.prototype.slice.call(bar.querySelectorAll('.filter-btn'));

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var filter = button.getAttribute('data-filter');

        buttons.forEach(function (other) {
          var active = other === button;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        cards.forEach(function (card) {
          var match = filter === 'all' || card.getAttribute('data-category') === filter;
          card.classList.toggle('is-hidden', !match);
          if (!match) {
            // 被隐藏的卡片收起详情，避免筛选回来后状态错乱
            card.classList.remove('is-open');
            var toggle = card.querySelector('.work-toggle');
            if (toggle) {
              toggle.setAttribute('aria-expanded', 'false');
              toggle.textContent = '展开详情';
            }
          }
        });
      });
    });
  }

  function initWorkToggle() {
    $all('.work-toggle').forEach(function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('.work-card');
        if (!card) {
          return;
        }
        var open = card.classList.toggle('is-open');
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        button.textContent = open ? '收起详情' : '展开详情';
      });
    });
  }

  /* ---------- 6. 等距场景：鼠标跟随视差 ---------- */
  function initSceneTilt() {
    var scene = $('#scene');
    if (!scene || reduceMotion) {
      return;
    }
    // 只在指针设备上启用，触屏不做多余计算
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }

    var targetX = 0;
    var targetY = 0;
    var ticking = false;
    var MAX = 9; // 最大倾斜角度（度）

    function render() {
      scene.style.setProperty('--tiltY', targetY.toFixed(2) + 'deg');
      scene.style.setProperty('--tiltX', targetX.toFixed(2) + 'deg');
      ticking = false;
    }

    window.addEventListener('mousemove', function (event) {
      var rect = scene.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      // 归一化到 [-1, 1]，除以视口尺度让移动更平缓
      targetY = Math.max(-1, Math.min(1, (event.clientX - cx) / (window.innerWidth / 2))) * -MAX;
      targetX = Math.max(-1, Math.min(1, (event.clientY - cy) / (window.innerHeight / 2))) * MAX;

      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(render);
      }
    }, { passive: true });

    // 指针离开窗口时回到正视角度
    document.addEventListener('mouseleave', function () {
      targetX = 0;
      targetY = 0;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(render);
      }
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    initTheme();
    initClock();
    initSmoothScroll();
    initMenu();
    initScrollSpy();
    initReveal();
    initFilter();
    initWorkToggle();
    initSceneTilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
