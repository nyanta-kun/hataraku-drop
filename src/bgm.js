// BGM: Web Audio で合成するチップチューン風ループ。外部ファイルは使わない。
// 楽譜はデータ（midi 番号と長さ）。先読みスケジューラ（setInterval + AudioContext.currentTime）で鳴らす。
// ブラウザではグローバル HDBgm、Node では module.exports（純粋関数とスケジューラをテストする）。
var HDBgm = (function () {
  var KEY_ON = 'hataraku-drop.bgm';
  var KEY_VOL = 'hataraku-drop.bgmvol';
  var DEFAULT_VOL = 0.7;      // 初期音量（合体音より小さめ）
  var MAX_GAIN = 0.3;         // 音量スライダー 100% のときのゲイン

  // ---- 楽譜（16分音符を1ステップとする。4/4 で 1小節 = 16ステップ、全16小節 ≒ 29秒） ----
  // melody: 小節ごとの [midi, 長さ(ステップ)]。midi 0 は休符
  var SCORE = {
    bpm: 132,
    stepsPerBar: 16,
    // 小節ごとのコード根音（midi）。C Am F G / C Am F G / F G Em Am / F G C C
    roots: [48, 45, 41, 43, 48, 45, 41, 43, 41, 43, 40, 45, 41, 43, 48, 48],
    melody: [
      [[76, 2], [79, 2], [84, 4], [79, 2], [76, 2], [79, 4]],
      [[81, 4], [81, 2], [79, 2], [76, 4], [72, 4]],
      [[77, 2], [81, 2], [84, 4], [81, 2], [77, 2], [81, 4]],
      [[79, 4], [79, 2], [77, 2], [74, 4], [71, 4]],
      [[76, 2], [79, 2], [84, 4], [88, 4], [84, 4]],
      [[81, 2], [84, 2], [81, 4], [76, 4], [72, 4]],
      [[77, 4], [81, 4], [84, 4], [81, 2], [77, 2]],
      [[79, 4], [77, 2], [74, 2], [71, 4], [0, 4]],
      [[81, 4], [84, 2], [81, 2], [77, 4], [81, 4]],
      [[83, 4], [79, 2], [83, 2], [86, 4], [83, 4]],
      [[84, 4], [83, 2], [79, 2], [76, 4], [79, 4]],
      [[81, 2], [84, 2], [88, 4], [84, 4], [81, 4]],
      [[84, 4], [81, 2], [77, 2], [81, 4], [84, 4]],
      [[83, 2], [86, 2], [83, 2], [79, 2], [74, 4], [79, 4]],
      [[84, 4], [79, 2], [76, 2], [79, 4], [84, 4]],
      [[84, 8], [79, 4], [76, 4]]
    ],
    // パーカッション（小節内のステップ）。fills の小節は snare を差し替える
    perc: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
    fills: { 7: [4, 12, 14, 15], 15: [4, 12, 13, 14, 15] }
  };

  // ---- 純粋関数 ----
  function noteHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function totalSteps(score) { return score.roots.length * score.stepsPerBar; }
  function stepSeconds(score) { return 60 / score.bpm / 4; }
  function loopSeconds(score) { return totalSteps(score) * stepSeconds(score); }

  // 楽譜の誤りを文字列の配列で返す（空なら正常）
  function validateScore(score) {
    var errs = [];
    var bars = score.roots.length;
    if (!(score.bpm > 0)) errs.push('bpm');
    if (score.melody.length !== bars) errs.push('melody の小節数 ' + score.melody.length + ' != ' + bars);
    score.melody.forEach(function (bar, i) {
      var sum = 0;
      bar.forEach(function (n) {
        if (n.length !== 2 || !(n[1] > 0) || n[1] !== Math.floor(n[1])) errs.push('小節' + (i + 1) + ' の長さ');
        if (n[0] !== 0 && !(n[0] >= 24 && n[0] <= 108)) errs.push('小節' + (i + 1) + ' の音高 ' + n[0]);
        sum += n[1];
      });
      if (sum !== score.stepsPerBar) errs.push('小節' + (i + 1) + ' の合計 ' + sum + ' != ' + score.stepsPerBar);
    });
    var perc = [score.perc.kick, score.perc.snare, score.perc.hat];
    Object.keys(score.fills || {}).forEach(function (k) { perc.push(score.fills[k]); });
    perc.forEach(function (p) {
      p.forEach(function (s) { if (!(s >= 0 && s < score.stepsPerBar)) errs.push('パーカッションの位置 ' + s); });
    });
    return errs;
  }

  // 楽譜を step 昇順のイベント列にする。type: lead | bass | kick | snare | hat。len はステップ数
  function buildEvents(score) {
    var ev = [];
    var spb = score.stepsPerBar;
    for (var b = 0; b < score.roots.length; b++) {
      var base = b * spb, pos = 0;
      score.melody[b].forEach(function (n) {
        if (n[0]) ev.push({ step: base + pos, type: 'lead', midi: n[0], len: n[1] });
        pos += n[1];
      });
      // ベース: 根音と5度を4分音符で交互に（ズンチャ）
      for (var q = 0; q < 4; q++) {
        ev.push({ step: base + q * 4, type: 'bass', midi: score.roots[b] + (q % 2 ? 7 : 0), len: 3 });
      }
      var snare = (score.fills && score.fills[b]) || score.perc.snare;
      score.perc.kick.forEach(function (s) { ev.push({ step: base + s, type: 'kick', len: 2 }); });
      snare.forEach(function (s) { ev.push({ step: base + s, type: 'snare', len: 2 }); });
      score.perc.hat.forEach(function (s) {
        if (snare.indexOf(s) < 0) ev.push({ step: base + s, type: 'hat', len: 1 });
      });
    }
    ev.sort(function (a, b) { return a.step - b.step; });
    return ev;
  }

  // 保存値の読み込み変換。壊れた値は既定値に戻す
  function parseEnabled(raw) { return raw === '0' ? false : true; }
  function parseVolume(raw) {
    if (raw === null || raw === undefined || raw === '') return DEFAULT_VOL;
    var v = parseFloat(raw);
    if (!isFinite(v)) return DEFAULT_VOL;
    return Math.max(0, Math.min(1, v));
  }
  function volumeToGain(v) { v = Math.max(0, Math.min(1, v)); return MAX_GAIN * v * v; }

  var EVENTS = buildEvents(SCORE);

  // ---- 音の合成 ----
  var noiseCache = null;   // { ctx, buf }
  function noiseBuffer(c) {
    if (noiseCache && noiseCache.ctx === c) return noiseCache.buf;
    var buf = c.createBuffer(1, Math.floor(c.sampleRate / 2), c.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 12345;   // 毎回同じ並びにする（試聴用 WAV も同じになる）
    for (var i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    noiseCache = { ctx: c, buf: buf };
    return buf;
  }

  // 単音: 立ち上がり atk、dur の終わりに向けて減衰。ノードは osc + gain の2つだけ
  function note(c, out, type, hz, t0, dur, peak, sustain) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
    g.gain.linearRampToValueAtTime(peak * sustain, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function kick(c, out, t0) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.09);
    g.gain.setValueAtTime(0.32, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + 0.18);
  }

  function noiseHit(c, out, t0, dur, peak, ftype, freq) {
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(c); s.loop = true;
    f.type = ftype; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  // out: { lead, drums } 各々の入力ノード。t0 はこのイベントの開始時刻
  function playEvent(c, outs, e, t0, stepSec) {
    var dur = e.len * stepSec;
    switch (e.type) {
      case 'lead': note(c, outs.lead, 'square', noteHz(e.midi), t0, dur * 0.92, 0.13, 0.7); break;
      case 'bass': note(c, outs.drums, 'triangle', noteHz(e.midi), t0, dur * 0.95, 0.24, 0.8); break;
      case 'kick': kick(c, outs.drums, t0); break;
      case 'snare': noiseHit(c, outs.drums, t0, 0.11, 0.09, 'bandpass', 1800); break;
      case 'hat': noiseHit(c, outs.drums, t0, 0.04, 0.035, 'highpass', 7000); break;
    }
  }

  // 出力先 dest に、リード用ローパス付きの入力を作る
  function makeOuts(c, dest) {
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    lp.connect(dest);
    return { lead: lp, drums: dest };
  }

  // 試聴用: 楽譜 loops 周ぶんをまとめてスケジュールする（OfflineAudioContext 用）
  function renderTo(c, dest, loops) {
    var outs = makeOuts(c, dest), sec = stepSeconds(SCORE), loopSec = loopSeconds(SCORE);
    for (var l = 0; l < (loops || 1); l++) {
      for (var i = 0; i < EVENTS.length; i++) playEvent(c, outs, EVENTS[i], l * loopSec + EVENTS[i].step * sec, sec);
    }
  }

  // ---- 再生制御 ----
  var AHEAD = 0.35;        // 先読み時間（秒）
  var INTERVAL = 40;       // スケジューラの間隔（ミリ秒）
  var FADE_IN = 0.15, FADE_OUT = 0.6;

  var enabled = true, volume = DEFAULT_VOL;
  var want = false;        // ゲーム中で、BGM を鳴らしたい
  var hidden = false;
  var session = null;      // { c, gain, outs, idx, loopStart, timer }
  var created = 0;         // 作ったノード数の目安（デバッグ表示用）
  var onChange = null;

  try {
    enabled = parseEnabled(localStorage.getItem(KEY_ON));
    volume = parseVolume(localStorage.getItem(KEY_VOL));
  } catch (e) {}

  function save() {
    try { localStorage.setItem(KEY_ON, enabled ? '1' : '0'); localStorage.setItem(KEY_VOL, String(volume)); } catch (e) {}
  }
  function effective() {
    var muted = false;
    try { muted = typeof HDAudio !== 'undefined' && HDAudio.isMuted(); } catch (e) {}
    return enabled && !muted;   // 「おと」ボタンがマスター。オフなら BGM も止まる
  }

  function tick() {
    var s = session;
    if (!s || s.closing) return;
    var c = s.c, sec = stepSeconds(SCORE), loopSec = loopSeconds(SCORE);
    var limit = c.currentTime + AHEAD;
    // 長く止まっていた場合は遅れた分を飛ばし、現在位置に合わせて続きから鳴らす
    var guard = 0;
    while (guard++ < 400) {
      var e = EVENTS[s.idx];
      var t = s.loopStart + e.step * sec;
      if (t >= limit) break;
      if (t >= c.currentTime - 0.05) {
        try { playEvent(c, s.outs, e, Math.max(t, c.currentTime), sec); created++; } catch (err) {}
      }
      s.idx++;
      if (s.idx >= EVENTS.length) { s.idx = 0; s.loopStart += loopSec; }
    }
  }

  function openSession(c, out) {
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volumeToGain(volume)), c.currentTime + FADE_IN);
    gain.connect(out);
    var s = { c: c, gain: gain, outs: makeOuts(c, gain), idx: 0, loopStart: c.currentTime + 0.08, timer: null, closing: false };
    s.timer = setInterval(tick, INTERVAL);
    session = s;
    tick();
  }

  function closeSession(fade) {
    var s = session;
    if (!s) return;
    session = null;
    s.closing = true;
    clearInterval(s.timer);
    var c = s.c, now = c.currentTime;
    try {
      s.gain.gain.cancelScheduledValues(now);
      s.gain.gain.setValueAtTime(Math.max(0.0001, s.gain.gain.value), now);
      s.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
    } catch (e) {}
    // 余韻が消えたらつなぎを外す（残りのノードは stop 済みで回収される）
    setTimeout(function () { try { s.gain.disconnect(); } catch (e) {} }, fade * 1000 + 150);
  }

  // 状態（want / 有効 / 画面の表示）に合わせて鳴らす・止める
  function sync() {
    var should = want && effective();
    if (should && !session) {
      var c = typeof HDAudio !== 'undefined' ? HDAudio.context() : null;
      if (c) openSession(c, HDAudio.output());
    } else if (!should && session) {
      closeSession(FADE_OUT);
    }
    if (onChange) onChange();
  }

  function start() { if (session) closeSession(0.05); want = true; sync(); }          // 最初から
  function stop() { want = false; sync(); }                                           // フェードアウト
  function refresh() { sync(); }

  function setEnabled(on) { enabled = !!on; save(); sync(); }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, +v || 0));
    save();
    if (session) {
      var g = session.gain.gain, now = session.c.currentTime;
      try { var cur = g.value; g.cancelScheduledValues(now); g.setValueAtTime(cur, now); g.setTargetAtTime(Math.max(0.0001, volumeToGain(volume)), now, 0.03); } catch (e) {}
    }
    if (onChange) onChange();
  }

  // タブが隠れたらコンテキストを一時停止（currentTime が止まるので続きから再開できる）
  function onVisibility() {
    hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    var c = typeof HDAudio !== 'undefined' ? HDAudio.context(false) : null;
    if (hidden) {
      if (c && c.suspend) { try { var sp = c.suspend(); if (sp && sp.catch) sp.catch(function () {}); } catch (e) { closeSession(0.05); } }
      else closeSession(0.05);
    } else {
      if (c && c.resume) { try { var rp = c.resume(); if (rp && rp.catch) rp.catch(function () {}); } catch (e) {} }
      sync();
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVisibility);

  return {
    SCORE: SCORE, EVENTS: EVENTS, DEFAULT_VOL: DEFAULT_VOL, KEY_ON: KEY_ON, KEY_VOL: KEY_VOL,
    noteHz: noteHz, validateScore: validateScore, buildEvents: buildEvents, loopSeconds: loopSeconds, stepSeconds: stepSeconds,
    parseEnabled: parseEnabled, parseVolume: parseVolume, volumeToGain: volumeToGain,
    renderTo: renderTo,
    start: start, stop: stop, refresh: refresh, setEnabled: setEnabled, setVolume: setVolume,
    isEnabled: function () { return enabled; },
    getVolume: function () { return volume; },
    isPlaying: function () { return !!session; },
    scheduled: function () { return created; },
    onChange: function (fn) { onChange = fn; },
    _tick: tick
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HDBgm;
