/* Melissa Monfared, site interactions */
(function () {
  'use strict';

  var doc = document, win = window, root = doc.documentElement;
  function mq(q) { return !!(win.matchMedia && win.matchMedia(q).matches); }
  var REDUCED = mq('(prefers-reduced-motion: reduce)');
  var DPR = Math.min(win.devicePixelRatio || 1, 2);
  function now() { return win.performance && win.performance.now ? win.performance.now() : Date.now(); }

  /* ------------------------------------------------------------------ helpers */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function backOut(t) { t = clamp(t, 0, 1); var c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' +
      (a == null ? 1 : Math.round(clamp(a, 0, 1) * 1000) / 1000) + ')';
  }
  function hsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function cmap(stops, x) {
    x = clamp(x, 0, 1) * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
  }
  var SHADE = [22, 30, 46];
  function palFrom(c) { return { base: c, edge: mix(c, SHADE, 0.3), deep: mix(c, SHADE, 0.5) }; }
  var palCache = {};
  function P3(h) { return palCache[h] || (palCache[h] = palFrom(hex(h))); }
  function ring(c, r, n, plane) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.2832;
      pts.push(plane === 'xy' ? [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]] : [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]);
    }
    return pts;
  }
  function each(sel, fn, ctx) { Array.prototype.forEach.call((ctx || doc).querySelectorAll(sel), fn); }
  function safe(fn, arg) { try { fn(arg); } catch (e) { if (win.console) console.warn('[site]', e); } }

  var WHITE = [255, 255, 255];
  var INK_SOFT = hex('#4b5c72'), NAVY = hex('#1e4e79'), LINE = hex('#bcc9d4');
  var PAL = {
    mint:  { base: hex('#c9ddd5'), edge: hex('#8fb5a6'), deep: hex('#6f9a8a') },
    blue:  { base: hex('#bcd6f0'), edge: hex('#6f9fd2'), deep: hex('#3f72a8') },
    sky:   { base: hex('#b8e0e6'), edge: hex('#80bec8'), deep: hex('#4a98a6') },
    navy:  { base: hex('#4a7aa3'), edge: hex('#1e4e79'), deep: hex('#16233a') },
    teal:  { base: hex('#a9dfd6'), edge: hex('#4fb3a7'), deep: hex('#2c7f77') },
    amber: { base: hex('#f2e4bd'), edge: hex('#cdb06c'), deep: hex('#9b7d3b') },
    coral: { base: hex('#ffc9ad'), edge: hex('#f08c62'), deep: hex('#c25a33') },
    green: { base: hex('#cfe8b8'), edge: hex('#82bd5c'), deep: hex('#4f8a35') }
  };
  var CYCLE = ['blue', 'amber', 'teal', 'sky'];
  function CYC(i) { var n = CYCLE.length; return CYCLE[((i % n) + n) % n]; }
  var LIGHT = (function () { var v = [-0.35, 0.85, 0.45], m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();

  /* ------------------------------------------------------------------ tooltip */
  var tipEl = null;
  function tip(label, x, y) {
    if (!tipEl) {
      tipEl = doc.createElement('div');
      tipEl.className = 'viz-tip';
      doc.body.appendChild(tipEl);
    }
    var key = Array.isArray(label) ? label.join('|') : String(label);
    if (tipEl._key !== key) {
      tipEl._key = key;
      tipEl.textContent = '';
      if (Array.isArray(label)) {
        var b = doc.createElement('b'); b.textContent = label[0]; tipEl.appendChild(b);
        tipEl.appendChild(doc.createTextNode(label[1]));
      } else {
        tipEl.textContent = label;
      }
    }
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = win.innerWidth;
    var left = x + 14; if (left + w > vw - 8) left = x - w - 14;
    var top = y - h - 12; if (top < 8) top = y + 18;
    tipEl.style.transform = 'translate(' + Math.round(Math.max(8, left)) + 'px,' + Math.round(top) + 'px)';
    tipEl.classList.add('is-on');
  }
  function untip() { if (tipEl) tipEl.classList.remove('is-on'); }

  /* ------------------------------------------------------------------ tiny 3D engine */
  var FACES = [
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] }
  ];

  function Viz3D(canvas, def) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.def = def;
    this.s = {};
    this.yaw0 = 0;
    this.pitch0 = def.pitch != null ? def.pitch : 0.35;
    this.dYaw = 0; this.dPitch = 0; this.vYaw = 0;
    this.hx = 0; this.hy = 0; this.ax = 0; this.ay = 0;
    this.w = 0; this.h = 0;
    this.visible = false; this.intro = null; this.until = 0;
    this.hover = null; this.hits = []; this.inside = false; this.lastShow = -1e9;
    this.drag = null; this.dirty = true;
    if (def.init) def.init(this.s, this);
    this.bind();
  }

  Viz3D.prototype.resize = function () {
    var w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return false;
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.c.width = Math.round(w * DPR);
      this.c.height = Math.round(h * DPR);
      this.dirty = true;
    }
    return true;
  };

  Viz3D.prototype.camera = function (t) {
    var d = this.def;
    var sway = 0, spin = 0;
    if (!this.drag && Math.abs(this.vYaw) > 0.0002) { this.dYaw += this.vYaw; this.vYaw *= 0.93; this.dirty = true; }
    var sm = win.__EXT ? 1 : 0.08;
    this.ax += (this.hx - this.ax) * sm;
    this.ay += (this.hy - this.ay) * sm;
    if (Math.abs(this.hx - this.ax) + Math.abs(this.hy - this.ay) > 0.002) this.dirty = true;
    var yaw = this.yaw0 + this.dYaw + sway + spin + this.ax;
    var pitch = clamp(this.pitch0 + this.dPitch + this.ay, -1.2, 1.3);
    this.cyw = Math.cos(yaw); this.syw = Math.sin(yaw);
    this.cpt = Math.cos(pitch); this.spt = Math.sin(pitch);
    this.D = d.dist || 5.5;
    this.u = Math.min(this.w / (d.spanX || 2.8), this.h / (d.spanY || 2.2)) * (d.fit || 1);
    this.ox = this.w * (0.5 + (d.offX || 0));
    this.oy = this.h * (0.5 + (d.offY || 0));
  };

  Viz3D.prototype.P = function (p) {
    var x = p[0] * this.cyw + p[2] * this.syw;
    var z = -p[0] * this.syw + p[2] * this.cyw;
    var y = p[1] * this.cpt - z * this.spt;
    var z2 = p[1] * this.spt + z * this.cpt;
    var k = this.D / (this.D - z2);
    return [this.ox + x * k * this.u, this.oy - y * k * this.u, z2, k];
  };

  Viz3D.prototype.N = function (n) {
    var x = n[0] * this.cyw + n[2] * this.syw;
    var z = -n[0] * this.syw + n[2] * this.cyw;
    return [x, n[1] * this.cpt - z * this.spt, n[1] * this.spt + z * this.cpt];
  };

  Viz3D.prototype.frame = function (t) {
    if (!this.resize()) return;
    this.lastT = t;
    if (REDUCED && !this.dirty && !this.drag && t > this.until) return;
    this.dirty = false;
    if (this.intro == null) { this.intro = t; this.until = t + 2500; }
    var ctx = this.ctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.camera(t);
    var items = this.def.build(this.s, { t: t, age: t - this.intro, hover: this.hover, hovering: this.inside, v: this }) || [];
    this.draw(items);
  };

  Viz3D.prototype.prepBox = function (b) {
    var mn = b.min, mx = b.max, faces = [], cache = {};
    for (var f = 0; f < 6; f++) {
      var F = FACES[f], qs = [];
      for (var v = 0; v < 4; v++) {
        var c = F.v[v], key = '' + c[0] + c[1] + c[2];
        if (!cache[key]) cache[key] = this.P([c[0] ? mx[0] : mn[0], c[1] ? mx[1] : mn[1], c[2] ? mx[2] : mn[2]]);
        qs.push(cache[key]);
      }
      var area = 0;
      for (var k = 0; k < 4; k++) { var a = qs[k], q = qs[(k + 1) % 4]; area += a[0] * q[1] - q[0] * a[1]; }
      if (area < 0) faces.push({ qs: qs, n: this.N(F.n) });
    }
    b.faces = faces;
    b.z = this.P([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2])[2];
    b.qtop = this.P([(mn[0] + mx[0]) / 2, mx[1], (mn[2] + mx[2]) / 2]);
  };

  Viz3D.prototype.prepCyl = function (it) {
    var n = it.n || 16, b = it.b, r = it.r, h = it.h, ax = it.axis || 'y', rb = [], rt = [], i;
    function at(a, off) {
      var c = Math.cos(a) * r, s2 = Math.sin(a) * r;
      if (ax === 'z') return [b[0] + c, b[1] + s2, b[2] + off];
      if (ax === 'x') return [b[0] + off, b[1] + c, b[2] + s2];
      return [b[0] + c, b[1] + off, b[2] + s2];
    }
    function nrm(a) {
      var c = Math.cos(a), s2 = Math.sin(a);
      return ax === 'z' ? [c, s2, 0] : (ax === 'x' ? [0, c, s2] : [c, 0, s2]);
    }
    for (i = 0; i < n; i++) { var a = i / n * 6.2832; rb.push(this.P(at(a, 0))); rt.push(this.P(at(a, h))); }
    var sides = [];
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n, q = [rb[j], rb[i], rt[i], rt[j]], nn = this.N(nrm((i + 0.5) / n * 6.2832));
      if (nn[2] > -0.08) sides.push({ qs: q, n: nn, z: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4 });
    }
    sides.sort(function (p, q) { return p.z - q.z; });
    var capN = ax === 'z' ? [0, 0, 1] : (ax === 'x' ? [1, 0, 0] : [0, 1, 0]);
    it.sides = sides; it.top = rt; it.topVis = this.N(capN)[2] > 0;
    var mid = ax === 'z' ? [b[0], b[1], b[2] + h / 2] : (ax === 'x' ? [b[0] + h / 2, b[1], b[2]] : [b[0], b[1] + h / 2, b[2]]);
    it.z = this.P(mid)[2];
    it.qtop = this.P(ax === 'y' ? [b[0], b[1] + h, b[2]] : mid);
  };

  Viz3D.prototype.draw = function (items) {
    var list = [], hits = [], i, it, j, zz;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (!it) continue;
      if (it.layer == null) it.layer = 1;
      if (it.k === 'pt' || it.k === 'txt' || it.k === 'sprite') { it.q = this.P(it.p); it.z = it.q[2]; }
      else if (it.k === 'ln') { it.qa = this.P(it.a); it.qb = this.P(it.b); it.z = (it.qa[2] + it.qb[2]) / 2; }
      else if (it.k === 'poly' || it.k === 'pl') {
        it.qs = []; zz = 0;
        for (j = 0; j < it.pts.length; j++) { var q = this.P(it.pts[j]); it.qs.push(q); zz += q[2]; }
        it.z = zz / it.pts.length;
      }
      else if (it.k === 'box') this.prepBox(it);
      else if (it.k === 'cyl') this.prepCyl(it);
      if (it.zb) it.z += it.zb;
      list.push(it);
    }
    list.sort(function (a, b) { return (a.layer - b.layer) || (a.z - b.z); });
    if (win.__EXT) this.measure(list);
    for (i = 0; i < list.length; i++) this.paint(list[i], hits);
    this.hits = hits;
  };

  function shadeFace(pal, n, hov) {
    var lum = clamp(0.5 + 0.5 * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), 0, 1);
    var col = mix(mix(pal.base, pal.edge, 0.6), mix(pal.base, WHITE, 0.5), lum);
    return hov ? mix(col, NAVY, 0.22) : col;
  }

  Viz3D.prototype.paint = function (it, hits) {
    var ctx = this.ctx, pal = it.pal || PAL[it.c] || PAL.blue, a = it.a == null ? 1 : it.a;
    var hov = it.id != null && this.hover === it.id;
    var hl = it.hl || 0, q, r, i, j;
    if (it.k === 'ln') {
      ctx.beginPath();
      ctx.moveTo(it.qa[0], it.qa[1]);
      ctx.lineTo(it.qb[0], it.qb[1]);
      ctx.strokeStyle = it.col || rgba(LINE, a);
      ctx.lineWidth = it.w || 1;
      ctx.lineCap = 'round';
      if (it.dash) ctx.setLineDash(it.dash);
      ctx.stroke();
      if (it.dash) ctx.setLineDash([]);
    } else if (it.k === 'pt') {
      q = it.q;
      r = (it.r || 4) * q[3] * (hov ? 1.35 : 1) * (1 + hl * 0.25);
      if (!(r >= 0.3) || a <= 0.01 || !isFinite(q[0]) || !isFinite(q[1])) return;
      if (it.flat) {
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832);
        ctx.fillStyle = rgba(pal.edge, a); ctx.fill();
        return;
      }
      var base = hl ? mix(pal.base, pal.deep, 0.5 * hl) : pal.base;
      if (hl > 0.03) {
        ctx.beginPath(); ctx.arc(q[0], q[1], r * (1.45 + hl * 0.7), 0, 6.2832);
        ctx.strokeStyle = rgba(PAL.sky.deep, 0.45 * hl); ctx.lineWidth = 1; ctx.stroke();
      }
      var g = ctx.createRadialGradient(q[0] - r * 0.35, q[1] - r * 0.4, r * 0.1, q[0], q[1], r);
      g.addColorStop(0, rgba(mix(base, WHITE, 0.75), a));
      g.addColorStop(0.55, rgba(base, a));
      g.addColorStop(1, rgba(mix(base, pal.edge, 0.7), a));
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832);
      ctx.fillStyle = g; ctx.fill();
      if (it.style) this.decorate(it, q[0], q[1], r, a);
      ctx.lineWidth = hov ? 1.6 : 1;
      ctx.strokeStyle = hov ? rgba(NAVY, 0.85) : rgba(pal.edge, Math.min(1, a + 0.15));
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832); ctx.stroke();
      if (it.id != null) hits.push({ id: it.id, x: q[0], y: q[1], r: r + 7, label: it.label });
    } else if (it.k === 'poly' || it.k === 'pl') {
      var qs = it.qs;
      if (qs.length < 2) return;
      ctx.beginPath(); ctx.moveTo(qs[0][0], qs[0][1]);
      for (i = 1; i < qs.length; i++) ctx.lineTo(qs[i][0], qs[i][1]);
      if (it.k === 'poly' || it.closed) ctx.closePath();
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); }
      else if (it.k === 'poly') { ctx.fillStyle = rgba(pal.base, a); ctx.fill(); }
      var sc = it.k === 'poly' ? it.stroke : it.col;
      if (sc) {
        ctx.strokeStyle = sc; ctx.lineWidth = it.sw || it.w || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (it.dash) ctx.setLineDash(it.dash);
        ctx.stroke();
        if (it.dash) ctx.setLineDash([]);
      }
    } else if (it.k === 'box') {
      for (var f = 0; f < it.faces.length; f++) {
        var F = it.faces[f], fq = F.qs;
        ctx.beginPath(); ctx.moveTo(fq[0][0], fq[0][1]);
        for (j = 1; j < 4; j++) ctx.lineTo(fq[j][0], fq[j][1]);
        ctx.closePath();
        ctx.fillStyle = rgba(shadeFace(pal, F.n, hov), a); ctx.fill();
        ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(pal.edge, 0.5 * a + 0.25); ctx.stroke();
      }
      if (it.id != null) hits.push({ id: it.id, x: it.qtop[0], y: it.qtop[1], r: 15, label: it.label });
    } else if (it.k === 'cyl') {
      for (i = 0; i < it.sides.length; i++) {
        var S = it.sides[i], sq = S.qs;
        ctx.beginPath(); ctx.moveTo(sq[0][0], sq[0][1]);
        for (j = 1; j < 4; j++) ctx.lineTo(sq[j][0], sq[j][1]);
        ctx.closePath();
        var sc2 = rgba(shadeFace(pal, S.n, hov), a);
        ctx.fillStyle = sc2; ctx.fill();
        ctx.lineWidth = 0.6; ctx.strokeStyle = sc2; ctx.stroke();
      }
      if (it.topVis) {
        var tp = it.top;
        ctx.beginPath(); ctx.moveTo(tp[0][0], tp[0][1]);
        for (i = 1; i < tp.length; i++) ctx.lineTo(tp[i][0], tp[i][1]);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(pal.base, WHITE, 0.35), a); ctx.fill();
        ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(pal.edge, 0.6); ctx.stroke();
      }
    } else if (it.k === 'sprite') {
      if (isFinite(it.q[0]) && isFinite(it.q[1]) && isFinite(it.q[3])) it.draw(ctx, it.q[0], it.q[1], it.q[3], it);
    } else if (it.k === 'txt') {
      if (!isFinite(it.q[0]) || !isFinite(it.q[1])) return;
      ctx.save();
      ctx.translate(it.q[0], it.q[1]);
      if (it.sx != null) ctx.scale(it.sx, 1);
      if (it.rot) ctx.rotate(it.rot);
      ctx.globalAlpha = it.alpha == null ? 1 : clamp(it.alpha, 0, 1);
      ctx.font = (it.weight || 500) + ' ' + (it.size || 11) + 'px ' + (it.family || '"IBM Plex Sans", system-ui, sans-serif');
      ctx.fillStyle = it.col || rgba(INK_SOFT, a);
      ctx.textAlign = it.align || 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.text, 0, 0);
      ctx.restore();
    }
  };

  Viz3D.prototype.decorate = function (it, x, y, r, a) {
    var ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.clip();
    ctx.translate(x, y); ctx.rotate(it.rot || 0);
    if (it.style === 'basket') {
      ctx.strokeStyle = 'rgba(70,32,10,' + (0.75 * a) + ')';
      ctx.lineWidth = Math.max(0.8, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.moveTo(-r * 0.62, -r); ctx.quadraticCurveTo(-r * 0.15, 0, -r * 0.62, r);
      ctx.moveTo(r * 0.62, -r); ctx.quadraticCurveTo(r * 0.15, 0, r * 0.62, r);
      ctx.stroke();
    } else if (it.style === 'face') {
      if (r >= 4) {
        ctx.fillStyle = 'rgba(59,47,42,' + (0.9 * a) + ')';
        ctx.beginPath(); ctx.arc(-r * 0.33, -r * 0.06, Math.max(0.7, r * 0.11), 0, 6.2832); ctx.arc(r * 0.33, -r * 0.06, Math.max(0.7, r * 0.11), 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(59,47,42,' + (0.8 * a) + ')'; ctx.lineWidth = Math.max(0.7, r * 0.09); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.36, 0.55, 2.6); ctx.stroke();
        ctx.fillStyle = 'rgba(255,170,120,' + (0.4 * a) + ')';
        ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.22, r * 0.14, 0, 6.2832); ctx.arc(r * 0.55, r * 0.22, r * 0.14, 0, 6.2832); ctx.fill();
      }
    } else if (it.style === 'soccer') {
      ctx.fillStyle = 'rgba(30,34,42,' + (0.9 * a) + ')';
      function pent(cx, cy, s) {
        ctx.beginPath();
        for (var k = 0; k < 5; k++) { var an = k / 5 * 6.2832 - Math.PI / 2; ctx.lineTo(cx + Math.cos(an) * s, cy + Math.sin(an) * s); }
        ctx.closePath(); ctx.fill();
      }
      pent(0, 0, r * 0.36);
      for (var k = 0; k < 5; k++) { var an = k / 5 * 6.2832 + Math.PI / 2; pent(Math.cos(an) * r * 0.98, Math.sin(an) * r * 0.98, r * 0.3); }
    }
    ctx.restore();
  };

  Viz3D.prototype.measure = function (list) {
    var e = this._ext || (this._ext = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }), i, j, f;
    e.w = this.w; e.h = this.h; e.ox = this.ox; e.oy = this.oy;
    function add(q, rx, ry) {
      if (!q || !isFinite(q[0]) || !isFinite(q[1])) return;
      rx = rx || 0; ry = ry == null ? rx : ry;
      if (q[0] - rx < e.x0) e.x0 = q[0] - rx; if (q[0] + rx > e.x1) e.x1 = q[0] + rx;
      if (q[1] - ry < e.y0) e.y0 = q[1] - ry; if (q[1] + ry > e.y1) e.y1 = q[1] + ry;
    }
    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.a === 0 || it.alpha === 0) continue;
      if (it.k === 'pt') add(it.q, (it.r || 4) * it.q[3] * (1.45 + (it.hl || 0) * 1.3));
      else if (it.k === 'txt') add(it.q, String(it.text).length * (it.size || 11) * 0.32, (it.size || 11) * 0.6);
      else if (it.k === 'sprite') add(it.q, it.size * it.q[3] * 1.3);
      else if (it.k === 'ln') { add(it.qa, 1); add(it.qb, 1); }
      else if (it.qs) for (j = 0; j < it.qs.length; j++) add(it.qs[j], 1);
      else if (it.k === 'box') for (f = 0; f < it.faces.length; f++) for (j = 0; j < 4; j++) add(it.faces[f].qs[j], 1);
      else if (it.k === 'cyl') { for (f = 0; f < it.sides.length; f++) for (j = 0; j < 4; j++) add(it.sides[f].qs[j], 1); for (j = 0; j < it.top.length; j++) add(it.top[j], 1); }
    }
  };

  Viz3D.prototype.pick = function (x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.hits.length; i++) {
      var h = this.hits[i], dx = x - h.x, dy = y - h.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < h.r && d < bd) { bd = d; best = h; }
    }
    return best;
  };

  Viz3D.prototype.show = function (hit) {
    var fn = this.def.show || this.def.click;
    if (!fn) return;
    var t = this.lastT != null ? this.lastT : now();
    this.lastShow = now();
    fn(this.s, { t: t, hit: hit });
    this.until = t + 3500;
    this.dirty = true;
  };

  Viz3D.prototype.bind = function () {
    var self = this, c = this.c, d0 = this.def;
    c.addEventListener('pointerenter', function () {
      self.inside = true; self.dirty = true;
      if (now() - self.lastShow > 1400) self.show(null);
    });
    c.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      self.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: now(), moved: false };
      self.vYaw = 0;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      c.classList.add('is-grabbing');
      untip();
    });
    c.addEventListener('pointermove', function (e) {
      var d = self.drag, r = c.getBoundingClientRect();
      if (d) {
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        d.x = e.clientX; d.y = e.clientY;
        if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 4) d.moved = true;
        self.dYaw += dx * 0.011;
        self.vYaw = dx * 0.011;
        if (e.pointerType !== 'touch') self.dPitch = clamp(self.dPitch + dy * 0.008, -1.4, 1.1);
        self.dirty = true;
        return;
      }
      if (e.pointerType === 'mouse' && r.width) {
        self.hx = ((e.clientX - r.left) / r.width - 0.5) * (d0.hoverYaw != null ? d0.hoverYaw : 0.6);
        self.hy = ((e.clientY - r.top) / r.height - 0.5) * (d0.hoverPitch != null ? d0.hoverPitch : 0.2);
        self.dirty = true;
      }
      var h = self.pick(e.clientX - r.left, e.clientY - r.top);
      var id = h ? h.id : null;
      if (id !== self.hover) { self.hover = id; self.dirty = true; try { c.dispatchEvent(new CustomEvent('vizhover', { detail: id })); } catch (er) { /* ignore */ } }
      if (h && h.label) tip(h.label, e.clientX, e.clientY); else untip();
    });
    function end(e) {
      var d = self.drag;
      if (!d) return;
      self.drag = null;
      c.classList.remove('is-grabbing');
      try { c.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (e.type === 'pointerup' && !d.moved && now() - d.t < 450) {
        var r = c.getBoundingClientRect(), h = self.pick(e.clientX - r.left, e.clientY - r.top);
        if (d0.tap) { d0.tap(self.s, { t: self.lastT || now() }); self.dirty = true; self.until = now() + 1500; }
        else if (now() - self.lastShow > 350) self.show(h ? h.id : null);
        if (h) { try { c.dispatchEvent(new CustomEvent('vizpick', { detail: h.id })); } catch (er) { /* ignore */ } }
      }
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', function () {
      self.inside = false; self.hx = 0; self.hy = 0; self.dirty = true;
      if (!self.drag) { self.hover = null; untip(); try { c.dispatchEvent(new CustomEvent('vizhover', { detail: null })); } catch (er) { /* ignore */ } }
    });
  };

  function pulse(api, i, lo) {
    if (REDUCED) return 0.9;
    lo = lo == null ? 0.5 : lo;
    return lo + (1 - lo) * (0.5 + 0.5 * Math.sin(api.t * 0.0018 - i * 0.55));
  }
  function tweenK(s, t, dur) { return s.t0 == null ? 1 : ease((t - s.t0) / (dur || 900)); }
  function startPlay(s, api) { if (s.p0 == null) s.p0 = api.t; return Math.max(0, api.t - s.p0); }

  /* ------------------------------------------------------------------ scenes, About */
  function scatterSample(r) {
    var a = (r() - 0.5) * 0.9, b = (r() - 0.5) * 0.7, c = (r() - 0.5) * 0.2, pts = [];
    for (var i = 0; i < 22; i++) {
      var x = r() * 1.8 - 0.9, z = r() * 1.8 - 0.9;
      pts.push([x, clamp(a * x + b * z + c + gauss(r) * 0.18, -0.9, 0.9), z]);
    }
    return { pts: pts, coef: [a, b, c] };
  }
  function scatterNow(s, t) {
    var k = tweenK(s, t);
    return {
      pts: s.p1.map(function (p, i) { var q = s.p0[i]; return [lerp(q[0], p[0], k), lerp(q[1], p[1], k), lerp(q[2], p[2], k)]; }),
      coef: [lerp(s.c0[0], s.c1[0], k), lerp(s.c0[1], s.c1[1], k), lerp(s.c0[2], s.c1[2], k)]
    };
  }
  function histSample(r) {
    var rows = [];
    for (var k = 0; k < 2; k++) {
      var bins = [0, 0, 0, 0, 0, 0, 0], mu = (r() - 0.5) * 1.3, sd = 0.75 + r() * 0.5;
      for (var i = 0; i < 90; i++) {
        var b = Math.floor((mu + gauss(r) * sd + 3) / 6 * 7);
        if (b >= 0 && b < 7) bins[b]++;
      }
      var mx = Math.max.apply(null, bins) || 1;
      rows.push(bins.map(function (n) { return 0.08 + 1.25 * n / mx; }));
    }
    return rows;
  }
  function histNow(s, t) {
    var k = tweenK(s, t);
    return s.h1.map(function (row, i) { return row.map(function (h, j) { return lerp(s.h0[i][j], h, k); }); });
  }
  function boxSample(r) {
    var out = [];
    for (var k = 0; k < 3; k++) {
      var mu = (r() - 0.5) * 0.4, sd = 0.26 + r() * 0.16, v = [];
      for (var i = 0; i < 40; i++) v.push(mu + gauss(r) * sd);
      v.sort(function (a, b) { return a - b; });
      var q = function (p) { var x = (v.length - 1) * p, lo = Math.floor(x); return lerp(v[lo], v[Math.ceil(x)], x - lo); };
      var q1 = q(0.25), q2 = q(0.5), q3 = q(0.75), iqr = q3 - q1;
      var lo = Math.max(v[0], q1 - 1.5 * iqr), hi = Math.min(v[v.length - 1], q3 + 1.5 * iqr);
      out.push({
        v: [clamp(lo, -0.95, 0.95), q1, q2, q3, clamp(hi, -0.95, 0.95)],
        o: v.filter(function (x) { return (x < lo || x > hi) && Math.abs(x) < 0.98; }).slice(0, 2)
      });
    }
    return out;
  }
  function boxNow(s, t) {
    var k = tweenK(s, t);
    return s.b1.map(function (b, i) { return b.v.map(function (x, j) { return lerp(s.b0[i].v[j], x, k); }); });
  }
  function fib(n, R) {
    var pts = [], g = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = g * i;
      pts.push([Math.cos(th) * rad * R, y * R * 0.85, Math.sin(th) * rad * R]);
    }
    return pts;
  }
  function waveFrom(s, start, t) {
    var lv = {}, q = [start];
    lv[start] = 0;
    while (q.length) {
      var u = q.shift();
      for (var k = 0; k < s.adj[u].length; k++) { var v = s.adj[u][k]; if (lv[v] == null) { lv[v] = lv[u] + 1; q.push(v); } }
    }
    s.wave = { t0: t, lv: lv };
  }
  function treePath(s, t) {
    var n = 0, nodes = [0];
    while (s.kids[n] && s.kids[n].length) { n = s.kids[n][Math.floor(Math.random() * s.kids[n].length)]; nodes.push(n); }
    s.path = { t0: t, nodes: nodes };
  }

  /* ------------------------------------------------------------------ data from the CV */
  var MILESTONES = [
    ['2017', 'High school, mathematics and physics'],
    ['2020', 'BSc Industrial Engineering, Amirkabir'],
    ['2023', 'Data analyst at Tanin Print'],
    ['2024', 'BSc thesis on customer satisfaction in skincare, with LSTM and BERT sentiment models on Sephora reviews'],
    ['2025', 'MSc Data Science at LSE'],
    ['2025', 'Teaching assistant at K. N. Toosi'],
    ['2025', 'Data science researcher at Trilemma, my MSc capstone project run jointly with LSE'],
    ['2026', 'Research assistant, LSE Statistics']
  ];
  var ROLES = [
    ['2023 to 2025', 'Data analyst, Tanin Print'],
    ['2025 to 2026', 'Data science researcher, Trilemma (MSc capstone with LSE)'],
    ['2026 onwards', 'Research assistant, LSE Statistics']
  ];
  var TEAMS = [
    ['Team 1', 'Reddit sentiment and stock prediction'],
    ['Team 2', 'Market efficiency in sports betting'],
    ['Team 3', 'Market reaction to central bank announcements']
  ];
  var STEP_LABELS = { 1: ['Sep 2025', 'TA, Entrepreneurship and Business Planning'], 3: ['Jan 2026', 'TA, Stochastic Processes (graduate)'] };
  var SKILLS = ['Statistical methods', 'Programming', 'Modelling and machine learning', 'Model evaluation',
    'Analytics and reporting', 'Data engineering', 'Big data and cloud', 'Visualisation and communication',
    'Soft skills', 'Certifications'];

  /* ------------------------------------------------------------------ scene definitions */
  var SCENES = {
    scatter: {
      yaw: -0.7, pitch: 0.36, sway: 0.28, spanX: 3.15, spanY: 3.05,
      init: function (s) {
        s.r = rng(7);
        var f = scatterSample(s.r);
        s.p0 = s.p1 = f.pts; s.c0 = s.c1 = f.coef; s.t0 = null;
      },
      click: function (s, e) {
        var cur = scatterNow(s, e.t), nx = scatterSample(s.r);
        s.p0 = cur.pts; s.c0 = cur.coef; s.p1 = nx.pts; s.c1 = nx.coef; s.t0 = e.t;
      },
      build: function (s, api) {
        var cur = scatterNow(s, api.t), cf = cur.coef, it = [], g, i;
        function Y(x, z) { return cf[0] * x + cf[1] * z + cf[2]; }
        var up = api.v.N([-cf[0], 1, -cf[1]])[2] > 0;
        var o = [-1.05, -1.0, -1.05];
        it.push({ k: 'ln', layer: 0, a: o, b: [1.05, -1.0, -1.05], col: rgba(LINE, 0.85) });
        it.push({ k: 'ln', layer: 0, a: o, b: [-1.05, 1.0, -1.05], col: rgba(LINE, 0.85) });
        it.push({ k: 'ln', layer: 0, a: o, b: [-1.05, -1.0, 1.05], col: rgba(LINE, 0.85) });
        it.push({ k: 'poly', layer: 2, pts: [[-1, Y(-1, -1), -1], [1, Y(1, -1), -1], [1, Y(1, 1), 1], [-1, Y(-1, 1), 1]], fill: 'rgba(184,224,230,0.32)', stroke: 'rgba(90,163,174,0.5)' });
        for (g = -0.5; g < 0.6; g += 0.5) {
          it.push({ k: 'ln', layer: 2, a: [g, Y(g, -1), -1], b: [g, Y(g, 1), 1], col: 'rgba(90,163,174,0.3)' });
          it.push({ k: 'ln', layer: 2, a: [-1, Y(-1, g), g], b: [1, Y(1, g), g], col: 'rgba(90,163,174,0.3)' });
        }
        for (i = 0; i < cur.pts.length; i++) {
          var p = cur.pts[i], py = Y(p[0], p[2]), L = ((p[1] >= py) === up) ? 3 : 1;
          it.push({ k: 'ln', layer: L, a: p, b: [p[0], py, p[2]], col: 'rgba(104,144,170,0.42)' });
          it.push({ k: 'pt', layer: L, p: p, r: 3.6, c: CYC(i), a: pulse(api, i, 0.55) });
        }
        return it;
      }
    },

    hist: {
      yaw: -0.62, pitch: 0.4, sway: 0.28, phase: 1.1, spanX: 2.95, spanY: 2.75, offY: 0.02,
      init: function (s) { s.r = rng(11); s.h1 = histSample(s.r); s.h0 = s.h1; s.t0 = null; },
      click: function (s, e) { s.h0 = histNow(s, e.t); s.h1 = histSample(s.r); s.t0 = e.t; },
      build: function (s, api) {
        var H = histNow(s, api.t), it = [], floor = -0.72;
        for (var k = 0; k < 2; k++) {
          var z0 = k === 0 ? -0.42 : 0.06;
          for (var i = 0; i < 7; i++) {
            var g = REDUCED ? 1 : backOut((api.age - i * 70 - k * 140) / 900);
            var x0 = -1.12 + i * 0.32, h = Math.max(0.015, H[k][i] * g);
            it.push({ k: 'box', min: [x0, floor, z0], max: [x0 + 0.26, floor + h, z0 + 0.32], c: CYC(i + k * 3), a: REDUCED ? 0.95 : 0.82 + 0.18 * pulse(api, i + k * 3, 0) });
          }
        }
        it.push({ k: 'ln', layer: 0, a: [-1.25, floor, -0.5], b: [1.15, floor, -0.5], col: rgba(LINE, 0.9) });
        it.push({ k: 'ln', layer: 0, a: [-1.25, floor, 0.46], b: [1.15, floor, 0.46], col: rgba(LINE, 0.9) });
        return it;
      }
    },

    network: {
      yaw: 0, pitch: 0.3, spin: 0.00022, sway: 0, spanX: 2.45, spanY: 2.3,
      init: function (s) {
        s.n = fib(12, 0.95); s.e = [];
        var seen = {}, i, k;
        for (i = 0; i < 12; i++) {
          var near = [];
          for (var j = 0; j < 12; j++) {
            if (j === i) continue;
            var dx = s.n[j][0] - s.n[i][0], dy = s.n[j][1] - s.n[i][1], dz = s.n[j][2] - s.n[i][2];
            near.push({ j: j, d: dx * dx + dy * dy + dz * dz });
          }
          near.sort(function (a, b) { return a.d - b.d; });
          for (k = 0; k < 2; k++) {
            var key = Math.min(i, near[k].j) + '-' + Math.max(i, near[k].j);
            if (!seen[key]) { seen[key] = 1; s.e.push([i, near[k].j]); }
          }
        }
        s.adj = s.n.map(function () { return []; });
        s.e.forEach(function (e) { s.adj[e[0]].push(e[1]); s.adj[e[1]].push(e[0]); });
        s.wave = null;
      },
      click: function (s, e) { waveFrom(s, e.hit != null ? e.hit : Math.floor(Math.random() * 12), e.t); },
      build: function (s, api) {
        if (!REDUCED && api.age > 1600 && (!s.wave || api.t - s.wave.t0 > 4600)) waveFrom(s, Math.floor(Math.random() * 12), api.t);
        var it = [], lv = s.wave ? s.wave.lv : null, el = s.wave ? (api.t - s.wave.t0) / 260 : -99;
        function glow(i) { if (!lv || lv[i] == null) return 0; var d = el - lv[i]; return Math.exp(-d * d * 1.1); }
        for (var k = 0; k < s.e.length; k++) {
          var a = s.e[k][0], b = s.e[k][1], g = Math.min(glow(a), glow(b));
          it.push({ k: 'ln', a: s.n[a], b: s.n[b], col: rgba(mix(LINE, NAVY, g * 0.55), 0.75 + 0.2 * g), w: 1 + g * 0.6 });
        }
        for (var i = 0; i < s.n.length; i++) {
          it.push({ k: 'pt', p: s.n[i], r: 4.4, c: CYC(i), a: pulse(api, i, 0.6), hl: glow(i), id: i });
        }
        return it;
      }
    },

    box: {
      yaw: -0.5, pitch: 0.3, sway: 0.3, phase: 2.2, spanX: 2.25, spanY: 2.2,
      init: function (s) { s.r = rng(19); s.b1 = boxSample(s.r); s.b0 = s.b1; s.t0 = null; },
      click: function (s, e) {
        var cur = boxNow(s, e.t);
        s.b0 = cur.map(function (v) { return { v: v }; });
        s.b1 = boxSample(s.r); s.t0 = e.t;
      },
      build: function (s, api) {
        var B = boxNow(s, api.t), it = [];
        for (var k = 0; k < 3; k++) {
          var x = -0.78 + k * 0.78, w = 0.19, v = B[k], col = CYC(k), dp = PAL[col].deep;
          var g = REDUCED ? 1 : backOut((api.age - k * 150) / 900), m = v[2];
          var sc = function (y) { return lerp(m, y, g); };
          it.push({ k: 'box', min: [x - w, sc(v[1]), -w], max: [x + w, m, w], c: col, a: 0.95 });
          it.push({ k: 'box', min: [x - w, m, -w], max: [x + w, sc(v[3]), w], c: col, a: 0.72 });
          it.push({ k: 'ln', a: [x, sc(v[0]), 0], b: [x, sc(v[1]), 0], col: rgba(dp, 0.75) });
          it.push({ k: 'ln', a: [x, sc(v[3]), 0], b: [x, sc(v[4]), 0], col: rgba(dp, 0.75) });
          it.push({ k: 'ln', a: [x - 0.1, sc(v[0]), 0], b: [x + 0.1, sc(v[0]), 0], col: rgba(dp, 0.75) });
          it.push({ k: 'ln', a: [x - 0.1, sc(v[4]), 0], b: [x + 0.1, sc(v[4]), 0], col: rgba(dp, 0.75) });
          var outl = s.b1[k].o || [];
          for (var j = 0; j < outl.length; j++) it.push({ k: 'pt', p: [x + (j ? 0.06 : -0.06), outl[j], 0], r: 2.4, c: col, a: 0.9 * tweenK(s, api.t) });
        }
        return it;
      }
    },

    tree: {
      yaw: 0.3, pitch: 0.26, spin: 0.00018, sway: 0, spanX: 2.75, spanY: 2.8, offY: -0.02,
      init: function (s) {
        var N = [[0, 0.85, 0]], E = [], kids = [[]];
        for (var i = 0; i < 3; i++) {
          var th = i * 2.0944, id = N.length;
          N.push([Math.cos(th) * 0.6, 0.05, Math.sin(th) * 0.6]); E.push([0, id]); kids[0].push(id); kids[id] = [];
          for (var j = 0; j < 2; j++) {
            var t2 = th + (j ? 0.55 : -0.55), lid = N.length;
            N.push([Math.cos(t2) * 1.0, -0.78, Math.sin(t2) * 1.0]); E.push([id, lid]); kids[id].push(lid); kids[lid] = [];
          }
        }
        s.N = N; s.E = E; s.kids = kids; s.path = null;
      },
      click: function (s, e) { treePath(s, e.t); },
      build: function (s, api) {
        if (!REDUCED && api.age > 1200 && (!s.path || api.t - s.path.t0 > 3600)) treePath(s, api.t);
        var it = [], P = s.path, el = P ? api.t - P.t0 : -1;
        function on(node) {
          if (!P) return 0;
          var k = P.nodes.indexOf(node);
          if (k < 0) return 0;
          var d = el - k * 260;
          return d < 0 ? 0 : (d < 1900 ? Math.min(1, d / 160) : Math.max(0, 1 - (d - 1900) / 600));
        }
        for (var k = 0; k < s.E.length; k++) {
          var a = s.E[k][0], b = s.E[k][1], g = Math.min(on(a), on(b));
          it.push({ k: 'ln', a: s.N[a], b: s.N[b], col: rgba(mix(LINE, NAVY, g * 0.55), 0.85 + 0.1 * g), w: 1 + g * 0.7 });
        }
        for (var i = 0; i < s.N.length; i++) {
          it.push({ k: 'pt', p: s.N[i], r: i === 0 ? 5.6 : (i % 3 === 1 ? 4.8 : 4.2), c: CYC(i), a: pulse(api, i, 0.6), hl: on(i), id: i });
        }
        return it;
      }
    },

    /* ---------------------------------------------------------------- CV */
    timeline: {
      yaw: -0.12, pitch: 0.38, sway: 0.035, swaySpeed: 0.00028, spanX: 5.7, spanY: 1.32, offY: 0.08, dist: 7, hoverYaw: 0.1, hoverPitch: 0.06,
      build: function (s, api) {
        var it = [], N = 96, W = 0.16, i;
        function C(u) { return [lerp(-2.6, 2.6, u), 0.2 * Math.sin(u * Math.PI * 4.5 + 0.4), 0]; }
        var reveal = REDUCED ? 1 : ease(api.age / 1500);
        for (i = 0; i < N; i++) {
          var u0 = i / N, u1 = Math.min((i + 1) / N, reveal);
          if (u0 >= reveal) break;
          var a = C(u0), b = C(u1);
          var col = cmap([PAL.teal.base, PAL.sky.base, PAL.blue.base, PAL.amber.base], u0);
          it.push({ k: 'poly', pts: [[a[0], a[1], -W], [b[0], b[1], -W], [b[0], b[1], W], [a[0], a[1], W]], fill: rgba(col, 0.92), stroke: rgba(mix(col, INK_SOFT, 0.3), 0.25), sw: 0.6 });
        }
        for (var gx = -2.5; gx < 2.55; gx += 0.25) {
          for (var gz = -0.2; gz < 0.25; gz += 0.2) it.push({ k: 'pt', layer: 0, p: [gx, -0.46, gz], r: 1.1, c: 'blue', a: 0.5, flat: true });
        }
        var active = REDUCED ? -1 : Math.floor(api.t / 1500) % MILESTONES.length;
        for (var m = 0; m < MILESTONES.length; m++) {
          var u = 0.04 + m * (0.92 / (MILESTONES.length - 1));
          if (u > reveal + 0.001) continue;
          var c = C(u), p = [c[0], c[1] + 0.03, c[2]];
          it.push({ k: 'pt', layer: 3, p: [p[0], p[1] + 0.04, p[2]], r: 5.2, c: CYC(m), a: 0.97, id: m, label: MILESTONES[m], hl: m === active ? 1 : 0 });
          if (m === 0 || MILESTONES[m][0] !== MILESTONES[m - 1][0]) {
            it.push({ k: 'txt', layer: 4, p: [p[0], p[1] + 0.27, p[2]], text: MILESTONES[m][0], a: 0.9 });
          }
        }
        return it;
      }
    },

    experience: {
      yaw: 0, pitch: 0.82, sway: 0.2, spanX: 3.0, spanY: 2.75, offY: -0.02,
      init: function (s) { s.t0 = null; },
      click: function (s, e) { s.t0 = e.t; },
      build: function (s, api) {
        var it = [], base = s.t0 != null ? api.t - s.t0 : api.age, floor = -0.62;
        it.push({ k: 'poly', layer: 0, pts: [[-1.1, floor, -0.72], [1.05, floor, -0.72], [1.05, floor, 0.64], [-1.1, floor, 0.64]], fill: 'rgba(217,227,238,0.35)', stroke: rgba(LINE, 0.8) });
        for (var r = 0; r < 3; r++) {
          for (var i = 0; i < 4; i++) {
            var h = 0.3 + 0.2 * r + 0.16 * i, g = REDUCED ? 1 : backOut((base - (r * 4 + i) * 60) / 800);
            var x0 = -0.95 + i * 0.5, z0 = 0.24 - r * 0.42;
            it.push({ k: 'box', min: [x0, floor, z0], max: [x0 + 0.34, floor + Math.max(0.01, h * g), z0 + 0.3], c: CYC(r), a: 0.96, id: 'r' + r, label: ROLES[r] });
          }
        }
        return it;
      }
    },

    volunteer: {
      yaw: 0, pitch: 0.36, spin: 0.00016, sway: 0, spanX: 2.7, spanY: 1.75,
      init: function (s) {
        var N = [[0, 0, 0]], E = [], r = rng(5);
        s.hubs = [];
        for (var k = 0; k < 3; k++) {
          var th = k * 2.0944 + 0.3, hub = [Math.cos(th) * 0.72, [0.18, -0.12, 0.06][k], Math.sin(th) * 0.72], hid = N.length;
          N.push(hub); E.push([0, hid, 1]); s.hubs.push(hid);
          for (var j = 0; j < 3; j++) {
            var a = th + (j - 1) * 0.75, sid = N.length;
            N.push([hub[0] + Math.cos(a) * 0.36, hub[1] + (r() - 0.5) * 0.3, hub[2] + Math.sin(a) * 0.36]);
            E.push([hid, sid, 0]);
          }
        }
        s.N = N; s.E = E; s.wave = null;
      },
      click: function (s, e) { s.wave = { t0: e.t }; },
      build: function (s, api) {
        if (!REDUCED && api.age > 1500 && (!s.wave || api.t - s.wave.t0 > 5200)) s.wave = { t0: api.t };
        var el = s.wave ? (api.t - s.wave.t0) / 420 : -9, it = [];
        function lvl(i) { return i === 0 ? 0 : (s.hubs.indexOf(i) >= 0 ? 1 : 2); }
        function glow(i) { var d = el - lvl(i); return Math.exp(-d * d * 1.4); }
        for (var k = 0; k < s.E.length; k++) {
          var e = s.E[k], g = glow(e[1]);
          it.push({ k: 'ln', a: s.N[e[0]], b: s.N[e[1]], col: rgba(mix(LINE, NAVY, g * 0.5), 0.7 + 0.25 * g), w: (e[2] ? 1.4 : 1) + g * 0.6 });
        }
        for (var i = 0; i < s.N.length; i++) {
          var L = lvl(i), hubIx = s.hubs.indexOf(i);
          var lab = i === 0 ? ['LSESU Data Science Society', 'Technical consultant, three teams and nine students'] : (L === 1 ? TEAMS[hubIx] : null);
          var col = L === 0 ? 'navy' : CYC((L === 1 ? hubIx : Math.floor((i - 1) / 4)));
          it.push({ k: 'pt', p: s.N[i], r: L === 0 ? 6.5 : (L === 1 ? 5 : 3.6), c: col, a: L === 2 ? pulse(api, i, 0.55) : 0.96, hl: glow(i), id: lab ? i : null, label: lab });
        }
        return it;
      }
    },

    teaching: {
      yaw: -0.5, pitch: 0.38, sway: 0.16, spanX: 3.75, spanY: 2.7, offY: -0.02, hoverYaw: 0.55, hoverPitch: 0.22,
      init: function (s) { s.b0 = null; },
      show: function (s, e) { s.b0 = e.t; },
      build: function (s, api) {
        var it = [], floor = -0.7, top = [], cx = [], i;
        it.push({ k: 'poly', layer: 0, pts: [[-1.7, floor, -0.45], [1.68, floor, -0.45], [1.68, floor, 0.45], [-1.7, floor, 0.45]], fill: 'rgba(217,227,238,0.35)', stroke: rgba(LINE, 0.8) });
        for (i = 0; i < 5; i++) {
          var x0 = -1.55 + i * 0.62, h = 0.22 * (i + 1);
          cx.push(x0 + 0.29); top.push(floor + h);
          var g = REDUCED ? 1 : backOut((api.age - i * 90) / 700);
          it.push({ k: 'box', min: [x0, floor, -0.32], max: [x0 + 0.58, floor + Math.max(0.01, h * g), 0.32], c: CYC(i), a: 0.96, id: STEP_LABELS[i] ? 's' + i : null, label: STEP_LABELS[i] || null });
          if (STEP_LABELS[i] && g > 0.97) {
            var fx = x0 + 0.1, fy = floor + h, fz = -0.2, col = PAL[CYC(i)].deep, wv = REDUCED ? 0 : Math.sin(api.t * 0.006 + i) * 0.02;
            it.push({ k: 'ln', layer: 2, a: [fx, fy, fz], b: [fx, fy + 0.34, fz], col: rgba(INK_SOFT, 0.85), w: 1.2 });
            it.push({ k: 'poly', layer: 2, pts: [[fx, fy + 0.34, fz], [fx + 0.21, fy + 0.29 + wv, fz], [fx, fy + 0.22, fz]], fill: rgba(col, 0.95), stroke: rgba(col, 1), sw: 0.6 });
            it.push({ k: 'txt', layer: 5, p: [fx + 0.1, fy + 0.46, fz], text: STEP_LABELS[i][0], size: 9.5, weight: 600, col: '#4b5c72' });
          }
        }
        if (!REDUCED && api.age > 900) {
          var T = (Math.max(0, api.t - (s.b0 || 0)) / 620) % 7, k = Math.floor(T), f = T - k, x, y, a = 1, R = 0.075;
          if (k < 4) { x = lerp(cx[k], cx[k + 1], f); y = lerp(top[k], top[k + 1], f) + 0.4 * 4 * f * (1 - f) + R; }
          else if (k < 6) { x = cx[4]; y = top[4] + R + 0.15 * Math.abs(Math.sin(f * Math.PI)); }
          else { x = cx[4]; y = top[4] + R; a = 1 - f; }
          it.push({ k: 'pt', layer: 3, p: [x, y, 0.05], r: 5.4, c: 'navy', a: a });
        }
        return it;
      }
    },

    publication: {
      yaw: 0, pitch: 0.42, spin: 0.0001, sway: 0, spanX: 3.0, spanY: 1.8,
      init: function (s) {
        var r = rng(42);
        s.m = [];
        for (var i = 0; i < 22; i++) {
          var rad = 0.4 + r() * 0.62;
          s.m.push({ inc: (r() - 0.5) * 0.9, node: r() * 6.283, rad: rad, sp: (0.00035 + r() * 0.0004) * (r() < 0.5 ? -1 : 1) / Math.sqrt(rad), ph: r() * 6.283, life: 2600 + r() * 3200, off: r() * 6000, c: CYC(i) });
        }
        s.recall = -1e9;
      },
      click: function (s, e) { s.recall = e.t; },
      build: function (s, api) {
        var it = [], t = api.t, rec = Math.exp(-Math.max(0, t - s.recall) / 900), center = [0, 0, 0];
        it.push({ k: 'pt', p: center, r: 7.5, c: 'navy', a: 0.96, id: 'calm', label: ['Jun 2026', 'CALM, presented at IEEE QPAIN'] });
        for (var i = 0; i < s.m.length; i++) {
          var m = s.m[i], th = m.ph + (REDUCED ? 0 : t * m.sp);
          var x = Math.cos(th) * m.rad, z = Math.sin(th) * m.rad;
          var y1 = -z * Math.sin(m.inc), z1 = z * Math.cos(m.inc);
          var cn = Math.cos(m.node), sn = Math.sin(m.node);
          var p = [x * cn + z1 * sn, y1 * 0.8, -x * sn + z1 * cn];
          var f = REDUCED ? 0.3 : ((t + m.off) % m.life) / m.life;
          var a = clamp(Math.exp(-3.2 * f) * 0.85 + 0.18 + rec * 0.85, 0, 1);
          it.push({ k: 'ln', a: center, b: p, col: rgba(LINE, a * 0.6) });
          it.push({ k: 'pt', p: p, r: 3 + 2.2 * a, c: m.c, a: a });
        }
        return it;
      }
    },

    skills: {
      yaw: 0, pitch: 0.25, spin: 0.00012, sway: 0, spanX: 3.1, spanY: 1.7,
      init: function (s) {
        var r = rng(9), N = [];
        for (var i = 0; i < SKILLS.length; i++) {
          var th = i / SKILLS.length * 6.283 + (r() - 0.5) * 0.4, rad = 0.75 + r() * 0.55;
          N.push([Math.cos(th) * rad, (r() - 0.5) * 0.9, Math.sin(th) * rad * 0.8]);
        }
        s.N = N; s.E = [];
        for (var j = 0; j < N.length; j++) s.E.push([j, (j + 1) % N.length]);
        s.E.push([0, 4]); s.E.push([2, 7]); s.E.push([5, 9]);
        s.d0 = null; s.dust = [];
        for (var d = 0; d < 26; d++) s.dust.push([(r() - 0.5) * 2.4, (r() - 0.5) * 1.0, (r() - 0.5) * 1.5]);
      },
      click: function (s, e) { s.d0 = e.t; },
      build: function (s, api) {
        var it = [], el = s.d0 != null ? api.t - s.d0 : api.age, hv = api.hover, k, i;
        for (k = 0; k < s.E.length; k++) {
          var a = s.E[k][0], b = s.E[k][1], f = REDUCED ? 1 : clamp((el - k * 110) / 380, 0, 1);
          if (f <= 0) continue;
          var A = s.N[a], B = s.N[b], E2 = [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)];
          var on = hv === a || hv === b;
          it.push({ k: 'ln', a: A, b: E2, col: on ? rgba(NAVY, 0.75) : rgba(LINE, 0.95), w: on ? 1.6 : 1 });
        }
        for (i = 0; i < s.N.length; i++) it.push({ k: 'pt', p: s.N[i], r: 3.4 + (i % 3), c: CYC(i), a: pulse(api, i * 2, 0.5), id: i, label: SKILLS[i] });
        for (i = 0; i < s.dust.length; i++) it.push({ k: 'pt', layer: 0, p: s.dust[i], r: 1, c: 'blue', a: 0.3 + 0.3 * pulse(api, i * 3, 0), flat: true });
        return it;
      }
    },

    /* ---------------------------------------------------------------- Projects header chart */
    surface: {
      pitch: 0.5, spanX: 3.6, spanY: 2.6, offY: 0, hoverYaw: 0.5, hoverPitch: 0.16,
      init: function (s) { s.rhos = [0.6, -0.5, 0.15]; s.ri = 0; s.r0 = s.r1 = 0.6; s.t0 = null; s.drops = []; s.hit = {}; s.last = 0; s.rng = rng(5); },
      click: function (s, e) { s.r0 = lerp(s.r0, s.r1, tweenK(s, e.t)); s.ri = (s.ri + 1) % 3; s.r1 = s.rhos[s.ri]; s.t0 = e.t; },
      build: function (s, api) {
        var it = [], rho = lerp(s.r0, s.r1, tweenK(s, api.t)), n = 11, c = 0.24, half = (n - 1) / 2, floor = -0.62, H = [], mx = 0, i, j, t = api.t, SD = 0.55;
        var RAMP = ['#2b7a9e', '#2a9d8f', '#8ecae6', '#e6d6a6'].map(hex), sq = Math.sqrt(1 - rho * rho);
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            var x = (i - half) * c / SD, z = (j - half) * c / SD, d = Math.exp(-(x * x - 2 * rho * x * z + z * z) / (1 - rho * rho) / 2);
            H.push(d); if (d > mx) mx = d;
          }
        }
        it.push({ k: 'pl', layer: 0, pts: [[-1.45, floor, -1.45], [1.45, floor, -1.45], [1.45, floor, 1.45], [-1.45, floor, 1.45]], closed: true, fill: 'rgba(236,243,249,0.95)', col: 'rgba(180,195,215,0.8)', w: 1 });
        [1, 2].forEach(function (kk, ki) {
          var pts = [];
          for (var a = 0; a <= 48; a++) { var th = a / 48 * 6.2832; pts.push([Math.cos(th) * kk * SD, floor, (rho * Math.cos(th) + sq * Math.sin(th)) * kk * SD]); }
          it.push({ k: 'pl', layer: 0, zb: 5 + ki, pts: pts, closed: true, col: ki ? 'rgba(42,157,143,0.45)' : 'rgba(42,157,143,0.8)', w: 1.2, dash: [4, 3] });
        });
        var mxs = [], mzs = [];
        for (i = 0; i <= 40; i++) { var u2 = -1.4 + i * 0.07, ph = Math.exp(-Math.pow(u2 / SD, 2) / 2); mxs.push([u2, floor + 0.85 * ph, -1.45]); mzs.push([-1.45, floor + 0.85 * ph, u2]); }
        it.push({ k: 'pl', layer: 0, zb: 8, pts: mxs, col: '#f4a261', w: 2 });
        if (!REDUCED && t - s.last > (api.hovering ? 45 : 110) && s.drops.length < 30) {
          s.last = t;
          var g1 = gauss(s.rng), g2 = gauss(s.rng), ci = Math.round(g1 * SD / c + half), cj = Math.round((rho * g1 + sq * g2) * SD / c + half);
          if (ci >= 0 && ci < n && cj >= 0 && cj < n) s.drops.push({ i: ci, j: cj, t: t });
        }
        s.drops = s.drops.filter(function (dp) { if (t - dp.t > 520) { s.hit[dp.i * n + dp.j] = t; return false; } return true; });
        var xc = (7.5 - half) * c;
        it.push({ k: 'poly', layer: 0, zb: 9, pts: [[xc, floor, -1.45], [xc, floor, 1.45], [xc, floor + 0.95, 1.45], [xc, floor + 0.95, -1.45]], fill: 'rgba(124,196,232,0.14)', stroke: 'rgba(60,140,190,0.45)', sw: 1 });
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            var hgt = 1.25 * H[i * n + j] / mx + 0.03, ht = s.hit[i * n + j], bump = ht ? 0.09 * Math.exp(-(t - ht) / 240) : 0;
            var dist = Math.sqrt((i - half) * (i - half) + (j - half) * (j - half)), gr = REDUCED ? 1 : backOut((api.age - dist * 90) / 900);
            var col = cmap(RAMP, hgt / 1.28);
            if (i >= 8) col = mix(col, hex('#7cc4e8'), 0.55);
            var x0 = (i - half) * c - 0.1, z0 = (j - half) * c - 0.1;
            it.push({ k: 'box', min: [x0, floor, z0], max: [x0 + 0.2, floor + Math.max(0.01, (hgt + bump) * gr), z0 + 0.2], pal: palFrom(col), a: 0.97 });
          }
        }
        s.drops.forEach(function (dp) {
          var f = (t - dp.t) / 520, top = floor + 1.25 * H[dp.i * n + dp.j] / mx + 0.06;
          it.push({ k: 'pt', layer: 3, p: [(dp.i - half) * c, lerp(1.05, top, f * f), (dp.j - half) * c], r: 3.2, pal: P3('#ffffff'), a: 0.95 });
        });
        it.push({ k: 'txt', layer: 6, p: [xc + 0.4, floor + 1.02, -1.3], text: 'tail', size: 10, weight: 600, col: '#2b7a9e' });
        it.push({ k: 'txt', layer: 6, p: [-1.0, floor + 1.12, -1.35], text: '\u03C1 = ' + rho.toFixed(2), size: 11, weight: 700, col: '#1e4e79' });
        return it;
      }
    }
  };

  /* ------------------------------------------------------------------ one small 3D toy per project */
  function show0(s, e) { s.p0 = e.t; }
  function ecgY(q) {
    if (q < 0.38) return 0;
    if (q < 0.42) return 0.04 * Math.sin((q - 0.38) / 0.04 * Math.PI);
    if (q < 0.46) return 0;
    if (q < 0.48) return -0.05 * (q - 0.46) / 0.02;
    if (q < 0.5) return -0.05 + 0.37 * (q - 0.48) / 0.02;
    if (q < 0.53) return 0.32 - 0.44 * (q - 0.5) / 0.03;
    if (q < 0.56) return -0.12 + 0.12 * (q - 0.53) / 0.03;
    if (q < 0.62) return 0;
    if (q < 0.72) return 0.07 * Math.sin((q - 0.62) / 0.1 * Math.PI);
    return 0;
  }
  /* ------------------------------------------------------------------ little drawings used by the project toys */
  function v3norm(v) { var m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; }
  function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function airplane(pos, dir, s, tail, alpha) {
    var f = v3norm(dir), r = v3cross(f, [0, 1, 0]);
    if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 1e-6) r = [0, 0, 1];
    r = v3norm(r);
    var u = v3cross(r, f), a = alpha == null ? 1 : alpha;
    function W(x, y, z) { return [pos[0] + (f[0] * x + r[0] * y + u[0] * z) * s, pos[1] + (f[1] * x + r[1] * y + u[1] * z) * s, pos[2] + (f[2] * x + r[2] * y + u[2] * z) * s]; }
    var edge = 'rgba(120,132,148,' + (0.8 * a) + ')', wing = rgba(hex('#dfe5ee'), a), body = rgba(hex('#ffffff'), a), side = rgba(hex('#f1f4f8'), a), tc = rgba(hex(tail), a);
    return [
      { k: 'poly', pts: [W(0.18, 0.08, -0.03), W(-0.22, 1.0, -0.03), W(-0.42, 1.0, -0.03), W(-0.25, 0.08, -0.03)], fill: wing, stroke: edge, sw: 0.6 },
      { k: 'poly', pts: [W(0.18, -0.08, -0.03), W(-0.22, -1.0, -0.03), W(-0.42, -1.0, -0.03), W(-0.25, -0.08, -0.03)], fill: wing, stroke: edge, sw: 0.6 },
      { k: 'poly', pts: [W(-0.7, 0.06, 0), W(-0.92, 0.42, 0), W(-1.02, 0.42, 0), W(-0.92, 0.06, 0)], fill: wing, stroke: edge, sw: 0.5 },
      { k: 'poly', pts: [W(-0.7, -0.06, 0), W(-0.92, -0.42, 0), W(-1.02, -0.42, 0), W(-0.92, -0.06, 0)], fill: wing, stroke: edge, sw: 0.5 },
      { k: 'poly', pts: [W(1.0, 0, 0), W(0.72, 0.12, 0), W(-0.85, 0.1, 0), W(-1.04, 0, 0), W(-0.85, -0.1, 0), W(0.72, -0.12, 0)], fill: body, stroke: edge, sw: 0.6 },
      { k: 'poly', pts: [W(1.0, 0, 0), W(0.74, 0, 0.12), W(-0.8, 0, 0.11), W(-1.04, 0, 0.04), W(-0.96, 0, -0.07), W(0.7, 0, -0.12)], fill: side, stroke: edge, sw: 0.6 },
      { k: 'poly', pts: [W(-0.6, 0, 0.1), W(-0.94, 0, 0.62), W(-1.07, 0, 0.62), W(-1.0, 0, 0.05)], fill: tc, stroke: edge, sw: 0.5 },
      { k: 'poly', pts: [W(0.86, 0, 0.05), W(0.7, 0, 0.1), W(0.62, 0, 0.06), W(0.78, 0, 0.02)], fill: rgba(hex('#3b4a5e'), a) }
    ];
  }
  function drawClock(ctx, x, y, k, it) {
    var R = it.size * k, t = it.t || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#e5534b'; ctx.stroke();
    ctx.strokeStyle = '#3b4a5e'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    var a1 = t * 0.004, a2 = t * 0.0006;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * R * 0.7, Math.sin(a1) * R * 0.7);
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a2) * R * 0.45, Math.sin(a2) * R * 0.45); ctx.stroke();
    ctx.restore();
  }
  function drawBrain(ctx, x, y, k, it) {
    var R = it.size * k * (1 + 0.05 * (it.glow || 0)), gl = it.glow || 0, t = it.t || 0, i;
    ctx.save();
    ctx.translate(x, y);
    var halo = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 2.1);
    halo.addColorStop(0, 'rgba(255,160,205,' + (0.25 + 0.4 * gl) + ')');
    halo.addColorStop(1, 'rgba(255,160,205,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, R * 2.1, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-R * 0.62, R * 0.52, R * 0.42, R * 0.28, 0.15, 0, 6.2832);
    ctx.fillStyle = '#e48db3'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#b84f7e'; ctx.stroke();
    ctx.strokeStyle = 'rgba(184,79,126,0.7)';
    for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-R * 0.62, R * 0.52, R * (0.34 - i * 0.1), R * (0.2 - i * 0.06), 0.15, 0.2, 2.9); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.55); ctx.quadraticCurveTo(-R * 0.15, R * 0.95, -R * 0.02, R * 1.05); ctx.lineTo(R * 0.14, R * 1.0); ctx.quadraticCurveTo(R * 0.05, R * 0.75, R * 0.12, R * 0.5);
    ctx.closePath(); ctx.fillStyle = '#e9a0c1'; ctx.fill(); ctx.strokeStyle = '#b84f7e'; ctx.stroke();
    var pts = [];
    for (i = 0; i < 52; i++) {
      var a = i / 52 * 6.2832, rr = 1 + 0.06 * Math.sin(a * 9 + 0.6) + 0.03 * Math.sin(a * 14 + 1.3);
      var px = Math.cos(a) * R * 1.12 * rr, py = Math.sin(a) * R * 0.8 * rr;
      if (py > R * 0.38) py = R * 0.38 + (py - R * 0.38) * 0.35;
      pts.push([px, py]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[51][0] + pts[0][0]) / 2, (pts[51][1] + pts[0][1]) / 2);
    for (i = 0; i < 52; i++) { var p = pts[i], q = pts[(i + 1) % 52]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    var gb = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.1, 0, 0, R * 1.25);
    gb.addColorStop(0, '#ffe6f0'); gb.addColorStop(0.55, '#f7a8c8'); gb.addColorStop(1, '#d66d9c');
    ctx.fillStyle = gb; ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = '#b84f7e'; ctx.stroke();
    ctx.strokeStyle = 'rgba(176,72,120,0.75)'; ctx.lineWidth = 1.15; ctx.lineCap = 'round';
    function sq(x0, y0, x1, y1, n, amp) {
      ctx.beginPath(); ctx.moveTo(x0, y0);
      for (var j = 1; j <= n; j++) {
        var u = j / n, xm = lerp(x0, x1, u - 0.5 / n), ym = lerp(y0, y1, u - 0.5 / n), nx = -(y1 - y0), ny = x1 - x0, nm = Math.sqrt(nx * nx + ny * ny) || 1;
        ctx.quadraticCurveTo(xm + nx / nm * amp * (j % 2 ? 1 : -1), ym + ny / nm * amp * (j % 2 ? 1 : -1), lerp(x0, x1, u), lerp(y0, y1, u));
      }
      ctx.stroke();
    }
    sq(R * 0.05, -R * 0.78, -R * 0.12, R * 0.3, 4, R * 0.1);
    sq(-R * 0.85, R * 0.12, R * 0.15, R * 0.05, 4, R * 0.09);
    sq(R * 0.35, -R * 0.6, R * 0.75, R * 0.1, 3, R * 0.1);
    sq(-R * 0.55, -R * 0.55, -R * 0.3, -R * 0.05, 3, R * 0.09);
    sq(-R * 0.95, -R * 0.2, -R * 0.55, -R * 0.35, 2, R * 0.08);
    sq(R * 0.45, R * 0.25, R * 0.95, R * 0.05, 2, R * 0.08);
    var spots = [[-0.45, -0.3], [0.25, -0.45], [0.6, -0.15], [-0.2, 0.2], [0.35, 0.15], [-0.7, 0.0]];
    for (i = 0; i < spots.length; i++) {
      var on = (0.5 + 0.5 * Math.sin(t * 0.006 + i * 1.7)) * (0.35 + 0.65 * gl);
      if (on < 0.15) continue;
      var sx = spots[i][0] * R, sy = spots[i][1] * R, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.28);
      sg.addColorStop(0, 'rgba(255,240,130,' + on + ')'); sg.addColorStop(1, 'rgba(255,240,130,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, R * 0.28, 0, 6.2832); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.42, R * 0.32, R * 0.14, -0.4, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#2b3a4f'; ctx.lineWidth = Math.max(2, R * 0.16);
    ctx.beginPath(); ctx.arc(0, R * 0.05, R * 1.22, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    [[-1.18, '#d9b26a'], [1.18, '#2a9d8f']].forEach(function (cup) {
      ctx.fillStyle = cup[1]; ctx.strokeStyle = '#2b3a4f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(cup[0] * R, R * 0.12, R * 0.22, R * 0.36, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }



  var PROJECT_SCENES = {
    lean: {
      pitch: 0.14, spanX: 3.5, spanY: 2.1, offY: 0.0, hoverYaw: 0.34, hoverPitch: 0.1,
      init: function (s) {
        s.code = ['theorem bellman_opt', '  (M : MDP S A) :', '  M.V\u22C6 = M.T M.V\u22C6 := by', '  apply fixed_pt_unique', '  exact M.contraction', '  simp [pg_theorem]'];
        s.lc = ['#1f6f9f', '#4b5c72', '#0f8b8d', '#1f6f9f', '#1f6f9f', '#1f6f9f'];
        s.N = [[0.35, 0.1, 0], [0.9, 0.42, -0.15], [1.45, 0.04, 0], [0.9, -0.36, 0.12]];
        s.E = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
        var R = [0.1, 0.5, 1.0, 0.2], V = [0, 0, 0, 0], succ = [[], [], [], []], k, a;
        s.E.forEach(function (e) { succ[e[0]].push(e[1]); });
        s.V = [V.slice()];
        for (k = 0; k < 8; k++) { var nv = []; for (a = 0; a < 4; a++) nv.push(R[a] + 0.8 * Math.max.apply(null, succ[a].map(function (b) { return s.V[k][b]; }))); s.V.push(nv); }
        var top = Math.max.apply(null, s.V[8]);
        s.V = s.V.map(function (row) { return row.map(function (v) { return v / top; }); });
        s.pol = succ.map(function (list) { return list.reduce(function (best, b) { return s.V[8][b] > s.V[8][best] ? b : best; }, list[0]); });
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], i, LT = 560, nL = s.code.length, total = nL * LT + 2800;
        if (el > total) { if (api.hovering) { s.p0 = api.t; el = 0; } else el = total; }
        var x0 = -1.72, x1 = -0.02, y0 = -0.52, y1 = 0.56;
        it.push({ k: 'poly', layer: 0, pts: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], fill: 'rgba(255,255,255,0.97)', stroke: 'rgba(160,175,200,0.85)', sw: 1 });
        it.push({ k: 'poly', layer: 0, zb: 1, pts: [[x0, y1 - 0.12, 0], [x1, y1 - 0.12, 0], [x1, y1, 0], [x0, y1, 0]], fill: '#dbeefa' });
        ['#ff8a80', '#ffd166', '#7bd389'].forEach(function (c, k) { it.push({ k: 'pt', layer: 1, p: [x0 + 0.08 + k * 0.08, y1 - 0.06, 0.01], r: 2.6, pal: P3(c) }); });
        it.push({ k: 'poly', layer: 1, pts: [[x1 - 0.74, y1 - 0.105, 0.01], [x1 - 0.05, y1 - 0.105, 0.01], [x1 - 0.05, y1 - 0.015, 0.01], [x1 - 0.74, y1 - 0.015, 0.01]], fill: '#1f6f9f' });
        it.push({ k: 'txt', layer: 3, p: [x1 - 0.395, y1 - 0.06, 0.02], text: 'LLM \u2726 assist', size: 7, weight: 700, col: '#ffffff' });
        for (i = 0; i < nL; i++) {
          var f = REDUCED ? 1 : clamp((el - i * LT) / (LT * 0.75), 0, 1);
          if (f <= 0) continue;
          var ly = y1 - 0.21 - i * 0.135, txt = s.code[i].slice(0, Math.max(1, Math.round(s.code[i].length * f)));
          it.push({ k: 'txt', layer: 2, p: [x0 + 0.07, ly, 0.01], text: txt, size: 8.2, weight: 500, col: s.lc[i], align: 'left', family: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace' });
          var ck = REDUCED ? 1 : clamp((el - i * LT - LT * 0.8) / 220, 0, 1);
          if (ck > 0) {
            it.push({ k: 'pt', layer: 2, p: [x1 - 0.09, ly, 0.02], r: 5 * backOut(ck), pal: P3('#22c55e') });
            it.push({ k: 'txt', layer: 3, p: [x1 - 0.09, ly, 0.03], text: '\u2713', size: 8, weight: 700, col: '#ffffff', alpha: ck });
          }
        }
        var qed = REDUCED ? 1 : clamp((el - nL * LT) / 400, 0, 1);
        if (qed > 0) it.push({ k: 'txt', layer: 4, p: [x1 - 0.32, y0 + 0.09, 0.03], text: 'QED \u220E', size: 10.5, weight: 700, col: '#1f6f9f', alpha: qed });
        it.push({ k: 'txt', layer: 4, p: [(x0 + x1) / 2, y0 - 0.14, 0], text: '40+ machine-checked results', size: 9.5, weight: 600, col: '#15803d' });
        var sweep = REDUCED ? 8 : Math.min(8, Math.floor(el / 450)), Vs = s.V[sweep];
        for (i = 0; i < s.E.length; i++) {
          var A = s.N[s.E[i][0]], B = s.N[s.E[i][1]], best = s.pol[s.E[i][0]] === s.E[i][1] && sweep >= 8;
          var dx = B[0] - A[0], dy = B[1] - A[1], L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L, pts = [];
          for (var k = 0; k <= 12; k++) { var u = 0.14 + 0.72 * k / 12, bow = Math.sin(Math.PI * u) * 0.1; pts.push([A[0] + dx * u + nx * bow, A[1] + dy * u + ny * bow, lerp(A[2], B[2], u)]); }
          var colE = best ? '#0f8b8d' : 'rgba(150,165,190,0.6)';
          it.push({ k: 'pl', pts: pts, col: colE, w: best ? 2.2 : 1.2 });
          var e2 = pts[12], e1 = pts[10], ux = e2[0] - e1[0], uy = e2[1] - e1[1], ul = Math.sqrt(ux * ux + uy * uy) || 1;
          ux /= ul; uy /= ul;
          it.push({ k: 'poly', pts: [[e2[0] + ux * 0.05, e2[1] + uy * 0.05, e2[2]], [e2[0] - uy * 0.035, e2[1] + ux * 0.035, e2[2]], [e2[0] + uy * 0.035, e2[1] - ux * 0.035, e2[2]]], fill: colE });
        }
        var RW = ['', '+\u00BD', '+1', ''];
        for (i = 0; i < 4; i++) {
          it.push({ k: 'pt', layer: 2, p: s.N[i], r: 7 + 4 * Vs[i], pal: palFrom(mix(hex('#e3f2fd'), hex('#2a9d8f'), Vs[i])) });
          if (RW[i]) it.push({ k: 'txt', layer: 5, p: [s.N[i][0] + 0.17, s.N[i][1] + 0.15, s.N[i][2]], text: RW[i], size: 9, weight: 700, col: '#e9a23b' });
        }
        it.push({ k: 'txt', layer: 5, p: [0.9, 0.72, 0], text: '\u03B8 \u2190 \u03B8 + \u03B1\u2207J(\u03B8)', size: 9.5, weight: 600, col: '#1f6f9f', family: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace' });
        it.push({ k: 'txt', layer: 5, p: [0.9, -0.64, 0], text: 'Bellman updates', size: 9.5, col: '#4b5c72' });
        if (!REDUCED && sweep >= 8) {
          var ph = (el - 8 * 450) / 650, step = Math.floor(ph), fr = ph - step, cur = 0;
          for (var h = 0; h < step; h++) cur = s.pol[cur];
          var P0 = s.N[cur], P1 = s.N[s.pol[cur]], ag = lerp3(P0, P1, ease(fr));
          ag[1] += 0.2 + 0.18 * Math.sin(Math.PI * fr);
          it.push({ k: 'pt', layer: 4, p: ag, r: 6.5, pal: P3('#ffd166'), style: 'face' });
        }
        return it;
      }
    },

    dca: {
      pitch: 0.24, spanX: 3.5, spanY: 2.2, offY: 0.0, hoverYaw: 0.34, hoverPitch: 0.1,
      init: function (s) {
        var r = rng(33), v = 0, raw = [], i;
        for (i = 0; i < 24; i++) { v += (r() - 0.5) * 0.2 + 0.05 * Math.sin(i * 0.6); raw.push(v); }
        var lo = Math.min.apply(null, raw), hi = Math.max.apply(null, raw);
        s.price = raw.map(function (p) { return (p - lo) / (hi - lo); });
        s.cum = [[0, 0]];
        for (i = 0; i < 24; i++) { var buy = clamp(1.7 - s.price[i] * 1.6, 0.25, 1.7); s.cum.push([s.cum[i][0] + 1, s.cum[i][1] + buy]); }
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], i, n = 24, stepT = 150, intro = 1500, done = intro + n * stepT, total = done + 2800, floor = -0.58;
        if (el > total) { if (api.hovering) { s.p0 = api.t; el = 0; } else el = total; }
        var run = Math.max(0, el - intro), k = REDUCED ? n : Math.min(n, Math.floor(run / stepT)), fr = REDUCED ? 1 : clamp((run - k * stepT) / stepT, 0, 1);
        function X(j) { return -1.55 + j * 0.088; }
        function Y(j) { return -0.25 + s.price[j] * 0.75; }
        it.push({ k: 'poly', layer: 0, pts: [[-1.62, -0.4, -0.3], [0.55, -0.4, -0.3], [0.55, 0.62, -0.3], [-1.62, 0.62, -0.3]], fill: 'rgba(255,255,255,0.88)', stroke: 'rgba(200,210,225,0.9)', sw: 1 });
        var all = [], seen = [];
        for (i = 0; i < n; i++) { all.push([X(i), Y(i), -0.28]); if (i <= k) seen.push([X(i), Y(i), -0.28]); }
        it.push({ k: 'pl', layer: 1, pts: all, col: 'rgba(247,147,26,0.22)', w: 1.4 });
        if (seen.length > 1 && el > intro) it.push({ k: 'pl', layer: 1, pts: seen, col: '#f7931a', w: 2 });
        if (el > intro) for (i = 0; i <= Math.min(k, n - 1); i++) {
          if (s.price[i] < 0.3) it.push({ k: 'pt', layer: 2, p: [X(i), Y(i), -0.27], r: 3, pal: P3('#22c55e') });
          else if (s.price[i] > 0.8) it.push({ k: 'pt', layer: 2, p: [X(i), Y(i), -0.27], r: 3, pal: P3('#ef4444') });
        }
        if (k < n && el > intro) it.push({ k: 'ln', layer: 2, a: [X(k), -0.4, -0.27], b: [X(k), 0.62, -0.27], col: 'rgba(31,111,159,0.6)', w: 1.2, dash: [3, 3] });
        [['on-chain', '#3d93c9'], ['institutional', '#e9a23b'], ['prediction markets', '#2a9d8f']].forEach(function (src, si) {
          var sx = [-1.66, -0.98, 0.0][si], on = REDUCED ? 1 : clamp((el - si * 180) / 300, 0, 1);
          it.push({ k: 'pt', layer: 4, p: [sx, 0.76, -0.3], r: 3.2, pal: P3(src[1]), a: on });
          it.push({ k: 'txt', layer: 5, p: [sx + 0.06, 0.76, -0.3], text: src[0], size: 7.5, weight: 600, col: '#4b5c72', align: 'left', alpha: on });
        });
        if (!REDUCED && el < intro + 400) {
          var bf = clamp(el / 1100, 0, 1), bi = Math.min(n - 1, Math.floor(bf * 7)), bxy = [lerp(X(0), X(7), bf), lerp(Y(0), Y(7), bf) + 0.06, -0.26];
          var caught = el > 1100, fade = caught ? clamp(1 - (el - 1100) / 700, 0, 1) : 1;
          it.push({ k: 'sprite', layer: 5, p: bxy, size: 5.5, a: fade, t: el, draw: function (ctx, x, y, kk, o) {
            var R2 = o.size * kk; ctx.save(); ctx.globalAlpha = o.a; ctx.translate(x, y);
            ctx.fillStyle = '#1f1a17'; ctx.beginPath(); ctx.arc(R2 * 0.9, 0, R2 * 0.45, 0, 6.2832); ctx.fill();
            ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, 0, R2, 0, 6.2832); ctx.fill();
            ctx.strokeStyle = '#1f1a17'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-R2, 0); ctx.lineTo(R2, 0); ctx.stroke();
            ctx.fillStyle = '#1f1a17'; [[-0.45, -0.45], [0.35, -0.5], [-0.4, 0.45], [0.4, 0.45]].forEach(function (d) { ctx.beginPath(); ctx.arc(d[0] * R2, d[1] * R2, R2 * 0.18, 0, 6.2832); ctx.fill(); });
            ctx.restore();
          } });
          if (caught) {
            it.push({ k: 'sprite', layer: 6, p: bxy, size: 11, a: fade, draw: function (ctx, x, y, kk, o) { ctx.save(); ctx.globalAlpha = o.a; ctx.strokeStyle = '#1f6f9f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, o.size * kk, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + o.size * kk * 0.7, y + o.size * kk * 0.7); ctx.lineTo(x + o.size * kk * 1.4, y + o.size * kk * 1.4); ctx.stroke(); ctx.restore(); } });
            it.push({ k: 'txt', layer: 6, p: [bxy[0] + 0.3, bxy[1] + 0.12, -0.25], text: 'look-ahead bias fixed \u2713', size: 8.5, weight: 700, col: '#15803d', alpha: fade });
          }
        }
        var JARS = [{ x: 0.8, lab: 'DCA', idx: 0, score: '39.73%' }, { x: 1.52, lab: 'strategy', idx: 1, score: '70.71%' }];
        JARS.forEach(function (J) {
          var amt = lerp(s.cum[k][J.idx], s.cum[Math.min(n, k + 1)][J.idx], k < n ? fr : 0), h = amt * 0.021;
          if (el <= intro) h = 0;
          it.push({ k: 'pl', layer: 0, zb: 4, pts: ring([J.x, floor, 0], 0.22, 20, 'xz'), closed: true, fill: 'rgba(40,60,90,0.1)' });
          if (h > 0.004) it.push({ k: 'cyl', b: [J.x, floor + 0.01, 0], r: 0.16, h: h, n: 18, pal: P3(J.idx ? '#f5b301' : '#cbd5e1') });
          if (k < n && el > intro && !REDUCED) {
            var yy = lerp(0.55, floor + 0.01 + h, fr * fr), rr = J.idx ? 0.06 + 0.04 * (1.7 - s.price[k] * 1.6) / 1.7 : 0.07;
            it.push({ k: 'cyl', layer: 2, b: [J.x, yy, 0], r: rr, h: 0.018, n: 14, pal: P3(J.idx ? '#f5b301' : '#cbd5e1') });
          }
          it.push({ k: 'cyl', layer: 3, b: [J.x, floor, 0], r: 0.2, h: 0.62, n: 22, pal: P3('#cfe8f5'), a: 0.22 });
          it.push({ k: 'pl', layer: 3, zb: 1, pts: ring([J.x, floor + 0.62, 0], 0.2, 22, 'xz'), closed: true, col: 'rgba(120,170,200,0.8)', w: 1.2 });
          it.push({ k: 'txt', layer: 5, p: [J.x, floor - 0.13, 0.05], text: J.lab, size: 10, weight: 600, col: '#4b5c72' });
          if (k >= n) {
            var pop = REDUCED ? 1 : backOut((el - done - (J.idx ? 300 : 0)) / 600);
            if (pop > 0) it.push({ k: 'txt', layer: 6, p: [J.x, floor + 0.76 + 0.05 * pop, 0], text: J.score, size: 10 * clamp(pop, 0.3, 1.1), weight: 700, col: J.idx ? '#c27c00' : '#64748b' });
            if (J.idx && pop > 0.5) it.push({ k: 'txt', layer: 6, p: [J.x, floor + 0.93, 0], text: '74.70% held-out', size: 8, weight: 600, col: '#15803d', alpha: clamp((pop - 0.5) * 2, 0, 1) });
          }
        });
        return it;
      }
    },

    press: {
      pitch: 0.32, spanX: 3.4, spanY: 2.0, offY: 0.0, hoverYaw: 0.34, hoverPitch: 0.1,
      init: function (s) { s.p0 = null; },
      show: show0,
      build: function (s, api) {
        var it = [], floor = -0.55, t = REDUCED ? 0 : api.t, sp = api.hovering ? 1.8 : 1, i, k;
        it.push({ k: 'pl', layer: 0, pts: [[-1.65, floor, -0.62], [1.55, floor, -0.62], [1.55, floor, 0.6], [-1.65, floor, 0.6]], closed: true, fill: 'rgba(232,238,246,0.8)', col: 'rgba(180,195,215,0.8)', w: 1 });
        var DB = [{ z: -0.34, c: '#5b8fd6' }, { z: 0.02, c: '#3fa7b5' }, { z: 0.38, c: '#e9a23b' }];
        DB.forEach(function (d, di) {
          for (k = 0; k < 3; k++) it.push({ k: 'cyl', b: [-1.38, floor + k * 0.09, d.z], r: 0.13, h: 0.075, n: 16, pal: P3(d.c) });
          var pts = [];
          for (k = 0; k <= 14; k++) { var u = k / 14; pts.push([lerp(-1.25, -0.5, u), floor + 0.22 + Math.sin(u * Math.PI) * 0.12, lerp(d.z, 0, u * u)]); }
          it.push({ k: 'pl', layer: 0, zb: 6, pts: pts, col: rgba(hex(d.c), 0.35), w: 2.2 });
          for (k = 0; k < 3; k++) {
            var f = REDUCED ? (k + 1) / 4 : ((t * 0.0006 * sp + k / 3 + di * 0.21) % 1), q = pts[Math.min(14, Math.floor(f * 14))];
            it.push({ k: 'pt', layer: 2, p: q, r: 3, pal: P3(d.c) });
          }
        });
        var cycle = 900 / sp, ph = REDUCED ? 0.5 : (t % cycle) / cycle, squash = Math.sin(ph * Math.PI * 2) * 0.012;
        it.push({ k: 'box', min: [-0.5, floor, -0.32], max: [0.25, floor + 0.36 + squash, 0.32], pal: P3('#a9c7e8') });
        it.push({ k: 'box', min: [-0.42, floor + 0.36 + squash, -0.24], max: [0.17, floor + 0.44 + squash, 0.24], pal: P3('#cfe7f5') });
        var fz = 0.322, fyb = floor + 0.2 + squash * 0.5;
        it.push({ k: 'pt', layer: 2, p: [-0.24, fyb + 0.04, fz], r: 2.6, pal: P3('#3b2f2a') });
        it.push({ k: 'pt', layer: 2, p: [-0.02, fyb + 0.04, fz], r: 2.6, pal: P3('#3b2f2a') });
        var smile = [];
        for (var sm = 0; sm <= 8; sm++) { var su = sm / 8; smile.push([-0.21 + su * 0.16, fyb - 0.05 - Math.sin(su * Math.PI) * 0.04, fz]); }
        it.push({ k: 'pl', layer: 2, pts: smile, col: '#3b2f2a', w: 1.4 });
        it.push({ k: 'pt', layer: 2, p: [-0.31, fyb - 0.03, fz], r: 2.4, pal: P3('#ffcfa8'), a: 0.8 });
        it.push({ k: 'pt', layer: 2, p: [0.07, fyb - 0.03, fz], r: 2.4, pal: P3('#ffcfa8'), a: 0.8 });
        it.push({ k: 'pt', layer: 2, p: [-0.12, floor + 0.47 + squash, 0], r: 3.2, pal: P3(ph < 0.5 ? '#22c55e' : '#a7f3d0') });
        it.push({ k: 'cyl', axis: 'z', b: [0.3, floor + 0.2, -0.26], r: 0.06, h: 0.52, n: 14, pal: P3('#5d6675') });
        it.push({ k: 'cyl', axis: 'z', b: [0.3, floor + 0.07, -0.26], r: 0.06, h: 0.52, n: 14, pal: P3('#5d6675') });
        var sheetCols = [['#5b8fd6', '#3fa7b5', '#f59e0b'], ['#2a9d8f', '#22c55e', '#ef4444'], ['#3fa7b5', '#f59e0b', '#5b8fd6']];
        function sheet(cx, cy, cz, rot, idx, al) {
          var w = 0.26, d = 0.2, cs = Math.cos(rot), sn = Math.sin(rot);
          function P(x, z) { return [cx + x * cs - z * sn, cy, cz + x * sn + z * cs]; }
          it.push({ k: 'poly', layer: 2, zb: cy, pts: [P(-w, -d), P(w, -d), P(w, d), P(-w, d)], fill: 'rgba(255,255,255,' + al + ')', stroke: 'rgba(170,185,205,' + al + ')', sw: 0.8 });
          var cols = sheetCols[idx % 3];
          for (var b = 0; b < 3; b++) {
            var bx = -0.16 + b * 0.1, bh = 0.05 + 0.04 * ((idx + b) % 3);
            it.push({ k: 'poly', layer: 2, zb: cy + 0.001, pts: [P(bx, 0.12), P(bx + 0.06, 0.12), P(bx + 0.06, 0.12 - bh * 2), P(bx, 0.12 - bh * 2)], fill: rgba(hex(cols[b]), al) });
          }
          it.push({ k: 'pl', layer: 2, zb: cy + 0.002, pts: [P(0.05, 0.08), P(0.1, 0.0), P(0.15, 0.04), P(0.21, -0.1)], col: rgba(hex('#1f6f9f'), al), w: 1.2 });
        }
        var made = REDUCED ? 6 : Math.floor(t * sp / 900), pile = Math.min(6, made);
        for (i = 0; i < pile; i++) sheet(1.05, floor + 0.01 + i * 0.012, 0.02, (i % 3 - 1) * 0.12, made - pile + i, 1);
        if (!REDUCED) {
          var fly = ph, sx = lerp(0.38, 1.05, ease(fly)), sy = lerp(floor + 0.14, floor + 0.02 + pile * 0.012, ease(fly)) + 0.18 * Math.sin(Math.PI * fly);
          sheet(sx, sy, 0.02, fly * 0.3, made + 1, 1);
          var badge = made % 4;
          if (badge === 1 || badge === 3) {
            var bf = ph;
            it.push({ k: 'txt', layer: 6, p: [1.05, floor + 0.35 + bf * 0.25, 0.05], text: badge === 1 ? '+10% efficiency' : '+20% retention', size: 10, weight: 700, col: badge === 1 ? '#15803d' : '#0e7490', alpha: Math.sin(Math.PI * bf) });
          }
        }
        it.push({ k: 'txt', layer: 5, p: [-1.38, floor - 0.12, 0.55], text: 'SQL sources', size: 9.5, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 5, p: [1.05, floor - 0.12, 0.45], text: 'KPI reports', size: 9.5, col: '#4b5c72' });
        return it;
      }
    },

    hoop: {
      pitch: 0.26, spanX: 3.4, spanY: 1.95, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.14,
      init: function (s) { s.p0 = null; s.shots = []; s.hist = []; s.makes = 0; s.att = 0; s.streak = 0; s.r = rng(12); s.cur = null; },
      show: function (s, e) { s.p0 = e.t; s.cur = null; },
      build: function (s, api) {
        var it = [], floor = -0.62, rim = [0.75, 0.44, -0.28], el = startPlay(s, api), i;
        if (el > 2700 && api.hovering) { s.p0 = api.t; el = 0; s.cur = null; }
        if (!s.cur) {
          var ang = 0.35 + s.r() * 2.44, rr = 0.55 + s.r() * 0.5;
          s.cur = { x: clamp(rim[0] + Math.cos(ang) * rr * 1.3, -1.35, 1.2), z: clamp(rim[2] + Math.sin(ang) * rr, -0.2, 0.45), make: s.r() < clamp(0.45 + 0.06 * s.streak, 0.3, 0.75), logged: false };
        }
        var start = [s.cur.x, 0.05, s.cur.z], shot = 1100, fall = 420, ball, rot = el * 0.012, alpha = 1, msg = null, wig = 0;
        it.push({ k: 'pl', layer: 0, pts: [[-1.55, floor, -0.7], [1.35, floor, -0.7], [1.35, floor, 0.55], [-1.55, floor, 0.55]], closed: true, fill: 'rgba(241,213,166,0.7)', col: 'rgba(196,150,90,0.6)' });
        for (i = 0; i < 6; i++) it.push({ k: 'ln', layer: 0, zb: 1, a: [-1.55 + i * 0.48, floor, -0.7], b: [-1.55 + i * 0.48, floor, 0.55], col: 'rgba(196,150,90,0.18)' });
        it.push({ k: 'pl', layer: 0, zb: 2, pts: [[0.47, floor, -0.62], [1.03, floor, -0.62], [1.03, floor, 0.12], [0.47, floor, 0.12]], closed: true, fill: 'rgba(235,130,60,0.3)', col: 'rgba(255,255,255,0.95)', w: 1.2 });
        it.push({ k: 'pl', layer: 0, zb: 3, pts: ring([0.75, floor, 0.12], 0.26, 24, 'xz'), closed: true, col: 'rgba(255,255,255,0.95)', w: 1.2 });
        var arc = [];
        for (i = 0; i <= 30; i++) { var a3 = 0.12 * Math.PI + i / 30 * 0.76 * Math.PI; arc.push([rim[0] + Math.cos(a3) * 1.18, floor, rim[2] + Math.sin(a3) * 0.78]); }
        it.push({ k: 'pl', layer: 0, zb: 3, pts: arc, col: 'rgba(255,255,255,0.95)', w: 1.3 });
        s.shots.forEach(function (sh) {
          if (sh.make) it.push({ k: 'pl', layer: 0, zb: 6, pts: ring([sh.x, floor, sh.z], 0.05, 12, 'xz'), closed: true, col: '#16a34a', w: 1.8 });
          else {
            it.push({ k: 'ln', layer: 0, zb: 6, a: [sh.x - 0.04, floor, sh.z - 0.04], b: [sh.x + 0.04, floor, sh.z + 0.04], col: '#dc2626', w: 1.8 });
            it.push({ k: 'ln', layer: 0, zb: 6, a: [sh.x - 0.04, floor, sh.z + 0.04], b: [sh.x + 0.04, floor, sh.z - 0.04], col: '#dc2626', w: 1.8 });
          }
        });
        it.push({ k: 'box', min: [rim[0] - 0.03, floor, -0.62], max: [rim[0] + 0.03, 0.6, -0.56], pal: P3('#8b95a7') });
        it.push({ k: 'box', min: [rim[0] - 0.02, 0.52, -0.56], max: [rim[0] + 0.02, 0.56, -0.5], pal: P3('#8b95a7') });
        it.push({ k: 'box', min: [rim[0] - 0.36, 0.32, -0.52], max: [rim[0] + 0.36, 0.86, -0.48], pal: P3('#f3f6f9'), a: 0.97 });
        it.push({ k: 'pl', zb: 0.05, pts: [[rim[0] - 0.36, 0.32, -0.475], [rim[0] + 0.36, 0.32, -0.475], [rim[0] + 0.36, 0.86, -0.475], [rim[0] - 0.36, 0.86, -0.475]], closed: true, col: '#e04a3a', w: 1.4 });
        it.push({ k: 'pl', zb: 0.05, pts: [[rim[0] - 0.12, 0.42, -0.475], [rim[0] + 0.12, 0.42, -0.475], [rim[0] + 0.12, 0.6, -0.475], [rim[0] - 0.12, 0.6, -0.475]], closed: true, col: '#e04a3a', w: 1.6 });
        if (el < shot) {
          var u = el / shot;
          ball = lerp3(start, [rim[0], rim[1] + 0.1, rim[2]], u); ball[1] += 0.55 * 4 * u * (1 - u);
        } else if (s.cur.make) {
          var v = (el - shot) / fall;
          if (v < 1) { ball = [rim[0], lerp(rim[1] + 0.1, 0.04, ease(v)), rim[2]]; wig = Math.sin(v * Math.PI) * 0.07; }
          else { var w2 = clamp((el - shot - fall) / 700, 0, 1); ball = [rim[0] - w2 * 0.25, floor + 0.11 + 0.32 * Math.abs(Math.sin(w2 * Math.PI * 1.5)) * (1 - w2), rim[2] + w2 * 0.2]; }
          msg = { text: '+2', col: '#e4572e' };
        } else {
          var m = clamp((el - shot) / 800, 0, 1);
          ball = lerp3([rim[0] - 0.12, rim[1] + 0.12, rim[2]], [rim[0] - 0.6, floor + 0.11, 0.25], m); ball[1] += 0.4 * 4 * m * (1 - m);
          msg = { text: 'miss', col: '#8a94a6' };
        }
        if (el > shot + 60 && !s.cur.logged) {
          s.cur.logged = true; s.att++;
          if (s.cur.make) { s.makes++; s.streak++; } else s.streak = 0;
          s.shots.push({ x: s.cur.x, z: s.cur.z, make: s.cur.make }); s.hist.push(s.cur.make ? 1 : 0);
          if (s.shots.length > 14) s.shots.shift();
        }
        if (el > 2100) alpha = clamp(1 - (el - 2100) / 500, 0, 1);
        if (el > 2600) { ball = start.slice(); alpha = 1; msg = null; }
        if (msg && el > shot && el < 2300) {
          var mf = (el - shot) / 1200;
          it.push({ k: 'txt', layer: 6, p: [rim[0] - 0.5, 0.6 + mf * 0.15, rim[2]], text: msg.text, size: 15, weight: 700, col: msg.col, alpha: 1 - mf });
        }
        it.push({ k: 'pl', pts: ring(rim, 0.17, 24, 'xz'), closed: true, col: '#e4572e', w: 2.6 });
        var low = [];
        for (i = 0; i < 12; i++) {
          var an = i / 12 * 6.2832, tp = [rim[0] + Math.cos(an) * 0.17, rim[1], rim[2] + Math.sin(an) * 0.17];
          var bt = [rim[0] + Math.cos(an + 0.3) * (0.1 - wig * 0.3), 0.2 - wig, rim[2] + Math.sin(an + 0.3) * (0.1 - wig * 0.3)];
          low.push(bt);
          it.push({ k: 'ln', a: tp, b: bt, col: 'rgba(120,128,140,0.75)', w: 1 });
        }
        it.push({ k: 'pl', pts: low, closed: true, col: 'rgba(120,128,140,0.75)', w: 1 });
        var px = s.cur.x, pz = s.cur.z + 0.05, jump = el < 520 ? 0.09 * Math.sin(el / 520 * Math.PI) : 0, up = el < 420;
        it.push({ k: 'pl', layer: 0, zb: 9, pts: ring([px, floor, pz], 0.1, 14, 'xz'), closed: true, fill: 'rgba(60,40,20,0.15)' });
        it.push({ k: 'box', min: [px - 0.055, floor + jump, pz - 0.025], max: [px - 0.015, floor + 0.22 + jump, pz + 0.025], pal: P3('#2b3a4f') });
        it.push({ k: 'box', min: [px + 0.015, floor + jump, pz - 0.025], max: [px + 0.055, floor + 0.22 + jump, pz + 0.025], pal: P3('#2b3a4f') });
        it.push({ k: 'cyl', b: [px, floor + 0.22 + jump, pz], r: 0.075, h: 0.22, n: 14, pal: P3('#1f6f9f') });
        it.push({ k: 'txt', layer: 3, p: [px, floor + 0.33 + jump, pz + 0.08], text: '23', size: 8, weight: 700, col: '#ffffff' });
        it.push({ k: 'pt', p: [px, floor + 0.52 + jump, pz], r: 6.5, pal: P3('#e8b88f'), style: 'face' });
        [-1, 1].forEach(function (sd) {
          var sh = [px + sd * 0.07, floor + 0.42 + jump, pz], hd = up ? [px + sd * 0.04, floor + 0.64 + jump, pz] : [px + sd * 0.11, floor + 0.26 + jump, pz + 0.02];
          it.push({ k: 'ln', a: sh, b: hd, col: '#e8b88f', w: 3 });
        });
        var hot = s.streak >= 3;
        if (hot && el < shot && !REDUCED) {
          for (var fk = 1; fk <= 7; fk++) {
            var uf = Math.max(0, (el - fk * 32) / shot), fp = lerp3(start, [rim[0], rim[1] + 0.1, rim[2]], uf);
            fp[1] += 0.55 * 4 * uf * (1 - uf);
            it.push({ k: 'pt', layer: 2, p: fp, r: 5.2 - fk * 0.5, pal: P3(fk % 2 ? '#ff9f43' : '#ffd166'), a: 0.75 - fk * 0.09 });
          }
        }
        if (s.cur.make && el > shot + 180 && el < shot + 1100 && !REDUCED) {
          var cf = (el - shot - 180) / 920, CC = ['#ff9f43', '#ffffff', '#3d93c9', '#2a9d8f', '#ffd166'];
          for (var ck = 0; ck < 10; ck++) {
            var ca = ck / 10 * 6.2832 + 0.3, cd = 0.1 + cf * 0.45;
            it.push({ k: 'pt', layer: 4, p: [rim[0] + Math.cos(ca) * cd, rim[1] + 0.1 + cf * 0.25 - cf * cf * 0.7, rim[2] + Math.sin(ca) * cd * 0.6], r: 2.6, pal: P3(CC[ck % 5]), a: 1 - cf });
          }
        }
        if (hot && alpha > 0.1) it.push({ k: 'sprite', p: ball, zb: -0.01, size: 16, draw: function (ctx, x, y, k) { var g = ctx.createRadialGradient(x, y, 2, x, y, 16 * k); g.addColorStop(0, 'rgba(255,160,40,0.55)'); g.addColorStop(1, 'rgba(255,120,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16 * k, 0, 6.2832); ctx.fill(); } });
        var hgt = clamp((ball[1] - floor) / 1.6, 0, 0.75);
        it.push({ k: 'pl', layer: 0, zb: 10, pts: ring([ball[0], floor, ball[2]], 0.1 * (1 - hgt), 16, 'xz'), closed: true, fill: 'rgba(80,50,20,' + (0.2 * alpha) + ')' });
        it.push({ k: 'pt', p: ball, r: 8.5, pal: P3('#ee7b30'), a: alpha, style: 'basket', rot: rot });
        var am = 0, an = 0, bm = 0, bn = 0;
        for (var hi2 = 1; hi2 < s.hist.length; hi2++) { if (s.hist[hi2 - 1]) { an++; am += s.hist[hi2]; } else { bn++; bm += s.hist[hi2]; } }
        var pA = (am + 1) / (an + 2), pB = (bm + 1) / (bn + 2);
        it.push({ k: 'box', min: [-1.62, 0.06, -0.66], max: [-0.42, 0.72, -0.62], pal: P3('#1f2a3a') });
        it.push({ k: 'txt', layer: 6, p: [-1.54, 0.62, -0.6], text: 'P(make)', size: 8.5, weight: 700, col: '#ffd166', align: 'left' });
        it.push({ k: 'txt', layer: 6, p: [-1.54, 0.47, -0.6], text: 'after a make  ' + Math.round(pA * 100) + '%', size: 7.5, weight: 700, col: '#ff9f43', align: 'left' });
        it.push({ k: 'txt', layer: 6, p: [-1.54, 0.33, -0.6], text: 'after a miss  ' + Math.round(pB * 100) + '%', size: 7.5, weight: 700, col: '#5ec8bb', align: 'left' });
        it.push({ k: 'txt', layer: 6, p: [-1.54, 0.18, -0.6], text: 'FG ' + s.makes + '/' + s.att + (hot ? ', on fire' : ''), size: 7.5, weight: 600, col: hot ? '#ff9f43' : '#9fd3e0', align: 'left' });
        return it;
      }
    },

    pitch: {
      pitch: 0.72, spanX: 3.8, spanY: 2.5, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.14,
      init: function (s) {
        s.A = [[-1.38, 0], [-0.9, -0.45], [-0.95, 0.42], [-0.38, -0.12], [-0.22, 0.5], [0.42, -0.36], [0.62, 0.3]];
        s.B = [[1.38, 0], [0.95, -0.2], [0.9, 0.45], [0.25, 0.05]];
        s.E = [[0, 1, 0.5], [0, 2, 0.4], [1, 3, 0.9], [2, 4, 0.8], [3, 4, 0.6], [3, 5, 0.9], [4, 6, 0.7], [5, 6, 0.5], [1, 2, 0.3], [3, 6, 0.6]];
        s.deg = s.A.map(function () { return 0; });
        s.E.forEach(function (e) { s.deg[e[0]] += e[2]; s.deg[e[1]] += e[2]; });
        s.seq = [0, 1, 3, 5, 6, 4, 3, 6, 5]; s.p0 = null; s.fans = true; s.fanT = -1e9;
        var r = rng(3), cols = ['#2f6fd6', '#e2524a', '#f2c94c', '#ffffff', '#2f6fd6', '#e2524a'];
        s.crowd = [];
        for (var i = 0; i < 26; i++) for (var row = 0; row < 2; row++) s.crowd.push({ p: [-1.7 + i * 0.136, -0.33 + row * 0.08, -1.0 - row * 0.09], c: cols[Math.floor(r() * 6)], ph: r() * 6.28 });
        for (var sd = -1; sd <= 1; sd += 2) for (i = 0; i < 11; i++) for (row = 0; row < 2; row++) s.crowd.push({ p: [sd * (1.85 + row * 0.09), -0.33 + row * 0.08, -0.85 + i * 0.17], c: cols[Math.floor(r() * 6)], ph: r() * 6.28 });
      },
      show: show0,
      tap: function (s, e) { s.fans = !s.fans; s.fanT = e.t; s.p0 = e.t; },
      build: function (s, api) {
        var it = [], g = -0.4, el = startPlay(s, api), i, step = 560, n = s.seq.length - 1, t = api.t;
        if (el > n * step + 900 && api.hovering) { s.p0 = api.t; el = 0; }
        for (i = 0; i < 8; i++) {
          var x0 = -1.6 + i * 0.4;
          it.push({ k: 'pl', layer: 0, pts: [[x0, g, -0.8], [x0 + 0.4, g, -0.8], [x0 + 0.4, g, 0.8], [x0, g, 0.8]], closed: true, fill: i % 2 ? '#43a047' : '#4caf50' });
        }
        [[0.35, -0.3, 0.42, 0.3], [-0.2, 0.35, 0.36, 0.22], [0.9, 0.05, 0.3, 0.32]].forEach(function (hz, hi) {
          var pts = [];
          for (var a = 0; a < 24; a++) { var th = a / 24 * 6.2832; pts.push([hz[0] + Math.cos(th) * hz[2], g, hz[1] + Math.sin(th) * hz[3]]); }
          it.push({ k: 'pl', layer: 0, zb: 2 + hi, pts: pts, closed: true, fill: ['rgba(255,214,90,0.28)', 'rgba(255,160,60,0.24)', 'rgba(255,214,90,0.2)'][hi] });
        });
        var W = 'rgba(255,255,255,0.92)';
        it.push({ k: 'pl', layer: 1, pts: [[-1.6, g, -0.8], [1.6, g, -0.8], [1.6, g, 0.8], [-1.6, g, 0.8]], closed: true, col: W, w: 1.3 });
        it.push({ k: 'ln', layer: 1, a: [0, g, -0.8], b: [0, g, 0.8], col: W, w: 1.2 });
        it.push({ k: 'pl', layer: 1, pts: ring([0, g, 0], 0.25, 28, 'xz'), closed: true, col: W, w: 1.2 });
        [-1, 1].forEach(function (sd) {
          it.push({ k: 'pl', layer: 1, pts: [[1.6 * sd, g, -0.42], [1.22 * sd, g, -0.42], [1.22 * sd, g, 0.42], [1.6 * sd, g, 0.42]], col: W, w: 1.2 });
          it.push({ k: 'pl', layer: 2, pts: [[1.6 * sd, g, -0.17], [1.6 * sd, g + 0.16, -0.17], [1.6 * sd, g + 0.16, 0.17], [1.6 * sd, g, 0.17]], col: W, w: 1.6 });
          it.push({ k: 'pl', layer: 2, pts: [[1.6 * sd, g + 0.16, -0.17], [1.7 * sd, g + 0.12, -0.17], [1.7 * sd, g + 0.12, 0.17], [1.6 * sd, g + 0.16, 0.17]], closed: true, fill: 'rgba(255,255,255,0.35)', col: 'rgba(255,255,255,0.6)', w: 0.8 });
        });
        it.push({ k: 'box', layer: 0, zb: -2, min: [-1.8, g - 0.02, -1.25], max: [1.8, -0.28, -0.9], pal: P3('#cfd8e3') });
        it.push({ k: 'box', layer: 0, zb: -2, min: [-2.02, g - 0.02, -0.95], max: [-1.78, -0.28, 0.95], pal: P3('#cfd8e3') });
        it.push({ k: 'box', layer: 0, zb: -2, min: [1.78, g - 0.02, -0.95], max: [2.02, -0.28, 0.95], pal: P3('#cfd8e3') });
        var fanA = s.fans ? clamp((t - s.fanT) / 500, 0, 1) : clamp(1 - (t - s.fanT) / 500, 0, 1);
        if (fanA > 0.02) s.crowd.forEach(function (f) { var jump = REDUCED ? 0 : Math.max(0, Math.sin(t * 0.008 + f.ph)) * 0.03; it.push({ k: 'pt', layer: 1, p: [f.p[0], f.p[1] + 0.05 + jump, f.p[2]], r: 2.6, pal: P3(f.c), a: fanA }); });
        var k = el < n * step ? Math.floor(el / step) : n - 1, u = el < n * step ? (el % step) / step : 1;
        var from = s.A[s.seq[k]], to = s.A[s.seq[k + 1]];
        for (i = 0; i < s.E.length; i++) {
          var e = s.E[i], A = s.A[e[0]], B = s.A[e[1]];
          var act = (e[0] === s.seq[k] && e[1] === s.seq[k + 1]) || (e[1] === s.seq[k] && e[0] === s.seq[k + 1]);
          it.push({ k: 'ln', layer: 2, a: [A[0], g + 0.03, A[1]], b: [B[0], g + 0.03, B[1]], col: act ? 'rgba(255,255,255,0.95)' : 'rgba(255,213,74,' + (0.45 + 0.4 * e[2]) + ')', w: 1 + 2.2 * e[2] });
        }
        for (i = 0; i < s.A.length; i++) it.push({ k: 'pt', layer: 2, p: [s.A[i][0], g + 0.07, s.A[i][1]], r: 4.2 + 1.3 * s.deg[i], pal: P3('#2f6fd6') });
        for (i = 0; i < s.B.length; i++) it.push({ k: 'pt', layer: 2, p: [s.B[i][0], g + 0.07, s.B[i][1]], r: 4.6, pal: P3('#e2524a') });
        function bpos(q) { return [lerp(from[0], to[0], q), g + 0.08 + 0.18 * 4 * q * (1 - q), lerp(from[1], to[1], q)]; }
        var trail = [];
        for (i = 6; i >= 0; i--) trail.push(bpos(clamp(u - i * 0.05, 0, 1)));
        it.push({ k: 'pl', layer: 3, pts: trail, col: 'rgba(255,255,255,0.55)', w: 2 });
        it.push({ k: 'pt', layer: 3, p: bpos(u), r: 4.6, pal: P3('#fbfcfd'), style: 'soccer', rot: el * 0.01 });
        it.push({ k: 'txt', layer: 6, p: [0, g, 1.02], text: s.fans ? 'with fans (tap to empty the stands)' : 'no fans, the natural experiment', size: 9.5, weight: 600, col: '#2b3a4f' });
        return it;
      }
    },

    weather: {
      pitch: 0.5, spanX: 3.6, spanY: 2.2, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.14,
      init: function (s) {
        var r = rng(77), i;
        s.bars = [];
        for (i = 0; i < 26; i++) { var tt = i / 25; s.bars.push({ h: 0.12 + 0.5 * tt * tt + (r() - 0.5) * 0.12, a: clamp(tt * 1.1 - 0.1 + (r() - 0.5) * 0.25, 0, 1) }); }
        var GB = [[0.05, 0.05], [0.25, 0.12], [0.45, 0.08], [0.7, 0.1], [0.82, 0.18], [0.8, 0.28], [0.9, 0.36], [0.78, 0.42], [0.7, 0.5], [0.66, 0.6], [0.6, 0.7], [0.55, 0.76], [0.52, 0.82], [0.6, 0.9], [0.52, 0.98], [0.38, 0.99], [0.26, 0.95], [0.3, 0.86], [0.22, 0.8], [0.3, 0.74], [0.34, 0.66], [0.4, 0.6], [0.38, 0.5], [0.3, 0.44], [0.22, 0.4], [0.26, 0.3], [0.36, 0.26], [0.2, 0.2]];
        function W(p) { return [-1.55 + p[0] * 0.95, -0.5 + p[1] * 1.15, -0.3]; }
        s.map = GB.map(W);
        function inside(x, y) { var c = false; for (var a = 0, b = GB.length - 1; a < GB.length; b = a++) { if ((GB[a][1] > y) !== (GB[b][1] > y) && x < (GB[b][0] - GB[a][0]) * (y - GB[a][1]) / (GB[b][1] - GB[a][1]) + GB[a][0]) c = !c; } return c; }
        s.cities = [];
        while (s.cities.length < 26) { var x = r(), y = r(); if (inside(x, y)) s.cities.push({ p: W([x, y]), temp: clamp(1 - y * 0.9 + (r() - 0.5) * 0.25, 0, 1), ph: r() * 6.28 }); }
        s.drops = [];
        for (i = 0; i < 16; i++) s.drops.push([-0.85 + r() * 0.5, r(), 0.0 + r() * 0.15]);
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], floor = -0.55, raining = api.hovering || el < 3200, i, t = api.t;
        var STR = ['#08306b', '#2171b5', '#6baed6', '#c6dbef', '#fee0d2', '#fc9272', '#de2d26', '#67000d'].map(hex);
        var TMP = ['#2b6cb0', '#63b3ed', '#9ae6b4', '#f6e05e', '#f6ad55'].map(hex);
        it.push({ k: 'pl', layer: 0, pts: [[-1.7, -0.58, -0.32], [-0.48, -0.58, -0.32], [-0.48, 0.72, -0.32], [-1.7, 0.72, -0.32]], closed: true, fill: 'rgba(196,226,244,0.85)', col: 'rgba(150,190,220,0.9)', w: 1 });
        it.push({ k: 'pl', layer: 0, zb: 2, pts: s.map, closed: true, fill: '#e3f1d9', col: '#7fb276', w: 1.2 });
        s.cities.forEach(function (c) {
          var tw = REDUCED ? 1 : 0.85 + 0.15 * Math.sin(t * 0.004 + c.ph);
          it.push({ k: 'pt', layer: 1, p: [c.p[0], c.p[1], -0.28], r: 3.2 * tw, pal: palFrom(cmap(TMP, c.temp)) });
        });
        it.push({ k: 'pl', layer: 0, zb: 1, pts: [[-1.75, floor, -0.4], [1.6, floor, -0.4], [1.6, floor, 0.45], [-1.75, floor, 0.45]], closed: true, fill: 'rgba(236,243,248,0.9)' });
        for (i = 0; i < s.bars.length; i++) {
          var b = s.bars[i], gr = REDUCED ? 1 : backOut((el - i * 30) / 700), x0 = -0.12 + i * 0.064;
          it.push({ k: 'box', min: [x0, floor, -0.15], max: [x0 + 0.055, floor + Math.max(0.01, b.h * gr), 0.15], pal: palFrom(cmap(STR, b.a)) });
        }
        var trend = [];
        for (i = 0; i <= 25; i++) { var tt = i / 25, rv = REDUCED ? 1 : clamp((el - 900) / 900, 0, 1); if (tt <= rv) trend.push([-0.09 + i * 0.064, floor + 0.2 + 0.5 * tt * tt + 0.06, 0.16]); }
        if (trend.length > 1) it.push({ k: 'pl', layer: 3, pts: trend, col: '#c0392b', w: 2 });
        [[-0.75, 0.62, 0.05, 10], [-0.6, 0.7, 0.07, 13], [-0.45, 0.62, 0.05, 10], [-0.6, 0.57, 0.1, 9]].forEach(function (c) {
          it.push({ k: 'pt', layer: 3, p: [c[0], c[1], c[2]], r: c[3], pal: P3('#ffffff') });
        });
        if (raining && !REDUCED) {
          for (var d = 0; d < s.drops.length; d++) {
            var dr = s.drops[d], f = (t * 0.0011 + dr[1]) % 1, y = 0.5 - f * 0.95;
            it.push({ k: 'ln', layer: 3, a: [dr[0], y, dr[2]], b: [dr[0] - 0.02, y - 0.08, dr[2]], col: 'rgba(74,144,217,' + (0.85 * (1 - f * 0.6)) + ')', w: 1.4 });
          }
        }
        var sun = [1.35, 0.42, 0];
        it.push({ k: 'pt', layer: 3, p: sun, r: 12, pal: P3('#ffc83d') });
        for (var k = 0; k < 8; k++) {
          var an = k / 8 * 6.2832 + (REDUCED ? 0 : t * 0.0006);
          it.push({ k: 'ln', layer: 3, a: [sun[0] + Math.cos(an) * 0.21, sun[1] + Math.sin(an) * 0.21, 0], b: [sun[0] + Math.cos(an) * 0.3, sun[1] + Math.sin(an) * 0.3, 0], col: '#ffa41b', w: 1.6 });
        }
        it.push({ k: 'txt', layer: 6, p: [-1.09, -0.68, -0.3], text: 'spatial snapshot', size: 9.5, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 6, p: [0.7, floor - 0.12, 0.3], text: 'century-long trend', size: 9.5, col: '#4b5c72' });
        return it;
      }
    },

    equalizer: {
      pitch: 0.42, spanX: 3.5, spanY: 2.1, offY: 0.0, hoverYaw: 0.45, hoverPitch: 0.16,
      init: function (s) { s.p0 = null; },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], n = 22, base = -0.55, i, t = api.t, cx = -0.25;
        var energy = api.hovering ? 1 : (el < 2500 ? 1 - el / 2500 * 0.6 : 0.4);
        for (i = 0; i < n; i++) {
          var a = i / n * 6.2832, x = cx + Math.cos(a) * 0.8, z = Math.sin(a) * 0.8;
          var h = REDUCED ? 0.25 : 0.06 + energy * 0.55 * Math.pow(Math.abs(Math.sin(t * 0.0042 + i * 0.9) * Math.sin(t * 0.0017 + i * 0.35)), 0.8);
          it.push({ k: 'box', min: [x - 0.045, base, z - 0.045], max: [x + 0.045, base + h, z + 0.045], pal: palFrom(hsl(185 - i * 7.5, 0.7, 0.55)) });
        }
        it.push({ k: 'pl', layer: 0, pts: ring([cx, base, 0], 0.8, 40, 'xz'), closed: true, col: 'rgba(42,157,143,0.4)', w: 1.2 });
        var beat = REDUCED ? 0.4 : (0.5 + 0.5 * Math.sin(t * 0.0084)) * energy, bob = REDUCED ? 0 : Math.sin(t * 0.003) * 0.04;
        it.push({ k: 'sprite', layer: 3, p: [cx, 0.34 + bob, 0], size: 17, glow: beat, t: t, draw: drawBrain });
        if (!REDUCED) {
          var WORDS = ['\u266A', 'rock', '\u266B', 'metal', '\u266A', 'lo-fi', '\u266B', 'jazz'], NC = ['#2a9d8f', '#e9a23b', '#3d93c9', '#e76f51'];
          for (var k = 0; k < WORDS.length; k++) {
            var f = (t * 0.0003 + k / WORDS.length) % 1, ang = k * 0.8 + t * 0.0004, w = WORDS[k];
            it.push({ k: 'txt', layer: 4, p: [cx + Math.cos(ang) * 0.95, -0.35 + f * 1.05, Math.sin(ang) * 0.6], text: w, size: w.length > 1 ? 9.5 : 15, weight: 600, col: NC[k % 4], alpha: (1 - f) * (0.45 + 0.55 * energy) });
          }
        }
        var G = [['anxiety', '#e9a23b', 0.0], ['depression', '#3d93c9', 1.7], ['insomnia', '#2a9d8f', 3.1]];
        G.forEach(function (gq, gi) {
          var gx = 1.0 + gi * 0.36, lvl = REDUCED ? 0.5 : 0.35 + 0.25 * Math.sin(t * 0.0021 + gq[2]) * energy + 0.15 * energy;
          it.push({ k: 'cyl', b: [gx, base, 0], r: 0.075, h: lvl * 0.8, n: 14, pal: P3(gq[1]) });
          it.push({ k: 'cyl', layer: 2, b: [gx, base, 0], r: 0.085, h: 0.8, n: 14, pal: P3('#dbe9f4'), a: 0.2 });
          it.push({ k: 'txt', layer: 6, p: [gx, gi === 1 ? base + 0.93 : base - 0.12, 0.12], text: gq[0], size: 8.5, col: '#4b5c72' });
        });
        return it;
      }
    },

    piano: {
      pitch: 0.3, spanX: 3.3, spanY: 2.1, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.12,
      init: function (s) {
        s.p0 = null;
        s.songs = [
          { name: 'Bach', mode: 'major', col: '#3d93c9', notes: [[0, 0, 1], [2, 1, 1], [4, 2, 1], [5, 3, 1], [7, 4, 2], [5, 6, 1], [4, 7, 1], [2, 8, 2], [0, 10, 2], [7, 12, 1], [9, 13, 1], [7, 14, 2]] },
          { name: 'Chopin', mode: 'minor', col: '#2a9d8f', notes: [[9, 0, 2], [7, 2, 1], [8, 3, 1], [5, 4, 2], [4, 6, 1], [2, 7, 1], [4, 8, 2], [9, 10, 1], [11, 11, 1], [12, 12, 3]] },
          { name: 'Mozart', mode: 'major', col: '#c9a24a', notes: [[0, 0, 1], [0, 1, 1], [7, 2, 1], [7, 3, 1], [9, 4, 1], [9, 5, 1], [7, 6, 2], [5, 8, 1], [5, 9, 1], [4, 10, 1], [4, 11, 1], [2, 12, 1], [2, 13, 1], [0, 14, 2]] }
        ];
        var r = rng(61), C = [[0.86, 0.52], [1.06, 0.38], [1.24, 0.53]];
        s.space = C.map(function (c) { var pts = []; for (var k = 0; k < 7; k++) pts.push([c[0] + gauss(r) * 0.045, c[1] + gauss(r) * 0.035]); return pts; });
      },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], kw = 0.2, x0 = -1.4, i, BEAT = 250, PH = 17 * BEAT;
        var keyTop = -0.44, sp = 0.0011, ix = Math.floor(el / PH) % s.songs.length, song = s.songs[ix], tl = el % PH;
        it.push({ k: 'poly', layer: 0, pts: [[-1.5, -0.34, -0.42], [1.42, -0.34, -0.42], [1.42, 0.78, -0.42], [-1.5, 0.78, -0.42]], fill: '#eef4f9', stroke: '#c9d8e6', sw: 1 });
        for (i = 0; i <= 14; i++) it.push({ k: 'ln', layer: 0, zb: 1, a: [x0 + i * kw, -0.34, -0.41], b: [x0 + i * kw, 0.78, -0.41], col: 'rgba(160,185,210,0.35)' });
        it.push({ k: 'txt', layer: 6, p: [-1.38, 0.68, -0.4], text: song.name, size: 10.5, weight: 700, col: song.col, align: 'left' });
        var mj = song.mode === 'major', mx0 = -1.32 + song.name.length * 0.12;
        it.push({ k: 'poly', layer: 5, pts: [[mx0, 0.63, -0.39], [mx0 + 0.36, 0.63, -0.39], [mx0 + 0.36, 0.73, -0.39], [mx0, 0.73, -0.39]], fill: mj ? '#f2e4bd' : '#d6e8f5', stroke: mj ? '#cdb06c' : '#9cc3e0', sw: 1 });
        it.push({ k: 'txt', layer: 6, p: [mx0 + 0.18, 0.68, -0.385], text: song.mode, size: 8, weight: 700, col: mj ? '#9b7d3b' : '#2b6cb0' });
        it.push({ k: 'poly', layer: 1, pts: [[0.72, 0.27, -0.36], [1.36, 0.27, -0.36], [1.36, 0.63, -0.36], [0.72, 0.63, -0.36]], fill: 'rgba(255,255,255,0.92)', stroke: '#c9d8e6', sw: 1 });
        s.space.forEach(function (pts, ci) {
          var cur = ci === ix, cc = s.songs[ci].col, pul = REDUCED ? 0 : 0.5 + 0.5 * Math.sin(api.t * 0.006);
          pts.forEach(function (q) { it.push({ k: 'pt', layer: 2, p: [q[0], q[1], -0.35], r: cur ? 2.8 : 2.2, pal: P3(cc), a: cur ? 1 : 0.45 }); });
          if (cur) it.push({ k: 'pt', layer: 3, p: [pts[0][0], pts[0][1], -0.34], r: 4.2, pal: P3('#ffffff'), hl: 0.6 + 0.4 * pul });
        });
        it.push({ k: 'txt', layer: 6, p: [1.04, 0.22, -0.35], text: 'style space', size: 7.5, col: '#4b5c72' });
        it.push({ k: 'box', layer: 0, min: [-1.5, -0.64, -0.42], max: [1.42, -0.555, 0.38], pal: P3('#2b2f3a') });
        it.push({ k: 'box', layer: 0, zb: 1, min: [-1.5, -0.555, -0.44], max: [1.42, -0.32, -0.36], pal: P3('#2b2f3a') });
        var lit = {}, sparks = [];
        song.notes.forEach(function (n) {
          var start = n[1] * BEAT, end = (n[1] + n[2]) * BEAT, xc = x0 + n[0] * kw + kw / 2;
          if (REDUCED) { lit[n[0]] = 0; return; }
          if (tl > end) return;
          var bottom = keyTop + 0.02 + Math.max(0, start - tl) * sp, top = keyTop + 0.02 + Math.max(0, end - tl) * sp;
          if (bottom > 0.76) return;
          top = Math.min(top, 0.76);
          if (top - bottom > 0.005) it.push({ k: 'box', layer: 1, min: [xc - 0.07, bottom, -0.2], max: [xc + 0.07, top, -0.12], pal: P3(song.col), a: 0.95 });
          if (tl >= start && tl <= end) { lit[n[0]] = 1; if (tl - start < 160) sparks.push([xc, (tl - start) / 160]); }
        });
        for (i = 0; i < 14; i++) {
          var on = lit[i] != null, down = on ? 0.045 : 0, x = x0 + i * kw;
          it.push({ k: 'box', min: [x, -0.55 - down, -0.32], max: [x + kw - 0.012, -0.44 - down, 0.32], pal: on ? palFrom(mix(hex(song.col), WHITE, 0.25)) : P3('#fbfbfd') });
        }
        [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].forEach(function (b) {
          var x = x0 + b * kw + kw * 0.68;
          it.push({ k: 'box', layer: 2, min: [x, -0.44, -0.32], max: [x + kw * 0.6, -0.36, 0.06], pal: P3('#23262f') });
        });
        sparks.forEach(function (sp2) { [-0.06, 0, 0.06].forEach(function (dx, di) { it.push({ k: 'txt', layer: 6, p: [sp2[0] + dx * (1 + sp2[1]), -0.3 + sp2[1] * (0.12 + di * 0.05), -0.15], text: '\u2726', size: 8 + di * 2, col: song.col, alpha: 1 - sp2[1] }); }); });
        it.push({ k: 'txt', layer: 6, p: [0.3, 0.68, -0.4], text: 'generated \u2726', size: 8.5, weight: 600, col: '#4b5c72', alpha: 0.85 });
        return it;
      }
    },

    eu: {
      pitch: 0.42, spanX: 3.5, spanY: 2.2, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.14,
      init: function (s) { s.p0 = null; },
      show: show0,
      build: function (s, api) {
        var it = [], floor = -0.55, t = REDUCED ? 0 : api.t, sp = api.hovering ? 1.8 : 1, i, k;
        it.push({ k: 'pl', layer: 0, pts: [[-1.65, floor, -0.82], [1.55, floor, -0.82], [1.55, floor, 0.82], [-1.65, floor, 0.82]], closed: true, fill: '#e8f3e6', col: '#c5dcc2', w: 1 });
        var ROADS = [{ z: -0.58, col: '#e9a23b', lab: 'DiD' }, { z: 0, col: '#2a9d8f', lab: 'IV' }, { z: 0.58, col: '#e76f51', lab: 'RDD' }], end = [0.8, 0];
        function road(z0, u) { var a = [-1.3, z0], b = [-0.15, z0], m = 1 - u; return [m * m * a[0] + 2 * m * u * b[0] + u * u * end[0], m * m * a[1] + 2 * m * u * b[1] + u * u * end[1]]; }
        ROADS.forEach(function (R, ri) {
          var left = [], right = [], mid = [];
          for (k = 0; k <= 24; k++) {
            var u = k / 24, p = road(R.z, u), q = road(R.z, Math.min(1, u + 0.01)), dx = q[0] - p[0], dz = q[1] - p[1], L = Math.sqrt(dx * dx + dz * dz) || 1, w = 0.08 * (1 - u * 0.45);
            left.push([p[0] - dz / L * w, floor, p[1] + dx / L * w]); right.unshift([p[0] + dz / L * w, floor, p[1] - dx / L * w]); mid.push([p[0], floor, p[1]]);
          }
          it.push({ k: 'pl', layer: 0, zb: 3 + ri, pts: left.concat(right), closed: true, fill: '#6b7280' });
          it.push({ k: 'pl', layer: 0, zb: 6 + ri, pts: mid, col: rgba(hex(R.col), 0.95), w: 1.6, dash: [5, 4] });
          var sp0 = road(R.z, ri * 0.09);
          it.push({ k: 'cyl', b: [sp0[0] - 0.12, floor, sp0[1] - 0.12], r: 0.012, h: 0.32, n: 6, pal: P3('#8b95a7') });
          it.push({ k: 'poly', layer: 2, pts: [[sp0[0] - 0.3, floor + 0.2, sp0[1] - 0.12], [sp0[0] + 0.06, floor + 0.2, sp0[1] - 0.12], [sp0[0] + 0.1, floor + 0.26, sp0[1] - 0.12], [sp0[0] + 0.06, floor + 0.32, sp0[1] - 0.12], [sp0[0] - 0.3, floor + 0.32, sp0[1] - 0.12]], fill: R.col, stroke: 'rgba(0,0,0,0.25)', sw: 0.8 });
          it.push({ k: 'txt', layer: 5, p: [sp0[0] - 0.11, floor + 0.26, sp0[1] - 0.11], text: R.lab, size: 9.5, weight: 700, col: '#ffffff' });
          for (var c = 0; c < 3; c++) {
            var f = REDUCED ? (c + 1) / 4 : ((t * 0.00026 * sp + c / 3 + ri * 0.17) % 1), pp = road(R.z, f), al = f > 0.88 ? (1 - f) / 0.12 : 1;
            it.push({ k: 'box', layer: 2, min: [pp[0] - 0.07, floor + 0.015, pp[1] - 0.035], max: [pp[0] + 0.07, floor + 0.065, pp[1] + 0.035], pal: P3(R.col), a: al });
            it.push({ k: 'box', layer: 2, min: [pp[0] - 0.035, floor + 0.065, pp[1] - 0.028], max: [pp[0] + 0.035, floor + 0.1, pp[1] + 0.028], pal: P3('#e6f4fb'), a: al });
          }
          [0.2, 0.45, 0.7].forEach(function (tu, ti) {
            var tp = road(R.z, tu), side = (ti % 2 ? 1 : -1) * 0.17;
            it.push({ k: 'cyl', b: [tp[0], floor, tp[1] + side], r: 0.012, h: 0.1, n: 6, pal: P3('#8d6e4f') });
            it.push({ k: 'pt', p: [tp[0], floor + 0.15, tp[1] + side], r: 5.5, pal: P3(['#52b788', '#76c893', '#40916c'][ti]) });
          });
        });
        var pole = [end[0] + 0.1, floor, end[1] - 0.04];
        it.push({ k: 'pl', layer: 0, zb: 9, pts: ring([pole[0], floor, pole[2]], 0.09, 16, 'xz'), closed: true, fill: 'rgba(60,70,90,0.15)' });
        it.push({ k: 'cyl', b: pole, r: 0.018, h: 1.0, n: 8, pal: P3('#9aa6b5') });
        it.push({ k: 'pt', p: [pole[0], floor + 1.02, pole[2]], r: 3.6, pal: P3('#e0b100') });
        var W = 0.6, H = 0.4, nx = 8, ny = 5, top = floor + 0.96, amp = api.hovering ? 0.09 : 0.06, G = [];
        function wave(u2) { return amp * u2 * Math.sin(u2 * 5.5 - t * 0.004 * sp); }
        for (i = 0; i <= nx; i++) { G.push([]); for (k = 0; k <= ny; k++) G[i].push([pole[0] + i / nx * W, top - k / ny * H, pole[2] + wave(i / nx)]); }
        for (i = 0; i < nx; i++) {
          for (k = 0; k < ny; k++) {
            var A = G[i][k], B = G[i + 1][k], Cc = G[i + 1][k + 1], D = G[i][k + 1];
            var lum = clamp(0.55 - (B[2] - A[2]) / (W / nx) * 1.4, 0.12, 0.9), fc = mix(hex('#173f9e'), hex('#4a78e6'), lum);
            it.push({ k: 'poly', pts: [A, B, Cc, D], fill: rgba(fc, 1), stroke: rgba(fc, 1), sw: 0.6 });
          }
        }
        for (i = 0; i < 12; i++) {
          var an = i / 12 * 6.2832, su = 0.5 + Math.cos(an) * 0.3 * (H / W), sv = 0.5 + Math.sin(an) * 0.3;
          it.push({ k: 'txt', layer: 4, p: [pole[0] + su * W, top - sv * H, pole[2] + wave(su) + 0.01], text: '\u2605', size: 7.5, col: '#ffcc00' });
        }
        var gx = 1.15, gz = 0.45, gh = [0.12, 0.2, 0.3], el = startPlay(s, api);
        for (i = 0; i < 3; i++) {
          var gg = REDUCED ? 1 : backOut((el - 300 - i * 160) / 700);
          it.push({ k: 'box', min: [gx + i * 0.11, floor, gz], max: [gx + i * 0.11 + 0.08, floor + Math.max(0.01, gh[i] * gg), gz + 0.08], pal: P3(['#76c893', '#52b788', '#2d6a4f'][i]) });
        }
        it.push({ k: 'txt', layer: 6, p: [gx + 0.15, floor - 0.1, gz + 0.1], text: 'growth', size: 9, col: '#4b5c72' });
        return it;
      }
    },

    orderbook: {
      yaw: -0.62, pitch: 0.36, sway: 0.08, spanX: 3.7, spanY: 2.25, offY: 0.02, hoverYaw: 0.36, hoverPitch: 0.12,
      init: function (s) {
        var r = rng(17), cols = ['#38bdf8', '#34d399', '#facc15'];
        s.p0 = null; s.pk = [];
        for (var i = 0; i < 20; i++) s.pk.push({ x: (r() - 0.5) * 2.2, y: 0.55 + r() * 0.35, off: r(), sp: 0.6 + r() * 0.8, c: cols[i % 3] });
      },
      show: show0,
      build: function (s, api) {
        var it = [], floor = -0.62, speed = api.hovering ? 0.0007 : 0.00025, tick = REDUCED ? 0 : api.t * speed;
        var shift = tick % 1, base = Math.floor(tick), N = 6, step = 1.9 / (N - 1), i, j;
        it.push({ k: 'pl', layer: 0, pts: [[-1.45, floor, -1.0], [1.45, floor, -1.0], [1.45, floor, 0.98], [-1.45, floor, 0.98]], closed: true, fill: 'rgba(232,238,246,0.75)', col: 'rgba(170,185,200,0.75)' });
        for (j = -1; j <= 1.01; j += 0.5) it.push({ k: 'ln', layer: 0, zb: 5, a: [j * 1.4, floor, -1.0], b: [j * 1.4, floor, 0.98], col: 'rgba(170,185,200,0.35)' });
        var mids = [];
        for (var r = 0; r < N; r++) {
          var zc = -0.95 + (r + shift) * step;
          if (zc > 1.0) continue;
          var fade = clamp(1.25 - Math.abs(zc) / 0.95, 0, 1), seed = r - base;
          var n1 = Math.sin(seed * 12.9898) * 43758.5453; n1 -= Math.floor(n1);
          var mid = (n1 - 0.5) * 0.22, bid = [[mid - 0.04, floor, zc]], ask = [[mid + 0.04, floor, zc]];
          mids.push([mid, floor, zc]);
          for (i = 0; i <= 12; i++) {
            var d = i / 12, nb = Math.sin(seed * 7.1 + i * 3.7) * 0.5 + 0.5, na = Math.sin(seed * 5.3 + i * 2.9 + 1) * 0.5 + 0.5;
            bid.push([mid - 0.04 - d * 1.25, floor + 0.07 + 0.62 * Math.pow(d, 0.8) + 0.07 * nb, zc]);
            ask.push([mid + 0.04 + d * 1.25, floor + 0.07 + 0.58 * Math.pow(d, 0.85) + 0.07 * na, zc]);
          }
          bid.push([mid - 1.29, floor, zc]); ask.push([mid + 1.29, floor, zc]);
          it.push({ k: 'pl', pts: bid, closed: true, fill: 'rgba(34,176,125,' + (0.6 * fade) + ')', col: 'rgba(21,128,90,' + (0.95 * fade) + ')', w: 1.2 });
          it.push({ k: 'pl', pts: ask, closed: true, fill: 'rgba(239,90,90,' + (0.6 * fade) + ')', col: 'rgba(185,40,40,' + (0.95 * fade) + ')', w: 1.2 });
        }
        mids.sort(function (a, b) { return a[2] - b[2]; });
        if (mids.length > 1) it.push({ k: 'pl', layer: 0, zb: 6, pts: mids, col: '#f5b700', w: 2.2 });
        for (i = 0; i < s.pk.length; i++) {
          var pk = s.pk[i], f = REDUCED ? pk.off : (api.t * 0.00035 * pk.sp * (api.hovering ? 2.2 : 1) + pk.off) % 1;
          it.push({ k: 'pt', layer: 3, p: [pk.x, floor + pk.y, -1 + f * 2], r: 2.6, pal: P3(pk.c), a: Math.sin(f * Math.PI) });
        }
        return it;
      }
    },

    volsurface: {
      yaw: -0.65, pitch: 0.5, sway: 0.1, spanX: 3.4, spanY: 2.05, offY: 0.05, hoverYaw: 0.4, hoverPitch: 0.14,
      init: function (s) { s.p0 = null; },
      show: show0,
      build: function (s, api) {
        var it = [], nx = 17, nz = 10, i, j, base = -0.45;
        var PL = ['#0b3d6b', '#1f6f9f', '#2a9d8f', '#76c893', '#e9c46a', '#f4a261'].map(hex);
        var sp = api.hovering ? 2.2 : 1, t = REDUCED ? 0 : api.t * 0.0012 * sp;
        function Hh(a, b) { var m = (a / (nx - 1) - 0.5) * 2.8, T = b / (nz - 1); return -0.3 + 0.24 * m * m * Math.exp(-T * 1.4) + 0.15 * T + 0.06 * Math.sin(m * 2.2 + t) * Math.cos(T * 3 + t * 0.7); }
        var G = [], lo = 1e9, hi = -1e9;
        for (i = 0; i < nx; i++) {
          G.push([]);
          for (j = 0; j < nz; j++) { var y = Hh(i, j); lo = Math.min(lo, y); hi = Math.max(hi, y); G[i].push([(i / (nx - 1) - 0.5) * 2.6, y, (j / (nz - 1) - 0.5) * 1.2]); }
        }
        for (i = 0; i < nx - 1; i++) {
          for (j = 0; j < nz - 1; j++) {
            var a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
            var ux = b[0] - a[0], uy = b[1] - a[1], vy = d[1] - a[1], vz = d[2] - a[2];
            var nrm = v3norm([uy * vz, -ux * vz, ux * vy]);
            if (nrm[1] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
            var lam = clamp(0.55 + 0.45 * (nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]), 0.4, 1);
            var col = cmap(PL, ((a[1] + b[1] + c[1] + d[1]) / 4 - lo) / (hi - lo + 1e-6));
            it.push({ k: 'poly', pts: [a, b, c, d], fill: rgba(mix(col, [12, 8, 40], (1 - lam) * 0.8), 0.97), stroke: 'rgba(255,255,255,0.16)', sw: 0.4 });
          }
        }
        var scan = REDUCED ? 4 : Math.floor(((api.t * 0.00045 * sp) % 1) * nz), slice = [];
        for (i = 0; i < nx; i++) slice.push([G[i][scan][0], G[i][scan][1] + 0.012, G[i][scan][2]]);
        it.push({ k: 'pl', layer: 2, pts: slice, col: 'rgba(255,255,255,0.95)', w: 2.2 });
        var HZ = [['1d', '#e9a23b', 0.07], ['1w', '#2a9d8f', 0.14], ['1m', '#3d93c9', 0.22]];
        HZ.forEach(function (hz, hi) {
          var fut = [];
          for (i = 0; i < nx; i++) { var gp = G[i][scan]; fut.push([gp[0], gp[1] + hz[2] + 0.04 * Math.sin(i * 0.7 + t * (1 + hi * 0.4)), gp[2]]); }
          it.push({ k: 'pl', layer: 2, pts: fut, col: hz[1], w: 1.5, dash: [4, 3] });
          var endp = fut[nx - 1];
          it.push({ k: 'txt', layer: 6, p: [endp[0] + 0.14 + hi * 0.12, endp[1] + 0.02 + hi * 0.07, endp[2]], text: hz[0], size: 9, weight: 700, col: hz[1] });
        });
        var mid = slice[Math.floor(nx / 2)];
        it.push({ k: 'pt', layer: 3, p: [mid[0], mid[1] + 0.02, mid[2]], r: 3.6, pal: P3('#ffffff') });
        it.push({ k: 'ln', layer: 0, a: [-1.35, base, 0.66], b: [1.35, base, 0.66], col: 'rgba(120,135,150,0.65)' });
        it.push({ k: 'ln', layer: 0, a: [-1.35, base, 0.66], b: [-1.35, base, -0.66], col: 'rgba(120,135,150,0.65)' });
        it.push({ k: 'txt', layer: 5, p: [0.2, base - 0.12, 0.82], text: 'strike', size: 9.5, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 5, p: [-1.62, base - 0.06, 0.62], text: 'maturity', size: 9.5, col: '#4b5c72' });
        return it;
      }
    },

    flights: {
      yaw: -0.32, pitch: 0.5, sway: 0.06, spanX: 3.55, spanY: 2.05, offY: 0.08, hoverYaw: 0.36, hoverPitch: 0.12,
      init: function (s) {
        s.AP = [{ c: [-1.15, -0.28], a: 0.3 }, { c: [-0.25, 0.36], a: -0.25 }, { c: [0.72, -0.36], a: 0.45 }, { c: [1.22, 0.32], a: -0.4 }];
        s.R = [[0, 3, 0, 0], [1, 2, 1, 1700], [2, 0, 0, 3300], [3, 1, 1, 900], [0, 2, 0, 2500]];
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var it = [], g = -0.55, L = 0.5, sp = api.hovering ? 1.8 : 1, i;
        it.push({ k: 'pl', layer: 0, pts: [[-1.6, g, -0.68], [1.6, g, -0.68], [1.6, g, 0.66], [-1.6, g, 0.66]], closed: true, fill: '#e2f1e5', col: '#b9d3c0', w: 1 });
        it.push({ k: 'pl', layer: 0, zb: 2, pts: [[-1.55, g, 0.08], [-0.9, g, 0.05], [-0.95, g, 0.62], [-1.55, g, 0.62]], closed: true, fill: '#edf5d8' });
        it.push({ k: 'pl', layer: 0, zb: 2, pts: [[0.15, g, -0.64], [0.55, g, -0.64], [0.5, g, -0.1], [0.12, g, -0.05]], closed: true, fill: '#f4ecd8' });
        var river = [];
        for (i = 0; i <= 24; i++) { var u = i / 24; river.push([-1.58 + u * 3.16, g, 0.52 - u * 0.98 + Math.sin(u * 9) * 0.1]); }
        it.push({ k: 'pl', layer: 0, zb: 3, pts: river, col: '#9fd3f0', w: 3 });
        function rw(ap) { var d = [Math.cos(ap.a), Math.sin(ap.a)], c = ap.c; return { d: d, s: [c[0] - d[0] * L / 2, c[1] - d[1] * L / 2], e: [c[0] + d[0] * L / 2, c[1] + d[1] * L / 2] }; }
        for (i = 0; i < s.AP.length; i++) {
          var ap = s.AP[i], R = rw(ap), pr = [-R.d[1], R.d[0]], w = 0.045;
          it.push({ k: 'pl', layer: 0, zb: 4, pts: [[R.s[0] + pr[0] * w, g, R.s[1] + pr[1] * w], [R.e[0] + pr[0] * w, g, R.e[1] + pr[1] * w], [R.e[0] - pr[0] * w, g, R.e[1] - pr[1] * w], [R.s[0] - pr[0] * w, g, R.s[1] - pr[1] * w]], closed: true, fill: '#5d6675' });
          it.push({ k: 'ln', layer: 0, zb: 5, a: [R.s[0], g, R.s[1]], b: [R.e[0], g, R.e[1]], col: 'rgba(255,255,255,0.85)', w: 1, dash: [3, 3] });
          var tc = [ap.c[0] + pr[0] * 0.17, ap.c[1] + pr[1] * 0.17];
          it.push({ k: 'box', min: [tc[0] - 0.07, g, tc[1] - 0.04], max: [tc[0] + 0.07, g + 0.07, tc[1] + 0.04], pal: P3('#cfd9e6') });
          var park = [ap.c[0] + pr[0] * 0.17 + R.d[0] * 0.16, ap.c[1] + pr[1] * 0.17 + R.d[1] * 0.16];
          Array.prototype.push.apply(it, airplane([park[0], g + 0.03, park[1]], [-pr[0], 0, -pr[1]], 0.1, ['#14b8a6', '#ef4444', '#f59e0b', '#3b82f6'][i], 1));
        }
        for (var r = 0; r < s.R.length; r++) {
          var rt = s.R[r], A = rw(s.AP[rt[0]]), B = rw(s.AP[rt[1]]), dl = rt[2], col = dl ? '#e5534b' : '#22a06b';
          var dx = B.s[0] - A.e[0], dz = B.s[1] - A.e[1], H = 0.22 + Math.sqrt(dx * dx + dz * dz) * 0.11;
          var arc = [];
          for (var k = 0; k <= 22; k++) { var v = k / 22; arc.push([A.e[0] + dx * v, g + 0.03 + H * Math.sin(Math.PI * v), A.e[1] + dz * v]); }
          it.push({ k: 'pl', pts: arc, col: rgba(hex(col), 0.4), w: 1.2, dash: dl ? [4, 4] : [1, 4] });
          var hold = dl ? 1900 : 0, P = 6200, total = hold + P;
          var ph = REDUCED ? hold + P * 0.45 : ((api.t * sp + rt[3]) % total);
          var u2 = ph < hold ? 0 : (ph - hold) / P;
          var pos = function (u) {
            if (u <= 0.13) { var q = Math.pow(u / 0.13, 2); return [lerp(A.s[0], A.e[0], q), g + 0.03, lerp(A.s[1], A.e[1], q)]; }
            if (u <= 0.87) { var v2 = (u - 0.13) / 0.74; return [A.e[0] + dx * v2, g + 0.03 + H * Math.sin(Math.PI * v2), A.e[1] + dz * v2]; }
            var q2 = 1 - Math.pow(1 - (u - 0.87) / 0.13, 2); return [lerp(B.s[0], B.s[0] + B.d[0] * L * 0.7, q2), g + 0.03, lerp(B.s[1], B.s[1] + B.d[1] * L * 0.7, q2)];
          };
          var p0 = pos(Math.min(u2, 0.995)), p1 = pos(Math.min(u2 + 0.005, 1));
          var dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
          if (Math.abs(dir[0]) + Math.abs(dir[2]) < 1e-6) dir = [A.d[0], 0, A.d[1]];
          var fadeA = u2 > 0.96 ? clamp((1 - u2) / 0.04, 0, 1) : 1;
          var alt = p0[1] - (g + 0.03);
          if (alt > 0.01) it.push({ k: 'pl', layer: 0, zb: 8, pts: ring([p0[0], g, p0[2]], 0.07 * (1 - clamp(alt / 0.9, 0, 0.6)), 12, 'xz'), closed: true, fill: 'rgba(40,60,80,' + (0.16 * fadeA) + ')' });
          Array.prototype.push.apply(it, airplane(p0, dir, 0.13, col, fadeA));
          if (dl && ph < hold) it.push({ k: 'sprite', layer: 5, p: [p0[0], p0[1] + 0.2, p0[2]], size: 6.5, t: api.t, draw: drawClock });
        }
        var drift = REDUCED ? 0 : (api.t * 0.00004) % 1;
        [[-0.9, 0.36, -0.35], [0.3, 0.44, 0.1], [1.12, 0.32, -0.45]].forEach(function (cl, ci) {
          var x = cl[0] + Math.sin(drift * 6.2832 + ci) * 0.12;
          [[0, 0, 5], [0.07, 0.025, 6.5], [0.14, 0, 5], [0.07, -0.015, 4.5]].forEach(function (b) {
            it.push({ k: 'pt', layer: 4, p: [x + b[0], cl[1] + b[1], cl[2]], r: b[2], pal: P3('#ffffff'), a: 0.92 });
          });
        });
        return it;
      }
    },

    bandit: {
      pitch: 0.44, spanX: 3.4, spanY: 2.1, offY: 0.0, hoverYaw: 0.36, hoverPitch: 0.12,
      init: function (s) {
        s.r = rng(8);
        s.p = [[0.85, 0.3, 0.35], [0.3, 0.85, 0.35], [0.35, 0.3, 0.85]];
        s.q = [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]; s.n = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
        s.won = [0, 0, 0]; s.got = [0, 0, 0]; s.orders = []; s.pops = []; s.last = 0; s.hopT = [-1e9, -1e9, -1e9]; s.curve = []; s.total = 0; s.bell = -1e9;
      },
      show: function (s) { s.last = 0; },
      build: function (s, api) {
        var it = [], floor = -0.6, t = api.t, i, j;
        var STAFF = [-0.2, 0.45, 1.1], APRON = ['#e8590c', '#2f9e44', '#f59f00'];
        for (i = 0; i < 8; i++) for (j = 0; j < 5; j++) {
          var x0 = -1.6 + i * 0.4, z0 = -0.9 + j * 0.3;
          it.push({ k: 'pl', layer: 0, pts: [[x0, floor, z0], [x0 + 0.4, floor, z0], [x0 + 0.4, floor, z0 + 0.3], [x0, floor, z0 + 0.3]], closed: true, fill: (i + j) % 2 ? '#efe2cf' : '#f8f1e6' });
        }
        it.push({ k: 'box', min: [-1.55, floor, -0.35], max: [-1.0, floor + 0.32, 0.35], pal: P3('#c8935f') });
        it.push({ k: 'box', min: [-1.58, floor + 0.32, -0.38], max: [-0.97, floor + 0.36, 0.38], pal: P3('#f4f1ea') });
        var bj = t - s.bell, bh = bj >= 0 && bj < 300 ? 0.04 * Math.sin(bj / 300 * Math.PI) : 0;
        it.push({ k: 'pt', p: [-1.42, floor + 0.41 + bh, 0.22], r: 5, pal: P3('#f2c94c') });
        it.push({ k: 'ln', a: [-1.55, floor + 0.62, -0.36], b: [-1.0, floor + 0.62, -0.36], col: '#8b95a7', w: 1.4 });
        for (i = 0; i < 4; i++) {
          var tx = -1.5 + i * 0.13;
          it.push({ k: 'poly', pts: [[tx, floor + 0.62, -0.36], [tx + 0.1, floor + 0.62, -0.36], [tx + 0.1, floor + 0.48, -0.36], [tx, floor + 0.48, -0.36]], fill: '#ffffff', stroke: 'rgba(0,0,0,0.15)', sw: 0.6 });
          it.push({ k: 'ln', a: [tx + 0.015, floor + 0.585, -0.358], b: [tx + 0.085, floor + 0.585, -0.358], col: APRON[i % 3], w: 2 });
        }
        [[0.13, -0.86], [0.78, -0.86]].forEach(function (tb, ti) {
          it.push({ k: 'cyl', b: [tb[0], floor, tb[1]], r: 0.02, h: 0.2, n: 6, pal: P3('#8d6e4f') });
          it.push({ k: 'cyl', b: [tb[0], floor + 0.2, tb[1]], r: 0.2, h: 0.03, n: 18, pal: P3('#fdfaf3') });
          [-1, 1].forEach(function (sd, si) {
            var px = tb[0] + sd * 0.25;
            it.push({ k: 'cyl', b: [px, floor, tb[1]], r: 0.05, h: 0.16, n: 10, pal: P3(['#5b8fd6', '#2a9d8f', '#e9a23b', '#52b788'][ti * 2 + si]) });
            it.push({ k: 'pt', p: [px, floor + 0.23, tb[1]], r: 5, pal: P3('#f6d2b8'), style: 'face' });
          });
        });
        if ((api.hovering || api.age < 3200) && !REDUCED && t - s.last > (api.hovering ? 650 : 900)) {
          s.last = t; s.bell = t;
          var cx = Math.floor(s.r() * 3), qs = s.q[cx], best = qs.indexOf(Math.max.apply(null, qs));
          var a = s.r() < 0.15 ? Math.floor(s.r() * 3) : best, rew = s.r() < s.p[cx][a] ? 1 : 0;
          s.n[cx][a]++; s.q[cx][a] += (rew - s.q[cx][a]) / s.n[cx][a];
          s.orders.push({ ctx: cx, to: a, t: t, rew: rew, done: false });
          s.total += rew; s.curve.push(s.total / (s.curve.length + 1)); if (s.curve.length > 24) s.curve.shift();
        }
        s.orders = s.orders.filter(function (o) { return t - o.t < 1000; });
        s.orders.forEach(function (o) {
          var f = clamp((t - o.t) / 700, 0, 1), e = ease(f);
          var p = lerp3([-1.27, floor + 0.38, 0], [STAFF[o.to] - 0.16, floor + 0.34, 0.12], e);
          p[1] += 0.35 * 4 * e * (1 - e);
          if (f >= 1 && !o.done) { o.done = true; s.got[o.to]++; s.hopT[o.to] = t; if (o.rew) { s.won[o.to]++; s.pops.push({ x: STAFF[o.to], t: t }); } }
          var al = f < 1 ? 1 : clamp(1 - (t - o.t - 700) / 300, 0, 1);
          it.push({ k: 'cyl', b: p, r: 0.075, h: 0.015, n: 14, pal: P3('#ffffff'), a: al });
          it.push({ k: 'pt', p: [p[0], p[1] + 0.045, p[2]], r: 4.2, pal: P3(APRON[o.ctx]), a: al });
        });
        for (i = 0; i < 3; i++) {
          var hp = t - s.hopT[i], jump = hp >= 0 && hp < 420 ? 0.12 * Math.sin(hp / 420 * Math.PI) : 0, x = STAFF[i], by = floor + jump;
          it.push({ k: 'pl', layer: 0, zb: 5, pts: ring([x, floor, 0], 0.15, 16, 'xz'), closed: true, fill: 'rgba(60,40,20,0.12)' });
          it.push({ k: 'cyl', b: [x, by, 0], r: 0.13, h: 0.3, n: 16, pal: P3(APRON[i]) });
          it.push({ k: 'pt', p: [x, by + 0.42, 0], r: 10, pal: P3('#f6d2b8'), style: 'face' });
          it.push({ k: 'cyl', b: [x, by + 0.52, 0], r: 0.07, h: 0.08, n: 12, pal: P3('#ffffff') });
          it.push({ k: 'pt', p: [x, by + 0.64, 0], r: 7, pal: P3('#ffffff') });
          var rate = s.got[i] ? s.won[i] / s.got[i] : 0, filled = Math.round(rate * 5);
          for (j = 0; j < 5; j++) it.push({ k: 'txt', layer: 5, p: [x - 0.2 + j * 0.1, floor - 0.1, 0.28], text: '\u2605', size: 10, col: j < filled ? '#f5b301' : '#d5dbe3' });
        }
        s.pops = s.pops.filter(function (q) { return t - q.t < 900; });
        s.pops.forEach(function (q) { var f = (t - q.t) / 900; it.push({ k: 'txt', layer: 6, p: [q.x + 0.14, floor + 0.8 + f * 0.22, 0], text: '\u2605', size: 16, weight: 700, col: '#f5b301', alpha: 1 - f }); });
        var px0 = 1.32, py0 = floor + 0.55;
        it.push({ k: 'poly', layer: 1, pts: [[px0, py0, -0.3], [px0 + 0.42, py0, -0.3], [px0 + 0.42, py0 + 0.3, -0.3], [px0, py0 + 0.3, -0.3]], fill: 'rgba(255,255,255,0.95)', stroke: 'rgba(170,185,205,0.9)', sw: 1 });
        if (s.curve.length > 1) {
          var cv = s.curve.map(function (v, ci) { return [px0 + 0.03 + ci / 23 * 0.36, py0 + 0.04 + v * 0.22, -0.29]; });
          it.push({ k: 'pl', layer: 2, pts: cv, col: '#2a9d8f', w: 1.6 });
        }
        it.push({ k: 'txt', layer: 6, p: [px0 + 0.21, py0 + 0.38, -0.3], text: 'reward', size: 8.5, col: '#4b5c72' });
        return it;
      }
    },

    clusters: {
      pitch: 0.42, spanX: 3.5, spanY: 2.1, offY: 0.0, hoverYaw: 0.36, hoverPitch: 0.12,
      init: function (s) {
        var r = rng(13), cz = [-0.42, 0, 0.42], HAIR = ['#3b2f2a', '#6b4a2b', '#d9a441', '#1f1a17'];
        s.C = ['#3b82f6', '#f59e0b', '#14b8a6']; s.m = []; s.e = [];
        for (var g = 0; g < 3; g++) {
          for (var i = 0; i < 4; i++) {
            s.m.push({ g: g, hair: HAIR[Math.floor(r() * 4)], home: [-0.95 + gauss(r) * 0.1, 0, cz[g] + gauss(r) * 0.06], from: [(r() - 0.5) * 2.6, 0, (r() - 0.5) * 1.1] });
            s.e.push({ g: g, hair: HAIR[Math.floor(r() * 4)], home: [0.95 + gauss(r) * 0.1, 0, cz[g] + gauss(r) * 0.06], from: [(r() - 0.5) * 2.6, 0, (r() - 0.5) * 1.1] });
          }
        }
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var el = startPlay(s, api), it = [], floor = -0.55, i;
        if (el > 4300 && api.hovering) { s.p0 = api.t; el = 0; }
        var seg = REDUCED ? 1 : ease(el / 1100);
        for (i = -3; i <= 3; i++) it.push({ k: 'ln', layer: 0, a: [i * 0.45, floor, -0.75], b: [i * 0.45, floor, 0.75], col: 'rgba(160,180,200,0.25)' });
        for (i = -2; i <= 2; i++) it.push({ k: 'ln', layer: 0, a: [-1.4, floor, i * 0.35], b: [1.4, floor, i * 0.35], col: 'rgba(160,180,200,0.25)' });
        for (var g = 0; g < 3; g++) {
          var col = hex(s.C[g]), z = [-0.42, 0, 0.42][g];
          it.push({ k: 'pl', layer: 0, zb: 5, pts: ring([-0.95, floor, z], 0.22, 28, 'xz'), closed: true, fill: rgba(col, 0.15 * seg), col: rgba(col, 0.45 * seg), w: 1 });
          it.push({ k: 'pl', layer: 0, zb: 5, pts: ring([0.95, floor, z], 0.22, 28, 'xz'), closed: true, fill: rgba(col, 0.15 * seg), col: rgba(col, 0.45 * seg), w: 1 });
          if (seg > 0.6) it.push({ k: 'txt', layer: 6, p: [-1.38, floor + 0.02, z], text: 'ABC'.charAt(g), size: 10, weight: 700, col: s.C[g], alpha: seg });
        }
        function person(pp, c, light, hv, hair) {
          var body = light ? palFrom(mix(c, WHITE, 0.45)) : palFrom(c);
          it.push({ k: 'cyl', b: [pp[0], floor + hv, pp[2]], r: 0.045, h: 0.12, n: 10, pal: body });
          it.push({ k: 'pt', p: [pp[0], floor + 0.205 + hv, pp[2] - 0.012], r: 4.6, pal: P3(hair) });
          it.push({ k: 'pt', p: [pp[0], floor + 0.18 + hv, pp[2]], r: 4.6, pal: P3('#f6d2b8'), style: 'face' });
        }
        for (i = 0; i < s.m.length; i++) {
          var A = lerp3(s.m[i].from, s.m[i].home, seg), B = lerp3(s.e[i].from, s.e[i].home, seg), c = hex(s.C[s.m[i].g]);
          var f = REDUCED ? 1 : clamp((el - 1200 - i * 90) / 700, 0, 1), since = el - 1900 - i * 90;
          var hv = f >= 1 && since >= 0 && since < 420 ? 0.06 * Math.sin(since / 420 * Math.PI) : 0;
          if (f > 0) {
            var pts = [];
            for (var k = 0; k <= 18; k++) { var u = k / 18 * f; pts.push([lerp(A[0], B[0], u), floor + 0.24 + 0.3 * Math.sin(Math.PI * u), lerp(A[2], B[2], u)]); }
            it.push({ k: 'pl', pts: pts, col: rgba(c, 0.6), w: 1.4 });
            if (f < 1) it.push({ k: 'pt', layer: 4, p: pts[pts.length - 1], r: 3.4, pal: palFrom(mix(c, WHITE, 0.55)) });
            else if (since >= 0 && since < 700) it.push({ k: 'txt', layer: 6, p: pts[9], text: '\u2726', size: 12, col: '#f5b301', alpha: 1 - since / 700 });
          }
          person(A, c, false, hv, s.m[i].hair);
          person(B, c, true, hv, s.e[i].hair);
        }
        it.push({ k: 'txt', layer: 6, p: [-0.95, floor - 0.1, 0.72], text: 'mentors', size: 10.5, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 6, p: [0.95, floor - 0.1, 0.72], text: 'mentees', size: 10.5, col: '#4b5c72' });
        var tick = REDUCED ? 0 : (api.t * 0.0012) % 6.2832;
        it.push({ k: 'sprite', layer: 6, p: [1.45, 0.42, -0.4], size: 11, t: tick, draw: function (ctx, x, y, kk, o) {
          var R = o.size * kk; ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b3a4f'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#2b3a4f'; ctx.fillRect(-R * 0.2, -R * 1.35, R * 0.4, R * 0.25);
          ctx.strokeStyle = '#e76f51'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(o.t) * R * 0.75, -Math.cos(o.t) * R * 0.75); ctx.stroke();
          ctx.fillStyle = '#4b5c72'; ctx.font = '600 ' + Math.round(R * 0.75) + 'px "IBM Plex Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('12h', 0, R * 1.2); ctx.restore();
        } });
        return it;
      }
    },

    bitcoin: {
      yaw: -0.2, pitch: 0.2, sway: 0.12, spanX: 3.5, spanY: 1.9, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.12,
      init: function (s) {
        var r = rng(21), v = 0;
        s.c = [];
        for (var i = 0; i < 16; i++) { var o = v, cl = v + (r() - 0.42) * 0.2; s.c.push([o, cl, Math.max(o, cl) + r() * 0.06, Math.min(o, cl) - r() * 0.06]); v = cl; }
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var it = [], el = startPlay(s, api), base = -0.32, sc = 0.85, n = s.c.length, dx = 0.12, x0 = -1.45, i, k;
        function X(j) { return x0 + j * dx; }
        for (i = 0; i < n; i++) {
          var c = s.c[i], x = X(i), col = c[1] >= c[0] ? '#16a34a' : '#dc2626', g = REDUCED ? 1 : clamp((el - i * 35) / 400, 0, 1);
          var y0 = base + Math.min(c[0], c[1]) * sc, y1 = base + Math.max(c[0], c[1]) * sc;
          y1 = y0 + Math.max(0.012, (y1 - y0) * g);
          it.push({ k: 'ln', a: [x + 0.04, base + c[3] * sc, 0], b: [x + 0.04, base + c[2] * sc, 0], col: col, w: 1 });
          it.push({ k: 'box', min: [x, y0, -0.035], max: [x + 0.08, y1, 0.035], pal: P3(col) });
        }
        var rev = REDUCED ? 1 : clamp((el - 500) / 700, 0, 1), m = Math.max(4, Math.round(4 + (n - 4) * rev)), sma = [], up = [], dn = [];
        for (i = 3; i < m; i++) {
          var w = s.c.slice(i - 3, i + 1).map(function (q) { return q[1]; });
          var mu = w.reduce(function (a, b) { return a + b; }, 0) / w.length;
          var sd = Math.sqrt(w.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / w.length) + 0.025;
          var xx = X(i) + 0.04;
          sma.push([xx, base + mu * sc, -0.06]); up.push([xx, base + (mu + 2 * sd) * sc, -0.06]); dn.unshift([xx, base + (mu - 2 * sd) * sc, -0.06]);
        }
        if (sma.length > 1) {
          it.push({ k: 'pl', layer: 0, pts: up.concat(dn), closed: true, fill: 'rgba(15,139,141,0.12)' });
          it.push({ k: 'pl', layer: 0, zb: 2, pts: up, col: 'rgba(15,139,141,0.5)', w: 1, dash: [3, 3] });
          it.push({ k: 'pl', layer: 0, zb: 2, pts: dn.slice().reverse(), col: 'rgba(15,139,141,0.5)', w: 1, dash: [3, 3] });
          it.push({ k: 'pl', layer: 2, pts: sma, col: '#0f8b8d', w: 1.6 });
        }
        var last = base + s.c[n - 1][1] * sc, xs = X(n - 1) + 0.04, reach = REDUCED ? 1 : clamp((el - 1200) / 900, 0, 1), ar = [], ls = [];
        for (k = 0; k <= 12; k++) {
          var u = k / 12 * reach, x2 = xs + u * 0.75;
          ar.push([x2, last + 0.06 * Math.sin(u * 3) * (1 - u) - 0.06 * u, 0]);
          ls.push([x2, last + 0.2 * u + 0.05 * Math.sin(u * 9) * u, 0]);
        }
        if (reach > 0.02) {
          it.push({ k: 'pl', layer: 2, pts: ar, col: '#3b82f6', w: 1.8, dash: [5, 3] });
          it.push({ k: 'pl', layer: 2, pts: ls, col: '#f97316', w: 1.8 });
          if (reach > 0.9) {
            it.push({ k: 'txt', layer: 5, p: [ar[12][0] + 0.2, ar[12][1] - 0.03, 0], text: 'ARIMA', size: 9.5, weight: 600, col: '#3b82f6', alpha: (reach - 0.9) * 10 });
            it.push({ k: 'txt', layer: 5, p: [ls[12][0] + 0.17, ls[12][1] + 0.04, 0], text: 'LSTM', size: 9.5, weight: 600, col: '#f97316', alpha: (reach - 0.9) * 10 });
          }
        }
        var sx = X(11) + 0.1;
        it.push({ k: 'ln', layer: 3, a: [sx, base - 0.42, 0.02], b: [sx, base + 0.62, 0.02], col: 'rgba(75,92,114,0.55)', w: 1.2, dash: [3, 3] });
        it.push({ k: 'txt', layer: 6, p: [sx - 0.17, base + 0.66, 0.02], text: 'train', size: 8, weight: 600, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 6, p: [sx + 0.15, base + 0.66, 0.02], text: 'test', size: 8, weight: 600, col: '#4b5c72' });
        var mb = REDUCED ? 1 : clamp((el - 300) / 600, 0, 1);
        for (i = 1; i < n; i++) {
          var mom = (s.c[i][1] - s.c[Math.max(0, i - 3)][1]) * 1.4 * mb, mx = X(i) + 0.012;
          it.push({ k: 'box', min: [mx, base - 0.5 + Math.min(0, mom), -0.02], max: [mx + 0.056, base - 0.5 + Math.max(0, mom) + 0.004, 0.02], pal: P3(mom >= 0 ? '#5cc98a' : '#ef7b7b') });
        }
        it.push({ k: 'ln', layer: 0, a: [X(0), base - 0.5, 0], b: [X(n - 1) + 0.1, base - 0.5, 0], col: 'rgba(120,135,150,0.5)' });
        it.push({ k: 'txt', layer: 6, p: [X(0) + 0.12, base - 0.38, 0], text: 'MACD', size: 7.5, weight: 600, col: '#4b5c72' });
        [['GOOG', '#3d93c9', -1.55], ['BTC', '#f7931a', -0.98]].forEach(function (tk, ti) {
          it.push({ k: 'poly', layer: 5, pts: [[tk[2], 0.72, 0.02], [tk[2] + 0.4, 0.72, 0.02], [tk[2] + 0.4, 0.84, 0.02], [tk[2], 0.84, 0.02]], fill: '#ffffff', stroke: tk[1], sw: 1.2 });
          it.push({ k: 'txt', layer: 6, p: [tk[2] + 0.2, 0.78, 0.03], text: tk[0], size: 8, weight: 700, col: tk[1] });
        });
        it.push({ k: 'txt', layer: 6, p: [-1.065, 0.78, 0.03], text: '\u2192', size: 10, weight: 700, col: '#4b5c72' });
        var spin = REDUCED ? 0.35 : api.t * 0.0018 * (api.hovering ? 3 : 1), C = [1.55, 0.6, -0.2], R = 0.22;
        var ux = Math.cos(spin), uz = Math.sin(spin), nx = -uz, nz = ux, th = 0.028, front = [], back = [], inner = [];
        for (var j = 0; j < 28; j++) {
          var an = j / 28 * 6.2832, px = Math.cos(an) * R, py = Math.sin(an) * R;
          front.push([C[0] + px * ux + nx * th, C[1] + py, C[2] + px * uz + nz * th]);
          back.push([C[0] + px * ux - nx * th, C[1] + py, C[2] + px * uz - nz * th]);
          inner.push([C[0] + px * 0.78 * ux + nx * (th + 0.004), C[1] + py * 0.78, C[2] + px * 0.78 * uz + nz * (th + 0.004)]);
        }
        for (j = 0; j < 28; j++) { var j2 = (j + 1) % 28; it.push({ k: 'poly', pts: [front[j], front[j2], back[j2], back[j]], fill: '#c97a0a' }); }
        it.push({ k: 'poly', pts: back, fill: '#d98a12', stroke: 'rgba(150,80,0,0.6)', sw: 0.8 });
        it.push({ k: 'poly', pts: front, fill: '#f7931a', stroke: 'rgba(150,80,0,0.6)', sw: 0.8 });
        it.push({ k: 'poly', pts: inner, fill: '#ffb547', zb: 0.01 });
        var facing = api.v.N([nx, 0, nz])[2];
        if (Math.abs(facing) > 0.25) it.push({ k: 'txt', layer: 4, p: [C[0] + nx * th * Math.sign(facing), C[1], C[2] + nz * th * Math.sign(facing)], text: '\u20BF', size: 19, weight: 700, col: '#ffffff', sx: Math.abs(facing) });
        return it;
      }
    },

    health: {
      pitch: 0.12, spanX: 3.5, spanY: 2.1, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.1,
      init: function (s) {
        var r = rng(41);
        s.pts = [];
        for (var i = 0; i < 30; i++) { var age = r(), smoker = r() < 0.3; s.pts.push({ a: age, y: smoker ? 0.52 + age * 0.34 + (r() - 0.5) * 0.1 : 0.06 + age * 0.3 + (r() - 0.5) * 0.07, sm: smoker }); }
        s.p0 = null;
      },
      show: show0,
      build: function (s, api) {
        var it = [], el = startPlay(s, api), per = api.hovering ? 620 : 950, ph = REDUCED ? 0.5 : (api.t % per) / per, i;
        var beat = REDUCED ? 0 : Math.max(Math.exp(-Math.pow((ph - 0.1) / 0.05, 2)), 0.6 * Math.exp(-Math.pow((ph - 0.28) / 0.05, 2)));
        var sc = 0.02 * (1 + 0.12 * beat), hc = [-1.22, 0.22, 0];
        function heart(z) {
          var pts = [];
          for (var k = 0; k < 40; k++) { var t = k / 40 * 6.2832, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pts.push([hc[0] + x * sc, hc[1] + y * sc, z]); }
          return pts;
        }
        it.push({ k: 'poly', pts: heart(-0.06), fill: '#9d1c27' });
        it.push({ k: 'poly', pts: heart(0.06), fill: '#e63946', stroke: 'rgba(120,20,30,0.5)', sw: 0.8 });
        var off = REDUCED ? 0 : (api.t / per) % 1, ecg = [];
        for (i = 0; i <= 50; i++) { var u = i / 50, q = (u * 1.2 + 1 - off) % 1; ecg.push([-1.72 + u * 1.0, -0.4 + ecgY(q) * 0.55, 0]); }
        it.push({ k: 'pl', pts: ecg, col: '#16a34a', w: 1.8 });
        var X0 = -0.3, X1 = 1.55, Y0 = -0.5, Y1 = 0.55, Z = -0.1;
        function at(a, y) { return [X0 + 0.08 + a * (X1 - X0 - 0.16), Y0 + 0.06 + y * (Y1 - Y0 - 0.12), Z + 0.02]; }
        it.push({ k: 'poly', layer: 0, pts: [[X0, Y0, Z], [X1, Y0, Z], [X1, Y1, Z], [X0, Y1, Z]], fill: 'rgba(255,255,255,0.95)', stroke: 'rgba(190,205,222,0.9)', sw: 1 });
        for (i = 1; i < 4; i++) it.push({ k: 'ln', layer: 0, zb: 1, a: [X0, Y0 + i * 0.2625, Z + 0.005], b: [X1, Y0 + i * 0.2625, Z + 0.005], col: 'rgba(190,205,222,0.5)' });
        it.push({ k: 'ln', layer: 0, zb: 2, a: [X0 + 0.04, Y0 + 0.04, Z + 0.01], b: [X1 - 0.02, Y0 + 0.04, Z + 0.01], col: 'rgba(90,110,135,0.7)', w: 1.2 });
        it.push({ k: 'ln', layer: 0, zb: 2, a: [X0 + 0.04, Y0 + 0.04, Z + 0.01], b: [X0 + 0.04, Y1 - 0.02, Z + 0.01], col: 'rgba(90,110,135,0.7)', w: 1.2 });
        var rev = REDUCED ? 1 : clamp(el / 900, 0, 1);
        s.pts.forEach(function (p, pi) { if (pi / s.pts.length <= rev) it.push({ k: 'pt', layer: 2, p: at(p.a, p.y), r: 2.7, pal: P3(p.sm ? '#f08c62' : '#2a9d8f') }); });
        var ln = REDUCED ? 1 : clamp((el - 900) / 700, 0, 1);
        if (ln > 0) {
          it.push({ k: 'ln', layer: 3, a: at(0, 0.52), b: at(ln, 0.52 + 0.34 * ln), col: '#e76f51', w: 2, dash: [5, 3] });
          it.push({ k: 'ln', layer: 3, a: at(0, 0.06), b: at(ln, 0.06 + 0.3 * ln), col: '#2a9d8f', w: 2, dash: [5, 3] });
        }
        it.push({ k: 'pt', layer: 4, p: [X0 + 0.16, Y1 - 0.11, Z + 0.03], r: 3, pal: P3('#f08c62') });
        it.push({ k: 'txt', layer: 5, p: [X0 + 0.22, Y1 - 0.11, Z + 0.03], text: 'smokers', size: 8.5, weight: 600, col: '#4b5c72', align: 'left' });
        it.push({ k: 'pt', layer: 4, p: [X0 + 0.16, Y1 - 0.23, Z + 0.03], r: 3, pal: P3('#2a9d8f') });
        it.push({ k: 'txt', layer: 5, p: [X0 + 0.22, Y1 - 0.23, Z + 0.03], text: 'non-smokers', size: 8.5, weight: 600, col: '#4b5c72', align: 'left' });
        it.push({ k: 'txt', layer: 6, p: [(X0 + X1) / 2, Y0 - 0.11, Z], text: 'age', size: 9.5, col: '#4b5c72' });
        it.push({ k: 'txt', layer: 6, p: [X0 - 0.1, (Y0 + Y1) / 2, Z], text: 'charges', size: 9.5, col: '#4b5c72', rot: -Math.PI / 2 });
        return it;
      }
    },

    skincare: {
      pitch: 0.28, spanX: 3.6, spanY: 2.2, offY: 0.0, hoverYaw: 0.4, hoverPitch: 0.12,
      init: function (s) {
        s.r = rng(4); s.p0 = null; s.cyc = -1; s.cur = null; s.count = [0, 0]; s.arch = -1; s.archT = -1e9;
        s.PW = ['hydrating', 'glow', 'gentle', 'smooth', 'calm']; s.NW = ['breakout', 'sticky', 'dry', 'itchy', 'greasy'];
        s.ARCH = [['tribe', '#2a9d8f'], ['snow leopard', '#3d93c9'], ['churner', '#e76f51'], ['vampire', '#9d1c27']];
      },
      show: show0,
      build: function (s, api) {
        var it = [], floor = -0.6, t = api.t, el = startPlay(s, api), i, per = api.hovering ? 1100 : 1600;
        it.push({ k: 'box', min: [-1.68, floor, -0.26], max: [-0.72, floor + 0.05, 0.26], pal: P3('#e9dcc7') });
        it.push({ k: 'cyl', b: [-1.5, floor + 0.05, 0], r: 0.11, h: 0.44, n: 18, pal: P3('#a8dcc8') });
        it.push({ k: 'cyl', b: [-1.5, floor + 0.49, 0], r: 0.035, h: 0.07, n: 10, pal: P3('#e6eef0') });
        it.push({ k: 'box', min: [-1.53, floor + 0.56, -0.025], max: [-1.42, floor + 0.6, 0.025], pal: P3('#e6eef0') });
        it.push({ k: 'cyl', b: [-1.2, floor + 0.05, 0.02], r: 0.085, h: 0.32, n: 16, pal: P3('#bfe0f2') });
        it.push({ k: 'cyl', b: [-1.2, floor + 0.37, 0.02], r: 0.03, h: 0.08, n: 10, pal: P3('#3d93c9') });
        it.push({ k: 'pt', p: [-1.2, floor + 0.49, 0.02], r: 4.4, pal: P3('#3d93c9') });
        it.push({ k: 'cyl', b: [-0.92, floor + 0.05, 0], r: 0.15, h: 0.15, n: 20, pal: P3('#f6e7c8') });
        it.push({ k: 'cyl', b: [-0.92, floor + 0.2, 0], r: 0.155, h: 0.05, n: 20, pal: P3('#d9b26a') });
        it.push({ k: 'box', min: [-0.42, floor, -0.26], max: [0.42, floor + 0.52, 0.26], pal: P3('#e8f0f6') });
        var scr = [[-0.32, floor + 0.14, 0.262], [0.32, floor + 0.14, 0.262], [0.32, floor + 0.42, 0.262], [-0.32, floor + 0.42, 0.262]];
        it.push({ k: 'poly', layer: 2, pts: scr, fill: '#e6f5f2', stroke: '#9fd3c8', sw: 1.2 });
        it.push({ k: 'txt', layer: 5, p: [0, floor + 0.34, 0.27], text: 'LSTM \u00B7 BERT', size: 8, weight: 700, col: '#1f6f6a' });
        var cyc = REDUCED ? 0 : Math.floor(el / per), f = REDUCED ? 0.7 : (el % per) / per;
        if (cyc !== s.cyc) {
          if (s.cur && !s.cur.done) { s.count[s.cur.pos ? 0 : 1]++; }
          s.cyc = cyc;
          var pos = s.r() < 0.64;
          s.cur = { pos: pos, done: false, arch: pos ? (s.r() < 0.7 ? 0 : 1) : (s.r() < 0.6 ? 2 : 3), x0: -1.5 + s.r() * 0.6 };
        }
        var scanY = floor + 0.17 + (REDUCED ? 0.1 : (0.5 + 0.5 * Math.sin(t * (f > 0.3 && f < 0.5 ? 0.02 : 0.006))) * 0.08);
        it.push({ k: 'ln', layer: 3, a: [-0.3, scanY, 0.265], b: [0.3, scanY, 0.265], col: 'rgba(42,157,143,0.7)', w: 1.4 });
        var BIN = [[0.95, '#5cc98a', '+'], [1.5, '#ef7b7b', '\u2212']];
        BIN.forEach(function (bn, bi) {
          it.push({ k: 'box', min: [bn[0] - 0.2, floor, -0.2], max: [bn[0] + 0.2, floor + 0.14, 0.2], pal: P3(bn[1]) });
          var n = Math.min(6, Math.floor(s.count[bi] / 2));
          for (var k = 0; k < n; k++) it.push({ k: 'box', layer: 2, min: [bn[0] - 0.12, floor + 0.145 + k * 0.022, -0.1], max: [bn[0] + 0.12, floor + 0.16 + k * 0.022, 0.1], pal: P3(bi ? '#fbe3e3' : '#e3f6ea') });
          it.push({ k: 'txt', layer: 6, p: [bn[0], floor + 0.38, 0], text: bn[2] + ' ' + s.count[bi], size: 11, weight: 700, col: bi ? '#b91c1c' : '#15803d' });
          var words = bi ? s.NW : s.PW, wi = Math.floor(t / 2400 + bi * 2) % words.length, wf = (t % 2400) / 2400, wal = Math.min(1, Math.min(wf, 1 - wf) * 6);
          it.push({ k: 'poly', layer: 5, pts: [[bn[0] - 0.24, floor + 0.53, 0], [bn[0] + 0.24, floor + 0.53, 0], [bn[0] + 0.24, floor + 0.67, 0], [bn[0] - 0.24, floor + 0.67, 0]], fill: 'rgba(255,255,255,' + (0.95 * wal) + ')', stroke: rgba(hex(bi ? '#ef7b7b' : '#5cc98a'), wal), sw: 1 });
          it.push({ k: 'txt', layer: 6, p: [bn[0], floor + 0.6, 0.01], text: words[wi], size: 9, weight: 600, col: bi ? '#b91c1c' : '#15803d', alpha: wal });
        });
        var c = s.cur, P, ent = [-0.46, floor + 0.3, 0.05], ex = [0.46, floor + 0.3, 0.05], bin = [c.pos ? 0.95 : 1.5, floor + 0.22, 0.05], vis = true;
        if (f < 0.3) { var u = f / 0.3; P = lerp3([c.x0, floor + 0.72, 0.1], ent, u); P[1] += 0.12 * Math.sin(Math.PI * u); }
        else if (f < 0.5) { P = ent; vis = false; }
        else if (f < 0.85) { var v2 = (f - 0.5) / 0.35; P = lerp3(ex, bin, ease(v2)); P[1] += 0.28 * Math.sin(Math.PI * v2); }
        else { P = bin; vis = false; if (!c.done) { c.done = true; s.count[c.pos ? 0 : 1]++; s.arch = c.arch; s.archT = t; } }
        if (vis) {
          var cls = f >= 0.5 ? 1 : 0, fill = cls ? hex(c.pos ? '#22c55e' : '#ef4444') : hex('#cbd5e1'), w = 0.1, h = 0.07;
          it.push({ k: 'pl', layer: 5, pts: [[P[0] - w, P[1] - h, P[2]], [P[0] + w, P[1] - h, P[2]], [P[0] + w, P[1] + h, P[2]], [P[0] - w * 0.2, P[1] + h, P[2]], [P[0] - w * 0.45, P[1] + h + 0.045, P[2]], [P[0] - w * 0.5, P[1] + h, P[2]], [P[0] - w, P[1] + h, P[2]]], closed: true, fill: rgba(fill, 0.96), col: 'rgba(255,255,255,0.85)', w: 1 });
          it.push({ k: 'txt', layer: 6, p: P, text: cls ? (c.pos ? '+' : '\u2212') : '\u2026', size: cls ? 12 : 11, weight: 700, col: '#ffffff' });
        }
        s.ARCH.forEach(function (a, ai) {
          var g = s.arch === ai ? Math.exp(-(t - s.archT) / 900) : 0, ax = -1.3 + ai * 0.86;
          it.push({ k: 'pt', layer: 5, p: [ax - 0.04, floor - 0.2, 0.36], r: 3 + 2 * g, pal: P3(a[1]) });
          it.push({ k: 'txt', layer: 6, p: [ax + 0.02, floor - 0.2, 0.36], text: a[0], size: 8.5, weight: g > 0.2 ? 700 : 500, col: g > 0.2 ? a[1] : '#4b5c72', align: 'left' });
        });
        return it;
      }
    }
  };
  for (var key in PROJECT_SCENES) if (PROJECT_SCENES.hasOwnProperty(key)) SCENES[key] = PROJECT_SCENES[key];

  /* scale and centring per chart, measured across every hover angle and animation so nothing is cut off */
  var FIT = {
    lean: [1.194, 0.057, 0.015],
    dca: [1.104, -0.019, 0.01],
    press: [1.2, 0.015, -0.271],
    scatter: [0.834, 0.006, -0.055],
    hist: [1.178, 0.014, -0.056],
    network: [0.887, 0.011, 0.012],
    box: [0.893, -0.001, 0.007],
    tree: [0.778, 0.002, -0.035],
    timeline: [1.002, -0.001, 0.003],
    experience: [1.083, 0.003, -0.014],
    volunteer: [1.049, -0.006, -0.071],
    teaching: [1.132, 0.001, -0.038],
    publication: [1.132, 0.002, -0.053],
    skills: [1.013, -0.009, -0.092],
    surface: [0.704, 0.0, -0.045],
    hoop: [0.823, 0.024, 0.028],
    pitch: [1.008, -0.0, -0.127],
    weather: [0.999, 0.006, 0.005],
    equalizer: [0.924, -0.045, -0.013],
    piano: [1.007, 0.018, 0.004],
    eu: [1.096, 0.008, -0.147],
    orderbook: [1.065, 0.003, -0.161],
    volsurface: [0.863, 0.005, -0.024],
    flights: [1.01, 0.0, -0.085],
    bandit: [1.133, -0.01, -0.123],
    clusters: [0.931, -0.011, -0.076],
    bitcoin: [0.924, -0.017, -0.006],
    health: [1.2, 0.016, -0.024],
    skincare: [1.2, -0.014, -0.232]
  };
  for (var fk in FIT) {
    if (FIT.hasOwnProperty(fk) && SCENES[fk]) { SCENES[fk].fit = FIT[fk][0]; SCENES[fk].offX = FIT[fk][1]; SCENES[fk].offY = FIT[fk][2]; }
  }

  /* ------------------------------------------------------------------ particle disk in the About header */
  var VX_BANDS = [
    { c: hex('#1e4e79'), a: 0.62, w: 1.3 },
    { c: hex('#3f6fb0'), a: 0.52, w: 1.2 },
    { c: hex('#6a7fd0'), a: 0.46, w: 1.1 },
    { c: hex('#9b8ae0'), a: 0.4, w: 1.05 },
    { c: hex('#d99ac0'), a: 0.34, w: 1 },
    { c: hex('#f0b98a'), a: 0.32, w: 0.95 },
    { c: hex('#7cbfe6'), a: 0.3, w: 0.95 }
  ];

  function HeaderDisk(header) {
    this.h = header;
    this.c = header.querySelector('.vx-layer');
    this.ctx = this.c.getContext('2d');
    var small = win.innerWidth < 700, n = small ? 560 : 1040, r = rng(31), i;
    this.unit = small ? 17 : 23;
    this.groups = VX_BANDS.map(function () { return []; });
    for (i = 0; i < n; i++) {
      var u = Math.pow(r(), 1.45), rad = 1.7 + u * 4.6;
      this.groups[Math.min(5, Math.floor(u * 6))].push({ rad: rad, th: r() * 6.2832, y: gauss(r) * (0.05 + 0.12 * u), w: Math.pow(rad / 1.7, -1.5), len: 0.07 + r() * 0.09 });
    }
    for (i = 0; i < (small ? 160 : 300); i++) {
      var ro = 6.4 + Math.pow(r(), 0.8) * 1.8;
      this.groups[6].push({ rad: ro, th: r() * 6.2832, y: gauss(r) * 0.2, w: Math.pow(ro / 1.7, -1.5), len: 0.06 + r() * 0.08 });
    }
    this.pos = null;
    this.tx = 0; this.ty = 0; this.ax = 0; this.ay = 0;
    this.dYaw = 0; this.dPitch = 0; this.vYaw = 0; this.grab = null;
    this.ripple = -1e9; this.near = false; this.nearK = 0;
    this.W = 0; this.H = 0; this.t0 = null; this.last = null; this.visible = true;
    this.bind();
  }

  HeaderDisk.prototype.computeRest = function () {
    var hr = this.c.getBoundingClientRect(), x = hr.width * 0.6, y = hr.height * 0.45;
    var spot = this.h.querySelector('.orb-spot');
    if (spot && spot.offsetWidth) {
      var sr = spot.getBoundingClientRect();
      this.pos = [sr.left + sr.width / 2 - hr.left, sr.top + sr.height / 2 - hr.top];
      return;
    }
    var name = this.h.querySelector('.hl-text'), tag = this.h.querySelector('.site-tagline'), photo = this.h.querySelector('.profile-photo');
    if (name) {
      var nr = name.getBoundingClientRect(), right = nr.right;
      if (tag && tag.firstChild) {
        var rg = doc.createRange(); rg.selectNodeContents(tag);
        var tr = rg.getBoundingClientRect(); if (tr.width) right = Math.max(right, tr.right);
      }
      y = nr.top + nr.height / 2 - hr.top;
      if (photo) {
        var pr = photo.getBoundingClientRect();
        if (pr.left > right + this.unit * 9) { x = (right + pr.left) / 2 - hr.left; y = pr.top + pr.height * 0.42 - hr.top; }
        else if (pr.bottom <= nr.top + 4) { x = (pr.right + hr.right) / 2 - hr.left; y = pr.top + pr.height / 2 - hr.top; }
        else x = hr.width * 0.7;
      }
    }
    this.pos = [x, y];
  };

  HeaderDisk.prototype.frame = function (t) {
    var W = this.c.clientWidth, H = this.c.clientHeight;
    if (!W || !H) return;
    if (W !== this.W || H !== this.H || !this.pos) {
      this.W = W; this.H = H;
      this.c.width = Math.round(W * DPR); this.c.height = Math.round(H * DPR);
      this.computeRest();
    }
    if (this.t0 == null) this.t0 = t;
    var dt = this.last == null ? 16.7 : Math.min(50, t - this.last);
    this.last = t;
    if (REDUCED && this.drawn && !this.grab && t - this.ripple > 1200) return;
    this.drawn = true;

    this.ax += (this.tx - this.ax) * 0.06;
    this.ay += (this.ty - this.ay) * 0.06;
    if (!this.grab) { this.dYaw += this.vYaw; this.vYaw *= 0.95; this.dPitch *= 0.96; }
    this.nearK += ((this.near || this.grab ? 1 : 0) - this.nearK) * 0.08;

    var R = this.unit, cx = this.pos[0], cy = this.pos[1];
    var yaw = this.ax + this.dYaw, pitch = clamp(0.24 + this.ay + this.dPitch, 0.08, 1.0);
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), D = 20;
    var intro = REDUCED ? 1 : ease((t - this.t0) / 2000);
    var boost = 1 + this.nearK * 1.3 + clamp(Math.abs(this.vYaw) * 25, 0, 2.2);
    var spd = REDUCED ? 0 : 0.0008 * boost * dt;
    var since = t - this.ripple, ripR = 1.6 + since * 0.006, ripOn = since >= 0 && since < 1100;
    var ctx = this.ctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 5.6);
    halo.addColorStop(0, 'rgba(184,224,230,' + (0.42 * intro) + ')');
    halo.addColorStop(1, 'rgba(184,224,230,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, R * 5.6, 0, 6.2832); ctx.fill();

    if (!this.stars) {
      var rs = rng(77), SC = ['255,214,120', '190,170,255', '150,210,235', '255,255,255'];
      this.stars = [];
      for (var si = 0; si < 18; si++) { var sa = rs() * 6.2832, srr = R * (6.4 + rs() * 2.6); this.stars.push({ dx: Math.max(-R * 6.8, Math.cos(sa) * srr * 1.05), dy: Math.sin(sa) * srr * 0.5, ph: rs() * 6.28, s: 1.3 + rs() * 1.7, c: SC[si % 4] }); }
    }
    for (var sj = 0; sj < this.stars.length; sj++) {
      var st = this.stars[sj], tw = REDUCED ? 0.6 : 0.5 + 0.5 * Math.sin(t * 0.0032 + st.ph), ss = st.s * (0.55 + 0.75 * tw), qx = cx + st.dx, qy = cy + st.dy;
      ctx.fillStyle = 'rgba(' + st.c + ',' + ((0.3 + 0.6 * tw) * intro) + ')';
      ctx.beginPath(); ctx.moveTo(qx, qy - ss * 2.2);
      ctx.quadraticCurveTo(qx, qy, qx + ss * 2.2, qy); ctx.quadraticCurveTo(qx, qy, qx, qy + ss * 2.2);
      ctx.quadraticCurveTo(qx, qy, qx - ss * 2.2, qy); ctx.quadraticCurveTo(qx, qy, qx, qy - ss * 2.2);
      ctx.fill();
    }
    if (!REDUCED) {
      var cyc = (t % 7000) / 900;
      if (cyc < 1) {
        var ax0 = cx + R * 9, ay0 = cy - R * 4.2, bx0 = cx - R * 7, by0 = cy + R * 1.4, hx2 = lerp(ax0, bx0, cyc), hy2 = lerp(ay0, by0, cyc);
        var dxs = ax0 - bx0, dys = ay0 - by0, dl = Math.sqrt(dxs * dxs + dys * dys), tl = Math.min(1, cyc * 4) * R * 4.5;
        var tx2 = hx2 + dxs / dl * tl, ty2 = hy2 + dys / dl * tl, sgr = ctx.createLinearGradient(hx2, hy2, tx2, ty2);
        sgr.addColorStop(0, 'rgba(255,236,190,' + (0.95 * (1 - cyc)) + ')'); sgr.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.strokeStyle = sgr; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(tx2, ty2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,250,232,' + (1 - cyc) + ')'; ctx.beginPath(); ctx.arc(hx2, hy2, 1.9, 0, 6.2832); ctx.fill();
      }
    }

    var fronts = [], lit = new Path2D(), litFront = new Path2D(), stretch = Math.pow(boost, 0.6);
    for (var b = 0; b < this.groups.length; b++) {
      var G = this.groups[b], back = new Path2D(), front = new Path2D();
      for (var i = 0; i < G.length; i++) {
        var p = G[i];
        p.th += p.w * spd;
        var rad = p.rad * (1 + (1 - intro) * 0.8), th2 = p.th - p.len * (0.6 + 1.6 * p.w) * stretch;
        var x = rad * Math.cos(p.th), z = rad * Math.sin(p.th);
        var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
        var y2 = p.y * cp - z1 * sp, zh = p.y * sp + z1 * cp, kk = D / (D - zh);
        var hx = cx + x1 * kk * R, hy = cy - y2 * kk * R;
        x = rad * Math.cos(th2); z = rad * Math.sin(th2);
        x1 = x * cyw + z * syw; z1 = -x * syw + z * cyw;
        y2 = p.y * cp - z1 * sp; var zt = p.y * sp + z1 * cp; kk = D / (D - zt);
        var path = (ripOn && Math.abs(p.rad - ripR) < 0.3) ? (zh > 0 ? litFront : lit) : (zh > 0 ? front : back);
        path.moveTo(hx, hy);
        path.lineTo(cx + x1 * kk * R, cy - y2 * kk * R);
      }
      ctx.strokeStyle = rgba(VX_BANDS[b].c, VX_BANDS[b].a * intro);
      ctx.lineWidth = VX_BANDS[b].w; ctx.lineCap = 'round';
      ctx.stroke(back);
      ctx.stroke(front);
      fronts.push(front);
    }
    ctx.strokeStyle = 'rgba(255,196,110,0.95)'; ctx.lineWidth = 1.8; ctx.stroke(lit); ctx.stroke(litFront);

    var pul = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.0026);
    var flash = ripOn ? 1 - since / 1100 : 0, Rp = R * 1.7;
    var glowR = R * (2.9 + 0.5 * pul + 0.9 * this.nearK + 1.6 * flash);
    var gl = ctx.createRadialGradient(cx, cy, Rp * 0.8, cx, cy, glowR);
    gl.addColorStop(0, 'rgba(208,194,255,' + ((0.5 + 0.2 * this.nearK) * intro) + ')');
    gl.addColorStop(0.45, 'rgba(255,214,170,' + ((0.28 + 0.14 * this.nearK) * intro) + ')');
    gl.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, 6.2832); ctx.fill();

    var self = this, tilt = this.ax * 0.6 + clamp(this.dYaw * 0.05, -0.4, 0.4);
    var rx = Rp * 2.1, ry = Rp * clamp(0.62 + 0.3 * (this.dPitch + this.ay), 0.35, 0.95), bw = Rp * 0.5;
    var RING = ['255,224,150', '214,200,255', '190,236,222', '255,200,176'];
    function ringHalf(front) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt); ctx.lineCap = 'butt';
      for (var rk = 0; rk < 4; rk++) {
        var f2 = rk / 3, rxx = rx - bw * 0.5 + bw * f2, ryy = ry - bw * 0.12 + bw * 0.24 * f2;
        ctx.beginPath(); ctx.ellipse(0, 0, rxx, ryy, 0, front ? 0 : Math.PI, front ? Math.PI : 6.2832);
        ctx.strokeStyle = 'rgba(' + RING[rk] + ',' + ((0.6 + 0.3 * self.nearK + 0.3 * flash) * intro) + ')';
        ctx.lineWidth = bw / 4 * 0.86; ctx.stroke();
      }
      ctx.restore();
    }

    var mAng = this.moonA = (this.moonA || 0) + (REDUCED ? 0 : 0.0009 * dt * (1 + this.nearK * 1.5 + clamp(Math.abs(this.vYaw) * 25, 0, 2)));
    var mx = cx + Math.cos(mAng) * R * 3.7, my = cy + Math.sin(mAng) * R * 1.05 - R * 0.25, mFront = Math.sin(mAng) > 0, mr = R * 0.34;
    function moon() {
      var mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.4, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#f6fdfb'); mg.addColorStop(0.55, '#a9dccd'); mg.addColorStop(1, '#5aa3ae');
      ctx.globalAlpha = intro;
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!mFront) moon();
    ringHalf(false);

    ctx.save();
    ctx.globalAlpha = intro;
    ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, 6.2832); ctx.clip();
    var base = ctx.createLinearGradient(cx, cy - Rp, cx, cy + Rp);
    base.addColorStop(0, '#ece6ff'); base.addColorStop(1, '#cdeaf7');
    ctx.fillStyle = base; ctx.fillRect(cx - Rp, cy - Rp, Rp * 2, Rp * 2);
    var spinP = this.bandP = (this.bandP || 0) + (REDUCED ? 0 : 0.0016 * dt * boost);
    var BANDS = [[-0.9, 0.18, '#ffe3a3'], [-0.62, 0.16, '#cfe6fb'], [-0.38, 0.22, '#ffd1bf'], [-0.1, 0.18, '#d8cffa'], [0.12, 0.24, '#ffe3a3'], [0.4, 0.16, '#bfeedd'], [0.6, 0.24, '#ffd1bf']];
    for (var k = 0; k < BANDS.length; k++) {
      var bd = BANDS[k], y0 = cy + bd[0] * Rp, hh = bd[1] * Rp, amp = Rp * 0.045, fq = 3.4 / Rp;
      ctx.beginPath();
      for (var xs = -Rp; xs <= Rp + 0.5; xs += 2) ctx.lineTo(cx + xs, y0 + Math.sin(xs * fq + spinP + k * 1.7) * amp);
      for (xs = Rp; xs >= -Rp - 0.5; xs -= 2) ctx.lineTo(cx + xs, y0 + hh + Math.sin(xs * fq * 1.3 + spinP * 1.2 + k) * amp);
      ctx.closePath(); ctx.fillStyle = bd[2]; ctx.fill();
    }
    for (k = 0; k < 4; k++) {
      var cxk = cx + ((((spinP * 0.35 + k * 0.29) % 1) + 1) % 1 * 2.6 - 1.3) * Rp, cyk = cy + (-0.55 + k * 0.36) * Rp;
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath(); ctx.ellipse(cxk, cyk, Rp * 0.34, Rp * 0.07, 0, 0, 6.2832); ctx.fill();
    }
    var spot = spinP * 0.55, sxp = cx + Math.sin(spot) * Rp * 0.55, syp = cy + Rp * 0.28, vis = Math.cos(spot);
    if (vis > -0.2) {
      ctx.globalAlpha = intro * clamp(vis + 0.2, 0, 1);
      ctx.fillStyle = '#f7a98b'; ctx.beginPath(); ctx.ellipse(sxp, syp, Rp * 0.22 * Math.max(0.3, vis), Rp * 0.11, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffd9c7'; ctx.beginPath(); ctx.ellipse(sxp, syp, Rp * 0.1 * Math.max(0.3, vis), Rp * 0.05, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = intro;
    }
    var sh = ctx.createRadialGradient(cx - Rp * 0.38, cy - Rp * 0.42, Rp * 0.05, cx, cy, Rp * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,0.8)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.1)');
    sh.addColorStop(0.75, 'rgba(60,50,120,0.06)'); sh.addColorStop(1, 'rgba(60,50,120,0.34)');
    ctx.fillStyle = sh; ctx.fillRect(cx - Rp, cy - Rp, Rp * 2, Rp * 2);
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 * intro) + ')'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, Rp - 0.8, 3.5, 5.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,160,240,' + (0.6 * intro) + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, 6.2832); ctx.stroke();
    ringHalf(true);

    if (mFront) moon();
  };

  HeaderDisk.prototype.bind = function () {
    var self = this, h = this.h;
    function local(e) { var r = self.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function busy(el) { return el && el.closest && el.closest('a, button, input, textarea, .springy'); }
    function dist(p) { return self.pos ? Math.sqrt((p[0] - self.pos[0]) * (p[0] - self.pos[0]) + (p[1] - self.pos[1]) * (p[1] - self.pos[1])) : 1e9; }
    h.addEventListener('pointermove', function (e) {
      var p = local(e), g = self.grab;
      if (g) {
        var dx = p[0] - g.lx, dy = p[1] - g.ly;
        g.lx = p[0]; g.ly = p[1];
        if (Math.abs(p[0] - g.x0) + Math.abs(p[1] - g.y0) > 4) g.moved = true;
        self.dYaw += dx * 0.012; self.vYaw = dx * 0.012;
        self.dPitch = clamp(self.dPitch + dy * 0.006, -0.3, 0.55);
        return;
      }
      if (!self.pos || REDUCED) return;
      self.tx = clamp((p[0] - self.pos[0]) / 420, -0.45, 0.45);
      self.ty = clamp((p[1] - self.pos[1]) / 520, -0.18, 0.18);
      var near = dist(p) < self.unit * 3.2 && !busy(e.target);
      if (near !== self.near) { self.near = near; h.classList.toggle('vx-near', near); }
    });
    h.addEventListener('pointerleave', function () {
      if (self.grab) return;
      self.tx = 0; self.ty = 0; self.near = false; h.classList.remove('vx-near');
    });
    h.addEventListener('pointerdown', function (e) {
      if (e.button || busy(e.target)) return;
      var p = local(e);
      if (dist(p) > self.unit * 3.2) return;
      e.preventDefault();
      self.grab = { lx: p[0], ly: p[1], x0: p[0], y0: p[1], moved: false };
      self.vYaw = 0;
      try { h.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      h.classList.add('vx-grab');
    });
    function up(e) {
      var g = self.grab;
      if (!g) return;
      self.grab = null;
      h.classList.remove('vx-grab');
      try { h.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (!g.moved && e.type === 'pointerup') { self.ripple = self.last || now(); burst(e.clientX, e.clientY, '#c9b8ff'); }
    }
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
    win.addEventListener('resize', function () { self.W = 0; });
  };

  /* ------------------------------------------------------------------ render loop */
  var scenes = [];
  function loop(t) {
    if (!doc.hidden) {
      for (var i = 0; i < scenes.length; i++) {
        var s = scenes[i];
        if (!s.visible) continue;
        try { s.frame(t); }
        catch (e) {
          s.visible = false; s.dead = true;
          if (s.c && s.c.closest) {
            var holder = s.c.closest('.mini-viz');
            if (holder) holder.classList.remove('is-3d');
            if (s.c.classList) s.c.classList.add('is-dead');
          }
          if (win.console) console.warn('[site] scene stopped', e);
        }
      }
    }
    win.requestAnimationFrame(loop);
  }

  function watch(el, obj) {
    if ('IntersectionObserver' in win) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (!obj.dead) { obj.visible = en.isIntersecting; obj.dirty = true; } });
      }, { rootMargin: '120px' });
      io.observe(el);
      obj.visible = false;
    } else {
      obj.visible = true;
    }
    if ('ResizeObserver' in win) new ResizeObserver(function () { obj.dirty = true; obj.drawn = false; }).observe(el);
  }

  function initViz() {
    each('canvas.viz3d', function (c) {
      var def = SCENES[c.getAttribute('data-scene')];
      if (!def || !c.getContext) return;
      var v = new Viz3D(c, def);
      c.__viz = v;
      scenes.push(v);
      var holder = c.closest('.mini-viz');
      if (holder) holder.classList.add('is-3d');
      watch(c, v);
    });
    each('.site-header', function (h) {
      if (!h.querySelector('.vx-layer') || !win.Path2D) return;
      var d = new HeaderDisk(h);
      scenes.push(d);
      h.classList.add('has-disk');
      watch(h, d);
    });
  }

  /* ------------------------------------------------------------------ springy toys: hobbies, interests, nav */
  function hop(el) {
    if (REDUCED) return;
    el.classList.remove('is-hop'); void el.offsetWidth; el.classList.add('is-hop');
  }
  function springy(el, onTap) {
    var st = null;
    el.classList.add('springy');
    el.setAttribute('draggable', 'false');
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      if (e.pointerType === 'mouse') e.preventDefault();
      st = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      el.classList.add('is-drag');
    });
    el.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y, vx = e.clientX - st.lx;
      st.lx = e.clientX;
      if (!st.moved && Math.abs(dx) + Math.abs(dy) > 5) st.moved = true;
      if (!st.moved) return;
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--dr', clamp(vx * 1.2, -14, 14) + 'deg');
    });
    function up(e) {
      if (!st) return;
      var moved = st.moved;
      st = null;
      el.classList.remove('is-drag');
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '0px');
      el.style.setProperty('--dr', '0deg');
      try { el.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (moved) { el._dragged = now(); return; }
      if (e.type === 'pointerup') { hop(el); if (onTap) onTap(e); }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('animationend', function (e) { if (e.animationName === 'hop') el.classList.remove('is-hop'); });
  }

  function initToys() {
    each('.hob, .interests .it', function (el) { el.addEventListener('click', function () { hop(el); }); });
  }

  /* ------------------------------------------------------------------ navigation blob */
  function initNav() {
    each('.pill-nav', function (nav) {
      var blob = nav.querySelector('.pill-blob');
      if (!blob) return;
      function place(el, instant) {
        if (!el || !el.offsetWidth) return;
        if (instant) blob.style.transition = 'none';
        blob.style.width = el.offsetWidth + 'px';
        blob.style.transform = 'translateX(' + el.offsetLeft + 'px)';
        if (instant) { void blob.offsetWidth; blob.style.transition = ''; }
      }
      nav._place = function (instant) { place(nav.querySelector('.pill.is-active'), instant); };
      nav._place(true);
      nav.classList.add('is-ready');
      each('.pill', function (p) {
        p.addEventListener('pointerenter', function () { place(p); });
        p.addEventListener('focus', function () { place(p); });
      }, nav);
      nav.addEventListener('pointerleave', function () { nav._place(); });
      nav.addEventListener('focusout', function () { setTimeout(function () { if (!nav.contains(doc.activeElement)) nav._place(); }, 0); });
    });
  }
  function refreshNavs() { each('.pill-nav', function (n) { if (n._place) n._place(true); }); }

  /* ------------------------------------------------------------------ research interests on two lines */
  function fitInterests() {
    var list = doc.querySelector('.about-tags .interests');
    if (!list) return;
    var items = list.querySelectorAll('.it');
    function lines() {
      var tops = {};
      Array.prototype.forEach.call(items, function (el) { tops[Math.round(el.offsetTop / 4)] = 1; });
      return Object.keys(tops).length;
    }
    var all = doc.querySelectorAll('.about-tags .interests'), s = 1;
    function set(v) { Array.prototype.forEach.call(all, function (l) { l.style.setProperty('--its', v); }); }
    set('1');
    if (win.innerWidth < 860 || !list.offsetWidth) return;
    while (lines() > 2 && s > 0.78) { s -= 0.02; set(s.toFixed(2)); }
  }

  /* ------------------------------------------------------------------ skills: search, chips, constellation */
  function initSkills() {
    var grid = doc.querySelector('.skill-grid');
    if (!grid) return;
    var tools = doc.querySelector('.skill-tools'), input = tools && tools.querySelector('input'), count = tools && tools.querySelector('.skill-count');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.skill-card'));
    var total = grid.querySelectorAll('.chip').length, idle = count ? count.textContent : '';
    if (tools) tools.hidden = false;
    function search() {
      var q = (input.value || '').trim().toLowerCase(), hits = 0;
      grid.classList.toggle('is-searching', !!q);
      cards.forEach(function (card) {
        var inCard = 0, title = card.querySelector('.skill-title').textContent.toLowerCase(), titleHit = q && title.indexOf(q) > -1;
        Array.prototype.forEach.call(card.querySelectorAll('.chip'), function (ch) {
          var on = !!q && (titleHit || ch.textContent.toLowerCase().indexOf(q) > -1);
          ch.classList.toggle('is-match', on);
          if (on) { inCard++; hits++; }
        });
        card.classList.toggle('is-empty', !!q && !inCard);
      });
      if (count) count.textContent = q ? (hits ? hits + (hits === 1 ? ' match' : ' matches') : 'No match yet') : idle;
    }
    if (input) {
      input.addEventListener('input', search);
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; search(); } });
    }
    var canvas = doc.querySelector('canvas[data-scene="skills"]');
    function viz() { return canvas && canvas.__viz; }
    cards.forEach(function (card) {
      var i = +card.getAttribute('data-i');
      card.addEventListener('pointerenter', function () { var v = viz(); if (v && !v.inside) { v.hover = i; v.dirty = true; } });
      card.addEventListener('pointerleave', function () { var v = viz(); if (v && !v.inside) { v.hover = null; v.dirty = true; } });
    });
    each('.chip', function (ch) {
      ch.addEventListener('click', function (e) {
        hop(ch);
        var r = ch.getBoundingClientRect();
        burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2, getComputedStyle(ch.closest('.skill-card')).getPropertyValue('--hc').trim());
      });
    }, grid);
    if (canvas) {
      canvas.addEventListener('vizhover', function (e) {
        cards.forEach(function (card) { card.classList.toggle('is-lit', +card.getAttribute('data-i') === e.detail); });
      });
      canvas.addEventListener('vizpick', function (e) {
        var card = cards[e.detail];
        if (!card) return;
        card.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
        card.classList.remove('is-flash'); void card.offsetWidth; card.classList.add('is-flash');
      });
    }
  }

  /* ------------------------------------------------------------------ page change */
  function burst(x, y, tint) {
    if (REDUCED || !doc.body.animate) return;
    var cols = ['#bfe6dc', '#bfdcf2', '#ffe7a3', '#ffd2b0', tint || '#9fd3e0'];
    for (var i = 0; i < 10; i++) {
      var d = doc.createElement('span');
      d.className = 'burst-dot';
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.background = cols[i % cols.length];
      doc.body.appendChild(d);
      var a = (i / 10) * 6.2832 + Math.random() * 0.5, dist = 24 + Math.random() * 22;
      var an = d.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + (Math.cos(a) * dist).toFixed(1) + 'px,' + (Math.sin(a) * dist).toFixed(1) + 'px) scale(0.2)', opacity: 0 }
      ], { duration: 540, easing: 'cubic-bezier(.2,.7,.2,1)' });
      an.onfinish = (function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; })(d);
    }
  }

  function showView(name, animate) {
    var views = doc.querySelectorAll('.view');
    if (!views.length) return false;
    var target = doc.querySelector('.view[data-view="' + name + '"]');
    if (!target) return false;
    var current = doc.querySelector('.view.is-current');
    if (current === target) return true;
    function swap() {
      Array.prototype.forEach.call(views, function (v) { v.classList.toggle('is-current', v === target); });
      root.classList.remove('is-leaving');
      refreshNavs(); fitInterests();
      win.scrollTo(0, 0);
      untip();
      try { history.replaceState(null, '', '#' + name); } catch (er) { /* ignore */ }
    }
    if (animate && current && !REDUCED) { root.classList.add('is-leaving'); setTimeout(swap, 320); }
    else swap();
    return true;
  }

  function initViews() {
    if (!doc.querySelector('.view')) return;
    var h = (win.location.hash || '').replace('#', '');
    if (!showView(h, false)) showView('about', false);
  }

  function initTransitions() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a.pill, a[data-view]') : null;
      if (!a) return;
      var x = e.clientX, y = e.clientY;
      if (!x && !y) { var r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      if (a.classList.contains('pill')) {
        burst(x, y, getComputedStyle(a).getPropertyValue('--pc').trim());
        a.classList.add('is-press');
        setTimeout(function () { a.classList.remove('is-press'); }, 160);
      }
      var wait = REDUCED ? 0 : 170;
      var view = a.getAttribute('data-view');
      if (view && doc.querySelector('.view')) { e.preventDefault(); setTimeout(function () { showView(view, true); }, wait * 0.6); return; }
      if (a.classList.contains('is-active')) { e.preventDefault(); return; }
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      e.preventDefault();
      setTimeout(function () { root.classList.add('is-leaving'); }, wait * 0.4);
      setTimeout(function () { win.location.href = href; }, wait + 220);
    });
    win.addEventListener('pageshow', function () { root.classList.remove('is-leaving'); });
  }

  /* ------------------------------------------------------------------ small things */
  function initClock() {
    var els = doc.querySelectorAll('.clock-time');
    if (!els.length) return;
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' }); } catch (e) { fmt = null; }
    function tick() {
      var d = new Date();
      var s = fmt ? fmt.format(d) : (('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2));
      Array.prototype.forEach.call(els, function (el) { if (el.textContent !== s) { el.textContent = s; el.setAttribute('datetime', s); } });
    }
    tick();
    setInterval(tick, 5000);
  }

  function initHighlighter() {
    if (REDUCED) return;
    each('.hl-wrap', function (w) {
      var path = w.querySelector('.hl path');
      if (!path || !path.animate) return;
      var busy = false;
      w.addEventListener('pointerenter', function () {
        if (busy) return;
        busy = true;
        var an = path.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 850, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
        an.onfinish = function () { busy = false; };
      });
    });
  }

  function initFilter() {
    var bar = doc.querySelector('.filter-bar'), list = doc.querySelector('.project-list');
    if (!bar || !list) return;
    var entries = Array.prototype.slice.call(list.querySelectorAll('.entry[data-tags]'));
    var counts = { all: entries.length };
    entries.forEach(function (el) {
      el.getAttribute('data-tags').split(/\s+/).forEach(function (t) { if (t) counts[t] = (counts[t] || 0) + 1; });
    });
    each('.fchip', function (b) {
      var n = b.querySelector('.fcount');
      if (n) n.textContent = counts[b.getAttribute('data-f')] || 0;
    }, bar);
    bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.fchip') : null;
      if (!b) return;
      var f = b.getAttribute('data-f'), shown = 0;
      hop(b);
      each('.fchip', function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }, bar);
      entries.forEach(function (el) {
        var show = f === 'all' || (' ' + el.getAttribute('data-tags') + ' ').indexOf(' ' + f + ' ') > -1;
        var token = el._ft = (el._ft || 0) + 1;
        if (show) {
          if (el.hidden) { el.classList.add('is-out'); el.hidden = false; void el.offsetWidth; }
          var delay = REDUCED ? 0 : 30 + shown++ * 35;
          setTimeout(function () { if (el._ft === token) el.classList.remove('is-out'); }, delay);
        } else {
          el.classList.add('is-out');
          setTimeout(function () { if (el._ft === token) el.hidden = true; }, REDUCED ? 0 : 230);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    root.classList.add('js-ready');
    safe(initViews);
    safe(initNav);
    safe(fitInterests);
    safe(initSkills);
    safe(initToys);
    safe(initTransitions);
    safe(initClock);
    safe(initHighlighter);
    safe(initFilter);
    safe(initViz);
    var rz = null;
    win.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { refreshNavs(); fitInterests(); }, 120); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { refreshNavs(); fitInterests(); });
    win.addEventListener('load', function () { refreshNavs(); fitInterests(); });
    win.requestAnimationFrame(loop);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
