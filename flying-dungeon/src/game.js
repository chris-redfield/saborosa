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

  const assets = new Assets();
  const input = new Input();
  const bg = new TrayBackground(assets, CONFIG);
  const plane = new Plane(assets, CONFIG);
  const enemies = [];

  // Loading progress across every asset the subsystems pull in (+1 for the fly).
  const TOTAL = CONFIG.FRAMES * 2
    + CONFIG.CHARACTERS.length * CONFIG.CH_FRAMES
    + CONFIG.GUN_FRAMES + 1;
  let done = 0;
  const tick = () => { done++; bar.style.width = (done / TOTAL * 100) + '%'; };

  let last = performance.now(), ready = false;

  function loop(now) {
    const dt = now - last; last = now;
    if (ready) {
      if (input.takeCycle()) plane.cycleCharacter();
      bg.update(dt, input);
      plane.update(dt, input);
      for (const e of enemies) e.update(dt, bg.worldWidth(), bg.worldHeight());

      const W = canvas.width, H = canvas.height;
      // The tray world is larger than the canvas; the camera shows a cropped
      // window and pans it with the plane's position (both axes), clamped to
      // the world edges. The plane itself is untouched (canvas-space).
      const camX = plane.x * Math.max(0, bg.worldWidth()  - W);
      const camY = plane.y * Math.max(0, bg.worldHeight() - H);

      ctx.clearRect(0, 0, W, H);
      bg.render(ctx, camX, camY);
      for (const e of enemies) e.render(ctx, camX, camY, bg.worldWidth());
      plane.render(ctx, W, H);
      hud.textContent = plane.characterName.toUpperCase();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  Promise.all([
    bg.load(tick),
    plane.load(tick),
    assets.loadImage('fly', CONFIG.ASSET_BASE + CONFIG.FLY_SHEET).then(tick),
  ]).then(() => {
    // One fly for now, placed in WORLD space so the camera reveals it: near the
    // right edge, at a height that's visible from the plane's start position.
    enemies.push(new Fly(assets, CONFIG, bg.worldWidth() * 0.98, bg.worldHeight() * 0.72));
    ready = true;
    bar.style.display = 'none';
  });
})();
