// Theme toggle and sticky-nav border. No dependencies.
(function () {
  var root = document.documentElement;
  var KEY = "shawaz-theme";

  function store(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* private mode — theme just won't persist */
    }
  }

  function current() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      var apply = function () {
        root.setAttribute("data-theme", next);
        store(next);
      };
      var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || still) {
        apply();
        return;
      }
      // the new theme grows out of the toggle as a circle
      var r = toggle.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var vt = document.startViewTransition(apply);
      vt.ready
        .then(function () {
          root.animate(
            {
              clipPath: [
                "circle(0px at " + x + "px " + y + "px)",
                "circle(" + reach + "px at " + x + "px " + y + "px)",
              ],
            },
            {
              duration: 700,
              easing: "cubic-bezier(0.22, 0.8, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(function () {
          /* transition skipped; the theme is already applied */
        });
    });
  }

  var nav = document.querySelector(".nav");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();

// Motion: hero signal field, spotlight cards, scroll progress, active nav,
// stat counters. Everything is progressive: without JS (or with reduced
// motion) the page renders complete and still.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  function token(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function rgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- 1. Signal field behind the hero ---------- */
  var hero = document.querySelector(".hero");
  if (hero && window.HTMLCanvasElement) {
    var canvas = document.createElement("canvas");
    canvas.className = "hero-field";
    canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.firstChild);
    var ctx = canvas.getContext("2d");
    var GAP = 26;
    var w = 0, h = 0, dpr = 1, cols = 0, rows = 0;
    var colA = [62, 207, 155], colB = [92, 200, 255], dark = true;
    var pointer = { x: -9999, y: -9999, on: false };
    var pulses = [];
    var visible = true, raf = 0, t0 = performance.now();

    function readColors() {
      colA = rgb(token("--accent") || "#3ecf9b");
      colB = rgb(token("--accent-2") || "#5cc8ff");
      var bg = rgb(token("--bg") || "#0c0e12");
      dark = bg[0] + bg[1] + bg[2] < 384;
    }

    function size() {
      var r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / GAP) + 1;
      rows = Math.ceil(h / GAP) + 1;
    }

    function spawnPulse() {
      var horizontal = Math.random() < 0.6;
      pulses.push({
        horizontal: horizontal,
        lane: Math.floor(Math.random() * (horizontal ? rows : cols)),
        pos: -80,
        speed: 90 + Math.random() * 140,
        len: 60 + Math.random() * 90,
      });
    }

    function frame(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      var base = dark ? 0.16 : 0.14;
      var lens = 150;
      // a slow diagonal wave plus a lens around the pointer
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = i * GAP, y = j * GAP;
          var wave = Math.sin(i * 0.23 + j * 0.17 - t * 0.9) * 0.5 + 0.5;
          var a = base + wave * wave * (dark ? 0.26 : 0.16);
          var boost = 0;
          if (pointer.on) {
            var dx = x - pointer.x, dy = y - pointer.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < lens) boost = 1 - d / lens;
          }
          a += boost * 0.55;
          var c = boost > 0.05 ? colB : colA;
          ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
          var s = 1.4 + boost * 1.6;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      // data pulses travelling along grid lines
      for (var k = pulses.length - 1; k >= 0; k--) {
        var p = pulses[k];
        p.pos += p.speed / 60;
        var limit = p.horizontal ? w : h;
        if (p.pos - p.len > limit) {
          pulses.splice(k, 1);
          continue;
        }
        var lane = p.lane * GAP;
        var g = p.horizontal
          ? ctx.createLinearGradient(p.pos - p.len, 0, p.pos, 0)
          : ctx.createLinearGradient(0, p.pos - p.len, 0, p.pos);
        g.addColorStop(0, "rgba(" + colA + ",0)");
        g.addColorStop(1, "rgba(" + colA + "," + (dark ? 0.55 : 0.45) + ")");
        ctx.fillStyle = g;
        if (p.horizontal) ctx.fillRect(p.pos - p.len, lane - 0.75, p.len, 1.5);
        else ctx.fillRect(lane - 0.75, p.pos - p.len, 1.5, p.len);
      }
      if (pulses.length < 5 && Math.random() < 0.02) spawnPulse();
    }

    function loop(now) {
      frame(now);
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    }

    function start() {
      if (reduce.matches) {
        frame(t0 + 4000); // one still frame
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    readColors();
    size();
    start();

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        size();
        if (reduce.matches || !raf) frame(performance.now());
      }).observe(hero);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible) start();
      }).observe(hero);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) start();
    });
    new MutationObserver(function () {
      readColors();
      if (reduce.matches) frame(performance.now());
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

    if (finePointer.matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        pointer.on = true;
      });
      hero.addEventListener("pointerleave", function () {
        pointer.on = false;
      });
    }
  }

  /* ---------- 2. Spotlight cards ---------- */
  var spots = document.querySelectorAll(".card, .stat, .principle");
  if (finePointer.matches) {
    Array.prototype.forEach.call(spots, function (el) {
      el.classList.add("spot");
      var tilt = el.classList.contains("card") && !reduce.matches;
      var max = el.classList.contains("wide") ? 1.5 : 4;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        if (tilt) {
          el.style.setProperty("--rx", ((0.5 - py) * max).toFixed(2) + "deg");
          el.style.setProperty("--ry", ((px - 0.5) * max).toFixed(2) + "deg");
        }
        el.classList.add("lit");
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("lit");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- 3. Scroll progress, active section ---------- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    nav.appendChild(bar);
    var ticking = false;
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty("--progress", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : "0");
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('.nav-links a[href^="#"]'), function (a) {
    links[a.getAttribute("href").slice(1)] = a;
  });
  if (window.IntersectionObserver && Object.keys(links).length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = links[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          Object.keys(links).forEach(function (k) {
            links[k].classList.remove("active");
            links[k].removeAttribute("aria-current");
          });
          a.classList.add("active");
          a.setAttribute("aria-current", "location");
        } else {
          a.classList.remove("active");
          a.removeAttribute("aria-current");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }
})();

// Motion, part two: terminal-style decode on the monospace labels, and a
// timeline rail that fills as the reader scrolls through Experience.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.IntersectionObserver) return;

  /* ---------- 4. Decode the mono labels ---------- */
  var UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  var LOWER = "abcdefghijkmnpqrstuvwxyz0123456789";
  var DIGIT = "0123456789";

  function glyphFor(ch) {
    var set = /[0-9]/.test(ch) ? DIGIT : ch === ch.toUpperCase() ? UPPER : LOWER;
    return set[(Math.random() * set.length) | 0];
  }

  function decode(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    if (!nodes.length) return;
    var originals = nodes.map(function (n) {
      return n.nodeValue;
    });
    var total = originals.join("").length;
    var dur = Math.min(900, 380 + total * 14);
    var t0 = performance.now();
    var lastSwap = 0;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      nodes.forEach(function (n, k) {
        n.nodeValue = originals[k];
      });
      el.removeAttribute("aria-label");
    }
    // a throttled or backgrounded tab can stop animation frames mid-decode;
    // the real text comes back on time regardless
    setTimeout(finish, dur + 150);

    function tick(now) {
      if (done) return;
      var elapsed = now - t0;
      if (now - lastSwap >= 45 || elapsed >= dur) {
        lastSwap = now;
        var offset = 0;
        nodes.forEach(function (n, k) {
          var src = originals[k];
          var out = "";
          for (var i = 0; i < src.length; i++) {
            var ch = src[i];
            // characters resolve left to right; spaces and punctuation never scramble
            var at = ((offset + i) / total) * dur * 0.75 + dur * 0.2;
            out += elapsed >= at || !/[A-Za-z0-9]/.test(ch) ? ch : glyphFor(ch);
          }
          n.nodeValue = out;
          offset += src.length;
        });
      }
      if (elapsed < dur) requestAnimationFrame(tick);
      else finish();
    }
    requestAnimationFrame(tick);
  }

  if (!reduce) {
    var labels = document.querySelectorAll(
      ".hero .eyebrow, .section-head .mono, .principle .mono, .card-top span, .role .when, .contact > .mono"
    );
    var seen = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          seen.unobserve(e.target);
          decode(e.target);
        });
      },
      { threshold: 0.9 }
    );
    var arm = function () {
      Array.prototype.forEach.call(labels, function (el) {
        seen.observe(el);
      });
    };
    // wait for the mono face so every glyph has the same advance and nothing shifts
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(arm);
    else arm();
  }

  /* ---------- 5. Experience timeline rail ---------- */
  var line = document.querySelector(".timeline");
  if (line) {
    var roles = Array.prototype.slice.call(line.querySelectorAll(".role"));
    if (roles.length > 1) {
      line.classList.add("live");
      var centers = [];

      var measure = function () {
        var top = line.getBoundingClientRect().top + window.scrollY;
        centers = roles.map(function (r) {
          var cs = getComputedStyle(r, "::before");
          var y = r.getBoundingClientRect().top + window.scrollY - top;
          return y + parseFloat(cs.top) + parseFloat(cs.height) / 2;
        });
        var first = centers[0], last = centers[centers.length - 1];
        line.style.setProperty("--rail-top", first + "px");
        line.style.setProperty("--rail-height", Math.max(0, last - first) + "px");
        update();
      };

      var update = function () {
        var top = line.getBoundingClientRect().top;
        var mark = window.innerHeight * 0.62 - top; // reading line, in timeline coordinates
        var first = centers[0], last = centers[centers.length - 1];
        var fill = reduce ? 1 : Math.max(0, Math.min(1, (mark - first) / Math.max(1, last - first)));
        line.style.setProperty("--fill", fill.toFixed(4));
        roles.forEach(function (r, i) {
          r.classList.toggle("reached", reduce || mark >= centers[i] - 1);
        });
      };

      var queued = false;
      window.addEventListener(
        "scroll",
        function () {
          if (queued) return;
          queued = true;
          requestAnimationFrame(function () {
            queued = false;
            update();
          });
        },
        { passive: true }
      );
      window.addEventListener("resize", measure);
      if (window.ResizeObserver) new ResizeObserver(measure).observe(line);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      measure();
    }
  }
})();
