// 乗り物の形（当たり判定の部品）。render.js の絵と同じ単位座標で定義する。
// 原点は絵の中心 (0,0)。x は右、y は下。単位 1 = 絵の半径 1 の円。
// 部品は、矩形 {type:'rect', x, y, w, h, a?, chamfer?} か 円 {type:'circle', x, y, r}。
// 矩形の (x, y) は「中心」。a は回転（ラジアン）、chamfer は角の丸め半径。
// ブラウザではグローバル HDShapes、Node では module.exports。
var HDShapes = (function () {
  var C = (typeof HDConfig !== 'undefined') ? HDConfig : require('./config.js');
  var G = (typeof HDGame !== 'undefined') ? HDGame : require('./game-logic.js');

  function rect(x, y, w, h, chamfer, a) {
    return { type: 'rect', x: x, y: y, w: w, h: h, a: a || 0, chamfer: chamfer || 0 };
  }
  function circle(x, y, r) { return { type: 'circle', x: x, y: y, r: r }; }
  // 点 (px,py) を原点に、角度 ang で傾けた座標系の矩形（ローカル x: lx0..lx1, y: ly0..ly1）
  function tilted(px, py, ang, lx0, ly0, lx1, ly1, chamfer) {
    var cx = (lx0 + lx1) / 2, cy = (ly0 + ly1) / 2, c = Math.cos(ang), s = Math.sin(ang);
    return rect(px + cx * c - cy * s, py + cx * s + cy * c, lx1 - lx0, ly1 - ly0, chamfer, ang);
  }
  // 線分 (x1,y1)-(x2,y2) を太さ t の矩形にする
  function seg(x1, y1, x2, y2, t) {
    var dx = x2 - x1, dy = y2 - y1;
    return rect((x1 + x2) / 2, (y1 + y2) / 2, Math.sqrt(dx * dx + dy * dy), t, 0.02, Math.atan2(dy, dx));
  }

  var PARTS = {};
  PARTS[1] = [ // ねこぐるま
    rect(0.05, -0.19, 1.1, 0.62, 0.06),
    circle(0.42, 0.4, 0.2),
    rect(-0.3, 0.3, 0.14, 0.56, 0.03),
    seg(-0.25, 0.05, -0.72, -0.28, 0.18)
  ];
  PARTS[2] = [ // フォークリフト
    rect(-0.225, 0.15, 0.85, 0.4, 0.08),
    rect(-0.25, -0.275, 0.5, 0.45, 0.06),
    rect(0.29, -0.12, 0.14, 1.0, 0.03),
    rect(0.5, 0.2, 0.32, 0.25, 0.03),
    rect(0.57, 0.05, 0.14, 0.2, 0.03),
    circle(-0.42, 0.4, 0.17), circle(0.05, 0.4, 0.14)
  ];
  PARTS[3] = [ // ごみしゅうしゅうしゃ
    rect(-0.475, 0.1, 0.45, 0.5, 0.08),
    rect(0.24, -0.075, 0.92, 0.85, 0.1),
    circle(-0.48, 0.4, 0.15), circle(0.42, 0.4, 0.15)
  ];
  PARTS[4] = [ // ショベルカー
    rect(-0.1, 0.35, 1.0, 0.3, 0.14),
    rect(-0.1, 0, 0.9, 0.4, 0.08),
    rect(-0.275, -0.38, 0.45, 0.4, 0.07),
    seg(0.15, -0.1, 0.5, -0.55, 0.16),
    seg(0.5, -0.55, 0.75, -0.05, 0.14),
    rect(0.77, 0.07, 0.24, 0.26, 0.04)
  ];
  PARTS[5] = [ // ブルドーザー
    rect(0, 0.325, 1.1, 0.35, 0.17),
    rect(0, 0.025, 0.8, 0.35, 0.08),
    rect(0.16, -0.34, 0.42, 0.42, 0.06),
    rect(-0.265, -0.32, 0.1, 0.4, 0.03),
    rect(-0.7, 0.1, 0.16, 0.8, 0.05),
    rect(-0.51, 0.03, 0.24, 0.12, 0.02)
  ];
  PARTS[6] = [ // ダンプカー
    tilted(-0.1, 0.1, -0.277, 0, -0.38, 0.92, 0, 0.03),
    rect(0, 0.26, 1.5, 0.12, 0.03),
    rect(-0.5, 0.105, 0.5, 0.45, 0.08),
    circle(-0.5, 0.4, 0.17), circle(0.3, 0.4, 0.17), circle(0.58, 0.4, 0.17)
  ];
  PARTS[7] = [ // きゅうきゅうしゃ
    rect(0, -0.03, 1.5, 0.78, 0.12),
    rect(0, -0.52, 0.24, 0.16, 0.05),
    rect(-0.4, -0.49, 0.2, 0.14, 0.05),
    circle(-0.45, 0.4, 0.16), circle(0.45, 0.4, 0.16)
  ];
  var CAB = rect(-0.53, 0.12, 0.5, 0.48, 0.08);
  var LIGHT = rect(-0.55, -0.22, 0.3, 0.2, 0.05);
  var W3 = [circle(-0.5, 0.4, 0.16), circle(0.2, 0.4, 0.16), circle(0.55, 0.4, 0.16)];
  PARTS[8] = [ // しょうぼうしゃ
    CAB, rect(0.225, 0.05, 1.05, 0.6, 0.08), rect(0.225, -0.44, 0.95, 0.18, 0.03), LIGHT
  ].concat(W3);
  PARTS[9] = [ // みずタンクしゃ
    CAB, rect(0.245, 0.13, 1.05, 0.46, 0.06), rect(0.24, -0.27, 0.92, 0.5, 0.22), LIGHT
  ].concat([circle(-0.5, 0.4, 0.16), circle(0.15, 0.4, 0.16), circle(0.5, 0.4, 0.16)]);
  PARTS[10] = [ // はしごしゃ
    CAB, rect(0.225, 0.15, 1.05, 0.4, 0.06),
    tilted(-0.2, -0.1, -0.38, -0.03, -0.165, 1.23, 0.085, 0.02),
    LIGHT
  ].concat(W3);
  PARTS[11] = [ // ちょうだいはしごしゃ
    CAB, rect(0.2, 0.15, 1.0, 0.4, 0.06),
    tilted(-0.25, -0.1, -0.55, -0.03, -0.145, 0.93, 0.085, 0.02),
    tilted(-0.25, -0.1, -0.55, 0.9, -0.09, 1.34, 0.03, 0.02),
    LIGHT
  ].concat([circle(-0.5, 0.4, 0.16), circle(0.15, 0.4, 0.16), circle(0.5, 0.4, 0.16)]);

  function partBounds(p) {
    if (p.type === 'circle') return { x0: p.x - p.r, x1: p.x + p.r, y0: p.y - p.r, y1: p.y + p.r };
    var c = Math.cos(p.a), s = Math.sin(p.a), hw = p.w / 2, hh = p.h / 2;
    var ex = Math.abs(hw * c) + Math.abs(hh * s), ey = Math.abs(hw * s) + Math.abs(hh * c);
    return { x0: p.x - ex, x1: p.x + ex, y0: p.y - ey, y1: p.y + ey };
  }

  // 単位座標での外接矩形
  function unitBounds(stage) {
    G.info(stage);
    var b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    PARTS[stage].forEach(function (p) {
      var q = partBounds(p);
      b.x0 = Math.min(b.x0, q.x0); b.x1 = Math.max(b.x1, q.x1);
      b.y0 = Math.min(b.y0, q.y0); b.y1 = Math.max(b.y1, q.y1);
    });
    return b;
  }

  var cache = {};
  // 段階ごとの配置情報。形モードでは車体の横幅が 2r になるよう拡縮する。
  // s: 単位→px の倍率 / cx, cy: 原点から見た外接矩形の中心(px) / hw, hh: 外接矩形の半幅・半高(px)
  // 円モードでは原点＝中心で hw = hh = r。
  function layout(stage) {
    var shape = !!C.SHAPE_BODIES;
    var key = stage + (shape ? 's' : 'c');
    if (cache[key]) return cache[key];
    var r = G.radiusOf(stage), out;
    if (!shape) {
      out = { s: r, cx: 0, cy: 0, hw: r, hh: r };
    } else {
      var u = unitBounds(stage), s = r / ((u.x1 - u.x0) / 2);
      out = {
        s: s, cx: (u.x0 + u.x1) / 2 * s, cy: (u.y0 + u.y1) / 2 * s,
        hw: r, hh: (u.y1 - u.y0) / 2 * s
      };
    }
    return (cache[key] = out);
  }

  // 物理用の部品の定義（原点が (ox,oy) のときのワールド座標）。Matter 非依存。
  function partsAt(stage, ox, oy) {
    var s = layout(stage).s;
    return PARTS[stage].map(function (p) {
      if (p.type === 'circle') return { type: 'circle', x: ox + p.x * s, y: oy + p.y * s, r: p.r * s };
      var w = p.w * s, h = p.h * s;
      return { type: 'rect', x: ox + p.x * s, y: oy + p.y * s, w: w, h: h, a: p.a,
               chamfer: Math.min(p.chamfer * s, Math.min(w, h) * 0.45) };
    });
  }

  var api = { PARTS: PARTS, unitBounds: unitBounds, layout: layout, partsAt: partsAt };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HDShapes;
