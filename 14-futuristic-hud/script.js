/* ==========================================================================
   14-futuristic-hud / script.js
   行为层：实时时钟、平滑滚动与导航高亮、滚动进入动画（IntersectionObserver）、
           环形仪表 / 技能数据条 / 数字滚动、作品列表渲染与分类筛选、鼠标跟随光斑。
   规则：只操作类名与数据，不在 JS 中书写大段样式；所有事件均用 addEventListener 绑定。
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 参考基线：来自网络查询的当天基线段（2026-09-14 星期一 22:07 UTC+8） =====
     仅用于昼 / 夜主题判定与展示，页面时钟本身始终取 new Date() 实时更新。 */
  var BASELINE = new Date('2026-09-14T22:07:00+08:00');
  var DAY_START = 6;   // 06:00 起视为昼
  var DAY_END = 18;    // 18:00 起视为夜

  /* ===== 作品数据：卡片由脚本渲染，结构（类名）集中在 CSS ===== */
  var PROJECTS = [
    {
      id: 'ARC-01',
      title: '个人导航站',
      desc: '把常用站点按用途分组，支持自定义主题与首字母快速检索。',
      tech: ['HTML', 'CSS', 'localStorage'],
      cat: 'web'
    },
    {
      id: 'ARC-02',
      title: '长沙天气看板',
      desc: '展示长沙未来七日温度曲线与降雨概率，纯前端绘制图表。',
      tech: ['JavaScript', 'Canvas', 'SVG'],
      cat: 'visual'
    },
    {
      id: 'ARC-03',
      title: '番茄专注计时器',
      desc: '25 分钟专注 + 5 分钟休息循环，计时结束用系统通知提醒。',
      tech: ['JavaScript', 'Notification', 'CSS 动画'],
      cat: 'tool'
    },
    {
      id: 'ARC-04',
      title: '响应式简历页',
      desc: '单页简历模板，打印样式与移动端布局分开处理，可直接部署。',
      tech: ['HTML', 'CSS', '@media'],
      cat: 'web'
    },
    {
      id: 'ARC-05',
      title: '记账数据面板',
      desc: '按月汇总收支并生成环形占比图，数据保存在浏览器本地。',
      tech: ['Vue 3', 'SVG 环形图'],
      cat: 'visual'
    },
    {
      id: 'ARC-06',
      title: 'Markdown 笔记预览器',
      desc: '左侧编写右侧实时预览，支持代码高亮与一键导出 HTML。',
      tech: ['JavaScript', '正则解析'],
      cat: 'web'
    }
  ];

  var CAT_NAME = { all: '全部', web: '网页', tool: '工具', visual: '可视化' };

  /* ===== 小工具 ===== */
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /* 缓出动画：把数值从 0 递增到目标值（用于仪表、数据条、统计数字） */
  function easeCount(target, duration, onStep) {
    var start = null;
    function frame(now) {
      if (start === null) {
        start = now;
      }
      var p = clamp((now - start) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      onStep(target * eased, p);
      if (p < 1) {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ===== 模块一：长沙实时时钟（new Date() 每秒刷新，zh-CN 显示） ===== */
  var Clock = {
    init: function () {
      var self = this;
      this.nav = $('#navClock');
      this.date = $('#clockDate');
      this.time = $('#clockTime');
      this.week = $('#clockWeek');
      this.badge = $('#phaseBadge');
      this.segDay = $('#segDay');
      this.segNight = $('#segNight');
      this.tick();
      window.setInterval(function () {
        self.tick();
      }, 1000);
    },

    tick: function () {
      var now = new Date();
      var hh = pad2(now.getHours());
      var mm = pad2(now.getMinutes());
      var ss = pad2(now.getSeconds());
      var text = hh + ':' + mm + ':' + ss;

      if (this.nav) {
        this.nav.textContent = text;
        this.nav.setAttribute('datetime', now.toISOString());
      }
      if (this.time) {
        this.time.textContent = text;
      }
      if (this.date) {
        this.date.textContent =
          now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) +
          ' ' +
          now.toLocaleDateString('zh-CN', { weekday: 'long' });
      }
      if (this.week) {
        this.week.textContent = now.toLocaleDateString('zh-CN', { weekday: 'long' });
      }
      this.phase(now.getHours());
    },

    /* 昼 / 夜判定：以基线时刻的 22:07 作为夜间参考，同时跟随本机小时数变化 */
    phase: function (hour) {
      var isDay = hour >= DAY_START && hour < DAY_END;
      if (this.badge) {
        this.badge.textContent = isDay ? '日间模式' : '夜间模式';
        this.badge.classList.toggle('is-day', isDay);
      }
      if (this.segDay && this.segNight) {
        this.segDay.classList.toggle('is-on', isDay);
        this.segNight.classList.toggle('is-on', !isDay);
      }
    }
  };

  /* ===== 模块二：基线信息（校对展示的参考时刻是否与脚本常量一致） ===== */
  var Baseline = {
    init: function () {
      var el = $('.baseline__date');
      if (!el) {
        return;
      }
      var week = BASELINE.toLocaleDateString('zh-CN', { weekday: 'long' });
      el.textContent =
        BASELINE.getFullYear() + ' 年 ' + (BASELINE.getMonth() + 1) + ' 月 ' +
        BASELINE.getDate() + ' 日 ' + week;
    }
  };

  /* ===== 模块三：平滑滚动 + 导航当前区块高亮 ===== */
  var Nav = {
    init: function () {
      var bar = $('#hudNav');
      var links = $$('.nav__link');
      if (!links.length) {
        return;
      }

      links.forEach(function (link) {
        link.addEventListener('click', function (e) {
          var id = link.getAttribute('href');
          if (!id || id.charAt(0) !== '#') {
            return;
          }
          var target = document.getElementById(id.slice(1));
          if (!target) {
            return;
          }
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', id);
          Nav.mark(link);
        });
      });

      var sections = links
        .map(function (link) {
          return document.getElementById(link.getAttribute('href').slice(1));
        })
        .filter(Boolean);

      var jumping = false;
      function spy() {
        var offset = (bar ? bar.offsetHeight : 54) + 90;
        var current = sections[0];
        sections.forEach(function (sec) {
          if (sec.getBoundingClientRect().top <= offset) {
            current = sec;
          }
        });
        var active = links.filter(function (link) {
          return link.getAttribute('href') === '#' + current.id;
        })[0];
        if (active) {
          Nav.mark(active);
        }
      }

      window.addEventListener('scroll', function () {
        if (jumping) {
          return;
        }
        jumping = true;
        window.requestAnimationFrame(function () {
          spy();
          jumping = false;
        });
      }, { passive: true });

      spy();
    },

    mark: function (active) {
      $$('.nav__link').forEach(function (link) {
        link.classList.toggle('is-active', link === active);
      });
    }
  };

  /* ===== 模块四：滚动进入动画 + 仪表 / 数据条 / 统计数字 ===== */
  var Reveal = {
    reset: function () {
      $$('.ring__bar').forEach(function (bar) {
        var len = bar.getTotalLength ? bar.getTotalLength() : 327;
        bar.style.strokeDasharray = String(Math.round(len));
        bar.style.strokeDashoffset = String(Math.round(len));
      });
      $$('.track__fill').forEach(function (fill) {
        fill.style.width = '0%';
      });
    },

    init: function () {
      var items = $$('[data-reveal]');
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!items.length) {
        return;
      }

      if (reduced || !('IntersectionObserver' in window)) {
        items.forEach(function (el) {
          el.classList.add('is-in');
        });
        $$('.track[data-fill]').forEach(function (track) {
          var fill = $('.track__fill', track);
          if (fill) {
            fill.style.width = track.getAttribute('data-fill') + '%';
          }
        });
        $$('.ring__bar').forEach(function (bar) {
          Reveal.drawRing(bar, Number(bar.getAttribute('data-ring')) || 0);
        });
        $$('[data-count]').forEach(function (el) {
          el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
        });
        return;
      }

      document.body.classList.add('reveal-ready');
      this.reset();

      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var el = entry.target;
          el.classList.add('is-in');
          Reveal.animateInner(el);
          obs.unobserve(el);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

      items.forEach(function (el) {
        io.observe(el);
      });
    },

    /* 元素进入视口后，动画其内部的仪表 / 数据条 / 数字 */
    animateInner: function (el) {
      $$('.track[data-fill]', el).forEach(function (track) {
        var fill = $('.track__fill', track);
        if (fill) {
          fill.style.width = track.getAttribute('data-fill') + '%';
        }
      });
      $$('.ring', el).forEach(function (ring) {
        Reveal.animateRing(ring);
      });
      $$('[data-count]', el).forEach(function (num) {
        Reveal.count(num);
      });
    },

    drawRing: function (bar, percent) {
      var len = bar.getTotalLength ? bar.getTotalLength() : 327;
      bar.style.strokeDashoffset = String(Math.round(len * (1 - percent / 100)));
      var ring = bar.closest('.ring');
      var val = ring ? $('.ring__val', ring) : null;
      if (val) {
        val.textContent = percent + '%';
      }
    },

    animateRing: function (ring) {
      var bar = $('.ring__bar', ring);
      var val = $('.ring__val', ring);
      if (!bar) {
        return;
      }
      var target = Number(bar.getAttribute('data-ring')) || 0;
      var len = bar.getTotalLength ? bar.getTotalLength() : 327;
      bar.style.strokeDashoffset = String(Math.round(len));
      easeCount(target, 1500, function (v) {
        bar.style.strokeDashoffset = String(Math.round(len * (1 - v / 100)));
        if (val) {
          val.textContent = Math.round(v) + '%';
        }
      });
    },

    count: function (el) {
      var target = Number(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      easeCount(target, 1200, function (v) {
        el.textContent = Math.round(v) + suffix;
      });
    }
  };

  /* ===== 模块五：作品列表渲染 + 分类筛选 ===== */
  var Archive = {
    current: 'all',

    init: function () {
      var grid = $('#projectGrid');
      if (!grid) {
        return;
      }
      this.grid = grid;
      this.stat = $('#archiveStat');
      this.filters = $$('#filter .filter__btn');

      this.render();
      this.filters.forEach(function (btn) {
        btn.addEventListener('click', function () {
          Archive.current = btn.getAttribute('data-filter') || 'all';
          Archive.filters.forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
            b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
          });
          Archive.apply();
        });
      });

      this.filters.forEach(function (b) {
        b.setAttribute('aria-pressed', b.classList.contains('is-active') ? 'true' : 'false');
      });
    },

    render: function () {
      var html = PROJECTS.map(function (p, i) {
        var variant = (i % 3) + 1;
        var chips = p.tech.map(function (t) {
          return '<span class="chip">' + t + '</span>';
        }).join('');
        return (
          '<article class="card card--v' + variant + '" data-cat="' + p.cat + '" data-reveal>' +
            '<span class="card__corner" aria-hidden="true"></span>' +
            '<div class="card__head">' +
              '<div>' +
                '<p class="card__id">' + p.id + '</p>' +
                '<h3 class="card__title">' + p.title + '</h3>' +
              '</div>' +
            '</div>' +
            '<p class="card__desc">' + p.desc + '</p>' +
            '<div class="chips">' + chips + '</div>' +
            '<div class="card__foot">' +
              '<span>分类 · ' + CAT_NAME[p.cat] + '</span>' +
              '<span class="card__ok">● 已归档</span>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      this.grid.innerHTML = html;
      this.apply();
    },

    apply: function () {
      var shown = 0;
      $$('.card', this.grid).forEach(function (card) {
        var match = Archive.current === 'all' || card.getAttribute('data-cat') === Archive.current;
        card.classList.toggle('is-hide', !match);
        if (match) {
          shown += 1;
        }
      });
      if (this.stat) {
        this.stat.textContent =
          '已加载 ' + shown + ' / ' + PROJECTS.length + ' 个模块 · 当前分类：' + (CAT_NAME[this.current] || '全部');
      }
    }
  };

  /* ===== 模块六：鼠标跟随光斑（更新 CSS 变量，不写样式字符串） ===== */
  var Follow = {
    init: function () {
      var layer = $('#bgFollow');
      if (!layer) {
        return;
      }
      var pending = false;
      var mx = 50;
      var my = 22;

      if (window.matchMedia('(pointer: fine)').matches) {
        window.addEventListener('mousemove', function (e) {
          mx = (e.clientX / window.innerWidth) * 100;
          my = (e.clientY / window.innerHeight) * 100;
          if (pending) {
            return;
          }
          pending = true;
          window.requestAnimationFrame(function () {
            layer.style.setProperty('--mx', mx.toFixed(2) + '%');
            layer.style.setProperty('--my', my.toFixed(2) + '%');
            layer.classList.add('is-on');
            pending = false;
          });
        }, { passive: true });
      }
    }
  };

  /* ===== 启动 ===== */
  function boot() {
    Clock.init();
    Baseline.init();
    Nav.init();
    Archive.init();
    Reveal.init();
    Follow.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
