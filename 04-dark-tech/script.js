/* =========================================================
   script.js —— 深色科技感个人主页的交互层
   只负责行为：主题、实时时钟、滚动效果、筛选、复制等
   所有绑定集中在文件底部 init()，通过 addEventListener 注册
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量与工具 ---------- */
  // 参考基线：来自网络查询的时刻 —— 2026-09-14（星期一）22:07（UTC+8）
  // 用途：判断默认夜/昼主题，并在看板上展示与基线的偏移量
  var BASELINE = new Date('2026-09-14T22:07:00+08:00');
  var TZ = 'Asia/Shanghai';
  var PHRASES = [
    '在长沙写代码，把想法做成能跑起来的小站。',
    '偏好零依赖、可离线、秒开的小工具。',
    '把复杂的信息，铺成一块看得懂的看板。'
  ];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ---------- 1. 主题：基线判断夜色 + 手动深浅色切换 ---------- */
  var Theme = {
    toggle: null,
    label: null,
    glyph: null,

    // 依据基线时刻的小时数判断初始主题（22 点 → 夜间）
    initial: function () {
      var hour = new Date(BASELINE.getTime() + 8 * 3600 * 1000).getUTCHours();
      var isNight = hour >= 19 || hour < 6;
      return isNight ? 'dark' : 'light';
    },

    apply: function (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      var isLight = theme === 'light';
      if (this.label) this.label.textContent = isLight ? '白昼模式' : '夜间模式';
      if (this.glyph) this.glyph.textContent = isLight ? '☀' : '☾';
      if (this.toggle) this.toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      try {
        window.localStorage.setItem('oklzr-theme', theme);
      } catch (err) {
        /* 隐私模式下 localStorage 不可用，忽略即可 */
      }
    },

    read: function () {
      try {
        return window.localStorage.getItem('oklzr-theme');
      } catch (err) {
        return null;
      }
    },

    init: function () {
      this.toggle = $('#themeToggle');
      this.label = $('#themeLabel');
      this.glyph = $('#themeGlyph');
      this.apply(this.read() || this.initial());

      var self = this;
      if (this.toggle) {
        this.toggle.addEventListener('click', function () {
          var current = document.documentElement.getAttribute('data-theme');
          self.apply(current === 'dark' ? 'light' : 'dark');
        });
      }
    }
  };

  /* ---------- 2. 长沙时间：始终基于 new Date() 实时刷新 ---------- */
  var Clock = {
    timeFmt: null,
    dateFmt: null,
    weekFmt: null,
    offsetEl: null,
    daypartEl: null,

    init: function () {
      this.timeFmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: TZ, hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      this.dateFmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric'
      });
      this.weekFmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: TZ, weekday: 'long'
      });
      this.offsetEl = $('#baseOffset');
      this.daypartEl = $('#daypart');

      this.render();
      window.setInterval(this.render.bind(this), 1000);
    },

    // 当前长沙时间字符串（用于复制）
    text: function () {
      var now = new Date();
      return this.dateFmt.format(now) + ' ' + this.weekFmt.format(now) + ' ' + this.timeFmt.format(now);
    },

    render: function () {
      var now = new Date();
      var time = this.timeFmt.format(now);
      var date = this.dateFmt.format(now) + ' ' + this.weekFmt.format(now);

      $$('[data-clock="time"]').forEach(function (el) { el.textContent = time; });
      $$('[data-clock="date"]').forEach(function (el) { el.textContent = date; });

      // 与参考基线的偏移量（天 / 小时）
      if (this.offsetEl) {
        var diffMs = now.getTime() - BASELINE.getTime();
        var sign = diffMs < 0 ? '-' : '+';
        var abs = Math.abs(diffMs);
        var days = Math.floor(abs / 86400000);
        var hours = Math.floor((abs % 86400000) / 3600000);
        this.offsetEl.textContent = sign + days + ' 天 ' + pad2(hours) + ' 小时';
      }

      // 时段提示：跟随真实钟点
      if (this.daypartEl) {
        var hour = Number(this.timeFmt.format(now).slice(0, 2));
        var part = '夜间';
        if (hour >= 6 && hour < 12) part = '上午';
        else if (hour >= 12 && hour < 14) part = '午间';
        else if (hour >= 14 && hour < 18) part = '下午';
        else if (hour >= 18 && hour < 23) part = '晚上';
        this.daypartEl.textContent = part;
      }
    }
  };

  /* ---------- 3. 打字机：循环切换首屏标语 ---------- */
  var Typer = {
    init: function () {
      var el = $('#typeText');
      if (!el) return;

      if (reduceMotion) {
        el.textContent = PHRASES[0];
        return;
      }

      var phraseIndex = 0;
      var charIndex = PHRASES[0].length;
      var deleting = true; // 首屏先展示完整句子，再逐字删除

      function step() {
        var current = PHRASES[phraseIndex];

        if (deleting) {
          charIndex -= 1;
          el.textContent = current.slice(0, Math.max(charIndex, 0));
          if (charIndex <= 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % PHRASES.length;
            charIndex = 0;
            window.setTimeout(step, 320);
            return;
          }
          window.setTimeout(step, 42);
        } else {
          var target = PHRASES[phraseIndex];
          charIndex += 1;
          el.textContent = target.slice(0, charIndex);
          if (charIndex >= target.length) {
            deleting = true;
            window.setTimeout(step, 2200);
            return;
          }
          window.setTimeout(step, 78);
        }
      }

      window.setTimeout(step, 2200);
    }
  };

  /* ---------- 4. 滚动进入动画 + 技能条 + 数字累加 ---------- */
  var Reveal = {
    init: function () {
      var items = $$('[data-reveal]');
      if (!items.length) return;

      if (!('IntersectionObserver' in window)) {
        items.forEach(function (el) { el.classList.add('is-visible'); });
        Stats.runAll();
        Skills.runAll();
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

      items.forEach(function (el) { observer.observe(el); });
    }
  };

  var Stats = {
    init: function () {
      var cards = $$('[data-count]');
      if (!cards.length) return;

      if (!('IntersectionObserver' in window)) {
        this.runAll();
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          Stats.run(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.4 });

      cards.forEach(function (el) { observer.observe(el); });
    },

    runAll: function () {
      $$('[data-count]').forEach(function (el) { Stats.run(el); });
    },

    // 数字从 0 递增到目标值
    run: function (el) {
      if (el.dataset.done === '1') return;
      el.dataset.done = '1';

      var target = Number(el.dataset.count) || 0;
      var suffix = el.dataset.suffix || '';
      var duration = reduceMotion ? 0 : 1200;
      var start = null;

      function frame(ts) {
        if (start === null) start = ts;
        var progress = duration === 0 ? 1 : Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) window.requestAnimationFrame(frame);
      }

      window.requestAnimationFrame(frame);
    }
  };

  var Skills = {
    init: function () {
      var tracks = $$('[data-skill]');
      if (!tracks.length) return;

      if (!('IntersectionObserver' in window)) {
        this.runAll();
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          Skills.run(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.35 });

      tracks.forEach(function (el) { observer.observe(el); });
    },

    runAll: function () {
      $$('[data-skill]').forEach(function (el) { Skills.run(el); });
    },

    // 只写入宽度数值，动画交给 CSS 过渡
    run: function (el) {
      el.style.setProperty('--value', el.dataset.skill + '%');
    }
  };

  /* ---------- 5. 作品筛选 ---------- */
  var Filter = {
    init: function () {
      var bar = $('#filters');
      var grid = $('#projectGrid');
      if (!bar || !grid) return;

      var buttons = $$('.filter', bar);
      var cards = $$('.project-card', grid);
      var empty = $('#filterEmpty');

      bar.addEventListener('click', function (event) {
        var btn = event.target.closest('.filter');
        if (!btn || !bar.contains(btn)) return;

        var filter = btn.dataset.filter;
        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        var shown = 0;
        cards.forEach(function (card) {
          var match = filter === 'all' || card.dataset.cat === filter;
          card.classList.toggle('is-hidden', !match);
          if (match) shown += 1;
        });

        if (empty) empty.hidden = shown > 0;
      });
    }
  };

  /* ---------- 6. 导航：滚动高亮 + 平滑滚动 + 移动端折叠 ---------- */
  var Nav = {
    init: function () {
      var header = $('#siteHeader');
      var nav = $('#primaryNav');
      var navToggle = $('#navToggle');

      // 滚动后给顶栏加分隔线
      var onScroll = function () {
        if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      // 点击导航：平滑滚动并收起移动端菜单
      if (nav) {
        nav.addEventListener('click', function (event) {
          var link = event.target.closest('.nav-link');
          if (!link) return;
          var target = document.querySelector(link.getAttribute('href'));
          if (!target) return;

          event.preventDefault();
          target.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start'
          });
          nav.classList.remove('is-open');
          if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        });
      }

      if (navToggle && nav) {
        navToggle.addEventListener('click', function () {
          var open = nav.classList.toggle('is-open');
          navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }

      // 滚动监听：高亮当前所在区块
      var links = $$('.nav-link');
      var sections = links
        .map(function (link) { return document.querySelector(link.getAttribute('href')); })
        .filter(Boolean);

      if (!sections.length) return;

      if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            links.forEach(function (link) {
              link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
            });
          });
        }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

        sections.forEach(function (section) { spy.observe(section); });
      } else {
        var onSpy = function () {
          var pos = window.scrollY + window.innerHeight * 0.35;
          var current = sections[0];
          sections.forEach(function (section) {
            if (section.offsetTop <= pos) current = section;
          });
          links.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + current.id);
          });
        };
        window.addEventListener('scroll', onSpy, { passive: true });
        onSpy();
      }
    }
  };

  /* ---------- 7. 复制长沙时间 + 轻提示 ---------- */
  var Toast = {
    el: null,
    timer: 0,

    init: function () {
      this.el = $('#toast');

      var btn = $('#clockBtn');
      if (btn && this.el) {
        btn.addEventListener('click', function () {
          Toast.copy(Clock.text());
        });
      }
    },

    show: function (message) {
      if (!this.el) return;
      this.el.textContent = message;
      this.el.classList.add('is-show');
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(function () {
        Toast.el.classList.remove('is-show');
      }, 1800);
    },

    // Clipboard API 在部分环境不可用，回退到临时输入框方案
    copy: function (text) {
      var self = this;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          self.show('已复制：' + text);
        }).catch(function () {
          self.fallback(text);
        });
        return;
      }
      this.fallback(text);
    },

    fallback: function (text) {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', 'readonly');
      field.className = 'copy-helper';
      document.body.appendChild(field);
      field.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(field);
      this.show(ok ? '已复制：' + text : '复制失败，请手动选择时间');
    }
  };

  /* ---------- 8. 鼠标跟随光晕（背景层） ---------- */
  var CursorGlow = {
    init: function () {
      var aurora = $('#bgAurora');
      if (!aurora || reduceMotion) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;

      var pending = false;
      var x = 0;
      var y = 0;

      window.addEventListener('pointermove', function (event) {
        x = event.clientX;
        y = event.clientY;
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () {
          aurora.style.setProperty('--mx', x + 'px');
          aurora.style.setProperty('--my', y + 'px');
          pending = false;
        });
      }, { passive: true });
    }
  };

  /* ---------- 入口 ---------- */
  function init() {
    // 让 CSS 中的滚动动画规则只在 JS 可用时生效，保证降级可读
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');

    Theme.init();
    Clock.init();
    Typer.init();
    Reveal.init();
    Stats.init();
    Skills.init();
    Filter.init();
    Nav.init();
    Toast.init();
    CursorGlow.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
