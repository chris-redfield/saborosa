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
  /* HOW MANY PHRASES THE ENTRY SHOWS: RODADA nn / DESTRUA n MOSCAS / VAI!.
     ⚠️ ONE PLACE, because the state's length and the draw's index both divide
     the same clock by it -- see `_entryBeatMs`. */
  static ENTRY_BEATS = 3;

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
    /* The clock's punch: the second last drawn, and how long it has been up.
       ⚠️ `-1` rather than 0 so the very first frame of a round counts as a
       change and the clock arrives with the same beat every other second has. */
    this._clockShown = -1;
    this._clockPopT = 0;
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
    /* ⚠️ SHOT DOWN, as opposed to having run the clock out. Both end the mode
       and both lead to the next room -- this only decides which card comes up
       and is the one thing that distinguishes the two endings. */
    this.lost = false;
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

  /**
   * Set a round up: its number, its quota, its clock, and an EMPTY field.
   *
   * ⚠️ IT NO LONGER PUTS ANYTHING IN THE AIR -- `_populate` does, and it is
   * called when the entry card leaves. Asked for 2026-09-11: *"the stage enemies
   * only spawn after the instructions in the middle disappear."* Before this
   * the flies were already circling behind RODADA 01 / DESTRUA 8 MOSCAS / VAI!,
   * which reads as the round having started while the card still says it has
   * not.
   *
   * ⚠️ THE TWO HALVES RUN AT DIFFERENT MOMENTS ON PURPOSE. The quota has to be
   * the NEW round's while `DESTRUA 8 MOSCAS` is on screen, so this half runs
   * before the card; the bodies must not be, so that half runs after it. Fusing
   * them back together puts one of those two things wrong whichever end you
   * pick.
   */
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
  }

  /**
   * How many phrases the entry shows, and how long the whole of it lasts.
   *
   * ⚠️ THE BEAT IS THE KNOB AND THE TOTAL IS DERIVED, NOT THE OTHER WAY ROUND.
   * It was `inMs` (900) split three ways -- 300ms a phrase, too fast to read --
   * and the ask was a FLOOR rather than a total: *"each phrase must be in
   * screen for at least 1 second."* A floor expressed as a total is a floor
   * that quietly stops holding the next time anyone retimes the entry, or adds
   * a fourth phrase. `inBeatMs` is per phrase, so it cannot.
   *
   * ⚠️ `ENTRY_BEATS` IS 3 IN ONE PLACE. The draw picks which phrase to show by
   * dividing the same clock by the same number; two copies of "there are three
   * of them" is how a fourth phrase ends up showing for a third of the time it
   * was given.
   */
  _entryPhrases() {
    const c = this._cfg();
    const E = c.ENTRY;
    if (E && E.length) return E;
    const ms = Math.max(1, (c.inBeatMs != null ? c.inBeatMs : 1100));
    const out = [];
    for (let i = 0; i < TimeAttack.ENTRY_BEATS; i++) out.push({ ms: ms });
    return out;
  }
  _entryMs() {
    let t = 0;
    for (const e of this._entryPhrases()) t += Math.max(1, e.ms || 0);
    return t;
  }
  /** Which phrase is up, and how long it has been up. */
  _entryAt(ms) {
    const P = this._entryPhrases();
    let t = 0;
    for (let i = 0; i < P.length; i++) {
      const d = Math.max(1, P[i].ms || 0);
      if (ms < t + d || i === P.length - 1) return { i, t: ms - t, def: P[i] };
      t += d;
    }
    return { i: 0, t: 0, def: P[0] };
  }

  /* THE PUNCH -- the main game's character-select lock-in, the same numbers
     title.js already ports (pop 1.25 -> 1.0 on an easeOutBack over 400ms, a
     9px shake decaying over 180ms at 82/71 rad/s). Reproduced here rather than
     reached for across files because `Title` holds it against ITS clock; what
     is shared is the FEEL, and the feel is the numbers. */
  static _easeOutBack(p) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }
  _punchAt(ms, block) {
    const P = (this._cfg().LETTER || {})[block || 'PUNCH'];
    if (!P || P.on === false) return { k: 1, x: 0, y: 0 };
    const sm = P.stampMs != null ? P.stampMs : 400;
    const k = sm > 0
      ? 1 + (P.pop != null ? P.pop : 0.25)
            * (1 - TimeAttack._easeOutBack(Math.min(1, ms / sm)))
      : 1;
    const shMs = P.shakeMs != null ? P.shakeMs : 180;
    const amp = (P.shakeAmp != null ? P.shakeAmp : 9)
              * Math.max(0, 1 - ms / Math.max(1, shMs));
    /* SECONDS, because the frequencies are the main game's rad/sec numbers and
       are copied unchanged. */
    const t = ms / 1000;
    return { k,
             x: amp > 0.01 ? Math.sin(t * (P.shakeFreqX != null ? P.shakeFreqX : 82)) * amp : 0,
             y: amp > 0.01 ? Math.cos(t * (P.shakeFreqY != null ? P.shakeFreqY : 71)) * amp : 0 };
  }

  /** Fill the field for the current round. Called as the entry card leaves. */
  _populate() {
    const c = this._cfg(), R = this.round0();
    /* Cleared first, so a second call cannot double the field -- `in` is
       entered from two places and this is the one thing in it that is not
       idempotent by itself. */
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
      /* ⚠️ THE FIELD IS FILLED HERE, ON THE FRAME THE CARD LEAVES -- see
         `_populate`. *"The stage enemies only spawn after the instructions in
         the middle disappear."* */
      if (this.stateT >= this._entryMs()) {
        this.state = 'play'; this.stateT = 0; this._populate();
      }
    } else if (this.state === 'card') {
      if (this.stateT >= (c.roundCardMs || 0)) {
        this.stateT = 0;
        /* ⚠️ THE NEXT ROUND GETS ITS OWN THREE-BEAT ENTRY, which is why this
           hands to `in` rather than straight to `play`. *"When entering, it
           will be RODADA 01, or 02, or 03"* -- the number is the ROUND, so
           every round is entered the same way and not just the first.
           `_spawnRound` runs BEFORE the card so `R.coins` is the new round's
           quota while DESTRUA is on screen; the clock does not tick outside
           `play`, so holding here costs the player nothing. */
        if (this.round + 1 < c.ROUNDS.length) {
          this._spawnRound(this.round + 1);
          this.state = 'in';
        }
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
    /* ⚠️ THE CLOCK'S PUNCH IS FIRED BY THE TICK, NOT DERIVED FROM `clockMs`.
       The displayed second is `ceil(clockMs / 1000)`, so "how long since it
       changed" is `1000 - clockMs % 1000` -- one line, and wrong in three
       places: it is frozen with the clock during a card (a pop stuck half
       swollen), it reads 0 for every frame the clock sits at 0, and a round
       reset lands mid-curve. Watching the VALUE change and zeroing a clock of
       its own has none of that, and it is the same rule the impact burst and
       the game over word follow -- freeze the effect on the EVENT. */
    const shown = Math.ceil(this.clockMs / 1000);
    if (shown !== this._clockShown) { this._clockShown = shown; this._clockPopT = 0; }
    else this._clockPopT += dt;

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

    /* ⚠️⚠️ THE FLIES HURT (2026-09-09). Ported from Still Life's swarm block,
       which is the same test against the same two shapes.

       ⚠️ GATED ON `live` AS WELL AS ON `controlLocked`. Still Life only has the
       second, because it has no round cards -- here the plane keeps flying
       through every card while `_shoot()` does not run, so without `live` a
       player would be taking damage during a beat they cannot shoot back in.
       `controlLocked` covers the other two: the fly-in, and a plane already on
       its way down.

       ⚠️ THE LABELLED BREAK IS LOAD-BEARING, and it is Still Life's. Once a
       touch has landed there is nothing left to find this frame: continuing
       would only ask `hurt()` to say false for every other fly, and it keeps
       the semantics honest -- **a frame in which three flies overlap the plane
       is ONE hit, not three.** The i-frames would mask it either way; this
       states it rather than relying on them.

       ⚠️ `isAlive()`, not merely "in the list": a fly that has burst is still
       in `flies` until the cull below, and without this its corpse would go on
       hitting. */
    if (live && this.plane && !this.plane.controlLocked) {
      const pb = this.plane.hitBox(W, H);
      if (pb) {
        swarm:
        for (const f of this.flies) {
          if (!f.isAlive()) continue;
          for (const b of f.boxes(0, 0, W)) {
            if (!TimeAttack._boxesOverlap(pb, b)) continue;
            if (this.plane.hurt(c.flyTouchDamage == null ? 1 : c.flyTouchDamage)
                && this.sound) {
              /* THE MAIN GAME'S OWN VOICES, not new files: he makes the same
                 noise being hit here as he does on the street, and the same one
                 on the way out. `isDead()` picks which -- two vocal samples
                 from one body in one frame is a mess, so the death REPLACES the
                 hit rather than layering, exactly as the fighting does.

                 ⚠️ THE HIT GRUNT IS OFF IN THIS MODE (2026-09-11): *"remove the
                 SFX from when he takes a hit, ONLY AT THE TIME ATTACK."*
                 `hitVoice: false` is the mode's own knob, so the street and the
                 desert are untouched -- the sample is shared and deleting the
                 call would have silenced every punch the player takes in the
                 whole game.

                 ⚠️ THE DEATH VOICE STAYS. The ask names the hit; being shot
                 down is a different event, it happens once, and it is the only
                 thing left announcing the end of a run out loud. If that should
                 go too it is the same flag with a second name. */
              const dead = this.plane.isDead();
              if (dead) this.sound.play('playerDeath');
              else if (c.hitVoice !== false) this.sound.play('playerHit');
            }
            break swarm;
          }
        }
      }
    }

    /* SHOT DOWN. ⚠️ A SEPARATE STATE, NOT STRAIGHT TO `out`, because the plane
       has to be SEEN to fall: `hurt()` starts the tumble on the fatal hit and
       `ta-plane.js` flies it out of frame on real time. `down` stops the clock
       and the shooting (it is not `live`) while everything else keeps running.
       ⚠️ `fallDone()` carries its own `planeFallMaxMs` safety net, so this
       cannot hang on a mistuned gravity. */
    if (this.state === 'play' && this.plane && this.plane.isDead()) {
      this.state = 'down';
      this.stateT = 0;
      this.lost = true;
    }
    if (this.state === 'down' && this.plane && this.plane.fallDone(H)) {
      this.state = 'out';
      this.stateT = 0;
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
  /* ⚠️ COPIED VERBATIM FROM STILL LIFE'S `boxesOverlap`, and the four-line
     size of it is exactly why. The one function on this port I retyped from
     memory instead of copying was `rayHitsBox`, which read `{x0,y0,x1,y1}`
     against boxes that are `{x,y,w,h}` -- every comparison was
     `undefined > number`, and the beam hit everything on screen for a session.
     A missing property is not an error; it quietly makes a boolean say yes. */
  static _boxesOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x
        && a.y < b.y + b.h && a.y + a.h > b.y;
  }

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


  /* =======================================================================
     THE HAND-DRAWN LETTERING (2026-09-11)
     =======================================================================
     Everything this mode puts on screen was TYPE until the artist's sheet
     arrived (`batidao-letter-timeattack-001.png`, cut by
     tools/build-timeattack-words.py). *"Can you replace the current lettering
     (generated) by this one (drawed)?"*

     ⚠️ THE NUMBERS ARE WHOLE TILES, NOT ASSEMBLED DIGITS, and that is the
     sheet's own design: `47` is one drawing, which is why 10..100 were drawn at
     all. Stated by the user: *"these small numbers should be used for 2 things:
     1 the clock and 2 the number of flies that were killed."* ⚠️ THE BIG digits
     ARE assembled -- the sheet carries only 0..9 of them -- and they are what
     goes in a card's number hole.

     ⚠️ THE CLOCK LOST ITS TENTH WITH THIS. It read `29.4`; there is no decimal
     point in the pack and the whole-number tiles are what the clock is for. The
     old comment argued a whole-second readout makes the last five seconds look
     frozen -- that was a decision about TYPE and it is overruled by the art.

     ⚠️ EVERY DRAW FALLS BACK TO TYPE. A pack that fails to load must cost the
     lettering's look and not the readout -- the same rule the pause card, the
     game over panel and the GO prompt follow. `_tw()` returning null is the
     cue, and every call site has a typed branch behind it. */
  _tw() {
    const c = this._cfg();
    const L = c && c.LETTER;
    if (!L || L.on === false) return null;
    const img = this.assets.getDrawable('taWords');
    const defs = this.assets.getJSON('taWords');
    return (img && defs && defs.frames) ? { img, defs, k: (L.scale || 0.52) } : null;
  }

  /** One frame, centred on (cx, cy). Returns its drawn width, or 0. */
  /* ⚠️ `mul` IS THE ONE DEVIATION FROM "ONE SCALE PER PACK", AND IT IS A
     REQUEST. *"Make the countdown number 10% larger."* Everything else in the
     pack is drawn at `LETTER.scale` and keeps the relationships the artist
     drew; the clock alone takes `LETTER.clockMul` on top, because it is the one
     readout that has to be findable at a glance while the plane is being flown.
     Leave it at 1 for anything else. */
  _wDraw(ctx, W, key, cx, cy, mul) {
    const f = W.defs.frames[key];
    if (!f) return 0;
    const k = W.k * (mul == null ? 1 : mul);
    ctx.drawImage(W.img, f.x, f.y, f.w, f.h,
                  cx - f.w * k / 2, cy - f.h * k / 2, f.w * k, f.h * k);
    return f.w * k;
  }

  _wWide(W, key) {
    const f = W.defs.frames[key];
    return f ? f.w * W.k : 0;
  }

  /** A whole number 0..100 as ONE tile. Out of range clamps -- see the header. */
  _wNumW(W, n) {
    return this._wWide(W, 'n' + Math.max(0, Math.min(100, Math.round(n))));
  }
  _wNum(ctx, W, n, cx, cy, mul) {
    return this._wDraw(ctx, W, 'n' + Math.max(0, Math.min(100, Math.round(n))),
                       cx, cy, mul);
  }

  /** A number in the CARD digits, assembled, optionally zero-padded. */
  _wBigW(W, n, pad, mul) {
    const t = String(Math.max(0, Math.round(n)));
    const str = (pad && t.length < pad) ? ('0'.repeat(pad - t.length) + t) : t;
    const m = mul == null ? 1 : mul;
    const gap = ((this._cfg().LETTER || {}).digitGapPx || 6) * m;
    let w = 0;
    for (let i = 0; i < str.length; i++) w += this._wWide(W, 'b' + str[i]) * m + (i ? gap : 0);
    return w;
  }
  _wBig(ctx, W, n, cx, cy, pad, mul) {
    const t = String(Math.max(0, Math.round(n)));
    const str = (pad && t.length < pad) ? ('0'.repeat(pad - t.length) + t) : t;
    const m = mul == null ? 1 : mul;
    const gap = ((this._cfg().LETTER || {}).digitGapPx || 6) * m;
    /* ⚠️ THE POP SWELLS THE NUMBER ABOUT ITS OWN CENTRE, so the run is measured
       AT the popped size and laid out from there -- measuring at 1.0 and drawing
       at 1.25 would grow it rightwards out of the hole instead of in place. */
    let x = cx - this._wBigW(W, n, pad, m) / 2;
    for (let i = 0; i < str.length; i++) {
      const w = this._wWide(W, 'b' + str[i]) * m;
      this._wDraw(ctx, W, 'b' + str[i], x + w / 2, cy, m);
      x += w + gap;
    }
  }

  /**
   * A card phrase with a number in its hole: `RODADA 01`, `DESTRUA 8 MOSCAS`.
   *
   * ⚠️ THE GAPS EITHER SIDE ARE THE ARTIST'S, READ OUT OF THE DEFS. The cutter
   * measured where the XX sat and how much air was around it, so the number
   * lands at the spacing it was drawn with instead of at a margin someone
   * guessed. ⚠️ The number is CENTRED in the hole rather than filling it: the
   * hole is two X's wide and a one-digit round would otherwise sit against the
   * word on its left.
   */
  _wHole(ctx, W, name, n, cx, cy, pad, o) {
    const h = (W.defs.holes || {})[name];
    const lw = this._wWide(W, name + 'L');
    if (!h || !lw) return;
    const opt = o || {};
    const k = W.k;
    /* ⚠️ `holePadMul` TIGHTENS THE WORDS WITHOUT TOUCHING THE ART'S MEASUREMENT.
       *"DESTRUA XX MOSCAS, bring the words slightly closer to each other."* The
       gaps either side of the number hole are what the cutter measured off the
       sheet; this scales them, so the drawn spacing stays the base and the
       change is one number. ⚠️ It does NOT touch `holeW` -- the hole is the
       number's own space, and shrinking it would crowd a two-digit round
       instead of closing the word gaps. */
    const LC = this._cfg().LETTER || {};
    const pm = LC.holePadMul;
    const mul = pm != null ? pm : 1;
    /* ⚠️ THE HOLE SHRINKS TO THE NUMBER, AND THAT IS WHERE THE GAP ACTUALLY WAS.
       The drawn hole is `XX` wide -- 138px on screen, which is exactly a
       TWO-digit number -- so a one-digit quota sat in it with 35px of empty
       hole on each side, against only 12px of word pad. Tightening `holePadMul`
       alone could never close that: *"the words in this phrase are too far away
       from each other"* was 3/4 hole and 1/4 pad.

       So the hole is the NUMBER plus `holeAirPx` a side, and `holeW` from the
       defs is no longer the layout -- it is the reference the cutter measured.
       ⚠️ NO CAP AT THE DRAWN WIDTH, and that was a second pass: capping there
       gave a two-digit quota 12px of air and a one-digit quota 22px, because
       `XX` happens to be exactly as wide as `22`. The X is a PLACEHOLDER, not a
       specification -- what the artist drew is "a number goes here", and every
       number reading the same is the honest version of that. The phrase is now
       as wide as its own contents, which is how a line of text behaves.
       ⚠️ Measured at the number's RESTING width, so the punch's 25% overshoot
       spends this air rather than a permanent gap being left to fit a moment. */
    const air = (LC.holeAirPx != null ? LC.holeAirPx : 0) * 2;
    const hole = this._wBigW(W, n, pad) + air;
    const padL = h.padL * k * mul, padR = (h.padR || 0) * k * mul;
    const rw = this._wWide(W, name + 'R');
    /* ⚠️ THE HOLE IS RESERVED WHETHER OR NOT THE NUMBER IS DRAWN, which is what
       lets the number arrive late without the words jumping. `hideNum` is the
       half-second before it lands -- see the entry. */
    const total = lw + padL + hole + (rw ? padR + rw : 0);
    let x = cx - total / 2;
    this._wDraw(ctx, W, name + 'L', x + lw / 2, cy);
    x += lw + padL;
    if (!opt.hideNum) {
      const p = opt.punch;
      this._wBig(ctx, W, n, x + hole / 2 + (p ? p.x : 0), cy + (p ? p.y : 0), pad,
                 p ? p.k : 1);
    }
    x += hole;
    if (rw) this._wDraw(ctx, W, name + 'R', x + padR + rw / 2, cy);
  }

  /** `RODADA 1/3` or `MOSCAS 4/8`, as one drawn run. Returns its width. */
  _wCount(ctx, W, label, a, b, leftX, cy, measure) {
    const gap = (this._cfg().LETTER || {}).wordGapPx || 10;
    const lw = this._wWide(W, label);
    const aw = this._wNumW(W, a), sw = this._wWide(W, 'slash'), bw = this._wNumW(W, b);
    const total = lw + gap + aw + sw + bw + gap * 0.4;
    if (measure) return total;
    let x = leftX;
    this._wDraw(ctx, W, label, x + lw / 2, cy); x += lw + gap;
    this._wNum(ctx, W, a, x + aw / 2, cy);      x += aw;
    this._wDraw(ctx, W, 'slash', x + sw / 2, cy); x += sw;
    this._wNum(ctx, W, b, x + bw / 2, cy);
    return total;
  }

  _drawHud(ctx, W, H) {
    const c = this._cfg(), R = this.round0();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.hudColor || '#ffd23f';
    const TW = this._tw();
    /* THE CLOCK, IN WHOLE SECONDS since the drawn numbers arrived -- see the
       block above `_tw`. It used to carry a tenth, on the argument that a
       whole-second readout makes the last five seconds look frozen; the pack
       has no decimal point and the 0..100 tiles are what the clock is for. */
    if (TW) {
      /* ⚠️ THE SAME PUNCH THE NUMBER IN DESTRUA GETS, ON ITS OWN BLOCK -- asked
         for 2026-09-11: *"add punch also when changing the clock countdown."*
         `CLOCK_PUNCH` is separate because the INTERVAL is: this fires once a
         second for thirty seconds, where the other fires once a round. Same
         curve, shorter and smaller, so it has settled before the next tick
         instead of the clock permanently vibrating. `PUNCH`'s numbers are one
         copy away if it should be identical. */
      const cp = this._punchAt(this._clockPopT, 'CLOCK_PUNCH');
      this._wNum(ctx, TW, Math.ceil(this.clockMs / 1000),
                 W / 2 + cp.x, 46 + cp.y,
                 ((c.LETTER && c.LETTER.clockMul) || 1) * cp.k);
    }
    else {
      ctx.font = '900 40px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
      ctx.fillText((this.clockMs / 1000).toFixed(1), W / 2, 46);
    }
    if (TW) this._wCount(ctx, TW, 'rodada', this.round + 1, c.ROUNDS.length, 28, 40);
    else {
      ctx.font = 'bold 24px ' + (CONFIG.hudFont);
      ctx.textAlign = 'left';
      ctx.fillText('ROUND ' + (this.round + 1) + '/' + c.ROUNDS.length, 28, 40);
    }
    /* ⚠️ THE QUOTA IS LABELLED, AND THE BARE NUMBERS WERE A REAL BUG REPORT.
       It read `0 / 8`, which was taken to mean "8 flies exist and you have found
       0" -- *"the time attack has 8 flies, but I only saw 4, I navigated to all
       corners of the stage and didn't see any new flies."* It is a KILL QUOTA:
       round 1 wants 8 kills and keeps `ROUNDS[n].flies` (4) in the air at once,
       topping up as they die. Nothing was missing and nothing had flown off --
       the HUD simply did not say what it was counting. A number on a HUD with no
       noun is a number the player will give a noun to. */
    if (TW) {
      /* ⚠️ MEASURED, THEN DRAWN FROM THE LEFT. The run is right-ALIGNED and it
         is built left to right, so its width has to be known before the first
         tile lands -- and the width depends on which number tiles are picked
         (`100` is twice as wide as `7`). `measure` is the same code path that
         draws it, not a second estimate of it. */
      const w = this._wCount(ctx, TW, 'moscas', this.coinsGot, R.coins, 0, 40, true);
      this._wCount(ctx, TW, 'moscas', this.coinsGot, R.coins, W - 28 - w, 40);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText((c.quotaLabel || '') + ' ' + this.coinsGot + '/' + R.coins, W - 28, 40);
    }

    /* ⚠️ THE HEALTH, AND IT IS NOT OPTIONAL POLISH. The plane took damage
       silently before this: `planeWearSheets` is false, so there is no
       deteriorated art to read the state off -- Still Life shows its damage by
       drawing an older plane, and that is the channel this game does not have.
       The blink and the flinch say a hit LANDED; nothing said how many were
       left. Four hidden hit points is not a difficulty setting, it is a
       surprise.

       ⚠️ DRAWN FROM `plane.hp()`, the same call `isDead()` is derived from, so
       the row cannot disagree with the fight -- an empty row and a falling
       plane are the same frame by construction. Spent pips are dimmed rather
       than dropped, so the total stays readable and the row does not resize as
       it empties. */
    if (this.plane && (c.planeHealth || 0) > 0) {
      const hp = this.plane.hp(), max = c.planeHealth;
      const r = 7, gap = 21;
      for (let i = 0; i < max; i++) {
        ctx.beginPath();
        ctx.arc(35 + i * gap, 68, r, 0, Math.PI * 2);
        ctx.globalAlpha = i < hp ? 1 : 0.28;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (this.state === 'card' || this.state === 'in' || this.state === 'out') {
      ctx.textAlign = 'center';
      /* ⚠️ NO STRIP BEHIND THE CARD. There used to be a `rgba(0,0,0,0.45)` band
         across the middle of the screen, drawn to keep 64px of type legible over
         a moving photograph. The lettering is a drawing now -- it carries its
         own black outline and does not need a plate under it -- and the strip
         was cutting the shot in half. Removed on request 2026-09-11.
         ⚠️ THE TYPED FALLBACK LOST IT TOO, deliberately: two answers to "is
         there a strip" is how a screen ends up looking different on the machine
         whose download failed. If type over the plate turns out to be
         unreadable, the fix is a shadow on the text, not the band back. */
      ctx.fillStyle = CONFIG.hudColor || '#ffd23f';
      if (TW) {
        const cy = H / 2;
        if (this.state === 'in') {
          /* ⚠️ THE ENTRY IS THREE BEATS IN ONE STRIP, and that is the shape the
             user described: *"when entering, it will be RODADA 01, or 02, or
             03. Then 'destrua X moscas', then 'vai!' in the same text strip."*
             One place on screen, three things in turn -- not three lines
             stacked. `inBeatMs` is per PHRASE and the total is derived from
             it, so "each one holds at least a second" is true by construction
             rather than by arithmetic somebody has to redo -- see `_entryMs`.

             ⚠️ AND IT RUNS BEFORE EVERY ROUND, NOT ONCE. `01 / 02 / 03` is the
             ROUND number, so rounds 2 and 3 get the same three beats -- see the
             `card` branch in `update`, which now hands to `in` instead of
             straight to `play`. */
          /* ⚠️ THE PHRASES HAVE THEIR OWN LENGTHS NOW, not one shared beat.
             `DESTRUA` runs 1.5s against the other two at 1.1 -- see
             `CONFIG.TIME_ATTACK.ENTRY`. `_entryAt` returns which one is up and
             how long it has been up, so the draw never counts the beats itself. */
          const at = this._entryAt(this.stateT);
          if (at.i === 0) this._wHole(ctx, TW, 'round', this.round + 1, W / 2, cy, 2);
          else if (at.i === 1) {
            /* ⚠️ THE PHRASE LANDS FIRST AND THE NUMBER ARRIVES INTO IT, which is
               the emphasis that was asked for: *"it appears without a number
               during half a second, then the number appears and stays 1 second
               ... when the number appears, it appears with a punch effect."*
               The hole is reserved for the whole 1.5s, so the words do not shift
               when it lands -- a line that re-centres itself mid-read is the
               opposite of emphasis. */
            const numAt = at.def.numAtMs != null ? at.def.numAtMs : 0;
            const hide = at.t < numAt;
            this._wHole(ctx, TW, 'destrua', R.coins, W / 2, cy, 0,
                        { hideNum: hide,
                          punch: hide ? null : this._punchAt(at.t - numAt) });
          }
          else this._wDraw(ctx, TW, 'vai', W / 2, cy);
        } else if (this.state === 'card') {
          this._wHole(ctx, TW, 'roundOk', this.round + 1, W / 2, cy, 2);
        } else if (this.lost) {
          /* ⚠️ THE ONE TYPED LINE LEFT IN THE MODE. There is no ABATIDO band in
             the sheet, and sharing TEMPO ESGOTADO would tell the player the
             wrong thing about why they lost. Flagged rather than faked; it is
             one band away from being drawn like everything else. */
          ctx.font = '900 64px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
          ctx.fillText('ABATIDO!', W / 2, cy);
        } else if (this.coinsGot >= R.coins) {
          this._wDraw(ctx, TW, 'completo', W / 2, cy);
        } else {
          this._wDraw(ctx, TW, 'tempo', W / 2, cy);
        }
        ctx.restore();
        return;
      }
      ctx.font = '900 64px ' + (CONFIG.TITLE_FONT || CONFIG.hudFont);
      const msg = this.state === 'in' ? 'TIME ATTACK'
                : this.state === 'card' ? (this.lastCard + ' OK')
                /* ⚠️ THREE ENDINGS NOW, NOT TWO. `lost` is checked FIRST
                   because a plane shot down on the very shot that met the quota
                   is still a plane that was shot down -- and without the order
                   being stated, that frame would read COMPLETO over a wreck. */
                : this.lost ? 'ABATIDO!'
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