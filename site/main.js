/* Inventionistas · site behaviour */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]static\b/.test(location.search);
  var hasGsap = typeof window.gsap !== "undefined";
  var yr = document.querySelector(".foot-copy .yr"); if (yr) yr.textContent = new Date().getFullYear();
  var hasRive = typeof window.rive !== "undefined";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);


  /* ---------- fit: big type runs exactly edge to edge ---------- */
  function fitAll() {
    $$(".fit").forEach(function (el) {
      var box = el.parentElement, cs = getComputedStyle(box);
      var avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      el.style.fontSize = "100px";
      var w = el.scrollWidth;
      if (el.classList.contains("hero-title")) { w = 0; $$(".ln", el).forEach(function (l) { w = Math.max(w, l.scrollWidth); }); }
      el.style.fontSize = Math.floor(100 * avail / w * 0.995) + "px";
    });
  }
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener("resize", function () { clearTimeout(fitAll._t); fitAll._t = setTimeout(function () { fitAll(); if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 120); });

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (!reduce && window.Lenis && hasGsap) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        var el = id === "#top" ? 0 : $(id);
        if (el === null) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: id === "#top" ? 0 : -60 });
      });
    });
  }

  /* ---------- nav: solid after hero, hides on scroll down ---------- */
  var nav = $("#nav"), lastY = 0;
  function onScroll(y) {
    nav.classList.toggle("solid", y > 40);
    if (y > 400 && y > lastY + 4) nav.classList.add("hidden");
    else if (y < lastY - 4 || y < 400) nav.classList.remove("hidden");
    lastY = y;
  }
  if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll); });
  else window.addEventListener("scroll", function () { onScroll(window.scrollY); }, { passive: true });

  /* ---------- thesis: split into words for the scroll reveal ---------- */
  var lead = $(".thesis-lead");
  if (lead && !reduce) {
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement("span"); s.className = "wd"; s.textContent = t; frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) split(n);
      });
    })(lead);
  }

  /* ---------- contact form ---------- */
  var f = $("#cform");
  if (f) {
    var st = $("#cstatus"), btn = $("#csubmit");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = { name: f.name.value.trim(), email: f.email.value.trim(), message: f.message.value.trim() };
      if (!data.name || !data.email || !data.message) { st.textContent = "Please fill in every field."; st.className = "form-status mono err"; return; }
      btn.disabled = true; st.textContent = "Sending..."; st.className = "form-status mono";
      fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error("bad"); })
        .then(function () { st.textContent = "Thank you. We will be in touch."; st.className = "form-status mono ok"; f.reset(); })
        .catch(function () { st.innerHTML = 'Could not send right now. Email <a href="mailto:founders@inventionistas.com">founders@inventionistas.com</a>'; st.className = "form-status mono err"; })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- characters (Rive, their own hover and click listeners live in each file) ---------- */
  var CREW = { sparky: [461, 612], gritty: [420, 504], brainy: [542, 603], zap: [429, 551], tinker: [432, 475] };
  var CREW_NAMES = Object.keys(CREW);
  function pickCrew(not) {
    var pool = CREW_NAMES.filter(function (n) { return (not || []).indexOf(n) < 0; });
    return pool[Math.floor(Math.random() * pool.length)];
  }
  var riveChars = [];
  function mountChar(canvas, name) {
    if (canvas._rive) { try { canvas._rive.cleanup(); } catch (e) {} riveChars.splice(riveChars.indexOf(canvas._rive), 1); }
    var dims = CREW[name];
    canvas.setAttribute("data-char", name);
    canvas.setAttribute("aria-label", name.charAt(0).toUpperCase() + name.slice(1));
    canvas.width = dims[0]; canvas.height = dims[1];
    canvas.style.setProperty("--ar", dims[0] + "/" + dims[1]);
    try {
      var r = new rive.Rive({
        src: "assets/rive/crew/" + name + ".riv",
        canvas: canvas,
        artboard: name,
        stateMachines: "sm",
        autoplay: !reduce,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.BottomCenter }),
        onLoad: function () { try { r.resizeDrawingSurfaceToCanvas(); } catch (e) {} }
      });
      canvas._rive = r; riveChars.push(r);
    } catch (e) {}
  }
  window.__mountChar = mountChar;

  // random motion: each monster now and then pokes itself or perks up, on its own schedule
  function inputsOf(canvas) {
    var r = canvas._rive, out = {};
    try { (r.stateMachineInputs("sm") || []).forEach(function (i) { out[i.name] = i; }); } catch (e) {}
    return out;
  }
  function wander(canvas) {
    if (reduce) return;
    var userOn = false;
    canvas.addEventListener("pointerenter", function () { userOn = true; });
    canvas.addEventListener("pointerleave", function () { userOn = false; });
    (function next() {
      setTimeout(function () {
        var vis = canvas.getBoundingClientRect(), shown = vis.bottom > 0 && vis.top < innerHeight && canvas.offsetParent !== null;
        var span = canvas.closest(".loop-word span");
        if (span && !span.classList.contains("on")) shown = false;
        if (shown && !userOn && !document.hidden) {
          var ins = inputsOf(canvas);
          if (Math.random() < 0.5 && ins.poke) ins.poke.fire();
          else if (ins.hover) { ins.hover.value = true; setTimeout(function () { if (!userOn) ins.hover.value = false; }, 900 + Math.random() * 1400); }
        }
        next();
      }, 2600 + Math.random() * 5200);
    })();
  }
  window.__pickCrew = pickCrew;
  if (hasRive) {
    $$("canvas.rivec").forEach(function (canvas) { mountChar(canvas, canvas.getAttribute("data-char")); wander(canvas); });
    if ("IntersectionObserver" in window && !reduce) {
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var r = e.target._rive; if (!r) return; try { e.isIntersecting ? r.play() : r.pause(); } catch (err) {} });
      }, { threshold: 0.05 });
      $$("canvas.rivec").forEach(function (c) { cio.observe(c); });
    }
    var crt;
    window.addEventListener("resize", function () {
      clearTimeout(crt);
      crt = setTimeout(function () { riveChars.forEach(function (r) { try { r.resizeDrawingSurfaceToCanvas(); } catch (e) {} }); }, 160);
    });
  }


  /* ---------- thesis illustration: Sparky rides the chart past the nearest hill ---------- */
  (function () {
    var fig = $(".hill-fig"); if (!fig) return;
    var svg = $(".hill-svg", fig), path = $(".hill-line", fig), rider = $(".hill-rider", fig), star = $(".peak-star", fig);
    var marks = $$(".hill-marks circle", fig);
    var L = path.getTotalLength(), poked = false, rode = false, lastP = 0;

    var markAt = marks.map(function (m) {
      var cx = +m.getAttribute("cx"), best = 0, bd = 1e9;
      for (var t = 0; t <= 1; t += 0.005) { var q = path.getPointAtLength(t * L); var d = Math.abs(q.x - cx); if (d < bd) { bd = d; best = t; } }
      return best;
    });
    function place(p) {
      p = Math.max(0, Math.min(1, p)); lastP = p;
      path.style.strokeDashoffset = 1 - p;
      var a = path.getPointAtLength(p * L), b = path.getPointAtLength(Math.min(L, p * L + 6)), b0 = path.getPointAtLength(Math.max(0, p * L - 6));
      var stage = rider.parentNode, sw = stage.offsetWidth, fw = fig.clientWidth;
      var k = sw / 1200;
      if (sw > fw + 2) {
        var tx = Math.max(fw - sw, Math.min(0, fw * 0.45 - a.x * k));
        stage.style.transform = "translateX(" + tx.toFixed(1) + "px)";
      } else stage.style.transform = "";
      var ang = Math.atan2(b.y - b0.y, b.x - b0.x) * 180 / Math.PI;
      var w = rider.offsetWidth, h = rider.offsetHeight;
      rider.style.transform = "translate(" + (a.x * k - w / 2) + "px," + (a.y * k - h + 4) + "px) rotate(" + (ang * 0.55).toFixed(2) + "deg)";
      marks.forEach(function (m, i) { m.classList.toggle("on", p >= markAt[i]); });
      var sp = Math.max(0, (p - 0.94) / 0.06);
      star.style.transform = "scale(" + sp + ") rotate(" + ((1 - sp) * -120) + "deg)";
      var oldco = $(".oldco", fig);
      oldco.classList.toggle("aware", p > 0.97);
      if (p > 0.985 && !poked) {
        poked = true;
        var r = rider._rive;
        try { (r.stateMachineInputs("sm") || []).forEach(function (i) { if (i.name === "poke") i.fire(); }); } catch (e) {}
      }
      if (p < 0.9) poked = false;
    }
    window.__hillPlace = place;
    if (reduce || !hasGsap) { place(1); addEventListener("resize", function () { place(1); }); return; }
    place(0);
    // locked while you scroll through it; if you stop, it plays itself and replays
    var scrollP = 0, shown = 0, autoP = 0, auto = false, lastScroll = performance.now(), holdUntil = 0, hillST;
    hillST = ScrollTrigger.create({
      trigger: fig, start: "center 52%", end: "+=140%", pin: true, scrub: true,
      onUpdate: function (s) { scrollP = s.progress; lastScroll = performance.now(); if (auto) { auto = false; } },
      onRefresh: function (s) { scrollP = s.progress; }
    });
    var tPrev = performance.now();
    (function tick(now) {
      var dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now;
      if (hillST.isActive && !auto && now - lastScroll > 1400) { auto = true; autoP = shown; holdUntil = 0; }
      if (!hillST.isActive) auto = false;
      var target = scrollP;
      if (auto) {
        if (autoP < 1) { autoP = Math.min(1, autoP + dt / 3.6); if (autoP >= 1) holdUntil = now + 2600; }
        else if (holdUntil && now > holdUntil) { autoP = 0; shown = 0; holdUntil = 0; }
        target = autoP;
      }
      shown += (target - shown) * (auto ? 0.5 : 0.18);
      if (Math.abs(target - shown) < 0.0005) shown = target;
      place(shown);
      requestAnimationFrame(tick);
    })(tPrev);
    addEventListener("resize", function () { place(shown); });
  })();

  /* everything below is motion */
  var loader = $("#loader");
  if (reduce || !hasGsap) {
    if (loader) loader.remove();
    $$(".loop-word span")[0] && $$(".loop-word span")[0].classList.add("on");
    var n0 = $$(".ring-nodes circle")[0]; if (n0) n0.classList.add("on");
    return;
  }

  /* ---------- hero intro (runs after the loader) ---------- */
  gsap.set(".hero-title .w", { yPercent: 110 });
  gsap.set(".hero-mark .draw", { strokeDashoffset: 1 });
  gsap.set(".hero-mark .spark", { scale: 0, rotation: -120 });
  gsap.set([".hero-meta", ".hero-foot", ".fig"], { autoAlpha: 0, y: 14 });

  function heroIn() {
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(".hero-title .w", { yPercent: 0, duration: 1.25, stagger: 0.09 }, 0)
      .to(".hero-mark .draw", { strokeDashoffset: 0, duration: 0.9, stagger: 0.12, ease: "power2.inOut", onComplete: function () { gsap.set(".hero-mark .draw", { strokeDasharray: "none" }); } }, 0.35)
      .to(".hero-mark .spark", { scale: 1, rotation: 0, duration: 0.9, ease: "back.out(2.4)" }, 1.0)
      .to([".hero-meta", ".fig", ".hero-foot"], { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.6);
    // the spark keeps breathing
    gsap.to(".hero-mark .spark", { scale: 1.09, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.2 });
  }

  /* ---------- loader ---------- */
  var started = Date.now(), done = false;
  function closeLoader() {
    if (done) return; done = true;
    var wait = Math.max(0, 1900 - (Date.now() - started));
    setTimeout(function () {
      gsap.to(loader, { yPercent: -100, duration: 0.9, ease: "expo.inOut", onComplete: function () { loader.remove(); if (lenis) lenis.start(); } });
      gsap.delayedCall(0.35, heroIn);
    }, wait);
  }
  if (lenis) lenis.stop();
  if (hasRive) {
    try {
      new rive.Rive({
        src: "assets/rive/bulb-loader.riv",
        canvas: $("#loader-riv"),
        artboard: "loader",
        stateMachines: "loader",
        autoplay: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain }),
        onLoad: function () { try { this.resizeDrawingSurfaceToCanvas(); } catch (e) {} },
        onLoadError: function () { document.documentElement.classList.add("no-rive"); fallbackLoader(); }
      });
    } catch (e) { document.documentElement.classList.add("no-rive"); fallbackLoader(); }
  } else { document.documentElement.classList.add("no-rive"); fallbackLoader(); }

  function fallbackLoader() {
    gsap.fromTo(".loader-fallback", { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2)" });
    gsap.fromTo(".loader-fallback .spark", { scale: 0, rotation: -180, transformOrigin: "50% 50%" }, { scale: 1, rotation: 0, duration: 0.8, delay: 0.3, ease: "back.out(2.6)" });
  }
  window.addEventListener("load", closeLoader);
  setTimeout(closeLoader, 4200); // never hold the page hostage

  /* ---------- marquee: drifts, speeds up with scroll ---------- */
  var track = $(".marquee-track");
  if (track) {
    track.appendChild(track.firstElementChild.cloneNode(true));
    var mq = gsap.to(track, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
    ScrollTrigger.create({
      trigger: ".marquee", start: "top bottom", end: "bottom top",
      onUpdate: function (s) {
        var v = Math.min(Math.abs(s.getVelocity()) / 400, 6);
        gsap.to(mq, { timeScale: (s.direction < 0 ? -1 : 1) * (1 + v), duration: 0.3, overwrite: true });
        gsap.to(mq, { timeScale: s.direction < 0 ? -1 : 1, duration: 1.2, delay: 0.3, overwrite: false });
      }
    });
  }

  /* ---------- thesis words light up as you scroll ---------- */
  gsap.to(".thesis-lead .wd", {
    opacity: 1, stagger: 0.05, ease: "none",
    scrollTrigger: { trigger: ".thesis-lead", start: "top 82%", end: "bottom 45%", scrub: true }
  });
  gsap.from(".thesis-body p", { y: 30, autoAlpha: 0, stagger: 0.12, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".thesis-body", start: "top 85%" } });

  /* ---------- section labels + big titles rise in ---------- */
  $$(".sec-label, .loop-title, .contact-title").forEach(function (el) {
    gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });

  /* ---------- principles: lines slide in from the sides ---------- */
  $$(".pr").forEach(function (pr, i) {
    gsap.from($$("h3 span", pr), {
      xPercent: i ? 12 : -12, autoAlpha: 0, stagger: 0.1, duration: 1.2, ease: "expo.out",
      scrollTrigger: { trigger: pr, start: "top 75%" }
    });
    gsap.from($(".pr-body", pr), { y: 30, autoAlpha: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: pr, start: "top 60%" } });
  });


  /* ---------- the loop: pinned on desktop, the stage follows the scroll ---------- */
  var stages = $$(".stage"), chars = $$(".loop-word span"), nodes = $$(".ring-nodes circle");
  var lpFill = $(".lp-fill"), lcN = $(".loop-count .lc-n"), loopST = null;
  function setStage(i) {
    stages.forEach(function (s, k) { s.classList.toggle("is-on", k === i); });
    chars.forEach(function (c, k) { c.classList.toggle("on", k === i); });
    nodes.forEach(function (n, k) { n.classList.toggle("on", k <= i); });
    if (lcN) lcN.textContent = "0" + (i + 1);
  }
  function setTrack(p) { if (lpFill) lpFill.style.transform = "scaleY(" + p + ")"; }
  setStage(0);
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }
  function jumpStage(i) {
    if (loopST && loopST.isActive !== undefined && loopST.enabled !== false && loopST.pin) {
      scrollToY(loopST.start + ((i + 0.5) / 3) * (loopST.end - loopST.start));
    } else {
      scrollToY(stages[i].getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3);
    }
  }
  $$(".stage-hit").forEach(function (b) { b.addEventListener("click", function () { jumpStage(+b.getAttribute("data-go")); }); });
  nodes.forEach(function (n, k) { n.addEventListener("click", function () { jumpStage(k); }); });
  ScrollTrigger.matchMedia({
    "(min-width: 861px) and (min-height: 600px)": function () {
      loopST = ScrollTrigger.create({
        trigger: ".loop-pin", start: "top top", end: "+=180%", pin: ".loop-pin", scrub: true,
        onUpdate: function (s) {
          gsap.set(".ring-prog", { strokeDashoffset: 1 - s.progress });
          setTrack(s.progress);
          setStage(Math.min(2, Math.floor(s.progress * 3)));
        }
      });
      return function () { loopST = null; };
    },
    "(max-width: 860px), (max-height: 599px)": function () {
      stages.forEach(function (s, i) {
        ScrollTrigger.create({ trigger: s, start: "top 60%", end: "bottom 40%", onToggle: function (st) { if (st.isActive) { setStage(i); setTrack((i + 1) / 3); gsap.to(".ring-prog", { strokeDashoffset: 1 - (i + 1) / 3, duration: 0.6 }); } } });
      });
    }
  });

  /* ---------- page scroll indicator ---------- */
  var pp = $(".page-progress span");
  if (pp) ScrollTrigger.create({ start: 0, end: "max", onUpdate: function (s) { pp.style.transform = "scaleX(" + s.progress.toFixed(4) + ")"; } });

  /* ---------- footer wordmark rises ---------- */
  gsap.from(".foot-word", { yPercent: 40, autoAlpha: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".foot", start: "top 90%" } });
})();
