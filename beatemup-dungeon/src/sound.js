/**
 * sound.js — the background music.
 *
 * ONE FILE, ONE LOOP, NO MIXER. The track is three of the five takes layered
 * and aligned in tools/beat-music-lab.html and bounced to a single ogg; by the
 * time the game sees it there is nothing left to synchronise, which is the
 * point. Three <audio> elements started together drift apart within a minute
 * and the browser gives no way to bind them, so the layering had to be resolved
 * offline or not attempted. That is the flying dungeon's finding and this game
 * inherits it rather than re-learning it.
 *
 * ⚠️ WEB AUDIO, NOT AN <audio> ELEMENT, and that is not incidental. The whole
 * exercise was making the wrap seamless: the loop is cropped to a downbeat and
 * the ring-out of its last hits is folded back onto its head.
 * `HTMLAudioElement.loop` re-primes the decoder at the wrap and can drop a few
 * ms there -- inaudible on a song, fatal on a six-second bed that comes round
 * every six seconds, and it would throw away the one thing all that work
 * bought. `AudioBufferSourceNode.loop` is sample-accurate by specification.
 *
 * ⚠️ THE LOOP END IS PINNED, NOT INFERRED. `loop = true` with no bounds wraps
 * at whatever the decoded buffer turned out to be, and decoders disagree about
 * an Opus file's length by a few milliseconds of codec padding -- this one's
 * container says 5.1215s for a mix that is 5.1150s of music. Left alone that is
 * six milliseconds of silence inserted every five seconds: an audible tick, and
 * one you would go looking for in the music rather than in the decoder. So
 * loopStart/loopEnd are set from CONFIG.MUSIC_LOOP[key], which is the
 * `--length` that track's cutter was last run with. If a mix is re-cropped,
 * that number moves with it. A track with no entry is not pinned and loops at
 * the end of its own buffer -- which is right for a finished song and wrong for
 * anything cropped to a downbeat.
 *
 * ⚠️ IT STARTS WITH THE GAME, NOT WITH THE PAGE. boot() sits on a progress bar
 * while several MB of art decodes; music under a bar that might stall reads as
 * the game having begun when it has not.
 *
 * AUTOPLAY. Browsers keep an AudioContext suspended until the page has been
 * interacted with, so this cannot simply be started on a timer. In this game
 * the player may not have pressed anything at all by the time the level starts
 * -- there is no menu to click through. So `wanted` remembers that the game
 * asked for music, and every subsequent gesture retries the resume until one
 * takes. Nothing else has to know about any of that.
 *
 * The graph is one gain per bus, so mute is a single knob and the balance
 * underneath it is untouched:
 *
 *      music ─→ musicGain ─┐
 *                          ├─→ master ─→ destination
 *      effects ─→ sfxGain ─┘
 *
 * EFFECTS ARE ONE-SHOTS AND ARE NEVER TRACKED. Each play builds its own source,
 * starts it and forgets it; the node is collected when it ends. Nothing needs
 * stopping, because nothing here is a state -- a punch is an event and it is
 * over when the sound is. That is not true of every game sound (a held weapon
 * is a state and has to be turned off by whoever turned it on) and this file
 * will need a second shape when one arrives. It does not have one yet.
 *
 * THEY MUST OVERLAP. Two punches 80ms apart are two sounds, so a play never
 * cuts the previous one -- with a 300ms effect and a five-hit combo, reusing
 * one source would silence most of the string.
 */
class Sound {
  constructor(assets) {
    this.assets = assets;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    /* DECODED MUSIC, BY ASSET KEY. It was a single `buffer` until the horse got
       a theme of its own (2026-08-22); now the level bed and the boss track are
       two entries in here and only one is ever playing. Keyed by the asset key
       so a track is decoded once however many times it is started. */
    this.buffers = {};
    this.decoding = {};
    /* Keys whose decode has already FAILED once. Read only by the layer wait in
       _startIfReady: an optional extra voice must never be able to hold the
       track it accompanies hostage. */
    this.failedDecode = {};
    this.track = null;         // which key `source` is playing
    this.source = null;
    /* EXTRA VOICES STARTED WITH `source` AND STOPPED WITH IT -- the whistle over
       the street bed. See _startIfReady() for why this is possible here and was
       not in the flying dungeon. Each entry is { src, gain }. */
    this.layerVoices = [];
    this.sfxGain = null;
    this.sfx = {};             // name -> decoded AudioBuffer
    /* LONG one-shots that may need stopping, by name -> { src, gain }. See
       playOnce(). Ordinary effects are fire-and-forget and are not tracked:
       a 300ms punch cannot outlive anything. */
    this.once = {};
    this._sfxPending = {};     // name -> true while a decode is in flight
    this.muted = false;
    this.volume = (typeof CONFIG !== 'undefined' && CONFIG.musicVolume != null)
      ? CONFIG.musicVolume : 0.55;
    /* The game has ASKED for music, whether or not any is currently audible.
       This is the whole autoplay story: `playMusic()` sets it, and whatever
       eventually manages to resume the context reads it to decide whether to
       start. Without it, the one gesture that unlocks audio would unlock
       silence. */
    this.wanted = false;
    /* WHICH track was asked for. Paired with `wanted` rather than replacing it:
       `wanted` is "the game wants music at all", which is what the autoplay
       retry reads, and this is which one. */
    this.wantedTrack = null;

    /* Retry the resume on any gesture until one works. `once` is wrong here:
       the FIRST gesture is not necessarily the one that succeeds -- a keydown
       during page load can land before the context exists at all. */
    if (typeof window !== 'undefined') {
      const kick = () => this._resume();
      ['pointerdown', 'keydown', 'touchstart'].forEach(
        ev => window.addEventListener(ev, kick, { passive: true }));
    }
  }

  /** Build the graph. Safe to call repeatedly; only the first call does work. */
  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volume;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = (CONFIG.sfxVolume != null) ? CONFIG.sfxVolume : 0.9;
    this.sfxGain.connect(this.master);
    return this.ctx;
  }

  _resume() {
    const ctx = this._ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && p.then) p.then(() => this._startIfReady(), () => {});
    }
    this._startIfReady();
    this.primeSfx();
  }

  /** Which track the game has asked for, or null. */
  _wantedKey() { return this.wanted ? (this.wantedTrack || 'music') : null; }

  /**
   * Decode the bytes the loader fetched.
   *
   * SEPARATE FROM LOADING ON PURPOSE -- see Assets.loadAudio. decodeAudioData
   * needs a context, a context needs a gesture, and the loading bar must not
   * wait on a gesture that may never come. So the bytes arrive with everything
   * else and turn into a buffer here, the first time there is somewhere to
   * decode them to.
   */
  _decode(key) {
    key = key || 'music';
    if (this.buffers[key] || this.decoding[key]) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const bytes = this.assets && this.assets.getBytes(key);
    if (!bytes) return;
    this.decoding[key] = true;
    /* decodeAudioData DETACHES the ArrayBuffer it is given on some engines, so
       it gets a copy. The original stays in Assets, which means a later reload
       -- a restart that rebuilt this object, say -- still has something to
       decode instead of an empty husk. */
    const copy = bytes.slice(0);
    const done = buf => {
      delete this.decoding[key];
      if (buf) this.buffers[key] = buf;
      this._startIfReady();
    };
    const fail = () => {
      delete this.decoding[key];
      /* ⚠️ REMEMBERED, AND THE TRACK IS POKED. Without both, a music LAYER that
         cannot be decoded stops the thing it was supposed to accompany from
         ever playing: _startIfReady waits for the layer, the wait is never
         satisfied, and the street plays in silence because a whistle is
         broken. */
      this.failedDecode[key] = true;
      this._startIfReady();
    };
    try {
      const p = ctx.decodeAudioData(copy, done, fail);
      if (p && p.then) p.then(done, fail);
    } catch (e) { delete this.decoding[key]; }
  }

  /**
   * Decode every effect in CONFIG.SFX, ahead of anyone asking for one.
   *
   * ⚠️ AHEAD OF TIME IS THE WHOLE POINT. decodeAudioData is asynchronous, so a
   * clip decoded on the first punch is a clip that is not ready ON the first
   * punch -- the sound would be missing exactly once, at the moment a player is
   * most likely to conclude there is no sound. Decoding at level start costs a
   * few ms of a frame nobody is looking at.
   */
  primeSfx() {
    const ctx = this._ensure();
    if (!ctx || !CONFIG.SFX) return;
    for (const name of Object.keys(CONFIG.SFX)) {
      if (this.sfx[name] || this._sfxPending[name]) continue;
      const bytes = this.assets && this.assets.getBytes('sfx:' + name);
      if (!bytes) continue;
      this._sfxPending[name] = true;
      const done = buf => { delete this._sfxPending[name]; if (buf) this.sfx[name] = buf; };
      const fail = () => { delete this._sfxPending[name]; };
      try {
        const p = ctx.decodeAudioData(bytes.slice(0), done, fail);
        if (p && p.then) p.then(done, fail);
      } catch (e) { delete this._sfxPending[name]; }
    }
  }

  /**
   * Fire an effect, now.
   *
   * SILENT RATHER THAN THROWING when the clip is not ready or audio is still
   * locked. This is called from the middle of hit resolution, sixty times a
   * second in a busy fight, and a missing sound must never be able to take the
   * fight down with it.
   *
   * `rate` detunes a repeat so a five-hit combo is not the same 300ms sample
   * five times, which reads as a stuck record rather than as five punches.
   *
   * `delaySec` starts the voice later, ON THE AUDIO CLOCK. That clock is
   * sample-accurate and runs on its own thread; a setTimeout runs on the main
   * one, behind whatever the frame is doing, and would land the voice tens of
   * ms out either way. It exists for the DOUBLED death sting -- two voices off
   * one buffer, a fixed gap apart -- where a variable gap is the one thing the
   * effect cannot survive. Still Life's finding; see its sound.js.
   */
  play(name, rate, delaySec) {
    const v = this._voice(name, rate, false);
    if (!v) return;
    /* `start(0)` means "now" and `start(t)` means "at audio-clock time t", so
       a delay is an absolute time and not an offset -- passing the delay
       straight in would schedule the voice for the first second of the page's
       life, which is already long past, and the browser would play it
       immediately. */
    v.src.start(delaySec > 0 ? this.ctx.currentTime + delaySec : 0);
  }

  /**
   * Build one voice. Shared by `play` and `playOnce` so a clip cannot be routed
   * two different ways depending on which of them started it.
   *
   * `withGain` forces the trim node into existence even at 1.0, which is what
   * makes a voice RAMPABLE later -- see playOnce/stopOnce. Ordinary effects do
   * not get one: a per-effect trim gets its OWN gain node rather than moving
   * the bus, because the bus is the balance between all effects and the music,
   * and nudging it for one clip would move every other clip with it -- and
   * leave it moved, because nothing puts it back. The node dies with the
   * source.
   */
  _voice(name, rate, withGain) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const buf = this.sfx[name];
    if (!buf) { this.primeSfx(); return null; }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    if (rate) s.playbackRate.value = rate;
    const trim = (CONFIG.SFX_GAIN && CONFIG.SFX_GAIN[name]) || 1;
    if (trim !== 1 || withGain) {
      const g = ctx.createGain();
      g.gain.value = trim;
      g.connect(this.sfxGain);
      s.connect(g);
      return { src: s, gain: g };
    }
    s.connect(this.sfxGain);
    return { src: s, gain: null };
  }

  /**
   * A one-shot long enough to OUTLIVE the moment that started it, and therefore
   * one that has to be stoppable.
   *
   * ⚠️ THIS IS NOT A STYLE CHOICE ON TOP OF `play`. The victory fanfare is 10.7
   * seconds; the ending screen and the whole results board together are about
   * ten. A player who skips the tally is back on the title with a fanfare still
   * ringing over it, which is Still Life's finding (its `stopOnce`) inherited
   * rather than rediscovered. Anything under a second or two wants `play` --
   * tracking a punch would be bookkeeping for a sound that cannot outlast
   * anything.
   *
   * ⚠️ IT REPLACES ITS OWN NAME. Asking twice is one fanfare, not two on top of
   * each other.
   */
  playOnce(name, rate) {
    this.stopOnce(name, 0);
    const v = this._voice(name, rate, true);
    if (!v) return;
    this.once[name] = v;
    /* Forget it when it ends on its own, so `stopOnce` later is not ramping a
       node that finished a minute ago. */
    v.src.onended = () => { if (this.once[name] === v) this.once[name] = null; };
    v.src.start(0);
  }

  /**
   * Stop one, with a short ramp. RAMPED RATHER THAN CUT for the same reason
   * `stopMusic` is: a buffer stopped outright ends on whatever sample it
   * happened to be on, and a waveform truncated mid-cycle is a click.
   */
  stopOnce(name, fadeSec) {
    const v = this.once[name];
    if (!v) return;
    this.once[name] = null;
    const ctx = this.ctx;
    const f = fadeSec != null ? fadeSec : 0.25;
    try {
      if (v.gain && ctx && f > 0) {
        const t = ctx.currentTime;
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.gain.gain.value, t);
        v.gain.gain.linearRampToValueAtTime(0.0001, t + f);
        v.src.stop(t + f);
      } else {
        v.src.stop();
      }
    } catch (e) { /* already stopped */ }
  }

  /**
   * The game wants music. Everything after this is the browser's timing.
   *
   * `key` is the ASSET key of the track -- 'music' (the level bed) by default,
   * 'musicBoss' for the horse's theme. ⚠️ ASKING FOR A DIFFERENT ONE SWITCHES:
   * only one piece of music plays at a time, which is what "it should play on
   * its own" means. Asking for the one already playing is a no-op and NOT a
   * restart -- start() calls this on every run, and a boss theme that restarted
   * from the top each frame would be silence with a heartbeat.
   */
  playMusic(key) {
    const want = key || 'music';
    if (this.wanted && this.track === want && this.source) return;
    if (this.source && this.track !== want) this.stopMusic(0.35);
    this.wanted = true;
    this.wantedTrack = want;
    this._ensure();
    this._decode(want);
    this.primeSfx();
    this._resume();
  }

  _startIfReady() {
    const key = this._wantedKey();
    if (!key || this.source) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;   // a gesture will come back
    const buffer = this.buffers[key];
    if (!buffer) { this._decode(key); return; }

    /* ⚠️ EVERY LAYER MUST BE DECODED BEFORE ANYTHING STARTS. A layer that
       arrived late would begin at whatever moment its decode happened to
       finish, which is the one thing this whole arrangement exists to prevent.
       Held back only while a decode is actually IN FLIGHT: if the asset is not
       in the build at all, `_decode` is a no-op and `decoding` stays false, so
       the bed plays on its own rather than never playing. */
    const layers = (CONFIG.MUSIC_LAYERS && CONFIG.MUSIC_LAYERS[key]) || [];
    for (const L of layers) {
      if (this.buffers[L.key] || this.failedDecode[L.key]) continue;
      this._decode(L.key);
      if (this.decoding[L.key]) return;
    }
    /* ONE SCHEDULED MOMENT FOR ALL OF THEM, a hair in the future. Two
       `start(0)` calls in the same JS turn are already close, but "close" is
       not the promise being made here -- an explicit time is. */
    const at = layers.length ? ctx.currentTime + 0.02 : 0;

    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    /* See the header: the decoded buffer may be a few ms longer than the music.
       Clamped so a wrong CONFIG number cannot ask for a loop past the end of
       the buffer, which throws in some engines and silently plays nothing in
       others. */
    /* ⚠️ THE PIN BELONGS TO THE TRACK, WHICH IS WHY THIS IS A LOOKUP AND NOT A
       TEST. It was `key === 'music'` until 2026-08-24, because the only pinned
       track was the bed and the horse's 4m39s song would have been cut off
       after six seconds by the bed's crop. That guard was right about the
       symptom and wrong as a rule: the title theme is ALSO a cropped loop, and
       under the old test it would have gone unpinned and ticked once a minute.
       Absent from the map means "loops at its own end", which is what a
       finished song wants and what a cropped one never does. */
    const want = (CONFIG.MUSIC_LOOP && CONFIG.MUSIC_LOOP[key]) || 0;
    s.loopStart = 0;
    s.loopEnd = want > 0 ? Math.min(want, buffer.duration) : buffer.duration;
    /* Per-track level, so a song mixed hotter than the bed does not have to be
       re-rendered to sit under the effects. */
    const vol = (CONFIG.MUSIC_GAIN && CONFIG.MUSIC_GAIN[key]);
    this.musicGain.gain.value = this.volume * (vol == null ? 1 : vol);
    s.connect(this.musicGain);
    s.start(at);
    this.source = s;
    this.track = key;
    for (const L of layers) this._startLayer(L, at);
  }

  /**
   * A SECOND LOOPING VOICE UNDER THE SAME CLOCK -- the whistle over the street
   * bed.
   *
   * ⚠️ THE "NO MIXER AT RUNTIME" RULE DOES NOT APPLY HERE, AND IT IS WORTH
   * SAYING WHY BEFORE SOMEONE DELETES THIS. That rule is inherited from the
   * flying dungeon and it is about `<audio>` ELEMENTS: three of those started
   * together drift apart within a minute and the browser gives you no way to
   * bind them, which is why both games resolve their layering offline. This
   * game plays music through `AudioBufferSourceNode`, which is sample-accurate
   * BY SPECIFICATION and scheduled against one audio clock. Two of them started
   * at the same `currentTime` cannot drift -- there is no second clock to drift
   * against. The constraint was never about layering; it was about the element.
   *
   * ⚠️ AND THE LAYER NEED NOT DIVIDE THE TRACK'S LOOP. The music lab flags a
   * layer that does not, because it RENDERS to one file and the remainder gets
   * spliced onto the head. Nothing is being rendered here: each voice loops
   * itself cleanly at its own pinned length, and the two simply phase against
   * each other -- which on this soundtrack is the feel rather than a fault (its
   * own takes repeat at 2.09s and 2.22s inside a 6.15s arrangement). The
   * whistle is 7.5735s over a 5.115s bed and is never in the same place twice.
   *
   * Its level is its OWN gain node rather than the music bus, because the bus
   * carries the main track's trim and is put back to plain volume by
   * stopMusic().
   */
  _startLayer(L, at) {
    const ctx = this.ctx;
    const buf = this.buffers[L.key];
    // Missing is a legal state: see failedDecode. The track plays without it.
    if (!ctx || !buf) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const want = (CONFIG.MUSIC_LOOP && CONFIG.MUSIC_LOOP[L.key]) || 0;
    s.loopStart = 0;
    s.loopEnd = want > 0 ? Math.min(want, buf.duration) : buf.duration;
    const g = ctx.createGain();
    const vol = (CONFIG.MUSIC_GAIN && CONFIG.MUSIC_GAIN[L.key]);
    const full = vol == null ? 1 : vol;
    /* ⚠️ A GATED LAYER STARTS SILENT AND IS RAISED BY THE GAME. It still PLAYS
       from the first moment -- see setLayerOn for why it is never started and
       stopped instead. */
    g.gain.value = L.gated ? 0 : full;
    g.connect(this.musicGain);
    s.connect(g);
    s.start(at);
    this.layerVoices.push({ src: s, gain: g, key: L.key, full: full, on: !L.gated });
  }

  /**
   * Fade a layer in or out WITHOUT stopping it.
   *
   * ⚠️ THE VOICE KEEPS RUNNING, AND THAT IS THE WHOLE POINT. Starting and
   * stopping it would restart the melody from its first note every time, and
   * would break the one property the layer exists to have: it is locked to the
   * same audio clock as the bed and phases against it. Riding the gain means it
   * fades UP wherever it happens to be -- which is what a layer coming out of a
   * mix sounds like, rather than a cue being triggered.
   *
   * ⚠️ RAMPED, NOT SET. A gain jumped from 0 to 0.64 mid-note is a click, and
   * on a sustained whistle it is a loud one.
   *
   * A no-op when it is already where it is being asked to go, so the caller can
   * ask every frame -- which is what a gate reading the world has to do.
   */
  setLayerOn(key, on, fadeSec) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const v of this.layerVoices) {
      if (v.key !== key || v.on === !!on) continue;
      v.on = !!on;
      const t = ctx.currentTime;
      const f = fadeSec == null ? 0.35 : fadeSec;
      const g = v.gain.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(on ? v.full : 0.0001, t + f);
      } catch (e) { g.value = on ? v.full : 0; }
    }
  }

  /**
   * Stop, with a short ramp.
   *
   * RAMPED RATHER THAN CUT: a buffer source stopped outright ends on whatever
   * sample it happened to be on, and a waveform truncated mid-cycle is a click.
   * The source is released as soon as it is stopped so `playMusic()` can start
   * a fresh one -- a stopped AudioBufferSourceNode cannot be restarted, by
   * specification, and reusing one is silence with no error to explain it.
   */
  stopMusic(fadeSec) {
    this.wanted = false;
    this.wantedTrack = null;
    const s = this.source;
    if (!s || !this.ctx) return;
    this.source = null;
    this.track = null;
    const t = this.ctx.currentTime;
    const f = fadeSec == null ? 0.25 : fadeSec;
    /* ⚠️ THE LAYERS GO WITH IT. They ride the same bus, so the ramp below
       already takes them down -- but nothing would ever STOP them, and the bus
       comes back up for the next track. A whistle left running under the boss
       theme is what that looks like. */
    for (const v of this.layerVoices) {
      try { v.src.stop(t + f + 0.02); } catch (e) { try { v.src.stop(); } catch (e2) {} }
    }
    this.layerVoices = [];
    try {
      const g = this.musicGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.0001, t + f);
      s.stop(t + f + 0.02);
      /* The bus is shared, so it has to come back up for whatever plays next --
         at the PLAIN volume, because the next track sets its own trim in
         _startIfReady(). */
      g.setValueAtTime(this.volume, t + f + 0.03);
    } catch (e) {
      try { s.stop(); } catch (e2) {}
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, t + 0.08);
    }
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }
}
