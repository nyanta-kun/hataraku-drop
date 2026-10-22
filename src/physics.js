// Matter.js のラッパー。固定タイムステップ、合体の二重発生防止。
var HDPhysics = (function () {
  var M = Matter;
  var C = HDConfig, G = HDGame, S = HDShapes;

  function create(onMerge) {
    var engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = C.GRAVITY;
    var world = engine.world;
    var time = 0;          // シミュレーション時間（秒）
    var acc = 0;
    var pairs = [];
    var pieces = [];

    function buildWalls() {
      var t = C.WALL, w = C.BOX_W, h = C.BOX_H;
      var opt = { isStatic: true, friction: C.FRICTION, restitution: 0, label: 'wall' };
      M.Composite.add(world, [
        M.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opt),
        M.Bodies.rectangle(-t / 2, h / 2 - 400, t, h + 800, opt),
        M.Bodies.rectangle(w + t / 2, h / 2 - 400, t, h + 800, opt)
      ]);
    }
    buildWalls();

    // 形モード: 矩形・円の部品を束ねた複合ボディ（凹形状でも分解ライブラリ不要）。
    // 外接矩形の中心が (x, y) に来るように置く。position は重心になるので、
    // 絵の原点との差を hdOffset（ローカル座標）に保存する。
    function makeBody(stage, x, y, opt) {
      var L = S.layout(stage);
      if (!C.SHAPE_BODIES) {
        var c = M.Bodies.circle(x, y, L.s, opt);
        c.hdOffset = { x: 0, y: 0 };
        return c;
      }
      var ox = x - L.cx, oy = y - L.cy;
      var parts = S.partsAt(stage, ox, oy).map(function (p) {
        if (p.type === 'circle') return M.Bodies.circle(p.x, p.y, p.r, opt);
        var o = Object.assign({}, opt, { angle: p.a });
        if (p.chamfer > 0.5) o.chamfer = { radius: p.chamfer };
        return M.Bodies.rectangle(p.x, p.y, p.w, p.h, o);
      });
      var b = M.Body.create(Object.assign({}, opt, { parts: parts }));
      M.Body.setInertia(b, b.inertia * C.SHAPE_INERTIA_SCALE);
      b.hdOffset = { x: b.position.x - ox, y: b.position.y - oy };
      return b;
    }

    function addPiece(stage, x, y, vel) {
      var b = makeBody(stage, x, y, {
        restitution: C.RESTITUTION, friction: C.FRICTION, frictionStatic: 0.3,
        label: 'piece'
      });
      b.hdStage = stage;
      b.hdBorn = time;
      b.hdMerged = false;
      b.hdPop = 0;
      if (vel) M.Body.setVelocity(b, vel);
      M.Composite.add(world, b);
      pieces.push(b);
      return b;
    }

    function removePiece(b) {
      M.Composite.remove(world, b);
      var i = pieces.indexOf(b);
      if (i >= 0) pieces.splice(i, 1);
    }

    function collect(e) {
      for (var i = 0; i < e.pairs.length; i++) {
        // 複合ボディでは bodyA/bodyB は部品。親ボディに hdStage などがある
        var a = e.pairs[i].bodyA.parent, b = e.pairs[i].bodyB.parent;
        if (a.label === 'piece' && b.label === 'piece' && a.hdStage === b.hdStage) pairs.push([a, b]);
      }
    }
    M.Events.on(engine, 'collisionStart', collect);
    M.Events.on(engine, 'collisionActive', collect);

    // 外接矩形の中心（addPiece の x, y と同じ基準）
    function center(b) {
      return { x: (b.bounds.min.x + b.bounds.max.x) / 2, y: (b.bounds.min.y + b.bounds.max.y) / 2 };
    }

    function resolveMerges() {
      var list = pairs; pairs = [];
      for (var i = 0; i < list.length; i++) {
        var a = list[i][0], b = list[i][1];
        // 同じ body が複数ペアに出ても 1 回しか合体させない
        if (a.hdMerged || b.hdMerged || a.hdStage !== b.hdStage) continue;
        var res = G.mergeResult(a.hdStage, b.hdStage);
        if (!res) continue;
        a.hdMerged = b.hdMerged = true;
        var x = (center(a).x + center(b).x) / 2, y = (center(a).y + center(b).y) / 2;
        var vx = (a.velocity.x + b.velocity.x) / 2, vy = (a.velocity.y + b.velocity.y) / 2;
        var from = a.hdStage;
        removePiece(a); removePiece(b);
        if (!res.vanish) {
          var nb = addPiece(res.stage, x, y, { x: vx, y: vy });
          nb.hdPop = 1;
        }
        onMerge({ from: from, stage: res.stage, vanish: res.vanish, score: res.score, x: x, y: y });
      }
    }

    function step(dtSec) {
      acc += Math.min(dtSec, C.MAX_FRAME);
      while (acc >= C.STEP) {
        M.Engine.update(engine, C.STEP * 1000);
        time += C.STEP;
        acc -= C.STEP;
        resolveMerges();
      }
      for (var i = 0; i < pieces.length; i++) {
        if (pieces[i].hdPop > 0) pieces[i].hdPop = Math.max(0, pieces[i].hdPop - dtSec / 0.25);
      }
    }

    // ゲームオーバー判定用の状態（純粋関数に渡す形）
    function snapshot() {
      return pieces.map(function (b) {
        return {
          y: b.bounds.min.y, r: 0,  // 乗り物の一番高い点
          age: time - b.hdBorn,
          // Matter 0.20 の velocity は 1/60 秒あたりの px（STEP に依存しない）
          speed: Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y)
        };
      });
    }

    function clear() {
      pieces.slice().forEach(removePiece);
      pairs = []; acc = 0;
    }

    return {
      addPiece: addPiece, step: step, clear: clear, snapshot: snapshot,
      pieces: function () { return pieces; },
      time: function () { return time; }
    };
  }

  return { create: create };
})();
