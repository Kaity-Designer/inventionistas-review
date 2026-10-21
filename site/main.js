/* Inventionistas · site behaviour */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]static\b/.test(location.search);
  var hasGsap = typeof window.gsap !== "undefined";
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
  var riveChars = [];
  if (hasRive) {
    $$("canvas.rivec").forEach(function (canvas) {
      var name = canvas.getAttribute("data-char");
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
    });
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
  function setStage(i) {
    stages.forEach(function (s, k) { s.classList.toggle("is-on", k === i); });
    chars.forEach(function (c, k) { c.classList.toggle("on", k === i); });
    nodes.forEach(function (n, k) { n.classList.toggle("on", k <= i); });
  }
  setStage(0);
  ScrollTrigger.matchMedia({
    "(min-width: 861px) and (min-height: 600px)": function () {
      ScrollTrigger.create({
        trigger: ".loop-pin", start: "top top", end: "+=180%", pin: ".loop-pin", scrub: true,
        onUpdate: function (s) {
          gsap.set(".ring-prog", { strokeDashoffset: 1 - s.progress });
          setStage(Math.min(2, Math.floor(s.progress * 3)));
        }
      });
    },
    "(max-width: 860px), (max-height: 599px)": function () {
      stages.forEach(function (s, i) {
        ScrollTrigger.create({ trigger: s, start: "top 60%", end: "bottom 40%", onToggle: function (st) { if (st.isActive) { setStage(i); gsap.to(".ring-prog", { strokeDashoffset: 1 - (i + 1) / 3, duration: 0.6 }); } } });
      });
    }
  });

  /* ---------- footer wordmark rises ---------- */
  gsap.from(".foot-word", { yPercent: 40, autoAlpha: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".foot", start: "top 90%" } });
})();
