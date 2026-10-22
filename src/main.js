// 画面遷移・入力・localStorage・メインループ
(function () {
  var C = HDConfig, G = HDGame;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('game'), nextCanvas = $('next');
  var stageEl = $('stage');
  var scale = 1;
  var ctx = null;

  var mode = 'title';           // title | play | over
  var score = 0, hi = 0;
  var held = null;              // { stage, x }
  var nextStage = 1;
  var cooldown = 0;
  var aimX = C.BOX_W / 2;
  var overTimer = 0;
  var effects = [];
  var clock = 0;
  var inputLockUntil = 0;       // この時刻まで落下操作を受けない（ダブルタップ対策）

  // ---- 保存 ----
  function loadHi() {
    try { var v = parseInt(localStorage.getItem(C.KEY_HI), 10); return v > 0 ? v : 0; } catch (e) { return 0; }
  }
  function saveHi(v) { try { localStorage.setItem(C.KEY_HI, String(v)); } catch (e) {} }
  hi = loadHi();

  // ---- 物理 ----
  var physics = HDPhysics.create(function (m) {
    score += m.score;
    var r = m.vanish ? G.radiusOf(G.MAX_STAGE) : G.radiusOf(m.stage);
    var big = m.vanish || m.stage >= 8;
    effects.push({ x: m.x, y: m.y, r: r, age: 0, life: big ? 0.6 : 0.4, big: big });
    if (m.vanish) HDAudio.playVanish(); else HDAudio.playMerge(m.stage);
    updateHud();
  });

  // ---- HUD ----
  function updateHud() {
    $('score').textContent = score;
    $('hi').textContent = Math.max(hi, score);
    if (mode === 'play') HDRender.drawPreview(nextCanvas, nextStage);
  }
  function updateMuteUi() {
    var m = HDAudio.isMuted();
    $('mute').classList.toggle('off', m);
    $('mute').setAttribute('aria-label', m ? 'おと オフ' : 'おと オン');
    $('title-mute').textContent = m ? 'おと：オフ' : 'おと：オン';
  }

  // ---- 画面 ----
  function show(id, on) { $(id).hidden = !on; }

  function toTitle() {
    mode = 'title';
    show('title', true); show('over', false);
    $('title-hi').textContent = hi;
  }

  function newHeld() {
    held = { stage: nextStage, x: clampX(aimX, nextStage) };
    nextStage = G.pickSpawnStage();
    updateHud();
  }

  function startGame() {
    physics.clear();
    effects = [];
    score = 0; overTimer = 0; cooldown = 0;
    aimX = C.BOX_W / 2;
    nextStage = G.pickSpawnStage();
    mode = 'play';
    activePointerId = null;
    inputLockUntil = clock + 0.25;
    show('title', false); show('over', false);
    newHeld();
    updateHud();
  }

  function gameOver() {
    mode = 'over';
    held = null;
    var isNew = score > hi;
    if (isNew) { hi = score; saveHi(hi); }
    $('over-score').textContent = score;
    $('over-hi').textContent = hi;
    $('new-record').hidden = !isNew;
    show('over', true);
    updateHud();
  }

  // ---- 入力 ----
  function clampX(x, stage) {
    var r = HDShapes.layout(stage).hw;   // 角度0での半幅（形モードでは車体の横幅の半分）
    return Math.max(r + 2, Math.min(C.BOX_W - r - 2, x));
  }
  function toLogicalX(ev) {
    // 枠線を除いた描画領域で換算する（#game は content-box）
    var rect = canvas.getBoundingClientRect();
    var left = rect.left + canvas.clientLeft;
    return (ev.clientX - left) / (canvas.clientWidth / C.BOX_W);
  }
  function aim(ev) {
    aimX = toLogicalX(ev);
    if (held) held.x = clampX(aimX, held.stage);
  }
  function release() {
    if (mode !== 'play' || !held || clock < inputLockUntil) return;
    physics.addPiece(held.stage, held.x, C.DROP_Y);
    HDAudio.playDrop();
    held = null;
    cooldown = C.COOLDOWN;
  }

  // 狙い・落下は「キャンバスで最初に押したポインタ（左ボタン/タッチ）」だけを追う。
  // isPrimary は画面のどこかに先に触れた指に付くので使わない
  var activePointerId = null;
  function endPointer(ev) { if (ev.pointerId === activePointerId) activePointerId = null; }

  canvas.addEventListener('pointerdown', function (ev) {
    HDAudio.unlock();
    if (mode !== 'play' || ev.button !== 0 || activePointerId !== null) return;
    if (clock < inputLockUntil) return;
    activePointerId = ev.pointerId;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    aim(ev);
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (mode === 'play' && ev.pointerId === activePointerId) aim(ev);
  });
  canvas.addEventListener('pointerup', function (ev) {
    HDAudio.unlock();
    if (ev.pointerId !== activePointerId) return;
    activePointerId = null;
    if (mode !== 'play') return;
    aim(ev);
    release();
  });
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  // キャプチャに失敗して外で離された場合の保険（バブル段階なのでキャンバスの処理の後に動く）
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);
  document.addEventListener('pointerdown', function () { HDAudio.unlock(); }, true);
  document.addEventListener('pointerup', function () { HDAudio.unlock(); }, true);
  document.addEventListener('click', function () { HDAudio.unlock(); }, true);
  document.addEventListener('touchend', function () { HDAudio.unlock(); }, true);
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function toggleMute() { HDAudio.setMuted(!HDAudio.isMuted()); updateMuteUi(); }
  $('mute').addEventListener('click', toggleMute);
  $('title-mute').addEventListener('click', toggleMute);
  $('start').addEventListener('click', startGame);
  $('retry').addEventListener('click', startGame);
  $('to-title').addEventListener('click', toTitle);

  // ---- デバッグ（?debug を付けると段階指定で落とせる） ----
  function debugDrop(stage) {
    var x = clampX(aimX, stage);
    return physics.addPiece(stage, x, C.DROP_Y);
  }
  window.hdDebug = { drop: debugDrop, physics: physics, state: function () { return { mode: mode, score: score, hi: hi, overTimer: overTimer }; } };
  if (/[?&]debug\b/.test(location.search) || location.hash === '#debug') {
    var dbg = $('debug');
    dbg.hidden = false;
    for (var s = 1; s <= G.MAX_STAGE; s++) {
      (function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = s;
        b.addEventListener('click', function () { if (mode === 'play') debugDrop(s); });
        dbg.appendChild(b);
      })(s);
    }
    for (var n = 1; n <= G.MAX_STAGE + 1; n++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = n <= G.MAX_STAGE ? 'おと' + n : 'きえる';
        b.addEventListener('click', function () { HDAudio.unlock(); if (n <= G.MAX_STAGE) HDAudio.playMerge(n); else HDAudio.playVanish(); });
        dbg.appendChild(b);
      })(n);
    }
  }

  // ---- レイアウト ----
  function layout() {
    var availW = stageEl.clientWidth - 16 - 8;   // 余白 + 枠線
    var availH = stageEl.clientHeight - 8 - 8;
    scale = HDRender.fit(canvas, availW, availH);
    ctx = HDRender.begin(canvas, scale);
    updateHud();
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);

  // ---- メインループ ----
  var last = 0;
  function frame(now) {
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (dt > C.MAX_FRAME) dt = C.MAX_FRAME;
    clock += dt;

    if (mode === 'play') {
      physics.step(dt);
      if (!held) {
        cooldown -= dt;
        if (cooldown <= 0) newHeld();
      }
      var over = G.anyOverLine(physics.snapshot());
      overTimer = G.advanceOverTimer(overTimer, over, dt);
      if (G.isGameOver(overTimer)) gameOver();
    } else if (mode === 'title') {
      // タイトル中は物理を止める
    }

    for (var i = effects.length - 1; i >= 0; i--) {
      effects[i].age += dt;
      if (effects[i].age >= effects[i].life) effects.splice(i, 1);
    }

    if (ctx) {
      HDRender.drawScene(ctx, {
        pieces: physics.pieces(), held: held, effects: effects,
        danger: overTimer > 0, t: clock
      });
    }
    requestAnimationFrame(frame);
  }

  updateMuteUi();
  toTitle();
  layout();
  requestAnimationFrame(frame);
})();
