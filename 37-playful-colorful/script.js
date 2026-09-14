/* ==========================================================================
   37-playful-colorful / script.js
   行为全部在这里，通过 addEventListener 绑定，HTML 中不写任何内联事件。
   模块
   1. 长沙实时时钟（new Date + zh-CN + Asia/Shanghai）
   2. 昼 / 夜主题（由时钟驱动，可手动切换）
   3. 平滑滚动导航与滚动监听（进度条、回到顶部、导航高亮）
   4. 滚动进入动画（IntersectionObserver）
   5. 技能条动画
   6. 作品分类筛选
   7. 作品详情展开收起
   8. 数字滚动
   9. 鼠标跟随果冻
   10. 点击复制长沙时间 + 提示条
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 通用小工具 ===== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const setText = (sel, text) => $$(sel).forEach((el) => { el.textContent = text; });
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ===== 1. 参考基线时刻与长沙时钟 =====
     参考基线：2026-09-14（星期一）22:07（UTC+8），来自网络查询的参考时刻。
     用途：① 取它的时分（22:07）作为"当天基线时间"，参与昼 / 夜主题判断；
           ② 显示在个人数据区，说明主题判定的依据。
     注意：时钟本身永远用 new Date() 实时计算，基线只做参考与主题阈值。 */
  const BASELINE = { year: 2026, month: 9, day: 14, weekday: '星期一', hour: 22, minute: 7 };
  const NIGHT_FROM_HOUR = BASELINE.hour - 3; // 22:07 往前 3 小时 → 19:00 起算夜间
  const DAY_FROM_HOUR = 6;                   // 06:00 起算白天

  const csFormat = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long'
  });

  // 取长沙（UTC+8）当地时间的各个字段
  function changshaNow() {
    const parts = {};
    csFormat.formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    const hour = Number(parts.hour);
    return {
      hour: hour,
      dateText: parts.year + '年' + parts.month + '月' + parts.day + '日',
      timeText: parts.hour + ':' + parts.minute + ':' + parts.second,
      weekText: parts.weekday,
      fullText: parts.year + '-' + parts.month + '-' + parts.day + ' ' +
        parts.hour + ':' + parts.minute + ':' + parts.second
    };
  }

  /* ===== 2. 昼 / 夜主题 ===== */
  let autoTheme = true; // 用户手动切换后停止自动跟随

  function applyTheme(theme, fromUser) {
    document.documentElement.setAttribute('data-theme', theme);
    const isNight = theme === 'night';
    const btn = $('#themeToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(isNight));
      btn.setAttribute('title', isNight ? '切换到白天配色' : '切换到夜间配色');
    }
    setText('.theme-toggle-icon', isNight ? '☀️' : '🌙');
    setText('.theme-toggle-text', isNight ? '白天' : '夜间');
    setText('.js-daynight', isNight ? '夜间' : '白天');
    if (fromUser) { autoTheme = false; }
  }

  // 主题判定：长沙时间 19:00 之后或 06:00 之前算夜间
  function themeByHour(hour) {
    return (hour >= NIGHT_FROM_HOUR || hour < DAY_FROM_HOUR) ? 'night' : 'day';
  }

  /* 每秒刷新：时间文本 + （未手动切换时）主题 */
  function tickClock() {
    const now = changshaNow();
    setText('.js-clock-date', now.dateText);
    setText('.js-clock-time', now.timeText);
    setText('.js-clock-week', now.weekText);
    if (autoTheme) { applyTheme(themeByHour(now.hour), false); }
  }

  // 基线文案：参考时刻 + 今日同样的基线时分
  const baselineText = BASELINE.year + '-' + pad2(BASELINE.month) + '-' + pad2(BASELINE.day) +
    '（' + BASELINE.weekday + '）' + pad2(BASELINE.hour) + ':' + pad2(BASELINE.minute);
  setText('.js-baseline', baselineText + ' · 今日基线 ' + pad2(BASELINE.hour) + ':' + pad2(BASELINE.minute));

  tickClock();
  window.setInterval(tickClock, 1000);

  // 手动切换主题
  const themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'night' ? 'day' : 'night', true);
    });
  }

  /* ===== 3. 平滑滚动导航 + 滚动监听 ===== */
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') { return; }
      const target = document.querySelector(hash);
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      try { history.replaceState(null, '', hash); } catch (err) { /* file:// 下忽略 */ }
    });
  });

  const progressBar = $('#scrollProgress');
  const toTop = $('#toTop');
  let scrollQueued = false;

  function onScrollFrame() {
    scrollQueued = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
    if (progressBar) { progressBar.style.transform = 'scaleX(' + ratio + ')'; }
    if (toTop) { toTop.classList.toggle('is-show', doc.scrollTop > 420); }
  }

  window.addEventListener('scroll', function () {
    if (!scrollQueued) {
      scrollQueued = true;
      window.requestAnimationFrame(onScrollFrame);
    }
  }, { passive: true });
  window.addEventListener('resize', onScrollFrame);
  onScrollFrame();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  }

  /* 导航高亮：当前可见区块对应的链接加 .is-active */
  const navLinks = $$('#navList .nav-link');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const linkMap = {};
    navLinks.forEach(function (link) {
      linkMap[link.getAttribute('href').slice(1)] = link;
    });
    const spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const link = linkMap[entry.target.id];
        if (link && entry.isIntersecting) {
          navLinks.forEach(function (l) { l.classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    Object.keys(linkMap).forEach(function (id) {
      const section = document.getElementById(id);
      if (section) { spy.observe(section); }
    });
  }

  /* ===== 4. 滚动进入动画 ===== */
  const revealTargets = $$('.reveal, .skill');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        if (entry.target.classList.contains('stat-item')) {
          const num = $('.stat-num', entry.target);
          if (num) { animateCount(num); }
        }
        observer.unobserve(entry.target);
        // 动画结束后清掉错峰延迟，避免影响 hover 过渡手感
        window.setTimeout(function () { entry.target.style.transitionDelay = ''; }, 900);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (el, index) {
      el.style.transitionDelay = (index % 6) * 60 + 'ms'; // 轻微错峰，别像队列
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
    $$('.stat-num').forEach(animateCount);
  }

  /* ===== 5. 技能条动画：把等级写进 CSS 变量 --level ===== */
  $$('.skill').forEach(function (item) {
    const level = Number(item.getAttribute('data-level')) || 0;
    item.style.setProperty('--level', level + '%');
  });

  /* ===== 6. 作品分类筛选 ===== */
  const filterButtons = $$('.filter-btn');
  const projectCards = $$('#projectGrid .project-card');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cat = btn.getAttribute('data-filter');
      filterButtons.forEach(function (other) {
        const active = other === btn;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      projectCards.forEach(function (card) {
        const match = cat === 'all' || card.getAttribute('data-cat') === cat;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  /* ===== 7. 作品详情展开 ===== */
  $$('.detail-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const card = btn.closest('.project-card');
      if (!card) { return; }
      const open = card.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      const sign = $('.detail-sign', btn);
      if (sign) { sign.textContent = open ? '－' : '＋'; }
    });
  });

  /* ===== 8. 数字滚动 ===== */
  function animateCount(el) {
    if (el.dataset.counted === '1') { return; }
    el.dataset.counted = '1';
    const target = Number(el.getAttribute('data-count')) || 0;
    const suffix = el.getAttribute('data-suffix') || '';
    if (prefersReduced) {
      el.textContent = target.toLocaleString('zh-CN') + suffix;
      return;
    }
    const duration = 1200;
    const startTime = performance.now();
    function step(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // 缓出，收尾更"弹"
      el.textContent = Math.round(target * eased).toLocaleString('zh-CN') + suffix;
      if (p < 1) { window.requestAnimationFrame(step); }
    }
    window.requestAnimationFrame(step);
  }

  /* ===== 9. 鼠标跟随果冻（只在精确指针设备上启用） ===== */
  const jelly = $('#cursorJelly');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (jelly && finePointer && !prefersReduced) {
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX;
    let curY = targetY;
    let shown = false;

    window.addEventListener('pointermove', function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!shown) { shown = true; jelly.classList.add('is-on'); }
    }, { passive: true });

    (function follow() {
      curX += (targetX - curX) * 0.18; // 简单缓动，形成"果冻"拖尾
      curY += (targetY - curY) * 0.18;
      jelly.style.transform = 'translate3d(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px,0)';
      window.requestAnimationFrame(follow);
    })();
  }

  /* ===== 10. 点击复制长沙时间 + 提示条 ===== */
  const toast = $('#toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) { return; }
    toast.textContent = message;
    toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-show'); }, 2600);
  }

  const timeCard = $('#timeCard');
  if (timeCard) {
    timeCard.addEventListener('click', function () {
      const now = changshaNow();
      const text = '长沙时间 ' + now.dateText + ' ' + now.timeText + ' ' + now.weekText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('已复制：' + text);
        }).catch(function () {
          showToast('这个环境不让复制，时间是：' + text);
        });
      } else {
        showToast('这个环境不让复制，时间是：' + text);
      }
    });
  }
})();
