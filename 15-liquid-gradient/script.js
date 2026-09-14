/* =========================================================
   15-liquid-gradient · 交互脚本
   - 所有行为都用 addEventListener 绑定，HTML 中没有内联事件
   - 交互清单：长沙实时时钟 / 昼夜主题切换 / 平滑滚动 /
     滚动进入动画 / 技能条生长 / 数字滚动 / 打字机 /
     作品筛选 / 鼠标跟随光晕 / 导航高亮 / 点击复制
   ========================================================= */
(function () {
  'use strict';

  /* ===== 0. 通用小工具 ===== */
  const $ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  const $$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = function (value) {
    return value < 10 ? '0' + value : String(value);
  };

  /* ===== 1. 轻提示：复制反馈与主题切换共用 ===== */
  const toastEl = $('#toast');
  let toastTimer = 0;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  /* ===== 2. 复制到剪贴板：优先 Clipboard API，失败时退回临时文本域 ===== */
  function legacyCopy(text) {
    try {
      const helper = document.createElement('textarea');
      helper.className = 'copy-helper';
      helper.value = text;
      helper.setAttribute('readonly', 'readonly');
      document.body.appendChild(helper);
      helper.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(helper);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function copyText(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  /* ===== 3. 长沙实时时钟（UTC+8，zh-CN 显示，每秒刷新） ===== */
  const CLOCK_TIME_ZONE = 'Asia/Shanghai';
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const clockDateEl = $('#clockDate');
  const clockTimeEl = $('#clockTime');
  const clockCard = $('#clock');
  let clockSnapshot = '';

  // 优先使用 Intl 的时区能力；个别环境不支持时退化为手算 UTC+8
  function readChangsha(date) {
    try {
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: CLOCK_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
        hour12: false
      });
      const bag = {};
      formatter.formatToParts(date).forEach(function (part) {
        bag[part.type] = part.value;
      });
      const hour = Number(bag.hour) % 24;
      return {
        date: bag.year + '年' + bag.month + '月' + bag.day + '日 ' + bag.weekday,
        time: pad2(hour) + ':' + pad2(Number(bag.minute)) + ':' + pad2(Number(bag.second)),
        hour: hour
      };
    } catch (err) {
      const shifted = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000);
      const hour = shifted.getHours();
      return {
        date: shifted.getFullYear() + '年' + pad2(shifted.getMonth() + 1) + '月' +
          pad2(shifted.getDate()) + '日 ' + WEEKDAYS[shifted.getDay()],
        time: pad2(hour) + ':' + pad2(shifted.getMinutes()) + ':' + pad2(shifted.getSeconds()),
        hour: hour
      };
    }
  }

  function renderClock() {
    const now = readChangsha(new Date());
    if (clockDateEl) clockDateEl.textContent = now.date;
    if (clockTimeEl) clockTimeEl.textContent = now.time;
    clockSnapshot = now.date + ' ' + now.time;
    return now;
  }

  /* ===== 4. 昼夜主题 =====
     默认按长沙时间自动判断（06:00-18:00 为日间），手动切换后用 localStorage 记住选择。
     参考基线：2026-09-14（星期一）22:07（UTC+8）属于夜间，
     HTML 中 body 先写死 class="theme-night" 作为脚本未运行时的兜底。 */
  const bodyEl = document.body;
  const themeToggle = $('#themeToggle');
  const themeIcon = $('#themeIcon');
  const themeText = $('#themeText');
  const THEME_STORAGE_KEY = 'ok-lzr-liquid-gradient-theme';
  let manualTheme = readStoredTheme();

  function readStoredTheme() {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      return (saved === 'day' || saved === 'night') ? saved : null;
    } catch (err) {
      return null;
    }
  }

  function autoTheme(hour) {
    return (hour >= 6 && hour < 18) ? 'day' : 'night';
  }

  function applyTheme(theme, persist) {
    const isDay = theme === 'day';
    bodyEl.classList.toggle('theme-day', isDay);
    bodyEl.classList.toggle('theme-night', !isDay);
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isDay));
      themeToggle.title = isDay ? '切换到夜间模式' : '切换到日间模式';
    }
    if (themeIcon) themeIcon.textContent = isDay ? '☀️' : '🌙';
    if (themeText) themeText.textContent = isDay ? '日间模式' : '夜间模式';
    if (persist) {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (err) { /* 忽略隐私模式限制 */ }
    }
  }

  const firstTick = renderClock();
  applyTheme(manualTheme || autoTheme(firstTick.hour), false);

  // 每秒刷新时钟；未手动切换主题时，跟随长沙昼夜自动校正
  window.setInterval(function () {
    const tick = renderClock();
    if (manualTheme) return;
    const current = bodyEl.classList.contains('theme-day') ? 'day' : 'night';
    if (autoTheme(tick.hour) !== current) applyTheme(autoTheme(tick.hour), false);
  }, 1000);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      manualTheme = bodyEl.classList.contains('theme-day') ? 'night' : 'day';
      applyTheme(manualTheme, true);
      showToast(manualTheme === 'day' ? '已切换到日间渐变 ☀️' : '已切换到夜间渐变 🌙');
    });
  }

  // 点击时钟卡片复制当前时间
  if (clockCard) {
    clockCard.addEventListener('click', function () {
      copyText(clockSnapshot).then(function (ok) {
        showToast(ok ? '已复制长沙时间：' + clockSnapshot : '复制失败，请手动选择时间');
      });
    });
  }

  /* ===== 5. 平滑滚动导航（锚点） ===== */
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      try { window.history.replaceState(null, '', hash); } catch (err) { /* file:// 下可能受限 */ }
    });
  });

  /* ===== 6. 导航高亮：当前区块点亮对应菜单项 ===== */
  const navLinks = $$('.nav__link');
  const navSections = navLinks
    .map(function (link) { return document.getElementById((link.getAttribute('href') || '').slice(1)); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && navSections.length) {
    const navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-current', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    navSections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ===== 7. 滚动进入动画 + 技能条生长 + 数字滚动 ===== */
  const revealItems = $$('.reveal');

  function fillSkillBar(el) {
    const level = Math.max(0, Math.min(100, Number(el.getAttribute('data-level')) || 0));
    el.style.setProperty('--level', level + '%');
  }

  function runCounter(el) {
    const target = Number(el.getAttribute('data-count')) || 0;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    const duration = 1100;
    const startTime = performance.now();
    (function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    })(startTime);
  }

  function activate(el) {
    el.classList.add('is-visible');
    $$('.skill__fill', el).forEach(fillSkillBar);
    $$('[data-count]', el).forEach(runCounter);
  }

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        activate(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });

    revealItems.forEach(function (el, index) {
      el.style.setProperty('--reveal-delay', (index % 6) * 80 + 'ms');
      revealObserver.observe(el);
    });
  } else {
    // 不支持 IntersectionObserver 时直接显示，保证内容永远可见
    revealItems.forEach(activate);
  }

  /* ===== 8. 首屏简介打字机 ===== */
  const typeEl = $('#typewriter');
  if (typeEl) {
    const fullText = typeEl.getAttribute('data-typing') || typeEl.textContent || '';
    if (reduceMotion) {
      typeEl.textContent = fullText;
    } else {
      typeEl.textContent = '';
      typeEl.classList.add('is-typing');
      let cursor = 0;
      (function typeNext() {
        cursor += 1;
        typeEl.textContent = fullText.slice(0, cursor);
        if (cursor < fullText.length) {
          const justTyped = fullText.charAt(cursor - 1);
          window.setTimeout(typeNext, justTyped === '，' || justTyped === '。' ? 260 : 84);
        } else {
          window.setTimeout(function () { typeEl.classList.remove('is-typing'); }, 1600);
        }
      })();
    }
  }

  /* ===== 9. 作品分类筛选 ===== */
  const filterButtons = $$('.filter');
  const workCards = $$('.work-card');

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const key = button.getAttribute('data-filter') || 'all';
      filterButtons.forEach(function (item) {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      workCards.forEach(function (card) {
        const tags = (card.getAttribute('data-tags') || '').split(/\s+/);
        const visible = key === 'all' || tags.indexOf(key) !== -1;
        card.classList.toggle('is-hidden', !visible);
        // 重新显示的卡片若还没播放过进入动画，直接置为可见
        if (visible) card.classList.add('is-visible');
      });
    });
  });

  /* ===== 10. 鼠标跟随光晕（仅支持悬停的设备） ===== */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const rootEl = document.documentElement;
    let queued = false;
    let lastX = 0;
    let lastY = 0;

    window.addEventListener('pointermove', function (event) {
      lastX = event.clientX;
      lastY = event.clientY;
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        rootEl.style.setProperty('--mx', lastX + 'px');
        rootEl.style.setProperty('--my', lastY + 'px');
        queued = false;
      });
    }, { passive: true });
  }

  /* ===== 11. 点击复制（地点等纯文本信息） ===== */
  $$('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function () {
      const value = el.getAttribute('data-copy') || '';
      copyText(value).then(function (ok) {
        showToast(ok ? '已复制：' + value : '复制失败，请手动选择');
      });
    });
  });
})();
