/* =========================================================
   19-nature-organic · 交互脚本
   行为全部在此文件：时钟、导航、主题、筛选、动画、鼠标跟随
   ========================================================= */
(function () {
  'use strict';

  /* ===== 常量：网络查询得到的基线参考时刻 =====
     2026-09-14 星期一 22:07（UTC+8），用于昼夜与主题的参考判断。
     页面时钟本身始终使用 new Date() 实时取值。 */
  var BASE_TIME = {
    year: 2026,
    month: 9,
    day: 14,
    hour: 22,
    minute: 7,
    weekday: '星期一',
    utcOffset: 8,
    text: '2026-09-14 星期一 22:07'
  };

  // 基线时刻的"分钟数"，用于计算与当前时刻的时间差
  var BASE_MINUTES = BASE_TIME.hour * 60 + BASE_TIME.minute;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ===== 实时时钟：长沙时间（UTC+8） ===== */
  var clockTimeEl = $('#clockTime');
  var clockDateEl = $('#clockDate');
  var clockPhaseEl = $('#clockPhase');
  var factClockEl = $('#factClock');
  var clockCardEl = $('.clock-card');

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  // 取某个时区偏移（小时）下的日期字段
  function inZone(date, offsetHours) {
    var ms = date.getTime() + (offsetHours * 60 + date.getTimezoneOffset()) * 60000;
    return new Date(ms);
  }

  // 判断昼夜：6:00-18:00 视为白天
  function isDaytime(hour) { return hour >= 6 && hour < 18; }

  // 依据小时切换整站昼夜主题
  function applyThemeByHour(hour, forceNight) {
    var night = typeof forceNight === 'boolean' ? forceNight : !isDaytime(hour);
    document.documentElement.classList.toggle('is-night', night);
    if (clockCardEl) { clockCardEl.classList.toggle('is-night', night); }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', night ? 'true' : 'false');
      var label = $('.theme-btn__label', themeToggle);
      var icon = $('.theme-btn__icon', themeToggle);
      if (label) { label.textContent = night ? '夜间' : '日间'; }
      if (icon) { icon.textContent = night ? '\u263D' : '\u2600'; }
    }
  }

  function tick() {
    var now = new Date();
    var local = inZone(now, BASE_TIME.utcOffset);
    var h = local.getHours();
    var m = local.getMinutes();
    var s = local.getSeconds();

    if (clockTimeEl) {
      clockTimeEl.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    }
    if (clockDateEl) {
      clockDateEl.textContent = local.toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      });
    }
    if (clockPhaseEl) {
      var day = isDaytime(h);
      var baseDay = isDaytime(BASE_TIME.hour);
      clockPhaseEl.textContent = (day ? '\u2600 白天 · 林间有光' : '\u263D 夜间 · 月下林地') +
        '（参考基线为' + (baseDay ? '白天' : '夜间') + ' ' + pad(BASE_TIME.hour) + ':' + pad(BASE_TIME.minute) + '）';
    }
    if (factClockEl) {
      factClockEl.textContent = local.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, weekday: 'long'
      });
    }
  }

  /* ===== 深浅色主题切换 ===== */
  var themeToggle = $('#themeToggle');
  var userSetTheme = false;

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var night = !document.documentElement.classList.contains('is-night');
      userSetTheme = true;
      applyThemeByHour(night ? 22 : 10, night);
    });
  }

  /* ===== 移动端导航展开与平滑滚动 ===== */
  var navToggle = $('#navToggle');
  var nav = $('#primaryNav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // 拦截站内锚点，平滑滚动并在移动端收起菜单
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id === '#') { return; }
      var target = document.querySelector(id);
      if (!target) { return; }
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        if (navToggle) { navToggle.setAttribute('aria-expanded', 'false'); }
      }
      history.replaceState(null, '', id);
    });
  });

  /* ===== 滚动进入动画 + 技能条 + 数字滚动 ===== */
  function animateBar(fill) {
    var value = fill.getAttribute('data-value') || '0';
    fill.style.width = value + '%';
    var num = fill.closest('.skill') ? $('.skill__num', fill.closest('.skill')) : null;
    if (num) { countTo(num, 0, parseInt(value, 10), 1200, '%'); }
  }

  function countTo(el, from, to, duration, suffix) {
    var start = null;
    function frame(ts) {
      if (start === null) { start = ts; }
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased) + (suffix || '');
      if (p < 1) { requestAnimationFrame(frame); }
    }
    requestAnimationFrame(frame);
  }

  var revealItems = $$('.reveal');
  var skillFills = $$('.bar__fill');
  var counterEls = $$('.counter__num');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (item) { revealObserver.observe(item); });

    var skillObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        animateBar(entry.target);
        skillObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    skillFills.forEach(function (fill) { skillObserver.observe(fill); });

    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var target = parseInt(entry.target.getAttribute('data-target'), 10) || 0;
        countTo(entry.target, 0, target, 1500, '');
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counterEls.forEach(function (el) { counterObserver.observe(el); });
  } else {
    // 兜底：不支持观察者时直接呈现
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
    skillFills.forEach(animateBar);
    counterEls.forEach(function (el) {
      el.textContent = el.getAttribute('data-target');
    });
  }

  /* ===== 导航当前区块高亮 ===== */
  var navLinks = $$('.nav__link');

  function highlightNav() {
    var y = window.scrollY + 140;
    var current = null;
    navLinks.forEach(function (link) {
      var section = document.querySelector(link.getAttribute('href'));
      if (section && section.offsetTop <= y) { current = link; }
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('is-current', link === current);
    });
  }

  /* ===== 作品筛选 ===== */
  var filterButtons = $$('.filter__btn');
  var works = $$('#worksList .work');

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kind = btn.getAttribute('data-filter');
      filterButtons.forEach(function (other) {
        other.classList.toggle('is-active', other === btn);
      });
      works.forEach(function (work) {
        var match = kind === 'all' || work.getAttribute('data-kind') === kind;
        work.classList.toggle('is-hidden', !match);
        if (match) {
          work.classList.add('is-visible');
        }
      });
    });
  });

  /* ===== 打字机效果：轮播简介句子 ===== */
  var typingEl = $('#typingLine');
  if (typingEl) {
    var sentences = (typingEl.getAttribute('data-typing') || typingEl.textContent).split('|');
    var sIndex = 0;
    var cIndex = 0;
    var deleting = false;

    var type = function () {
      var text = sentences[sIndex];
      cIndex += deleting ? -1 : 1;
      typingEl.textContent = text.slice(0, cIndex);
      var delay = deleting ? 45 : 95;
      if (!deleting && cIndex === text.length) { delay = 1800; deleting = true; }
      else if (deleting && cIndex === 0) { deleting = false; sIndex = (sIndex + 1) % sentences.length; delay = 400; }
      window.setTimeout(type, delay);
    };

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      typingEl.textContent = sentences[0];
    } else {
      typingEl.textContent = '';
      window.setTimeout(type, 600);
    }
  }

  /* ===== 鼠标跟随的柔和光晕（桌面） ===== */
  var follower = document.createElement('div');
  follower.className = 'follower';
  follower.setAttribute('aria-hidden', 'true');
  document.body.appendChild(follower);

  if (window.matchMedia && window.matchMedia('(hover: hover) and (min-width: 701px)').matches) {
    var fx = 0, fy = 0, tx = 0, ty = 0, running = false;

    var loop = function () {
      fx += (tx - fx) * 0.12;
      fy += (ty - fy) * 0.12;
      follower.style.transform = 'translate(' + fx.toFixed(1) + 'px,' + fy.toFixed(1) + 'px)';
      if (Math.abs(tx - fx) > 0.5 || Math.abs(ty - fy) > 0.5) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };

    window.addEventListener('mousemove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      follower.classList.add('is-on');
      if (!running) { running = true; requestAnimationFrame(loop); }
    });

    window.addEventListener('mouseleave', function () {
      follower.classList.remove('is-on');
    });
  }

  /* ===== 滚动事件绑定（节流） ===== */
  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (scrollTimer) { return; }
    scrollTimer = window.setTimeout(function () {
      scrollTimer = null;
      highlightNav();
    }, 120);
  }, { passive: true });

  /* ===== 启动 ===== */
  tick();
  window.setInterval(tick, 1000);

  // 首次进入按当前小时判定昼夜；用户手动切换后不再自动覆盖
  (function initTheme() {
    var local = inZone(new Date(), BASE_TIME.utcOffset);
    applyThemeByHour(local.getHours());
    highlightNav();
  })();

  // 若用户从未手动切换，每分钟按小时校准一次主题
  window.setInterval(function () {
    if (userSetTheme) { return; }
    var local = inZone(new Date(), BASE_TIME.utcOffset);
    applyThemeByHour(local.getHours());
  }, 60000);

  // 供调试查看基线时刻
  if (window.console && console.log) {
    console.log('[19-nature-organic] 基线参考时间：' + BASE_TIME.text + '（UTC+' + BASE_TIME.utcOffset + '）');
  }
})();
