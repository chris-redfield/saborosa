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
  /* THE HAND-LETTERED FRONT END, built once and handed to everything that
     shows a word outside a fight: the title screen (its name, menu, options and
     credits), the select, and the HUD. One instance because it is one sheet --
     two would each keep their own scale and could disagree about how big the
     pack is. */
  const letters = new Letters(assets);
  const title = new Title(assets, sheets, letters);
  /* ⚠️ THE OPTIONS SCREEN NEEDS THE MIXER, and it is set rather than passed
     because `sound` is built above for the whole game and the title screen is
     the only thing on it that changes a volume. */
  title.sound = sound;
  const ending = new Ending(assets, sheets);
  const gameOver = new GameOver(assets);
  /* The CONTINUE? countdown. Takes only `assets`: it draws three pictures over
     a world it never touches -- see the header of continue.js. */
  const cont = new Continue(assets);
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
  const hud = new Hud(letters);
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
  /* The desert's floor of cigarette mounds. Owned here for the reason the flies
     and the props are -- it belongs to a ROOM, and the shell is what changes
     rooms. Pure scenery: nothing else in this file asks it anything. */
  const scenery = new Scenery(assets);
  /* THE BOOKCASE'S WORMS. Level 3 only -- `enterRoom` lays out nothing anywhere
     else -- and pure scenery like the mounds: nothing in this file ever asks one
     a question. See src/vermes.js for why they need a measured track. */
  const vermes = new Vermes(assets);
  /* THE LIFT BETWEEN ROOMS. Not a `new` -- it is a singleton like Level3, for
     the same reason: there is exactly one of it and it is a script, not an
     entity. See src/lift-ride.js. */
  const liftRide = LiftRide;
  /* The day passing over the desert. Owned here for the reason the flies, the
     props and the mounds are -- it belongs to a ROOM, and the shell is what
     changes rooms. Nothing else in this file asks it anything. */
  const grade = new Grade();
  let player = null;
  let phase = 'boot';          /* boot | logo | title | play | outro | ending
                                  | fade | dead | continue | gameover | clear */
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
  /* THE PAUSE, and it is a FLAG rather than a phase on purpose: the play phase
     has a segment, a crowd, a camera and a boss mid-anything, and a phase
     change is the one thing in this file that has repeatedly torn state like
     that in half. Held here, `play` is still `play` and the pause is a frame
     that does not advance it. */
  let paused = false;
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
      frontEnter();          // the logo is SILENT; see titleMusic()
      last = performance.now();
      requestAnimationFrame(loop);
    } else if (CONFIG.title) {
      phase = 'title';
      frontEnter();
      titleMusic();
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
  /**
   * ARRIVING AT THE FRONT OF THE GAME -- the logo, or the title behind it.
   * Everything that has to STOP when the level does.
   *
   * ⚠️ THE VICTORY FANFARE STOPS HERE, AND THAT IS WHY IT IS IN THIS FUNCTION
   * AND NOT AT THE ONE CALL SITE THAT NEEDS IT. The clip is 10.7s and the
   * ending screen plus the whole results board is about ten, so a player who
   * skips the tally reaches the front of the game with it still going. Every
   * route to the front screens goes through here: boot, and toTitle() after a
   * win, a loss or a skip. Put in `toTitle()` alone it would be correct today
   * and wrong the first time a fourth route appeared -- and it WAS written
   * there first, into the wrong function, which is the same mistake one step
   * earlier.
   *
   * ⚠️ AND THE LEVEL'S MUSIC STOPS HERE RATHER THAN BEING SWITCHED. It used to
   * hand straight to MIKE, which meant the theme began on the LOGO. Asked for
   * 2026-08-24: MIKE starts on the BATIDÃO DE CÔCO screen and not before, so
   * the logo is silent and `titleMusic()` is a separate moment.
   */
  function frontEnter() {
    sound.stopOnce('victory', (CONFIG.VICTORY_STING || {}).stopFadeSec);
    sound.stopMusic(0.4);
  }

  /**
   * THE TITLE SCREEN'S OWN THEME, on the frame that screen begins.
   *
   * ⚠️ A COLD BOOT NOW WORKS, AND IT DID NOT USED TO. No browser plays audio
   * before the visitor has interacted, so this was asked for one screen EARLY
   * (on the logo) purely so that a press skipping the logo would unlock the
   * context with the title still to come -- otherwise the first interaction was
   * the press that LEFT the title and MIKE was never heard on a first run.
   *
   * That is no longer true, because the title's press now starts the WALK
   * rather than dismissing the screen: the press unlocks the context, `wanted`
   * in sound.js is already set, and there are seven seconds of crossing left
   * for the theme to play over. The workaround is not merely unnecessary now,
   * it was the thing standing between MIKE and the screen it was asked for.
   *
   * ⚠️ THREE CALL SITES, LIKE `roomMusic()`, and for the same reason: there is
   * no single place the title phase begins. boot() opens on it, the logo hands
   * to it, and toTitle() returns to it without the logo. Asking every frame
   * from the title branch would be a no-op once playing but would call
   * `ctx.resume()` sixty times a second for the whole of a cold boot, which is
   * the exact case this has to be good at.
   */
  function titleMusic() {
    if (CONFIG.TITLE_TRACK) sound.playMusic('musicTitle');
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
       the silent screen back, and titleMusic() is the one place to look. */
    paused = false;          // see start(); the same insurance on the other route
    sound.setPaused(false);
    frontEnter();
    phase = viaLogo ? 'logo' : 'title';
    // Straight to the title: this IS the moment it begins. Via the logo, the
    // logo's own hand-off calls it instead.
    if (!viaLogo) titleMusic();
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
  /* Seconds until the next count-up tick. Reset to 0 whenever the numbers are
     not moving, so re-entering the window always fires on its first frame --
     "starts when the numbers start going up". */
  let boardTickT = 0;

  /**
   * The CLEAR board's numbers, ticking as they climb. `t` is the BOARD's own
   * clock, or -1 when it is not up.
   *
   * ⚠️ IT ENDS WHEN THE NUMBERS DO, NOT WHEN THE BOARD DOES. `resultsRollS` is
   * the moment the last figure lands; `rankDelayMs` of silence then leads into
   * the rank stamp, and `resultsRunS` is half a second further still. Ticking
   * to either of those would fill the pause the stamp lands in.
   *
   * ⚠️ AND A SKIPPED BOARD GOES QUIET BY ITSELF. Pressing during the roll sets
   * `boardSkip` to the end of the board, which jumps `t` straight past the roll
   * -- so the test below stops the tick with no case of its own. That is the
   * whole reason this reads the same clock expression the drawing does rather
   * than counting its own time.
   */
  function boardTick(dt, t) {
    const K = (CONFIG.RESULTS && CONFIG.RESULTS.TICK) || {};
    // Cheap tests first: this runs every frame of the whole game, and the board
    // is up for four seconds of it.
    if (!K.on || t <= 0) { boardTickT = 0; return; }
    const until = hud.resultsRollS(stats);
    if (t >= until) { boardTickT = 0; return; }
    boardTickT -= dt;
    if (boardTickT > 0) return;
    boardTickT = (K.ms || 90) / 1000;
    /* Pitched up across the roll -- a counter at one pitch for four and a half
       seconds is a metronome. `t / until` is the whole climb, not one row's, so
       it rises once rather than eight times. */
    sound.play(K.sfx || 'coin', 1 + (K.rise || 0) * (t / until));
  }

  /**
   * THE WHISTLE IS THE BARATAS' SOUND: it is silent until one is alive on
   * screen and fades out again when the last of them is gone.
   *
   * ⚠️ IT FADES THE LAYER, IT DOES NOT START AND STOP IT -- see
   * Sound.setLayerOn(). The voice runs from the moment the bed does and is only
   * ever turned up and down, so the melody surfaces wherever it happens to be
   * instead of restarting on every roach.
   *
   * ⚠️ ASKED EVERY FRAME ON PURPOSE. A gate reading the world has to; `sound
   * .setLayerOn` is a no-op when it is already where it is being asked to go,
   * so there is no edge to detect here and no flag to leave stale. That is the
   * opposite of `bossMusic()` above, which IS edge-triggered -- because its
   * other branch calls `roomMusic()` and would fight the boss room every frame.
   *
   * ⚠️ IT IS ASKED FROM `update`, NOT FROM `loop`, so only the PLAY phase moves
   * it. A death or a walk-out freezes it where it was rather than re-deciding
   * over a screen with no fight on it -- and the layer is stopped with the bed
   * on any route that leaves the level.
   */
  function whistleGate() {
    const G = CONFIG.WHISTLE_GATE;
    if (!G || !G.layer) return;
    const on = crowd.anyOnScreen(G.kinds || [], stage.camX, G.marginPx);
    sound.setLayerOn(G.layer, on, G.fadeSec);
  }

  /* ⚠️ THREE STATES, NOT TWO, AND `false` IS NOT THE SAME AS ABSENT.
     A room with no `music` gets the level bed -- that is the default and it is
     what every room did before 2026-08-27. `music: false` means the room plays
     NOTHING: the bed is stopped on the way in and the room is silent until
     something else asks for a track.

     ⚠️ IT CANNOT BE EXPRESSED BY PASSING A FALSY KEY, which is why it is a test
     here rather than a value handed to Sound. `playMusic(key)` opens with
     `key || 'music'`, so null, false and '' all mean the bed -- deliberately,
     because that fallback is what makes `roomMusic()` safe to call for a room
     that declares nothing. Silence has to be decided BEFORE that.

     The fade is `stopMusic`'s own default rather than the 0.35 a track SWITCH
     uses: this is the music ending, not one piece giving way to another.

     Added for the desert, which is waiting on songs of its own. */
  function roomMusic() {
    const r = stage.room();
    if (r && r.music === false) { sound.stopMusic(); return; }
    sound.playMusic((r && r.music) || 'music');
  }

  /* Is a boss's own theme playing right now? EDGE-TRIGGERED STATE, not a
     question asked of Sound -- `sound.track` is what is audible, which lags a
     fade and is not the same thing as what the level has decided. */
  let bossTheme = false;

  /**
   * A boss that brings its own music, and the street getting its bed back when
   * she dies. Called every frame of play; it does nothing on the frames where
   * nothing changed.
   *
   * ⚠️ IT IS THE MOSCA AND NOT BOSSES IN GENERAL, and the asymmetry is the
   * design rather than an oversight. She is a SUB-boss mid-street: the bed is
   * already playing, she flies in, and the switch IS the event -- there is no
   * room change to hang it on. The horse's theme is `ROOMS[n].music` because
   * his room opens with a wave of roaches and hanging it on him made it arrive
   * a minute late. So the horse declares no `musicKey`, this does nothing for
   * him, and his "nothing ever stops it" rule is untouched.
   *
   * ⚠️ EDGE-TRIGGERED ON PURPOSE. `playMusic` is a no-op for the track already
   * playing, so calling it every frame would be harmless -- but `roomMusic()`
   * on the other side would then fight the boss room's theme every frame after
   * the horse dies, which is precisely the rule above being broken by the
   * cheaper implementation.
   *
   * ⚠️ AND IT REVERTS ON `dead`, NOT ON `finished()`. She has a death fall and
   * a fade to play out and the segment holds her until they are done; waiting
   * for that would leave her theme running over her own corpse. "Quando ela
   * morre" is when she dies.
   */
  function bossMusic() {
    const b = stage.boss;
    /* ⚠️ `fleeing` ENDS IT AS SURELY AS `dead` DOES. The Mosca's first
       encounter finishes with her alive and leaving, and her theme is the
       FIGHT's, not hers -- held until the segment cleared her away, it played
       over a street with nothing in it to fight. The bed comes back the moment
       she breaks off, which is also the clearest signal the player gets that
       the fight is over rather than paused. Undefined on the horse, so this
       does nothing to him -- see the note above about why he has no theme
       here at all. */
    const want = !!(b && b.musicKey && !b.dead && !b.fleeing);
    if (want === bossTheme) return;
    bossTheme = want;
    if (want) sound.playMusic(b.musicKey);
    else roomMusic();
  }

  function start() {
    stage.reset();
    /* ⚠️ A RIDE MUST NOT OUTLIVE ITS ROOM. It is a singleton, so a run abandoned
       mid-cutscene (a death screen, a DEV jump, a return to the title) would
       otherwise leave `active` true and the next room would open with a slab
       hanging in it and the player's shadow off. */
    liftRide.reset();
    crowd.clear();
    props.clear(player);
    stats.reset();
    /* Cleared here TOO, not only in toTitle(): the title hands straight here,
       and so does the DEV room-jump, so this is the other way a run can begin. */
    endingShown = false;
    /* RUN-SCOPED, so it is reset where a run begins. `bossMusic()` would sort
       itself out on its first frame anyway -- it compares against the world and
       not against itself -- but a flag left true from a fight two runs ago is
       the shape of bug this file keeps finding, and it stops being harmless the
       moment the branch it guards grows a side effect. */
    bossTheme = false;
    /* RUN-SCOPED, like the flag above. Nothing can currently leave the play
       phase while paused -- the branch in loop() returns before the phase
       machine -- so this cannot fire today. It is here because "cannot happen"
       is a property of the code around it rather than of this line, and a pause
       card left over a brand-new run would be a very confusing bug to read. */
    paused = false;
    sound.setPaused(false);   // whatever route got here, the audio is running
    outroTo = 'fade';
    player = new Player(220, Belt.depth * CONFIG.playerStartZRel);
    /* DEV: start somewhere other than the beginning. Applied after the player
       exists, because entering a room places them at its own origin. */
    if (CONFIG.DEV && CONFIG.DEV.on && CONFIG.DEV.startRoom) {
      stage.enterRoom(CONFIG.DEV.startRoom, player);
    }
    /* HE WALKS ON RATHER THAN BEING THERE. ⚠️ AFTER the DEV jump, because
       `enterRoom` is what puts him on his mark and this backs him off WHEREVER
       that is -- read before the jump it would measure from the street's mark
       and walk him in from the wrong place. See CONFIG.playerEnterPx. */
    player.enterWalk(CONFIG.playerEnterPx);
    /* ⚠️ AFTER the DEV jump, not before it: the props belong to whichever room
       the run is actually starting in, and laying out the street's barrels and
       then jumping to the boss room would leave them there. */
    props.enterRoom(stage.room(), player);
    // Same rule, same reason: the flies belong to the room actually starting.
    flies.enterRoom(stage.room(), stage.camX);
    // ...and so does the ground it walks on. See CONFIG.SCENERY.
    scenery.enterRoom(stage.room());
    vermes.enterRoom(stage.room());
    grade.enterRoom(stage.room(), stage);
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
    /* THE PAUSE SCREEN. Read here, above everything, because a pause has to
       beat every other reason a frame might be skipped -- including the hitstop
       return further down, which would otherwise swallow the press for a few
       dozen milliseconds after every punch.

       ⚠️ ONLY FROM `play`, AND OUT FROM ANYWHERE. `phase === 'play' || paused`
       is not belt and braces: without the second half a pause could never be
       lifted, because the branch below returns before anything can change the
       phase and the test would keep asking about a phase nobody is in.

       ⚠️ AND THE PRESS IS FLUSHED BOTH WAYS. Pausing eats whatever was queued,
       which is right -- a punch buffered before a pause is not a punch the
       player still wants three minutes later -- and un-pausing stops the same
       press from also being read as an action on the frame the game resumes. */
    if (input.takePause() && CONFIG.PAUSE && CONFIG.PAUSE.on !== false
        && (phase === 'play' || paused)) {
      paused = !paused;
      /* ⚠️ AND THE SOUND STOPS WITH IT -- the CONTEXT is suspended, not the
         track stopped, so everything resumes on the sample it left off. See
         Sound.setPaused(): stopping the music would restart the horse's 4m39s
         song from the top on every pause. */
      sound.setPaused(paused);
      input.flush();
      /* THE DEV-MODE UNLOCK LISTENS ONLY WHILE THE PAUSE CARD IS UP. Armed and
         disarmed on the EDGE, and `armCheat` forgets the buffer both ways, so
         the word has to be typed at this screen rather than carried to it --
         see CONFIG.DEV_UNLOCK and Input.armCheat. */
      input.armCheat(paused);
    }
    if (paused) {
      /* THE WORLD IS DRAWN, NOT ADVANCED: `render` is the same call the play
         phase makes, so the frame under the card is the frame the player
         stopped on rather than a black screen. Nothing is ticked -- not the
         flies, not the projector's own clock beyond what ran above, not a
         corpse mid-fade.

         ⚠️ AND IT SCHEDULES A FRAME. Leaving `loop()` without one is this
         game's recurring bug and it presents as input being dead on a screen
         that looks completely normal -- which, on a pause screen, would look
         exactly like a pause screen. */
      /* THE UNLOCK. ⚠️ IT WRITES `CONFIG.DEV.on` AT RUN TIME, which is safe
         because every gate on it is a live read inside a function -- the room
         jump, the punch damage, the corner marker, the debug overlay -- so all
         of them answer to this on the very next frame with nothing rebuilt.
         The two that are NOT live are read once and stay read once: `startRoom`
         is a boot-time jump, and `DEV.lives` is taken in Player.fullLives() at
         construction and on a continue, so unlocking mid-run does not top the
         player up. That is the honest behaviour, not a gap -- a cheat that
         handed out lives retroactively would be a different feature. */
      if (CONFIG.DEV_UNLOCK && CONFIG.DEV_UNLOCK.on !== false && CONFIG.DEV
          && input.takeCheat(CONFIG.DEV_UNLOCK.word || 'SABOROSA')) {
        CONFIG.DEV.on = !CONFIG.DEV.on;
      }
      renderFrame(render);
      /* ⚠️ A COPY, NEVER `CONFIG.PAUSE.LINES` ITSELF. Pushing onto the config
         array would append a line to it permanently and once per pause, so the
         card would grow a stack of these over a session. */
      const lines = (CONFIG.PAUSE.LINES || ['PAUSA']).slice();
      /* ⚠️ "SABOROSA MODE", NOT "DEV MODE", ON REQUEST -- this is the only place
         in the game a PLAYER is told about it, so it wears the game's name and
         not the developer's. The corner marker stays `DEV`: that one exists to
         stop a forgotten flag being mistaken for a balance problem, and the
         person reading it is not a player.

         ⚠️ AND THERE IS NO "OFF" LINE. There was one, for the half a session
         between this being built and being played: switching the mode off said
         so on the card, because off otherwise looks exactly like a code that
         was never typed. It was refused on sight -- *"remove the SABOROSA MODE
         OFF text, don't ever make that appear"* -- and it is DELETED rather
         than held behind a flag, which is what this project does with a look
         that was turned down. **The absence of the line IS the off state.** */
      const label = (CONFIG.DEV_UNLOCK && CONFIG.DEV_UNLOCK.label) || 'DEV MODE';
      if (CONFIG.DEV && CONFIG.DEV.on) lines.push(label + ' ON');
      hud.drawCard(ctx, lines, 1, CONFIG.hudColor, CONFIG.PAUSE.dimAlpha);
      requestAnimationFrame(loop);
      return;
    }
    /* Mute is read in EVERY phase, not only in play: a player who wants the
       sound off wants it off now, not once they have got past the title. */
    if (input.takeMute()) sound.toggleMute();

    /* TAB SWAPS THE HERO, in every phase for the same reason mute is: the
       point of it is to LOOK at the two of them, and the title screen is where
       you would most want to.

       ⚠️ IT RETARGETS THE LIVE PLAYER TOO, not just the next one built. The
       pick is read in Player's constructor, so on its own a swap mid-fight
       would do nothing until the next run and read as the key being broken.
       Assigning `kind` is enough and is not a rebuild: the packs share a pose
       table and every hitbox, reach and speed in this game is global, so what
       changes is which atlas the same fighter is drawn from -- see
       CONFIG.PLAYER_PACKS. Health, position, combo state and lives all carry
       across untouched, which is what makes this safe to do mid-punch. */
    if (input.takeSwap()) {
      const k = PlayerPick.next();
      if (player) player.kind = k;
    }

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
      renderFrame(() => logo.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H));
      if (finished) {
        /* Straight to the title, or straight into the fight if there is no
           title screen -- start() schedules its own frame, which is why that
           branch returns immediately. */
        if (CONFIG.title) { phase = 'title'; title.reset(); titleMusic(); input.flush(); }
        else { start(); return; }
      }
      requestAnimationFrame(loop);
      return;
    }

    if (phase === 'title') {
      const finished = title.update(dt, input);
      renderFrame(() => title.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H));
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
      player = new Player(220, Belt.depth * CONFIG.playerStartZRel);
      player.props = props;
      liftRide.reset();          // see start() -- a jump abandons any ride
      stage.enterRoom(jump, player);
      /* AND HE WALKS IN HERE TOO, like the fade and like the start of a run.
         ⚠️ NOT ONLY FOR TIDINESS: the number keys are how a room gets LOOKED AT,
         so a jump that skipped the walk-on would be a shortcut that hides the
         one thing it was used to check. After `enterRoom` for the usual reason
         -- `enterWalk` backs him off the mark he has just been given. */
      player.enterWalk(CONFIG.playerEnterPx);
      props.enterRoom(stage.room(), player);
      flies.enterRoom(stage.room(), stage.camX);
      scenery.enterRoom(stage.room());
      vermes.enterRoom(stage.room());
      grade.enterRoom(stage.room(), stage);
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
      renderFrame(render);
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
    if (phase === 'play' || phase === 'outro' || phase === 'fade'
        || phase === 'liftout' || phase === 'liftin') {
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
      crowd.update(dt, player, stage.bounds(), sheets);
      combat.tick(dt);
      // Out of frame. Where it goes from here depends on why he was walking.
      if (player.groundX(stage.camX) > CONFIG.GAME_W + CONFIG.outroExitPad) {
        phaseT = 0;
        if (outroTo === 'ending') {
          ending.reset();
          endingShown = true;
          phase = 'ending';
          // He comes in from the left over this. See playVictory().
          playVictory();
        } else {
          phase = 'fade';
          faded = false;
        }
      }
    } else if (phase === 'liftout') {
      /* THE LIFT OUT OF THE BOSS ROOM. The same shape as the outro above and
         for the same reasons -- the camera is NOT advanced (*"a tela fica
         parada"*), and the crowd is still ticked because the last body to fall
         is still falling when the fight is declared over. */
      phaseT += dt;
      const done = liftRide.update(dt, player, stage);
      crowd.update(dt, player, stage.bounds(), sheets);
      combat.tick(dt);
      if (done) { phase = 'fade'; phaseT = 0; faded = false; }
    } else if (phase === 'liftin') {
      /* AND THE ARRIVAL, which is the same journey's other end. Nothing else is
         ticked: the room has just been entered, its crowd is empty, and the
         only thing happening is a slab rising into frame from below. */
      phaseT += dt;
      if (liftRide.update(dt, player, stage)) { phase = 'play'; phaseT = 0; }
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
        /* ⚠️ PUT THE RIDER BACK ON THE FLOOR **HERE**, at the blackest point,
           and nowhere earlier. A room left by lift ends with the player 900px
           above it, and the fade DRAWS THE WORLD for its first half -- dropping
           him when the ride finished put him back on the ground in shot for
           ~450ms before the black. This is the one moment nothing is visible. */
        liftRide.clearRider(player);
        /* HE WALKS INTO A NEW ROOM, exactly as he walks on at the start of a
           run -- asked for 2026-08-27, "the character should enter level 2 in
           the same way he did for level 1". He used to simply BE at the room's
           mark when the fade lifted, which reads as a cut into a standing pose
           after a walk-out that was all movement.

           ⚠️ AFTER `enterRoom`, FOR THE REASON THE ONE IN `start()` IS AFTER THE
           DEV JUMP: `enterWalk` measures from where he has already been PLACED
           and backs him off THAT, so it has to be told his new mark first. Read
           before the swap it would walk him in from the previous room's origin.

           ⚠️ AND IT IS EVERY ROOM, NOT A DESERT FLAG. There is no honest way to
           say "walk into this room but not that one" -- entering is what a room
           entry looks like. So the boss room gets it too: HIPÓLITO's room opens
           with a wave of roaches, and the player is now walking in while they
           walk in. He is untouchable while `state === 'enter'` and the wave
           takes its own beat to arrive, so the two overlap rather than collide.
           If it reads wrong there, this line is the whole of it. */
        /* ⚠️ THE WALK-IN IS NOT UNIVERSAL ANY MORE. A room may declare that it
           is ARRIVED IN rather than walked into (`enterByLift`), and the library
           does: he rises into it on the lift he left the boss room on. The note
           below still holds for every other room -- and for this one too, since
           the lift lands him on the mark `enterWalk` would have walked him to.
           The phase is picked up when the fade lifts; see `liftin`. */
        if (stage.room() && stage.room().enterByLift) liftRide.startArrive(player, stage);
        else player.enterWalk(CONFIG.playerEnterPx);
        props.enterRoom(stage.room(), player);
        /* ⚠️ AT THE BLACKEST POINT WITH EVERYTHING ELSE. The street has flies
           and the boss room does not, so swapping them a moment early or late
           would show three of them blinking out over a room that is still
           visible. */
        flies.enterRoom(stage.room(), stage.camX);
        scenery.enterRoom(stage.room());
        vermes.enterRoom(stage.room());
        grade.enterRoom(stage.room(), stage);
        roomMusic();
        input.flush();
      }
      if (phaseT >= (CONFIG.fadeMs || 900) / 1000) {
        phase = liftRide.active ? 'liftin' : 'play';
        phaseT = 0;
      }
    } else {
      phaseT += dt;
      /* THE WORLD IS STOPPED, BUT THE CORPSE IS NOT. Freezing everything the
         moment the player dies is right -- nothing should still be punching a
         dead player -- but the death animation runs on the player's own clock,
         and a frozen clock holds it on frame one. That reads as no death
         animation at all, which is exactly how it looked.

         ⚠️ AND THE SAME WAS TRUE OF HIS BODY, WHICH TOOK LONGER TO NOTICE.
         Ticking the DRAWING alone left `stateT`, the knockdown arc and the
         knockback drift all frozen, so the row played out over a body standing
         exactly where it was hit -- while every enemy, killed in a world that
         was still running, was thrown backwards properly. Fixed 2026-08-24;
         `tickDeath` now moves the body too and needs the BOUNDS to clamp it. */
      if (phase === 'dead') player.tickDeath(dt, stage.bounds());
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
      } else if (CONFIG.CONTINUE && CONFIG.CONTINUE.on) {
        /* ⚠️ THE OFFER COMES BEFORE THE PANEL, AND THE STING DOES NOT MOVE WITH
           IT. `playDeathSting()` is the music of having lost, and on this screen
           he has not lost yet -- it now fires when the count runs out, so the
           panel arrives with the sound it always had and the countdown plays
           over the level's own bed. A sting here would tell the player the
           answer before they had been asked the question. */
        phase = 'continue';
        phaseT = 0;
        cont.reset();
      } else {
        phase = 'gameover';
        phaseT = 0;
        gameOver.roll();      // the phrase, picked once -- see game-over.js
        playDeathSting();
      }
      input.flush();
    }

    /* THE COUNTDOWN. ⚠️ IT IS THE ONLY THING TICKED IN THIS PHASE -- the corpse
       holds mid-fade, the crowd holds where it stood and the plate holds, which
       is what makes the screen read as the game paused on the death rather than
       as somewhere new. See the `if (phase === 'play')` gate above: nothing else
       reaches `update()`. */
    if (phase === 'continue') {
      const r = cont.update(dt, input);
      if (r === 'go') {
        /* A CONTINUE IS A FULL SET OF LIVES AND THE SAME FIGHT. He gets up where
           he fell, with the crowd, the segment and the camera exactly as he left
           them -- the same arrangement every other death in the run uses, which
           is why this is `revive()` and not a room reload.
           ⚠️ THE LIVES GO BACK FIRST. `revive()` puts a body back on its feet
           and says nothing about how many it has left; setting them after would
           work today and break the first time revive() learns to read them. */
        player.lives = (CONFIG.CONTINUE.lives != null)
          ? CONFIG.CONTINUE.lives : player.fullLives();
        player.revive();
        phase = 'play';
        phaseT = 0;
        input.flush();
      } else if (r === 'over') {
        phase = 'gameover';
        phaseT = 0;
        /* WHICH OF THE SEVEN PHRASES, chosen HERE rather than in the panel's
           draw -- see game-over.js. It is the one thing that screen remembers,
           because a pick made from its clock would be re-made every frame. */
        gameOver.roll();
        playDeathSting();
        input.flush();
      }
    }

    const deathLock = (phase === 'dead') ? player.deathLock(sheets) : 0;
    // Is the CLEAR tally still counting up? Derived from the same clock the
    // board draws itself from, so the two can never disagree about it.
    const rolling = phase === 'clear'
      && Math.max(boardSkip, phaseT - 0.45) < hud.resultsRunS(stats);
    /* THE COUNT-UP TICK, on the SAME clock expression the board is drawn from
       (see drawEndCards) so the sound cannot run on a different one. */
    boardTick(dt, phase === 'clear' ? Math.max(boardSkip, phaseT - 0.45) : -1);
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

    renderFrame(render);
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
    crowd.update(dt, player, bounds, sheets);
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

    /* ⚠️ BEFORE stage.update, SO IT IS ASKED ABOUT THE WALLS THE PLAYER JUST
       WALKED INTO rather than the ones a segment change is about to install.
       Called every frame including during fights; `tryingBack` decides when it
       means anything. */
    stage.tryingBack(dt, !!(input && input.left), player);
    const ev = stage.update(dt, player, crowd);

    /* AFTER the stage, so a boss that spawned or died THIS frame is already
       visible to it -- asked a frame early it would start her theme one frame
       after she arrived, which is inaudible, and revert one frame after she
       died, which is not. */
    bossMusic();
    /* IN `update` AND NOT IN `loop`, so it is asked only while the fight is
       running -- see whistleGate(). */
    whistleGate();

    /* THE WALK-OUT IS A DOOR, NOT AN ENDING. Running out of segments with
       another room to go ('room') walks him off the right-hand edge and fades
       into it -- he is leaving for somewhere. Running out in the LAST room
       ('clear') is the end of the game, and walking him off the edge there
       would be walking him out of the level into nothing. */
    /* BOTH ENDINGS WALK HIM OUT NOW. The comment that used to sit here said
       walking him off the edge on 'clear' would be "walking him out of the
       level into nothing" -- true until there was an ending screen for him to
       arrive on. `outroTo` is what the walk-out hands to. */
    if (ev === 'room') {
      /* ⚠️ A ROOM MAY LEAVE BY LIFT INSTEAD OF WALKING OUT. HIPÓLITO's does:
         the player loses the character, walks to a mark and rides up out of
         frame. It is the SAME event -- 'room' is still a door -- only the beat
         that plays through it changes, which is why this is a branch here and
         not a second event. See src/lift-ride.js. */
      if (stage.room() && stage.room().exitByLift) {
        liftRide.startExit(player, stage);
        phase = 'liftout';
      } else {
        phase = 'outro'; outroTo = 'fade';
      }
      phaseT = 0; endScreen();
    }
    else if (ev === 'clear') {
      phase = 'outro'; outroTo = 'ending'; phaseT = 0; endScreen();
      // The fight is over. See endBossMusic() for why it is not the other outro.
      endBossMusic();
    }

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
  /**
   * THE HORSE'S SONG GETTING OUT OF THE WAY, at the moment the last fight is
   * over and the coconut starts walking out.
   *
   * ⚠️ ONLY ON THE WIN, and `outroTo` is the test. The other outro is a walk to
   * the NEXT room, which has its own handling: the fade calls `roomMusic()` at
   * its blackest point, and stopping the bed here would leave the walk-out
   * silent for no reason.
   */
  function endBossMusic() {
    const V = CONFIG.VICTORY_STING || {};
    if (V.on === false) return;
    sound.stopMusic(V.musicFadeSec != null ? V.musicFadeSec : 1.2);
  }

  /**
   * THE FANFARE, on the frame the ending screen begins and he walks in from the
   * left. Deliberately NOT at the same moment the song stops -- the beat of
   * silence between them is what makes this an arrival.
   *
   * ⚠️ `playOnce`, so `toTitle()` can stop it. At 10.7s it outlives a skipped
   * tally and would otherwise ring over the title screen.
   */
  function playVictory() {
    const V = CONFIG.VICTORY_STING || {};
    if (V.on === false) return;
    sound.playOnce('victory');
  }

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
   * ONE FRAME.
   *
   * Everything this game draws goes through here, in every phase -- the title,
   * the fight, the fades, the panels. `body` draws the picture; this clears the
   * frame under it.
   *
   * ⚠️ IT IS A WRAPPER FOR ONE FILL AND THAT IS ENOUGH REASON TO KEEP IT. Six
   * call sites draw six different pictures and every one of them needs the frame
   * cleared first; the alternative is the same two lines copied six times and
   * forgotten in the seventh. It used to hold the projector post-effect too
   * (deleted 2026-08-27, "this is badness from the past").
   */
  function renderFrame(body) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
    ctx.restore();
    body();
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
    /* LEVEL 3 HOOKS 5 AND 6. The bookcase winds its plate by PROGRESS rather
       than by the camera -- its shot is a switchback, so the same camX happens
       three times at three heights and cannot say which frame to show. Handing
       the backdrop a different number here is the whole of it: backdrop.js is
       untouched and never learns that a room with its own clock exists.
       Everything that is genuinely in world space still gets the real camX. */
    const l3 = Level3.owns(stage.room());
    const filmX = l3 ? Level3.filmScroll() : camX;

    for (const layer of CONFIG.LAYERS) {
      if (layer.on === false) continue;
      if (layer.entities) {
        // The lift is drawn UNDER the fighters, like scenery: he stands on it.
        if (l3) Level3.drawPlatform(ctx, stage, assets);
        /* THE BETWEEN-ROOMS LIFT, under the fighters like the room's own -- he
           stands ON it. It draws nothing unless a ride is running. */
        liftRide.draw(ctx, stage, assets, camX);
        drawEntities(camX);
        continue;
      }
      if (layer.scenery) { drawScenery(camX); continue; }
      /* ⚠️ NO `camX`. They are welded to the FOOTAGE, not to the camera, and
         handing them a camera offset is the exact mistake vermes.js exists to
         document. It reads `Level3.progress` itself. */
      if (layer.vermes) { vermes.draw(ctx); continue; }
      if (layer.flies) { flies.draw(ctx, camX); continue; }
      backdrop.drawLayer(ctx, layer, filmX, CONFIG.GAME_W, CONFIG.GAME_H, 1 / 60);
    }

    combat.drawFX(ctx, camX);

    /* ⚠️ THE DAY, AND THE LINE ABOVE IT IS THE WHOLE OF "EXCEPT THE HUD". Every
       layer, every fighter and every hit burst is already down; every bar, the GO
       banner, the room fade, the dev text and the debug overlay come after. There
       is no mask -- moving this one call is how anything joins or leaves the
       grade. See CONFIG.GRADE. */
    grade.update(stage);
    grade.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H);

    if (player) hud.drawPlayer(ctx, player, lifeBar);
    for (const e of crowd.list) hud.drawEnemy(ctx, e, sheets, camX);
    /* The boss's bar: the SAME hand-drawn bar, top-centre and wider. Up only
       once it has arrived — a bar during the entrance would promise a fight
       that has not started, and the boss cannot be hurt yet anyway. */
    /* ⚠️ AND NOT WHILE SHE IS LEAVING. A bar over something that cannot be hurt
       is a lie about what the player is looking at -- and this one would sit
       there at exactly half, inviting the last few punches at a boss already
       out of reach. `fleeing` is undefined on the horse. */
    /* ⚠️ THE NAME GOES UNDER IT, and the whole block moved into `hud.drawBoss`
       for that -- the bar and its nameplate are one readout and drawing them
       from two files is how they drift apart. The GATE stays here, because when
       a bar may be shown is a fact about the fight and not about the drawing. */
    if (stage.boss && stage.boss.arrived() && !stage.boss.dead
        && !stage.boss.fleeing) {
      hud.drawBoss(ctx, stage.boss, lifeBar);
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
    } else if (phase === 'continue') {
      /* OVER THE FIGHT, WITH A 30% VEIL UNDER IT -- and the veil is drawn by
         `Continue` rather than here, because it belongs UNDER the panel's own
         layers and this branch cannot get between them. See CONFIG.CONTINUE
         `veilAlpha`.

         ⚠️ IT IS NOT THE GAME OVER SCREEN'S DIP. That one takes the world all
         the way to black because it is REPLACING it; this one pushes the fight
         back so the question is the foreground, and the fight stays legible
         underneath because it is what the player is deciding about. */
      cont.draw(ctx, CONFIG.GAME_W, CONFIG.GAME_H);
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

  /**
   * THE FLOOR, WITH THE ENEMIES WHO ARE STILL CLIMBING OUT OF IT PAINTED INSIDE
   * IT. Asked for 2026-08-31: *"make them be part of the background during the
   * spawn animation, and right after it finishes, bring them back to the front
   * plane... as if they are leaving from behind the pile of cigarettes"*, then
   * relaxed from a fixed three planes to *"spawn between some layers randomly"*.
   *
   * A digger is drawn between two of the scenery's bands while he is buried and
   * with the crowd the instant he is out. Which two is his own roll -- see
   * `Emerge.pickPlane`.
   *
   * ⚠️ ONE FUNCTION DECIDES WHO IS INJECTED, AND `drawEntities` ASKS THE SAME
   * ONE. If the two lists could ever disagree a fighter is drawn twice or not at
   * all, and "not at all" is an enemy that is invisible until he swings. That is
   * why this is `emergingBehind()` rather than a condition written out twice.
   *
   * ⚠️ AND IT DEGRADES TO THE OLD SINGLE PASS. A room with no scenery lays out
   * no bands, `pickPlane` answers null, nobody is injected and this is
   * `scenery.draw` with extra steps -- so the street and the boss room draw
   * byte-for-byte what they always did.
   */
  function emergingBehind() {
    const E = CONFIG.EMERGE;
    if (!E || !E.on || E.spawnBehindScenery === false) return null;
    if (!scenery.bands) return null;
    let out = null;
    for (const e of crowd.list) {
      const em = e.emerge;
      if (!em) continue;
      if (!em.planeSet) em.pickPlane(scenery.bands);
      if (!em.behindScenery()) continue;
      (out || (out = [])).push(e);
    }
    /* ⚠️ AND THE BOSS, WHO IS NOT IN THE CROWD. `stage.boss` is its own field,
       so a pass that only walks `crowd.list` silently leaves it out -- exactly
       the blind spot the emerge dust hit. HORACIO digs in and out for the whole
       fight rather than once on arrival, so he answers with his own depth-based
       `behindScenery()` and carries his plane on himself instead of on an
       `Emerge` that is long gone. Any boss that does not implement the pair is
       simply never injected, which is the old behaviour. */
    const b = stage.boss;
    if (b && b.behindScenery && b.scenPlane) {
      /* ⚠️ THE WHOLE `scenery`, NOT ITS BAND COUNT. HORACIO picks his plane by
         DEPTH now (see his `scenPlane`), which needs where the bands actually
         sit -- a count cannot answer that. */
      const pl = b.scenPlane(scenery);
      if (pl != null && b.behindScenery()) {
        b._scenPlane = pl;
        (out || (out = [])).push(b);
      }
    }
    /* Deepest plane first, so the injections come out in the order the bands are
       painted and each one only ever needs the range since the last. */
    if (out) out.sort((a, b2) => planeOf(a) - planeOf(b2));
    return out;
  }

  /** A digger keeps its plane on its `Emerge`; a boss keeps it on itself. */
  function planeOf(f) {
    return f.emerge ? f.emerge.plane : (f._scenPlane || 0);
  }

  function drawScenery(camX) {
    const inject = emergingBehind();
    if (!inject) { scenery.draw(ctx, camX); return; }
    let lo = -Infinity;
    for (const f of inject) {
      scenery.drawBands(ctx, camX, lo, planeOf(f));
      lo = planeOf(f);
      /* ⚠️ THE SAME `usesSheets` BRANCH AS `drawEntities`, because a boss can be
         injected here now. Handing HORACIO `sheets` would draw him as nothing at
         all -- his pack is not one. */
      f.draw(ctx, f === stage.boss && !f.usesSheets ? assets : sheets, camX);
    }
    scenery.drawBands(ctx, camX, lo, Infinity);
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
    /* ⚠️ ANYONE THE SCENERY PASS ALREADY PAINTED IS SKIPPED HERE, and the two
       passes ask the SAME function so they cannot disagree. Drawing him again
       would put a second copy of him in front of the mounds that are supposed to
       be covering him, which is the whole effect undone. */
    const behind = emergingBehind();
    for (const f of all) {
      /* THE DIGGERS' DUST, IMMEDIATELY BEFORE THE PLAYER. Asked for 2026-09-01:
         *"should render on top of everything but the player, so it should appear
         in front of the background (the enemy doesn't, and that is on purpose)."*

         ⚠️ THE ENEMY AND HIS DUST ARE DRAWN AT DIFFERENT DEPTHS ON PURPOSE, and
         that is the whole request. A digger is INJECTED INTO THE SCENERY -- the
         cigarette mounds are painted over him, which is what makes him look like
         he is coming through the floor -- and while the burst was part of
         `Emerge.draw` it inherited that plane and got buried with him. A body
         under the floor is the effect; dust under the floor is a bug.

         ⚠️ HERE RATHER THAN AFTER THE LOOP, so the player is never covered.
         Everything painted before this point is scenery, props and the fighters
         behind him, which is what "on top of everything but the player" means in
         a z-sorted pass. A fighter NEARER the camera than the player still draws
         over it -- that is depth working, not the rule being broken.

         ⚠️ AND IT IS NOT INSIDE `drawShadow`'s loop or the sprite loop of any one
         fighter: the dust belongs to a hole in the world, not to the body that
         came out of it, which is the same reason `Emerge` keeps its own copy of
         the spot. */
      if (f === player) drawEmergeDust(camX);
      if (behind && behind.indexOf(f) >= 0) continue;
      if (f === stage.boss) f.draw(ctx, f.usesSheets ? sheets : assets, camX);
      else f.draw(ctx, sheets, camX);
    }

    /* A BOSS'S OWN EXPLOSIONS, LAST OF ALL -- his arrival dust and his death
       string. Added 2026-09-03 with HORACIO's death; a boss without `drawFX` is
       not drawn here, which is the other two's existing behaviour.

       ⚠️ THIS IS A PASS OF ITS OWN AND NOT PART OF HIS `draw()`, because
       HORACIO is INJECTED INTO THE SCENERY whenever he is in the ground -- the
       mounds are painted over him, which is what makes him look like he is
       coming through the floor. Anything drawn from inside `draw()` inherits
       that plane, so his arrival dust was coming out UNDER the cigarettes and
       his death blasts would have too: he is killed at the PEEK more often than
       anywhere else, and the peek leaves him 55% buried for the whole death.
       **A body under the floor is the effect; an explosion under the floor is a
       bug** -- the identical correction the diggers' dust needed on 2026-09-01.

       ⚠️ AND IT IS AFTER THE LOOP RATHER THAN IN THE DUST PASS ABOVE, which is
       a deliberate difference from the mooks' *"on top of everything but the
       player"*. That rule anchors an effect to the PLAYER's slot in the z sort,
       and it works for a digger because a digger is always behind the floor.
       The boss is not: he is drawn from the scenery pass while he is in the
       ground and from this loop while he is out, so a fixed slot means that in
       one of those two cases HIS OWN BODY is painted over his own explosions.
       Last is the only position that is right in both. */
    const bfx = stage.boss;
    if (bfx && bfx.drawFX) bfx.drawFX(ctx, assets, camX);
  }

  /**
   * Every live burst, over the floor. See the note at its call site.
   *
   * ⚠️ THE SHEET IS FETCHED ONCE FOR THE WHOLE PASS rather than per enemy, and
   * a missing one costs the dust and nothing else -- the arrival still reads
   * without it, which is the standing rule for every borrowed asset here.
   */
  function drawEmergeDust(camX) {
    const img = assets && assets.getDrawable('boom');
    if (!img) return;
    for (const e of crowd.list) {
      const em = e.emerge;
      if (em && em.booming) em.drawBoom(ctx, img, camX, e.depthScale());
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
    const y = Belt.topY + f.z;

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
