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
  const hud = document.getElementById('hud');

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
  const plane = new Plane(assets, CONFIG);
  const enemies = [];
  const film = new Film(CONFIG);
  const fruitSelect = new FruitSelect(assets, CONFIG);
  const intro = new Intro(assets, CONFIG, fruitSelect);

  // The HUD / help / toggles belong to the game, not the title sequence.
  const chrome = ['hud', 'help', 'controls'].map(id => document.getElementById(id));
  const showChrome = on => chrome.forEach(el => { if (el) el.style.display = on ? '' : 'none'; });
  showChrome(false);

  // Black & white via a GPU-cheap CSS filter on the canvas; keep it in sync.
  const applyFilmCss = () => { canvas.style.filter = CONFIG.film ? CONFIG.filmCss : ''; };
  applyFilmCss();

  // Loading progress across every asset the subsystems pull in (+1 for the fly).
  const TOTAL = CONFIG.FRAMES * 2
    + CONFIG.CHARACTERS.length * CONFIG.CH_FRAMES
    + CONFIG.GUN_FRAMES + 2;   // +2: the fly sheet and the dead-fly sprite
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
  function onSkip(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
    // While the fruit select is up, keys are the player choosing — not skipping.
    if (intro.awaitingInput) return;
    intro.skip();
  }
  function bindSkip(on) {
    const m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('keydown', onSkip);
    window[m]('mousedown', onSkip);
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
      if (input.takeCycle()) plane.cycleCharacter();
      bg.update(dt, input);
      plane.update(dt, input);
      if (CONFIG.film) film.update(dt);
      for (const e of enemies) e.update(dt, bg.worldWidth(), bg.worldHeight());
      // Drop flies that finished bursting — they don't come back.
      for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].isDead()) enemies.splice(i, 1);

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

      // --- Shooting: while firing, project a thin hitscan line forward from
      // the nose. Anything whose box it crosses is hit and bursts.
      let ray = null;
      if (input.firing) {
        const m = plane.muzzle(W, H);
        if (m) {
          ray = { x: m.x, y: m.y, end: W };
          for (const e of enemies) {
            if (!e.isAlive()) continue;
            for (const b of e.boxes(camX, camY, bg.worldWidth())) {
              if (rayHitsBox(ray, CONFIG.rayThickness, b)) { e.hit(); break; }
            }
          }
        }
      }

      ctx.clearRect(0, 0, W, H);

      // The scene weaves vertically (gate jitter) under the film effect; the
      // film overlay itself (grain/bar/vignette) stays fixed to the screen.
      ctx.save();
      if (CONFIG.film) ctx.translate(0, film.weaveOffset());
      bg.render(ctx, camX, camY);
      for (const e of enemies) e.render(ctx, camX, camY, bg.worldWidth());
      plane.render(ctx, W, H);

      // Hold C: show the fly collision boxes, and the shot line while firing.
      if (input.debug) {
        ctx.save();
        ctx.strokeStyle = '#53d8fb';
        ctx.lineWidth = 1;
        for (const e of enemies)
          for (const b of e.boxes(camX, camY, bg.worldWidth()))
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

      const liveFlies = enemies.reduce((n, e) => n + (e.isAlive() ? 1 : 0), 0);
      hud.textContent = `${plane.characterName.toUpperCase()}   FLIES ${liveFlies}`;
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
  ]).then(() => {
    // Scatter the flies at random WORLD positions (they wrap on X, so anywhere
    // across the width is fair game). Killed flies are gone for good.
    const worldW = bg.worldWidth(), worldH = bg.worldHeight();
    for (let i = 0; i < CONFIG.flyCount; i++) {
      enemies.push(new Fly(assets, CONFIG,
        Math.random() * worldW,
        80 + Math.random() * Math.max(1, worldH - 160)));
    }
    gameReady = true;
    // If the intro is still rolling, it gets to finish — startGame() runs when
    // it does. Otherwise (skipped, disabled, or slower art) go now.
    if (phase !== 'intro') startGame();
  });
})();
