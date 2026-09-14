/* ==========================================================================
   OK-LZR 周刊 · 交互脚本
   1. 长沙实时时钟与昼夜主题   2. 平滑滚动与导航高亮
   3. 滚动进入动画 + 技能条   4. 作品筛选   5. 报头轻微视差
   仅负责行为，所有样式都在 style.css 中以类名控制。
   ========================================================================== */

(function () {
  'use strict';

  /* ===== 时间工具 ===== */

  /** 取当前时刻在 UTC+8 的小时数（0–23） */
  function getHour() {
    return (new Date().getUTCHours() + 8) % 24;
  }

  /** 补零 */
  function pad(value) {
    return String(value).padStart(2, '0');
  }

  /* ===== 1. 长沙实时时钟与昼夜主题 =====
     基线参考：2026-09-14（星期一）22:07 UTC+8，用于确认夜间主题的取值；
     实际显示始终来自 new Date()。 */
  function initClock() {
    var timeEl = document.getElementById('clock-time');
    var dateEl = document.getElementById('clock-date');
    var phaseEl = document.getElementById('clock-phase');
    var issueEl = document.getElementById('issue-date');
    if (!timeEl || !dateEl || !phaseEl) {
      return;
    }

    // 使用 zh-CN 的日期与星期格式，只构造一次，之后复用
    var dateFormatter = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    function render() {
      var now = new Date();

      timeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      dateEl.textContent = dateFormatter.format(now);
      dateEl.setAttribute('datetime', now.toISOString());

      // 依据本机时间判断昼夜，并切换 html[data-theme]
      var isNight = getHour() < 6 || getHour() >= 18;
      document.documentElement.setAttribute('data-theme', isNight ? 'night' : 'day');
      phaseEl.textContent = isNight ? '夜间版 · 灯下排版中' : '日间版 · 晨光校样中';
      phaseEl.classList.toggle('is-night', isNight);
    }

    // 首次渲染时把刊行日期写成今天，形成"当期"感
    if (issueEl) {
      var today = new Date();
      issueEl.textContent = today.getFullYear() + ' 年 ' + (today.getMonth() + 1) + ' 月 ' + today.getDate() + ' 日';
      issueEl.setAttribute('datetime', today.toISOString().slice(0, 10));
    }

    render();
    window.setInterval(render, 1000);
  }

  /* ===== 2. 平滑滚动与导航高亮 =====
     CSS 已开启 scroll-behavior: smooth，这里补上降级与当前栏目的标记。 */
  function initNavigation() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    if (!links.length) {
      return;
    }

    // 点击导航：平滑滚动到对应栏目
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('href');
        var target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
        if (!target) {
          return;
        }
        event.preventDefault();
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) {
          history.replaceState(null, '', id);
        }
      });
    });

    // 滚动时高亮当前栏目
    var sections = links
      .map(function (link) {
        var id = link.getAttribute('href');
        return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) {
      return;
    }

    function setActive(id) {
      links.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
      });
    }

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(function (section) {
      spy.observe(section);
    });
  }

  /* ===== 3. 滚动进入动画 + 技能条 ===== */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var skills = Array.prototype.slice.call(document.querySelectorAll('.skill'));

    function fillSkills() {
      if (skills.length && skills[0].classList.contains('is-filled')) {
        return; // 已填充过，避免重复触发过渡
      }
      skills.forEach(function (skill, index) {
        var bar = skill.querySelector('.skill__bar');
        var level = bar ? Number(bar.getAttribute('data-level')) || 0 : 0;
        skill.style.setProperty('--level', level + '%');
        window.setTimeout(function () {
          skill.classList.add('is-filled');
        }, index * 110);
      });
    }

    if (!('IntersectionObserver' in window)) {
      // 不支持观察者时直接显示，保证内容可读
      items.forEach(function (item) {
        item.classList.add('is-revealed');
      });
      fillSkills();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add('is-revealed');
          if (entry.target.classList.contains('column-rule') || entry.target.querySelector('.skill')) {
            fillSkills();
          }
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });

    // 技能栏不在 .reveal 容器内时，单独观察一次
    var skillBox = document.querySelector('.column-rule');
    if (skillBox && !skillBox.classList.contains('reveal')) {
      observer.observe(skillBox);
    }
  }

  /* ===== 4. 作品筛选 ===== */
  function initFilters() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.filter__btn'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('#work-grid .card'));
    var statusEl = document.getElementById('filter-status');
    var emptyEl = document.getElementById('filter-empty');
    if (!buttons.length || !cards.length) {
      return;
    }

    function apply(cat) {
      var shown = 0;

      cards.forEach(function (card) {
        var match = cat === 'all' || card.getAttribute('data-cat') === cat;
        if (match) {
          shown += 1;
          // 复位动画，让重新出现的卡片再次淡入
          card.classList.add('is-resetting');
          card.classList.remove('is-revealed');
          card.classList.remove('is-hidden');
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
              card.classList.remove('is-resetting');
              card.classList.add('is-revealed');
            });
          });
        } else {
          card.classList.add('is-hidden');
        }
      });

      if (statusEl) {
        statusEl.textContent = '当前显示 ' + shown + ' 篇作品';
      }
      if (emptyEl) {
        emptyEl.hidden = shown !== 0;
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (other) {
          other.classList.toggle('is-active', other === button);
          other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
        });
        apply(button.getAttribute('data-filter') || 'all');
      });
    });
  }

  /* ===== 5. 报头轻微视差 ===== */
  function initParallax() {
    var plate = document.querySelector('.masthead__plate');
    var masthead = document.getElementById('masthead');
    if (!plate || !masthead) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (window.matchMedia('(hover: none)').matches) {
      return;
    }

    masthead.addEventListener('mousemove', function (event) {
      var rect = masthead.getBoundingClientRect();
      var ratio = (event.clientX - rect.left) / rect.width - 0.5;
      plate.style.setProperty('--shift-x', (ratio * 14).toFixed(2) + 'px');
    });

    masthead.addEventListener('mouseleave', function () {
      plate.style.setProperty('--shift-x', '0px');
    });
  }

  /* ===== 启动 ===== */
  function boot() {
    initClock();
    initNavigation();
    initReveal();
    initFilters();
    initParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
