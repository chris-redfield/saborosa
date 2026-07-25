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
  const clock = new GameClock(CONFIG);
  const gameOver = new GameOver(assets, CONFIG);
  // Set the moment the clock runs out: {t} = ms since then, driving fade-out →
  // hold on black → fade-in of the TIME OVER panel. Null while the run is live.
  let ending = null;
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
    + CONFIG.CHARACTERS.length * CONFIG.CH_FRAMES
    + CONFIG.GUN_FRAMES + 3    // +3: the fly sheet, the dead fly, the boom sheet
    + COIN_KEYS.length;        // + one grid sheet per coin variant
  let done = 0;
  const tick = () => { done++; bar.style.width = (done / TOTAL * 100) + '%'; };

  // Horizontal hitscan segment (from ray.x to ray.end at ray.y, `t` px thick)
  // against an axis-aligned box.
  function rayHitsBox(ray, t, b) {
    const half = t / 2;
    return (ray.y + half >= b.y) && (ray.y - half <= b.y + b.h)
        && (b.x + b.w >= ray.x) && (b.x <= ray.end);
  }

  let last = performance.now();
  let phase = 'boot';       // 'boot' (black) → 'intro' → 'game'
  let gameReady = false;

  // Skip the title sequence on any key or click. Bound only while it plays.
  // Before this timestamp, skips are ignored — see restart().
  let skipArmAt = 0;
  function onSkip(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
    if (performance.now() < skipArmAt) return;
    // While the fruit select is up, keys are the player choosing — not skipping.
    if (intro.awaitingInput) return;
    intro.skip();
  }
  function bindSkip(on) {
    const m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('keydown', onSkip);
    window[m]('mousedown', onSkip);
  }

  // "Any button" on the TIME OVER panel starts over. Bound only once the panel
  // has finished arriving (see the loop) so a key pressed during the fade — or
  // still held from the dying moments of the run — can't skip past the screen
  // the player is meant to read.
  let restartArmed = false;
  function onRestart(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
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
  function spawnWorld() {
    enemies.length = 0;
    coins.length = 0;
    const worldW = bg.worldWidth(), worldH = bg.worldHeight();
    // Scatter the flies at random WORLD positions (they wrap on X, so anywhere
    // across the width is fair game). Killed flies are gone for good.
    for (let i = 0; i < CONFIG.flyCount; i++) {
      enemies.push(new Fly(assets, CONFIG,
        Math.random() * worldW,
        80 + Math.random() * Math.max(1, worldH - 160)));
    }
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
    ending = null;
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
      if (!clock.running && !plane.controlLocked) clock.start();
      clock.advance(dt);

      // Time up. Freeze the clock so the drain stops at exactly full grey and
      // the HUD's last reading is the one the player ends on, then run the
      // handover off real time — a fade shouldn't be on a rate-scaled clock.
      if (!ending && clock.running && clock.now() >= CONFIG.timeOverMs) {
        ending = { t: 0 };
        clock.pause();
      }
      if (ending) ending.t += dt;

      // Once the dip to black has finished, the played scene is behind an
      // opaque panel and is never coming back — so stop SIMULATING it too, not
      // just drawing it. 30 flies, 12 coins and the tray's frame stepping are
      // all pure waste from here on.
      if (ending && ending.t >= CONFIG.overFadeOutMs) {
        if (CONFIG.film) film.update(dt);
        const W = canvas.width, H = canvas.height;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        // Negative through the hold, so the panel is simply absent until the
        // fade-in starts and its own reveal clock starts from 0 at that moment.
        const panelT = ending.t - CONFIG.overFadeOutMs - CONFIG.overHoldMs;
        const a = CONFIG.overFadeInMs > 0
          ? Math.min(1, Math.max(0, panelT) / CONFIG.overFadeInMs) : 1;
        gameOver.render(ctx, W, H, Math.max(0, panelT), a);
        // Arm the restart only once the panel has fully arrived AND said its
        // piece — the fade-in done and OVER on screen — plus a beat to read it.
        if (panelT >= gameOver.settledMs()) bindRestart(true);
        // Keep the projector running over the panel: the whole game carries the
        // grain and vignette, and dropping them at the last screen would read as
        // a bug. No weave, though — the panel fills the frame, so shaking it
        // would show black at the edges.
        if (CONFIG.film) film.render(ctx, W, H);
        requestAnimationFrame(loop);
        return;
      }
      bg.update(dt, input);
      plane.update(dt, input);
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

      for (const e of enemies) e.update(dt, worldW, worldH);
      for (const c of coins) c.update(dt, worldW);
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
              if (rayHitsBox(ray, CONFIG.rayThickness, b)) { e.hit(CONFIG.rayDamage); break; }
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
                hud.jolt();
              }
              break;
            }
          }
        }
      }

      ctx.clearRect(0, 0, W, H);

      // The scene weaves vertically (gate jitter) under the film effect; the
      // film overlay itself (grain/bar/vignette) stays fixed to the screen.
      ctx.save();
      if (CONFIG.film) ctx.translate(0, film.weaveOffset());
      // The world loses its colour as the run goes on, on GAME time — so the
      // drain and the HUD's timer always agree about how long you've been here.
      bg.render(ctx, camX, camY, bg.drainAt(clock.now()));
      // Coins under the flies and the plane: they are scenery to fly through,
      // so nothing the player is aiming at should ever be hidden behind one.
      for (const c of coins) c.render(ctx, camX, camY, worldW);
      for (const e of enemies) e.render(ctx, camX, camY, bg.worldWidth());
      // The plane drains too, but on its own curve and only half way — see
      // Plane.drainAt(). Same game clock, deliberately different pace.
      plane.render(ctx, W, H, plane.drainAt(clock.now()));
      // Coin explosions LAST, over everything in the world: a blast that a
      // passing fly could stand in front of would read as a glitch. No-op for
      // every coin that isn't currently exploding.
      for (const c of coins) c.renderBurst(ctx, camX, camY, worldW);

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

      if (CONFIG.film) film.render(ctx, W, H);

      // HUD last: it must sit OUTSIDE the film pass. The vignette darkens the
      // very corners it lives in and the weave shakes the scene — fixed to the
      // camera means it does neither.
      const liveFlies = enemies.reduce((n, e) => n + (e.isAlive() ? 1 : 0), 0);
      hud.render(ctx, W, H, {
        fliesLeft: liveFlies,
        fliesKilled: CONFIG.flyCount - liveFlies,
        timeMs: clock.now(),
      });

      // The dip to black. LAST, so it takes the HUD down with the scene — the
      // timer reading 2:00 while everything else fades would look like the HUD
      // had come unstuck from the game.
      if (ending) {
        ctx.save();
        ctx.globalAlpha = CONFIG.overFadeOutMs > 0
          ? Math.min(1, ending.t / CONFIG.overFadeOutMs) : 1;
        ctx.fillStyle = '#000';
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
  ]).then(() => {
    spawnWorld();
    gameReady = true;
    // If the intro is still rolling, it gets to finish — startGame() runs when
    // it does. Otherwise (skipped, disabled, or slower art) go now.
    if (phase !== 'intro') startGame();
  });
})();
