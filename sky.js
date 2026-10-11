/* ذَكِّر — living sky
 * One canvas behind the whole app. Dawn for الصباح, night for المساء.
 * Reacts to touch / mouse / scroll / device tilt. Exposes window.ThakirSky.
 */
(function () {
  'use strict';
  var cv = document.getElementById('sky');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d', { alpha: false });
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var W = 0, H = 0, DPR = 1, t = 0, last = 0, raf = 0, running = false;
  var mode = 'morning', mix = 0, mixTarget = 0;           // mix: 0 = dawn, 1 = night
  var ptr = { px: 0, py: 0, x: .5, y: .4, sx: .5, sy: .4, active: 0, down: false, dx: 0, dy: 0, dt: 0, tr: 0 };
  var tilt = { x: 0, y: 0, sx: 0, sy: 0 };
  var scrollY = 0, quality = 1, frames = 0, slow = 0;
  var stars = [], motes = [], clouds = [], parts = [], rings = [], meteors = [], nextMeteor = 4;
  var sprites = {}, skyline = null;

  try { mode = localStorage.getItem('thakir-mode') === 'evening' ? 'evening' : 'morning'; } catch (e) {}
  mix = mixTarget = mode === 'evening' ? 1 : 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mixc(a, b, k) {
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')';
  }
  var DAWN = ['#0a2756', '#35559c', '#b9737f', '#f4b97c'].map(hex);
  var NIGHT = ['#030b1c', '#071a35', '#131a42', '#241c52'].map(hex);
  var STOPS = [0, .45, .78, 1];

  /* ---------- sprites (pre-rendered once per resize) ---------- */
  function sprite(w, h, fn) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    var g = c.getContext('2d'); g.scale(DPR, DPR); fn(g, w, h); return c;
  }
  function glow(r, g, b) {
    return sprite(48, 48, function (c) {
      var gr = c.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
      gr.addColorStop(.25, 'rgba(' + r + ',' + g + ',' + b + ',.38)');
      gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      c.fillStyle = gr; c.fillRect(0, 0, 48, 48);
    });
  }
  function cloud(tint) {
    return sprite(280, 120, function (g) {
      for (var k = 0; k < 9; k++) {
        var x = 50 + k * 23 + rnd(-8, 8), y = 62 + rnd(-18, 12), r = rnd(22, 40);
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(' + tint + ',.55)'); gr.addColorStop(1, 'rgba(' + tint + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      }
    });
  }
  function buildSkyline() {
    var gh = clamp(H * .16, 90, 150), wins = [], seed = 7;
    function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var sp = sprite(W, gh, function (g) {
      g.fillStyle = '#050c1f';
      var x = 0;
      while (x < W) {
        var w = 14 + r() * 30, h = 12 + r() * 34, k = r();
        g.fillRect(x, gh - h, w, h);
        if (k < .28) { g.beginPath(); g.arc(x + w / 2, gh - h, w / 2, Math.PI, 0); g.fill(); }
        else if (k < .5) { g.beginPath(); g.moveTo(x, gh - h); g.lineTo(x + w / 2, gh - h - w * .35); g.lineTo(x + w, gh - h); g.fill(); }
        if (r() < .5) wins.push({ x: x + w * .3 + r() * w * .3, y: gh - h * (.25 + r() * .5), ph: r() * 6.28, sz: 2 + r() * 1.2 });
        x += w + r() * 4;
      }
      function mosque(cx, sc) {
        var bw = 110 * sc, bh = 34 * sc;
        g.fillRect(cx - bw / 2, gh - bh, bw, bh);
        g.beginPath(); g.arc(cx, gh - bh, 34 * sc, Math.PI, 0); g.fill();
        g.fillRect(cx - 2 * sc, gh - bh - 34 * sc - 16 * sc, 4 * sc, 16 * sc);
        g.beginPath(); g.arc(cx - bw / 2 + 14 * sc, gh - bh, 14 * sc, Math.PI, 0); g.fill();
        g.beginPath(); g.arc(cx + bw / 2 - 14 * sc, gh - bh, 14 * sc, Math.PI, 0); g.fill();
        [-1, 1].forEach(function (s) {
          var mx = cx + s * (bw / 2 + 18 * sc);
          g.fillRect(mx - 5 * sc, gh - 96 * sc, 10 * sc, 96 * sc);
          g.fillRect(mx - 8 * sc, gh - 96 * sc, 16 * sc, 5 * sc);
          g.beginPath(); g.moveTo(mx - 6 * sc, gh - 96 * sc); g.lineTo(mx, gh - 120 * sc); g.lineTo(mx + 6 * sc, gh - 96 * sc); g.fill();
          wins.push({ x: mx - 1, y: gh - 70 * sc, ph: r() * 6, sz: 2.2 });
        });
        wins.push({ x: cx - 1, y: gh - bh * .6, ph: 1.3, sz: 2.4 });
      }
      var sc = clamp(W / 520, .7, 1.25);
      mosque(W * .3, sc); mosque(W * .78, sc * .8);
    });
    return { sp: sp, gh: gh, wins: wins };
  }
  function buildSprites() {
    sprites.glowGold = glow(255, 214, 128);
    sprites.glowCool = glow(170, 200, 255);
    sprites.glowWarm = glow(255, 236, 190);
    sprites.moon = sprite(120, 120, function (g) {
      var gr = g.createLinearGradient(20, 20, 100, 100);
      gr.addColorStop(0, '#fff6d6'); gr.addColorStop(1, '#ffe2a0');
      g.fillStyle = gr; g.beginPath(); g.arc(60, 60, 42, 0, 6.283); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(82, 46, 38, 0, 6.283); g.fill();
    });
    sprites.clouds = [cloud('255,255,255'), cloud('255,214,200'), cloud('255,255,255')];
    skyline = buildSkyline();
  }

  /* ---------- scene setup ---------- */
  function initStars() {
    var n = Math.round(clamp(W * H / 8500, 55, 150));
    var cols = ['#ffffff', '#cfe3ff', '#ffeab8', '#e3d4ff'];
    stars = [];
    for (var i = 0; i < n; i++) {
      var z = rnd(.2, 1);
      stars.push({ x: Math.random(), y: Math.random() * .92, z: z, r: .5 + z * 1.1, sp: rnd(.6, 2.4), ph: rnd(0, 6.28), c: cols[(Math.random() * cols.length) | 0] });
    }
  }
  function initMotes() {
    var n = Math.round(clamp(W * H / 16000, 16, 40));
    motes = [];
    for (var i = 0; i < n; i++) motes.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-6, 6), vy: rnd(-6, 6), ph: rnd(0, 6.28), s: rnd(.8, 1.6), z: rnd(.6, 1.4) });
  }
  function initClouds() {
    clouds = [];
    for (var i = 0; i < 6; i++) clouds.push({ sp: i % 3, x: rnd(-100, W), y: rnd(H * .1, H * .6), s: rnd(.8, 1.5), v: rnd(4, 11) });
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildSprites();
    if (!stars.length) initStars();
    if (!motes.length) initMotes(); else motes.forEach(function (p) { p.x = clamp(p.x, 0, W); p.y = clamp(p.y, 0, H); });
    if (!clouds.length) initClouds();
    if (reduce) drawStatic();
  }

  /* ---------- drawing ---------- */
  function drawNebula(m) {
    var a = .16 * m; if (a < .01) return;
    ctx.globalCompositeOperation = 'lighter';
    var cols = ['120,100,255', '70,150,255', '190,90,255'];
    for (var i = 0; i < 3; i++) {
      var x = W * (.2 + .3 * i) + Math.sin(t * .05 + i * 2) * 60, y = H * (.25 + .2 * ((i + 1) % 3)) + Math.cos(t * .04 + i) * 40, r = Math.max(W, H) * .42;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + cols[i] + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + cols[i] + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawClouds(dt, m, ox) {
    var a = (1 - m) * .85; if (a < .02) return;
    ctx.globalAlpha = a;
    var n = Math.ceil(clouds.length * quality);
    for (var i = 0; i < n; i++) {
      var c = clouds[i]; c.x += c.v * dt;
      var w = 280 * c.s, h = 120 * c.s;
      if (c.x > W + 40) { c.x = -w; c.y = rnd(H * .1, H * .6); }
      ctx.drawImage(sprites.clouds[c.sp], c.x - ox * 20 * c.s, c.y - scrollY * .03 * c.s, w, h);
    }
    ctx.globalAlpha = 1;
  }
  function drawStars(m, ox, oy) {
    var a0 = .16 + .84 * m;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = .55 + .45 * Math.sin(t * s.sp + s.ph);
      var al = a0 * tw * (.35 + .65 * s.z) * (1 - (1 - m) * s.y * 1.1);
      if (al < .02) continue;
      var x = (((s.x * W - ox * s.z * 26) % W) + W) % W, y = (((s.y * H - oy * s.z * 18 - scrollY * s.z * .05) % H) + H) % H;
      ctx.globalAlpha = al; ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
      if (s.z > .85 && tw > .92) { ctx.fillRect(x - s.r * 3, y - .4, s.r * 6, .8); ctx.fillRect(x - .4, y - s.r * 3, .8, s.r * 6); }
    }
    ctx.globalAlpha = 1;
  }
  function sun(x, y, v) {
    var pulse = 1 + Math.sin(t * 1.2) * .05;
    ctx.save(); ctx.globalAlpha = v; ctx.globalCompositeOperation = 'lighter';
    var gr = ctx.createRadialGradient(x, y, 0, x, y, 150 * pulse);
    gr.addColorStop(0, 'rgba(255,214,140,.32)'); gr.addColorStop(.35, 'rgba(255,170,100,.2)'); gr.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 150 * pulse, 0, 6.283); ctx.fill();
    ctx.translate(x, y); ctx.rotate(t * .04);
    for (var i = 0; i < 14; i++) {
      ctx.rotate(6.283 / 14);
      ctx.fillStyle = 'rgba(255,226,160,' + (.035 + .02 * Math.sin(t * 1.5 + i)) + ')';
      ctx.beginPath(); ctx.moveTo(-3, 40); ctx.lineTo(0, 150 + (i % 2) * 30); ctx.lineTo(3, 40); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = v;
    var c = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 32);
    c.addColorStop(0, '#fff8d6'); c.addColorStop(1, '#ffc766');
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 22, 0, 6.283); ctx.fill(); ctx.restore();
  }
  function moon(x, y, v) {
    var pulse = 1 + Math.sin(t * .9) * .06;
    ctx.save(); ctx.globalAlpha = v * .9; ctx.globalCompositeOperation = 'lighter';
    var gr = ctx.createRadialGradient(x, y, 10, x, y, 120 * pulse);
    gr.addColorStop(0, 'rgba(255,240,190,.28)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 120 * pulse, 0, 6.283); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = v; ctx.translate(x, y); ctx.rotate(Math.sin(t * .5) * .04);
    ctx.drawImage(sprites.moon, -60, -60, 120, 120); ctx.restore();
  }
  function drawBodies(m, ox, oy) {
    var bx = W * .17 - ox * 14, by = Math.max(105, H * .14) - oy * 8, sv = 1 - m, mv = m;
    if (sv > .01) sun(bx, by + (1 - sv) * H * .4, sv);
    if (mv > .01) moon(bx, by + (1 - mv) * H * .4 + Math.sin(t * .6) * 3, mv);
  }
  function drawHorizon(m) {
    ctx.globalCompositeOperation = 'lighter';
    var R = Math.max(W, H) * .75, gr;
    if (m < .99) {
      gr = ctx.createRadialGradient(W * .5, H, 0, W * .5, H, R);
      gr.addColorStop(0, 'rgba(255,170,100,' + (.5 * (1 - m)) + ')'); gr.addColorStop(1, 'rgba(255,170,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (m > .01) {
      gr = ctx.createRadialGradient(W * .5, H, 0, W * .5, H, R);
      gr.addColorStop(0, 'rgba(130,110,255,' + (.18 * m) + ')'); gr.addColorStop(1, 'rgba(130,110,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawSkyline(m) {
    ctx.drawImage(skyline.sp, 0, H - skyline.gh, W, skyline.gh);
    if (m < .05) return;
    for (var i = 0; i < skyline.wins.length; i++) {
      var w = skyline.wins[i];
      var al = m * (.3 + .7 * Math.max(0, Math.sin(t * .8 + w.ph)));
      ctx.fillStyle = 'rgba(255,208,120,' + al + ')';
      ctx.fillRect(w.x, H - skyline.gh + w.y, w.sz, w.sz * 1.4);
    }
  }
  function drawMotes(dt, m) {
    var n = Math.floor(motes.length * quality), near = ptr.active > 0;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {
      var p = motes[i];
      p.vx += (Math.sin(t * .6 + p.ph) * 10 - p.vx * .5) * dt;
      p.vy += (Math.cos(t * .5 + p.ph * 1.3) * 8 - p.vy * .5 - (1 - m) * 5) * dt;
      if (near) {
        var dx = ptr.px - p.x, dy = ptr.py - p.y, d2 = dx * dx + dy * dy;
        if (d2 < 26000 && d2 > 40) { var d = Math.sqrt(d2), f = (1 - d / 161) * 120; p.vx += dx / d * f * dt; p.vy += dy / d * f * dt; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      var tw = .35 + .65 * Math.pow(Math.max(0, Math.sin(t * 1.5 * p.s + p.ph)), 2), sz = 10 + 12 * p.z;
      if (m < .98) { ctx.globalAlpha = (1 - m) * .5; ctx.drawImage(sprites.glowWarm, p.x - sz / 2, p.y - sz / 2, sz, sz); }
      if (m > .02) { ctx.globalAlpha = m * tw; ctx.drawImage(sprites.glowGold, p.x - sz / 2, p.y - sz / 2, sz * 1.1, sz * 1.1); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function shoot(x, y) {
    if (reduce) return;
    var sx = x == null ? rnd(W * .35, W * 1.05) : x, sy = y == null ? rnd(0, H * .35) : y, ang = rnd(.45, .75), sp = rnd(520, 760);
    meteors.push({ x: sx, y: sy, vx: -Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, dur: rnd(.9, 1.3), len: rnd(110, 190) });
  }
  function drawMeteors(dt, m) {
    if (m > .6) { nextMeteor -= dt; if (nextMeteor <= 0) { shoot(); nextMeteor = rnd(3.5, 8); } }
    for (var i = meteors.length - 1; i >= 0; i--) {
      var s = meteors[i]; s.life += dt;
      if (s.life >= s.dur) { meteors.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      var k = s.life / s.dur, a = Math.sin(Math.PI * k), nx = s.vx / Math.hypot(s.vx, s.vy), ny = s.vy / Math.hypot(s.vx, s.vy);
      var tx = s.x - nx * s.len, ty = s.y - ny * s.len;
      var gr = ctx.createLinearGradient(tx, ty, s.x, s.y);
      gr.addColorStop(0, 'rgba(143,211,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,' + a + ')');
      ctx.strokeStyle = gr; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = a; ctx.drawImage(sprites.glowCool, s.x - 9, s.y - 9, 18, 18); ctx.globalAlpha = 1;
    }
  }

  /* ---------- bursts (taps, completion) ---------- */
  function spark(x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
    ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.restore();
  }
  function burst(x, y, power) {
    if (reduce) return;
    power = power || 'small';
    var n = power === 'mega' ? 44 : power === 'big' ? 30 : 10, fast = power !== 'small';
    var cols = mode === 'evening' ? ['#ffe2a5', '#ffd27a', '#c9b8ff', '#8fd3ff', '#ffffff'] : ['#fff1c2', '#ffd27a', '#ffb066', '#ffffff', '#ffe2a5'];
    for (var i = 0; i < n; i++) {
      if (parts.length >= 260) parts.shift();
      var a = rnd(0, 6.283), sp = rnd(30, fast ? 260 : 130);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: rnd(.6, 1.3), sz: rnd(2, fast ? 7 : 4), c: cols[(Math.random() * cols.length) | 0], star: Math.random() < .5, rot: rnd(0, 6.28), vr: rnd(-4, 4) });
    }
    rings.push({ x: x, y: y, r: 6, rmax: power === 'small' ? 46 : power === 'big' ? 110 : 190, life: 0, dur: power === 'small' ? .5 : .8 });
    if (!running) start();
  }
  function trail(x, y) {
    var now = performance.now();
    if (now - ptr.tr < 45 || reduce) return;
    ptr.tr = now;
    if (parts.length >= 260) parts.shift();
    parts.push({ x: x, y: y, vx: rnd(-14, 14), vy: rnd(-14, 14), life: 0, max: rnd(.4, .8), sz: rnd(2, 4), c: mode === 'evening' ? '#c9b8ff' : '#ffe2a5', star: Math.random() < .4, rot: rnd(0, 6), vr: rnd(-3, 3) });
    if (!running) start();
  }
  function drawBursts(dt) {
    ctx.globalCompositeOperation = 'lighter';
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      var k = p.life / p.max;
      p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) + 60 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = p.c;
      if (p.star) spark(p.x, p.y, p.sz * (1 - k * .4), p.rot);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * .5 * (1 - k * .5), 0, 6.283); ctx.fill(); }
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var r = rings[i]; r.life += dt;
      if (r.life >= r.dur) { rings.splice(i, 1); continue; }
      var q = r.life / r.dur, e = 1 - Math.pow(1 - q, 3);
      ctx.globalAlpha = (1 - q) * .8; ctx.strokeStyle = mode === 'evening' ? '#cdbfff' : '#ffe2a5'; ctx.lineWidth = 2 * (1 - q) + .6;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.rmax - r.r) * e, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function celebrate() {
    if (reduce) return;
    var n = 0;
    (function go() {
      if (n >= 6) return;
      burst(rnd(W * .15, W * .85), rnd(H * .15, H * .55), 'mega');
      n++; if (n === 2 || n === 4) shoot();
      setTimeout(go, 260);
    })();
  }

  /* ---------- frame loop ---------- */
  function draw(dt) {
    var m = mix * mix * (3 - 2 * mix);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < 4; i++) g.addColorStop(STOPS[i], mixc(DAWN[i], NIGHT[i], m));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var ox = (ptr.sx - .5) + tilt.sx * .5, oy = (ptr.sy - .5) + tilt.sy * .5;
    drawNebula(m); drawClouds(dt, m, ox); drawStars(m, ox, oy); drawBodies(m, ox, oy);
    drawHorizon(m); drawSkyline(m); drawMotes(dt, m); drawMeteors(dt, m); drawBursts(dt);
  }
  function drawStatic() { mix = mixTarget; draw(0); }
  function frame(now) {
    raf = 0;
    if (document.hidden) { running = false; return; }
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; t += dt;
    if (++frames === 120) { if (slow > 45) quality = .5; frames = 0; slow = 0; }
    if (dt > .034) slow++;
    mix += (mixTarget - mix) * (1 - Math.exp(-dt * 2.4));
    if (Math.abs(mixTarget - mix) < .002) mix = mixTarget;
    ptr.sx += (ptr.x - ptr.sx) * Math.min(1, dt * 3); ptr.sy += (ptr.y - ptr.sy) * Math.min(1, dt * 3);
    tilt.sx += (tilt.x - tilt.sx) * Math.min(1, dt * 3); tilt.sy += (tilt.y - tilt.sy) * Math.min(1, dt * 3);
    if (ptr.active > 0) ptr.active = Math.max(0, ptr.active - dt);
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (reduce || running || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  window.addEventListener('pointermove', function (e) {
    ptr.px = e.clientX; ptr.py = e.clientY; ptr.x = e.clientX / W; ptr.y = e.clientY / H; ptr.active = 2.2;
    if (e.pointerType === 'mouse' || ptr.down) trail(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    ptr.down = true; ptr.dx = e.clientX; ptr.dy = e.clientY; ptr.dt = performance.now();
    ptr.px = e.clientX; ptr.py = e.clientY; ptr.x = e.clientX / W; ptr.y = e.clientY / H; ptr.active = 2.2;
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    ptr.down = false; ptr.active = .8;
    if (Math.hypot(e.clientX - ptr.dx, e.clientY - ptr.dy) < 12 && performance.now() - ptr.dt < 500) burst(e.clientX, e.clientY, 'small');
  }, { passive: true });
  window.addEventListener('pointercancel', function () { ptr.down = false; }, { passive: true });
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null || e.beta == null) return;
    tilt.x = clamp(e.gamma / 30, -1, 1); tilt.y = clamp((e.beta - 45) / 30, -1, 1);
  }, { passive: true });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(resize, 120); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  window.ThakirSky = {
    setMode: function (m, instant) {
      mode = m === 'evening' ? 'evening' : 'morning'; mixTarget = mode === 'evening' ? 1 : 0;
      if (instant || reduce) { mix = mixTarget; if (reduce) drawStatic(); }
      else { start(); if (mode === 'evening') setTimeout(function () { shoot(); }, 700); }
    },
    burst: burst, celebrate: celebrate, shoot: shoot
  };

  resize();
  if (reduce) drawStatic(); else start();
})();
