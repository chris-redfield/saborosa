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

  // Horizontal hitscan segment (from ray.x to ray.end at ray.y, `t` px thick)
  // against an axis-aligned box.
  function rayHitsBox(ray, t, b) {
    const half = t / 2;
    return (ray.y + half >= b.y) && (ray.y - half <= b.y + b.h)
        && (b.x + b.w >= ray.x) && (b.x <= ray.end);
  }

  let last = performance.now(), ready = false;

  function loop(now) {
    const dt = now - last; last = now;
    if (ready) {
      if (input.takeCycle()) plane.cycleCharacter();
      bg.update(dt, input);
      plane.update(dt, input);
      for (const e of enemies) e.update(dt, bg.worldWidth(), bg.worldHeight());
      // Drop flies that finished bursting — they don't come back.
      for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].isDead()) enemies.splice(i, 1);

      const W = canvas.width, H = canvas.height;
      // The tray world is larger than the canvas; the camera shows a cropped
      // window and pans it with the plane's position (both axes), clamped to
      // the world edges. The plane itself is untouched (canvas-space).
      const camX = plane.x * Math.max(0, bg.worldWidth()  - W);
      const camY = plane.y * Math.max(0, bg.worldHeight() - H);

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

      hud.textContent = `${plane.characterName.toUpperCase()}   FLIES ${enemies.length}`;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  Promise.all([
    bg.load(tick),
    plane.load(tick),
    assets.loadImage('fly', CONFIG.ASSET_BASE + CONFIG.FLY_SHEET).then(tick),
  ]).then(() => {
    // Scatter the flies at random WORLD positions (they wrap on X, so anywhere
    // across the width is fair game). Killed flies are gone for good.
    const worldW = bg.worldWidth(), worldH = bg.worldHeight();
    for (let i = 0; i < CONFIG.flyCount; i++) {
      enemies.push(new Fly(assets, CONFIG,
        Math.random() * worldW,
        80 + Math.random() * Math.max(1, worldH - 160)));
    }
    ready = true;
    bar.style.display = 'none';
  });
})();
