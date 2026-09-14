/* ============================================================
   蒸汽朋克个人主页 · script.js
   所有交互行为：时钟、昼夜主题、打字机、滚动动画、技能条、
   作品筛选、导航高亮、鼠标跟随火光
   ============================================================ */

(function () {
  'use strict';

  /* ===== 1. 长沙实时时钟 =====
     使用 new Date() 实时更新，以 zh-CN 格式显示年月日、时分秒、星期。
     参考基线时刻：2026-09-14（星期一）22:07（UTC+8），用于昼夜主题判断。 */
  var BASELINE = new Date('2026-09-14T22:07:00+08:00'); // 网络查询的参考时刻：夜间
  var WEEK_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 取北京时间（UTC+8）各字段，避免依赖运行环境的本地时区
  function getBeijingParts(date) {
    var shifted = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + (8 * 3600000));
    return {
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
      day: shifted.getDate(),
      hour: shifted.getHours(),
      minute: shifted.getMinutes(),
      second: shifted.getSeconds(),
      week: shifted.getDay()
    };
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  var clockDate = document.getElementById('clockDate');
  var clockTime = document.getElementById('clockTime');
  var clockWeek = document.getElementById('clockWeek');
  var clockMode = document.getElementById('clockMode');

  // 手动切换后不再被自动昼夜逻辑覆盖
  var manualTheme = null;

  // 依据当前小时判断昼（6:00-18:00）夜，并自动切换黄铜暗夜 / 羊皮纸白昼
  function applyDayNightTheme(hour) {
    if (manualTheme !== null) { return; }
    var isDay = hour >= 6 && hour < 18;
    document.body.classList.toggle('is-day', isDay);
    syncThemeButton(isDay);
    if (clockMode) {
      clockMode.textContent = isDay ? '☀ 白昼 · 锅炉阳光充足' : '☾ 夜间 · 炉火与煤油灯';
    }
  }

  function tickClock() {
    var now = new Date();
    var p = getBeijingParts(now);

    if (clockDate) {
      clockDate.textContent = p.year + ' 年 ' + pad(p.month) + ' 月 ' + pad(p.day) + ' 日';
    }
    if (clockTime) {
      clockTime.textContent = pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second);
    }
    if (clockWeek) {
      clockWeek.textContent = WEEK_ZH[p.week];
    }
    applyDayNightTheme(p.hour);
  }

  // 记录基线时刻供控制台参考（来自网络查询的参考时刻）
  if (window.console && console.log) {
    console.log('[工坊台账] 参考基线时刻：' + BASELINE.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  }

  tickClock();
  setInterval(tickClock, 1000);

  /* ===== 2. 深浅色（昼/夜）手动切换 ===== */
  var themeToggle = document.getElementById('themeToggle');
  var themeLabel = themeToggle ? themeToggle.querySelector('.theme-label') : null;
  var themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;

  function syncThemeButton(isDay) {
    if (!themeToggle) { return; }
    themeToggle.setAttribute('aria-pressed', isDay ? 'true' : 'false');
    if (themeLabel) { themeLabel.textContent = isDay ? '夜间模式' : '白昼模式'; }
    if (themeIcon) { themeIcon.textContent = isDay ? '☾' : '☀'; }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var nextIsDay = !document.body.classList.contains('is-day');
      manualTheme = nextIsDay;
      document.body.classList.toggle('is-day', nextIsDay);
      syncThemeButton(nextIsDay);
      if (clockMode) {
        clockMode.textContent = nextIsDay ? '☀ 白昼 · 锅炉阳光充足' : '☾ 夜间 · 炉火与煤油灯';
      }
    });
  }

  /* ===== 3. 打字机效果（姓名逐字打出） ===== */
  var typeTarget = document.getElementById('typeName');
  var FULL_NAME = 'ok-lzr / 码上生活';

  function typeWriter() {
    if (!typeTarget) { return; }
    var index = 0;
    typeTarget.textContent = '';
    var timer = setInterval(function () {
      index += 1;
      typeTarget.textContent = FULL_NAME.slice(0, index);
      if (index >= FULL_NAME.length) { clearInterval(timer); }
    }, 110);
  }
  typeWriter();

  /* ===== 4. 滚动进入动画（IntersectionObserver） ===== */
  var revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (item) { revealObserver.observe(item); });
  } else {
    // 兜底：不支持观察器时直接显示
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }

  /* ===== 5. 技能条动画 + 数字滚动 ===== */
  var skillList = document.getElementById('skillList');

  function fillSkill(skill) {
    var level = parseInt(skill.getAttribute('data-level'), 10) || 0;
    var bar = skill.querySelector('.skill-bar');
    var num = skill.querySelector('.skill-num');
    if (bar) { bar.style.width = level + '%'; }

    // 数字滚动
    var started = 0;
    var step = setInterval(function () {
      started += 2;
      if (started >= level) { started = level; clearInterval(step); }
      if (num) { num.textContent = started + '%'; }
    }, 18);
  }

  if (skillList) {
    var skills = skillList.querySelectorAll('.skill');
    if ('IntersectionObserver' in window) {
      var skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            fillSkill(entry.target);
            skillObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      skills.forEach(function (s) { skillObserver.observe(s); });
    } else {
      skills.forEach(fillSkill);
    }
  }

  /* ===== 6. 作品分类筛选（黄铜按钮） ===== */
  var filterBar = document.getElementById('filterBar');
  var workCards = document.querySelectorAll('.work-card');

  if (filterBar) {
    filterBar.addEventListener('click', function (event) {
      var btn = event.target.closest('.filter-btn');
      if (!btn) { return; }

      var filter = btn.getAttribute('data-filter');
      filterBar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });

      workCards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-cat') === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  }

  /* ===== 7. 平滑滚动 + 导航当前项高亮 ===== */
  var navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      var target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      if (!target) { return; }
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });

  var sections = document.querySelectorAll('main section[id]');
  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var id = '#' + entry.target.id;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-current', link.getAttribute('href') === id);
        });
      });
    }, { threshold: 0.35 });
    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ===== 8. 鼠标跟随的炉火光斑（仅桌面指针设备） ===== */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer) {
    var spark = document.createElement('div');
    spark.className = 'spark';
    document.body.appendChild(spark);

    document.addEventListener('mousemove', function (event) {
      spark.style.left = event.clientX + 'px';
      spark.style.top = event.clientY + 'px';
    });
    document.addEventListener('mouseleave', function () {
      spark.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
      spark.style.opacity = '1';
    });
  }
})();
