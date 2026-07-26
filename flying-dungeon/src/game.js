/**
 * game.js — the standalone SHELL (the disposable layer).
 *
 * Owns the canvas, the rAF loop, asset-loading progress, and wires input →
 * Plane / TrayBackground → draw. When integrating into the main Saborosa game,
 * THIS file is what you throw away: the main engine already provides a canvas,
 * a loop, an asset store, and input, so it plays this role. You keep
 * config.js + plane.js + tray-background.js.
 */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const bar = document.getElementById('bar');

  // Fixed internal resolution (like the main game); CSS-scale to fit the window
  // with letterboxing so the aspect never distorts.
  canvas.width = CONFIG.GAME_W;
  canvas.height = CONFIG.GAME_H;
  // Same rule as the main game's scaleCanvas(): fit the window with a 40px
  // margin, but never upscale past native 1:1.
  function fit() {
    const s = Math.min((window.innerWidth - 40) / CONFIG.GAME_W,
                       (window.innerHeight - 40) / CONFIG.GAME_H, 1);
    canvas.style.width = (CONFIG.GAME_W * s) + 'px';
    canvas.style.height = (CONFIG.GAME_H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // Live toggle: ballistic (inherits the fly's velocity) vs straight-down drop.
  // blur() after changing so SPACE keeps firing the gun instead of re-toggling
  // the focused checkbox.
  const ballisticEl = document.getElementById('ballistic');
  if (ballisticEl) {
    ballisticEl.checked = CONFIG.corpseBallistic;
    ballisticEl.addEventListener('change', () => {
      CONFIG.corpseBallistic = ballisticEl.checked;
      ballisticEl.blur();
    });
  }

  // Stop-motion plane: on/off + the framerate to hop at (steppedMs = 1000/fps).
  const steppedEl = document.getElementById('stepped');
  if (steppedEl) {
    steppedEl.checked = CONFIG.stepped;
    steppedEl.addEventListener('change', () => { CONFIG.stepped = steppedEl.checked; steppedEl.blur(); });
  }
  const filmEl = document.getElementById('film');
  if (filmEl) {
    filmEl.checked = CONFIG.film;
    filmEl.addEventListener('change', () => { CONFIG.film = filmEl.checked; applyFilmCss(); filmEl.blur(); });
  }

  // How much clock a single hit on a coin gives back. Shown in SECONDS because
  // that is the unit on the HUD it moves; stored in ms like everything else.
  // blur() after each edit so SPACE goes back to firing the gun instead of
  // nudging the field that still has focus.
  const rewindEl = document.getElementById('coinRewind');
  if (rewindEl) {
    rewindEl.value = CONFIG.coinRewindMs / 1000;
    const applyRewind = () => {
      const v = parseFloat(String(rewindEl.value).replace(',', '.'));
      if (isFinite(v)) CONFIG.coinRewindMs = Math.max(0, v) * 1000;
      rewindEl.value = CONFIG.coinRewindMs / 1000;
    };
    rewindEl.addEventListener('change', applyRewind);
    rewindEl.addEventListener('keydown', e => {
      e.stopPropagation();                       // don't fire hotkeys while typing
      if (e.key === 'Enter') { applyRewind(); rewindEl.blur(); }
    });
  }

  /* How much a single connected shot takes off. Live, so the fights can be
     dialled while playing rather than rebuilt — the same reason coinRewindMs is
     up here, and the same shape.

     It reaches everything shootable at once: flies, coins, both bosses. Nothing
     caches it, so a change applies on the very next frame.

     ⚠️ Raising it does NOT speed a fight up in proportion, and that surprises
     people. Every health bar in the game is gated by an i-frame window, so time
     to kill is (health / damage) × hurtMs — damage buys you FEWER hits, not
     faster ones. Past health/1 the fight is one hit however high it goes.
     Integer-only for the same reason: fractional damage just moves where the
     rounding lands in that division. */
  const dmgEl = document.getElementById('rayDamage');
  if (dmgEl) {
    dmgEl.value = CONFIG.rayDamage;
    const applyDmg = () => {
      const v = parseFloat(String(dmgEl.value).replace(',', '.'));
      if (isFinite(v)) CONFIG.rayDamage = Math.max(1, Math.round(v));
      dmgEl.value = CONFIG.rayDamage;
    };
    dmgEl.addEventListener('change', applyDmg);
    dmgEl.addEventListener('keydown', e => {
      e.stopPropagation();                       // don't fire hotkeys while typing
      if (e.key === 'Enter') { applyDmg(); dmgEl.blur(); }
    });
  }

  const fpsEl = document.getElementById('steppedFps');
  const fpsVal = document.getElementById('steppedFpsVal');
  if (fpsEl) {
    const setLabel = () => { if (fpsVal) fpsVal.textContent = fpsEl.value; };
    fpsEl.value = Math.round(1000 / CONFIG.steppedMs);
    setLabel();
    fpsEl.addEventListener('input', () => {
      CONFIG.steppedMs = 1000 / parseFloat(fpsEl.value);
      setLabel();
      fpsEl.blur();
    });
  }

  const assets = new Assets();
  const input = new Input();
  // Not a `let`: unlike everything a RUN owns, the music is not rebuilt on
  // restart — it holds the decoded track, and throwing that away to re-fetch it
  // between runs would be the one thing this game cannot afford, for exactly
  // the reason a page reload is avoided below.
  const sound = new Sound(CONFIG);
  const bg = new TrayBackground(assets, CONFIG);
  // Everything a RUN owns is `let`, not `const`: restarting rebuilds these
  // rather than reaching into each one to undo its state. All of their
  // per-run state is set in their constructors and none of them own their
  // images — those live in the shared `assets` store — so construction IS the
  // reset, and it needs no reload. That matters: a page reload would re-decode
  // ~30MB of tray frames, which is the one thing this game cannot afford.
  let plane = new Plane(assets, CONFIG);
  const enemies = [];
  // Coins are their own list, not enemies: the hitscan beam iterates `enemies`,
  // and a coin is not something you shoot.
  const coins = [];
  const film = new Film(CONFIG);
  const hud = new Hud(CONFIG);
  // Deliberately NOT part of the Hud: the whole HUD is hidden in no-time mode,
  // which is exactly when the boss fight happens. See boss-bar.js.
  const bossBar = new BossBar(assets, CONFIG);
  const clock = new GameClock(CONFIG);
  const gameOver = new GameOver(assets, CONFIG);
  // What beating the Time Boss gives you. `let`, like everything a run owns.
  let finale = new Finale(assets, CONFIG);
  // Set the moment the clock runs out: {t} = ms since then, driving fade-out →
  // hold on black → fade-in of the TIME OVER panel. Null while the run is live.
  let ending = null;
  // ms left of the tray orbiting backwards. Topped up by every coin hit, so it
  // tracks the ACT of rewinding rather than the clock's sign — the world runs
  // backwards while you are pulling time back, whatever the clock reads.
  let rewindSpinT = 0;
  // The Time Boss. Null until the run clock has been driven down to bossAtMs;
  // once it arrives it stays until it is killed.
  let boss = null;
  // What he throws. Their own list, like the coins: they are not `enemies` (the
  // beam must not be able to shoot them down) and not scenery either.
  const orbs = [];
  // ⚠️ Latched by killing him, and it exists to stop him coming BACK. Victory
  // resumes the clock at ≤ bossAtMs — which is still below the threshold that
  // summons him — so without this the very next frame would re-enter no-time
  // mode and spawn a second boss on top of the win.
  let bossBeaten = false;
  // The Mosca Boss. Null until the last fly is dead; `flyBossDone` latches so
  // that killing a SECOND swarm — the flies come back if the Time Boss is
  // beaten — cannot summon it a second time.
  let flyBoss = null;
  let flyBossDone = false;
  // WHICH boss killed the player, because they get different endings: the Time
  // Boss ages you and the world goes white (THE END), the Mosca Boss knocks you
  // out of the sky and it is the black TIME OVER panel. Set at the moment a hit
  // actually lands, so the last one to connect is the one that gets the credit.
  let killedBy = null;
  // NO TIME MODE. Latched when the clock reaches bossAtMs: the timer goes away,
  // the flies and coins go with it, and what is left is the player, the boss,
  // and a white void. Time has stopped mattering.
  let noTime = false;
  let fruitSelect = new FruitSelect(assets, CONFIG);
  let liftoff = new Liftoff(assets, CONFIG);
  let intro = new Intro(assets, CONFIG, fruitSelect, liftoff);

  // The help / toggles belong to the game, not the title sequence. (The HUD
  // itself is canvas-drawn now and simply isn't rendered during the intro.)
  const chrome = ['help', 'controls'].map(id => document.getElementById(id));
  const showChrome = on => chrome.forEach(el => { if (el) el.style.display = on ? '' : 'none'; });
  showChrome(false);

  // Black & white via a GPU-cheap CSS filter on the canvas; keep it in sync.
  const applyFilmCss = () => { canvas.style.filter = CONFIG.film ? CONFIG.filmCss : ''; };
  applyFilmCss();

  // Loading progress across every asset the subsystems pull in (+1 for the fly).
  const COIN_KEYS = Object.keys(CONFIG.COIN_SHEETS);
  const TOTAL = CONFIG.FRAMES * 2
    + Plane.assetCount(CONFIG)   // poses × characters × wear packs, + the flash
    + 7 + CONFIG.MOSCA_SHEETS.length   // fly, dead fly, boom, boss, orb, bar, logo, + mosca
    + COIN_KEYS.length;          // + one grid sheet per coin variant
  let done = 0;
  const tick = () => { done++; bar.style.width = (done / TOTAL * 100) + '%'; };

  // Horizontal hitscan segment (from ray.x to ray.end at ray.y, `t` px thick)
  // against an axis-aligned box.
  function rayHitsBox(ray, t, b) {
    const half = t / 2;
    return (ray.y + half >= b.y) && (ray.y - half <= b.y + b.h)
        && (b.x + b.w >= ray.x) && (b.x <= ray.end);
  }

  // Plain AABB overlap — what an orb hitting the plane comes down to. Both are
  // already in SCREEN space by the time this is called: the plane lives there,
  // and the orb's boxes() has done the camera subtraction.
  function boxesOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x
        && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  let last = performance.now();
  let phase = 'boot';       // 'boot' (black) → 'intro' → 'game'
  let gameReady = false;

  // Skip the title sequence on any key or click. Bound only while it plays.
  // Before this timestamp, skips are ignored — see restart().
  let skipArmAt = 0;
  function onSkip(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
    // M is the mute key, not "any key". Muting the game should never also blow
    // past the title sequence — the two are unrelated and one of them is
    // irreversible from the player's point of view.
    if (e.code === 'KeyM') return;
    if (performance.now() < skipArmAt) return;
    // While the fruit select is up, keys are the player choosing — not skipping.
    if (intro.awaitingInput) return;
    intro.skip();
  }
  // Tracked as well as bound: a gamepad fires no DOM events, so the pad path
  // has to be able to ask whether skipping is live rather than relying on a
  // listener being attached.
  let skipBound = false;
  function bindSkip(on) {
    const m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('keydown', onSkip);
    window[m]('mousedown', onSkip);
    skipBound = on;
  }

  // "Any button" on the TIME OVER panel starts over. Bound only once the panel
  // has finished arriving (see the loop) so a key pressed during the fade — or
  // still held from the dying moments of the run — can't skip past the screen
  // the player is meant to read.
  let restartArmed = false;
  function onRestart(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
    if (e.code === 'KeyM') return;      // mute, not "any key" — same as onSkip
    restart();
  }
  function bindRestart(on) {
    if (on === restartArmed) return;
    const m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('keydown', onRestart);
    window[m]('mousedown', onRestart);
    restartArmed = on;
  }

  // Fill the world with flies and coins. Called once when the assets land, and
  // again on every restart — it CLEARS first, so a restart doesn't stack a
  // second swarm on top of the leftovers of the last run.
  // Scatter the flies at random WORLD positions (they wrap on X, so anywhere
  // across the width is fair game). Killed flies are gone for good — and with
  // flyCount at 3, killing all of them is what summons the Mosca Boss.
  function spawnFlies() {
    enemies.length = 0;
    const worldW = bg.worldWidth(), worldH = bg.worldHeight();
    for (let i = 0; i < CONFIG.flyCount; i++) {
      enemies.push(new Fly(assets, CONFIG,
        Math.random() * worldW,
        80 + Math.random() * Math.max(1, worldH - 160)));
    }
  }

  function spawnWorld() {
    spawnFlies();
    coins.length = 0;
    const worldW = bg.worldWidth(), worldH = bg.worldHeight();
    // Coins: scattered the same way. Variants are dealt round-robin rather than
    // rolled per coin, so that if more than one is ever configured again they
    // are evenly represented instead of randomly lopsided. With the single
    // upright spin configured today this just hands every coin that one.
    const top = CONFIG.coinBandTop * worldH;
    const span = Math.max(1, (CONFIG.coinBandBottom - CONFIG.coinBandTop) * worldH);
    for (let i = 0; i < CONFIG.coinCount; i++) {
      coins.push(new Coin(assets, CONFIG,
        Math.random() * worldW,
        top + Math.random() * span,
        COIN_KEYS[i % COIN_KEYS.length]));
    }
  }

  /* --- Restart -------------------------------------------------------------
     Back to the title sequence for a fresh run. Rebuilds the run-owned objects
     instead of resetting them field by field: there is no reset() to fall out
     of step with a constructor, and no reload — every image is already in the
     `assets` store, so this is instant.

     `plane`/`intro`/… are read through their `let` bindings everywhere
     (onSkip, startGame, the loop), so swapping them here swaps them for
     everyone. */
  function restart() {
    bindRestart(false);
    // Back to the title sequence, so the music goes with the run that owned it.
    // startGame() brings it back at the top of the loop — see stopMusic().
    // The gun too: the key that restarted may well have been held, and the
    // intro has no firing block to turn it off.
    sound.stopMusic();
    sound.gun(false);
    ending = null;
    rewindSpinT = 0;
    boss = null;             // has to be re-earned every run
    orbs.length = 0;
    bossBeaten = false;
    flyBoss = null;
    flyBossDone = false;
    killedBy = null;
    finale = new Finale(assets, CONFIG);
    noTime = false;
    clock.reset();
    plane = new Plane(assets, CONFIG);
    fruitSelect = new FruitSelect(assets, CONFIG);
    liftoff = new Liftoff(assets, CONFIG);
    intro = new Intro(assets, CONFIG, fruitSelect, liftoff);
    spawnWorld();
    showChrome(false);
    input.engaged = false;
    phase = 'intro';
    bar.style.display = 'none';
    // The key that restarted is very probably STILL DOWN, and the OS repeats
    // keydown while it is — which would land straight on the intro's skip
    // handler and blow past the title sequence the player just asked to see.
    // Same trap the fruit select and the plane entrance each had to solve.
    skipArmAt = performance.now() + CONFIG.restartSkipGuardMs;
    bindSkip(true);
    last = performance.now();   // don't hand the first frame the gap since the last
  }

  function startGame() {
    phase = 'game';
    bar.style.display = 'none';
    showChrome(true);
    /* THE MUSIC STARTS HERE — with the first game screen, not at boot.

       The intro doubles as the loading screen and can hold on black waiting for
       the tray frames, so a track playing under it would be scoring a progress
       bar. Starting on the cut into the game also means the loop's first beat
       lands on the frame the player first sees the world, which is worth
       having and is free.

       No-op and harmless if the track has not downloaded yet: Sound remembers
       that it was asked and starts itself when it lands. */
    sound.playMusic();
    // Fly whoever the player picked in the intro (null if they skipped past it,
    // in which case the plane keeps its default).
    if (intro.pickedCharacter !== null) plane.setCharacter(intro.pickedCharacter);
    // The key that skipped the intro shouldn't read as "the player is flying":
    // un-latch, so the tray free-runs until they actually take control.
    input.engaged = false;
    last = performance.now();   // don't hand the first frame the load's dt
    // Pull the TIME OVER panel in the background. 1.5MB that isn't needed for
    // two minutes has no business delaying the game appearing, and it has the
    // whole run to arrive. Not awaited, and it can't fail the game: if it
    // somehow hasn't landed, the panel draws its title over black.
    gameOver.load();
  }

  function loop(now) {
    const dt = now - last; last = now;
    // The Gamepad API has no button events — this poll IS the controller, for
    // every phase. Before anything reads input, and only once a frame.
    input.poll();
    // Mute, in every phase rather than only in-game: a player who wants the
    // sound off wants it off now, not once they have got through the intro.
    if (input.takeMute()) sound.toggleMute();

    if (phase === 'intro') {
      intro.update(dt, input);
      if (CONFIG.film) film.update(dt);

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (CONFIG.film) ctx.translate(0, film.weaveOffset());
      intro.render(ctx, W, H);
      ctx.restore();
      if (CONFIG.film) film.render(ctx, W, H);

      // Any pad button skips, exactly as any key does. Routed through onSkip so
      // it inherits both of that function's guards: the arm-time window after a
      // restart, and "not while the fruit select is up, where buttons are the
      // player choosing rather than skipping".
      if (skipBound && input.takeAnyPress()) onSkip({ type: 'gamepad' });

      if (intro.done) {
        bindSkip(false);
        // The intro doubles as the loading screen: the heavy tray frames stream
        // in behind it. If it outran them, sit on black with the bar until they land.
        if (gameReady) startGame();
        else { phase = 'boot'; bar.style.display = ''; ctx.clearRect(0, 0, W, H); }
      }
    } else if (phase === 'game') {
      // Nothing the player presses counts until the plane has flown in — the key
      // that confirmed the fruit select is very likely still held down.
      if (input.takeCycle() && !plane.controlLocked) plane.cycleCharacter();

      // The run clock starts when the player actually gets control, not when the
      // game screen appears — the plane's fly-in shouldn't burn time nobody can
      // play. advance() also hands back the GAME delta; the sim below still
      // steps on the real `dt`, so the rate change is clock-only for now.
      // `started`, NOT `running`: the clock is deliberately paused in two
      // places (time over, and no-time mode) and testing `running` here would
      // silently restart it on the very next frame — the fade-out would tick
      // past 2:00, and no-time mode would climb straight back out of the white.
      if (!clock.started && !plane.controlLocked) clock.start();
      clock.advance(dt);

      // Time up. Freeze the clock so the drain stops at exactly full grey and
      // the HUD's last reading is the one the player ends on, then run the
      // handover off real time — a fade shouldn't be on a rate-scaled clock.
      /* ⚠️ THE MUSIC STOPS WHEREVER `ending` IS LATCHED, and there are exactly
         two such places — here and the death below — covering all THREE ways a
         run can end badly: the clock running out (TIME OVER), the Time Boss
         ageing you (THE END), and the Mosca Boss knocking you down (TIME OVER,
         failedTitle). They all funnel through this one flag, which is why this
         is two calls rather than three, and why a fourth ending added later
         gets the behaviour for free as long as it sets `ending` too.

         It is latched at the START of the handover, not when the panel finally
         appears: `ending` is the moment the picture begins dipping, and the bed
         going down with it is what makes the dip read as the end of the run
         rather than as a fade that happens to be in progress. The fade is
         shorter than the dip (see musicFadeOutMs), so silence lands first.

         NOT the finale — beating the Time Boss is a win and keeps its music. */
      if (!ending && clock.running && clock.now() >= CONFIG.timeOverMs) {
        ending = { t: 0 };
        sound.stopMusic();
        clock.pause();
      }
      /* Aged to death — the third orb landed. This gets its OWN ending, and the
         inverse of the other one: the run running out of time dips to BLACK and
         says TIME OVER, while being killed by the Time Boss goes WHITE and says
         THE END. Which is the picture finishing what it was already doing — the
         bleach has the world at pure white by the time the fight starts — rather
         than cutting to something new.

         It also means the fight has a fail state at all, which no-time mode
         otherwise cannot provide: the clock is paused in there, so time-over can
         never fire.

         ⚠️ `canvas.height`, not `H` — this runs BEFORE the frame's
         `const W, H` further down, so naming those here is a temporal-dead-zone
         crash on the one frame the player dies. It is the same number; the
         canvas is a fixed internal resolution. */
      if (!ending && plane.isDead()) {
        // Stop the clock the moment he dies rather than when the fall ends, so
        // the drain freezes on the frame it happened instead of creeping on
        // through a second of falling. Idempotent — in no-time mode it is
        // already paused.
        clock.pause();
        // ⚠️ The panel waits for the WRECK TO LEAVE THE FRAME. Cutting to it on
        // the fatal hit would throw away the fall entirely; this is what makes
        // the death an event rather than a state change.
        // Three endings, and `killedBy` picks between them: the Time Boss ages
        // you into a white void, the Mosca Boss knocks you out of a world that
        // still has its colour. `title` is a config key, null meaning the plain
        // TIME OVER the clock running out gives.
        if (plane.fallDone(canvas.height)) {
          ending = {
            t: 0,
            white: killedBy === 'time',
            title: killedBy === 'fly' ? 'failedTitle' : null,
          };
          // Endings two and three — see the note on the other latch. Here the
          // music goes as the WRECK LEAVES THE FRAME rather than on the fatal
          // hit, because that is when the run is over: the fall is still the
          // game, and scoring it is the point of having it.
          sound.stopMusic();
        }
      }
      if (ending) ending.t += dt;

      // Once the dip to black has finished, the played scene is behind an
      // opaque panel and is never coming back — so stop SIMULATING it too, not
      // just drawing it. 30 flies, 12 coins and the tray's frame stepping are
      // all pure waste from here on.
      if (ending && ending.t >= CONFIG.overFadeOutMs) {
        // ⚠️ This path RETURNS, skipping the whole firing block below — so the
        // gun has to be silenced here or a player who died holding fire would
        // hear it looping over the game-over panel forever. The music is
        // already down; it was stopped when `ending` latched.
        sound.gun(false);
        if (CONFIG.film) film.update(dt);
        const W = canvas.width, H = canvas.height;
        // Which ending: the clock ran out (black, TIME OVER) or the Time Boss
        // killed you (white, THE END).
        ctx.fillStyle = ending.white ? '#FFFFFF' : '#000';
        ctx.fillRect(0, 0, W, H);
        // Negative through the hold, so the panel is simply absent until the
        // fade-in starts and its own reveal clock starts from 0 at that moment.
        const panelT = ending.t - CONFIG.overFadeOutMs - CONFIG.overHoldMs;
        const a = CONFIG.overFadeInMs > 0
          ? Math.min(1, Math.max(0, panelT) / CONFIG.overFadeInMs) : 1;
        // The white ending has no picture to fade up, so `a` only ever gates the
        // letters — and they are 1500ms behind it, by which point it is 1. So
        // they pop exactly as they do on the black screen, which is the point.
        if (ending.white) gameOver.renderNoTime(ctx, W, H, Math.max(0, panelT), a);
        else gameOver.render(ctx, W, H, Math.max(0, panelT), a, ending.title);
        // Arm the restart only once the panel has fully arrived AND said its
        // piece — the fade-in done and OVER on screen — plus a beat to read it.
        if (panelT >= gameOver.settledMs()) bindRestart(true);
        // ...and the pad's version of it. `restartArmed` is the same gate the
        // DOM listeners are behind, so the beat the player gets to read the
        // screen applies to a controller too.
        if (restartArmed && input.takeAnyPress()) restart();
        // Keep the projector running over the panel: the whole game carries the
        // grain and vignette, and dropping them at the last screen would read as
        // a bug. No weave, though — the panel fills the frame, so shaking it
        // would show black at the edges.
        if (CONFIG.film) film.render(ctx, W, H);
        requestAnimationFrame(loop);
        return;
      }
      // The tray orbits backwards while the player is actively winding time
      // back — topped up by each coin hit below, not driven by the clock's
      // sign. So the world reacts AS you pull time back, at any point on the
      // clock, instead of only once the number happens to have gone negative.
      if (rewindSpinT > 0) rewindSpinT = Math.max(0, rewindSpinT - dt);
      bg.update(dt, input, rewindSpinT > 0);
      // Before plane.update, so a position the finale writes lands in THIS
      // frame's stop-motion snapshot — which is what the camera pans off.
      finale.update(dt, plane, clock);
      plane.update(dt, input);

      /* CLIMB / DIVE. On the press, so holding the key plays the sound once and
         lets it finish rather than looping it — the opposite shape from the gun
         a few hundred lines down, which is a held state and loops.

         Gated on controlLocked for the same reason the firing is: during the
         fly-in, the death fall and the finale the plane ignores input entirely
         (Plane.update swaps in NO_INPUT), so a whoosh there would be scoring a
         movement that never happened. The edges are consumed either way —
         poll() recomputes them each frame, so an unread one goes stale instead
         of firing late. */
      if (!plane.controlLocked) {
        if (input.takeUpPress()) sound.once('up');
        if (input.takeDownPress()) sound.once('down');
      }
      hud.update(dt);            // advances the timer's rewind jolt
      if (CONFIG.film) film.update(dt);
      const W = canvas.width, H = canvas.height;
      // The tray world is larger than the canvas; the camera shows a cropped
      // window and pans it with the plane's position (both axes). The pan range
      // is fenced off the blank studio margins (camInset*) so the white edges
      // never come into view. The plane itself is untouched (canvas-space).
      const worldW = bg.worldWidth(), worldH = bg.worldHeight();
      const minX = CONFIG.camInsetLeft * worldW;
      const maxX = worldW * (1 - CONFIG.camInsetRight) - W;
      const minY = CONFIG.camInsetTop * worldH;
      const maxY = worldH * (1 - CONFIG.camInsetBottom) - H;
      const camX = minX + plane.displayX() * Math.max(0, maxX - minX);
      const camY = minY + plane.displayY() * Math.max(0, maxY - minY);

      // While the player is winding time back the flies retrace their paths,
      // same window that turns the tray around.
      for (const e of enemies) e.update(dt, worldW, worldH, rewindSpinT > 0);
      for (const c of coins) c.update(dt, worldW);

      /* THE MOSCA BOSS. The swarm is only three flies, and killing all of them
         is what brings it out — the room's own reward, where the Time Boss is
         the rewind's. Latched so a second swarm (the flies come back if the Time
         Boss is beaten) cannot summon it again.

         Flies are never spliced from the list — a landed corpse reports
         isDead() false so the pile keeps being drawn — so "all dead" is a test
         on isAlive(), not on the list being empty. Which is also why the length
         guard is there: an empty list would pass every() vacuously and spawn the
         boss before the world had been filled. */
      // The plane lives in SCREEN space (its x/y are canvas fractions and the
      // camera pans off them), so its world point is the camera plus that —
      // which is what both bosses need in order to come after it.
      const planePt = { x: camX + plane.displayX() * W, y: camY + plane.displayY() * H };

      if (!flyBoss && !flyBossDone && !noTime
          && enemies.length > 0 && enemies.every(e => !e.isAlive())) {
        flyBossDone = true;
        flyBoss = new FlyBoss(assets, CONFIG,
          { camX, camY, w: W, h: H }, planePt, worldW, worldH);
      }
      if (flyBoss) {
        flyBoss.update(dt, worldW, worldH, planePt);
        if (flyBoss.isDead()) flyBoss = null;
      }

      /* NO TIME MODE. The clock has been dragged all the way to bossAtMs, and
         everything the run was about stops applying: the flies and the coins
         vanish, the HUD goes, and the boss arrives in a white void. It appears
         at the MIDDLE of the world's X range — a fixed landmark rather than
         somewhere relative to the camera, so the player can go looking for it.

         THE CLOCK IS PAUSED, NOT RESET, and that one decision does the rest for
         free:
           · frozen at ≤ bossAtMs, so the bleach stays pinned at pure white
             instead of fading back as time climbs — no special case needed;
           · time-over can never fire, since that test requires clock.running;
           · and the value is still sitting there for when time comes BACK.
         Beating the boss should therefore be `clock.resume()` and
         `noTime = false` — the rest of the machinery is untouched and waiting.
         Nothing here has been deleted, only stopped. */
      if (!noTime && !bossBeaten && clock.now() <= CONFIG.bossAtMs) {
        noTime = true;
        clock.pause();
        enemies.length = 0;
        coins.length = 0;
        // The Mosca Boss belongs to the part of the run that was about time. It
        // goes with the flies it came from, rather than being left over in a
        // white void fighting alongside a boss it has nothing to do with.
        flyBoss = null;
        boss = new Boss(assets, CONFIG,
          worldW / 2,
          Math.max(CONFIG.bossSizePx, camY + H * 0.45));
      }
      // The plane lives in SCREEN space (its x/y are canvas fractions and the
      // camera pans off them), so its world point is the camera plus that —
      // which is what the boss needs to know where to look.
      if (boss) {
        boss.update(dt, worldW, worldH, planePt);
        // He describes the throw; the shell builds it, the same way it builds
        // the flies and the coins — so boss.js never has to know orb.js exists.
        const t = boss.takeThrow(worldW, planePt);
        if (t) orbs.push(new Orb(assets, CONFIG, t.x, t.y, t.dx, t.dy));

        /* WON — and the run does not carry on. The blast he dies in has burnt
           out, so the ENDING starts: the player stops flying and watches while
           time comes back, the world un-bleaches, and the game says thank you.
           See finale.js.

           ⚠️ `noTime` deliberately STAYS TRUE. It is doing exactly the job the
           finale needs — no HUD, no flies, no coins — and clearing it would put
           a fly counter and a run timer over the credits. The clock stays paused
           with it and is SCRUBBED by the finale instead of resumed: 120 seconds
           of game time inside 5 seconds of real time is a position, not a rate,
           and a resumed clock would hand the ending back to a time-over test
           that no longer means anything. */
        if (boss.isDead()) {
          boss = null;
          bossBeaten = true;
          orbs.length = 0;
          finale.start(plane);
        }
      }

      // The orbs, and the one thing in this game that can hurt the player.
      for (const o of orbs) o.update(dt, worldW, worldH);
      // Nothing may shoot at a plane that is still flying in, or at one already
      // going down with the run — the player has no controls in either case.
      if (!ending && !plane.controlLocked) {
        const pb = plane.hitBox(W, H);
        if (pb) {
          /* TOUCHING THE MOSCA BOSS HURTS — its stalk is its whole attack, so
             the collision boxes ARE the weapon. No extra gate is needed: its
             boxes() is empty until it has arrived and again once it is dying, so
             a cutscene and a corpse are both harmless for free.

             hurt() is rejected inside the plane's i-frames, which is what stops
             a boss parked on the player draining all three points in three
             frames. At 1100ms of i-frames a player who simply sits inside it
             lasts 3.3 seconds — and since it moves at half their speed, not
             sitting inside it is always an option. */
          if (flyBoss) {
            for (const b of flyBoss.boxes(camX, camY, worldW)) {
              if (!boxesOverlap(pb, b)) continue;
              if (plane.hurt(1)) killedBy = 'fly';
              break;
            }
          }
          for (const o of orbs) {
            if (o.isDead()) continue;
            for (const b of o.boxes(camX, camY, worldW)) {
              if (!boxesOverlap(pb, b)) continue;
              // Only a landed hit consumes the orb. Inside the plane's i-frames
              // hurt() returns false and the orb flies ON THROUGH — otherwise a
              // second orb arriving during the blink would be silently eaten,
              // and the player would be punished later for a hit they never saw.
              if (plane.hurt(1)) { o.kill(); killedBy = 'time'; }
              break;
            }
          }
        }
      }
      for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].isDead()) orbs.splice(i, 1);
      // A coin that has finished exploding is gone for good — same as the
      // flies, killed coins do not come back.
      for (let i = coins.length - 1; i >= 0; i--) if (coins[i].isDead()) coins.splice(i, 1);
      // Drop flies that are gone for good. Landed corpses are NOT dead — they
      // stay in the list so the pile on the floor keeps being drawn.
      for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].isDead()) enemies.splice(i, 1);

      // --- Shooting: while firing, project a thin hitscan line forward from
      // the nose. Anything whose box it crosses is hit and bursts.
      let ray = null;
      // Deliberately NOT gated on `ending`: the player keeps firing through the
      // 900ms dip to black, and can still hit coins and wind the clock back
      // there. It does not save them — `ending` has already latched — so those
      // last seconds are bought and immediately lost. Kept because the futile
      // final volley is the better moment; a gun that goes dead the instant the
      // fade starts just feels like the game stopped listening.
      if (input.firing && !plane.controlLocked) {
        const m = plane.muzzle(W, H);
        if (m) {
          ray = { x: m.x, y: m.y, end: W };
          for (const e of enemies) {
            if (!e.isAlive()) continue;
            for (const b of e.boxes(camX, camY, bg.worldWidth())) {
              // The game time is handed in so a killing shot can stamp WHEN it
              // happened — that stamp is what a later rewind compares against.
              if (rayHitsBox(ray, CONFIG.rayThickness, b)) {
                e.hit(CONFIG.rayDamage, clock.now());
                break;
              }
            }
          }
          // Coins take the same beam. It PIERCES — no early exit above, so one
          // shot can hit a fly and a coin on the same line, which is the
          // behaviour the fly loop already had between flies.
          for (const cn of coins) {
            if (!cn.isShootable()) continue;
            for (const b of cn.boxes(camX, camY, worldW)) {
              if (!rayHitsBox(ray, CONFIG.rayThickness, b)) continue;
              // hit() returns false inside the coin's i-frames, so the rewind
              // is rate-limited by exactly the same window as the damage —
              // otherwise the every-frame beam would wind the clock back a
              // second per FRAME and the run would never end.
              if (cn.hit(CONFIG.rayDamage)) {
                clock.rewind(CONFIG.coinRewindMs);
                // Time just moved: any fly whose death is now in the future
                // never died. Checked against the NEW clock, so it has to come
                // after the rewind.
                for (const e of enemies) e.resurrectAt(clock.now());
                hud.jolt();
                // Re-armed rather than accumulated: holding fire keeps topping
                // it up so the tray runs backwards continuously, and it lapses
                // shortly after the last hit however many landed.
                rewindSpinT = CONFIG.rewindSpinMs;
              }
              break;
            }
          }
          // And the boss takes it too — the beam pierces all the way through, so
          // this is another pass rather than an early exit. hit() is rejected
          // inside his i-frames, which is the only thing stopping all 44 points
          // coming off in 44 consecutive frames.
          if (flyBoss && flyBoss.isShootable()) {
            for (const b of flyBoss.boxes(camX, camY, worldW)) {
              if (!rayHitsBox(ray, CONFIG.rayThickness, b)) continue;
              flyBoss.hit(CONFIG.rayDamage, ray.y + camY);
              break;
            }
          }
          if (boss && boss.isShootable()) {
            for (const b of boss.boxes(camX, camY, worldW)) {
              if (!rayHitsBox(ray, CONFIG.rayThickness, b)) continue;
              // Hand him the HEIGHT the beam crossed him at, in world coords, so
              // the impact puff lands there rather than always in the middle of
              // his 213px hitbox. Y only — the puff's X stays on his centre.
              boss.hit(CONFIG.rayDamage, ray.y + camY);
              break;
            }
          }
        }
      }

      /* THE GUN'S SOUND, gated on `ray` rather than on `input.firing`.

         `ray` is non-null on exactly the frames the gun is actually shooting —
         it is null while the plane is flying in (controlLocked) and null when
         the plane has no muzzle to fire from — so this stays welded to the
         muzzle flash instead of drifting from it. Holding fire during the
         entrance would otherwise play a gun that visibly is not firing.

         Note it is deliberately NOT gated on `ending`, exactly as the shooting
         above is not: the player keeps firing through the dip to black, and the
         futile final volley should be audible. It stops when the panel takes
         over — see the early return further up.

         Handed a boolean every frame; sound.gun() no-ops unless it flips. */
      sound.gun(!!ray);

      ctx.clearRect(0, 0, W, H);

      // The scene weaves vertically (gate jitter) under the film effect; the
      // film overlay itself (grain/bar/vignette) stays fixed to the screen.
      ctx.save();
      if (CONFIG.film) ctx.translate(0, film.weaveOffset());
      // The world loses its colour as the run goes on, on GAME time — so the
      // drain and the HUD's timer always agree about how long you've been here.
      bg.render(ctx, camX, camY, bg.washAt(clock.now()));
      // Coins under the flies and the plane: they are scenery to fly through,
      // so nothing the player is aiming at should ever be hidden behind one.
      for (const c of coins) c.render(ctx, camX, camY, worldW);
      for (const e of enemies) e.render(ctx, camX, camY, bg.worldWidth());
      // Boss over the flies (it dwarfs them) but under the plane — the player
      // must never be hidden behind it.
      if (flyBoss) { flyBoss.render(ctx, camX, camY, worldW); flyBoss.renderHitFx(ctx, camX, camY, worldW); }
      if (boss) boss.render(ctx, camX, camY, worldW);
      // The puff for a hit ON him sits at his depth, not in the explosion pass:
      // it is a mark on the boss, not a blast in front of the world.
      if (boss) boss.renderHitFx(ctx, camX, camY, worldW);
      // Orbs over the boss — they leave his hands, so nothing of his should be
      // in front of one — but under the plane, which must never be hidden.
      for (const o of orbs) o.render(ctx, camX, camY, worldW);
      // The plane drains too, but on its own curve and only half way — see
      // Plane.drainAt(). Same game clock, deliberately different pace.
      plane.render(ctx, W, H, plane.drainAt(clock.now()));
      // Coin explosions LAST, over everything in the world: a blast that a
      // passing fly could stand in front of would read as a glitch. No-op for
      // every coin that isn't currently exploding.
      for (const c of coins) c.renderBurst(ctx, camX, camY, worldW);
      if (boss) boss.renderBurst(ctx, camX, camY, worldW);
      if (flyBoss) flyBoss.renderBurst(ctx, camX, camY, worldW);

      // Hold C: show the fly collision boxes, and the shot line while firing.
      if (input.debug) {
        ctx.save();
        // The fake floor plane the corpses settle on (world space, so it
        // scrolls) — same red as the annotated screenshot it was measured from.
        const pTop = CONFIG.corpsePlaneTop * worldH - camY;
        const pBot = CONFIG.corpsePlaneBottom * worldH - camY;
        ctx.fillStyle = 'rgba(233,69,96,0.16)';
        ctx.fillRect(0, pTop, W, pBot - pTop);
        ctx.strokeStyle = 'rgba(233,69,96,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, pTop, W, pBot - pTop);

        ctx.strokeStyle = '#53d8fb';
        ctx.lineWidth = 1;
        for (const e of enemies)
          if (e.isAlive())
            for (const b of e.boxes(camX, camY, bg.worldWidth()))
              ctx.strokeRect(b.x, b.y, b.w, b.h);
        // Coin boxes in the coin's own colour, and only while it still has
        // health — so "why isn't this one reacting?" is visible, not guesswork.
        ctx.strokeStyle = '#FAFA24';
        for (const cn of coins)
          if (cn.isShootable())
            for (const b of cn.boxes(camX, camY, worldW))
              ctx.strokeRect(b.x, b.y, b.w, b.h);
        // The fight's boxes: the boss, what he threw, and the player. All three
        // in one colour — they are the only things in the game that collide with
        // each other, and telling them apart is what the sizes are for.
        ctx.strokeStyle = '#8ef58e';
        if (boss && boss.isShootable())
          for (const b of boss.boxes(camX, camY, worldW))
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (flyBoss && flyBoss.isShootable())
          for (const b of flyBoss.boxes(camX, camY, worldW))
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        for (const o of orbs)
          for (const b of o.boxes(camX, camY, worldW))
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        const pbox = plane.hitBox(W, H);
        if (pbox) ctx.strokeRect(pbox.x, pbox.y, pbox.w, pbox.h);
        if (ray) {
          ctx.strokeStyle = '#e94560';
          ctx.lineWidth = CONFIG.rayThickness;
          ctx.beginPath();
          ctx.moveTo(ray.x, ray.y);
          ctx.lineTo(ray.end, ray.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();

      // The finale's cards and logo: outside the weave (they are titles, not
      // scenery) but UNDER the film pass, so the grain and vignette sit over
      // them exactly as they do over the TIME OVER panel.
      finale.renderTitles(ctx, W, H, gameOver);
      finale.renderLogo(ctx, W, H);

      if (CONFIG.film) film.render(ctx, W, H);

      // HUD last: it must sit OUTSIDE the film pass. The vignette darkens the
      // very corners it lives in and the weave shakes the scene — fixed to the
      // camera means it does neither.
      // The whole HUD goes in no-time mode, not just the clock: with the flies
      // gone the FLIES count is as meaningless as the timer, and leaving one
      // number floating over an empty white world would read as a leftover.
      if (!noTime) {
        const liveFlies = enemies.reduce((n, e) => n + (e.isAlive() ? 1 : 0), 0);
        hud.render(ctx, W, H, {
          fliesLeft: liveFlies,
          fliesKilled: CONFIG.flyCount - liveFlies,
          timeMs: clock.now(),
        });
      }
      // The boss bar is OUTSIDE that gate — it is the only readout in no-time
      // mode. Drawn right through the death blast too, because an empty bar IS
      // the news that he is dead.
      if (boss) bossBar.render(ctx, W, H, boss.hp / CONFIG.bossHealth);
      // ...and the Mosca Boss's, but only once it has ARRIVED: the bar going up
      // is the last beat of its entrance, the moment the cutscene becomes a
      // fight. The two bosses can never both be up — no-time mode clears this
      // one as it summons the other — so one bar renderer serves both.
      else if (flyBoss && flyBoss.arrived())
        bossBar.render(ctx, W, H, flyBoss.hp / CONFIG.flyBossHealth);

      // The dip to black. LAST, so it takes the HUD down with the scene — the
      // timer reading 2:00 while everything else fades would look like the HUD
      // had come unstuck from the game.
      // Once the logo has sat there long enough, any key, click or pad button
      // starts a new run — the same "press anything" the TIME OVER panel arms,
      // and for the same reason: the player must never be left on a screen with
      // no way off it.
      if (finale.settled()) {
        bindRestart(true);
        if (input.takeAnyPress()) restart();
      }

      if (ending) {
        ctx.save();
        ctx.globalAlpha = CONFIG.overFadeOutMs > 0
          ? Math.min(1, ending.t / CONFIG.overFadeOutMs) : 1;
        // White when the boss got you — and since the bleach already has the
        // world at pure white by then, what actually dissolves is the plane, the
        // boss and the orbs, leaving the void they were standing in.
        ctx.fillStyle = ending.white ? '#FFFFFF' : '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // The intro panels are small (~1MB all told), so they load FIRST and the
  // sequence starts playing right away — the tray frames (the heavy part)
  // stream in underneath it. The title sequence IS the loading screen.
  if (CONFIG.intro) {
    intro.load().then(() => {
      if (phase !== 'boot') return;               // assets beat it; already playing
      phase = 'intro';
      bar.style.display = 'none';                 // the intro replaces the loading bar
      last = performance.now();
      bindSkip(true);
    });
  }

  // Not awaited and not part of TOTAL: it is a few hundred bytes, it is
  // optional, and the game must never sit on a loading bar waiting for a
  // controller profile. If it lands late the pad simply uses standard-layout
  // defaults until it does.
  input.loadMapping(CONFIG.GAMEPAD_MAPPING);

  // Same treatment, and for the same reasons: started now, not awaited, and not
  // counted in TOTAL. The track is ~240KB and the game must never sit on a
  // loading bar for it. If it arrives after startGame() has already run it
  // starts itself — see sound.js.
  sound.load();

  Promise.all([
    bg.load(tick),
    plane.load(tick),
    assets.loadImage('fly', CONFIG.ASSET_BASE + CONFIG.FLY_SHEET).then(tick),
    // encodeURI: this filename contains a space.
    assets.loadImage('flyDead', encodeURI(CONFIG.ASSET_BASE + CONFIG.FLY_DEAD_SHEET)).then(tick),
    ...COIN_KEYS.map(k =>
      assets.loadImage('coin_' + k, CONFIG.ASSET_BASE + CONFIG.COIN_SHEETS[k]).then(tick)),
    // The main game's explosion sheet — 9KB, so it loads up front with the rest.
    assets.loadImage('boom', CONFIG.ASSET_BASE + CONFIG.BOOM_SHEET).then(tick),
    assets.loadImage('boss', CONFIG.ASSET_BASE + CONFIG.BOSS_SHEET).then(tick),
    // The orb he throws: the root game's FX sphere, recut by
    // tools/build-orb-frames.py. 33KB, so it loads with the rest.
    assets.loadImage('orb', CONFIG.ASSET_BASE + CONFIG.ORB_SHEET).then(tick),
    assets.loadImage('bossBar', CONFIG.ASSET_BASE + CONFIG.BAR_SHEET).then(tick),
    // The finale's logo. 30KB, at the asset root package.sh already globs.
    assets.loadImage('logo', CONFIG.ASSET_BASE + CONFIG.LOGO_SHEET).then(tick),
    // The Mosca Boss. PNGs, in enemy-sheets/ — a folder package.sh already
    // copies, so no new cp line. Only two of the three delivered files: 01 and
    // 03 are byte-identical (see MOSCA_CYCLE).
    ...CONFIG.MOSCA_SHEETS.map((f, i) =>
      assets.loadImage('mosca_' + i, CONFIG.ASSET_BASE + f).then(tick)),
  ]).then(() => {
    spawnWorld();
    gameReady = true;
    // If the intro is still rolling, it gets to finish — startGame() runs when
    // it does. Otherwise (skipped, disabled, or slower art) go now.
    if (phase !== 'intro') startGame();
  });
})();
