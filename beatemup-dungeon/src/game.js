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
  /* Built early because Combat takes it: the resolver is where a blow is
     decided, so it is where the blow is heard. */
  const sound = new Sound(assets);
  const sheets = new Sheets(assets);
  /* AFTER `sheets`, because they take it. `const` is not hoisted the way `var`
     is -- reading one before its declaration line throws "can't access lexical
     declaration before initialization" and takes the whole boot down, which is
     exactly what putting this line above `sheets` did.

     ⚠️ THE TITLE MOVED DOWN HERE FOR THAT REASON. It used to be built before
     `sheets` because it only needed a photograph; since 2026-08-22 LEBRON walks
     across it, so it draws out of the same packs the fight does. */
  const title = new Title(assets, sheets);
  const ending = new Ending(assets, sheets);
  const gameOver = new GameOver(assets);
  /* The front door: the vermin and the SABOROSA logo, ahead of the title. It
     takes `gameOver` for its BACKDROP only -- the two screens crawl on one set
     of frames and share the draw, so they cannot fall out of step. */
  const logo = new Logo(assets, gameOver);
  const backdrop = new Backdrop(assets);
  /* `sheets` so it can measure how far off screen an enemy must start -- see
     Stage._spawn(). It is declared above, which this relies on. */
  const stage = new Stage(backdrop, sheets);
  const stats = new Stats();
  /* The impact art. Built before Combat for the same reason Sound is: the
     resolver is where a blow is decided, so it is where the mark is stamped. */
  const hitFX = new HitFX(assets);
  const combat = new Combat(stats, sound, hitFX);
  const hud = new Hud();
  const lifeBar = new LifeBar(assets);
  const debug = new Debug();
  const crowd = new Crowd();
  /* Barrels and food. Owned here rather than by the stage for the same reason
     the crowd is: the shell is what has a player to hand them, and they outlive
     any one segment -- see prop.js. */
  const props = new Props();
  /* The vermin crossing the sky above the belt. Owned here for the same reason
     the props are -- they belong to a ROOM, and the shell is what changes
     rooms. Pure scenery: nothing else in this file asks them anything. */
  const flies = new Flies(assets);
  /* STILL LIFE'S PROJECTOR, the file copied over unchanged and driven from the
     same knobs (CONFIG.film*). It is a post effect and it is the LAST thing
     drawn every frame -- see renderFilmed(). */
  const film = new Film(CONFIG);
  canvas.style.filter = (CONFIG.film && CONFIG.filmCss) ? CONFIG.filmCss : '';

  let player = null;
  let phase = 'boot';          /* boot | logo | title | play | outro | ending
                                  | fade | dead | gameover | clear */
  /* WHAT THE WALK-OUT HANDS TO. The outro is the same beat either way -- he
     walks off the right-hand edge -- but it means two different things: a door
     into the next room, or the end of the game. It used to be able to assume
     the first, because running out of segments in the LAST room went straight
     to the tally and never walked him anywhere. Now it does. */
  let outroTo = 'fade';
  /* True once the ending screen has been shown, so the tally draws over the
     photograph instead of over a boss room the player has already left. */
  let endingShown = false;
  let phaseT = 0;
  let faded = false;           // has the room swap inside a fade happened yet
  let boardSkip = 0;           // >0 = the CLEAR tally was skipped to its end
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
      else if (a.how === 'audio') jobs.push(assets.loadAudio(a.key, a.src));
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
    hitFX.build();
    backdrop.build();

    /* ⚠️ BOOT SCHEDULES THE FIRST FRAME ITSELF when it opens on the title, and
       must NOT also call start(). start() schedules a frame of its own -- that
       is the contract every caller inside loop() relies on -- so doing both
       would leave TWO requestAnimationFrame chains running the same loop, and a
       game that ran at double speed with every dt halved. It would look like a
       physics bug and it would not be one. */
    /* THE FRONT DOOR, IN ORDER: logo, then title, then the fight. Each screen
       hands to the next and each is independently switchable, so `LOGO.on`
       false opens on the title exactly as it did before the logo existed, and
       `title` false goes straight into the fight from either. */
    if (CONFIG.LOGO && CONFIG.LOGO.on) {
      phase = 'logo';
      logo.reset();
      frontMusic();
      last = performance.now();
      requestAnimationFrame(loop);
    } else if (CONFIG.title) {
      phase = 'title';
      frontMusic();
      last = performance.now();
      requestAnimationFrame(loop);
    } else {
      /* Straight into the fight: no front screen, so no front theme. start()
         asks for the room's own music a moment later. */
      start();
    }
  }

  /**
   * The theme the FRONT OF THE GAME plays -- the logo screen and the title
   * behind it. One call covers both because they are one moment: the music
   * carries across the fade rather than starting again on the second screen.
   *
   * ⚠️ IT IS ASKED FOR ON THE LOGO, ONE SCREEN EARLY, AND THAT IS THE POINT.
   * No browser will play audio before the visitor has interacted with the page,
   * and on a cold boot the first interaction is the press that LEAVES the title
   * -- so a theme asked for on the title itself would never be heard on a first
   * run. Asked for here, a press that skips the logo (armMs 250) unlocks the
   * context with the title still to come, and `wanted` in sound.js does the
   * rest. A player who sits through the logo still hears nothing until they
   * have played once; that is the browser's rule and the only way around it
   * costs the player a press.
   *
   * ⚠️ SAFE TO CALL TWICE. playMusic() is a no-op when asked for the track
   * already playing, so this cannot restart the theme mid-screen.
   */
  function frontMusic() {
    if (CONFIG.TITLE_TRACK) sound.playMusic('musicTitle');
    else sound.stopMusic(0.4);
  }

  /**
   * Back to the front of the game after a run — win or lose.
   *
   * ⚠️ IT MUST CLEAR `endingShown`, and forgetting to was a real bug: the flag
   * makes render() draw the ending photograph INSTEAD of the world and return
   * early, so a restart that left it set ran the whole game underneath a still
   * picture. Every button worked, nothing was frozen, and the screen never
   * changed — which reads as being stuck on the ending, not as a stale flag.
   *
   * ⚠️ AND IT SCHEDULES A FRAME, like start() does. Every caller inside loop()
   * relies on that contract; returning without one is this game's recurring bug.
   */
  function toTitle() {
    if (!CONFIG.title) { start(); return; }   // no front screen to go back to
    stage.reset();
    crowd.clear();
    props.clear(player);
    flies.clear();
    stats.reset();
    player = null;
    endingShown = false;
    outroTo = 'fade';
    boardSkip = 0;
    faded = false;
    title.reset();
    /* ⚠️ A RESTART GOES TO THE TITLE, NOT THROUGH THE LOGO, unless asked. The
       run ending at the front of the game was decided when the game over panel
       was pointed here; making the player sit through three seconds of branding
       every time they die is a different thing and it is opt-in. */
    const viaLogo = CONFIG.LOGO && CONFIG.LOGO.on && CONFIG.LOGO.onRestart;
    if (viaLogo) logo.reset();
    /* The bed belongs to the level, not to the front screen -- it is started by
       start() and has to stop here or it would play under the title and then be
       started a second time on the next run. Switching tracks IS the stop:
       Sound only ever holds one music source.

       ⚠️ THE TITLE SCREEN WAS SILENT ON PURPOSE UNTIL 2026-08-24. MIKE was put
       here on 2026-08-22, taken out the same day for not suiting the screen,
       and the note that stood here said not to re-propose it. The user asked
       for it back, and what is there now is not what was tried: a 60s loop cut
       out of the fullest part of the song rather than the whole 4m10s track
       from its quiet opening. See CONFIG.TITLE_TRACK. `TITLE_TRACK` unset takes
       the silent screen back, and frontMusic() is the one place to look. */
    frontMusic();
    phase = viaLogo ? 'logo' : 'title';
    phaseT = 0;
    input.flush();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  /**
   * The music this ROOM plays. Called on every room entry, and on the frame a
   * run begins.
   *
   * ⚠️ IT IS A PROPERTY OF THE ROOM, NOT OF THE BOSS IN IT. The horse's theme
   * was first started when the horse spawned, and that was wrong on sight: the
   * boss room opens with a wave of roaches, so the song only arrived once they
   * were dead and the room's first minute played under the street's bed. The
   * room is the unit the player experiences -- walking through that door is the
   * moment the music changes.
   *
   * ⚠️ AND NOTHING EVER STOPS IT. Requested 2026-08-22: the boss room's track
   * runs through the fight, the horse's death, the walk-out, the ending
   * photograph and the tally, so the last thing the player hears is what they
   * beat the game to. Only toTitle() ends it, because that is where the run
   * ends. Rooms with no `music` get the level bed, and `playMusic` is a no-op
   * when it is asked for what is already playing -- so calling this on every
   * entry cannot restart a track mid-room.
   */
  function roomMusic() {
    const r = stage.room();
    sound.playMusic((r && r.music) || 'music');
  }

  function start() {
    stage.reset();
    crowd.clear();
    props.clear(player);
    stats.reset();
    /* Cleared here TOO, not only in toTitle(): the title hands straight here,
       and so does the DEV room-jump, so this is the other way a run can begin. */
    endingShown = false;
    outroTo = 'fade';
    player = new Player(220, CONFIG.beltDepth * 0.6);
    /* DEV: start somewhere other than the beginning. Applied after the player
       exists, because entering a room places them at its own origin. */
    if (CONFIG.DEV && CONFIG.DEV.on && CONFIG.DEV.startRoom) {
      stage.enterRoom(CONFIG.DEV.startRoom, player);
    }
    /* ⚠️ AFTER the DEV jump, not before it: the props belong to whichever room
       the run is actually starting in, and laying out the street's barrels and
       then jumping to the boss room would leave them there. */
    props.enterRoom(stage.room(), player);
    // Same rule, same reason: the flies belong to the room actually starting.
    flies.enterRoom(stage.room(), stage.camX);
    /* How the player finds what is within reach. Handed over rather than looked
       up globally, so a Player built for the ending screen or a test has none
       and simply cannot pick anything up. */
    player.props = props;
    phase = 'play';
    phaseT = 0;
    boardSkip = 0;
    /* MUSIC STARTS WITH THE LEVEL, not with the page -- boot() sits on a
       progress bar while the art decodes and a bed under a bar that might stall
       reads as the game having begun when it has not. Asking twice is harmless:
       Sound only ever holds one source, and on a restart the old one was
       already released by stopMusic(). */
    roomMusic();
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
    /* THE PROJECTOR RUNS IN EVERY PHASE, and it is ticked here rather than in
       any of them: the grain, the flicker and the gate weave belong to the
       projector, not to what happens to be on the screen. That includes the
       hitstop return below -- the picture is HELD, but a projector holding a
       frame still weaves and still shows grain. */
    if (CONFIG.film) film.update(dt);

    if (input.takePause() && (phase === 'play')) { /* reserved */ }
    /* Mute is read in EVERY phase, not only in play: a player who wants the
       sound off wants it off now, not once they have got past the title. */
    if (input.takeMute()) sound.toggleMute();

    /* THE TITLE SCREEN. It sits above everything else in the loop because it is
       not the game: no simulation, no hitstop, no room jumps, nothing to draw
       but itself.

       ⚠️ BOTH EXITS FROM HERE SCHEDULE A FRAME -- the branch that carries on
       showing the title, and the one that hands over to start(), which
       schedules its own and is why this returns immediately after it. Leaving
       loop() without scheduling is this game's recurring bug: it presents as
       input being dead on a screen that looks completely normal. */
    /* THE LOGO SCREEN. Same shape as the title's branch below it and for the
       same reasons: it is not the game, so there is nothing to simulate, and
       ⚠️ BOTH EXITS SCHEDULE A FRAME -- the one that carries on showing it and
       the one that hands to the title. Leaving loop() without scheduling is
       this game's recurring bug and it presents as input being dead on a screen
       that looks completely normal. */
    if (phase === 'logo') {
      const finished = logo.update(dt, input);
      renderFilmed(() => logo.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H));
      if (finished) {
        /* Straight to the title, or straight into the fight if there is no
           title screen -- start() schedules its own frame, which is why that
           branch returns immediately. */
        if (CONFIG.title) { phase = 'title'; title.reset(); input.flush(); }
        else { start(); return; }
      }
      requestAnimationFrame(loop);
      return;
    }

    if (phase === 'title') {
      const finished = title.update(dt, input);
      renderFilmed(() => title.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H));
      if (finished) { start(); return; }
      requestAnimationFrame(loop);
      return;
    }

    /* DEV: jump straight to a room with the number keys. Instant rather than
       faded — this is a shortcut for testing, and sitting through the fade is
       exactly the waiting it exists to avoid. Consumed either way so the key
       cannot queue up and fire later in a shipping build. */
    const jump = input.takeRoomJump();
    if (CONFIG.DEV && CONFIG.DEV.on && jump >= 0 && CONFIG.ROOMS[jump]) {
      /* A FRESH PLAYER, not the one standing there. The key can be pressed
         mid-combo, mid-knockdown or on the death screen, and carrying any of
         that into the new room is how a shortcut starts producing bugs that
         only a shortcut can produce. */
      crowd.clear();
      player = new Player(220, CONFIG.beltDepth * 0.6);
      player.props = props;
      stage.enterRoom(jump, player);
      props.enterRoom(stage.room(), player);
      flies.enterRoom(stage.room(), stage.camX);
      roomMusic();
      phase = 'play';
      phaseT = 0;
      input.flush();
    }

    /* HITSTOP FREEZES THE SIMULATION, NOT THE RENDERER. Time stops
       advancing; the frame is still drawn, at the full rate. Skipping the draw
       too would show up as a dropped frame — a stutter — rather than as a held
       moment of impact. */
    if (combat.tickFreeze(dt)) {
      renderFilmed(render);
      requestAnimationFrame(loop);
      return;
    }

    /* THE FLIES ARE AMBIENCE AND THEY TICK ON THEIR OWN, above the phase
       machine, in every phase where the world is still on screen. Hanging them
       off update() alone would freeze them through the walk-out and through the
       room fade -- both of which are seconds long and both of which the player
       is watching. They stop with HITSTOP (the early return above) because the
       held moment of impact is supposed to stop everything, and they stop on
       'dead' because the world does.

       ⚠️ THEY TAKE NOTHING AND CHANGE NOTHING. No player, no crowd, no bounds
       -- so there is no order to get wrong here and nothing that can be left
       mid-state by a phase change. That is the whole licence for ticking them
       outside the machine. */
    if (phase === 'play' || phase === 'outro' || phase === 'fade') {
      flies.update(dt, stage.camX);
    }

    if (phase === 'play') {
      update(dt);
    } else if (phase === 'outro') {
      phaseT += dt;
      /* THE LAST BEAT OF THE LEVEL: the coconut walks out to the right and the
         camera does not follow — running it here would chase him and he would
         never reach the edge.

         THE CROWD IS STILL TICKED, and that is not optional. The fight ends the
         instant the last enemy's HP hits zero, which is BEFORE it has fallen:
         its knockdown arc, its landing and its fade all run off `update`. Tick
         only the player and the body that just died hangs in the air mid-fall
         for the whole walk-out. A dead enemy skips its own AI (`Enemy.update`
         guards on `dead`), so this advances the fall and nothing else. */
      player.walkOut(dt);
      crowd.update(dt, player, stage.bounds());
      combat.tick(dt);
      // Out of frame. Where it goes from here depends on why he was walking.
      if (player.groundX(stage.camX) > CONFIG.GAME_W + CONFIG.outroExitPad) {
        phaseT = 0;
        if (outroTo === 'ending') {
          ending.reset();
          endingShown = true;
          phase = 'ending';
        } else {
          phase = 'fade';
          faded = false;
        }
      }
    } else if (phase === 'ending') {
      /* THE WON SCREEN. Nothing else is ticked: the fight is over, the crowd is
         gone and there is no world left to advance -- this is the one phase in
         the game that is genuinely just a picture and a clock. It hands to the
         tally when the arms-up pose has been held its beat. */
      phaseT += dt;
      if (ending.update(dt)) { phase = 'clear'; phaseT = 0; endScreen(); }
    } else if (phase === 'fade') {
      phaseT += dt;
      /* THE ROOM CHANGES AT THE BLACKEST POINT, halfway through, so the swap
         itself is never seen: the shot, the camera origin and the player's
         position all move behind the black. Anything switched before or after
         shows as a cut on one side of the fade. */
      const half = (CONFIG.fadeMs || 900) / 2000;
      if (!faded && phaseT >= half) {
        faded = true;
        crowd.clear();
        stage.enterRoom(stage.roomIndex + 1, player);
        props.enterRoom(stage.room(), player);
        /* ⚠️ AT THE BLACKEST POINT WITH EVERYTHING ELSE. The street has flies
           and the boss room does not, so swapping them a moment early or late
           would show three of them blinking out over a room that is still
           visible. */
        flies.enterRoom(stage.room(), stage.camX);
        roomMusic();
        input.flush();
      }
      if (phaseT >= (CONFIG.fadeMs || 900) / 1000) { phase = 'play'; phaseT = 0; }
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
    /* ⚠️ DYING SPENDS A LIFE FIRST, AND ONLY THE LAST ONE ENDS THE RUN. The
       death row plays out and holds (see Fighter.deathWatch); then either he
       gets back up where he fell with a moment of invulnerability -- the genre's
       arrangement, and what the "LEBRON x2" beside the bar has always claimed --
       or, on the last life, the screen dips to black and the game over panel
       comes up. Nothing is asked of the player until it has arrived; see
       GameOver.armedAtMs().

       IT HAPPENS BY ITSELF EITHER WAY. A respawn that waited for a keypress
       would be a second thing to dismiss on top of the death animation. */
    if (phase === 'dead' && player.deathLock(sheets) <= 0) {
      player.lives--;
      if (player.lives > 0) {
        /* BACK INTO THE FIGHT, NOT INTO A FRESH ROOM. The crowd, the segment
           and the camera are exactly where they were -- he was the only thing
           that stopped, and the world froze around him while the body fell. */
        player.revive();
        phase = 'play';
        phaseT = 0;
      } else {
        phase = 'gameover';
        phaseT = 0;
        playDeathSting();
      }
      input.flush();
    }

    const deathLock = (phase === 'dead') ? player.deathLock(sheets) : 0;
    // Is the CLEAR tally still counting up? Derived from the same clock the
    // board draws itself from, so the two can never disagree about it.
    const rolling = phase === 'clear'
      && Math.max(boardSkip, phaseT - 0.45) < hud.resultsRunS(stats);
    /* The panel arms its own press, derived from when the word finishes
       arriving -- so retiming the reveal moves the arming with it. */
    const overArmed = phase === 'gameover'
      && phaseT * 1000 >= (CONFIG.GAME_OVER.fadeOutMs || 0) + gameOver.armedAtMs();
    if ((overArmed || (phase === 'clear' && phaseT > 1.2))
        && deathLock <= 0 && input.takeAnyPress()) {
      /* ⚠️ A PRESS ON A **ROLLING** BOARD SKIPS IT, IT DOES NOT DISMISS IT.
         The CLEAR board counts its figures up, and a player who presses during
         that has said "get on with it", not "I have finished reading numbers I
         have not been shown yet". So the press is spent finishing the tally —
         `boardSkip` is just the clock jumped forward, because drawResults
         derives everything from that one value — and the NEXT press restarts.

         ⚠️ IT MUST TEST WHETHER THE TALLY IS STILL RUNNING, not merely whether
         it has been skipped once. Written as `!boardSkip` this ate the first
         press on a FINISHED board — the player pressed, nothing whatsoever
         happened, and only a second press restarted.

         ⚠️ AND IT MUST NOT RETURN. Everything below this schedules the next
         frame; a `return` here left the loop unscheduled, so the game stopped
         dead on the board and no press after it was ever read. That is the same
         shape as the shadow exception in the bug list — anything that leaves
         loop() early has to have called start(), which schedules its own. */
      if (rolling) boardSkip = hud.resultsRunS(stats);
      /* BOTH ENDINGS GO BACK TO THE FRONT OF THE GAME, and dying used to be the
         exception -- it went straight back into play, on the arcade rule that a
         death is a retry and nobody should have to sit through a title screen
         to have another go.

         ⚠️ THAT RULE IS ABOUT A DEATH, AND THIS IS NOT ONE. The retry already
         happened, twice: a life is spent and the fight resumes where it fell,
         and only the THIRD death reaches this panel. By then the run is over in
         exactly the sense the CLEAR board's is, so it ends where a run ends.
         Changed on request, 2026-08-22. */
      else { toTitle(); return; }
    }

    renderFilmed(render);
    requestAnimationFrame(loop);
  }

  function update(dt) {
    /* THE RUN CLOCK RUNS HERE AND NOWHERE ELSE, which is what makes it the time
       the player was PLAYING: `update` is only called in the play phase, so
       fades between rooms, the walk-out and every end screen are outside it. A
       clock started at boot would mostly measure how long the CLEAR board was
       left on screen. */
    stats.tick(dt);
    combat.tick(dt);
    backdrop.update(dt);

    const bounds = stage.bounds();
    player.update(dt, input, bounds);
    crowd.update(dt, player, bounds);
    if (stage.boss) stage.boss.update(dt, player, bounds);

    // Hits are resolved AFTER both sides have moved, so a punch and a step that
    // happen on the same frame are judged against where everyone ended up.
    /* ⚠️ PROPS ARE UPDATED BEFORE HITS ARE RESOLVED, like everything else that
       moves: a barrel in flight has to be where it actually is this frame
       before anything asks what it is touching. */
    props.update(dt, player, crowd, combat, stage.bounds(), stage.boss);
    combat.playerHits(player, crowd, stage.boss, props);
    combat.crowdHits(crowd, player);
    combat.bossHits(stage.boss, player);

    const ev = stage.update(dt, player, crowd);

    /* THE WALK-OUT IS A DOOR, NOT AN ENDING. Running out of segments with
       another room to go ('room') walks him off the right-hand edge and fades
       into it -- he is leaving for somewhere. Running out in the LAST room
       ('clear') is the end of the game, and walking him off the edge there
       would be walking him out of the level into nothing. */
    /* BOTH ENDINGS WALK HIM OUT NOW. The comment that used to sit here said
       walking him off the edge on 'clear' would be "walking him out of the
       level into nothing" -- true until there was an ending screen for him to
       arrive on. `outroTo` is what the walk-out hands to. */
    if (ev === 'room') { phase = 'outro'; outroTo = 'fade'; phaseT = 0; endScreen(); }
    else if (ev === 'clear') { phase = 'outro'; outroTo = 'ending'; phaseT = 0; endScreen(); }

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

  /**
   * The music the run ends on. STILL LIFE'S, and played the way that game plays
   * it -- see CONFIG.GAME_OVER_STING.
   *
   * ⚠️ FIRED WHEN THE PANEL IS ARMED, NOT WHEN THE BODY HITS THE FLOOR. The
   * death animation and its hold run first; starting the sting under them would
   * spend its opening bars on a fight that is still visibly finishing, and the
   * screen it belongs to would arrive halfway through it. That is also where
   * Still Life fires its own -- on the panel, not on the death.
   *
   * ⚠️ AND THE BED GETS OUT OF THE WAY. This is music replacing music, not an
   * effect over it; left running, the level's loop plays through the whole
   * thing. `stopMusic` releases the source, so the next run's start() builds a
   * fresh one -- which is what it already does on every restart.
   */
  function playDeathSting() {
    const S = CONFIG.GAME_OVER_STING || {};
    if (S.on === false) return;
    sound.stopMusic(S.musicFadeSec != null ? S.musicFadeSec : 0.35);
    const rate = S.rate || 1;
    sound.play('gameOver', rate);
    /* The second voice, off the same decoded buffer -- one more source node and
       nothing else. Divided by `rate` because the gap is written in the clip's
       own time; see the config note. */
    if (S.doubleDelayMs > 0) {
      sound.play('gameOver', rate, (S.doubleDelayMs / 1000) / rate);
    }
  }

  // --- Render --------------------------------------------------------------
  /**
   * ONE FRAME, THROUGH THE PROJECTOR.
   *
   * Everything this game draws goes through here, in every phase -- the title,
   * the fight, the fades, the panels. `body` draws the picture; this puts it on
   * film.
   *
   * ⚠️ THE FRAME IS CLEARED BEFORE THE WEAVE, NOT AFTER. The gate jitter
   * translates the whole picture by a pixel or so, so the clear has to happen
   * in UNSHIFTED space or the strip the picture has just moved off keeps last
   * frame's pixels -- a smear along one edge that looks like a rendering bug
   * rather than like a projector.
   *
   * ⚠️ AND THE OVERLAY IS NOT WEAVED WITH IT. Grain, vignette, frame line and
   * flicker are the PROJECTOR; they stay nailed to the screen while the picture
   * moves under them. Drawn inside the translate they would ride along and the
   * weave would stop being visible at all. Still Life's arrangement, kept.
   */
  function renderFilmed(body) {
    const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    if (CONFIG.film) ctx.translate(0, film.weaveOffset());
    body();
    ctx.restore();

    if (CONFIG.film) film.render(ctx, W, H);
  }

  function render() {
    ctx.save();
    ctx.fillStyle = '#0b0714';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

    /* ⚠️ ONCE THE ENDING IS UP THE WORLD IS NOT DRAWN AT ALL, and the flag is
       `endingShown` rather than `phase === 'ending'` deliberately: it has to
       stay true through the CLEAR phase that follows, or the tally would fade
       up over the boss room he just left. Nothing in the world is being ticked
       by then either, so drawing it would be showing a frozen frame of a place
       the game has finished with. */
    if (endingShown) {
      ending.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H);
      ctx.restore();
      drawEndCards();
      return;
    }

    const camX = stage.camX;

    for (const layer of CONFIG.LAYERS) {
      if (layer.on === false) continue;
      if (layer.entities) { drawEntities(camX); continue; }
      if (layer.flies) { flies.draw(ctx, camX); continue; }
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

    /* THE ROOM FADE, drawn over everything including the HUD -- a health bar
       floating over black would give the cut away. Down to black across the
       first half, back up across the second. */
    if (phase === 'fade') {
      const full = (CONFIG.fadeMs || 900) / 1000;
      const t = Math.min(1, phaseT / full);
      ctx.save();
      ctx.globalAlpha = 1 - Math.abs(t - 0.5) * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
      ctx.restore();
    }

    hud.drawDev(ctx, stage.room() ? stage.room().name : '', props);

    /* Hold C. Everything the overlay draws is read from the same code the
       resolver uses — see the header of debug.js. The boss is included so its
       contact box is visible on the same terms as everyone else's punch. */
    if (input.debug) {
      const all = [player].concat(crowd.list).filter(Boolean);
      if (stage.boss) all.push(stage.boss);
      debug.render(ctx, all, stage, backdrop, camX);
    }

    ctx.restore();
    drawEndCards();
  }

  /* The two cards that sit OVER whatever was just drawn -- the tally and the
     death screen. Pulled out of render() because the ending screen replaces the
     world but must keep them: the tally has to land on the photograph, not on a
     boss room the player has already walked out of. */
  function drawEndCards() {
    if (phase === 'clear') {
      hud.drawResults(ctx, stats,
                      Math.max(boardSkip, phaseT - 0.45),
                      Math.min(1, phaseT / 0.6));
    } else if (phase === 'gameover') {
      /* ⚠️ THE FIGHT DIPS TO BLACK FIRST, AND THE PANEL ONLY THEN ARRIVES.
         Cross-fading straight from the belt to the worms reads as a glitch; a
         moment of black reads as a cut. That is the flying dungeon's own
         sequencing and the reason `holdMs` exists.

         The dead player's own fade keeps running underneath the veil, because
         `tickDeath` is still called in the 'dead' phase and the body is still
         drawn -- it goes out with the picture rather than being cut off, which
         is the same rule the corpses in the crowd now follow. */
      const t = phaseT * 1000;
      const fo = CONFIG.GAME_OVER.fadeOutMs || 900;
      if (t < fo) {
        ctx.save();
        ctx.globalAlpha = gameOver.worldVeil(t);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
        ctx.restore();
      } else {
        gameOver.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H, t - fo);
      }
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
    /* ⚠️ PROPS SORT INTO THE SAME PASS, and it is `sortZ` rather than `z` that
       is sorted on. For everything else the two are the same number; for a
       barrel being CARRIED it is the holder's z plus a hair, which is what puts
       it in front of the man holding it over his head rather than behind his
       own face. Barrels and food answer the same tiny interface fighters do, so
       nothing here needs to know which is which. */
    const all = [player].concat(crowd.list, props.all()).filter(Boolean);
    if (stage.boss) all.push(stage.boss);
    all.sort((a, b) => (a.sortZ != null ? a.sortZ : a.z) - (b.sortZ != null ? b.sortZ : b.z));

    for (const f of all) drawShadow(f, camX);
    /* A BOSS SAYS WHICH ART SOURCE IT WANTS, because the two do not agree. The
       Mosca's art is a 7-pose turn across two flapping files, so it takes raw
       `assets`; the horse is a proper ragged pack and takes `sheets` like any
       fighter. Asked rather than hardcoded -- this branch used to hand every
       boss `assets`, which would have drawn the horse as nothing at all.
       Either way it is sorted into the same z order, which is what matters:
       the player must be able to walk in front of it. */
    for (const f of all) {
      if (f === stage.boss) f.draw(ctx, f.usesSheets ? sheets : assets, camX);
      else f.draw(ctx, sheets, camX);
    }
  }

  /* The shadow. It is NOT decoration: in a belt-scroller the sprite's feet are
     the only cue to depth, and a jumping fighter's feet leave the floor
     entirely — so without a mark that stays on the ground there is no way to
     read where a jump will land, or which of two fighters is in front. It
     shrinks and fades with height, which is what makes the arc legible. */
  function drawShadow(f, camX) {
    if (f.noShadow) return;          // the horse -- see its constructor
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
