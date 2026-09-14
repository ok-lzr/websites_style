/* ==========================================================================
   主导航页脚本（index.html 专用）
   职责：① 长沙实时时钟  ② 分类筛选 + 关键词搜索  ③ 预览密度切换
        ④ 主题切换（深/浅）  ⑤ 卡片延迟加载与入场动画
   说明：所有交互通过 addEventListener 绑定，HTML 中不含内联事件。
   ========================================================================== */

(function () {
  'use strict';

  /* ===== 1. 长沙实时时钟（本地时钟，按 UTC+8 计算长沙时间） ===== */
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var clock = {
    time: document.getElementById('clockTime'),
    date: document.getElementById('clockDate'),
    week: document.getElementById('clockWeek'),
    mode: document.getElementById('clockMode'),
    led: document.getElementById('clockLed'),
    inline: document.getElementById('clockInline'),
    foot: document.getElementById('clockFoot')
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 取长沙时间：用本地时间偏移换算到 UTC+8，保证任何时区打开都显示长沙时间
  function changshaNow() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  }

  function tick() {
    var t = changshaNow();
    var hh = pad(t.getHours());
    var mm = pad(t.getMinutes());
    var ss = pad(t.getSeconds());
    var h = t.getHours();
    var mode = h < 6 ? '凌晨' : h < 12 ? '上午' : h < 14 ? '午间' : h < 18 ? '下午' : h < 23 ? '夜间' : '深夜';

    if (clock.time) { clock.time.textContent = hh + ':' + mm + ':' + ss; }
    if (clock.date) { clock.date.textContent = t.getFullYear() + ' 年 ' + (t.getMonth() + 1) + ' 月 ' + t.getDate() + ' 日'; }
    if (clock.week) { clock.week.textContent = WEEK[t.getDay()] + ' · 湖南省长沙市'; }
    if (clock.mode) { clock.mode.textContent = mode; }
    if (clock.inline) { clock.inline.textContent = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + hh + ':' + mm + ':' + ss + ' ' + WEEK[t.getDay()]; }
    if (clock.foot) { clock.foot.textContent = '长沙时间 ' + hh + ':' + mm + ':' + ss; }
    // 夜间自动切换深色，白天自动切换浅色（用户手动切换后不再自动干预）
    if (!state.themeTouched && clock.led) {
      var night = (h >= 19 || h < 7);
      document.body.classList.toggle('is-light', !night);
      syncThemeButton();
    }
  }

  /* ===== 2. 主题切换 ===== */
  var state = { themeTouched: false, col: 3 };

  function syncThemeButton() {
    var light = document.body.classList.contains('is-light');
    var icon = document.getElementById('themeIcon');
    var text = document.getElementById('themeText');
    var btn = document.getElementById('themeBtn');
    if (icon) { icon.textContent = light ? '☾' : '☀'; }
    if (text) { text.textContent = light ? '深色' : '浅色'; }
    if (btn) { btn.setAttribute('aria-pressed', light ? 'true' : 'false'); }
  }

  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      state.themeTouched = true;
      document.body.classList.toggle('is-light');
      syncThemeButton();
    });
  }

  /* ===== 3. 分类筛选与关键词搜索 ===== */
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var filters = document.getElementById('filters');
  var search = document.getElementById('search');
  var result = document.getElementById('result');
  var empty = document.getElementById('empty');
  var activeCat = 'all';

  function applyFilter() {
    var kw = (search && search.value ? search.value : '').trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var catOk = (activeCat === 'all' || card.dataset.cat === activeCat);
      var text = (card.dataset.name + ' ' + card.textContent).toLowerCase();
      var kwOk = !kw || text.indexOf(kw) !== -1;
      var visible = catOk && kwOk;
      card.classList.toggle('is-hidden', !visible);
      if (visible) { shown++; }
    });
    if (result) {
      result.textContent = kw
        ? '匹配「' + kw + '」的风格：' + shown + ' / ' + cards.length + ' 种'
        : '共 ' + cards.length + ' 种风格 · 当前显示 ' + shown + ' 种';
    }
    if (empty) { empty.hidden = shown !== 0; }
  }

  if (filters) {
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn) { return; }
      Array.prototype.forEach.call(filters.querySelectorAll('.filter'), function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      activeCat = btn.dataset.filter || 'all';
      applyFilter();
    });
  }
  if (search) { search.addEventListener('input', applyFilter); }

  /* ===== 4. 预览密度切换（大图 / 标准 / 紧凑） ===== */
  var density = document.querySelector('.density');
  if (density) {
    density.addEventListener('click', function (e) {
      var btn = e.target.closest('.dbtn');
      if (!btn) { return; }
      Array.prototype.forEach.call(density.querySelectorAll('.dbtn'), function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      state.col = parseInt(btn.dataset.cols, 10) || 3;
      // 小屏保持单/双列，避免卡片过窄
      var w = window.innerWidth;
      var cols = w < 720 ? 1 : (w < 1080 ? Math.min(state.col, 2) : state.col);
      document.documentElement.style.setProperty('--cols', cols);
    });
  }

  /* ===== 5. 预览图兜底 + 卡片入场动画 ===== */
  // 预览图由 HTML 直接加载；若某张截图缺失则重试一次，仍失败才降级为占位提示（不隐藏元素）
  function guardImage(img) {
    if (!img || img.dataset.guarded) { return; }
    img.dataset.guarded = '1';
    img.addEventListener('error', function () {
      var src = img.getAttribute('src');
      if (!src) { return; }
      if (!img.dataset.retried) {
        img.dataset.retried = '1';
        setTimeout(function () {
          img.removeAttribute('src');
          img.setAttribute('src', src + '?r=' + Date.now());
        }, 500);
        return;
      }
      var card = img.closest('.card');
      if (card) { card.classList.add('no-shot'); }
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.card__img'), guardImage);

  var cardList = document.querySelector('.gallery');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '220px 0px', threshold: 0.01 });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    cards.forEach(function (c) { c.classList.add('is-in'); });
  }

  // 键盘快捷键：/ 聚焦搜索框，Esc 清空
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && search && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    } else if (e.key === 'Escape' && search && document.activeElement === search) {
      search.value = '';
      applyFilter();
      search.blur();
    }
  });

  /* ===== 6. 启动 ===== */
  tick();
  setInterval(tick, 1000);
  syncThemeButton();
  applyFilter();
  if (cardList) { cardList.addEventListener('dragstart', function (e) { e.preventDefault(); }); }
})();
