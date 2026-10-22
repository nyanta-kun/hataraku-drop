// 純粋関数: 進化表・合体結果・得点・出現抽選・ゲームオーバー判定
// ブラウザではグローバル HDGame、Node では module.exports。
var HDGame = (function () {
  var C = (typeof HDConfig !== 'undefined') ? HDConfig : require('./config.js');

  // 段階は 1 始まり。ratio は段階1を 1.0 とした半径比。
  var STAGES = [
    { stage: 1,  name: 'ねこぐるま',             color: '#9aa0a6', ratio: 1.00, points: 1 },
    { stage: 2,  name: 'フォークリフト',         color: '#f6c933', ratio: 1.20, points: 3 },
    { stage: 3,  name: 'ごみしゅうしゅうしゃ',   color: '#5cb85c', ratio: 1.45, points: 6 },
    { stage: 4,  name: 'ショベルカー',           color: '#f08a24', ratio: 1.70, points: 10 },
    { stage: 5,  name: 'ブルドーザー',           color: '#c9a227', ratio: 2.00, points: 15 },
    { stage: 6,  name: 'ダンプカー',             color: '#3f7fd8', ratio: 2.35, points: 21 },
    { stage: 7,  name: 'きゅうきゅうしゃ',       color: '#f4f4f4', ratio: 2.75, points: 28 },
    { stage: 8,  name: 'しょうぼうしゃ',         color: '#e53935', ratio: 3.20, points: 36 },
    { stage: 9,  name: 'みずタンクしゃ',         color: '#b71c1c', ratio: 3.70, points: 45 },
    { stage: 10, name: 'はしごしゃ',             color: '#e8512f', ratio: 4.30, points: 55 },
    { stage: 11, name: 'ちょうだいはしごしゃ',   color: '#d4202a', ratio: 5.00, points: 66 }
  ];
  var MAX_STAGE = STAGES.length;

  function info(stage) {
    if (!(stage >= 1 && stage <= MAX_STAGE) || stage !== Math.floor(stage)) {
      throw new RangeError('stage out of range: ' + stage);
    }
    return STAGES[stage - 1];
  }

  function radiusOf(stage) {
    return C.BASE_RADIUS * info(stage).ratio;
  }

  // 同じ段階同士なら合体結果を返す。違えば null。
  // 11 同士は消えてボーナス（vanish: true）。それ以外は 1 段階上の乗り物（得点は新しい段階の点数）。
  function mergeResult(a, b) {
    if (a !== b) return null;
    info(a);
    if (a === MAX_STAGE) return { vanish: true, stage: null, score: C.VANISH_BONUS };
    return { vanish: false, stage: a + 1, score: info(a + 1).points };
  }

  // rng は 0以上1未満を返す関数（省略時は Math.random）
  function pickSpawnStage(rng) {
    var r = (rng || Math.random)();
    var n = C.SPAWN_MAX - C.SPAWN_MIN + 1;
    var idx = Math.floor(r * n);
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;
    return C.SPAWN_MIN + idx;
  }

  // 落下・合体の直後や、速く動いているピースはゲームオーバー判定から除外する。
  // piece: { y, r, age(秒), speed(Matter の velocity 単位＝1/60 秒あたり px) }
  function isFresh(piece) {
    return piece.age < C.FRESH_TIME || piece.speed > C.FRESH_SPEED;
  }

  // ラインを超えている（判定対象の）ピースがあるか
  function isOverLine(piece) {
    if (isFresh(piece)) return false;
    return piece.y - piece.r < C.LINE_Y;
  }

  function anyOverLine(pieces) {
    for (var i = 0; i < pieces.length; i++) if (isOverLine(pieces[i])) return true;
    return false;
  }

  // 超過時間を進める。超えていなければ 0 に戻る。
  function advanceOverTimer(timer, over, dt) {
    return over ? timer + dt : 0;
  }

  function isGameOver(timer) {
    return timer >= C.OVER_GRACE;
  }

  var api = {
    STAGES: STAGES, MAX_STAGE: MAX_STAGE,
    info: info, radiusOf: radiusOf, mergeResult: mergeResult,
    pickSpawnStage: pickSpawnStage, isFresh: isFresh, isOverLine: isOverLine,
    anyOverLine: anyOverLine, advanceOverTimer: advanceOverTimer, isGameOver: isGameOver
  };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HDGame;
