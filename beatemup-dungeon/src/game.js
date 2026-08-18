/**
 * game.js — the SHELL. Canvas, loop, phases, wiring.
 *
 * Disposable by design, exactly like the flying dungeon's: when this lifts into
 * the main Saborosa engine this file is what gets thrown away, and everything
 * it wires together (Fighter, Stage, Backdrop, Sheets) travels unchanged.
 *
 * THE DRAW ORDER IS THE LAYER STACK and nothing else. It walks CONFIG.LAYERS in
 * order and asks each one to draw; the one flagged `entities` gets the
 * fighters, z-sorted. Adding a plane in front of everything is an entry in that
 * array — see backdrop.js.
 */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = CONFIG.GAME_W;
  canvas.height = CONFIG.GAME_H;
  ctx.imageSmoothingEnabled = true;

  const assets = new Assets();
  const input = new Input(window);
  const sheets = new Sheets(assets);
  const backdrop = new Backdrop(assets);
  const stage = new Stage(backdrop);
  const combat = new Combat();
  const hud = new Hud();
  const lifeBar = new LifeBar(assets);
  const debug = new Debug();
  const crowd = new Crowd();

  let player = null;
  let phase = 'boot';          // boot | play | dead | clear
  let phaseT = 0;
  let last = 0;

  const bar = document.getElementById('bar');

  /* --- Fit ---------------------------------------------------------------
     Both rules differ from the main game's scaleCanvas() for the reasons the
     flying dungeon's STATE.md records: no margin, because an itch iframe has no
     browser chrome to clear; and NO 1:1 CAP, because itch offers a fullscreen
     button and a capped canvas leaves the game as a small stamp in the middle
     of a black field on a big monitor — exactly when a judge is looking
     hardest. Safe to uncap because this is drawn illustration scaled with
     smoothing on, not pixel art. */
  function fit() {
    const m = CONFIG.fitMarginPx;
    const sx = (window.innerWidth - m * 2) / CONFIG.GAME_W;
    const sy = (window.innerHeight - m * 2) / CONFIG.GAME_H;
    let s = Math.min(sx, sy);
    if (CONFIG.fitMaxScale > 0) s = Math.min(s, CONFIG.fitMaxScale);
    canvas.style.width = Math.round(CONFIG.GAME_W * s) + 'px';
    canvas.style.height = Math.round(CONFIG.GAME_H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // --- Boot ----------------------------------------------------------------
  async function boot() {
    const jobs = [];

    /* EVERYTHING IS LOADED FROM assetManifest(), and that is the point.
       package.sh copies exactly what that same function lists, so an asset can
       never be in the game but missing from the build — the failure the flying
       dungeon shipped once (see the header of src/manifest.js). Add assets
       THERE, not here. */
    for (const a of assetManifest()) {
      if (a.optional) continue;          // handled below, deliberately un-awaited
      if (a.how === 'json') jobs.push(assets.loadJSON(a.key, a.src));
      else if (a.how === 'video') jobs.push(assets.loadVideo(a.key, a.src));
      else if (a.how === 'big') {
        jobs.push(assets.loadBig(a.key, a.src, CONFIG.bigTextureCap || 2400));
      }
      else jobs.push(assets.loadImage(a.key, a.src));
    }

    /* The controller mapping is NOT awaited and NOT part of the progress total:
       a few hundred bytes, optional, and the game must never sit on a loading
       bar waiting for a pad profile. Missing file, bad JSON or no network all
       leave the standard-layout defaults, which is a working pad. It goes
       through assets.resolve() so it obeys the same ASSET_BASE the build
       rewrites, rather than carrying a path of its own. */
    input.loadMapping(assets.resolve(CONFIG.GAMEPAD_MAPPING));

    const tick = setInterval(() => {
      if (bar) bar.style.width = Math.round(assets.progress() * 100) + '%';
    }, 60);

    await Promise.all(jobs);
    clearInterval(tick);
    if (bar) bar.style.display = 'none';

    for (const kind of Object.keys(CONFIG.CHARACTERS)) sheets.build(kind);
    backdrop.build();
    start();
  }

  function start() {
    stage.reset();
    crowd.clear();
    player = new Player(220, CONFIG.beltDepth * 0.6);
    phase = 'play';
    phaseT = 0;
    input.flush();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // --- Loop ----------------------------------------------------------------
  function loop(now) {
    /* Clamped dt. A tab that has been in the background hands back a delta of
       seconds, and a single step that large would teleport every fighter
       through every wall in the level. 50ms = the sim never steps more than
       three frames' worth at once. */
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    input.poll();

    if (input.takePause() && (phase === 'play')) { /* reserved */ }

    /* HITSTOP FREEZES THE SIMULATION, NOT THE RENDERER. Time stops
       advancing; the frame is still drawn, at the full rate. Skipping the draw
       too would show up as a dropped frame — a stutter — rather than as a held
       moment of impact. */
    if (combat.tickFreeze(dt)) {
      render();
      requestAnimationFrame(loop);
      return;
    }

    if (phase === 'play') {
      update(dt);
    } else {
      phaseT += dt;
      /* THE WORLD IS STOPPED, BUT THE CORPSE IS NOT. Freezing everything the
         moment the player dies is right -- nothing should still be punching a
         dead player -- but the death animation runs on the player's own clock,
         and a frozen clock holds it on frame one. That reads as no death
         animation at all, which is exactly how it looked. */
      if (phase === 'dead') player.tickDeath(dt);
    }

    /* NOTHING IS ACCEPTED UNTIL THE DEATH HAS BEEN SEEN. The row plays out and
       then holds -- see Fighter.deathWatch. Without the hold the card faded up
       over a body still falling, and a player mashing as they died restarted
       the game a heartbeat after the animation ended, so they never found out
       what happened to them. */
    const deathLock = (phase === 'dead') ? player.deathLock(sheets) : 0;
    if ((phase === 'dead' || phase === 'clear') && deathLock <= 0
        && phaseT > 1.2 && input.takeAnyPress()) {
      start();
      return;
    }

    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    combat.tick(dt);
    backdrop.update(dt);

    const bounds = stage.bounds();
    player.update(dt, input, bounds);
    crowd.update(dt, player, bounds);
    if (stage.boss) stage.boss.update(dt, player, bounds);

    // Hits are resolved AFTER both sides have moved, so a punch and a step that
    // happen on the same frame are judged against where everyone ended up.
    combat.playerHits(player, crowd, stage.boss);
    combat.crowdHits(crowd, player);
    combat.bossHits(stage.boss, player);

    const ev = stage.update(dt, player, crowd);
    if (ev === 'clear') { phase = 'clear'; phaseT = 0; endScreen(); }

    if (player.dead) { phase = 'dead'; phaseT = 0; endScreen(); }
  }

  /**
   * Entering an end screen: DROP EVERY QUEUED INPUT.
   *
   * WITHOUT THIS THE END SCREEN DISMISSES ITSELF. `_anyPress` is set by every
   * keydown of the whole fight and nothing consumes it -- `takeAnyPress()` is
   * only ever called here -- so by the time the boss dies the flag has been
   * true for minutes. The moment the screen's own delay expires the restart
   * fires, having never been pressed. "press anything" was already satisfied
   * before it was drawn.
   *
   * It also stops the punch that killed the boss from counting as the press
   * that dismisses the card celebrating it.
   */
  function endScreen() {
    input.flush();
  }

  // --- Render --------------------------------------------------------------
  function render() {
    ctx.save();
    ctx.fillStyle = '#0b0714';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

    const camX = stage.camX;

    for (const layer of CONFIG.LAYERS) {
      if (layer.on === false) continue;
      if (layer.entities) { drawEntities(camX); continue; }
      backdrop.drawLayer(ctx, layer, camX, CONFIG.GAME_W, CONFIG.GAME_H, 1 / 60);
    }

    combat.drawFX(ctx, camX);

    if (player) hud.drawPlayer(ctx, player, lifeBar);
    for (const e of crowd.list) hud.drawEnemy(ctx, e, sheets, camX);
    /* The boss's bar: the SAME hand-drawn bar, top-centre and wider. Up only
       once it has arrived — a bar during the entrance would promise a fight
       that has not started, and the boss cannot be hurt yet anyway. */
    if (stage.boss && stage.boss.arrived() && !stage.boss.dead) {
      lifeBar.render(ctx, stage.boss.hp / stage.boss.maxHp, {
        centre: true, top: CONFIG.flyBossBarTop, wRel: CONFIG.flyBossBarWRel,
      });
    }
    hud.drawGo(ctx, stage.banner, assets.getDrawable('go'), assets.getDrawable('hand'));
    hud.drawDev(ctx);

    /* Hold C. Everything the overlay draws is read from the same code the
       resolver uses — see the header of debug.js. The boss is included so its
       contact box is visible on the same terms as everyone else's punch. */
    if (input.debug) {
      const all = [player].concat(crowd.list).filter(Boolean);
      if (stage.boss) all.push(stage.boss);
      debug.render(ctx, all, stage, backdrop, camX);
    }

    ctx.restore();

    if (phase === 'clear') {
      hud.drawCard(ctx, ['CLEAR', 'press anything'], Math.min(1, phaseT / 0.6));
    } else if (phase === 'dead') {
      /* Held back for the whole watch -- the row playing plus the hold after it.
         Length comes from the pack and the knob, never a literal, so a redraw
         that adds a frame or a change to deathHoldMs cannot start clipping the
         card over the death it was moved out of the way of. */
      const t = player.deathT - player.deathWatch(sheets);
      hud.drawCard(ctx, ['DOWN', 'press anything'], Math.max(0, Math.min(1, t / 0.6)), '#E4463A');
    }
  }

  function drawEntities(camX) {
    /* SORTED BY z, AND THIS IS THE WHOLE ILLUSION. Bigger z is nearer the
       camera, so it is drawn later and therefore in front. Sorting by anything
       else — spawn order, x, health — makes fighters pass through each other in
       the wrong order and the belt stops reading as a floor with depth.

       A copy is sorted rather than the crowd's own list: the AI's token pass
       walks that list, and re-ordering it under the AI every frame would make
       "the closest eligible enemy" a different question each time for no
       reason. */
    const all = [player].concat(crowd.list).filter(Boolean);
    if (stage.boss) all.push(stage.boss);
    all.sort((a, b) => a.z - b.z);

    for (const f of all) drawShadow(f, camX);
    /* The boss draws itself from its own sheets rather than through Sheets —
       its art is a 7-pose turn across two flapping files, not one of the 9x5
       character packs — so it takes `assets` where a fighter takes `sheets`.
       It is sorted into the same z order either way, which is what matters:
       the player must be able to walk in front of it. */
    for (const f of all) {
      if (f === stage.boss) f.draw(ctx, assets, camX);
      else f.draw(ctx, sheets, camX);
    }
  }

  /* The shadow. It is NOT decoration: in a belt-scroller the sprite's feet are
     the only cue to depth, and a jumping fighter's feet leave the floor
     entirely — so without a mark that stays on the ground there is no way to
     read where a jump will land, or which of two fighters is in front. It
     shrinks and fades with height, which is what makes the arc legible. */
  function drawShadow(f, camX) {
    if (f.dead && f.downPhase === 'lie') return;
    const x = f.groundX(camX);
    const y = CONFIG.beltTopY + f.z;

    /* `lift` IS CLAMPED TO 0..1 AND MUST STAY THAT WAY. It used to be
       `jumpY / CONFIG.jumpHeight` — which quietly assumed every shadow-caster
       was a fighter, because jumpHeight is the PLAYER's jump (94px) and nothing
       else's. The Mosca Boss flies: its descend beat sits at 620, giving a lift
       of 6.6, a scale of 1 − 6.6×0.35 = −1.3, and a NEGATIVE ELLIPSE RADIUS,
       which throws.

       That threw inside the shadow pass, which runs BEFORE the sprite pass — so
       no fighters and no HUD were drawn at all — and the exception escaped
       loop() before it could schedule the next frame. One bad radius took the
       whole game down. Normalising against a height any flier can exceed, and
       then clamping, is what makes this total.

       `shadowLiftRef` is the altitude at which a shadow reaches its smallest
       and faintest; past it, it simply stays there. */
    const lift = Math.min(1, Math.max(0, f.jumpY) / CONFIG.shadowLiftRef);
    const s = Math.max(0.05, f.depthScale() * (1 - lift * 0.35));
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.34 * (1 - lift * 0.45));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, CONFIG.shadowW * s, CONFIG.shadowH * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  boot();
})();
