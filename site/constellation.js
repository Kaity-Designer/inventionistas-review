/* Field constellation: distant disciplines as dots and thin lines.
   Every few seconds one violet bridge links two far apart fields and a pulse travels along it.
   Hovering a field links it to a distant one straight away. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var FIELDS = ["Aerodynamics", "Geometry", "Cartography", "Soil science", "Fluid dynamics", "Probability",
    "Music theory", "Color theory", "Economics", "Statistics", "Robotics", "Origami math", "Orbital mechanics",
    "Swarm behavior", "Beekeeping", "Seismology", "Textile weaving", "Linguistics", "Mycology",
    "Battery chemistry", "Epidemiology", "Game theory", "Botany", "Materials science", "Protein folding",
    "Acoustics", "Topology", "Glaciology", "Optics", "Ant colonies", "Typography", "Fermentation"];
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]static\b/.test(location.search);

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function build(svg) {
    var allLabels = svg.getAttribute("data-labels") === "all";
    var W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H) return null;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var R = rng(allLabels ? 7 : 31);
    var small = W < 700;
    var cw = small ? 190 : 300, ch = small ? 210 : 250;
    var cols = Math.max(2, Math.round(W / cw)), rows = Math.max(2, Math.round(H / ch));
    var nodes = [], edges = [], clusters = [];
    var sb = svg.getBoundingClientRect(), avoid = [];
    var sel = svg.getAttribute("data-avoid");
    if (sel) svg.parentNode.querySelectorAll(sel).forEach(function (e) {
      var b = e.getBoundingClientRect();
      if (b.width) avoid.push({ l: b.left - sb.left - 10, t: b.top - sb.top - 8, r: b.right - sb.left + 10, b: b.bottom - sb.top + 8 });
    });
    var topBand = +(svg.getAttribute("data-top") || 0);
    function clear(x, y, lab) {
      if (y < topBand) return false;
      var w = lab.length * 7.4 + 14, right = x < W - 150;
      var l = right ? x - 4 : x - w, r = right ? x + w : x + 4;
      for (var q = 0; q < avoid.length; q++) {
        var A = avoid[q];
        if (r > A.l && l < A.r && y + 7 > A.t && y - 9 < A.b) return false;
      }
      avoid.push({ l: l - 6, t: y - 12, r: r + 6, b: y + 10 });
      return true;
    }
    var fi = Math.floor(R() * FIELDS.length);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cx = (c + 0.5) * (W / cols) + (R() - 0.5) * (W / cols) * 0.35;
      var cy = (r + 0.5) * (H / rows) + (R() - 0.5) * (H / rows) * 0.35;
      var n = 3 + Math.floor(R() * 3), ids = [];
      for (var i = 0; i < n; i++) {
        var a = R() * Math.PI * 2, d = 20 + R() * (small ? 70 : 105);
        var x = Math.min(W - 12, Math.max(12, cx + Math.cos(a) * d * 1.3));
        var y = Math.min(H - 12, Math.max(12, cy + Math.sin(a) * d));
        var lab = (allLabels ? R() < 0.62 : R() < 0.5) ? FIELDS[fi % FIELDS.length] : null;
        if (lab && !clear(x, y, lab.toUpperCase())) lab = null;
        if (lab) fi++;
        ids.push(nodes.length);
        nodes.push({ x: x, y: y, label: lab, cl: clusters.length });
      }
      clusters.push(ids);
    }
    function link(a, b) {
      if (a === b) return;
      for (var k = 0; k < edges.length; k++) if ((edges[k][0] === a && edges[k][1] === b) || (edges[k][0] === b && edges[k][1] === a)) return;
      edges.push([a, b]);
    }
    clusters.forEach(function (ids) {
      ids.forEach(function (a) {
        var near = ids.filter(function (b) { return b !== a; }).sort(function (p, q) {
          return dist(nodes[a], nodes[p]) - dist(nodes[a], nodes[q]);
        });
        near.slice(0, 2).forEach(function (b) { link(a, b); });
      });
    });
    // a few quiet links between neighbouring clusters
    for (var k = 0; k < clusters.length; k++) {
      if (R() < 0.45 && k + 1 < clusters.length) link(clusters[k][0], clusters[k + 1][1 % clusters[k + 1].length]);
    }

    var gE = el("g", { class: "c-edges" }, svg);
    var gB = el("g", { class: "c-bridges" }, svg);
    var gN = el("g", { class: "c-nodes" }, svg);
    edges.forEach(function (e) {
      el("line", { x1: nodes[e[0]].x, y1: nodes[e[0]].y, x2: nodes[e[1]].x, y2: nodes[e[1]].y }, gE);
    });
    nodes.forEach(function (n, i) {
      var g = el("g", { class: "c-node" + (n.label ? " has-label" : "") }, gN);
      el("circle", { cx: n.x, cy: n.y, r: n.label ? 2.6 : 1.8 }, g);
      if (n.label) {
        var right = n.x < W - 150;
        var t = el("text", { x: n.x + (right ? 8 : -8), y: n.y + 3.5, "text-anchor": right ? "start" : "end" }, g);
        t.textContent = n.label.toUpperCase();
        // generous invisible hit area
        el("circle", { cx: n.x, cy: n.y, r: 16, class: "c-hit" }, g);
      }
      n.g = g;
    });
    return { svg: svg, nodes: nodes, gB: gB, W: W, H: H };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function bridge(m, a, b, onTo) {
    var A = m.nodes[a], B = m.nodes[b];
    m.nodes.forEach(function (n) { n.g.classList.remove("lit"); });
    while (m.gB.firstChild) m.gB.removeChild(m.gB.firstChild);
    A.g.classList.add("lit"); B.g.classList.add("lit");
    var len = dist(A, B);
    var line = el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "c-bridge" }, m.gB);
    var halo = el("circle", { cx: A.x, cy: A.y, r: 9, class: "c-halo" }, m.gB);
    var dot = el("circle", { cx: A.x, cy: A.y, r: 3.2, class: "c-pulse" }, m.gB);
    if (onTo) onTo(A.label, B.label);
    if (reduce) { line.style.strokeDashoffset = 0; halo.setAttribute("cx", (A.x + B.x) / 2); halo.setAttribute("cy", (A.y + B.y) / 2); dot.setAttribute("cx", (A.x + B.x) / 2); dot.setAttribute("cy", (A.y + B.y) / 2); return; }
    line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
    var t0 = performance.now(), D = 1300;
    (function step(now) {
      var p = Math.min(1, (now - t0) / D), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      line.style.strokeDashoffset = len * (1 - e);
      var x = A.x + (B.x - A.x) * e, y = A.y + (B.y - A.y) * e;
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      halo.setAttribute("cx", x); halo.setAttribute("cy", y);
      if (p < 1 && line.isConnected) requestAnimationFrame(step);
    })(t0);
  }

  function mount(svg) {
    var readout = svg.parentNode.querySelector(".map-readout");
    var m = null, timer = null, visible = false, hold = 0;
    function labelled() { return m.nodes.map(function (n, i) { return n.label ? i : -1; }).filter(function (i) { return i >= 0; }); }
    function far(from) {
      var L = labelled().filter(function (i) { return m.nodes[i].cl !== m.nodes[from].cl; });
      L.sort(function (p, q) { return dist(m.nodes[q], m.nodes[from]) - dist(m.nodes[p], m.nodes[from]); });
      var top = L.slice(0, Math.max(1, Math.ceil(L.length / 3)));
      return top[Math.floor(Math.random() * top.length)];
    }
    function say(a, b) {
      if (!readout) return;
      readout.querySelector(".ro-a").textContent = a;
      readout.querySelector(".ro-b").textContent = b;
      readout.classList.remove("flash"); void readout.offsetWidth; readout.classList.add("flash");
    }
    function auto() {
      if (!m || !visible || Date.now() < hold) return;
      var L = labelled(); if (L.length < 2) return;
      var a = L[Math.floor(Math.random() * L.length)];
      bridge(m, a, far(a), say);
    }
    function init() {
      m = build(svg); if (!m) return;
      m.nodes.forEach(function (n, i) {
        if (!n.label) return;
        n.g.addEventListener("mouseenter", function () { hold = Date.now() + 2600; bridge(m, i, far(i), say); });
      });
      var L = labelled();
      if (L.length > 1) { var a0 = L[0]; bridge(m, a0, far(a0), say); }
    }
    init();
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(init, 200); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.1 }).observe(svg);
    } else visible = true;
    if (!reduce) timer = setInterval(auto, svg.classList.contains("hero-const") ? 4200 : 3000);
  }

  function start() { document.querySelectorAll("svg.constellation").forEach(mount); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else addEventListener("load", start);
})();
