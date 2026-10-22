// Web Audio の乗り物ごとの効果音。外部ファイルは使わない。
var HDAudio = (function () {
  var ctx = null;
  var muted = false;

  try { muted = localStorage.getItem(HDConfig.KEY_MUTE) === '1'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state !== 'running') {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    return ctx;
  }

  // 最初のユーザー操作で呼ぶ
  function unlock() { ensure(); }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(HDConfig.KEY_MUTE, muted ? '1' : '0'); } catch (e) {}
  }
  function isMuted() { return muted; }

  // ---- 合体音（段階ごとに違う乗り物の音） ----
  var bus = null;          // マスターゲイン -> コンプレッサ -> 出力
  var noiseBuf = null;
  var voices = [];         // 発音中の終了時刻
  var MAX_VOICES = 3;

  function getBus(c) {
    if (bus && bus.ctx === c) return bus.input;
    var master = c.createGain();
    master.gain.value = 0.6;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(c.destination);
    bus = { ctx: c, input: master };
    noiseBuf = null;
    return master;
  }

  // 音量エンベロープ: peak まで atk 秒で上げ、dur の終わりに向けて減衰
  function envGain(c, out, t0, dur, peak, atk) {
    var g = c.createGain();
    atk = atk || 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.setValueAtTime(peak, Math.max(t0 + atk, t0 + dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(out);
    return g;
  }

  // 単音。freqs は [[時刻オフセット, 周波数], ...]（線形に移る）。decay=true なら鐘のように減衰
  function tone(c, out, type, t0, dur, peak, freqs, opt) {
    opt = opt || {};
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqs[0][1], t0 + freqs[0][0]);
    for (var i = 1; i < freqs.length; i++) o.frequency.linearRampToValueAtTime(freqs[i][1], t0 + freqs[i][0]);
    var dest;
    if (opt.decay) {
      dest = c.createGain();
      dest.gain.setValueAtTime(peak, t0);
      dest.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      dest.connect(out);
    } else {
      dest = envGain(c, out, t0, dur, peak, opt.atk);
    }
    var node = o;
    if (opt.lp) {
      var f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opt.lp;
      o.connect(f); node = f;
    }
    node.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.03);
    return o;
  }

  function noise(c, out, t0, dur, peak, ftype, f0, f1, q) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var f = c.createBiquadFilter();
    f.type = ftype; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.linearRampToValueAtTime(f1, t0 + dur);
    src.connect(f); f.connect(envGain(c, out, t0, dur, peak, Math.min(0.02, dur / 3)));
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  // 「ウー」: lo と hi の間を period 秒で往復
  function wail(c, out, type, t0, dur, peak, lo, hi, period, lp) {
    var pts = [[0, lo]], t = 0, up = true;
    while (t < dur) {
      t = Math.min(dur, t + period / 2);
      pts.push([t, up ? hi : lo]);
      up = !up;
    }
    return tone(c, out, type, t0, dur, peak, pts, { lp: lp, atk: 0.04 });
  }

  function bell(c, out, t0, f, peak) {
    tone(c, out, 'sine', t0, 0.14, peak, [[0, f]], { decay: true });
    tone(c, out, 'sine', t0, 0.1, peak * 0.5, [[0, f * 2.76]], { decay: true });
  }

  function ratchet(c, out, t0, n, gap0, gap1) {
    var t = t0;
    for (var i = 0; i < n; i++) {
      noise(c, out, t, 0.025, 0.25, 'bandpass', 2500, 2500, 3);
      t += gap0 + (gap1 - gap0) * i / Math.max(1, n - 1);
    }
  }

  function fanfare(c, out, t0, notes, step, len, peak) {
    for (var i = 0; i < notes.length; i++) {
      tone(c, out, 'square', t0 + i * step, len, peak, [[0, notes[i]]], { lp: 2200 });
    }
  }

  var SOUNDS = {
    // 1 ねこぐるま: 車輪のきしみ
    1: function (c, o, t) {
      tone(c, o, 'sine', t, 0.14, 0.22, [[0, 1700], [0.14, 2500]]);
      noise(c, o, t, 0.14, 0.12, 'bandpass', 3000, 4500, 6);
      tone(c, o, 'sine', t + 0.2, 0.2, 0.22, [[0, 2300], [0.2, 1500]]);
      noise(c, o, t + 0.2, 0.2, 0.12, 'bandpass', 4500, 2800, 6);
      return 0.45;
    },
    // 2 フォークリフト: 後退ブザー ピッピッピッ
    2: function (c, o, t) {
      for (var i = 0; i < 3; i++) tone(c, o, 'square', t + i * 0.2, 0.11, 0.13, [[0, 1000]], { lp: 3000 });
      return 0.6;
    },
    // 3 ごみしゅうしゅうしゃ: オルゴール風メロディ
    3: function (c, o, t) {
      var n = [784, 988, 1175, 1568];
      for (var i = 0; i < n.length; i++) {
        tone(c, o, 'sine', t + i * 0.15, 0.3, 0.2, [[0, n[i]]], { decay: true });
        tone(c, o, 'sine', t + i * 0.15, 0.15, 0.06, [[0, n[i] * 3]], { decay: true });
      }
      return 0.9;
    },
    // 4 ショベルカー: 油圧のシュー + 低い動作音
    4: function (c, o, t) {
      noise(c, o, t, 0.5, 0.3, 'highpass', 2500, 5000, 0.7);
      tone(c, o, 'triangle', t, 0.2, 0.3, [[0, 110], [0.2, 65]]);
      tone(c, o, 'triangle', t + 0.3, 0.25, 0.3, [[0, 90], [0.25, 55]]);
      return 0.6;
    },
    // 5 ブルドーザー: エンジンの唸り
    5: function (c, o, t) {
      var d = 0.8;
      var osc = tone(c, o, 'sawtooth', t, d, 0.3, [[0, 48], [0.3, 70], [d, 56]], { lp: 380, atk: 0.08 });
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 13; lg.gain.value = 6;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + d + 0.03);
      tone(c, o, 'square', t, d, 0.08, [[0, 96], [0.3, 140], [d, 112]], { lp: 300, atk: 0.08 });
      // スマホのスピーカーでも聞こえるよう、中音域の唸りを重ねる
      tone(c, o, 'sawtooth', t, d, 0.06, [[0, 220], [0.3, 300], [d, 250]], { lp: 900, atk: 0.08 });
      return d;
    },
    // 6 ダンプカー: クラクション プップー
    6: function (c, o, t) {
      var ch = [349, 440, 523];
      for (var i = 0; i < ch.length; i++) {
        tone(c, o, 'square', t, 0.15, 0.08, [[0, ch[i]]], { lp: 1500 });
        tone(c, o, 'square', t + 0.22, 0.45, 0.08, [[0, ch[i]]], { lp: 1500 });
      }
      return 0.7;
    },
    // 7 きゅうきゅうしゃ: ピーポー
    7: function (c, o, t) {
      for (var i = 0; i < 4; i++) {
        tone(c, o, 'triangle', t + i * 0.2, 0.2, 0.22, [[0, i % 2 ? 770 : 960]], { atk: 0.015 });
      }
      return 0.8;
    },
    // 8 しょうぼうしゃ: ウー + カンカン
    8: function (c, o, t) {
      wail(c, o, 'sawtooth', t, 0.8, 0.12, 620, 900, 0.8, 1800);
      for (var i = 0; i < 4; i++) bell(c, o, t + 0.05 + i * 0.2, 1500, 0.12);
      return 0.85;
    },
    // 9 みずタンクしゃ: 低めで速い ウー + 水しぶき
    9: function (c, o, t) {
      wail(c, o, 'triangle', t, 0.8, 0.2, 420, 640, 0.4, 1600);
      noise(c, o, t + 0.1, 0.7, 0.16, 'bandpass', 3500, 1800, 0.8);
      noise(c, o, t + 0.1, 0.7, 0.1, 'highpass', 6000, 6000, 0.5);
      return 0.85;
    },
    // 10 はしごしゃ: ウー + ラチェット
    10: function (c, o, t) {
      wail(c, o, 'square', t, 0.75, 0.07, 700, 1000, 0.5, 1500);
      ratchet(c, o, t + 0.05, 10, 0.1, 0.045);
      return 0.8;
    },
    // 11 ちょうだいはしごしゃ: 低い大きなウー + ファンファーレ
    11: function (c, o, t) {
      wail(c, o, 'sawtooth', t, 0.9, 0.16, 300, 450, 0.9, 1200);
      fanfare(c, o, t + 0.3, [523, 659, 784, 1047], 0.13, 0.2, 0.08);
      return 0.9;
    }
  };

  // 11 同士の消滅: サイレン合奏 + ファンファーレ
  SOUNDS.vanish = function (c, o, t) {
    wail(c, o, 'sawtooth', t, 0.9, 0.1, 300, 450, 0.9, 1200);
    wail(c, o, 'triangle', t, 0.9, 0.14, 960, 770, 0.4, 2000);
    wail(c, o, 'sawtooth', t, 0.9, 0.07, 620, 900, 0.8, 1800);
    fanfare(c, o, t + 0.1, [523, 659, 784, 1047, 784, 1047, 1319], 0.11, 0.2, 0.09);
    for (var i = 0; i < 3; i++) bell(c, o, t + 0.5 + i * 0.12, 2000, 0.08);
    return 0.9;
  };

  function play(key) {
    if (muted) return;
    var c = ensure();
    if (!c || c.state !== 'running') return;
    var fn = SOUNDS[key];
    if (!fn) return;
    var now = c.currentTime;
    voices = voices.filter(function (e) { return e > now; });
    // 消防車（段階8以上）と消滅の音は上限を超えても鳴らす（コンプレッサで音割れを抑える）
    var important = key === 'vanish' || key >= 8;
    if (voices.length >= MAX_VOICES && !important) return;
    try {
      var len = fn(c, getBus(c), now + 0.01);
      voices.push(now + len + 0.05);
    } catch (e) {}
  }

  function playMerge(stage) { play(Math.max(1, Math.min(11, stage | 0))); }
  function playVanish() { play('vanish'); }

  function playDrop() {
    if (muted) return;
    var c = ensure();
    if (!c || c.state !== 'running') return;
    var t0 = c.currentTime + 0.01;
    var osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.08);
    gain.gain.setValueAtTime(0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.12);
  }

  // BGM 用: 共有の AudioContext と、合体音と同じコンプレッサ付きの出力
  function context(create) { return create === false ? ctx : ensure(); }
  function output() { var c = ensure(); return c ? getBus(c) : null; }

  return { context: context, output: output, unlock: unlock, setMuted: setMuted, isMuted: isMuted, playMerge: playMerge, playVanish: playVanish, playDrop: playDrop };
})();
