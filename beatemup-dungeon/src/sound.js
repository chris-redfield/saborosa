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
 * container says 6.1525s for a mix that is 6.1460s of music. Left alone that is
 * six milliseconds of silence inserted every six seconds: an audible tick, and
 * one you would go looking for in the music rather than in the decoder. So
 * loopStart/loopEnd are set from CONFIG.musicLoopSec, which is the lab's own
 * loop length. If the mix is re-cropped, that number moves with it.
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
    this.buffer = null;
    this.source = null;
    this.sfxGain = null;
    this.sfx = {};             // name -> decoded AudioBuffer
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
    this._decoding = false;

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

  /**
   * Decode the bytes the loader fetched.
   *
   * SEPARATE FROM LOADING ON PURPOSE -- see Assets.loadAudio. decodeAudioData
   * needs a context, a context needs a gesture, and the loading bar must not
   * wait on a gesture that may never come. So the bytes arrive with everything
   * else and turn into a buffer here, the first time there is somewhere to
   * decode them to.
   */
  _decode() {
    if (this.buffer || this._decoding) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const bytes = this.assets && this.assets.getBytes('music');
    if (!bytes) return;
    this._decoding = true;
    /* decodeAudioData DETACHES the ArrayBuffer it is given on some engines, so
       it gets a copy. The original stays in Assets, which means a later reload
       -- a restart that rebuilt this object, say -- still has something to
       decode instead of an empty husk. */
    const copy = bytes.slice(0);
    const done = buf => {
      this._decoding = false;
      this.buffer = buf || null;
      this._startIfReady();
    };
    const fail = () => { this._decoding = false; };
    try {
      const p = ctx.decodeAudioData(copy, done, fail);
      if (p && p.then) p.then(done, fail);
    } catch (e) { this._decoding = false; }
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
   */
  play(name, rate) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const buf = this.sfx[name];
    if (!buf) { this.primeSfx(); return; }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    if (rate) s.playbackRate.value = rate;
    /* A per-effect trim gets its OWN gain node rather than moving the bus:
       the bus is the balance between all effects and the music, and nudging it
       for one clip would move every other clip with it -- and leave it moved,
       because nothing puts it back. The node dies with the source. */
    const trim = (CONFIG.SFX_GAIN && CONFIG.SFX_GAIN[name]) || 1;
    if (trim !== 1) {
      const g = ctx.createGain();
      g.gain.value = trim;
      g.connect(this.sfxGain);
      s.connect(g);
    } else {
      s.connect(this.sfxGain);
    }
    s.start(0);
  }

  /** The game wants music. Everything after this is the browser's timing. */
  playMusic() {
    this.wanted = true;
    this._ensure();
    this._decode();
    this.primeSfx();
    this._resume();
  }

  _startIfReady() {
    if (!this.wanted || this.source) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;   // a gesture will come back
    if (!this.buffer) { this._decode(); return; }

    const s = ctx.createBufferSource();
    s.buffer = this.buffer;
    s.loop = true;
    /* See the header: the decoded buffer may be a few ms longer than the music.
       Clamped so a wrong CONFIG number cannot ask for a loop past the end of
       the buffer, which throws in some engines and silently plays nothing in
       others. */
    const want = (CONFIG.musicLoopSec || 0);
    s.loopStart = 0;
    s.loopEnd = want > 0 ? Math.min(want, this.buffer.duration) : this.buffer.duration;
    s.connect(this.musicGain);
    s.start(0);
    this.source = s;
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
    const s = this.source;
    if (!s || !this.ctx) return;
    this.source = null;
    const t = this.ctx.currentTime;
    const f = fadeSec == null ? 0.25 : fadeSec;
    try {
      const g = this.musicGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.0001, t + f);
      s.stop(t + f + 0.02);
      // The bus is shared, so it has to come back up for whatever plays next.
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
