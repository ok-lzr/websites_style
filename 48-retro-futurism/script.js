/* ==========================================================================
   48-retro-futurism · 交互脚本
   职责：实时时钟、昼夜主题、打字机、滚动进入动画、导航高亮、
        技能条动画、作品筛选。全部通过 addEventListener 绑定。
   ========================================================================== */
'use strict';

/* ===== 常量与小工具 ===== */
// 长沙固定为 UTC+8，用 IANA 时区名取时间，不受访客本机时区影响
const TZ = 'Asia/Shanghai';

// 网络查询得到的参考基线：2026-09-14（星期一）22:07（UTC+8）
// 仅用于校验“夜间”判断的预期值——该时刻为夜间；真正显示的时间始终来自 new Date()
const BASELINE_REF = { year: 2026, month: 9, day: 14, hour: 22, minute: 7, weekday: '星期一' };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pad2 = (n) => String(n).padStart(2, '0');

/** 把某个 Date 拆成长沙本地的年月日时分秒与星期 */
function changshaParts(date) {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'long'
  });
  const bag = {};
  fmt.formatToParts(date).forEach((p) => { bag[p.type] = p.value; });
  // zh-CN 可能给出 “24” 表示午夜，统一归零
  const hour = Number(bag.hour) % 24;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: bag.weekday || ''
  };
}

/** 依据小时判断昼夜：6:00–17:59 视为白昼 */
const isDaytime = (hour) => hour >= 6 && hour < 18;

/* ===== 1. 实时时钟（长沙时间） ===== */
function initClock() {
  const elTime = $('#clock-time');
  const elDate = $('#clock-date');
  const elDay = $('#clock-day');
  const elPhaseText = $('#phase-text');
  const elClock = $('.clock');
  const elFooter = $('#footer-time');
  if (!elTime) return;

  let dayThemeApplied = null;

  const tick = () => {
    const now = new Date();               // 始终取真实当前时间
    const t = changshaParts(now);
    const day = isDaytime(t.hour);

    elTime.textContent = `${pad2(t.hour)}:${pad2(t.minute)}:${pad2(t.second)}`;
    elDate.textContent = `${t.year} 年 ${pad2(t.month)} 月 ${pad2(t.day)} 日`;
    elDay.textContent = t.weekday;

    elPhaseText.textContent = day ? '昼间模式 · 信号清晰' : '夜间模式 · 深空静默';
    if (elClock) elClock.classList.toggle('is-night', !day);

    // 首帧按当前时段自动选定主题，之后交由用户手动切换
    if (dayThemeApplied === null) {
      dayThemeApplied = day;
      document.documentElement.classList.toggle('is-day', day);
      syncLampLabel();
    }

    if (elFooter) {
      elFooter.textContent = `当前长沙时间 ${pad2(t.hour)}:${pad2(t.minute)}:${pad2(t.second)} · ${t.weekday}`;
    }
  };

  tick();
  setInterval(tick, 1000);
}

/* ===== 2. 昼夜主题切换 ===== */
function syncLampLabel() {
  const lamp = $('#theme-toggle');
  if (!lamp) return;
  const day = document.documentElement.classList.contains('is-day');
  lamp.setAttribute('aria-pressed', String(day));
  const icon = $('.lamp__icon', lamp);
  const label = $('.lamp__label', lamp);
  if (icon) icon.textContent = day ? '☾' : '☀';
  if (label) label.textContent = day ? '夜间模式' : '昼间模式';
}

function initThemeToggle() {
  const lamp = $('#theme-toggle');
  if (!lamp) return;
  lamp.addEventListener('click', () => {
    const root = document.documentElement;
    const nextDay = !root.classList.contains('is-day');
    root.classList.toggle('is-day', nextDay);
    syncLampLabel();
  });
  syncLampLabel();
}

/* ===== 3. 打字机效果（首屏一句话简介） ===== */
function initTyper() {
  const el = $('#typer');
  if (!el) return;
  const lines = (el.dataset.lines || '').split('|').filter(Boolean);
  if (!lines.length) return;

  let lineIdx = 0;
  let charIdx = 0;
  let deleting = false;

  const step = () => {
    const line = lines[lineIdx];
    charIdx += deleting ? -1 : 1;
    el.textContent = line.slice(0, charIdx);

    let delay = deleting ? 38 : 92;
    if (!deleting && charIdx === line.length) {
      deleting = true;
      delay = 1700;                       // 写完停顿
    } else if (deleting && charIdx === 0) {
      deleting = false;
      lineIdx = (lineIdx + 1) % lines.length;
      delay = 320;
    }
    setTimeout(step, delay);
  };

  el.textContent = '';
  setTimeout(step, 400);
}

/* ===== 4. 滚动进入动画（IntersectionObserver） ===== */
function initReveal() {
  const targets = $$('.panel, .tv, .card');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((n) => n.classList.add('reveal', 'is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // 错位延迟也交给 CSS：JS 只写自定义属性，不写样式字符串
  targets.forEach((node, i) => {
    node.classList.add('reveal');
    node.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 70}ms`);
    io.observe(node);
  });
}

/* ===== 5. 导航平滑滚动 + 当前区块高亮 ===== */
function initNav() {
  const links = $$('.nav__link');
  if (!links.length) return;

  // 顶部栏高度补偿，避免锚点被遮挡
  const offset = () => (document.querySelector('.topbar')?.offsetHeight || 0) + 12;

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - offset();
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // 依据滚动位置点亮对应导航
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);
  if (!sections.length) return;

  const onScroll = () => {
    const mark = window.scrollY + offset() + 60;
    let current = sections[0];
    sections.forEach((sec) => { if (sec.offsetTop <= mark) current = sec; });
    links.forEach((l) => {
      l.classList.toggle('is-current', l.getAttribute('href') === `#${current.id}`);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ===== 6. 技能条动画 + 数字滚动 ===== */
function initBars() {
  const bars = $$('#bars .bar');
  if (!bars.length) return;

  const runOne = (bar) => {
    const value = Math.max(0, Math.min(100, Number(bar.dataset.value) || 0));
    const fill = $('.bar__fill', bar);
    const label = $('.bar__val', bar);
    if (fill) fill.style.width = `${value}%`;

    // 百分比数字滚动到位（HTML 中的静态数值仅作无 JS 时的兜底）
    if (label) {
      label.textContent = '0%';
      const dur = 1000;
      const start = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        label.textContent = `${Math.round(value * eased)}%`;
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  };

  if (!('IntersectionObserver' in window)) {
    bars.forEach(runOne);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runOne(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  bars.forEach((b) => io.observe(b));
}

/* ===== 7. 作品筛选（标签页式） ===== */
function initFilters() {
  const buttons = $$('.filter');
  const cards = $$('#cards .card');
  const tip = $('#empty-tip');
  if (!buttons.length || !cards.length) return;

  const apply = (kind) => {
    let shown = 0;
    cards.forEach((card) => {
      const hit = kind === 'all' || card.dataset.kind === kind;
      card.classList.toggle('is-hidden', !hit);
      if (hit) shown += 1;
    });
    if (tip) tip.hidden = shown !== 0;
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      apply(btn.dataset.filter || 'all');
    });
  });
}

/* ===== 启动 ===== */
function boot() {
  initThemeToggle();
  initClock();
  initTyper();
  initReveal();
  initNav();
  initBars();
  initFilters();
  // 供调试核对基线参考时刻
  console.info('[48-retro-futurism] 昼夜判断基线参考：', BASELINE_REF);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
