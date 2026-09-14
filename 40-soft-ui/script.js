/* ============================================================
   40-soft-ui · 交互脚本
   全部行为集中在此文件：时钟、主题、滚动动效、筛选、微交互
   ============================================================ */

(function () {
  "use strict";

  /* ===== 小工具：取元素、补零、缓动 ===== */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     一、长沙实时时钟（UTC+8）
     说明：用 new Date() 取当前时刻，再按 UTC+8 换算成本地时间各字段，
     这样无论访问者身处哪个时区，显示的都是长沙时间。
     ============================================================ */
  const CLOCK_OFFSET_MS = 8 * 60 * 60 * 1000; // 东八区偏移
  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  const elTime = $("#clockTime");
  const elDate = $("#clockDate");
  const elContactClock = $("#contactClock");
  const elDayHint = $("#dayHint");

  /**
   * 参考基线：2026 年 9 月 14 日（星期一）22:07（UTC+8）
   * 来源为网络查询得到的参考时刻，用于判断当前应处于「夜间」还是「日间」主题。
   */
  const BASELINE = {
    label: "2026 年 9 月 14 日（星期一）22:07（UTC+8）",
    hour: 22
  };

  const BASELINE_TEXT =
    "参考基线：" + BASELINE.label +
    "（来自网络查询，用于夜/昼主题判断）";

  /** 读取当前的长沙时间字段 */
  function getChangshaParts() {
    const shifted = new Date(Date.now() + CLOCK_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      weekday: shifted.getUTCDay()
    };
  }

  /** 以 zh-CN 习惯拼接日期文案 */
  function formatDateText(p) {
    return p.year + " 年 " + p.month + " 月 " + p.day + " 日 · " + WEEKDAYS[p.weekday];
  }

  /** 根据小时数给出时段问候 */
  function greetingOf(hour) {
    if (hour < 6) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    if (hour < 23) return "晚上好";
    return "夜深了";
  }

  /** 是否属于夜间（19 点后或 6 点前），用于自动选择主题 */
  function isNightHour(hour) {
    return hour >= 19 || hour < 6;
  }

  let themeTouched = false; // 用户手动切换过主题后，不再自动覆盖

  function renderClock() {
    const p = getChangshaParts();
    const timeText = pad(p.hour) + ":" + pad(p.minute) + ":" + pad(p.second);

    elTime.textContent = timeText;
    elDate.textContent = formatDateText(p);
    elContactClock.textContent = timeText;

    // 昼/夜提示，同时说明基线的用途
    const phase = isNightHour(p.hour) ? "夜间" : "日间";
    elDayHint.textContent =
      greetingOf(p.hour) + "，现在" + phase + " · 长沙时间 " + timeText + " · " + BASELINE_TEXT;

    // 首次进入时按昼夜自动选择主题
    if (!themeTouched) {
      applyTheme(isNightHour(p.hour), false);
    }
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  /* ============================================================
     二、深浅色切换（胶囊按钮）
     ============================================================ */
  const themeToggle = $("#themeToggle");
  const themeIcon = themeToggle.querySelector(".theme-toggle__icon");
  const themeText = themeToggle.querySelector(".theme-toggle__text");

  function applyTheme(isDark, touched) {
    document.body.classList.toggle("is-dark", isDark);
    themeIcon.textContent = isDark ? "☀" : "☾";
    themeText.textContent = isDark ? "日间" : "夜间";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    if (touched) {
      themeTouched = true;
    }
  }

  themeToggle.addEventListener("click", function () {
    applyTheme(!document.body.classList.contains("is-dark"), true);
  });

  /* ============================================================
     三、姓名打字机效果
     ============================================================ */
  const typedName = $("#typedName");
  const NAME_TEXT = "ok-lzr";

  function typeWriter() {
    if (reduceMotion) {
      typedName.textContent = NAME_TEXT;
      return;
    }

    typedName.textContent = "";
    typedName.classList.add("is-typing");
    let i = 0;

    const step = () => {
      typedName.textContent = NAME_TEXT.slice(0, i + 1);
      i += 1;
      if (i < NAME_TEXT.length) {
        window.setTimeout(step, 130);
      } else {
        window.setTimeout(() => typedName.classList.remove("is-typing"), 900);
      }
    };

    step();
  }

  typeWriter();

  /* ============================================================
     四、平滑滚动导航 + 滚动监听（高亮当前栏目）
     ============================================================ */
  const navLinks = $$(".nav-link");
  const sections = $$("main section[id]");

  function scrollToTarget(target) {
    if (!target) return;
    const headerOffset = 92;
    const top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? "auto" : "smooth" });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      const target = id && id.charAt(0) === "#" ? document.querySelector(id) : null;
      if (target) {
        event.preventDefault();
        scrollToTarget(target);
        history.replaceState(null, "", id);
      }
    });
  });

  /** 底部区域永远无法滚到顶部，做一次位置钳制避免高亮丢失 */
  function activeSectionId() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (window.pageYOffset >= maxScroll - 4 && sections.length) {
      return sections[sections.length - 1].id;
    }
    let current = sections.length ? sections[0].id : "";
    const line = window.pageYOffset + 140;
    sections.forEach((section) => {
      if (section.offsetTop <= line) {
        current = section.id;
      }
    });
    return current;
  }

  function syncNavHighlight() {
    const id = activeSectionId();
    navLinks.forEach((link) => {
      link.classList.toggle("is-current", link.getAttribute("href") === "#" + id);
    });
  }

  /* ============================================================
     五、滚动进入动画 + 技能条生长（IntersectionObserver）
     ============================================================ */
  const revealNodes = $$(".reveal");

  /** 技能条：数字与宽度一起从 0 长到目标值 */
  function animateSkill(skill) {
    const level = clamp(parseInt(skill.getAttribute("data-level"), 10) || 0, 0, 100);
    const bar = skill.querySelector(".skill__bar");
    const pct = skill.querySelector(".skill__pct");

    bar.style.width = level + "%"; // 宽度由 CSS 过渡负责补间
    pct.textContent = level + "%";

    if (reduceMotion) {
      return;
    }

    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      pct.textContent = Math.round(level * easeOutCubic(t)) + "%";
      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  /** 数字滚动：data-count 为目标值，data-suffix 为后缀 */
  function animateCount(node) {
    const target = parseInt(node.getAttribute("data-count"), 10) || 0;
    const suffix = node.getAttribute("data-suffix") || "";

    if (reduceMotion) {
      node.textContent = target + suffix;
      return;
    }

    const duration = 1500;
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      node.textContent = Math.round(target * easeOutCubic(t)) + suffix;
      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  function onEnter(node) {
    if (node.classList.contains("skill")) {
      animateSkill(node);
    }
    const counter = node.querySelector(".stat__num");
    if (counter) {
      animateCount(counter);
    }
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          onEnter(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    // 技能条与数据数字本身也作为观察目标
    revealNodes.concat($$(".skill"), $$(".stat")).forEach((node) => observer.observe(node));
  } else {
    // 兜底：不支持观察器时直接展示最终状态
    revealNodes.concat($$(".skill"), $$(".stat")).forEach((node) => {
      node.classList.add("is-visible");
      onEnter(node);
    });
  }

  /* ============================================================
     六、作品筛选（胶囊标签页）
     ============================================================ */
  const chips = $$(".chip");
  const works = $$(".work");
  const emptyTip = $("#workEmpty");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.getAttribute("data-filter");

      chips.forEach((item) => item.classList.toggle("is-active", item === chip));

      let shown = 0;
      works.forEach((work) => {
        const hit = filter === "all" || work.getAttribute("data-cat") === filter;
        work.classList.toggle("is-hidden", !hit);
        // 筛选结果直接可见，避免遗留未触发的进入动画
        if (hit) {
          work.classList.add("is-visible");
          shown += 1;
        }
      });

      emptyTip.hidden = shown > 0;
      window.dispatchEvent(new Event("resize")); // 高度变化后重算当前栏目
    });
  });

  /* ============================================================
     七、回到顶部按钮
     ============================================================ */
  const toTop = $("#toTop");

  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* ============================================================
     八、鼠标跟随柔光（细腻微交互，桌面端）
     ============================================================ */
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  glow.setAttribute("aria-hidden", "true");
  document.body.appendChild(glow);

  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const glowPos = { x: pointer.x, y: pointer.y };
  let glowActive = false;

  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!glowActive) {
        glowActive = true;
        glow.classList.add("is-on");
      }
    });

    const follow = () => {
      glowPos.x += (pointer.x - glowPos.x) * 0.12;
      glowPos.y += (pointer.y - glowPos.y) * 0.12;
      glow.style.transform = "translate3d(" + glowPos.x + "px," + glowPos.y + "px,0)";
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  /* ============================================================
     九、统一的滚动处理（rAF 节流）
     ============================================================ */
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      syncNavHighlight();
      toTop.hidden = window.pageYOffset < 420;
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncNavHighlight);
  onScroll();
  syncNavHighlight();
})();
