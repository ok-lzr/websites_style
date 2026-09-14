/* ==========================================================================
   33-cyber-terminal-amber / script.js
   行为层：全部交互都用 addEventListener 绑定，样式只通过切类名 / 写 CSS 变量完成。
   模块：0 工具  1 打字机  2 滚动进入动画  3 技能条  4 导航高亮
        5 作品筛选  6 标签页  7 复制  8 主题与 CRT 开关  9 长沙时钟  10 字符雨
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 0. 工具函数 ===== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  // 页面初始化时刻：用于 HERO 区的“载入时刻”与会话编号
  var BOOT = new Date();

  /* ===== 1. 打字机效果 ===== */
  function initTypewriter() {
    var el = $('#typeText');
    if (!el) { return; }

    var lines = [
      '正在加载用户档案 ok-lzr ...',
      '定位：湖南省长沙市 · UTC+8',
      '技能：原生 HTML / CSS / JavaScript',
      '状态：可闲谈，也可接活'
    ];
    var li = 0;     // 当前行
    var ci = 0;     // 当前字符
    var deleting = false;  // 是否处于回退阶段

    function tick() {
      var text = lines[li];
      if (!deleting) {
        ci++;
        el.textContent = text.slice(0, ci);
        if (ci >= text.length) {
          deleting = true;
          window.setTimeout(tick, 1600);   // 整句停留
          return;
        }
        window.setTimeout(tick, 70);
      } else {
        ci--;
        el.textContent = text.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          li = (li + 1) % lines.length;
          window.setTimeout(tick, 320);
          return;
        }
        window.setTimeout(tick, 28);
      }
    }

    // 尊重“减少动态效果”：直接静态显示第一行
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = lines[0];
      return;
    }
    window.setTimeout(tick, 600);
  }

  /* ===== 2. 滚动进入动画（IntersectionObserver） ===== */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) { return; }

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);   // 只播放一次
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (n) { io.observe(n); });
  }

  /* ===== 3. 技能条动画 ===== */
  function initBars() {
    var bars = $$('.bar');
    if (!bars.length) { return; }

    function fill(bar) {
      var v = parseInt(bar.getAttribute('data-value'), 10) || 0;
      // 目标宽度通过 CSS 变量交给样式层，JS 不写具体样式字符串
      bar.style.setProperty('--w', Math.min(100, Math.max(0, v)) + '%');
      bar.classList.add('is-filled');
    }

    if (!('IntersectionObserver' in window)) {
      bars.forEach(fill);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) { return; }
        var bar = entry.target;
        window.setTimeout(function () { fill(bar); }, i * 120);  // 依次增长
        io.unobserve(bar);
      });
    }, { threshold: 0.4 });

    bars.forEach(function (b) { io.observe(b); });
  }

  /* ===== 4. 导航高亮（滚动联动） ===== */
  function initScrollSpy() {
    var links = $$('.nav__link');
    if (!links.length) { return; }

    var map = {};
    var targets = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) { map[id] = a; targets.push(sec); }
    });

    function sync() {
      var y = window.scrollY + 120;
      var currentId = targets.length ? targets[0].id : null;
      targets.forEach(function (sec) {
        if (sec.offsetTop <= y) { currentId = sec.id; }
      });
      links.forEach(function (a) { a.classList.remove('is-current'); });
      if (currentId && map[currentId]) { map[currentId].classList.add('is-current'); }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () {
        sync();
        ticking = false;
      });
    }, { passive: true });
    sync();
  }

  /* ===== 5. 作品筛选 ===== */
  function initFilters() {
    var box = $('#projFilters');
    var list = $('#projectList');
    var hint = $('#filterHint');
    if (!box || !list || !hint) { return; }

    var cards = $$('.card', list);
    var names = { all: '全部', web: '网页', tool: '工具', data: '数据' };

    function apply(cat) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = (cat === 'all') || (card.getAttribute('data-cat') === cat);
        card.classList.toggle('is-hidden', !match);
        if (match) { shown++; }
      });
      hint.textContent = '共 ' + cards.length + ' 条记录 · 当前显示：' + (names[cat] || cat) + '（' + shown + ' 条）';
    }

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn || !box.contains(btn)) { return; }
      $$('.filter', box).forEach(function (b) {
        var on = (b === btn);
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      apply(btn.getAttribute('data-filter'));
    });
  }

  /* ===== 6. 标签页切换 ===== */
  function initTabs() {
    var bar = $('.tabs');
    if (!bar) { return; }
    var tabs = $$('.tab', bar);

    function select(tab) {
      tabs.forEach(function (t) {
        var on = (t === tab);
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.classList.toggle('is-active', on);
          if (on) { panel.removeAttribute('hidden'); } else { panel.setAttribute('hidden', ''); }
        }
      });
    }

    bar.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (tab && bar.contains(tab)) { select(tab); }
    });

    // 键盘左右方向键切换
    bar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) { return; }
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
  }

  /* ===== 7. 复制到剪贴板 ===== */
  function initCopy() {
    var status = $('#copyStatus');
    var btns = $$('[data-copy]');
    if (!status || !btns.length) { return; }

    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'copy-helper';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        function done(ok) {
          status.classList.toggle('is-error', !ok);
          status.textContent = ok
            ? '[OK] 已复制：' + text
            : '[ERR] 复制失败，请手动选择：' + text;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); },
            function () { done(legacyCopy(text)); });
        } else {
          done(legacyCopy(text));
        }
      });
    });
  }

  /* ===== 8. 主题 / CRT 开关 ===== */
  function initToggles() {
    var page = $('#page');
    var themeBtn = $('#themeToggle');
    var crtBtn = $('#crtToggle');
    if (!page) { return; }

    function paintTheme() {
      var light = page.classList.contains('is-light');
      if (themeBtn) {
        themeBtn.setAttribute('aria-pressed', light ? 'true' : 'false');
        var t = $('.crt-btn__txt', themeBtn);
        var i = $('.crt-btn__ico', themeBtn);
        if (t) { t.textContent = light ? '夜间模式' : '日间模式'; }
        if (i) { i.textContent = light ? '\u263E' : '\u2600'; }
      }
    }

    function paintCrt() {
      var off = page.classList.contains('crt-off');
      if (crtBtn) {
        crtBtn.setAttribute('aria-pressed', off ? 'false' : 'true');
        var t = $('.crt-btn__txt', crtBtn);
        if (t) { t.textContent = off ? '开启扫描线' : 'CRT 扫描线'; }
      }
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        page.classList.toggle('is-light');
        paintTheme();
      });
    }
    if (crtBtn) {
      crtBtn.addEventListener('click', function () {
        page.classList.toggle('crt-off');
        paintCrt();
      });
    }

    paintTheme();
    paintCrt();
  }

  /* ===== 9. 长沙时间时钟（UTC+8，实时） ===== */
  function initClock() {
    var tEl = $('#clockTime');
    var dEl = $('#clockDate');
    var pEl = $('#clockPhase');
    var isoEl = $('#clockIso');
    if (!tEl || !dEl) { return; }

    var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    // 逻辑上取 UTC+8 的长沙本地时刻：把本机时间换算到目标时区
    function changshaNow() {
      var now = new Date();
      return new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
    }

    function render() {
      var d = changshaNow();
      var h = d.getHours();

      tEl.textContent = pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      dEl.textContent = d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 ' + WEEK[d.getDay()];

      if (pEl) {
        // 夜/昼判断：6:00 - 18:00 视为白昼，其余为夜间
        var night = (h < 6 || h >= 18);
        pEl.textContent = night ? '\u263E 夜间' : '\u2600 白昼';
        pEl.classList.toggle('is-night', night);
      }
      if (isoEl) {
        isoEl.textContent = 'ISO(UTC+8) ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
          'T' + pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '+08:00';
      }
    }

    render();
    window.setInterval(render, 1000);

    // 页面回到前台时立即补一帧，避免标签页休眠导致的延迟
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { render(); }
    });
  }

  /* ===== 10. 背景字符雨（Canvas，纯装饰） ===== */
  function initMatrix() {
    var cv = $('#matrix');
    if (!cv || !cv.getContext) { return; }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = cv.getContext('2d');
    var glyphs = '01\u30a2\u30a4\u30a6\u30a8\u30aaABCDEF#$%&*+=<>/\\|';
    var cols = 0;
    var drops = [];
    var fontSize = 15;
    var timer = null;

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / fontSize);
      drops = [];
      for (var i = 0; i < cols; i++) {
        drops[i] = Math.random() * (h / fontSize);
      }
    }

    function draw() {
      var h = window.innerHeight;
      // 半透明黑覆盖形成拖尾
      ctx.fillStyle = 'rgba(11, 7, 4, 0.28)';
      ctx.fillRect(0, 0, window.innerWidth, h);
      ctx.font = fontSize + 'px ui-monospace, Consolas, monospace';

      for (var i = 0; i < cols; i++) {
        var ch = glyphs.charAt(Math.floor(Math.random() * glyphs.length));
        var x = i * fontSize;
        var y = drops[i] * fontSize;
        // 头部更亮，尾部更暗，形成琥珀单色层次
        ctx.fillStyle = 'rgba(255, 200, 110, 0.85)';
        ctx.fillText(ch, x, y);
        ctx.fillStyle = 'rgba(217, 123, 6, 0.55)';
        ctx.fillText(ch, x, y - fontSize);

        if (y > h && Math.random() > 0.975) { drops[i] = 0; }
        drops[i]++;
      }
    }

    function start() {
      if (timer) { return; }
      timer = window.setInterval(draw, reduce ? 1000 : 90);
    }
    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    resize();
    start();

    var rt = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(rt);
      rt = window.setTimeout(resize, 200);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { start(); }
    });
  }

  /* ===== 10.5 键盘快捷键：Home 回到顶部 ===== */
  function initHotkeys() {
    document.addEventListener('keydown', function (e) {
      // 输入框中不劫持
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) { return; }
      if (e.key === 'Home') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    // 会话编号：取当前时间戳后 4 位，纯装饰
    var sid = $('#sessionId');
    if (sid) { sid.textContent = String(BOOT.getTime()).slice(-4); }

    var bt = $('#bootTime');
    if (bt) {
      bt.textContent = [BOOT.getHours(), BOOT.getMinutes(), BOOT.getSeconds()]
        .map(function (n) { return (n < 10 ? '0' : '') + n; }).join(':');
    }

    initTypewriter();
    initReveal();
    initBars();
    initScrollSpy();
    initFilters();
    initTabs();
    initCopy();
    initToggles();
    initClock();
    initMatrix();
    initHotkeys();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
