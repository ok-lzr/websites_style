/* ==========================================================================
   亚克力 Fluent · 个人主页交互脚本
   仅负责行为：时钟、主题、滚动动画、筛选、打字机、数字滚动、表单校验
   样式一律通过切换类名实现，不在此拼接大段 CSS
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 小工具 ===== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* 补零：9 -> "09" */
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /* ===== 1. 长沙实时时钟（new Date() 每秒驱动） =====
     参考基线：2026-09-14（星期一）22:07 UTC+8 —— 用于判断昼夜主题倾向，
     时钟本身始终取真实当前时间，不写死。 */
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7, weekday: 1 };

  var clockTime = $('#clockTime');
  var clockDate = $('#clockDate');
  var clockPhase = $('#clockPhase');
  var clockSun = $('#clockSun');
  var infoClock = $('#infoClock');

  /* 判定当前处于白天还是夜晚（06:00–18:00 视为白昼） */
  function isDaytime(hour) { return hour >= 6 && hour < 18; }

  function renderClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();

    if (clockTime) clockTime.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    if (clockDate) {
      clockDate.textContent = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' +
        now.getDate() + ' 日 · ' + WEEKDAYS[now.getDay()];
    }
    if (clockPhase) clockPhase.textContent = isDaytime(h) ? '白昼' : '夜晚';
    if (clockSun) clockSun.textContent = isDaytime(h) ? '日照时段 ☀' : '低光时段 ☾';
    if (infoClock) {
      infoClock.textContent = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(h) + ':' + pad(m);
    }
  }
  renderClock();
  window.setInterval(renderClock, 1000);

  /* ===== 2. 昼 / 夜亚克力主题切换 =====
     首次访问时按"基线参考时刻(22:07 → 夜晚)"推断初始主题，之后交给用户手动切换 */
  var root = document.documentElement;
  var themeToggle = $('#themeToggle');

  function applyTheme(theme) {
    if (theme === 'night') {
      root.setAttribute('data-theme', 'night');
    } else {
      root.removeAttribute('data-theme');
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
      var glyph = $('.icon-btn-glyph', themeToggle);
      if (glyph) glyph.textContent = theme === 'night' ? '☀' : '☾';
    }
  }

  /* 由基线时刻推算：22:07 属于夜晚 */
  var baselineTheme = isDaytime(BASELINE.hour) ? 'day' : 'night';
  applyTheme(baselineTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
    });
  }

  /* ===== 3. 移动端导航展开 / 平滑滚动 / 当前区块高亮 ===== */
  var menuToggle = $('#menuToggle');
  var navLinks = $('#navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* 点击导航链接：平滑滚动并收起移动端菜单 */
  $$('.nav-link').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (navLinks) navLinks.classList.remove('is-open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* 滚动时高亮当前所在的区块导航 */
  var sections = $$('main section[id]');

  function syncCurrentNav() {
    var offset = window.scrollY + window.innerHeight * 0.32;
    var currentId = '';
    sections.forEach(function (sec) {
      if (sec.offsetTop <= offset) currentId = sec.id;
    });
    $$('.nav-link').forEach(function (link) {
      link.classList.toggle('is-current', link.getAttribute('href') === '#' + currentId);
    });
  }

  /* ===== 4. 滚动进度条 ===== */
  var progress = $('#scrollProgress');

  function updateProgress() {
    if (!progress) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progress.style.width = (ratio * 100).toFixed(2) + '%';
  }

  /* 用一个 rAF 节流同时处理滚动相关计算 */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateProgress();
      syncCurrentNav();
      ticking = false;
    });
  }, { passive: true });

  updateProgress();
  syncCurrentNav();

  /* ===== 5. 滚动进入动画（IntersectionObserver） ===== */
  var revealItems = $$('[data-reveal]');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        /* 同批次错开一点，让面板像层层浮现 */
        window.setTimeout(function () { el.classList.add('is-visible'); }, i * 70);
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ===== 6. 技能条 + 数字滚动（进入视口后各触发一次） ===== */
  function runSkillBars(scope) {
    $$('.skill', scope).forEach(function (item, i) {
      var value = Number(item.getAttribute('data-value')) || 0;
      var fill = $('.skill-fill', item);
      var num = $('.skill-num', item);
      window.setTimeout(function () {
        if (fill) fill.style.width = value + '%';
        if (num) countUp(num, value, '%', 900);
      }, i * 130);
    });
  }

  function runCounters(scope) {
    $$('[data-count]', scope).forEach(function (el) {
      countUp(el, Number(el.getAttribute('data-count')) || 0, '', 1200);
    });
  }

  /* 数字从 0 递增到目标值（缓出） */
  function countUp(el, target, suffix, duration) {
    var start = window.performance && window.performance.now ? window.performance.now() : Date.now();
    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var skillsBox = $('#skills');
  var statsBox = $('.stats');

  if ('IntersectionObserver' in window) {
    if (skillsBox) {
      var skillObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runSkillBars(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      skillObserver.observe(skillsBox);
    }
    if (statsBox) {
      var statObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounters(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      statObserver.observe(statsBox);
    }
  } else {
    if (skillsBox) runSkillBars(skillsBox);
    if (statsBox) runCounters(statsBox);
  }

  /* ===== 7. 作品分类筛选 ===== */
  var chips = $$('.chip');
  var workCards = $$('.work-card');
  var filterEmpty = $('#filterEmpty');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.getAttribute('data-filter');
      chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });

      var shown = 0;
      workCards.forEach(function (card, i) {
        var match = filter === 'all' || card.getAttribute('data-cat') === filter;
        card.classList.toggle('is-hidden', !match);
        if (match) {
          shown += 1;
          /* 重新播放浮现动画，做出"重新排布"的手感 */
          card.classList.remove('is-visible');
          window.setTimeout(function () { card.classList.add('is-visible'); }, i * 45);
        }
      });

      if (filterEmpty) filterEmpty.hidden = shown !== 0;
    });
  });

  /* ===== 8. 打字机效果（Hero 简介轮播） ===== */
  var typedEl = $('#typed');
  var PHRASES = [
    '把想法做成能用的东西',
    '喜欢有厚度、有高光的界面',
    '在长沙，写原生前端',
    '让信息层次一眼看清'
  ];

  if (typedEl) {
    var pIndex = 0;
    var cIndex = 0;
    var deleting = false;

    (function tick() {
      var phrase = PHRASES[pIndex];
      cIndex += deleting ? -1 : 1;
      typedEl.textContent = phrase.slice(0, cIndex);

      var delay = deleting ? 45 : 105;
      if (!deleting && cIndex === phrase.length) {
        deleting = true;
        delay = 1600; /* 完整停留 */
      } else if (deleting && cIndex === 0) {
        deleting = false;
        pIndex = (pIndex + 1) % PHRASES.length;
        delay = 320;
      }
      window.setTimeout(tick, delay);
    })();
  }

  /* ===== 9. 回到顶部按钮 ===== */
  var toTop = $('#toTop');
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ===== 10. 联系表单：本地校验（不联网、不提交） ===== */
  var form = $('#contactForm');
  var status = $('#formStatus');

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault(); /* 纯前端演示，阻止真实提交 */

      var name = $('#nameInput');
      var mail = $('#mailInput');
      var msg = $('#msgInput');
      var fields = [name, mail, msg];
      var mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim());
      var checks = [
        name.value.trim().length >= 2,
        mailOk,
        msg.value.trim().length >= 4
      ];

      var firstBad = null;
      fields.forEach(function (field, i) {
        field.classList.toggle('is-invalid', !checks[i]);
        if (!checks[i] && !firstBad) firstBad = field;
      });

      if (firstBad) {
        status.textContent = '还有内容需要补一下：昵称≥2 字、邮箱格式正确、留言≥4 字。';
        status.classList.remove('is-ok');
        firstBad.focus();
        return;
      }

      status.textContent = '校验通过 ✓ 内容没有离开你的浏览器；请用上方邮箱投递。';
      status.classList.add('is-ok');
      form.reset();
    });

    /* 输入时即时清除错误态 */
    $$('.field-input', form).forEach(function (field) {
      field.addEventListener('input', function () {
        if (field.classList.contains('is-invalid') && field.value.trim()) {
          field.classList.remove('is-invalid');
        }
      });
    });
  }
})();
