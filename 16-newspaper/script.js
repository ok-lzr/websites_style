/* =========================================================
   湘江晚报 · 复古报纸风格个人主页
   script.js —— 全站行为（交互 / 时钟 / 滚动效果）
   所有事件均通过 addEventListener 绑定，HTML 中无内联事件。
   ========================================================= */
'use strict';

/* ===== 常量：参考基线时刻 =====
   网络查询得到的参考时刻：2026-09-14（星期一）22:07（UTC+8）。
   它只用于判断「昼刊 / 夜刊」的主题取向，实时时钟另行使用 new Date()。 */
var BASELINE = {
  label: '2026-09-14 星期一 22:07 (UTC+8)',
  hour: 22,
  minute: 7
};

/* 长沙时区相对 UTC 的偏移（分钟）：UTC+8 */
var CS_OFFSET_MIN = 8 * 60;

/* ===== 工具函数 ===== */

/** 取长沙当地时间（用 UTC 时间戳换算，不依赖浏览器所在时区） */
function getChangshaDate() {
  var now = new Date();
  return new Date(now.getTime() + (CS_OFFSET_MIN * 60000) + (now.getTimezoneOffset() * 60000));
}

/** 两位数补零 */
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 根据小时判断时辰称呼 */
function periodOfDay(hour) {
  if (hour >= 5 && hour < 8) { return '晨间版 · 拂晓'; }
  if (hour >= 8 && hour < 11) { return '上午版 · 日上'; }
  if (hour >= 11 && hour < 14) { return '午间版 · 日中'; }
  if (hour >= 14 && hour < 17) { return '午后版 · 斜阳'; }
  if (hour >= 17 && hour < 19) { return '黄昏版 · 落照'; }
  if (hour >= 19 && hour < 23) { return '夜刊 · 灯下'; }
  return '深夜版 · 万籁俱寂';
}

/* ===== 主题：昼刊 / 夜刊切换 ===== */

/** 应用主题并同步按钮文案与无障碍状态 */
function applyTheme(theme) {
  var isNight = theme === 'night';
  document.body.setAttribute('data-theme', theme);
  var btn = document.getElementById('theme-toggle');
  var txt = document.getElementById('theme-toggle-text');
  if (btn) { btn.setAttribute('aria-pressed', isNight ? 'true' : 'false'); }
  if (txt) { txt.textContent = isNight ? '切换昼刊' : '切换夜刊'; }
}

/** 初始化主题：优先读取用户上次选择，否则按基线参考时刻（22:07）判定为夜刊 */
function initTheme() {
  var saved = null;
  try { saved = window.localStorage.getItem('newspaper-theme'); } catch (e) { saved = null; }

  if (saved === 'day' || saved === 'night') {
    applyTheme(saved);
  } else {
    var isNight = BASELINE.hour >= 19 || BASELINE.hour < 6;
    applyTheme(isNight ? 'night' : 'day');
  }

  var btn = document.getElementById('theme-toggle');
  if (!btn) { return; }
  btn.addEventListener('click', function () {
    var next = document.body.getAttribute('data-theme') === 'night' ? 'day' : 'night';
    applyTheme(next);
    try { window.localStorage.setItem('newspaper-theme', next); } catch (e) { /* 隐私模式忽略 */ }
  });
}

/* ===== 长沙时间：实时时钟 =====
   时钟本身必须使用 new Date() 每秒刷新；基线时刻仅作为主题判断参考。 */
function initClock() {
  var elTime = document.getElementById('clock-time');
  var elDate = document.getElementById('clock-date');
  var elPeriod = document.getElementById('clock-period');
  var elContact = document.getElementById('contact-clock');
  var elMastheadDate = document.getElementById('masthead-date');
  var elWeekday = document.getElementById('masthead-weekday');

  var dateFmt;
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  try {
    dateFmt = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
  } catch (e) {
    dateFmt = null;
  }

  function tick() {
    var d = getChangshaDate();
    var hh = pad2(d.getHours());
    var mm = pad2(d.getMinutes());
    var ss = pad2(d.getSeconds());
    var timeText = hh + ':' + mm + ':' + ss;

    var weekday = WEEKDAYS[d.getDay()];
    var dateText = dateFmt
      ? dateFmt.format(d)
      : (d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekday);

    if (elTime) { elTime.textContent = timeText; }
    if (elDate) { elDate.textContent = dateText; }
    if (elPeriod) { elPeriod.textContent = periodOfDay(d.getHours()) + ' · 参考基线 ' + BASELINE.label; }
    if (elContact) {
      elContact.textContent = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
        ' ' + timeText + ' ' + weekday;
    }
    if (elMastheadDate) {
      elMastheadDate.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 长沙';
    }
    if (elWeekday) { elWeekday.textContent = weekday; }
  }

  tick();
  window.setInterval(tick, 1000);
}

/* ===== 打字机效果：报头旁的副题 ===== */
function initTypewriter() {
  var el = document.getElementById('typewriter');
  if (!el) { return; }

  var words = ['码上生活', '一手铅字，一手代码', '在长沙写网页', '复古排印爱好者'];
  var wordIndex = 0;
  var charIndex = 0;
  var deleting = false;

  function step() {
    var word = words[wordIndex];
    if (!deleting) {
      charIndex++;
      el.textContent = word.slice(0, charIndex);
      if (charIndex === word.length) {
        deleting = true;
        window.setTimeout(step, 1600);
        return;
      }
      window.setTimeout(step, 130);
    } else {
      charIndex--;
      el.textContent = word.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        window.setTimeout(step, 320);
        return;
      }
      window.setTimeout(step, 60);
    }
  }

  window.setTimeout(step, 600);
}

/* ===== 滚动进入动画 + 技能条 + 数字滚动 ===== */

/** 让技能条长到目标宽度，数字从 0 滚到目标值 */
function fillSkills(scope) {
  var bars = scope.querySelectorAll('.skill__bar');
  Array.prototype.forEach.call(bars, function (bar) {
    bar.style.width = bar.getAttribute('data-fill') + '%';
  });

  var values = scope.querySelectorAll('.skill__value');
  Array.prototype.forEach.call(values, function (val) {
    countUp(val, parseInt(val.getAttribute('data-target'), 10) || 0, '%');
  });
}

/** 数字滚动动画 */
function countUp(el, target, suffix) {
  if (el.dataset.done === '1') { return; }
  el.dataset.done = '1';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    el.textContent = target + suffix;
    return;
  }

  var start = window.performance && window.performance.now ? window.performance.now() : Date.now();
  var duration = 1200;

  function frame(now) {
    var t = (now - start) / duration;
    if (t > 1) { t = 1; }
    var eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (t < 1) { window.requestAnimationFrame(frame); }
  }
  window.requestAnimationFrame(frame);
}

function initReveal() {
  var targets = document.querySelectorAll('.section, .work, .stat, .clock');

  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-visible'); });
    var skills = document.getElementById('skill-list');
    if (skills) { fillSkills(skills); }
    var stats = document.getElementById('stat-list');
    if (stats) {
      Array.prototype.forEach.call(stats.querySelectorAll('.stat__num'), function (n) {
        countUp(n, parseInt(n.getAttribute('data-target'), 10) || 0, n.getAttribute('data-suffix') || '');
      });
    }
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) { return; }
      var el = entry.target;
      el.classList.add('is-visible');

      if (el.id === 'skills') {
        fillSkills(el);
      }
      if (el.id === 'stats') {
        Array.prototype.forEach.call(el.querySelectorAll('.stat__num'), function (n) {
          countUp(n, parseInt(n.getAttribute('data-target'), 10) || 0, n.getAttribute('data-suffix') || '');
        });
      }
      observer.unobserve(el);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  Array.prototype.forEach.call(targets, function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

/* ===== 导航：平滑滚动 + 当前栏目高亮 ===== */
function initNav() {
  var nav = document.getElementById('site-nav');
  if (!nav) { return; }

  Array.prototype.forEach.call(nav.querySelectorAll('.nav__link'), function (link) {
    link.addEventListener('click', function (evt) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') { return; }
      var target = document.querySelector(id);
      if (!target) { return; }

      evt.preventDefault();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', id);
      }
    });
  });

  // 滚动时高亮当前所在的栏目链接
  var sections = [];
  Array.prototype.forEach.call(nav.querySelectorAll('.nav__link'), function (link) {
    var el = document.querySelector(link.getAttribute('href'));
    if (el) { sections.push({ link: link, el: el }); }
  });

  function syncCurrent() {
    var pos = window.pageYOffset + 140;
    var current = sections.length ? sections[0] : null;
    sections.forEach(function (item) {
      if (item.el.offsetTop <= pos) { current = item; }
    });
    sections.forEach(function (item) {
      item.link.classList.toggle('is-current', item === current);
    });
  }

  window.addEventListener('scroll', syncCurrent, { passive: true });
  window.addEventListener('resize', syncCurrent);
  syncCurrent();
}

/* ===== 作品分类筛选 ===== */
function initFilter() {
  var group = document.getElementById('work-filter');
  var list = document.getElementById('work-list');
  if (!group || !list) { return; }

  var buttons = group.querySelectorAll('.filter__btn');
  var works = list.querySelectorAll('.work');

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-filter');

      Array.prototype.forEach.call(buttons, function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      Array.prototype.forEach.call(works, function (card) {
        var show = key === 'all' || card.getAttribute('data-cat') === key;
        card.classList.toggle('is-hidden', !show);
        // 重新出现的卡片补一次进入动画
        if (show) {
          card.classList.remove('is-visible');
          window.requestAnimationFrame(function () { card.classList.add('is-visible'); });
        }
      });
    });
  });
}

/* ===== 回到报头 ===== */
function initToTop() {
  var btn = document.getElementById('to-top');
  if (!btn) { return; }

  btn.addEventListener('click', function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  function syncVisible() {
    btn.classList.toggle('is-dim', window.pageYOffset <= 400);
  }
  window.addEventListener('scroll', syncVisible, { passive: true });
  syncVisible();
}

/* ===== 刊期号：按当年第几周生成 ===== */
function initIssueNo() {
  var el = document.getElementById('issue-no');
  if (!el) { return; }
  var d = getChangshaDate();
  var start = new Date(d.getFullYear(), 0, 1);
  var week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  el.textContent = pad2(week);
}

/* ===== 启动 ===== */
function boot() {
  initTheme();
  initClock();
  initTypewriter();
  initReveal();
  initNav();
  initFilter();
  initToTop();
  initIssueNo();
  // 基线参考时刻写入控制台，便于核对
  console.log('[湘江晚报] 主题参考基线时刻：' + BASELINE.label);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
