/**
 * sound.js — the background music, and the machine gun.
 *
 * One file, one loop, no mixer. The three takes that make up the track were
 * layered, aligned and cropped in tools/music-lab.html and bounced to a single
 * ogg by tools/bake-trilha.py, so by the time the game sees it there is nothing
 * left to synchronise — which is the point. Three <audio> elements started
 * together drift apart within a minute and the browser gives you no way to bind
 * them, so the layering had to be resolved offline or not attempted.
 *
 * ⚠️ WEB AUDIO, NOT AN <audio> ELEMENT, and that is not incidental. The whole
 * exercise was making the wrap seamless: the loop is cropped to a downbeat and
 * its first 60ms are a crossfade of its own tail. `HTMLAudioElement.loop`
 * re-primes the decoder at the wrap and can drop a few ms there — inaudible on
 * a song, fatal on a 14-second bed that comes round every 14 seconds, and it
 * would throw away the one thing all that work bought.
 * `AudioBufferSourceNode.loop` is sample-accurate by specification. The cost is
 * holding the decoded track in memory: ~2.7MB against ~30MB of art, which is
 * not a trade worth thinking about.
 *
 * ⚠️ IT STARTS WHEN THE GAME DOES, not at boot — see game.js's startGame(). The
 * intro doubles as the loading screen and can sit on black waiting for the tray
 * frames; music under a progress bar that might stall reads as the game having
 * begun when it hasn't.
 *
 * AUTOPLAY. Browsers keep an AudioContext suspended until the user has
 * interacted with the page, so this cannot simply be started on a timer. In
 * practice the player has pressed several keys by the time the game begins
 * (skipping boards, choosing a fruit), but that is a fact about the current
 * intro rather than a guarantee — with CONFIG.intro off, nothing has been
 * pressed at all. So a resume is attempted on every gesture until one takes,
 * and `wanted` remembers that the game asked for music even if the context was
 * not ready to give it yet.
 *
 * THE GUN is a LOOP, not a one-shot, because the weapon is held rather than
 * fired: `gun(true)` starts it, `gun(false)` stops it, and holding fire keeps
 * it running. A one-shot retriggered per frame would be sixty overlapping
 * copies a second, and one retriggered per "shot" would need a rate the gun
 * does not have — the shot is a hitscan beam, continuous while the key is down.
 *
 * Both are cheap to call every frame and are: gun() no-ops unless the state
 * actually flips, so the caller can hand it a boolean each frame and not track
 * edges itself. That is deliberate — the firing test in game.js is already
 * three conditions deep and should not have to grow a "was I firing last
 * frame?" as well.
 *
 * THE MOVEMENT ONE-SHOTS are the gun's opposite and are worth contrasting with
 * it, because between them they cover both shapes a game sound can have. The
 * gun is a state — it is on while the trigger is down — so it loops and is
 * stopped. Climb and dive are events: fired on the PRESS, never looped, and
 * never cut short. Releasing the key does not stop them, and holding it does
 * not repeat them.
 *
 * The graph is four gains so mute is one knob over three independently balanced
 * sources:
 *
 *      music   ─→ musicGain ─┐
 *      gun     ─→ gunGain ───┼─→ master ─→ destination
 *      one-shots → sfxGain ──┘
 */
class Sound {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.gunGain = null;
    this.buffer = null;
    this.source = null;
    this.gunBuffer = null;
    this.gunSource = null;
    // name -> decoded clip, and name -> the voice currently playing it (null
    // when nothing is). One voice per name is what enforces "plays entirely":
    // an occupied slot rejects the new press rather than cutting the old one.
    this.sfx = Object.create(null);
    this.sfxPlaying = Object.create(null);
    this.sfxVol = Object.create(null);      // name -> its own level, 1 unless set
    this.muted = false;
    this.volume = cfg.musicVolume;
    // The game has asked for music, whether or not it is actually audible yet.
    // Survives a blocked context, a track that hasn't downloaded, and the gap
    // between the two.
    this.wanted = false;
    // Same idea for the gun: the player can be holding fire before the clip has
    // downloaded, and should not have to let go and press again to hear it.
    this.gunWanted = false;
    this._unbind = null;
  }

  _audio() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;                 // no Web Audio: the game is silent, not broken
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volume;
      this.musicGain.connect(this.master);
      this.gunGain = this.ctx.createGain();
      this.gunGain.gain.value = this.cfg.gunVolume;
      this.gunGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.cfg.sfxVolume;
      this.sfxGain.connect(this.master);
      this._armGestures();
    }
    return this.ctx;
  }

  // Keep trying to wake the context on user input until one attempt sticks.
  // Listeners remove themselves the moment it is running — this is a one-time
  // unlock, not something that should stay attached for the whole session.
  _armGestures() {
    const tryResume = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'running') { this._disarm(); return; }
      const p = this.ctx.resume();
      if (p && p.then) p.then(() => {
        if (this.wanted) this._start();
        if (this.gunWanted) this._gunStart();
        this._disarm();
      }).catch(() => {});
    };
    window.addEventListener('keydown', tryResume);
    window.addEventListener('pointerdown', tryResume);
    this._unbind = () => {
      window.removeEventListener('keydown', tryResume);
      window.removeEventListener('pointerdown', tryResume);
    };
  }

  _disarm() {
    if (this._unbind) { this._unbind(); this._unbind = null; }
  }

  /* Fetch and decode the track.
     NOT AWAITED BY THE LOADING BAR, deliberately — it is a few hundred KB, it
     is optional, and a game that sits on a progress bar waiting for music is
     worse than one that starts a moment before its soundtrack does. If it lands
     after the game has already begun, `wanted` is already true and it starts
     itself. A failure (missing file, no network, a browser that cannot decode
     opus) leaves the game silent and otherwise untouched. */
  load() {
    const ctx = this._audio();
    if (!ctx) return Promise.resolve();
    const grab = (path, what) => {
      const url = this.cfg.ASSET_BASE + path;
      return fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(url + ' — ' + r.status);
          return r.arrayBuffer();
        })
        .then(b => ctx.decodeAudioData(b))
        .catch(err => {
          console.warn('[sound] ' + what + ' unavailable:', err.message);
          return null;                           // silent, not broken
        });
    };
    // Both together, and neither blocks the other: a missing gun must not take
    // the music down with it, or vice versa.
    return Promise.all([
      grab(this.cfg.MUSIC_TRACK, 'music').then(buf => {
        this.buffer = buf;
        if (buf && this.wanted) this._start();
      }),
      grab(this.cfg.GUN_SOUND, 'gun').then(buf => {
        this.gunBuffer = buf;
        if (buf && this.gunWanted) this._gunStart();
      }),
      // The one-shots. Nothing to catch up on if one arrives late — a press
      // that happened before the clip landed is over, and firing it now would
      // put a climb sound on a frame the player is no longer climbing.
      // An entry is a path, or { src, volume } when the clip needs its own level.
      ...Object.keys(this.cfg.SFX || {}).map(name => {
        const e = this.cfg.SFX[name];
        const src = (typeof e === 'string') ? e : e.src;
        this.sfxVol[name] = (typeof e === 'string' || e.volume == null) ? 1 : e.volume;
        return grab(src, name).then(buf => { this.sfx[name] = buf; });
      }),
    ]);
  }

  _start() {
    if (!this.ctx || !this.buffer || this.source) return;
    if (this.ctx.state !== 'running') return;   // a gesture will come back for this
    // Undo whatever stopMusic()'s ramp left behind — including a ramp still in
    // flight, if a run started again before the last one had finished fading.
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.volume, t);
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer;
    s.loop = true;                               // sample-accurate — see the header
    s.connect(this.musicGain);
    s.start();
    this.source = s;
  }

  /* --- one-shots ----------------------------------------------------------
     Fire and forget. Nothing stops these: not releasing the key that started
     them, not the run ending, not a restart. They are short, they were asked
     for, and a sound cut off half way is more noticeable than one that finishes
     a beat late.

     ⚠️ A second call while the SAME clip is still playing is IGNORED. That is
     what makes "plays entirely" true — the alternatives are restarting it
     (which interrupts, the one thing this must not do) or stacking a second
     voice on top (which in a game where the player nudges up and down
     constantly is a pile of overlapping whooshes). Different names never block
     each other, so reversing direction always speaks. */
  once(name) {
    const buf = this.sfx[name];
    if (!buf) return;                            // not loaded, or failed: silent
    const live = this.sfxPlaying[name];
    if (live && live.length) return;             // still going — see above
    const ctx = this._audio();
    if (!ctx || ctx.state !== 'running') return; // no gesture yet; not worth queueing

    const e = this.cfg.SFX[name];
    const clipVol = this.sfxVol[name] == null ? 1 : this.sfxVol[name];
    /* Playback speed for every voice of this clip. 0.9 = 10% slower.

       ⚠️ IT RESAMPLES, so it drops the pitch with it — about 1.8 semitones at
       0.9. That is what `playbackRate` on a buffer source does and there is no
       flag to avoid it; preserving pitch would need a real time-stretch, which
       Web Audio does not provide. On a death sting the drop is the point, but
       it is worth knowing this is a tape-speed change, not a tempo change. */
    const rate = (e && typeof e === 'object' && e.rate) ? e.rate : 1;
    const voices = [];

    // One voice = one buffer source on its own gain. A node per voice rather
    // than a shared one, because the copies do not have to be at the same
    // level, and the cost of a GainNode is nothing next to being able to say so.
    const voice = (when, vol) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = clipVol * vol;
      g.connect(this.sfxGain);
      s.connect(g);
      s.onended = () => {
        const arr = this.sfxPlaying[name];
        if (arr) {
          const i = arr.indexOf(s);
          if (i >= 0) arr.splice(i, 1);
        }
        try { s.disconnect(); } catch (err) {}
        try { g.disconnect(); } catch (err) {}
      };
      s.start(when);
      voices.push(s);
    };

    const now = ctx.currentTime;
    voice(now, 1);

    /* THE DOUBLE. A second voice off the SAME decoded buffer, started a fixed
       delay later — so it costs one more source node and nothing else. No
       second file, no second decode, no second copy of the samples: an
       AudioBuffer can feed any number of sources at once, and this is exactly
       what that is for.

       Scheduled against ctx.currentTime, NOT with a setTimeout. The audio clock
       is sample-accurate and runs on its own thread; a timer runs on the main
       one, behind whatever the frame is doing, and would land the copy 300ms
       later give or take a stutter — turning a fixed interval into a variable
       one, which is the one thing this effect cannot survive.

       The delay decides what the effect IS, and small changes are not subtle.
       Under ~40ms the ear fuses the two copies into one sound and the delay
       colours its tone instead; at 50ms, where this sits, it is right on that
       edge — nearly one thickened sound with a hard edge on it; at 100ms a
       slapback; by 300ms the round of a canon. `SFX[name].double.delayMs` is
       the knob. */
    const dbl = (e && typeof e === 'object') ? e.double : null;
    if (dbl && dbl.delayMs > 0) {
      /* ⚠️ DIVIDED BY `rate`, so `delayMs` is measured in the CLIP's own time
         rather than in wall-clock ms. Slowing the clip therefore slows the
         whole combination — the gap stretches with the material, exactly as it
         would if the two voices had been bounced to one file and that file
         played slower. Leaving the gap fixed while the material stretched would
         change the relationship between the copies, which is the effect. */
      voice(now + (dbl.delayMs / 1000) / rate,
            dbl.volume == null ? 1 : dbl.volume);
    }

    this.sfxPlaying[name] = voices;
  }

  /* Cut a one-shot short. The deliberate EXCEPTION to "nothing stops these",
     and it exists for exactly one case: the death sting still ringing when the
     player restarts. The panel arms its "press anything" before the sting has
     finished, so without this a new run's title sequence opens over the sound
     of the last one dying.

     Not called for the movement whooshes, and it should not be — those are
     short, incidental, and the whole point of them is that they finish. */
  stopOnce(name) {
    const arr = this.sfxPlaying[name];
    if (!arr || !arr.length) return;
    // A copy: stop() fires onended, which splices the array being walked.
    // Cleared first so a voice that has not started yet still counts as gone.
    this.sfxPlaying[name] = [];
    for (const s of arr.slice()) {
      // Stopping a source whose start time is still in the FUTURE cancels it
      // outright — it never plays. Which is what should happen to a double
      // still waiting its 300ms when the player restarts.
      try { s.stop(); } catch (e) {}
    }
  }

  /* --- the machine gun ---------------------------------------------------
     Hand it `input.firing` every frame and forget about it. */
  gun(on) {
    if (on) {
      if (this.gunWanted) return;                // already going: nothing to do
      this.gunWanted = true;
      const ctx = this._audio();
      if (!ctx) return;
      if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      this._gunStart();
    } else {
      this.gunWanted = false;
      if (!this.gunSource) return;
      try { this.gunSource.stop(); } catch (e) {}
      this.gunSource.disconnect();
      this.gunSource = null;
    }
  }

  _gunStart() {
    if (!this.ctx || !this.gunBuffer || this.gunSource) return;
    if (this.ctx.state !== 'running') return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.gunBuffer;
    s.loop = true;
    /* The loop skips the clip's own fades. build-sound.py puts a 12ms fade on
       each edge of everything it builds, which is right for a clip that plays
       once and wrong for one that plays end to end sixty times a minute: the
       two fades meet at the wrap and put a 24ms hole in the middle of the
       burst, roughly once a second, which reads as the gun stuttering.

       Looping between them instead keeps the fade-in as the gun's attack — you
       hear it on the first press, which is what it is for — and never returns
       to it. Clamped so a clip shorter than the trim cannot produce an inverted
       loop region. */
    const trim = Math.max(0, (this.cfg.gunLoopTrimMs || 0) / 1000);
    if (this.gunBuffer.duration > trim * 3) {
      s.loopStart = trim;
      s.loopEnd = this.gunBuffer.duration - trim;
    }
    s.connect(this.gunGain);
    // From the very top, not from loopStart: the first thing the player hears
    // when they pull the trigger should be the gun starting, and every press
    // should sound the same. Playback falls into the loop region on its own.
    s.start();
    this.gunSource = s;
  }

  // Both are safe to call whenever: play while already playing is a no-op, and
  // stop while already stopped is too.
  playMusic() {
    this.wanted = true;
    const ctx = this._audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    this._start();
  }

  /* Stop for good rather than pause. The track always begins a run from its own
     first beat: a bed that resumed halfway through would put the top of the
     loop somewhere different every run, and the arrangement was built around
     where it starts.

     ⚠️ IT RAMPS DOWN RATHER THAN CUTTING, and that is not a stylistic choice.
     Stopping a buffer source outright chops the waveform wherever it happens to
     be, and a waveform that ends anywhere but zero is a step — which is a click,
     every time, loud. A few tens of ms of ramp is the standard fix. It also
     happens to suit where this is called from: the music going down over the
     dip to black rather than vanishing on one frame. */
  stopMusic() {
    this.wanted = false;
    const s = this.source;
    if (!s) return;
    this.source = null;
    const g = this.musicGain, t = this.ctx.currentTime;
    const d = Math.max(0, (this.cfg.musicFadeOutMs || 0) / 1000);
    s.onended = () => { try { s.disconnect(); } catch (e) {} };
    if (d > 0 && g) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + d);
      try { s.stop(t + d); } catch (e) { }
    } else {
      try { s.stop(); } catch (e) { }
    }
    // The gain is NOT restored here — it is left at zero and reset by _start().
    // Restoring it on a timer would race a run that started again during the
    // fade and bring the old level back under the new track mid-ramp.
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    // Only while something is playing: writing it during a stop ramp would
    // cancel the fade and hand back the click the ramp exists to avoid.
    if (this.musicGain && this.source) this.musicGain.gain.value = this.volume;
    return this.volume;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  // Mute rides the MASTER, above both the music and the gun — so it silences
  // everything at once and cannot disturb either one's own level or a fade
  // either of them happens to be in the middle of.
  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }
}
