/* Music · UI sound engine (ported from lookmv)
   - Everything is synthesized with WebAudio (no audio files to load).
   - iOS-like: short, soft, glassy "tink" / "pop" tones, tuned to one C-major pentatonic family
     so that even if two sounds ever meet they stay consonant.
   - No overlap: 4 monophonic channels + priority rules + global rate-limit, so sounds never pile up.
   - Never fights the music: while a song plays, UI sounds are ducked and scroll ticks are muted (typing still clicks). */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = 'ms_sfx';
  const $ = s => document.querySelector(s);
  let on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (_) {}

  /* ------------------------------------------------------------------ engine */
  let ctx = null, bus = null, wet = null, noiseBuf = null;
  const voices = [];                       // active voices {ch, pri, t0, out}
  const MAX_VOICES = 4;
  let lastAny = 0;                         // ctx time of the last non-tick sound
  let lastUser = 0;                        // performance.now() of last user input (to ignore programmatic scrolls)

  function boot() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 24; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .12;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9500; lp.Q.value = .5;
    bus = ctx.createGain(); bus.gain.value = .8;
    bus.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    // very short, quiet "glass" reverb so bells feel like iOS and not like a beep
    const len = Math.floor(ctx.sampleRate * .28), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const cv = ctx.createConvolver(); cv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = .22; wet.connect(cv); cv.connect(bus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock() {
    if (!AC) return;
    boot();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(t => addEventListener(t, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) unlock(); });

  /* music-aware ducking: the song that's playing is always the star */
  function mediaState() {
    let playing = false;
    try { playing = typeof au !== 'undefined' && !!au && !!au.src && !au.paused && !au.ended; } catch (_) {}
    return { music: playing, any: playing };
  }

  /* ------------------------------------------------------------------ primitives */
  function mkVoice(ch, pri, vol, pan, send) {
    const t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = vol;
    let tail = out;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); tail = p; }
    tail.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; tail.connect(s); s.connect(wet); }
    const v = { ch, pri, t0: t, out, dead: false };
    v.kill = (fade = .03) => {
      if (v.dead) return; v.dead = true;
      const n = ctx.currentTime; try { out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n); out.gain.linearRampToValueAtTime(0, n + fade); } catch (_) {}
      setTimeout(() => { try { out.disconnect(); } catch (_) {} }, (fade + .05) * 1000);
    };
    voices.push(v);
    return v;
  }
  function retire(v, dur) { setTimeout(() => { v.dead = true; const i = voices.indexOf(v); if (i > -1) voices.splice(i, 1); try { v.out.disconnect(); } catch (_) {} }, (dur + .35) * 1000); }

  /* one pitched partial with an exponential envelope */
  function tone(v, o) {
    const t = ctx.currentTime + (o.at || 0), a = o.a || .002, d = o.d || .08, g = o.g == null ? .2 : o.g;
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || d * .6));
    env.gain.setValueAtTime(.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + a);
    env.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    osc.connect(env); env.connect(v.out);
    osc.start(t); osc.stop(t + a + d + .03);
    return a + d + (o.at || 0);
  }
  /* glassy bell = fundamental + inharmonic-ish partials (what makes it sound "iOS") */
  function bell(v, f, o = {}) {
    const g = o.g == null ? .2 : o.g, d = o.d || .22, at = o.at || 0;
    let end = tone(v, { f, to: o.to, glide: o.glide, d, g, at, type: o.type || 'sine', a: o.a });
    end = Math.max(end, tone(v, { f: f * 2.01, d: d * .55, g: g * .28, at, a: o.a }));
    end = Math.max(end, tone(v, { f: f * 3.97, d: d * .25, g: g * .1, at, a: o.a }));
    return end;
  }
  function noise(v, o) {
    const t = ctx.currentTime + (o.at || 0), d = o.d || .05, g = o.g == null ? .1 : o.g;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 1.1;
    f.frequency.setValueAtTime(o.f, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
    const env = ctx.createGain();
    env.gain.setValueAtTime(.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + (o.a || .004));
    env.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f); f.connect(env); env.connect(v.out);
    s.start(t, Math.random() * .5); s.stop(t + d + .03);
    return d + (o.at || 0);
  }

  /* ------------------------------------------------------------------ the palette
     Each entry: [channel, priority, build(v, arg)->duration, baseVolume, reverbSend]
     channels: tick (typing / scrolling) · ui (taps, selections) · fx (toggles, theme, modals, media) · status (success / error)
     priority: higher cancels / blocks lower ones that happen at the same moment                                         */
  const PENTA = [1047, 1175, 1319, 1568, 1760, 2093];         // C6 D6 E6 G6 A6 C7
  const S = {
    /* ---- buttons ---- */
    tap:      ['ui', 1, v => { noise(v, { f: 4200, d: .012, g: .05, type: 'highpass' }); return bell(v, 1319, { d: .075, g: .2 }); }, 1, .05],
    press:    ['ui', 1, v => bell(v, 988, { d: .07, g: .2 }), 1, .04],
    select:   ['ui', 1, v => tone(v, { f: 1568, to: 1760, glide: .03, type: 'triangle', d: .06, g: .22 }), 1, .05],
    chip:     ['ui', 1, v => { tone(v, { f: 1397, d: .05, g: .16 }); return tone(v, { f: 2093, d: .07, g: .12, at: .035 }); }, 1, .06],
    back:     ['ui', 2, v => bell(v, 1175, { to: 880, glide: .07, d: .11, g: .2 }), 1, .06],
    close:    ['ui', 2, v => { tone(v, { f: 784, to: 587, glide: .06, d: .09, g: .22 }); return noise(v, { f: 2400, to: 900, d: .06, g: .035, a: .01 }); }, 1, .05],
    card:     ['ui', 2, v => { noise(v, { f: 700, to: 2600, d: .09, g: .05, a: .02 }); return tone(v, { f: 523, to: 784, glide: .07, d: .12, g: .2 }); }, 1, .08],
    /* ---- navigation tabs (each tab has its own note + stereo position) ---- */
    tab:      ['ui', 2, (v, i = 0) => { const f = PENTA[Math.min(i, PENTA.length - 1)]; return bell(v, f, { to: f * 1.02, glide: .05, d: .14, g: .21 }); }, 1, .1],
    subtab:   ['ui', 2, (v, i = 0) => bell(v, [1319, 1568, 1760][i % 3], { d: .1, g: .18 }), 1, .07],
    /* ---- library ---- */
    save:     ['fx', 2, v => { bell(v, 1568, { d: .12, g: .17 }); return bell(v, 2349, { at: .06, d: .2, g: .15 }); }, 1, .22],
    unsave:   ['fx', 2, v => tone(v, { f: 880, to: 659, glide: .07, d: .1, g: .2, type: 'triangle' }), 1, .05],
    download: ['fx', 2, v => { tone(v, { f: 1175, to: 587, glide: .13, d: .16, g: .17 }); return bell(v, 1760, { at: .12, d: .18, g: .16 }); }, 1, .14],
    open:     ['fx', 2, v => { noise(v, { f: 900, to: 2800, d: .1, g: .05, a: .03 }); return bell(v, 784, { to: 1175, glide: .08, d: .16, g: .17 }); }, 1, .1],
    trailer:  ['fx', 2, v => { bell(v, 880, { d: .1, g: .15 }); return bell(v, 1319, { at: .07, d: .14, g: .15 }); }, 1, .1],
    /* ---- player ---- */
    play:     ['fx', 3, v => { tone(v, { f: 659, type: 'triangle', d: .07, g: .2 }); return bell(v, 988, { at: .055, d: .14, g: .2 }); }, 1, .1],
    pause:    ['fx', 3, v => { tone(v, { f: 988, type: 'triangle', d: .06, g: .18 }); return tone(v, { f: 659, at: .05, d: .1, g: .2, type: 'triangle' }); }, 1, .06],
    next:     ['ui', 2, v => { noise(v, { f: 1500, to: 4200, d: .09, g: .045, a: .02 }); return bell(v, 1175, { to: 1568, glide: .06, d: .12, g: .18 }); }, 1, .06],
    prev:     ['ui', 2, v => { noise(v, { f: 4200, to: 1500, d: .09, g: .045, a: .02 }); return bell(v, 1175, { to: 880, glide: .06, d: .12, g: .18 }); }, 1, .06],
    mute:     ['fx', 2, v => tone(v, { f: 880, to: 392, glide: .09, d: .12, g: .2, type: 'triangle' }), 1, .04],
    unmute:   ['fx', 2, v => tone(v, { f: 392, to: 880, glide: .09, d: .12, g: .2, type: 'triangle' }), 1, .04],
    fsIn:     ['fx', 2, v => { noise(v, { f: 600, to: 3000, d: .16, g: .05, a: .04 }); return bell(v, 523, { to: 1047, glide: .14, d: .22, g: .16 }); }, 1, .1],
    fsOut:    ['fx', 2, v => { noise(v, { f: 3000, to: 600, d: .16, g: .05, a: .04 }); return bell(v, 1047, { to: 523, glide: .14, d: .22, g: .16 }); }, 1, .1],
    menuOpen: ['fx', 2, v => { noise(v, { f: 1200, to: 2800, d: .07, g: .04, a: .015 }); return bell(v, 1480, { d: .1, g: .14 }); }, 1, .08],
    menuClose:['fx', 2, v => { noise(v, { f: 2800, to: 1000, d: .07, g: .035, a: .015 }); return bell(v, 1109, { d: .09, g: .13 }); }, 1, .05],
    seek:     ['tick', 1, (v, p = .5) => tone(v, { f: 880 + p * 1100, d: .03, g: .16, type: 'triangle' }), 1, .03],
    seekFwd:  ['ui', 2, v => bell(v, 1568, { to: 1760, glide: .04, d: .09, g: .17 }), 1, .05],
    seekBack: ['ui', 2, v => bell(v, 1175, { to: 1047, glide: .04, d: .09, g: .17 }), 1, .05],
    vol:      ['tick', 1, (v, p = .5) => tone(v, { f: 520 + p * 1000, d: .045, g: .18, type: 'triangle' }), 1, .03],
    ended:    ['status', 2, v => { bell(v, 1047, { d: .25, g: .14 }); return bell(v, 1319, { at: .1, d: .35, g: .14 }); }, 1, .25],
    /* ---- switches / accordions ---- */
    swOn:     ['fx', 2, v => { tone(v, { f: 1109, d: .035, g: .15 }); return bell(v, 1661, { at: .04, d: .08, g: .17 }); }, 1, .06],
    swOff:    ['fx', 2, v => { tone(v, { f: 1661, d: .035, g: .13 }); return bell(v, 1109, { at: .04, d: .08, g: .15 }); }, 1, .04],
    expand:   ['ui', 2, v => tone(v, { f: 1047, to: 1319, glide: .05, d: .08, g: .2, type: 'triangle' }), 1, .06],
    collapse: ['ui', 2, v => tone(v, { f: 1319, to: 988, glide: .05, d: .08, g: .18, type: 'triangle' }), 1, .04],
    /* ---- theme / language / modal ---- */
    toLight:  ['fx', 3, v => { let e = 0; [1047, 1319, 1568, 2093].forEach((f, i) => e = Math.max(e, bell(v, f, { at: i * .05, d: .22, g: .13 }))); return e; }, 1, .26],
    toDark:   ['fx', 3, v => { let e = 0; [1568, 1175, 880, 659].forEach((f, i) => e = Math.max(e, tone(v, { f, at: i * .055, d: .2, g: .13, type: 'triangle' }))); return e; }, 1, .2],
    lang:     ['fx', 3, v => { bell(v, 1175, { d: .08, g: .16 }); return bell(v, 1568, { at: .07, d: .12, g: .16 }); }, 1, .1],
    modalIn:  ['fx', 3, v => { noise(v, { f: 500, to: 2400, d: .12, g: .045, a: .03 }); return bell(v, 523, { to: 1047, glide: .1, d: .2, g: .15 }); }, 1, .14],
    modalOut: ['fx', 3, v => { noise(v, { f: 2400, to: 500, d: .1, g: .04, a: .03 }); return bell(v, 1047, { to: 523, glide: .09, d: .16, g: .14 }); }, 1, .1],
    sfxOn:    ['fx', 4, v => { tone(v, { f: 880, d: .06, g: .18 }); return bell(v, 1319, { at: .06, d: .16, g: .18 }); }, 1, .12],
    /* ---- account / feedback ---- */
    login:    ['status', 4, v => { let e = 0; [784, 1047, 1319, 1568].forEach((f, i) => e = Math.max(e, bell(v, f, { at: i * .075, d: .34, g: .15 }))); return e; }, 1, .3],
    signup:   ['status', 4, v => { let e = 0; [659, 880, 1047, 1319, 1760].forEach((f, i) => e = Math.max(e, bell(v, f, { at: i * .07, d: .38, g: .14 }))); return e; }, 1, .34],
    logout:   ['status', 4, v => { let e = 0; [1319, 988, 784].forEach((f, i) => e = Math.max(e, tone(v, { f, at: i * .08, d: .22, g: .15, type: 'triangle' }))); return e; }, 1, .18],
    success:  ['status', 4, v => { bell(v, 1319, { d: .16, g: .16 }); return bell(v, 1760, { at: .08, d: .28, g: .16 }); }, 1, .24],
    notify:   ['status', 3, v => bell(v, 1568, { d: .2, g: .15 }), 1, .2],
    send:     ['status', 3, v => { noise(v, { f: 600, to: 3200, d: .18, g: .06, a: .05 }); return tone(v, { f: 1175, to: 1760, glide: .12, d: .16, g: .15 }); }, 1, .12],
    error:    ['status', 5, v => { const k = at => { tone(v, { f: 330, to: 247, glide: .08, d: .1, g: .3, type: 'triangle', at }); tone(v, { f: 660, to: 494, glide: .08, d: .05, g: .07, at }); }; k(0); k(.12); return .3; }, 1, .03],
    warn:     ['status', 4, v => { tone(v, { f: 392, to: 311, glide: .08, d: .11, g: .26, type: 'triangle' }); return .15; }, 1, .03],
    danger:   ['status', 5, v => { let e = 0; [523, 392, 262].forEach((f, i) => e = Math.max(e, tone(v, { f, at: i * .1, d: .24, g: .2, type: 'triangle' }))); noise(v, { f: 300, to: 120, d: .3, g: .05, type: 'lowpass', a: .02 }); return Math.max(e, .4); }, 1, .06],
    /* ---- typing: dry iOS keyboard "tock" ---- */
    key:      ['tick', 1, (v, f = 1900) => { noise(v, { f: 2600, q: 1.4, d: .02, g: .1 }); return tone(v, { f, d: .018, g: .07 }); }, 1, 0],
    keyDel:   ['tick', 1, v => { noise(v, { f: 1500, q: 1.2, d: .03, g: .1 }); return tone(v, { f: 1050, to: 800, glide: .03, d: .035, g: .1 }); }, 1, 0],
    keySpace: ['tick', 1, v => { noise(v, { f: 1800, q: .9, d: .04, g: .11 }); return tone(v, { f: 1250, d: .04, g: .09 }); }, 1, 0],
    keyEnter: ['ui', 2, v => { noise(v, { f: 2000, d: .03, g: .09 }); return bell(v, 1760, { d: .1, g: .17 }); }, 1, .05],
    /* ---- scrolling ---- */
    scrollTick:  ['tick', 0, (v, o = {}) => { noise(v, { f: 5200, d: .006, g: .03 * (o.g || 1), type: 'highpass' }); return tone(v, { f: o.f || 2300, d: .016, g: .05 * (o.g || 1) }); }, 1, 0],
    edge:        ['fx', 1, v => { tone(v, { f: 190, to: 95, glide: .09, d: .12, g: .22 }); return noise(v, { f: 400, d: .07, g: .05, type: 'lowpass' }); }, 1, 0]
  };

  const MIN_GAP = .028;               // global limit: never two sounds within 28 ms
  const GROUP_GAP = { tick: 0, ui: .045, fx: .06, status: .08 };

  function play(name, arg, opt = {}) {
    if (!on || !AC) return;
    const def = S[name]; if (!def) return;
    if (!ctx) boot();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      if (!opt._retry) ctx.resume().then(() => { if (ctx.state === 'running') play(name, arg, Object.assign({}, opt, { _retry: 1 })); }).catch(() => {});
      return;
    }
    const [ch, pri, build, base, send] = def;
    const now = ctx.currentTime, m = mediaState();
    // while a song plays: silence scroll ticks, soften everything else
    if (m.any && (name === 'scrollTick' || name === 'edge') && !opt.force) return;
    const duck = m.music ? .6 : 1;

    // priority / overlap resolution
    for (let i = voices.length - 1; i >= 0; i--) { const v = voices[i]; if (v.dead) { voices.splice(i, 1); continue; } }
    if (ch === 'tick' && pri === 0) {                 // scroll ticks yield to everything else that just happened
      if (now - lastAny < .11) return;
      if (voices.some(v => v.ch !== 'tick' && !v.dead && now - v.t0 < .35)) return;
    }
    const blocker = voices.find(v => !v.dead && v.pri > pri && now - v.t0 < .16);
    if (blocker) return;                              // a more important sound is just starting: skip this one
    if (now - lastAny < MIN_GAP && ch !== 'tick') { if (pri < 3) return; }
    const same = voices.filter(v => !v.dead && v.ch === ch);
    if (same.some(v => v.pri > pri && now - v.t0 < .4)) return;
    same.forEach(v => v.kill(.025));                  // each channel is monophonic: the new sound replaces the old
    voices.filter(v => !v.dead && v.pri < pri && now - v.t0 < .2).forEach(v => v.kill(.03));
    if (voices.filter(v => !v.dead).length >= MAX_VOICES) { const low = voices.filter(v => !v.dead).sort((a, b) => a.pri - b.pri || a.t0 - b.t0)[0]; if (low && low.pri <= pri) low.kill(.02); else return; }

    const vol = base * duck * (opt.vol == null ? 1 : opt.vol);
    const v = mkVoice(ch, pri, vol, opt.pan || 0, send);
    let dur = .2;
    try { dur = build(v, arg) || .2; } catch (_) {}
    retire(v, dur);
    if (ch !== 'tick') lastAny = now;
    return v;
  }

  /* ------------------------------------------------------------------ routing: which control → which sound */
  const $$ = s => [...document.querySelectorAll(s)];
  const pan = (i, n) => n > 1 ? (i / (n - 1) - .5) * .7 : 0;
  const audio = () => { try { return typeof au !== 'undefined' ? au : null; } catch (_) { return null; } };
  const lab = el => (el.getAttribute('aria-label') || '').toLowerCase();
  let downX = 0, downY = 0;
  addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; }, { capture: true, passive: true });

  function route(e) {
    if (e.detail !== 0 && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;   // that was a drag, not a tap
    const t = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement);
    if (!t) return;
    const c = s => t.closest(s);
    let el;
    if (c('[data-sfx]')) return;                                           // the sound switch plays its own cue
    /* ---- sign in / create account */
    if ((el = c('.seg button'))) return play('tab', $$('.seg button').indexOf(el) ? 3 : 0);
    if ((el = c('.alt button'))) return play('tab', /sign in/i.test(el.textContent) ? 0 : 3);
    if ((el = c('.eye'))) return play(/show/i.test(el.textContent) ? 'swOn' : 'swOff');
    /* ---- dock tabs (each tab: its own note + stereo position) */
    if ((el = c('.tabs button'))) { const i = $$('.tabs button').indexOf(el); return play('tab', i, { pan: pan(i, 4) }); }
    if ((el = c('.dock .side'))) { const l = el.classList.contains('l'); return play('tab', l ? 0 : 3, { pan: l ? -.35 : .35 }); }
    /* ---- transport (mini player + full player) */
    if (c('button[aria-label="Previous"]')) return play('prev');
    if (c('button[aria-label="Next"]')) return play('next');
    if (c('button[aria-label="Play or pause"]')) { const a = audio(); return play(a && a.src && !a.paused ? 'pause' : 'play'); }
    if (c('.sheet .close')) return play('close');
    if (c('.mini')) return play('open');
    /* ---- volume / speed / share menus */
    if ((el = c('.vbtn'))) return play(lab(el) === 'mute' ? 'mute' : 'unmute');
    if (c('.vtrack')) return;                                              // own scrub sound
    if ((el = c('.sbtn'))) { if (el.disabled) return; return play(el.getAttribute('aria-expanded') === 'true' ? 'menuClose' : 'menuOpen'); }
    if (c('.scrim')) return play('menuClose');
    if ((el = c('.spop button'))) return play(/download/i.test(el.textContent) ? 'download' : 'select');
    /* ---- cards */
    if ((el = c('.ca'))) return play(el.classList.contains('bm') ? 'save' : 'download');
    if (c('.card.more,.morebtn')) return play('press');
    if (c('.card,.live')) return play('card');
    if (c('.gen')) return play('chip');
    /* ---- playlists / library */
    if ((el = c('.prow'))) return play(el.getAttribute('aria-checked') === 'true' ? 'unsave' : 'save');
    if (c('.li .rm')) return play('unsave');
    if ((el = c('.pldel'))) return play(/tap again/i.test(el.textContent) ? 'danger' : 'warn');
    if (c('.plact')) return play('play');
    if (c('.search .mk')) return play('press');
    if (c('.li')) return play('select');
    /* ---- back / profile / dialogs */
    if (c('button[aria-label="Back"]')) return play('back');
    if (c('button.av')) return play('menuOpen');
    if (c('.dh .circ')) return play('modalOut');
    if (c('.btn.ghost')) return play('modalOut');
    if (c('.btn')) return play('press');
    if (t.classList && t.classList.contains('ov')) return play(t.classList.contains('dim') ? 'modalOut' : 'menuClose');
    if ((el = c('.pitem'))) { if (el.classList.contains('static')) return; return play(/sign out/i.test(el.textContent) ? 'press' : 'modalIn'); }
    if (c('input,textarea,select')) return;                                // text fields use the typing sounds
    if (c('button,[role=button],a[href]')) return play('tap');
  }
  addEventListener('click', route, true);        // window-capture: runs before the app's own handlers

  /* ------------------------------------------------------------------ typing: every physical key has its own tiny pitch */
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const isTextEl = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,[contenteditable=""],[contenteditable=true]');
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) lastUser = performance.now();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, tg = e.target, inText = isTextEl(tg);
    if (inText) {
      if (e.repeat && k !== 'Backspace' && k !== 'Delete') return;
      if (k === 'Backspace' || k === 'Delete') return play('keyDel');
      if (k === ' ') return play('keySpace');
      if (k === 'Enter') return play('keyEnter');
      if (k === 'Tab') return play('tap');
      if (k.length === 1 || k === 'Process' || k === 'Unidentified') {
        const f = 1750 + (hash(e.code || k) % 9) * 55;     // 9 stable pitch steps, so each key "has its own voice"
        return play('key', f);
      }
      return;
    }
    if (k === 'Escape') {
      const ov = $('.ov');
      if (ov) return play(ov.classList.contains('dim') ? 'modalOut' : 'menuClose');
      if ($('.sheet.open')) return play('close');
      return;
    }
    if (tg && tg.closest && tg.closest('.vtrack')) {         // volume slider via keyboard
      const d = { ArrowRight: .05, ArrowUp: .05, ArrowLeft: -.05, ArrowDown: -.05 }[k];
      if (d != null) { const v = (+tg.closest('.vtrack').getAttribute('aria-valuenow') || 0) / 100; return play('vol', Math.min(1, Math.max(0, v + d))); }
      return;
    }
    if ((k === 'Enter' || k === ' ') && tg && tg.classList && tg.classList.contains('card')) return play('card');   // focused card (div role=button)
    if (k === ' ' && tg && tg.tagName !== 'BUTTON' && !(tg.getAttribute && tg.getAttribute('role') === 'button')) {   // global space = play / pause
      const a = audio(); if (a && a.src) return play(a.paused ? 'play' : 'pause');
    }
  }, true);

  /* sliders: seek bar (range input) and volume bar (custom) → iOS-slider-like ticks whose pitch follows the position */
  let lastRange = 0;
  addEventListener('input', e => {
    const i = e.target;
    if (!i || i.type !== 'range') return;
    const n = performance.now(); if (n - lastRange < 60) return; lastRange = n;
    const min = +i.min || 0, max = +i.max || 1, p = (+i.value - min) / (max - min || 1);
    play(lab(i) === 'seek' ? 'seek' : 'vol', p);
  }, true);
  (function volScrub() {
    let tr = null, last = 0;
    const prog = e => { const r = tr.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))); };
    addEventListener('pointerdown', e => { const t = e.target && e.target.closest && e.target.closest('.vtrack'); if (!t) return; tr = t; last = performance.now(); play('vol', prog(e)); }, true);
    addEventListener('pointermove', e => { if (!tr) return; const n = performance.now(); if (n - last < 70) return; last = n; play('vol', prog(e)); }, true);
    ['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { tr = null; }, true));
  })();

  /* ------------------------------------------------------------------ scrolling */
  addEventListener('wheel', () => { lastUser = performance.now(); }, { capture: true, passive: true });
  addEventListener('pointermove', e => {                       // dragging a row with the mouse
    if (e.pointerType === 'mouse' && (e.buttons & 1) && e.target && e.target.closest && e.target.closest('.row')) lastUser = performance.now();
  }, { capture: true, passive: true });
  let touching = false, moved = false, tx = 0, ty = 0;
  addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; moved = false; }, { capture: true, passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (!moved && Math.hypot(t.clientX - tx, t.clientY - ty) > 8) moved = true; if (moved) { touching = true; lastUser = performance.now(); } }, { capture: true, passive: true });
  ['touchend', 'touchcancel'].forEach(t => addEventListener(t, () => { if (moved) lastUser = performance.now() + 1200; touching = false; moved = false; }, { capture: true, passive: true }));   // a flick keeps ticking with iOS momentum; a plain tap does not
  const userScrolling = () => touching || performance.now() - lastUser < 450;

  const track = new WeakMap();              // element → {pos, acc, t, edge}
  const STEP_Y = 96, STEP_X = 120;
  let lastTick = 0, flip = 0;
  function onScroll(e) {
    if (!on || !userScrolling()) return;
    const tgt = e.target === document || e.target === document.documentElement || e.target === document.body ? document.scrollingElement : e.target;
    if (!tgt || tgt.nodeType !== 1 && tgt !== document.scrollingElement) return;
    if (tgt.matches && tgt.matches('textarea,input,.plist')) return;
    const horiz = tgt !== document.scrollingElement && tgt.scrollWidth > tgt.clientWidth + 2 && tgt.scrollHeight <= tgt.clientHeight + 2;
    const pos = horiz ? Math.abs(tgt.scrollLeft) : tgt.scrollTop;
    const max = horiz ? tgt.scrollWidth - tgt.clientWidth : tgt.scrollHeight - tgt.clientHeight;
    const nowT = performance.now();
    let st = track.get(tgt);
    if (!st) { st = { pos, acc: 0, t: nowT, edge: 0 }; track.set(tgt, st); return; }
    const d = Math.abs(pos - st.pos), dt = Math.max(1, nowT - st.t);
    st.pos = pos; st.t = nowT; st.acc += d;
    /* edge bump when the user scrolls all the way to the start / end */
    const atStart = pos <= 1, atEnd = max > 0 && pos >= max - 1, edge = atStart ? 1 : atEnd ? 2 : 0;
    if (edge && edge !== st.edge && d > 0 && max > 30) { st.edge = edge; st.acc = 0; play('edge', null, { vol: horiz ? .8 : 1 }); return; }
    if (!edge) st.edge = 0;
    const step = horiz ? STEP_X : STEP_Y;
    if (st.acc >= step && nowT - lastTick > 60) {
      const vel = Math.min(1.8, d / dt);                         // px/ms
      st.acc = st.acc % step; lastTick = nowT; flip ^= 1;
      play('scrollTick', { g: .6 + Math.min(.6, vel * .35), f: (horiz ? 1900 : 2300) + (flip ? 120 : 0) });
    }
  }
  addEventListener('scroll', onScroll, { capture: true, passive: true });

  /* ------------------------------------------------------------------ public API */
  const setOn = v => { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {} if (on) { unlock(); setTimeout(() => play('sfxOn'), 30); } };
  window.sfx = { play, get enabled() { return on; }, set enabled(v) { setOn(v); }, toggle() { setOn(!on); return on; } };
})();
