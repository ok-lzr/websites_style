/* =========================================================
   柔和拟物个人主页 · 交互脚本
   约定：样式只在 CSS 里，这里只切类名、设 CSS 变量和更新文本。
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 常量：昼夜主题的参考基准 ---------- */
  /* 网络查询得到的参考时刻：2026-09-14（星期一）22:07（UTC+8），属于夜间，
     仅用于首次进入时决定日/夜主题；页面时钟始终使用 new Date() 实时刷新。 */
  var BASELINE_ISO = '2026-09-14T22:07:00+08:00';
  var BASELINE_HOUR = 22;
  var THEME_KEY = 'oklzr-theme';

  /* ---------- 小工具 ---------- */
  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  /* ===== 1. 深浅色主题切换 ===== */
  function initTheme() {
    var toggle = $('#themeToggle');
    var icon = $('#themeIcon');
    var saved = null;

    try {
      saved = window.localStorage.getItem(THEME_KEY);
    } catch (err) {
      saved = null; /* 隐私模式下 localStorage 可能不可用，退化为基准主题 */
    }

    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (BASELINE_HOUR >= 19 || BASELINE_HOUR < 7 ? 'dark' : 'light');

    applyTheme(theme);

    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (err) {
        /* 存不了也不影响本次切换 */
      }
    });

    function applyTheme(value) {
      root.setAttribute('data-theme', value);
      var isDark = value === 'dark';
      if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
      }
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(isDark));
        toggle.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题');
      }
    }
  }

  /* ===== 2. 长沙实时时钟（UTC+8） ===== */
  function initClock() {
    var timeEl = $('#clockTime');
    var metaEl = $('#clockMeta');
    if (!timeEl) {
      return;
    }

    var formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    function render() {
      var now = new Date();
      var parts = {};
      formatter.formatToParts(now).forEach(function (part) {
        parts[part.type] = part.value;
      });

      var hh = parts.hour || '00';
      var mm = parts.minute || '00';
      var ss = parts.second || '00';
      var hour = parseInt(hh, 10);
      var dayPart = (hour >= 6 && hour < 19) ? '白天' : '夜间';

      timeEl.textContent = hh + ':' + mm + ':' + ss;
      timeEl.setAttribute('datetime', now.toISOString());

      if (metaEl) {
        metaEl.textContent = parts.year + '年' + parts.month + parts.day + '日 ' +
          parts.weekday + ' · 长沙（UTC+8）· 现在' + dayPart;
      }
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 3. 导航：平滑滚动 + 当前区块高亮 ===== */
  function initNav() {
    var links = $all('.nav__link');

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') {
          return;
        }
        var target = document.querySelector(id);
        if (!target) {
          return;
        }
        event.preventDefault();
        target.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', id);
        }
      });
    });

    var sections = links
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) {
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        links.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ===== 4. 滚动进入动画 ===== */
  function initReveal() {
    var items = $all('.section');
    if (!items.length) {
      return;
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }

    /* 入场顺序的延迟差异交给 CSS 的 nth-child 处理 */
    items.forEach(function (item) {
      item.classList.add('reveal');
    });

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    items.forEach(function (item) { observer.observe(item); });
  }

  /* ===== 5. 技能条：进入视口后生长 ===== */
  function initSkills() {
    var skills = $all('.skill');
    if (!skills.length) {
      return;
    }

    function fill() {
      skills.forEach(function (skill) {
        var level = parseInt(skill.getAttribute('data-level'), 10);
        if (isNaN(level)) {
          return;
        }
        skill.style.setProperty('--level', (level / 100).toFixed(3));
        skill.classList.add('is-filled');
      });
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      fill();
      return;
    }

    var list = $('#skills');
    if (!list) {
      fill();
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        fill();
        obs.disconnect();
      });
    }, { threshold: 0.25 });

    observer.observe(list);
  }

  /* ===== 6. 数字滚动 ===== */
  function initCounters() {
    var counters = $all('.stat__num');
    if (!counters.length) {
      return;
    }

    function run(el) {
      var target = parseInt(el.getAttribute('data-count-to'), 10);
      if (isNaN(target)) {
        return;
      }
      if (reduceMotion || target === 0) {
        el.textContent = String(target);
        return;
      }

      var duration = 1100;
      var start = null;

      function step(timestamp) {
        if (start === null) {
          start = timestamp;
        }
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(run);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        run(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  /* ===== 7. 作品分类筛选 ===== */
  function initFilters() {
    var chips = $all('[data-filter]');
    var works = $all('.work');
    if (!chips.length || !works.length) {
      return;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var filter = chip.getAttribute('data-filter');

        chips.forEach(function (other) {
          var active = other === chip;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-pressed', String(active));
        });

        works.forEach(function (work) {
          var category = work.getAttribute('data-category');
          var show = filter === 'all' || filter === category;
          work.classList.toggle('is-hidden', !show);
        });
      });
    });
  }

  /* ===== 8. 复制文本（地点、时间） ===== */
  function initCopy() {
    var toast = $('#toast');
    var toastTimer = null;

    function showToast(message) {
      if (!toast) {
        return;
      }
      toast.textContent = message;
      toast.classList.add('is-shown');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('is-shown');
      }, 2000);
    }

    function fallbackCopy(text) {
      /* 老浏览器不支持剪贴板 API 时的兜底：借一个屏幕外的输入框选中复制 */
      var input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', 'readonly');
      input.className = 'copy-helper';
      document.body.appendChild(input);
      input.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(input);
      showToast(ok ? '已复制：' + text : '复制失败，请手动选择：' + text);
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('已复制：' + text);
        }).catch(function () {
          fallbackCopy(text);
        });
        return;
      }
      fallbackCopy(text);
    }

    $all('[data-copy]').forEach(function (el) {
      el.addEventListener('click', function () {
        copyText(el.getAttribute('data-copy'));
      });
    });

    $all('[data-copy-target]').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = document.getElementById(el.getAttribute('data-copy-target'));
        if (target) {
          copyText(target.textContent.trim());
        }
      });
    });
  }

  /* ===== 9. 回到顶部按钮 ===== */
  function initToTop() {
    var button = $('#toTop');
    if (!button) {
      return;
    }

    function sync() {
      button.classList.toggle('is-shown', window.scrollY > 420);
    }

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initTheme();
    initClock();
    initNav();
    initReveal();
    initSkills();
    initCounters();
    initFilters();
    initCopy();
    initToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
