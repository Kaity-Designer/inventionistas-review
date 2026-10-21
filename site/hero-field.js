/* Hero: a living field of disciplines in three.js.
   Nodes drift in depth, the camera leans toward the cursor, nearby nodes get pushed aside
   and the cursor wires itself to its closest fields, whose names light up.
   Click (or tap) sends a ripple and bridges the nearest field to a distant one. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  if (!hero || typeof THREE === "undefined") return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]static\b/.test(location.search);

  var FIELDS = ["Aerodynamics", "Geometry", "Cartography", "Soil science", "Fluid dynamics", "Probability",
    "Music theory", "Color theory", "Economics", "Statistics", "Robotics", "Origami math", "Orbital mechanics",
    "Swarm behavior", "Beekeeping", "Seismology", "Textile weaving", "Linguistics", "Mycology",
    "Battery chemistry", "Epidemiology", "Game theory", "Botany", "Materials science", "Protein folding",
    "Acoustics", "Topology", "Glaciology", "Optics", "Ant colonies", "Typography", "Fermentation"];
  var INK = new THREE.Color(0x16140f), VIOLET = new THREE.Color(0x6d4bf2);

  var wrap = document.createElement("div");
  wrap.className = "hero-field";
  wrap.setAttribute("aria-hidden", "true");
  hero.insertBefore(wrap, hero.firstChild);
  var labelLayer = document.createElement("div");
  labelLayer.className = "hf-labels";
  wrap.appendChild(labelLayer);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  wrap.insertBefore(renderer.domElement, labelLayer);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
  camera.position.set(0, 0, 900);

  var W = 1, H = 1, small = false;
  var N, nodes = [], edges = [];
  var hub, pts, ptGeo, lineGeo, lines, cursorGeo, cursorLines, bridgeGeo, bridgeLine, pulse, halo;

  function dotTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    var t = new THREE.CanvasTexture(c); return t;
  }
  var DOT = dotTexture();

  function seeded(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function build() {
    small = W < 760;
    N = small ? 70 : 150;
    var R = seeded(11);
    // the visible frustum width at z=0
    var vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z, vw = vh * camera.aspect;
    nodes = [];
    for (var i = 0; i < N; i++) {
      var z = (R() - 0.5) * 520;
      var p = new THREE.Vector3((R() - 0.5) * vw * 1.15, (R() - 0.5) * vh * 1.1, z);
      nodes.push({
        home: p.clone(), pos: p.clone(), vel: new THREE.Vector3(),
        ph: R() * Math.PI * 2, sp: 0.25 + R() * 0.5,
        label: i % (small ? 3 : 4) === 0 ? FIELDS[(i / (small ? 3 : 4)) % FIELDS.length] : null,
        el: null, lit: 0, glow: 0
      });
    }
    // two nearest neighbours each, by home position
    edges = [];
    var seen = {};
    nodes.forEach(function (a, i) {
      var best = nodes.map(function (b, j) { return { j: j, d: j === i ? 1e9 : a.home.distanceToSquared(b.home) }; })
        .sort(function (p, q) { return p.d - q.d; }).slice(0, 2);
      best.forEach(function (b) {
        var k = i < b.j ? i + "_" + b.j : b.j + "_" + i;
        if (!seen[k] && b.d < 260 * 260) { seen[k] = 1; edges.push([i, b.j]); }
      });
    });

    scene.clear();
    ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    ptGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    pts = new THREE.Points(ptGeo, new THREE.PointsMaterial({ size: small ? 7 : 8, map: DOT, vertexColors: true, transparent: true, alphaTest: 0.4, sizeAttenuation: true }));
    scene.add(pts);

    lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.13 }));
    scene.add(lines);

    cursorGeo = new THREE.BufferGeometry();
    cursorGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 6), 3));
    cursorLines = new THREE.LineSegments(cursorGeo, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0 }));
    scene.add(cursorLines);

    bridgeGeo = new THREE.BufferGeometry();
    bridgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    bridgeLine = new THREE.Line(bridgeGeo, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.85 }));
    scene.add(bridgeLine);
    pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: VIOLET, transparent: true }));
    pulse.scale.set(10, 10, 1); scene.add(pulse);
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: VIOLET, transparent: true, opacity: 0.18 }));
    halo.scale.set(30, 30, 1); scene.add(halo);
    hub = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: VIOLET, transparent: true, opacity: 0 }));
    hub.scale.set(9, 9, 1); scene.add(hub);

    labelLayer.innerHTML = "";
    nodes.forEach(function (n) {
      if (!n.label) return;
      var s = document.createElement("span");
      s.textContent = n.label;
      labelLayer.appendChild(s);
      n.el = s;
    });
    bridge = null;
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + "px"; renderer.domElement.style.height = H + "px";
    camera.aspect = W / H; camera.updateProjectionMatrix();
    build();
  }

  // pointer, in normalised device coords and as a point on the z=0 plane
  var mouse = new THREE.Vector2(0, 0), target = new THREE.Vector2(0, 0), has = false, mWorld = new THREE.Vector3(), mScreen = { x: -9999, y: -9999 };
  var ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function onMove(e) {
    var r = hero.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < 0 || y > r.height) { has = false; return; }
    has = true; mScreen.x = x; mScreen.y = y;
    target.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
  }
  addEventListener("pointermove", onMove, { passive: true });
  hero.addEventListener("pointerleave", function () { has = false; });

  var bridge = null;
  function project(v) {
    var p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z };
  }
  function labelled() {
    return nodes.map(function (n, i) {
      if (!n.label) return -1;
      var s = project(n.pos);
      return (s.x > W * 0.06 && s.x < W * 0.86 && s.y > H * 0.14 && s.y < H * 0.92) ? i : -1;
    }).filter(function (i) { return i >= 0; });
  }
  function startBridge(a) {
    var L = labelled(); if (L.length < 2) return;
    if (a == null) a = L[Math.floor(Math.random() * L.length)];
    var far = L.filter(function (i) { return i !== a; }).sort(function (p, q) {
      return nodes[q].pos.distanceTo(nodes[a].pos) - nodes[p].pos.distanceTo(nodes[a].pos);
    });
    far = far.slice(0, Math.max(1, Math.ceil(far.length / 3)));
    var b = far[Math.floor(Math.random() * far.length)];
    bridge = { a: a, b: b, t0: performance.now() };
  }
  hero.addEventListener("click", function (e) {
    if (e.target.closest("a,button")) return;
    // ripple from the cursor and bridge from the nearest named field
    ray.setFromCamera(mouse, camera); ray.ray.intersectPlane(plane, mWorld);
    var near = -1, nd = 1e9;
    nodes.forEach(function (n, i) {
      var d = n.pos.distanceTo(mWorld);
      if (d < 420) n.vel.add(n.pos.clone().sub(mWorld).setZ(0).normalize().multiplyScalar((420 - d) * 0.09));
      if (n.label && d < nd) { nd = d; near = i; }
    });
    startBridge(near);
  });

  var visible = true, last = performance.now(), nextAuto = performance.now() + 1200;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(hero);

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now / 1000;
    mouse.lerp(has ? target : new THREE.Vector2(0, 0), 0.08);

    // camera leans toward the cursor
    camera.position.x += (mouse.x * 140 - camera.position.x) * 0.05;
    camera.position.y += (mouse.y * 90 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    ray.setFromCamera(mouse, camera); ray.ray.intersectPlane(plane, mWorld);

    var P = ptGeo.attributes.position.array, C = ptGeo.attributes.color.array;
    var dists = [];
    nodes.forEach(function (n, i) {
      var drift = new THREE.Vector3(Math.sin(t * n.sp + n.ph) * 14, Math.cos(t * n.sp * 0.8 + n.ph) * 10, Math.sin(t * n.sp * 0.6 + n.ph * 2) * 18);
      var goal = n.home.clone().add(drift);
      if (has) {
        var d = Math.hypot(n.pos.x - mWorld.x, n.pos.y - mWorld.y);
        if (d < 170) {
          var push = new THREE.Vector3(n.pos.x - mWorld.x, n.pos.y - mWorld.y, 0).normalize().multiplyScalar((170 - d) * 0.5);
          goal.add(push);
        }
        dists.push({ i: i, d: d });
      }
      n.vel.add(goal.sub(n.pos).multiplyScalar(0.035));
      n.vel.multiplyScalar(0.86);
      n.pos.add(n.vel);
      P[i * 3] = n.pos.x; P[i * 3 + 1] = n.pos.y; P[i * 3 + 2] = n.pos.z;
      n.glow += ((n.lit ? 1 : 0) - n.glow) * 0.12;
      var depth = 0.45 + 0.35 * ((n.pos.z + 260) / 520);
      var c = INK.clone().lerp(new THREE.Color(0xf4f1ea), 1 - depth).lerp(VIOLET, n.glow);
      C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
      n.lit = 0;
    });
    ptGeo.attributes.position.needsUpdate = true; ptGeo.attributes.color.needsUpdate = true;

    var L = lineGeo.attributes.position.array;
    edges.forEach(function (e, k) {
      var a = nodes[e[0]].pos, b = nodes[e[1]].pos;
      L[k * 6] = a.x; L[k * 6 + 1] = a.y; L[k * 6 + 2] = a.z; L[k * 6 + 3] = b.x; L[k * 6 + 4] = b.y; L[k * 6 + 5] = b.z;
    });
    lineGeo.attributes.position.needsUpdate = true;

    // cursor wires to its four nearest fields
    var CL = cursorGeo.attributes.position.array;
    dists.sort(function (p, q) { return p.d - q.d; });
    for (var k = 0; k < 4; k++) {
      var nn = dists[k] && dists[k].d < 320 ? nodes[dists[k].i] : null;
      if (nn) nn.lit = 1;
      CL[k * 6] = mWorld.x; CL[k * 6 + 1] = mWorld.y; CL[k * 6 + 2] = 0;
      CL[k * 6 + 3] = nn ? nn.pos.x : mWorld.x; CL[k * 6 + 4] = nn ? nn.pos.y : mWorld.y; CL[k * 6 + 5] = nn ? nn.pos.z : 0;
    }
    cursorGeo.attributes.position.needsUpdate = true;
    cursorLines.material.opacity += ((has ? 0.55 : 0) - cursorLines.material.opacity) * 0.1;
    hub.position.copy(mWorld); hub.material.opacity = cursorLines.material.opacity * 1.6;

    // travelling bridge between two distant fields
    if (now > nextAuto && !reduce) { startBridge(); nextAuto = now + 3600; }
    if (bridge) {
      var A = nodes[bridge.a], B = nodes[bridge.b];
      A.lit = 1; B.lit = 1;
      var p = Math.min(1, (now - bridge.t0) / 1400), e2 = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var head = A.pos.clone().lerp(B.pos, e2);
      var BA = bridgeGeo.attributes.position.array;
      BA[0] = A.pos.x; BA[1] = A.pos.y; BA[2] = A.pos.z; BA[3] = head.x; BA[4] = head.y; BA[5] = head.z;
      bridgeGeo.attributes.position.needsUpdate = true;
      pulse.position.copy(head); halo.position.copy(head);
      var fade = (now - bridge.t0) > 3000 ? Math.max(0, 1 - ((now - bridge.t0) - 3000) / 500) : 1;
      bridgeLine.material.opacity = 0.85 * fade; pulse.material.opacity = fade; halo.material.opacity = 0.18 * fade;
      if (fade <= 0) bridge = null;
    } else { bridgeLine.material.opacity = 0; pulse.material.opacity = 0; halo.material.opacity = 0; }

    // names: shown near the cursor and on the bridge ends, faint otherwise
    nodes.forEach(function (n) {
      if (!n.el) return;
      var s = project(n.pos);
      var md = has ? Math.hypot(s.x - mScreen.x, s.y - mScreen.y) : 1e9;
      var near = Math.max(0, 1 - md / 260);
      var on = Math.max(near, n.glow);
      n.el.style.transform = "translate3d(" + (s.x + 8).toFixed(1) + "px," + (s.y - 7).toFixed(1) + "px,0)";
      n.el.style.opacity = (0.16 + on * 0.84).toFixed(3);
      n.el.classList.toggle("on", n.glow > 0.5);
    });

    renderer.render(scene, camera);
  }

  function loop(now) {
    if (visible) frame(now);
    requestAnimationFrame(loop);
  }

  resize();
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  if (reduce) { var n0 = performance.now(); startBridge(); if (bridge) bridge.t0 = n0 - 1400; frame(n0); }
  else requestAnimationFrame(loop);
})();
