// Canvas 描画。乗り物は単位座標（-1..1）で描き、ピースの大きさ・回転に合わせて拡縮する。
// SHAPE_BODIES が true なら乗り物の絵だけを描く（当たり判定も同じ形）。false なら円のバッジの中に描く。
var HDRender = (function () {
  var C = HDConfig, G = HDGame, S = HDShapes;
  var OUT = '#3a2b24';
  var LW = 0.055;

  // ---- 部品 ----
  function rr(ctx, x, y, w, h, rad, fill) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
  }
  function circ(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
  }
  function line(ctx, x1, y1, x2, y2, w, col) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col || OUT; ctx.stroke();
  }
  function wheel(ctx, x, y, r) {
    circ(ctx, x, y, r, '#2b2b2b');
    circ(ctx, x, y, r * 0.45, '#cfd3d6');
  }
  function win(ctx, x, y, w, h) { rr(ctx, x, y, w, h, 0.04, '#bfe6fb'); }
  // 回転灯
  function light(ctx, x, y, col) {
    rr(ctx, x - 0.08, y - 0.08, 0.16, 0.1, 0.04, col);
    line(ctx, x - 0.14, y - 0.14, x - 0.2, y - 0.2, 0.04, col);
    line(ctx, x + 0.14, y - 0.14, x + 0.2, y - 0.2, 0.04, col);
  }
  function tracks(ctx, x, y, w, h) {
    rr(ctx, x, y, w, h, h / 2, '#444');
    circ(ctx, x + h / 2, y + h / 2, h * 0.28, '#9aa');
    circ(ctx, x + w - h / 2, y + h / 2, h * 0.28, '#9aa');
    circ(ctx, x + w / 2, y + h / 2, h * 0.22, '#9aa');
  }

  // ---- 乗り物 (stage 1..11) ----
  var draw = {};

  draw[1] = function (ctx) { // ねこぐるま（工事の一輪の手押し車）
    line(ctx, -0.25, 0.05, -0.72, -0.28, 0.09);           // 持ち手
    line(ctx, -0.25, 0.05, -0.32, 0.56, 0.07);            // 後ろの足（地面まで届く）
    line(ctx, 0.05, 0.12, 0.42, 0.4, 0.07);               // 車輪の支え
    poly(ctx, [[-0.5, -0.32], [0.6, -0.32], [0.42, 0.12], [-0.3, 0.12]], '#7f8a94'); // 荷台
    poly(ctx, [[-0.42, -0.32], [0.52, -0.32], [0.3, -0.48], [-0.1, -0.5]], '#d9a95b'); // 砂
    rr(ctx, -0.56, -0.38, 1.22, 0.1, 0.05, '#a3adb6');    // 縁
    wheel(ctx, 0.42, 0.4, 0.2);
  };

  draw[2] = function (ctx) { // フォークリフト
    rr(ctx, -0.65, -0.05, 0.85, 0.4, 0.08, '#f6c933');
    rr(ctx, -0.5, -0.5, 0.5, 0.45, 0.06, null);
    line(ctx, -0.5, -0.5, 0.0, -0.5, 0.06);
    rr(ctx, -0.42, -0.4, 0.34, 0.3, 0.04, '#bfe6fb');
    rr(ctx, 0.24, -0.62, 0.1, 1.0, 0.03, '#666');
    rr(ctx, 0.34, 0.24, 0.32, 0.07, 0.02, '#aaa');
    rr(ctx, 0.34, 0.1, 0.32, 0.07, 0.02, '#aaa');
    rr(ctx, 0.5, -0.05, 0.14, 0.2, 0.03, '#c28a2c');
    wheel(ctx, -0.42, 0.4, 0.17); wheel(ctx, 0.05, 0.4, 0.14);
  };

  draw[3] = function (ctx) { // ごみしゅうしゅうしゃ
    rr(ctx, -0.7, -0.15, 0.45, 0.5, 0.08, '#3e9a3e');
    win(ctx, -0.64, -0.08, 0.28, 0.22);
    rr(ctx, -0.22, -0.5, 0.92, 0.85, 0.1, '#5cb85c');
    circ(ctx, 0.5, -0.12, 0.17, '#2e7d2e');
    line(ctx, -0.05, -0.38, 0.7, -0.38, 0.04, '#2e7d2e');
    // リサイクルっぽい矢印 (三つの点)
    circ(ctx, 0.05, -0.08, 0.05, '#e8f5e8'); circ(ctx, 0.2, 0.05, 0.05, '#e8f5e8'); circ(ctx, -0.05, 0.12, 0.05, '#e8f5e8');
    wheel(ctx, -0.48, 0.4, 0.15); wheel(ctx, 0.42, 0.4, 0.15);
  };

  draw[4] = function (ctx) { // ショベルカー
    tracks(ctx, -0.6, 0.2, 1.0, 0.3);
    rr(ctx, -0.55, -0.2, 0.9, 0.4, 0.08, '#f08a24');
    rr(ctx, -0.5, -0.58, 0.45, 0.4, 0.07, '#f4a94f');
    win(ctx, -0.45, -0.52, 0.3, 0.26);
    // アーム
    line(ctx, 0.15, -0.1, 0.5, -0.55, 0.14, OUT); line(ctx, 0.15, -0.1, 0.5, -0.55, 0.09, '#f08a24');
    line(ctx, 0.5, -0.55, 0.75, -0.05, 0.12, OUT); line(ctx, 0.5, -0.55, 0.75, -0.05, 0.07, '#f08a24');
    poly(ctx, [[0.68, -0.05], [0.9, -0.05], [0.85, 0.2], [0.65, 0.12]], '#777');
  };

  draw[5] = function (ctx) { // ブルドーザー
    tracks(ctx, -0.55, 0.15, 1.1, 0.35);
    rr(ctx, -0.4, -0.15, 0.8, 0.35, 0.08, '#d6a91f');
    rr(ctx, -0.05, -0.55, 0.42, 0.42, 0.06, '#e5bf45');
    win(ctx, 0.0, -0.49, 0.3, 0.28);
    rr(ctx, -0.3, -0.5, 0.07, 0.36, 0.03, '#555');
    // ブレード
    rr(ctx, -0.78, -0.3, 0.16, 0.8, 0.05, '#8d8d8d');
    line(ctx, -0.62, 0.0, -0.4, 0.05, 0.07, '#666');
  };

  draw[6] = function (ctx) { // ダンプカー
    poly(ctx, [[-0.1, 0.1], [0.78, -0.15], [0.7, -0.55], [-0.15, -0.25]], '#2f66b8');
    poly(ctx, [[-0.1, 0.1], [0.78, -0.15], [0.78, -0.05], [-0.1, 0.2]], '#8a8f94');
    rr(ctx, -0.75, -0.12, 0.5, 0.45, 0.08, '#3f7fd8');
    win(ctx, -0.7, -0.05, 0.3, 0.22);
    rr(ctx, -0.75, 0.2, 1.5, 0.12, 0.03, '#34384a');
    wheel(ctx, -0.5, 0.4, 0.17); wheel(ctx, 0.3, 0.4, 0.17); wheel(ctx, 0.58, 0.4, 0.17);
  };

  draw[7] = function (ctx) { // きゅうきゅうしゃ (赤い帯)
    rr(ctx, -0.75, -0.42, 1.5, 0.78, 0.12, '#fafafa');
    rr(ctx, -0.75, -0.02, 1.5, 0.14, 0.0, '#e53935');
    rr(ctx, -0.75, -0.42, 1.5, 0.78, 0.12, null);
    rr(ctx, -0.65, -0.34, 0.35, 0.28, 0.05, '#bfe6fb');
    rr(ctx, -0.18, -0.34, 0.3, 0.2, 0.04, '#bfe6fb');
    rr(ctx, 0.28, -0.34, 0.3, 0.2, 0.04, '#bfe6fb');
    rr(ctx, -0.12, -0.6, 0.24, 0.16, 0.06, '#e53935');
    rr(ctx, -0.5, -0.56, 0.2, 0.14, 0.05, '#3a7bd5');
    wheel(ctx, -0.45, 0.4, 0.16); wheel(ctx, 0.45, 0.4, 0.16);
  };

  function fireCab(ctx, body) {
    rr(ctx, -0.78, -0.12, 0.5, 0.48, 0.08, body);
    win(ctx, -0.72, -0.06, 0.34, 0.24);
  }

  draw[8] = function (ctx) { // しょうぼうしゃ (ポンプしゃ)
    fireCab(ctx, '#e53935');
    rr(ctx, -0.3, -0.25, 1.05, 0.6, 0.08, '#e53935');
    rr(ctx, -0.3, 0.02, 1.05, 0.1, 0, '#fafafa');
    // はしご
    line(ctx, -0.25, -0.38, 0.7, -0.38, 0.04); line(ctx, -0.25, -0.5, 0.7, -0.5, 0.04);
    for (var i = 0; i < 6; i++) line(ctx, -0.2 + i * 0.17, -0.5, -0.2 + i * 0.17, -0.38, 0.03);
    light(ctx, -0.55, -0.12, '#ffd23f');
    rr(ctx, 0.2, -0.18, 0.4, 0.14, 0.04, '#b0b5ba');
    wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.2, 0.4, 0.16); wheel(ctx, 0.55, 0.4, 0.16);
  };

  draw[9] = function (ctx) { // みずタンクしゃ
    fireCab(ctx, '#b71c1c');
    rr(ctx, -0.28, -0.1, 1.05, 0.46, 0.06, '#8e1414');
    rr(ctx, -0.22, -0.52, 0.92, 0.5, 0.25, '#c9ced3');
    line(ctx, -0.1, -0.4, 0.55, -0.4, 0.05, '#fff');
    rr(ctx, -0.22, -0.34, 0.92, 0.06, 0, '#b71c1c');
    circ(ctx, 0.62, -0.02, 0.1, '#ffd23f');
    light(ctx, -0.55, -0.12, '#ffd23f');
    wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.15, 0.4, 0.16); wheel(ctx, 0.5, 0.4, 0.16);
  };

  draw[10] = function (ctx) { // はしごしゃ
    fireCab(ctx, '#e8512f');
    rr(ctx, -0.3, -0.05, 1.05, 0.4, 0.06, '#e8512f');
    rr(ctx, -0.3, 0.12, 1.05, 0.08, 0, '#ffd23f');
    // 斜めのはしご
    ctx.save(); ctx.translate(-0.2, -0.1); ctx.rotate(-0.38);
    rr(ctx, 0, -0.14, 1.2, 0.2, 0.02, null);
    line(ctx, 0, -0.14, 1.2, -0.14, 0.045); line(ctx, 0, 0.06, 1.2, 0.06, 0.045);
    for (var i = 1; i < 8; i++) line(ctx, i * 0.15, -0.14, i * 0.15, 0.06, 0.03);
    ctx.restore();
    rr(ctx, -0.12, -0.18, 0.3, 0.14, 0.04, '#ffd23f');
    light(ctx, -0.55, -0.12, '#ffd23f');
    wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.2, 0.4, 0.16); wheel(ctx, 0.55, 0.4, 0.16);
  };

  draw[11] = function (ctx, shaped) { // ちょうだいはしごしゃ
    // 金のかざり（円モードのみ。形モードでは円を描かない）
    if (!shaped) {
      ctx.beginPath(); ctx.arc(0, 0, 0.93, 0, Math.PI * 2);
      ctx.lineWidth = 0.07; ctx.strokeStyle = '#f2c230'; ctx.stroke();
    }
    fireCab(ctx, '#d4202a');
    rr(ctx, -0.3, -0.05, 1.0, 0.4, 0.06, '#d4202a');
    rr(ctx, -0.3, 0.12, 1.0, 0.08, 0, '#f2c230');
    // 二段のはしご
    ctx.save(); ctx.translate(-0.25, -0.1); ctx.rotate(-0.55);
    rr(ctx, 0, -0.12, 0.9, 0.18, 0.02, null);
    line(ctx, 0, -0.12, 0.9, -0.12, 0.045); line(ctx, 0, 0.06, 0.9, 0.06, 0.045);
    for (var i = 1; i < 6; i++) line(ctx, i * 0.15, -0.12, i * 0.15, 0.06, 0.03);
    line(ctx, 0.9, -0.03, 1.28, -0.03, 0.12, OUT); line(ctx, 0.9, -0.03, 1.28, -0.03, 0.07, '#f2c230');
    ctx.restore();
    // きょうりょくな回転灯
    light(ctx, -0.55, -0.12, '#ffd23f');
    rr(ctx, -0.1, -0.16, 0.26, 0.12, 0.04, '#f2c230');
    // ほし
    star(ctx, 0.55, -0.4, 0.12, '#fff3b0');
    wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.15, 0.4, 0.16); wheel(ctx, 0.5, 0.4, 0.16);
  };

  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 0.03; ctx.strokeStyle = '#c9a227'; ctx.stroke();
  }

  // 乗り物 1 つを描く。
  // (x, y): ボディの位置、angle: 回転、pop: 拡大率、off: 絵の原点から見た (x, y) のずれ（ローカル座標 px。
  // Matter の複合ボディなら body.hdOffset）。絵の原点 = (x, y) - rotate(off, angle)
  function drawVehicle(ctx, stage, x, y, angle, pop, off) {
    var L = S.layout(stage);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    if (pop) ctx.scale(pop, pop);
    if (off) ctx.translate(-off.x, -off.y);
    ctx.lineJoin = 'round';
    if (C.SHAPE_BODIES) {
      ctx.scale(L.s, L.s);
      draw[stage](ctx, true);
    } else {
      ctx.scale(L.s, L.s);
      var inf = G.info(stage);
      // 円のバッジ
      var g = ctx.createRadialGradient(-0.3, -0.35, 0.1, 0, 0, 1);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, tint(inf.color));
      ctx.beginPath(); ctx.arc(0, 0, 0.97, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 0.06; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.94, 0, Math.PI * 2); ctx.clip();
      ctx.scale(0.94, 0.94);
      draw[stage](ctx, false);
    }
    ctx.restore();
  }

  // 外接矩形の中心を (x, y) に置いて描く（落とす前に手元にある絵・プレビュー用）
  function drawCentered(ctx, stage, x, y, angle, pop) {
    var L = S.layout(stage);
    drawVehicle(ctx, stage, x, y, angle, pop, { x: L.cx, y: L.cy });
  }

  // 背景用に色をうすくする
  var tintCache = {};
  function tint(hex) {
    if (tintCache[hex]) return tintCache[hex];
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var m = function (v) { return Math.round(v + (255 - v) * 0.45); };
    return (tintCache[hex] = 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')');
  }

  // ---- 箱・シーン ----
  function drawScene(ctx, st) {
    var W = C.BOX_W, H = C.BOX_H;
    // 箱の中
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff6dc'); bg.addColorStop(1, '#ffe0a8');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // ゲームオーバーライン
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = st.danger ? 'rgba(229,57,53,' + (0.5 + 0.5 * Math.sin(st.t * 12)) + ')' : 'rgba(229,57,53,0.55)';
    ctx.beginPath(); ctx.moveTo(0, C.LINE_Y); ctx.lineTo(W, C.LINE_Y); ctx.stroke();
    ctx.restore();

    // ガイド線
    if (st.held) {
      var hr = S.layout(st.held.stage).hh;
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(90,60,40,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(st.held.x, C.DROP_Y + hr); ctx.lineTo(st.held.x, H); ctx.stroke();
      ctx.restore();
      drawCentered(ctx, st.held.stage, st.held.x, C.DROP_Y, 0);
    }

    var ps = st.pieces;
    for (var i = 0; i < ps.length; i++) {
      var b = ps[i];
      var pop = b.hdPop > 0 ? 1 + 0.25 * Math.sin(b.hdPop * Math.PI) : 1;
      drawVehicle(ctx, b.hdStage, b.position.x, b.position.y, b.angle, pop, b.hdOffset);
    }

    // エフェクト（光る輪）
    for (var j = 0; j < st.effects.length; j++) {
      var e = st.effects[j];
      var k = e.age / e.life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.big ? '#ffd23f' : '#ffffff';
      ctx.lineWidth = (e.big ? 7 : 4) * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.7 + k * 1.1), 0, Math.PI * 2); ctx.stroke();
      if (e.big) {
        ctx.strokeStyle = '#ff6b4a';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + k * 1.5), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 「つぎ」表示用: 小さな canvas に 1 つ描く
  function drawPreview(canvas, stage) {
    var dpr = window.devicePixelRatio || 1;
    var size = canvas.clientWidth || 48;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = canvas.height = Math.round(size * dpr); }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = canvas.width / 2;
    // 大きさの違いが分かるよう、段階5を最大としてスケール
    var k = G.radiusOf(stage) / G.radiusOf(G.MAX_STAGE > 5 ? 5 : G.MAX_STAGE);
    var want = s * 0.92 * (0.55 + 0.45 * k);   // 円モードの半径 ＝ 形モードの半幅
    var L = S.layout(stage);
    // 形モードで高さがはみ出す場合は縮める
    if (C.SHAPE_BODIES && L.hh * want / L.hw > s * 0.95) want = s * 0.95 * L.hw / L.hh;
    var f = want / L.hw;
    ctx.save();
    ctx.translate(s, s); ctx.scale(f, f);
    drawCentered(ctx, stage, 0, 0, 0);
    ctx.restore();
  }

  // canvas を論理サイズ BOX_W×BOX_H に合わせる。戻り値は拡縮率（論理→CSS px）
  function fit(canvas, availW, availH) {
    var scale = Math.min(availW / C.BOX_W, availH / C.BOX_H);
    if (!(scale > 0)) scale = 1;
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(C.BOX_W * scale) + 'px';
    canvas.style.height = Math.floor(C.BOX_H * scale) + 'px';
    canvas.width = Math.round(C.BOX_W * scale * dpr);
    canvas.height = Math.round(C.BOX_H * scale * dpr);
    return scale;
  }

  function begin(canvas, scale) {
    var ctx = canvas.getContext('2d');
    var k = canvas.width / C.BOX_W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return ctx;
  }

  return { drawScene: drawScene, drawVehicle: drawVehicle, drawCentered: drawCentered, drawPreview: drawPreview, fit: fit, begin: begin };
})();
