/* =========================================================
   43-pixel-8bit / script.js
   行为集中在此：时钟、昼夜主题、打字机、滚动动画、技能条、
   项目筛选、导航高亮、回到顶部、点击复制
   所有事件均通过 addEventListener 绑定，HTML 中无内联事件
   ========================================================= */
(function () {
  'use strict';

  /* ---- 工具函数 ---- */
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  const pad2 = (n) => String(n).padStart(2, '0');

  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 北京时间工具：统一用 Asia/Shanghai 取值，避免依赖本机时区 ---- */
  const CN_TZ = 'Asia/Shanghai';
  const CN_PARTS = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CN_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  function cnParts(date) {
    const out = {};
    CN_PARTS.formatToParts(date).forEach((part) => {
      if (part.type !== 'literal') { out[part.type] = part.value; }
    });
    return out;
  }
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* 基线参考时刻：2026-09-14（星期一）22:07 UTC+8，来自网络查询，用于昼夜主题判断 */
  const BASE_LINE = root.dataset.baseline || '2026-09-14T22:07';
  const BASE_TS = new Date(BASE_LINE + ':00+08:00').getTime();
  const BASE_HOUR = new Date(BASE_TS).getUTCHours() + 8;

  /* ===== 区块 1：长沙时间实时时钟（含年月日、时分秒、星期） ===== */
  const clockDate = $('#clock-datetime');
  const clockTime = $('#clock-time');

  function renderClock() {
    const now = new Date();
    const p = cnParts(now);
    // 用北京时间反推星期，避免本机时区导致的错位
    const wk = WEEKDAYS[new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay()];
    const text = p.year + '年' + p.month + '月' + p.day + '日 ' + wk;
    const time = pad2(p.hour) + ':' + pad2(p.minute) + ':' + pad2(p.second);

    if (clockDate) {
      if (clockDate.textContent !== text) { clockDate.textContent = text; }
      clockDate.dateTime = p.year + '-' + pad2(p.month) + '-' + pad2(p.day) + 'T' + time;
    }
    if (clockTime && clockTime.textContent !== time) {
      clockTime.textContent = time;
      clockTime.classList.remove('is-tick');
      void clockTime.offsetWidth; // 重置动画
      if (!prefersReduced) { clockTime.classList.add('is-tick'); }
    }
    return +p.hour;
  }

  /* ===== 区块 2：昼夜主题（跟随实时时间，也可手动切换） ===== */
  const themeToggle = $('#theme-toggle');
  const themeIcon = $('#theme-icon');
  const themeLabel = $('#theme-label');
  const THEME_KEY = 'oklzr-pixel8bit-theme';
  let manualTheme = null;
  let applyingTheme = false;

  function readManualTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (err) { return null; }
  }
  function saveManualTheme(value) {
    try { window.localStorage.setItem(THEME_KEY, value); } catch (err) { /* 隐私模式下忽略 */ }
  }
  function applyTheme(theme) {
    applyingTheme = true;
    root.dataset.theme = theme;
    const isDay = theme === 'day';
    if (themeIcon) { themeIcon.textContent = isDay ? '☾' : '☀'; }
    if (themeLabel) { themeLabel.textContent = isDay ? '夜晚模式' : '白天模式'; }
    if (themeToggle) { themeToggle.setAttribute('aria-pressed', String(isDay)); }
    applyingTheme = false;
  }
  // 基线小时 22 → 夜间；6:00 至 17:59 之间为白天配色
  function themeFromHour(hour) {
    if (hour >= 6 && hour < 18) { return 'day'; }
    if (hour === 22 && BASE_HOUR === 22) { return 'night'; }
    return 'night';
  }
  if (themeToggle) {
    manualTheme = readManualTheme();
    applyTheme(manualTheme || themeFromHour(renderClock()));
    themeToggle.addEventListener('click', () => {
      manualTheme = root.dataset.theme === 'day' ? 'night' : 'day';
      applyTheme(manualTheme);
      saveManualTheme(manualTheme);
      showToast('已切换：' + (manualTheme === 'day' ? '白天模式' : '夜晚模式'));
    });
  }

  // 每秒刷新时钟；未手动切换时主题继续跟随时间
  renderClock();
  window.setInterval(() => {
    const hour = renderClock();
    if (manualTheme === null && !applyingTheme) {
      const next = themeFromHour(hour);
      if (next !== root.dataset.theme) { applyTheme(next); }
    }
  }, 1000);

  /* ===== 区块 3：打字机效果 ===== */
  const typeEl = $('#typewriter');
  const PHRASES = [
    '手搓像素风小站，越简单越清晰',
    '把数据排成方阵，一眼就能读懂',
    '坐标湖南省长沙市 · 随时在线'
  ];

  if (typeEl) {
    if (prefersReduced) {
      typeEl.textContent = PHRASES[0];
    } else {
      let pi = 0;
      let ci = 0;
      let deleting = false;
      (function tick() {
        const text = PHRASES[pi];
        ci += deleting ? -1 : 1;
        typeEl.textContent = text.slice(0, ci);
        let delay = deleting ? 40 : 90;
        if (!deleting && ci >= text.length) { deleting = true; delay = 1600; }
        else if (deleting && ci <= 0) { deleting = false; pi = (pi + 1) % PHRASES.length; delay = 320; }
        window.setTimeout(tick, delay);
      })();
    }
  }

  /* ===== 区块 4：滚动进入动画 ===== */
  const revealEls = $$('.reveal');
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach((el) => revealObs.observe(el));
  }

  /* ===== 区块 5：技能条动画（进入视口后逐格增长） ===== */
  const skills = $$('.skill');
  if (skills.length) {
    if (prefersReduced || !('IntersectionObserver' in window)) {
      skills.forEach((el) => el.classList.add('is-on'));
    } else {
      const skillObs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const fill = $('.fill', el);
            if (fill) { fill.style.transition = 'none'; }
            el.classList.add('is-on');
            if (fill) {
              void fill.offsetWidth;
              fill.style.transition = '';
            }
            skillObs.unobserve(el);
          }
        });
      }, { threshold: 0.4 });
      skills.forEach((el) => skillObs.observe(el));
    }
  }

  /* ===== 区块 6：项目筛选 ===== */
  const filterWrap = $('#filters');
  const projectCards = $$('#project-list .card');
  if (filterWrap && projectCards.length) {
    filterWrap.addEventListener('click', (event) => {
      const btn = event.target.closest('.filter');
      if (!btn || !filterWrap.contains(btn)) { return; }
      const key = btn.dataset.filter;
      $$('.filter', filterWrap).forEach((b) => b.classList.toggle('is-active', b === btn));
      let shown = 0;
      projectCards.forEach((card) => {
        const hit = key === 'all' || (card.dataset.tags || '').split(' ').indexOf(key) > -1;
        card.classList.toggle('is-hide', !hit);
        if (hit) { shown += 1; }
      });
      showToast('筛选：' + btn.textContent.trim() + ' → ' + shown + ' 项');
    });
  }

  /* ===== 区块 7：滚动相关（导航高亮 / 回到顶部） ===== */
  const navLinks = $$('.nav__list a');
  const linkMap = {};
  const topSections = navLinks
    .map((link) => {
      const sec = document.getElementById(link.getAttribute('href').slice(1));
      if (sec) { linkMap[sec.id] = link; }
      return sec;
    })
    .filter(Boolean);

  function setActiveSection(id) {
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link === linkMap[id]);
    });
  }

  if (topSections.length && 'IntersectionObserver' in window) {
    const spyObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { setActiveSection(entry.target.id); }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    topSections.forEach((sec) => spyObs.observe(sec));
  }

  const toTop = $('#to-top');
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  }

  let scrollTick = false;
  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (toTop) { toTop.classList.toggle('is-on', y > 460); }
    scrollTick = false;
  }
  onScroll();
  window.addEventListener('scroll', () => {
    if (!scrollTick) {
      scrollTick = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  /* ===== 区块 8：点击复制数据面板文字 ===== */
  const toast = $('#toast');
  let toastTimer = 0;
  function showToast(message) {
    if (!toast) { return; }
    toast.textContent = message;
    toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 1600);
  }

  $$('[data-copy]').forEach((el) => {
    el.addEventListener('click', () => {
      const card = el.closest('.stat');
      const labelEl = card ? $('.stat__label', card) : null;
      const text = el.textContent.trim();
      const done = labelEl ? labelEl.textContent.trim() : '内容';
      const show = () => showToast('已复制 ' + done + '：' + text);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(show).catch(() => { /* 不支持时静默失败 */ });
      }
    });
  });
})();
