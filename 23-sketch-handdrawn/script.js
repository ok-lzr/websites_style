/* =========================================================
   23-sketch-handdrawn · script.js
   所有交互集中在此：纸面滤镜、时钟、打字机、滚动动画、
   作品筛选、技能条、数字滚动、深浅模式、铅笔跟随、便签弹窗
   样式只通过切换类名控制，不在这里拼大段 style 字符串
   ========================================================= */
'use strict';

/* ===== 小工具 ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* 长沙固定在 UTC+8：把真实时间挪到“东八区墙上时间”再取字段 */
const CHANGSHA_OFFSET_MS = 8 * 60 * 60 * 1000;
const getChangshaDate = (date = new Date()) => new Date(date.getTime() + CHANGSHA_OFFSET_MS);

/* 尊重系统的“减少动画”偏好 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   1. 纸面粗糙滤镜（纯内联 SVG，无外部依赖，加载失败也不影响页面）
   ========================================================= */
function injectRoughFilter() {
  try {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.position = 'absolute';

    const defs = document.createElementNS(NS, 'defs');

    const small = document.createElementNS(NS, 'filter');
    small.setAttribute('id', 'roughSmall');
    small.setAttribute('x', '-5%');
    small.setAttribute('y', '-15%');
    small.setAttribute('width', '110%');
    small.setAttribute('height', '130%');
    const smallNoise = document.createElementNS(NS, 'feTurbulence');
    smallNoise.setAttribute('type', 'fractalNoise');
    smallNoise.setAttribute('baseFrequency', '0.04');
    smallNoise.setAttribute('numOctaves', '3');
    smallNoise.setAttribute('seed', '7');
    smallNoise.setAttribute('result', 'n');
    const smallWarp = document.createElementNS(NS, 'feDisplacementMap');
    smallWarp.setAttribute('in', 'SourceGraphic');
    smallWarp.setAttribute('in2', 'n');
    smallWarp.setAttribute('scale', '2.4');
    smallWarp.setAttribute('xChannelSelector', 'R');
    smallWarp.setAttribute('yChannelSelector', 'G');
    small.append(smallNoise, smallWarp);

    const big = document.createElementNS(NS, 'filter');
    big.setAttribute('id', 'roughPaper');
    big.setAttribute('x', '-4%');
    big.setAttribute('y', '-8%');
    big.setAttribute('width', '108%');
    big.setAttribute('height', '116%');
    const bigNoise = document.createElementNS(NS, 'feTurbulence');
    bigNoise.setAttribute('type', 'fractalNoise');
    bigNoise.setAttribute('baseFrequency', '0.012');
    bigNoise.setAttribute('numOctaves', '2');
    bigNoise.setAttribute('seed', '19');
    bigNoise.setAttribute('result', 'n2');
    const bigWarp = document.createElementNS(NS, 'feDisplacementMap');
    bigWarp.setAttribute('in', 'SourceGraphic');
    bigWarp.setAttribute('in2', 'n2');
    bigWarp.setAttribute('scale', '3.6');
    bigWarp.setAttribute('xChannelSelector', 'R');
    bigWarp.setAttribute('yChannelSelector', 'G');
    big.append(bigNoise, bigWarp);

    defs.append(small, big);
    svg.append(defs);
    document.body.append(svg);
  } catch (err) {
    /* 滤镜只是装饰，失败时静默跳过，边框依然存在 */
    console.warn('纸面滤镜初始化失败，已跳过：', err);
  }
}

/* =========================================================
   2. 长沙实时时钟 + 昼夜主题判断
   基线参考时刻：2026-09-14（星期一）22:07（UTC+8），来自一次网络查询
   ========================================================= */
const BASELINE_ISO = '2026-09-14T14:07:00Z'; // 同一时刻的 UTC 表示
let nightAuto = null; // 基线推算出的昼夜结论
let manualTheme = null; // 用户手动选择后不再自动覆盖

/* 把静态基线按“流逝的天数”平移到今天，保持 22:07 的夜间属性 */
function dayBaselineTime() {
  const base = new Date(BASELINE_ISO);
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let shifted = base.getTime();
  while (shifted > now) shifted -= DAY;
  while (shifted + DAY <= now) shifted += DAY;
  return shifted;
}

function isNightAt(timeMs) {
  const hour = getChangshaDate(new Date(timeMs)).getUTCHours();
  return hour >= 19 || hour < 6;
}

function paintTheme() {
  const night = manualTheme === null ? nightAuto === true : manualTheme === 'dark';
  document.body.classList.toggle('theme-dark', night);
  const btn = $('#themeBtn');
  if (btn) {
    btn.textContent = night ? '☀️ 回到纸张' : '🌙 切换模式';
    btn.setAttribute('aria-pressed', String(night));
  }
  const note = $('#clockTheme');
  if (note) {
    if (manualTheme) {
      note.textContent = '手动选择了' + (manualTheme === 'dark' ? '黑板模式' : '纸张模式');
    } else if (nightAuto === null) {
      note.textContent = '正在对照基线时间…';
    } else {
      // 基线时刻落在今晚还是今天白天，决定此刻用纸张还是黑板
      note.textContent = nightAuto ? '基线推算：入夜，用黑板便签' : '基线推算：白天，用米黄纸张';
    }
  }
}

function renderClock() {
  const now = new Date();
  const cs = getChangshaDate(now);
  const hour = String(cs.getUTCHours()).padStart(2, '0');
  const minute = String(cs.getUTCMinutes()).padStart(2, '0');
  const second = String(cs.getUTCSeconds()).padStart(2, '0');

  const timeEl = $('#clockTime');
  const dateEl = $('#clockDate');
  const weekEl = $('#clockWeek');
  if (!timeEl || !dateEl || !weekEl) return;

  timeEl.textContent = `${hour}:${minute}:${second}`;
  timeEl.setAttribute('datetime', cs.toISOString());

  try {
    dateEl.textContent = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);
    weekEl.textContent = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      weekday: 'long',
    }).format(now);
  } catch (err) {
    /* 极少数环境缺少时区数据时，退回本地字段拼接 */
    dateEl.textContent = `${cs.getUTCFullYear()} 年 ${cs.getUTCMonth() + 1} 月 ${cs.getUTCDate()} 日`;
    weekEl.textContent = '星期' + '日一二三四五六'.charAt(cs.getUTCDay());
  }
}

function initClock() {
  nightAuto = isNightAt(dayBaselineTime());
  renderClock();
  paintTheme();
  // 每秒刷新时间；主题只在刻度变化时重算，避免无意义的重绘
  let lastHour = -1;
  window.setInterval(() => {
    renderClock();
    const h = getChangshaDate().getUTCHours();
    if (h !== lastHour) {
      lastHour = h;
      const next = isNightAt(Date.now());
      if (next !== nightAuto) {
        nightAuto = next;
        paintTheme();
      }
    }
  }, 1000);
}

/* =========================================================
   3. 首页打字机效果
   ========================================================= */
function initTypewriter() {
  const el = $('#typedLine');
  if (!el) return;
  const text = '把想法先画在纸上，再写成可点的网页。';

  if (reduceMotion) {
    el.textContent = text;
    return;
  }

  let index = 0;
  const step = () => {
    index += 1;
    el.textContent = text.slice(0, index);
    if (index < text.length) {
      window.setTimeout(step, 90);
    } else {
      // 打完停一会儿，再擦掉重来，像不停修改的草稿
      window.setTimeout(() => {
        index = 0;
        el.textContent = '';
        window.setTimeout(step, 400);
      }, 4200);
    }
  };
  step();
}

/* =========================================================
   4. 滚动进入动画（IntersectionObserver）
   ========================================================= */
function initReveal() {
  const targets = $$('.section-title, .sketch-box, .work-card');
  targets.forEach((el) => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach((el) => io.observe(el));
}

/* =========================================================
   5. 顶部阅读进度（铅笔线随滚动变长）
   ========================================================= */
function initScrollProgress() {
  const bar = $('#scrollProgress');
  if (!bar) return;
  const update = () => {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    bar.style.width = (ratio * 100).toFixed(2) + '%';
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* =========================================================
   6. 导航：平滑滚动 + 当前区块高亮
   ========================================================= */
function initNav() {
  const buttons = $$('.tab-btn');
  if (!buttons.length) return;

  const activate = (target) => {
    buttons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.target === target));
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = document.getElementById(btn.dataset.target);
      if (!section) return;
      activate(btn.dataset.target);
      section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  // 滚动时自动点亮对应的手写标签
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activate(entry.target.id);
        });
      },
      { threshold: 0.45 }
    );
    $$('main section[id]').forEach((sec) => spy.observe(sec));
  }
}

/* =========================================================
   7. 作品筛选（配合过渡动画，不直接秒切）
   ========================================================= */
const FILTER_TEXT = {
  all: '全部便签都贴出来了。',
  web: '只看前端 / 页面类便签。',
  python: '只看 Python 写的小东西。',
  data: '只看数据可视化便签。',
  tool: '只看顺手做的小工具。',
};

function initFilter() {
  const row = $('#filterRow');
  const grid = $('#workGrid');
  const hint = $('#filterHint');
  if (!row || !grid) return;

  const cards = $$('.work-card', grid);

  const applyFilter = (cat) => {
    cards.forEach((card) => {
      const match = cat === 'all' || card.dataset.cat === cat;
      if (match) {
        card.classList.remove('is-hide');
        // 先淡出再淡入，避免便签“硬跳”
        window.requestAnimationFrame(() => card.classList.remove('is-faded'));
      } else {
        card.classList.add('is-faded');
        window.setTimeout(() => {
          if (card.classList.contains('is-faded')) card.classList.add('is-hide');
        }, 220);
      }
    });
    if (hint) hint.textContent = FILTER_TEXT[cat] || FILTER_TEXT.all;
  };

  row.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || !row.contains(chip)) return;
    $$('.chip', row).forEach((c) => c.classList.toggle('is-active', c === chip));
    applyFilter(chip.dataset.filter);
  });
}

/* =========================================================
   8. 技能条动画（滚到可视区才从 0 长出来）
   ========================================================= */
function initSkillBars() {
  const bars = $$('.bar');
  if (!bars.length) return;

  const grow = (bar) => {
    const fill = $('.bar-fill', bar);
    const value = Number(bar.dataset.value) || 0;
    if (fill) fill.style.width = value + '%';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(value));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
  };

  if (!('IntersectionObserver' in window)) {
    bars.forEach(grow);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          window.setTimeout(() => grow(entry.target), 120);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  bars.forEach((bar) => io.observe(bar));
}

/* =========================================================
   9. 数字滚动（首页统计）
   ========================================================= */
function initCounters() {
  const nums = $$('.stat-num');
  if (!nums.length) return;

  const run = (el) => {
    const target = Number(el.dataset.target) || 0;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) {
    nums.forEach(run);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.8 }
  );
  nums.forEach((el) => io.observe(el));
}

/* =========================================================
   10. 深浅模式切换（手动优先于基线自动判断）
   ========================================================= */
function initThemeToggle() {
  const btn = $('#themeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    manualTheme = isDark ? 'light' : 'dark';
    paintTheme();
  });
}

/* =========================================================
   11. 铅笔跟随鼠标（触屏与减少动画时自动停用）
   ========================================================= */
function initPencilCursor() {
  const pencil = $('#pencilCursor');
  if (!pencil) return;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (!finePointer || reduceMotion) return;

  let targetX = -100;
  let targetY = -100;
  let currentX = -100;
  let currentY = -100;

  window.addEventListener('mousemove', (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    pencil.classList.add('is-on');
  });
  document.addEventListener('mouseleave', () => pencil.classList.remove('is-on'));

  const loop = () => {
    currentX += (targetX - currentX) * 0.16;
    currentY += (targetY - currentY) * 0.16;
    pencil.style.transform = `translate(${currentX - 6}px, ${currentY - 18}px) rotate(-18deg)`;
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
}

/* =========================================================
   12. 便签详情弹窗
   ========================================================= */
const NOTE_TEXT = {
  个人导航站: '把常用网站钉成一页纸：分类标签、快捷键搜索、暗色模式都有，本地存储记住你的排序。',
  长沙天气看板: '每天定时抓一次天气与空气质量，落成手账风格小卡片，顺手记录一周的温度曲线。',
  待办清单涂鸦版: '任务可以打勾、划掉、撕掉；完成时整条便签会被铅笔划穿，离线也能用。',
  书签整理器: '读取浏览器导出的书签，去重、按域名归类，再输出一张能直接打开的目录页。',
  图片批量加水印: '给成批截图压上手写感水印并压缩体积，一条命令跑完全部文件夹。',
  博客访问统计: '从访问日志里数出热门文章与来源，画成一张贴在墙上的趋势草图。',
};

function initNoteModal() {
  const modal = $('#noteModal');
  const title = $('#noteTitle');
  const body = $('#noteBody');
  const closeBtn = $('#noteClose');
  if (!modal || !title || !body || !closeBtn) return;

  let lastFocus = null;

  const open = (name) => {
    lastFocus = document.activeElement;
    title.textContent = name;
    body.textContent = NOTE_TEXT[name] || '这张便签还空着，等我写完再贴上来。';
    modal.hidden = false;
    closeBtn.focus();
  };

  const close = () => {
    modal.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.scribble-btn[data-project]');
    if (trigger) {
      open(trigger.dataset.project);
      return;
    }
    // 点遮罩空白处也能贴回去
    if (event.target === modal) close();
  });

  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
}

/* =========================================================
   13. 便签上的随手记：双击换一句
   ========================================================= */
const DOODLES = [
  '今天也在和 CSS 的 1 像素较劲 ✎',
  '长沙的雨下得很认真，代码也写得很慢 ☂',
  '先能跑起来，再想好不好看。',
  '把复杂的事拆成一张一张便签就简单了。',
  '删掉一半代码，页面反而更快了。',
  '灵感来得比外卖慢，但总会到 ✨',
];

function initDoodleNote() {
  const text = $('#doodleText');
  if (!text) return;
  let last = -1;

  const next = () => {
    let i = Math.floor(Math.random() * DOODLES.length);
    if (i === last) i = (i + 1) % DOODLES.length;
    last = i;
    text.textContent = DOODLES[i];
  };

  text.addEventListener('dblclick', next);
  text.setAttribute('tabindex', '0');
  text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      next();
    }
  });
}

/* =========================================================
   启动
   ========================================================= */
function init() {
  injectRoughFilter();
  initClock();
  initTypewriter();
  initReveal();
  initScrollProgress();
  initNav();
  initFilter();
  initSkillBars();
  initCounters();
  initThemeToggle();
  initPencilCursor();
  initNoteModal();
  initDoodleNote();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
