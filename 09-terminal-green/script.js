/* ==========================================================================
   09-terminal-green —— 交互脚本（原生 JS，无任何依赖）
   分区索引：常量与工具 → 打字机 → 迷你终端命令 → 平滑滚动导航
            → 滚动进入动画 → 技能条 → 实时时钟 → 昼夜主题 → 复制按钮
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 常量与工具函数 ===== */

  const TZ = 'Asia/Shanghai';                 // 长沙所在时区
  const TZ_OFFSET = 8;                        // UTC+8
  // 网络查询得到的参考时刻：2026-09-14（星期一）22:07，用于夜/昼主题的初始判断
  const BASELINE = new Date('2026-09-14T22:07:00+08:00');
  const NIGHT_START = 19;                     // 19:00 之后算夜
  const NIGHT_END = 6;                        // 06:00 之前算夜
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');

  /**
   * 取某个时刻在长沙（UTC+8）的日历字段。
   * 优先使用 Intl + IANA 时区，失败时退回手动偏移计算，保证任何环境都能显示。
   */
  function changshaParts(date) {
    try {
      const fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: TZ,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, weekday: 'long'
      });
      const bag = {};
      fmt.formatToParts(date).forEach((part) => {
        if (part.type !== 'literal') { bag[part.type] = part.value; }
      });
      return {
        y: Number(bag.year),
        m: Number(bag.month),
        d: Number(bag.day),
        h: Number(bag.hour) % 24,   // 部分实现会在 0 点返回 "24"
        mi: Number(bag.minute),
        s: Number(bag.second),
        weekday: bag.weekday
      };
    } catch (err) {
      const shifted = new Date(date.getTime() + (date.getTimezoneOffset() + TZ_OFFSET * 60) * 60000);
      const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return {
        y: shifted.getFullYear(),
        m: shifted.getMonth() + 1,
        d: shifted.getDate(),
        h: shifted.getHours(),
        mi: shifted.getMinutes(),
        s: shifted.getSeconds(),
        weekday: week[shifted.getDay()]
      };
    }
  }

  /** 把长沙时刻格式化成页面用的三段文本 */
  function formatChangsha(date) {
    const p = changshaParts(date);
    return {
      date: p.y + '年' + p.m + '月' + p.d + '日',
      time: pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s),
      week: p.weekday,
      hour: p.h,
      short: p.y + '-' + pad(p.m) + '-' + pad(p.d) + ' ' + pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s)
    };
  }

  /* ===== 打字机：逐字输出标题与简介 ===== */

  function typewriter(el, text, speed, onDone) {
    if (!el) { return; }
    if (reduceMotion) { el.textContent = text; if (onDone) { onDone(); } return; }
    el.textContent = '';
    let i = 0;
    (function step() {
      el.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) {
        window.setTimeout(step, speed + Math.floor(Math.random() * 45));
      } else if (onDone) {
        onDone();
      }
    })();
  }

  function startTyping() {
    const titleEl = $('#typeTitle');
    const subEl = $('#typeSub');
    const titleText = titleEl ? titleEl.textContent.trim() : '';
    const subText = subEl ? subEl.textContent.trim() : '';
    typewriter(titleEl, titleText, 95, function () {
      typewriter(subEl, subText, 26);
    });
  }

  /* ===== 迷你终端：支持 help / ls / date / theme 等命令 ===== */

  const logEl = $('#cmdLog');
  const formEl = $('#cmdForm');
  const inputEl = $('#cmdInput');

  function logLine(text) {
    if (!logEl) { return; }
    logEl.textContent += (text || '') + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  const PROJECTS = [
    '个人导航站          HTML / CSS / localStorage',
    '长沙天气看板        JavaScript / Fetch / 数据可视化',
    '终端风博客引擎      Node.js / Markdown / 静态生成',
    'Git 提交热力图      Canvas / Git / CSS 网格',
    '打字练习器          JavaScript / 键盘事件 / Chart'
  ];

  // 打印启动日志，营造上电自检的观感
  function bootSequence() {
    const lines = [
      '[ ok ] CRT 扫描层已就绪',
      '[ ok ] 载入用户配置：ok-lzr / 码上生活',
      '[ ok ] 接入节点：长沙 · UTC+8',
      '[ info ] 输入 help 查看可用命令'
    ];
    if (reduceMotion) { lines.forEach(logLine); return; }
    lines.forEach(function (line, idx) {
      window.setTimeout(function () { logLine(line); }, 260 + idx * 300);
    });
  }

  const COMMANDS = {
    help: function () {
      return [
        '可用命令：',
        '  whoami            身份与能力标签',
        '  ls ./projects     项目列表',
        '  skills            技能进度',
        '  contact           联系方式与地点',
        '  date              长沙实时时间',
        '  theme [night|day|auto]  切换昼夜主题',
        '  clear             清屏'
      ].join('\n');
    },
    whoami: function () {
      return 'ok-lzr / 码上生活 —— 长沙前端开发者\n标签：HTML·CSS·JS / 响应式布局 / Node.js 脚本 / 数据可视化';
    },
    ls: function () { return '共 5 个项目：\n' + PROJECTS.join('\n'); },
    skills: function () {
      return document.querySelectorAll('.skill').length
        ? Array.prototype.map.call(document.querySelectorAll('.skill'), function (item) {
            const name = item.querySelector('.skill-name').textContent.trim();
            return '  ' + name + '  ' + item.getAttribute('data-level') + '%';
          }).join('\n')
        : '技能数据未加载';
    },
    contact: function () {
      return 'github   github.com/ok-lzr\nqq       386477796\nmail-1   csgdnrxg@163.com\nmail-2   3866477796@qq.com\n地点     湖南省长沙市';
    },
    date: function () { return '长沙时间 ' + formatChangsha(new Date()).short + '（UTC+8）'; },
    pwd: function () { return '/home/ok-lzr/profile'; },
    clear: function () { if (logEl) { logEl.textContent = ''; } return ''; },
    theme: function (arg) { return setThemeByCommand(arg); }
  };

  function runCommand(raw) {
    const line = (raw || '').trim();
    if (!line) { return; }
    logLine('ok-lzr@cs:~$ ' + line);
    const parts = line.split(/\s+/);
    const name = parts[0].toLowerCase();
    const fn = COMMANDS[name];
    if (typeof fn === 'function') {
      const out = fn(parts[1] ? parts[1].toLowerCase() : '');
      if (out) { logLine(out); }
    } else {
      logLine('bash: ' + name + ': 未找到该命令，试试 help');
    }
    logLine('');
  }

  if (formEl) {
    formEl.addEventListener('submit', function (event) {
      event.preventDefault();
      runCommand(inputEl ? inputEl.value : '');
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
    });
  }

  /* ===== 平滑滚动导航 + 当前区块高亮 ===== */

  const navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      const id = link.getAttribute('href');
      const target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (window.history.replaceState) { window.history.replaceState(null, '', id); }
    });
  });

  // 用 IntersectionObserver 判断当前位于哪个区块
  const sections = ['about', 'projects', 'contact', 'time']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (sec) { navObserver.observe(sec); });
  }

  /* ===== 滚动进入动画 + 技能条增长 ===== */

  const skillItems = Array.prototype.slice.call(document.querySelectorAll('.skill'));

  function animateSkills() {
    skillItems.forEach(function (item, idx) {
      const level = Number(item.getAttribute('data-level')) || 0;
      const fill = item.querySelector('.skill-fill');
      const num = item.querySelector('.skill-num');
      window.setTimeout(function () {
        if (fill) { fill.style.setProperty('--fill', level + '%'); }
        if (!num) { return; }
        if (reduceMotion) { num.textContent = level + '%'; return; }
        let current = 0;
        const timer = window.setInterval(function () {
          current += Math.max(1, Math.round(level / 24));
          if (current >= level) { current = level; window.clearInterval(timer); }
          num.textContent = current + '%';
        }, 30);
      }, reduceMotion ? 0 : idx * 120);
    });
  }

  const revealTargets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if ('IntersectionObserver' in window && revealTargets.length) {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-in');
        if (entry.target.id === 'about') { animateSkills(); }
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    // 不支持观察器时直接显示，避免内容被动画藏住
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
    animateSkills();
  }

  /* ===== 实时时钟：长沙时间（new Date() 每秒更新） ===== */

  const clockDate = $('#clockDate');
  const clockTime = $('#clockTime');
  const clockWeek = $('#clockWeek');
  const dataClock = $('#dataClock');
  const clockPhase = $('#clockPhase');
  const clockTheme = $('#clockTheme');

  function isNightHour(hour) { return hour >= NIGHT_START || hour < NIGHT_END; }

  function tickClock() {
    const now = new Date();
    const t = formatChangsha(now);
    if (clockDate) { clockDate.textContent = t.date; }
    if (clockTime) { clockTime.textContent = t.time; }
    if (clockWeek) { clockWeek.textContent = t.week + ' · UTC+8'; }
    if (dataClock) { dataClock.textContent = t.short + ' ' + t.week; }
    const night = isNightHour(t.hour);
    if (clockPhase) { clockPhase.textContent = night ? '夜' : '昼'; }
    autoTheme(night);
  }

  /* ===== 昼夜主题：默认跟随长沙实际时间，也可手动锁定 ===== */

  const themeBtn = $('#themeToggle');
  let themeLocked = false;
  let currentTheme = 'night';

  function applyTheme(mode, manual) {
    currentTheme = mode;
    document.documentElement.setAttribute('data-theme', mode);
    if (themeBtn) { themeBtn.textContent = 'theme: --' + mode + (manual ? ' (手动)' : ''); }
    if (clockTheme) { clockTheme.textContent = mode; }
  }

  function autoTheme(night) {
    if (themeLocked) { return; }
    const next = night ? 'night' : 'day';
    if (next !== currentTheme) { applyTheme(next, false); }
  }

  function setThemeByCommand(arg) {
    if (arg === 'night' || arg === 'day') {
      themeLocked = true;
      applyTheme(arg, true);
      return '主题已锁定为：' + arg;
    }
    themeLocked = false;
    const now = changshaParts(new Date());
    applyTheme(isNightHour(now.h) ? 'night' : 'day', false);
    return '主题跟随长沙时间：' + currentTheme;
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      themeLocked = true;
      applyTheme(currentTheme === 'night' ? 'day' : 'night', true);
    });
  }

  /* ===== 数据区复制按钮（QQ / 邮箱 / 地点） ===== */

  function fallbackCopy(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.className = 'sr-only';
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand('copy'); } catch (err) { /* 忽略：仅复制失败 */ }
    document.body.removeChild(temp);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.copy-btn'), function (btn) {
    btn.addEventListener('click', function () {
      const text = btn.getAttribute('data-copy') || '';
      const done = function () {
        const old = btn.textContent;
        btn.textContent = '已复制';
        btn.classList.add('is-done');
        window.setTimeout(function () {
          btn.textContent = old;
          btn.classList.remove('is-done');
        }, 1300);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else {
        fallbackCopy(text);
        done();
      }
    });
  });

  /* ===== 启动：先按基线时刻定初始主题，再进入实时状态 ===== */

  const baselineHour = changshaParts(BASELINE).h;      // 基线 22:07 → 夜
  applyTheme(isNightHour(baselineHour) ? 'night' : 'day', false);

  tickClock();                                          // 立即渲染一次，避免空窗
  window.setInterval(tickClock, 1000);                  // 之后每秒更新
  startTyping();
  bootSequence();
})();
