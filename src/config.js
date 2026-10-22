// 定数（調整前提）。ブラウザではグローバル HDConfig、Node では module.exports。
var HDConfig = {
  // 箱（論理座標。画面に合わせて拡縮する）
  BOX_W: 360,
  BOX_H: 560,
  WALL: 40,            // 壁の厚み（箱の外側に張り出す）
  LINE_Y: 96,          // ゲームオーバーライン（上端からの y）
  DROP_Y: 44,          // 落とす位置の y
  BASE_RADIUS: 17,     // 段階1の半径（形モードでは横幅 ≒ 2r の基準）
  SHAPE_BODIES: true,  // true: 乗り物の形そのものが当たり判定。false: 従来の円ボディ＋円の絵
  SHAPE_INERTIA_SCALE: 3, // 形ボディの慣性の倍率（大きいほど転がりにくい）

  // 物理
  GRAVITY: 1.0,
  RESTITUTION: 0.1,
  FRICTION: 0.05,
  STEP: 1 / 120,       // 固定タイムステップ（秒）
  MAX_FRAME: 0.1,      // 1フレームで進める最大時間（秒）

  // ルール
  COOLDOWN: 0.5,       // 落下後の待ち時間（秒）
  OVER_GRACE: 2.0,     // ラインを超え続けてよい時間（秒）
  FRESH_TIME: 1.2,     // 落下・合体直後はゲームオーバー判定から除外する時間（秒）
  FRESH_SPEED: 3.0,    // これより速いピースも判定から除外（Matter の velocity 単位＝1/60 秒あたりの px。3.0 ≒ 180px/s）
  SPAWN_MIN: 1,
  SPAWN_MAX: 5,
  VANISH_BONUS: 100,

  // 保存キー
  KEY_HI: 'hataraku-drop.hi',
  KEY_MUTE: 'hataraku-drop.mute'
};
if (typeof module !== 'undefined' && module.exports) module.exports = HDConfig;
