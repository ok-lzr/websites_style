/* ============================================================
   42-rainy-window · script.js
   雨天窗景的全部行为：实时时钟、昼夜主题、雨滴、滚动动效、
   作品筛选、数字滚动、打字机、鼠标暖光。
   页面结构中不写任何内联事件，统一在这里用 addEventListener 绑定。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* 参考基线：来自网络查询的 2026-09-14（星期一）22:07（UTC+8）
     仅用于首屏昼 / 夜主题的初始判断，时钟本身永远读取真实时间。 */
  var BASELINE = { year: 2026, month: 9, day: 14, hour: 22, minute: 7, weekday: 1 };
  var WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  var body = document.body;

  /* ============================================================
     1. 长沙时间实时时钟（UTC+8，与本地时区无关）
     ============================================================ */
  var clockTime = $("#clock-time");
  var clockDate = $("#clock-date");
  var clockFull = $("#clock-full");
  var dayPartEl = $("#day-part");

  var pad = function (n) {
    return n < 10 ? "0" + n : String(n);
  };

  /* 取 UTC+8 的各个时间字段，保证显示的是长沙时间 */
  function changshaParts(date) {
    var shifted = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000);
    return {
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
      day: shifted.getDate(),
      hour: shifted.getHours(),
      minute: shifted.getMinutes(),
      second: shifted.getSeconds(),
      weekday: shifted.getDay()
    };
  }

  /* 依据小时给出中文时段描述 */
  function dayPartName(hour) {
    if (hour < 5) return "深夜";
    if (hour < 8) return "清晨";
    if (hour < 11) return "上午";
    if (hour < 13) return "中午";
    if (hour < 17) return "下午";
    if (hour < 19) return "傍晚";
    if (hour < 22) return "夜里";
    return "深夜";
  }

  /* 是否属于"夜晚"：19:00 ~ 次日 06:00 之间 */
  function isNightHour(hour) {
    return hour >= 19 || hour < 6;
  }

  function renderClock() {
    var now = new Date();
    var t = changshaParts(now);
    var timeText = pad(t.hour) + ":" + pad(t.minute) + ":" + pad(t.second);
    var dateText = t.year + " 年 " + t.month + " 月 " + t.day + " 日 · " + WEEKDAYS[t.weekday];
    var part = dayPartName(t.hour);

    if (clockTime) clockTime.textContent = timeText;
    if (clockDate) clockDate.textContent = dateText;
    if (dayPartEl) dayPartEl.textContent = part + " · 长沙";
    if (clockFull) clockFull.textContent = dateText + " " + timeText + "（" + part + "）";

    // 时钟同时驱动昼夜主题（用户手动切换过就不再覆盖，直到下一次跨时段）
    var autoNight = isNightHour(t.hour);
    if (autoNight !== lastAutoNight) {
      lastAutoNight = autoNight;
      if (!userThemed) applyTheme(autoNight ? "night" : "day", false);
    }
  }

  /* 首屏先用基线时刻判断一次，避免打开瞬间闪错主题 */
  var lastAutoNight = isNightHour(BASELINE.hour);
  var userThemed = false;

  /* ============================================================
     2. 昼夜主题切换（夜间 = 暖光室内 / 白天 = 冷灰日光）
     ============================================================ */
  var themeToggle = $("#theme-toggle");
  var themeName = $("#theme-name");

  function applyTheme(theme, byUser) {
    document.documentElement.setAttribute("data-theme", theme);
    if (byUser) userThemed = true;
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", theme === "night" ? "true" : "false");
      themeToggle.setAttribute("aria-label", theme === "night" ? "切换到白天模式" : "切换到夜间模式");
      themeToggle.textContent = theme === "night" ? "🌙" : "☀️";
    }
    if (themeName) themeName.textContent = theme === "night" ? "暖光夜色" : "冷灰雨天";
  }

  applyTheme(lastAutoNight ? "night" : "day", false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "night" ? "day" : "night";
      applyTheme(next, true);
    });
  }

  /* ============================================================
     3. 雨滴与雨丝：动态生成带随机参数的窗玻璃水痕
     ============================================================ */
  var scene = $(".scene");
  var rainToggle = $("#rain-toggle");
  var DROP_COUNT = window.innerWidth < 700 ? 10 : 18;

  function buildDrops() {
    if (!scene) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < DROP_COUNT; i++) {
      var drop = document.createElement("i");
      drop.className = "drop";
      drop.style.setProperty("--d-size", (7 + Math.random() * 12).toFixed(1) + "px");
      drop.style.setProperty("--d-dur", (7 + Math.random() * 9).toFixed(2) + "s");
      drop.style.setProperty("--d-delay", (-Math.random() * 12).toFixed(2) + "s");
      drop.style.setProperty("--d-trail", (40 + Math.random() * 110).toFixed(0) + "px");
      drop.style.left = (Math.random() * 100).toFixed(2) + "%";
      frag.appendChild(drop);
    }
    scene.appendChild(frag);
  }

  buildDrops();

  if (rainToggle) {
    rainToggle.addEventListener("click", function () {
      var off = body.classList.toggle("rain-off");
      rainToggle.setAttribute("aria-pressed", off ? "false" : "true");
      rainToggle.setAttribute("aria-label", off ? "开启雨丝" : "关闭雨丝");
    });
  }

  /* ============================================================
     4. 滚动进入动画（IntersectionObserver）
     ============================================================ */
  var revealItems = $$(".reveal");

  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -40px 0px" });

    revealItems.forEach(function (item) {
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-in");
    });
  }

  /* ============================================================
     5. 技能条：进入视口后按 data-level 生长
     ============================================================ */
  var skillFills = $$(".skill-fill");

  if ("IntersectionObserver" in window && skillFills.length) {
    var skillObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var fill = entry.target;
        var level = Number(fill.getAttribute("data-level")) || 0;
        fill.style.width = Math.max(0, Math.min(100, level)) + "%";
        skillObserver.unobserve(fill);
      });
    }, { threshold: 0.4 });

    skillFills.forEach(function (fill) {
      skillObserver.observe(fill);
    });
  } else {
    skillFills.forEach(function (fill) {
      fill.style.width = (Number(fill.getAttribute("data-level")) || 0) + "%";
    });
  }

  /* ============================================================
     6. 数字滚动统计
     ============================================================ */
  var counters = $$(".stat-num");

  function runCounter(el) {
    var target = Number(el.getAttribute("data-count")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1400;
    var start = 0;

    function step(now) {
      var p = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3); // 缓出，收尾更自然
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(function (now) {
      start = now;
      step(now);
    });
  }

  if ("IntersectionObserver" in window && counters.length) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) {
      countObserver.observe(el);
    });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
    });
  }

  /* ============================================================
     7. 首屏打字机效果
     ============================================================ */
  var typed = $("#typed");
  var LINES = [
    "把日子过成可维护的项目。",
    "白天写前端，夜里听长沙的雨。",
    "冷色调的界面，暖色调的窗台灯。"
  ];

  if (typed) {
    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    var type = function () {
      var line = LINES[lineIndex];
      charIndex += deleting ? -1 : 1;
      typed.textContent = line.slice(0, charIndex);

      var delay = deleting ? 45 : 105;
      if (!deleting && charIndex === line.length) {
        deleting = true;
        delay = 1900; // 整句停留
      } else if (deleting && charIndex === 0) {
        deleting = false;
        lineIndex = (lineIndex + 1) % LINES.length;
        delay = 420;
      }
      window.setTimeout(type, delay);
    };

    window.setTimeout(type, 600);
  }

  /* ============================================================
     8. 导航：移动端菜单、平滑滚动、滚动高亮当前区块
     ============================================================ */
  var navToggle = $(".nav-toggle");
  var navList = $("#nav-menu");

  if (navToggle && navList) {
    navToggle.addEventListener("click", function () {
      var open = navList.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // 点击菜单项后自动收起
    $$(".nav-link", navList).forEach(function (link) {
      link.addEventListener("click", function () {
        navList.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // 平滑滚动（对不支持 scroll-behavior 的环境补齐）
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 74;
      window.scrollTo({ top: top, behavior: "smooth" });
      history.replaceState(null, "", id);
    });
  });

  // 滚动时高亮当前区块
  var navLinks = $$(".nav-link");
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute("href")); })
    .filter(Boolean);

  function markActive() {
    var pos = window.pageYOffset + 130;
    var current = sections[0];
    sections.forEach(function (sec) {
      if (sec.offsetTop <= pos) current = sec;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle("is-active", current && link.getAttribute("href") === "#" + current.id);
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      markActive();
      ticking = false;
    });
  }, { passive: true });

  markActive();

  /* ============================================================
     9. 作品筛选：按钮切换分类 + 入场闪动
     ============================================================ */
  var filters = $$(".filter");
  var works = $$("#work-list .work");
  var emptyTip = $("#empty-tip");

  function applyFilter(cat) {
    var shown = 0;
    works.forEach(function (work, index) {
      var match = cat === "all" || work.getAttribute("data-cat") === cat;
      work.classList.toggle("is-hidden", !match);
      work.classList.remove("flash");
      if (match) {
        shown++;
        // 依次错开出现，像雨滴一颗颗落下
        work.style.animationDelay = (shown * 60) + "ms";
        void work.offsetWidth; // 触发重排，让动画可以重播
        work.classList.add("flash");
      }
    });
    if (emptyTip) emptyTip.hidden = shown > 0;
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filters.forEach(function (other) {
        var active = other === btn;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", active ? "true" : "false");
      });
      applyFilter(btn.getAttribute("data-filter"));
    });
  });

  /* ============================================================
     10. 鼠标暖光跟随（只写 CSS 变量，样式仍在 CSS 中）
     ============================================================ */
  var root = document.documentElement;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (fine.matches) {
    window.addEventListener("mousemove", function (event) {
      root.style.setProperty("--mx", event.clientX + "px");
      root.style.setProperty("--my", event.clientY + "px");
    }, { passive: true });

    // 鼠标离开窗口时把暖光收回中央
    document.addEventListener("mouseleave", function () {
      root.style.setProperty("--mx", "50%");
      root.style.setProperty("--my", "30%");
    });
  }

  /* ============================================================
     11. 启动时钟：先渲染一次，再每秒刷新
     ============================================================ */
  renderClock();
  window.setInterval(renderClock, 1000);
})();
