/**
 * time-attack.js — the minigame inside the minigame.
 *
 * *"time attack will basically be still life but with a different background,
 * different assets etc."* It is exactly that: the plane, the flies and the coins
 * ARE Still Life's classes (`ta-plane.js`, `ta-fly.js`, `ta-coin.js`, ported
 * unchanged bar their names and their asset keys), and this file is the shell
 * that Still Life's `game.js` would otherwise be — rounds, the clock, the beam,
 * the board. Every number it reads is `CONFIG.TIME_ATTACK`.
 *
 * THE RULES, as asked for on 2026-09-08 — Sonic 2's special stages:
 * *"Vários rounds cada um vc precisa pegar mais moedas em comparação ao round
 * anterior. Tem que matar as moscas dentro do limite de tempo. Pode ganhar mais
 * tempo acertando os relógios."*
 *
 *     kill a fly            -> coinsPerFly toward this round's quota
 *     shoot a clock         -> clockAddMs back on the timer
 *     quota met             -> next round, which wants MORE
 *     timer out             -> the mode ends and he walks on to HORÁCIO
 *
 * ⚠️ IT CANNOT BE LOST AND IT GRANTS NO EXTRA LIFE. *"don't add extra lifes
 * please, the game doesn't need it."* Running out of time is not a failure
 * state, it is the end of the mode — there is no death, no continue, no life
 * spent. What it pays is points. Nothing about the beat 'em up's life count,
 * its continues or its game over is reachable from in here, and that is worth
 * keeping true: it is a bonus stage sitting inside a level, and the moment it
 * can cost something it becomes a wall in front of a boss.
 *
 * ⚠️ THE PLANE CANNOT DIE EITHER. `planeHealth: 0` and nothing here calls
 * `hurt()`, because nothing in this mode shoots back. The whole hurt/fall/wear
 * path came across with the port and is simply never entered.
 *
 * ⚠️ THIS IS A PHASE, NOT A SEGMENT THAT DRAWS ITSELF. `stage.js` returns the
 * event and `game.js` runs the mode with the world's own update and render
 * skipped, the same shape `liftout` uses for the lift ride. It has to be: the
 * mode owns the whole canvas, has no belt, no camera and no player, and a
 * segment that tried to draw over a running level would be fighting the
 * backdrop, the crowd and the HUD for the frame.
 *
 * ⚠️ AND THE BACKGROUND IS A PLAIN LOOPING <video>, NOT `Backdrop`. That class
 * scrubs a plate by CAMERA POSITION — `_drawVideo` is driven by camX and by
 * nothing else — and this mode has no camera to scrub with, so handing it the
 * plate would freeze the shot on frame one. The plate loops on itself
 * (tools/build-time-attack-plate.py); `loop = true` is the whole playback
 * policy. See the video traps in the Backdrop header before touching this: a
 * muted, inline, autoplayed element is the only kind that starts without a
 * gesture, and a blit from a video with no data silently draws nothing.
 */
class TimeAttack {
  constructor(assets, input, sound) {
    this.assets = assets;
    this.input = input;
    /* ⚠️ THE MODE OWNS ITS OWN SOUND rather than game.js driving it from
       outside, which is where Still Life puts the same two calls. The reason is
       leave(): the mode ends ITSELF when the clock runs out, and game.js
       returns on that very frame to start the fade -- so a `sound.loop(...)`
       living in game.js would never get the frame that turns the gun off, and
       the machine gun would carry into HIPÓLITO's room. Optional, so a caller
       that has no audio still gets a working minigame. */
    this.sound = sound || null;
    this.plane = null;      // built on the first enter(); see _cfg()
    this.flies = [];
    this.coins = [];
    this.video = null;
    this.reset();
  }

  _cfg() { return CONFIG.TIME_ATTACK || {}; }

  /** Is the mode switched on and does it have what it needs to run? */
  static enabled() {
    const T = CONFIG.TIME_ATTACK;
    return !!(T && T.on !== false && T.ROUNDS && T.ROUNDS.length);
  }

  reset() {
    this.state = 'idle';    // idle | in | play | card | out | done
    this.stateT = 0;
    this.round = 0;
    this.coinsGot = 0;      // this round
    this.clockMs = 0;
    this.score = 0;
    this.totalCoins = 0;
    this.roundsCleared = 0;
    this.flies.length = 0;
    this.coins.length = 0;
    this.respawnT = 0;
    this.lastCard = '';
    /* ⚠️ THE LAST RAY THE RESOLVER ACTUALLY BUILT, kept only so the C overlay
       can draw THAT and not a second one derived the same way. A debug view that
       recomputes what it is inspecting can agree with itself while disagreeing
       with the game -- which is the one thing it exists to rule out. Null on
       every frame the gun is not firing, and cleared at the top of `_shoot`. */
    this.ray = null;
    /* IS THE BEAM ON A COIN RIGHT NOW -- the coin-hit loop's whole input, and
       nothing else reads it. Kept beside `ray` because it has exactly the same
       lifetime: recomputed by `_shoot()` every frame and false on every frame
       that does not run it. */
    this.coinBeam = false;
  }

  /**
   * Build the plane. Called once, at boot.
   *
   * ⚠️ IT LOADS NOTHING, AND `TaPlane.load()` IS DELIBERATELY NOT CALLED.
   * Still Life's plane fetches its own frames; here `manifest.js` lists them
   * under the very keys `TaPlane` looks for, because **package.sh copies what
   * the manifest names and nothing else** -- art fetched by a class at runtime
   * works in dev and is missing from the built game. That has shipped from this
   * repo before. Calling both would decode all twelve frames twice.
   */
  load() {
    if (!TimeAttack.enabled()) return;
    this.plane = new TaPlane(this.assets, this._cfg());
  }

  /**
   * Begin. Called by game.js when the desert reaches its `timeattack` segment.
   *
   * ⚠️ `charIdx` FOLLOWS THE PLAYER'S PACK rather than asking. The minigame
   * interrupts a fight, so a select screen here would be a menu in the middle
   * of a level; whoever they are flying is whoever they were punching with.
   */
  enter(packIdx) {
    const c = this._cfg();
    this.reset();
    /* ⚠️⚠️ THE PLANE IS RE-ARMED, AND WITHOUT THIS THE ENTRANCE PLAYED ONCE PER
       PAGE LOAD. *"when entering the time attack stage, make the player come
       from the left, instead of just appearing in it."* The fly-in was never
       missing -- `planeEntry`, `planeEntryFromX: -0.55`, `planeEntryMs` and the
       whole `_entryOff()` easing came across with the port and are Still Life's
       own numbers. What did not come across is WHEN that state is built.

       ⚠️ STILL LIFE REBUILDS THE PLANE (`plane = new Plane(...)` in its
       restart), because over there a run IS the program: a new run is a new
       everything. Here the plane is constructed once in `load()`, at boot, and
       deliberately so -- see the note there about not decoding the frames
       twice. So `locked` was true exactly once, the first entry of a session
       spent it, and every entry after that opened with the plane already
       parked at `startX`. A DEV jump straight back in is the fastest way to
       never see it.

       ⚠️ SO THE LIFETIME IS THE BUG, NOT THE ANIMATION -- the same shape as the
       `dt` and the `worldW`: a contract about when state is built, which no
       signature states and which a copied class cannot carry with it. */
    if (this.plane) this.plane.reset();
    /* RE-ENTRY INSURANCE. `reset()` clears the flags that DRIVE the loops but
       cannot stop a source that is already playing, and the DEV jump can open
       this mode while it is already open. */
    if (this.sound) this.sound.stopLoops();
    if (!this.plane) return;
    this.plane.setCharacter(c.character != null ? c.character
                            : (packIdx || 0) % (c.CHARACTERS || ['']).length);
    /* ⚠️ THE MODE'S OWN SONG, by KEY -- the `musicKey` idiom the bosses use.
       Coming OUT needs nothing: the exit is a room CHANGE, and `roomMusic()` on
       the far side of the fade starts the next room's track the way it does for
       every other room. Unset falls through to whatever the room it was entered
       from left playing, which is what this mode did until 2026-09-09. */
    if (this.sound && c.musicKey) this.sound.playMusic(c.musicKey);
    /* ⚠️ AND A CLEAN INPUT SLATE, for the same reason every screen change in
       this game takes one: a press made on the way out of the fight is not a
       press aimed at the minigame. It also drops any direction EDGE banked
       during the walk-out, which would otherwise spend itself as a swoosh on
       the first frame the plane answers the controls. */
    if (this.input && this.input.flush) this.input.flush();
    this._startVideo();
    this.state = 'in';
    this.stateT = 0;
    this._spawnRound(0);
  }

  /** Tear down. ⚠️ THE VIDEO IS PAUSED, not left running behind the level. */
  leave() {
    if (this.video) { try { this.video.pause(); } catch (e) {} }
    /* ⚠️ AND THE HELD SOUNDS, WHICH NOTHING ELSE WILL DO. A player holding fire
       as the clock hits zero is the ordinary way out of this mode, not an edge
       case -- and the frame after this one is a fade into the next room. By
       NAME would be wrong here: stopLoops() is what keeps the third loop, added
       by whoever adds one, from being the one nobody remembered. Still Life
       shipped this exact bug (a gun running under its game-over panel). */
    if (this.sound) this.sound.stopLoops();
    this.flies.length = 0;
    this.coins.length = 0;
    this.state = 'done';
  }

  isDone() { return this.state === 'done'; }

  /**
   * The game paused, or resumed.
   *
   * ⚠️ THE PLATE HAS TO BE TOLD, AND IT IS THE ONLY BACKDROP IN THE GAME THAT
   * DOES. Every other room's film is SCRUBBED by camera position (`Backdrop`
   * draws frame `f(camX)`), so it freezes for free the moment the world stops
   * being ticked -- a paused game cannot move the camera. This one is a plain
   * looping `<video>` playing on the browser's own clock, which knows nothing
   * about the pause card, so without this the stones would go on drifting under
   * a frozen plane, a frozen clock and a frozen swarm. *"just like the rest of
   * the game"* is the ask, and for this plate that means being told.
   *
   * ⚠️ NOT `_startVideo()` ON THE WAY BACK: that seeks to 0 and re-reads the
   * rate. Resuming a pause has to come back on the frame it stopped on.
   */
  setPaused(on) {
    const v = this.video;
    if (!v) return;
    if (on) { try { v.pause(); } catch (e) {} return; }
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* ------------------------------------------------------------------ video */

  /**
   * The plate, as a bare looping <video>.
   *
   * ⚠️ MUTED + PLAYSINLINE + AUTOPLAY IS THE ONLY COMBINATION THAT STARTS
   * WITHOUT A USER GESTURE, and this element is created mid-level where there
   * is no press to hang it on. `muted` is also correct on its own merits: the
   * plate's audio was stripped at build time and the mode plays over the
   * desert's song.
   *
   * ⚠️ AND `play()` RETURNS A PROMISE THAT REJECTS. An autoplay refusal is not
   * an exception you can let escape — it lands as an unhandled rejection and
   * the frame carries on drawing nothing. Caught, and the draw already copes
   * with a video that has no data.
   */
  _startVideo() {
    /* ⚠️ THE ELEMENT COMES FROM `Assets`, NOT FROM `createElement` HERE.
       `manifest.js` lists the plate as `how: 'video'`, which makes the boot
       loader build it, preload it and store it under `taPlate` -- exactly what
       it does for the four level plates. Making a second one here would
       re-download 5.7MB on a machine that had already fetched it, and would
       hand back an element with no data on the frame the mode opens.
       ⚠️ It also gets `muted`/`playsInline` from that loader, which is the pair
       that lets it start with no user gesture; this mode opens mid-level, where
       there is no press to hang a play() on. */
    this.video = this.assets.getDrawable('taPlate');
    if (!this.video) return;
    /* ⚠️ `loadVideo` SETS `loop = false` -- it is written for plates that get
       SCRUBBED, which never reach their end. This one plays, and the plate is
       cut to loop on itself (tools/build-time-attack-plate.py), so looping is
       the whole playback policy and it has to be turned on here. */
    this.video.loop = true;
    /* ⚠️ SET ON EVERY ENTRY, NOT ONCE. `playbackRate` belongs to the ELEMENT,
       and the element is the loader's -- shared, long-lived, and reset to 1 by
       some engines on a load/seek. Setting it here means the rate is a property
       of the mode running rather than of the tab's history. */
    const rate = this._cfg().plateRate;
    try { this.video.playbackRate = (rate > 0 ? rate : 1); } catch (e) {}
    try { this.video.currentTime = 0; } catch (e) {}
    /* ⚠️ `play()` RETURNS A PROMISE THAT REJECTS on an autoplay refusal. An
       uncaught one lands as an unhandled rejection and the frame carries on
       drawing nothing; `_drawPlate` already copes with a video with no data. */
    const p = this.video.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* ------------------------------------------------------------------ rounds */

  round0() { return this._cfg().ROUNDS[Math.min(this.round, this._cfg().ROUNDS.length - 1)]; }

  _spawnRound(i) {
    const c = this._cfg(), R = c.ROUNDS[Math.min(i, c.ROUNDS.length - 1)];
    this.round = i;
    this.coinsGot = 0;
    /* ⚠️ THE CLOCK RESETS PER ROUND UNLESS `carryTime`. Carrying time over
       rewards a fast round with an easier next one, which is the opposite of a
       rising quota; off by default for that reason. */
    if (!c.carryTime || this.clockMs <= 0) this.clockMs = R.timeMs;
    this.flies.length = 0;
    this.coins.length = 0;
    for (let n = 0; n < (R.flies || 0); n++) this._spawnFly();
    for (let n = 0; n < (R.clocks || 0); n++) this._spawnClock();
  }

  _fieldY() {
    const c = this._cfg(), H = CONFIG.GAME_H;
    const t = H * (c.spawnTopRel != null ? c.spawnTopRel : 0.14);
    const b = H * (c.spawnBotRel != null ? c.spawnBotRel : 0.86);
    return t + Math.random() * (b - t);
  }

  /**
   * ⚠️ SPAWNED INSIDE THE FIELD, AND IT HAS TO BE: `TaFly.update` WRAPS x
   * MODULO `worldW` -- Still Life's world is a TORUS, and `render` even draws
   * the ±worldW copies so a fly leaving one edge is already arriving at the
   * other. `worldW` here is the canvas, so spawning "just off the right edge"
   * at GAME_W + 90 was silently wrapped to x = 90 on the entity's first update
   * and every fly appeared pinned to the LEFT of the screen. That is what
   * "the flies are all stuck in the left" was.
   *
   * So this is a single wrap-around screen, which is the honest shape for a
   * mode with no camera: a fly drifts left, leaves, and comes back on the
   * right. `spawnFromRel` keeps a new one out of the plane's face -- the plane
   * sits at `startX` 0.35 and the field opens well right of it.
   */
  _spawnFly() {
    this.flies.push(new TaFly(this.assets, this._cfg(), this._spawnX(), this._fieldY()));
  }

  /** A spawn x in the right-hand part of the wrap-around field. */
  _spawnX() {
    const c = this._cfg(), W = CONFIG.GAME_W;
    const a = c.spawnFromRel != null ? c.spawnFromRel : 0.58;
    const b = c.spawnToRel != null ? c.spawnToRel : 0.98;
    return W * (a + Math.random() * (b - a));
  }

  _spawnClock() {
    const c = this._cfg();
    /* THE CLOCK IS DRAWN BY THE COIN SPRITE, and that is not a stand-in: the
       coin was cut with a CLOCK on one face (`saborosa-coin-time.json` names a
       `clockFace` range against a `fruitFace`) for Still Life's shoot-a-coin-to-
       rewind mechanic. It already means time. A dedicated clock sprite would be
       an asset swap and no code. */
    const p = this._freeSpot(c);
    this.coins.push(new TaCoin(this.assets, c, p.x, p.y, '01'));
  }

  /**
   * A spawn point for a clock that is not on top of another clock.
   *
   * ⚠️ THE DISTANCE IS MEASURED ROUND THE TORUS, and getting that wrong is the
   * whole trap. `TaCoin` wraps `x` modulo the field width and renders the two
   * neighbouring copies, so a coin at 0.98W and one at 0.02W are a sliver
   * apart on screen and 0.96W apart by subtraction. The spawn band is the
   * RIGHT-HAND part of the field (`spawnFromRel` 0.58 to 0.98) while existing
   * coins have drifted left towards 0, which is exactly the pair that wraps --
   * so the naive distance would report them as maximally far apart at the one
   * moment they are touching.
   *
   * ⚠️ AND IT GIVES UP AFTER `coinSpawnTries`, taking the roomiest point it
   * saw. The band is finite and the caller runs inside the frame; a loop that
   * insisted on the constraint would hang the game the moment the field got
   * full. Best-effort placement is a look; a hang is a crash.
   *
   * ⚠️ FLIES ARE NOT CONSIDERED, on purpose. The ask was about clocks reading as
   * one clump, and there are up to six flies to a field -- folding them in
   * would over-constrain a band that has to hold both.
   */
  /**
   * The width of the world the COINS wrap in -- wider than the screen.
   *
   * ⚠️⚠️ EVERY PLACE THAT HANDS A COIN A `worldW` MUST USE THIS, and there are
   * five of them: `update()`, the ray test in `_shoot()`, `render()`,
   * `renderBurst()` and the hold-C overlay. `TaCoin` derives its wrap AND the
   * two ghost copies it draws from that number, so a call site still passing
   * `GAME_W` would put a coin's picture and its hitbox in different places --
   * silently, and only for the copies. That is the same failure the beam bug
   * was, and the reason this is a method rather than a local.
   *
   * ⚠️ THE FLIES ARE DELIBERATELY NOT ON THIS WORLD. They are the targets and
   * are meant to be in the field; only the clocks were asked to arrive.
   */
  _coinW() {
    return CONFIG.GAME_W + (this._cfg().coinOffscreenPx || 0);
  }

  _freeSpot(c) {
    const W = this._coinW();
    const min = (c.coinMinGapPx != null ? c.coinMinGapPx : (c.coinSizePx || 76) * 1.35);
    const tries = c.coinSpawnTries || 40;
    let best = null, bestD = -1;
    /* ⚠️ THE BAND IS THE OFF-SCREEN STRIP AND NOTHING ELSE -- `_spawnX()` is
       the FLIES' band (0.58..0.98 of the canvas, i.e. on screen) and is
       deliberately not used here. Inset by half a coin at each end so a clock
       is never spawned already poking over the right edge, and never so deep
       that it wraps back on to the left. */
    const half = (c.coinSizePx || 76) / 2;
    const lo = CONFIG.GAME_W + half, hi = Math.max(lo, W - half);
    for (let i = 0; i < tries; i++) {
      const x = lo + Math.random() * (hi - lo), y = this._fieldY();
      let d = Infinity;
      for (const cn of this.coins) {
        if (cn.isDead()) continue;
        let dx = Math.abs(x - cn.x);
        if (W > 0) dx = Math.min(dx, W - dx);      // the short way round
        d = Math.min(d, Math.hypot(dx, y - cn.y));
      }
      if (d >= min) return { x, y };
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best || { x: lo, y: this._fieldY() };
  }

  /* ------------------------------------------------------------------ update */

  update(dtSec) {
    const c = this._cfg();
    /* ⚠️⚠️ THE TWO GAMES DISAGREE ABOUT WHAT `dt` IS, AND THIS LINE IS THE
       WHOLE FIX. Still Life's loop is `const dt = now - last` -- MILLISECONDS --
       and every ported entity divides by 1000 internally (`const s = dt / 1000`
       at the top of TaFly.update). This game's loop is `(now - last) / 1000` --
       SECONDS. Handing one to the other ran the entire mode 1000x too slow:
       the intro card was a 900-SECOND card, the clock sat unmoving on 30.0, and
       the plane was still off-screen in a 1035-SECOND fly-in. It looked like
       four separate bugs and it was this.

       ⚠️ THE CONVERSION LIVES HERE, AT THE BOUNDARY, and not at the call site.
       This class owns the ported entities, so it is the one place that has to
       know both conventions -- it takes SECONDS like every other update() in
       this game and speaks MILLISECONDS inward, where every knob in
       CONFIG.TIME_ATTACK is already named `...Ms`. A caller cannot get it
       wrong because there is nothing left for a caller to get wrong.

       ⚠️ AND A PREVIEW THAT FEEDS THIS 16.67 BY HAND CANNOT SEE THE BUG. That
       is how it shipped: the harness passed milliseconds directly and every
       frame looked right. Drive it with the host's real dt or do not believe
       it. */
    const dt = dtSec * 1000;
    this.stateT += dt;
    if (this.state === 'in') {
      if (this.stateT >= (c.inMs || 0)) { this.state = 'play'; this.stateT = 0; }
    } else if (this.state === 'card') {
      if (this.stateT >= (c.roundCardMs || 0)) {
        this.stateT = 0;
        if (this.round + 1 < c.ROUNDS.length) { this.state = 'play'; this._spawnRound(this.round + 1); }
        else { this.state = 'out'; }
      }
    } else if (this.state === 'out') {
      if (this.stateT >= (c.outMs || 0)) this.leave();
    }

    /* THE PLANE FLIES THROUGH EVERY BEAT, including the cards -- a plane that
       froze between rounds would read as the game hanging. It is only the CLOCK
       and the SHOOTING that are gated on `play`. */
    if (this.plane) this.plane.update(dt, this._planeInput());

    const live = this.state === 'play';
    if (live) {
      this.clockMs -= dt;
      if (this.clockMs <= 0) { this.clockMs = 0; this.state = 'out'; this.stateT = 0; }
    }

    const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
    for (const f of this.flies) f.update(dt, W, H, false);
    for (const cn of this.coins) cn.update(dt, this._coinW());
    if (live) this._shoot(); else { this.ray = null; this.coinBeam = false; }

    /* THE TWO HELD SOUNDS, handed a boolean each and left to sort themselves
       out -- Sound.loop() no-ops unless the state flips, so calling it on every
       frame is the intended use and not a waste.

       ⚠️ DRIVEN OFF `ray`, NOT OFF `input.firing`. They are different on the
       frames that matter: the gun is silent while the plane is control-locked
       (the fly-in, the round cards) and between rounds, and a trigger held
       through the opening card would otherwise fire a gun that visibly is not.
       `ray` is null on exactly those frames because `_shoot()` returns before
       building one.

       ⚠️ THE COIN HIT CAN ONLY BE TRUE ON A FRAME THE GUN IS ALSO TRUE, so it
       layers under the gun rather than replacing it -- which is the balance
       its level in SFX_GAIN was solved against. */
    if (this.sound) {
      this.sound.loop('gun', !!this.ray);
      this.sound.loop('coinHit', this.coinBeam);
    }

    /* THE CLIMB AND THE DIVE. ⚠️ BOTH EDGES ARE CONSUMED UNCONDITIONALLY and
       only the PLAYING is gated -- a press banked while the plane is
       control-locked (the fly-in, every round card) must be dropped, not held
       and spent the moment control returns on a climb the player has forgotten
       making. Reading them inside the `if` would do the second thing.

       ⚠️ AND THEY ARE GATED ON `controlLocked`, WHICH IS WHERE STILL LIFE PUTS
       THEM TOO: the swoosh answers the stick, so it must not sound on a frame
       the stick is being ignored -- the entrance flies the plane up the screen
       on its own and would otherwise swoosh all the way in. */
    const upP = this.input.takeUpPress(), downP = this.input.takeDownPress();
    if (this.sound && this.plane && !this.plane.controlLocked) {
      if (upP) this.sound.playExclusive('up');
      if (downP) this.sound.playExclusive('down');
    }

    /* Drop the dead and top the field back up. ⚠️ A LANDED FLY IS NOT DEAD --
       `isDead()` and `isLanded()` are different questions in ta-fly.js and a
       corpse stays in the list so the pile keeps being drawn. Here there is no
       floor to pile on, so a corpse that has left the frame is what goes. */
    /* ⚠️ NO "LEFT THE SCREEN" CULL, because on a torus nothing ever does --
       `x` is wrapped into [0, worldW) by the entities themselves. The old
       `x < -200` test could never fire, which would have quietly capped the
       field at its first population. Death is the only way out of these lists. */
    /* ⚠️ `isLanded()` IS DROPPED TOO, AND IT IS NOT THE SAME QUESTION AS
       `isDead()`. In Still Life a landed body is deliberately NOT dead -- it
       stays in the list so the corpse pile on the dungeon floor keeps being
       drawn. There is no floor here and no pile wanted, so a body that has
       finished falling is finished with. With `corpsePlaneTop` pushed below the
       canvas it lands out of shot, so what the player sees is a fly falling out
       of the bottom of the frame and not coming back. */
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      if (f.isDead() || f.isLanded()) this.flies.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) if (this.coins[i].isDead()) this.coins.splice(i, 1);
    if (live) {
      const R = this.round0();
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        if (this.flies.length < (R.flies || 0)) { this._spawnFly(); this.respawnT = c.respawnMs || 450; }
        else if (this.coins.length < (R.clocks || 0)) { this._spawnClock(); this.respawnT = c.respawnMs || 450; }
      }
    }
  }

  /**
   * The plane reads `up`/`down`/`left`/`right` off whatever it is handed, which
   * the beat 'em up's Input already exposes under exactly those names -- one
   * more reason the port needed no adapter.
   */
  _planeInput() { return this.input; }

  /**
   * The hitscan beam, straight from Still Life: a thin line forward from the
   * nose, re-tested EVERY FRAME while the trigger is held.
   *
   * ⚠️ WHICH IS WHY EVERY EFFECT HERE MUST BE RATE-LIMITED BY `hit()` RETURNING
   * TRUE, and not by the beam crossing a box. `hit()` is refused inside the
   * target's own i-frames (`flyHurtMs` 180, `coinHurtMs` 160), so gating on it
   * is what stops a held trigger buying a minute of clock a second and banking
   * sixty coins off one fly. That is Still Life's lesson and the reason its
   * `Coin.hit()` returns a boolean at all.
   *
   * ⚠️ THE BEAM PIERCES -- no early exit between targets, so one line can take a
   * fly and a clock at once. Deliberate over there and kept here.
   */
  _shoot() {
    const c = this._cfg();
    this.ray = null;
    this.coinBeam = false;
    if (!this.input.firing || !this.plane || this.plane.controlLocked) return;
    const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
    const m = this.plane.muzzle(W, H);
    if (!m) return;
    const ray = { x: m.x, y: m.y, end: W };
    this.ray = ray;                       // the overlay draws THIS one
    const th = c.rayThickness || 14, dmg = c.rayDamage || 1;

    for (const f of this.flies) {
      if (!f.isAlive()) continue;
      for (const b of f.boxes(0, 0, W)) {
        if (!TimeAttack._rayHitsBox(ray, th, b)) continue;
        /* ⚠️ `hit()` TAKES A TIMESTAMP because Still Life stamps a death so a
           later REWIND can undo it. There is no rewind here, so the mode's own
           elapsed clock is honest enough -- what matters is that it rises. */
        f.hit(dmg, performance.now());
        if (f.isDead() || !f.isAlive()) this._flyDown();
        break;
      }
    }
    for (const cn of this.coins) {
      if (!cn.isShootable()) continue;
      for (const b of cn.boxes(0, 0, this._coinW())) {
        if (!TimeAttack._rayHitsBox(ray, th, b)) continue;
        /* ⚠️⚠️ THE SOUND IS SET ON THE BEAM CROSSING AND IS THE ONE EXCEPTION
           TO THE RULE IN THIS METHOD'S HEADER -- read them together. Everything
           that CHANGES THE GAME is gated on `hit()` returning true, because the
           i-frames are what stop a held trigger buying a minute of clock. A
           sound changes nothing, and the state it is reporting is not "a hit
           landed", it is "this coin is under fire" -- which is true on every
           frame the beam is on it. Gating it on `hit()` would chop the loop on
           and off several times a second (160ms of i-frames against a 16ms
           frame) while the player holds a steady beam on a coin they can watch
           taking damage. Still Life's shape, kept deliberately. */
        this.coinBeam = true;
        /* ⚠️ THE CLOCK PAYS OUT ONCE, WHEN IT IS DESTROYED -- NOT PER DAMAGE
           TICK. `TaCoin.hit()` returns true on every tick that lands, and a
           coin has `coinHealth` 7 of them: paying per tick handed out 7 x
           `clockAddMs` = 35 SECONDS for one clock, and a held trigger took the
           round's timer from 30s to 97s in twelve seconds of play. Measured, not
           guessed -- it is what the probe run showed. The i-frames rate-limit
           the DAMAGE, which is all they were ever meant to do; they are not a
           payout policy. So the transition is what pays: shootable before the
           hit, not shootable after it. */
        const wasLive = cn.isShootable();
        if (cn.hit(dmg) && wasLive && !cn.isShootable()) {
          this.clockMs += (c.clockAddMs || 0);
        }
        break;
      }
    }
  }

  /** A fly went down: bank the coins and see whether the round is met. */
  _flyDown() {
    const c = this._cfg();
    const got = c.coinsPerFly || 1;
    this.coinsGot += got;
    this.totalCoins += got;
    this.score += got * (c.pointsPerCoin || 0);
    const R = this.round0();
    if (this.coinsGot >= R.coins && this.state === 'play') {
      this.roundsCleared++;
      this.score += (c.pointsPerRound || 0);
      this.lastCard = 'ROUND ' + (this.round + 1);
      this.state = 'card';
      this.stateT = 0;
    }
  }

  /**
   * Does the beam cross this box? ⚠️ COPIED VERBATIM FROM STILL LIFE'S
   * `rayHitsBox`, and it should have been from the start.
   *
   * ⚠️ THE BOXES ARE `{x, y, w, h}` -- NOT `{x0, y0, x1, y1}`. The first version
   * of this was hand-written against the corner form, so every comparison was
   * `undefined > number`, every one was false, and the guard inverted to ALWAYS
   * TRUE: the beam hit every fly and every clock on screen regardless of where
   * the plane was pointing. Nothing errored, because reading a missing property
   * is not an error -- it just quietly makes a boolean say yes.
   *
   * ⚠️ AND IT IS THE ONE PIECE OF THE PORT I RETYPED INSTEAD OF COPYING. Three
   * whole classes came across untouched and behaved; the four-line function I
   * rewrote from memory is the one that broke. **Port the small pieces too** --
   * a box's field names are part of its contract exactly as much as a `dt`'s
   * units are, and this is the third time that lesson has cost a session.
   */
  static _rayHitsBox(ray, t, b) {
    const half = t / 2;
    return (ray.y + half >= b.y) && (ray.y - half <= b.y + b.h)
        && (b.x + b.w >= ray.x) && (b.x <= ray.end);
  }

  /* ------------------------------------------------------------------ render */

  render(ctx) {
    const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
    this._drawPlate(ctx, W, H);
    for (const cn of this.coins) cn.render(ctx, 0, 0, this._coinW());
    for (const f of this.flies) f.render(ctx, 0, 0, W);
    for (const cn of this.coins) cn.renderBurst(ctx, 0, 0, this._coinW());
    if (this.plane) this.plane.render(ctx, W, H, 0);
    if (this.input && this.input.debug) this._drawDebug(ctx, W, H);
    this._drawHud(ctx, W, H);
  }

  /**
   * ⚠️ A VIDEO WITH NO DATA DRAWS NOTHING AND THROWS NOTHING -- the frame simply
   * comes out empty, which is the single hardest video bug in this project to
   * see. `readyState` is the guard, and the black fill behind it means a plate
   * that never loads costs the shot and not the mode.
   */
  _drawPlate(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    /* COVER, not stretch: the plate is 848x478 (1.774) against the canvas's
       1.778, so this is a hair of crop and never a squash -- but it is written
       as cover so a future plate at another aspect cannot distort. */
    const s = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * s, dh = v.videoHeight * s;
    ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  _drawHud(ctx, W, H) {
    const c = this._cfg(), R = this.round0();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.hudColor || '#ffd23f';
    ctx.font = '900 40px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
    /* THE CLOCK, in seconds with one decimal -- a whole-second readout on a
       30-second round makes the last five seconds look frozen. */
    ctx.fillText((this.clockMs / 1000).toFixed(1), W / 2, 46);
    ctx.font = 'bold 24px ' + (CONFIG.hudFont);
    ctx.textAlign = 'left';
    ctx.fillText('ROUND ' + (this.round + 1) + '/' + c.ROUNDS.length, 28, 40);
    /* ⚠️ THE QUOTA IS LABELLED, AND THE BARE NUMBERS WERE A REAL BUG REPORT.
       It read `0 / 8`, which was taken to mean "8 flies exist and you have found
       0" -- *"the time attack has 8 flies, but I only saw 4, I navigated to all
       corners of the stage and didn't see any new flies."* It is a KILL QUOTA:
       round 1 wants 8 kills and keeps `ROUNDS[n].flies` (4) in the air at once,
       topping up as they die. Nothing was missing and nothing had flown off --
       the HUD simply did not say what it was counting. A number on a HUD with no
       noun is a number the player will give a noun to. */
    ctx.textAlign = 'right';
    ctx.fillText((c.quotaLabel || '') + ' ' + this.coinsGot + '/' + R.coins, W - 28, 40);

    if (this.state === 'card' || this.state === 'in' || this.state === 'out') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, H / 2 - 70, W, 140);
      ctx.fillStyle = CONFIG.hudColor || '#ffd23f';
      ctx.font = '900 64px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
      const msg = this.state === 'in' ? 'TIME ATTACK'
                : this.state === 'card' ? (this.lastCard + ' OK')
                : (this.coinsGot >= R.coins ? 'COMPLETO' : 'TEMPO!');
      /* The quota under the opening card, so the goal is stated before the
         round starts rather than inferred from a counter in the corner. */
      if (this.state === 'in') {
        ctx.font = 'bold 26px ' + CONFIG.hudFont;
        ctx.fillText('MATE ' + R.coins + ' ' + (c.quotaLabel || ''), W / 2, H / 2 + 52);
        ctx.font = '900 64px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
      }
      ctx.fillText(msg, W / 2, H / 2);
    }
    ctx.restore();
  }

  /**
   * HOLD C -- Still Life's debug view, ported with it.
   *
   * ⚠️ EVERY BOX HERE COMES FROM THE SAME `boxes()` CALL THE RESOLVER MAKES, and
   * the scanline is the very `ray` object `_shoot()` built -- not a second one
   * derived the same way. An overlay that recomputes what it is inspecting can
   * agree with itself while disagreeing with the game, which is the one thing it
   * exists to rule out. It is also how the beam bug would have been visible in a
   * second: the line was on screen and everything was dying anyway.
   *
   * ⚠️ AND THE NON-GEOMETRIC CONDITIONS ARE DRAWN TOO, dim rather than absent: a
   * fly that is not `isAlive()` and a coin that is not `isShootable()` cannot be
   * hit no matter where the line is, so "why did that not react?" is answered on
   * screen instead of guessed at.
   */
  _drawDebug(ctx, W, H) {
    const c = this._cfg();
    ctx.save();
    ctx.lineWidth = 1;

    /* THE FIELD the flies are held in: `TaFly` bounces them off worldH +/- 40,
       and `spawnTop/BotRel` is where they START. Two different numbers that are
       easy to confuse, so both are drawn. */
    ctx.strokeStyle = 'rgba(83,216,251,0.35)';
    ctx.strokeRect(0, 40, W, H - 80);
    ctx.strokeStyle = 'rgba(83,216,251,0.18)';
    const t = H * (c.spawnTopRel != null ? c.spawnTopRel : 0.14);
    const b = H * (c.spawnBotRel != null ? c.spawnBotRel : 0.86);
    ctx.strokeRect(W * (c.spawnFromRel != null ? c.spawnFromRel : 0.58), t,
                   W * ((c.spawnToRel != null ? c.spawnToRel : 0.98)
                      - (c.spawnFromRel != null ? c.spawnFromRel : 0.58)), b - t);

    for (const f of this.flies) {
      ctx.strokeStyle = f.isAlive() ? '#53d8fb' : 'rgba(83,216,251,0.25)';
      for (const bx of f.boxes(0, 0, W)) ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
    }
    for (const cn of this.coins) {
      ctx.strokeStyle = cn.isShootable() ? '#FAFA24' : 'rgba(250,250,36,0.25)';
      for (const bx of cn.boxes(0, 0, this._coinW())) ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
    }
    if (this.plane && this.plane.hitBox) {
      const pb = this.plane.hitBox(W, H);
      if (pb) { ctx.strokeStyle = '#8ef58e'; ctx.strokeRect(pb.x, pb.y, pb.w, pb.h); }
    }

    /* THE SCANLINE. ⚠️ Drawn at `rayThickness` so what is on screen is the
       actual width the test uses -- a hairline here would say the beam is
       thinner than it is and send someone hunting a miss that never happened. */
    if (this.ray) {
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = c.rayThickness || 14;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(this.ray.x, this.ray.y);
      ctx.lineTo(this.ray.end, this.ray.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const R = this.round0();
    ctx.fillText('state ' + this.state + '  round ' + (this.round + 1) + '/' + c.ROUNDS.length
      + '  quota ' + this.coinsGot + '/' + R.coins + '  clock ' + (this.clockMs / 1000).toFixed(2)
      + '  flies ' + this.flies.length + '/' + R.flies + '  clocks ' + this.coins.length + '/' + R.clocks
      + '  score ' + this.score + '  firing ' + (this.ray ? 'yes' : 'no'), 12, H - 22);
    ctx.restore();
  }
}