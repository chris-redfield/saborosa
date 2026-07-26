/**
 * CONFIG — every tunable for the Flying Dungeon jam game, in one place.
 *
 * Values are the locked-in defaults dialled in via the preview tool
 * (tools/dungeon-tray-anim.html). Keep this file plain data: no logic, so it
 * lifts into the main game (or a settings screen) untouched.
 */
const CONFIG = {
  // Asset base. Dev reads the shared assets in the repo; package.sh rewrites
  // this one line to './assets/flying-dungeon/' for the self-contained itch build.
  ASSET_BASE: '../assets-v2/flying-dungeon/',

  /* Controller mapping. THE MAIN GAME'S OWN FILE, not a copy — a pad set up
     once in tools/gamepad-mapper.html works in both, and there is no second
     copy to drift. Which is why it sits outside ASSET_BASE and gets its own
     line for package.sh to rewrite.
     Optional: if it is missing, input.js keeps its standard-layout defaults. */
  GAMEPAD_MAPPING: '../assets/gamepad-mapping.json',

  /* --- Music -------------------------------------------------------------
     The background track: three takes layered, aligned and cropped to a
     seamless 14.452s loop in tools/music-lab.html, then bounced to this single
     file by tools/bake-trilha.py. The game does no mixing — see src/sound.js
     for why that had to be settled offline.

     Under ASSET_BASE rather than a path of its own, so package.sh's existing
     one-line rewrite carries it into the build with everything else and there
     is no second path to keep in step. */
  MUSIC_TRACK: 'audio/trilha-mix.ogg',
  musicVolume: 0.4455,   // M mutes, which rides above this. 0.55 → 0.495 → here
  // How long the bed takes to go down when a run ends. Not a hard stop: cutting
  // a buffer source dead chops the waveform mid-cycle and clicks. It also wants
  // to be shorter than overFadeOutMs (900ms) so the music is gone by the time
  // the picture is, rather than still going under a black screen.
  musicFadeOutMs: 420,

  /* --- Held loops --------------------------------------------------------
     Sounds that report a STATE the player is holding, not an event. Both of
     these hang off the same beam: it is re-tested every frame while fire is
     down, so there is no per-shot moment to hang a one-shot on, and a one-shot
     retriggered per frame would be sixty overlapping copies a second.

       gun      while the gun is actually shooting
       coinHit  while that beam is crossing a coin — the coin taking damage

     `loopTrimMs` is skipped off each end of the LOOP REGION only.
     build-sound.py fades 12ms in and out of everything it builds, which is
     right for a clip played once and wrong for one played end to end: the two
     fades meet at the wrap and punch a 24ms hole in the sound, once per pass.
     The fade-in still plays as the attack when the loop first starts —
     playback simply never returns to it. */
  LOOPS: {
    gun: { src: 'audio/efeito-metralha-01.ogg', volume: 0.495, loopTrimMs: 12 },
    // Two hits per 1.1s pass. It plays UNDER the gun, which is running at the
    // same time by definition — you cannot be hitting a coin without firing —
    // so it is mixed to sit inside the gun rather than fight it.
    coinHit: { src: 'audio/coin-hit-01.ogg', volume: 0.605, loopTrimMs: 12 },
  },

  /* --- Movement one-shots ------------------------------------------------
     Climbing and diving. The opposite of the gun in every respect: fired on the
     PRESS rather than the hold, never looped, and never cut short — holding up
     plays this once and lets it end, and letting go does not stop it.

     ⚠️ A second press of the SAME direction while it is still playing is
     IGNORED, not stacked and not restarted. "Plays entirely" and "retriggers
     on every press" cannot both be true, and in a game where the player is
     nudging up and down constantly, stacking would be a pile of overlapping
     whooshes. The two directions are independent of each other, so changing
     direction always speaks. */
  /* An entry is either a path, or `{ src, volume }` when the clip needs its own
     level. The death sting does: it is a piece of MUSIC standing in for the bed
     that has just stopped, not a sound effect sitting under one, so it plays at
     full on a bus tuned for whooshes. */
  SFX: {
    up: 'audio/efeito-pra-cima-01.ogg',
    down: 'audio/efeito-pra-baixo-01.ogg',
    /* Plays on all three bad endings, when the PANEL arrives — not when the
       player dies. `double` plays a second voice off the same decoded buffer
       behind the first: no second file and no second decode, just one more
       source node reading the same samples.

       At 50ms (56ms of real time once `rate` is applied) it is right on the
       EDGE OF FUSION — the ear stops hearing two attacks somewhere around 40ms,
       so this is nearly one thickened sound with a hard edge on it rather than
       two. Below ~40ms it fuses completely and starts to colour the tone
       instead (comb filtering); it was 100ms, a slapback, and 300ms before
       that, a canon. Small changes here are not subtle. */
    /* Both boss kills. Only the FIRST PART of the take: it is two pieces with a
       620ms break at 10.88s, and build-sound.py cuts there — see OVERRIDES.

       Unlike the death sting, this plays OVER the bed rather than instead of
       it: nothing stops the music, and being on the SFX bus it simply layers.
       That is the difference between winning a fight and ending a run — the
       music carries on because the game does. */
    victory: {
      src: 'audio/victory-sound-01.ogg',
      volume: 1,
    },
    gameOver: {
      src: 'audio/game-over.ogg',
      volume: 1,
      // 10% slower, and it slows the WHOLE combination: `delayMs` is in the
      // clip's own time, so the 50ms gap stretches to 56ms of real time along
      // with the material. It resamples rather than time-stretches, so the
      // pitch drops with it (~1.8 semitones) — on a death sting, the point.
      rate: 0.9,
      double: { delayMs: 50, volume: 1 },
    },
  },
  sfxVolume: 0.6,

  // --- Canvas: fixed internal resolution (matches the main game) ----------
  GAME_W: 1280,
  GAME_H: 720,           // CSS-scaled to the window with letterboxing

  // --- Intro: the storyboard roll -----------------------------------------
  // 12 panels, drawn from the masters by tools/build-intro-frames.py (64MB of
  // PNG -> 1MB of webp), each exactly canvas-sized. The camera only ever moves
  // DOWN, never in X.
  //
  // Most panels don't move the camera at all: the shot is identical and only
  // the printed text changes, so the new panel CUTS IN in front of the old one.
  // The camera rolls down only where the shot actually changes.
  INTRO_FRAMES: 12,
  intro: true,           // false = straight into the game
  // Boards to leave out, by 0-based index — they're skipped, not renumbered, so
  // every index below still means the board with that number on disk (and the
  // file is never even fetched). Board 6 was a MOCK-UP of the fruit select
  // (cards drawn onto the picture); the real interactive one now opens over
  // board 5 instead, so 6 would just play it twice.
  introOmit: [5],
  // Board the sequence parks on to hand over to the player. It holds, the select
  // window opens in front of it, and the roll resumes once a fruit is confirmed.
  introSelectAt: 4,      // board 5, the "SELECT FRUIT" card
  // 0-based indices of the panels the camera ROLLS DOWN to. Everything else
  // cuts in place. Boards 3->4 and 6->7 are the two real camera moves (the
  // fruit rising into frame, then the push in on the basket).
  introRollBefore: [3, 6],
  // How FAR each of those rolls travels, in px. The rolling boards are
  // overlapping crops of one taller scene — board 4's top 414px IS board 3's
  // bottom — so travelling a full canvas height replays scene that was already
  // on screen, and you see the join. These are the offsets where the shared
  // content registers, measured by tools/intro-align.py (re-run it if the art
  // changes). Anything not listed rolls a full GAME_H.
  introRollPx: {
    3: 306,   // boards 3->4 share 414 px of scene
    6: 672,   // boards 6->7 share 48 px of scene
  },
  introHoldMs: 520,      // dwell on a panel before the next one
  // Travel time for a FULL canvas-height roll; a shorter roll scales down
  // proportionally, so the camera moves at one constant speed throughout.
  introRollMs: 620,
  // Per-panel overrides, by 0-based index. Panels 8-10 are the 3-2-1 countdown
  // and 11 is GO! — these cut, so the hold IS the whole beat.
  introBeats: {
    7:  { hold: 1040 },  // "STOP DECAY" — doubled from the 520 default; it also
                         // lengthens the liftoff window, which is derived below
    8:  { hold: 1000 * 0.85 }, // "3" — a second each, then accelerated 15%
    9:  { hold: 1000 * 0.85 }, // "2"
    10: { hold: 1000 * 0.85 }, // "1"
    11: { hold: 900 * 0.85 },  // "GO!" — same 15%
  },
  introFadeInMs: 550,    // black -> first panel
  introFadeOutMs: 420,   // last panel -> black -> game
  introSkipFadeMs: 200,  // faster fade when the player skips out
  introHintText: 'press any key to skip',
  introHintInMs: 1600,   // when the hint fades in
  introHintHoldMs: 3200, // how long it stays before fading out

  // --- Liftoff (the takeoff played over the countdown) --------------------
  // The gridded cloth at the bottom of boards 8-12 is the runway: the chosen
  // plane sits on it, rolls, rotates and climbs out — timed to STOP DECAY,
  // 3, 2, 1, GO!. Positions are fractions of the canvas and describe the ART's
  // centre-x / belly-y, not the sprite frame's corner (the art floats inside a
  // 660x507 frame; liftoff.js FOOT holds where it actually sits).
  //
  // The phase fractions below are of the WHOLE countdown window, whose length
  // the intro derives from introBeats — so retiming the countdown retimes the
  // takeoff to match. At the current beats that window is ~3.6s:
  //   0.00-0.07 lead   0.07-0.31 "3"   0.31-0.55 "2"   0.55-0.79 "1"   0.79-1.00 GO!
  introLiftoffFrom: 8,   // board 9 ("3") — the board the takeoff is timed to
  // Head start: begin the takeoff this long BEFORE that board arrives, so the
  // plane is already rolling as "3" cuts in. It sits inside board 8's 1040ms
  // hold, so it never reaches back into the camera roll or the fruit select
  // (which has no clock at all — see _msUntilBoard). The lead is added to the
  // window above, so starting sooner lengthens the takeoff rather than ending
  // it early.
  introLiftoffLeadMs: 250,
  // Playback rate of the takeoff itself. The window above comes from the intro
  // beats; this compresses the ANIMATION inside it without retiming the
  // countdown. Above 1 the plane clears frame early and the last of GO! plays
  // with an empty sky.
  //
  // Held at 1 so the takeoff fills the whole derived window (3565ms at the
  // current beats). It ran at 1.2 while the window was the 4879ms one that came
  // from timing to STOP DECAY; retargeting to "3" already cut the window to 61%,
  // and stacking the 20% on top of that made the roll-out read as hurried.
  liftSpeed: 1.0,
  liftScale: 0.32 * 0.6 * 1.6,        // same size as the in-game plane
  liftStartX: -0.18,     // OFF the left edge: it enters already rolling, rather
                         // than being parked on screen waiting for the count
  liftGroundY: 0.88,     // where the belly rests on the runway
  liftExitX: 1.15,       // off the right edge — tuned so it clears frame
                         // AS the window ends, not a beat early
  liftExitY: -0.30,      // and above the top
  // Shape of the ground roll. 0 = pure acceleration from a standstill, 1 = flat
  // constant speed. It starts off-screen, so pure acceleration would waste the
  // slow part out of sight and the plane wouldn't appear until halfway through
  // the count; the blend has it already moving as it comes into frame (~"3")
  // and still gaining speed by the time it rotates.
  liftRollBlend: 0.45,
  liftRevUntil: 0,       // parked-with-the-brakes-on phase; 0 = none, it arrives
                         // mid-roll (the shake knobs below only apply if > 0)
  liftRotateAt: 0.70,    // nose up + wheels leave (late in "1", into GO!)
  liftRevAmp: 3,         // px of engine shake while parked
  liftRevFreq: 42,       // rad/sec

  // --- Fruit select (the interactive board inside the intro) --------------
  // Same art and same trick as the main game's src/screens/select.js: a 3-frame
  // idle loop that exists twice over, pixel-aligned — a GRAY line-art base and a
  // COLOURED twin. Both loops always run (every fruit keeps moving); the chosen
  // one lights up because the coloured twin of the SAME frame is drawn clipped
  // to its panel. Art built by tools/build-select-frames.py.
  //
  // Rects are in the art's own 866x682 space and are the main game's tuned
  // values (from tools/fruit-select-editor.html) — they hug the fruit frames,
  // clear of the "SELECT FRUIT" title band. `character` indexes CHARACTERS.
  SELECT_PANELS: [
    { name: 'JUIXY', character: 0, rect: { x: 163, y: 147, w: 212, h: 400 } }, // lemon
    { name: 'ERKPA', character: 2, rect: { x: 386, y: 147, w: 190, h: 400 } }, // eggplant
    { name: 'TOM',   character: 1, rect: { x: 585, y: 147, w: 205, h: 400 } }, // tomato
  ],
  // Rows of art to cut off the TOP. The board carries its own "SELECT FRUIT"
  // title, but the intro panel underneath already says it — so the title band
  // (rows 62-142) is dropped and only the three fruit panels are drawn. 146 is
  // the last empty row of the gutter above the panels in all six frames, so the
  // cut takes no art with it.
  selectCropTop: 146,
  // Fraction of the screen the board fills. Measured against the FULL content
  // box (title included), so this number keeps meaning what it did before the
  // crop. 0.81 is the main game's value; × 0.6 shrinks the window to 60% of it.
  selectFill: 0.81 * 0.6 * 0.85,
  // Nudge off centre, in canvas px. The board is parked just clear of the "T"
  // of FRUIT printed on the panel underneath: that T ends at x=744 (measured on
  // saborosa-intro-05.webp), and at this scale the panels are 412px wide, so
  // +326 puts their left edge at 760 and still leaves a 107px right margin.
  selectOffsetX: 326,
  selectOffsetY: 120,
  selectFrameMs: 180,    // ms per idle frame (the "moving" effect)
  selectEnterMs: 400,    // fade + scale-up as the window opens
  selectConfirmMs: 550,  // total lock-in beat before the intro resumes
  selectStampMs: 400,    // pop settle time on the chosen fruit
  selectShakeMs: 180,    // board shake decay
  selectShakeAmp: 9,     // px

  // --- Game clock ---------------------------------------------------------
  // The run's own time, kept separate from the wall clock (see game-clock.js).
  // It exists as its own meter because the planned rewind feature needs a time
  // base that can be wound BACKWARDS — not a counter that only goes up.
  //
  // Game ms per real ms. 1.1 = the run clock gains 10% on the wall, so a minute
  // of real play reads 01:09 on the HUD. Note this currently scales the CLOCK
  // only — the simulation still steps on the real delta, so game feel is
  // unchanged. When rewind lands, the sim should switch to the game delta that
  // GameClock.advance() returns, or the world and the clock will disagree about
  // when things happened.
  gameClockRate: 1.15,

  // --- HUD ----------------------------------------------------------------
  // Drawn on the CANVAS, in screen space, so it scales and letterboxes with the
  // picture and stays pinned in the camera's frame at any window size.
  //
  // The colour is the intro's yellow, given as CMYK 2/2/86/0 ->
  //   R = 255(1-0.02) = 250, G = 255(1-0.02) = 250, B = 255(1-0.86) = 36.
  // (Sampling the intro art directly gives #FFEC4E, slightly different — the
  // spec wins.)
  hudColor: '#FAFA24',
  // Futura is NOT bundled and is absent from most Linux and Windows machines,
  // so this falls through geometric sans-serifs of the same family of shapes
  // before conceding to a generic sans. URW Gothic is the usual Linux hit,
  // Century Gothic the usual Windows one; macOS has real Futura.
  hudFont: 'Futura, "Futura PT", "Futura Std", "Century Gothic", "URW Gothic", "Avant Garde", "Trebuchet MS", sans-serif',
  hudWeight: 'bold',
  hudSize: 26 * 1.25,    // px, in the canvas's fixed 1280x720 space
  // The timer's jolt when a coin hit rewinds the clock. Deliberately the SAME
  // damped oscillation, at the same rate and length, that the coin itself does
  // when shot (coinSpasm*) — the coin's flinch and the clock's flinch should
  // read as one event happening at both ends of the screen.
  //
  // ONLY the amplitude differs, and it is the whole constraint here: the digits
  // have to stay readable while they move. 3px on a 50px timer is a nudge you
  // can see without losing the number; much past that and it smears.
  hudJoltMs: 140,        // = coinSpasmMs
  hudJoltFreq: 13,       // = coinSpasmFreq (≈2 cycles; see the aliasing note there)
  hudJoltAmp: 3,         // px — the coin shakes 5, the text has to shake less
  hudJoltScale: 0.06,    // size pop — half the coin's, for the same reason
  hudMargin: 22,         // px in from the canvas edge — governs BOTH the top
                         // labels' gap from the top and the timer's from the
                         // bottom, so the block stays symmetric when retuned
  hudLetterSpacing: '2px',
  hudFliesOffsetX: -64,  // extra px in from the right edge, on top of hudMargin
  // Drop shadow behind the text. Empty = none. It was there to keep the yellow
  // legible over pale fruit; bold weight now carries that on its own.
  hudShadow: '',
  // Run timer, HH:MM:SS, centred on X and sat hudMargin up from the bottom edge
  // (mirroring the corner labels). Placeholder size — one number.
  hudTimerSize: 40 * 1.25, // px

  // --- Background: the orbiting fruit tray --------------------------------
  // The frame is drawn 1:1 at its (reduced) resolution — LARGER than the
  // 1280×720 canvas — so the canvas shows a cropped WINDOW into it. The camera
  // pans that window with the plane, in both axes, revealing the rest of the
  // tray. FRAME_CAP is therefore both the texture resolution AND the world
  // size: raise it to see a smaller/zoomed piece (more room to pan, more VRAM),
  // lower it to see more of the tray at once (less VRAM).
  FRAMES: 16,            // camera angles
  FRAME_W: 3784,         // native frame size (all frames share it)
  FRAME_H: 3800,
  FRAME_CAP: 2400,       // downscale longest side to this on load = world size
                         // (world ~2389×2400; canvas covers ~54%W/30%H; ~730MB VRAM)
  // Camera clamp: the frames have a blank studio margin around the tray (~11%
  // left, ~12% right; almost none top/bottom). These fractions of the world are
  // fenced off so the camera never pans into that white — measured across all
  // frames, plus a small safety buffer.
  camInsetLeft: 0.12,
  camInsetRight: 0.13,
  camInsetTop: 0.02,
  camInsetBottom: 0.0,
  frameMs: 42,           // ms per sharp angle
  blurMs: 8,             // ms per blurred (-B) transition frame
  withBlur: true,        // interleave the -B frames
  dupFrames: true,       // each frame twice → smoother cadence

  // --- Colour drain: time passing, read as the world going black & white ----
  // Driven by the GAME clock (gameClockRate 1.15 — 15% faster than the wall),
  // so the picture drains on the same time the HUD counts, not on real seconds.
  //
  // It is applied ONLY to the background, inside TrayBackground.render(), which
  // is why it is a background knob and not a film one: the plane, the coins, the
  // flies and the HUD keep their colour and lift off an increasingly dead world.
  //
  // HOW, and why not the obvious ways:
  //   * NOT a CSS filter on the canvas (what CONFIG.film uses for its B&W) —
  //     that hits the whole canvas, HUD included.
  //   * NOT a second, pre-greyed copy of each frame — there are 32 of them at
  //     FRAME_CAP, and doubling that is precisely the VRAM thrash that cost us
  //     the frame rate once already (see PERFORMANCE.md).
  //   * NOT ctx.filter per draw — a full-texture filter pass every frame.
  //   It is one fillRect over the drawn frame in the 'saturation' blend mode:
  //   no new textures, no per-pixel JS, and the strength is just globalAlpha.
  drainOn: true,
  drainStartMs: 20000,   // GAME ms of grace before any colour is lost
  // GAME ms at which it reaches drainMax. 0 = "finish exactly when the run
  // does", i.e. track timeOverMs — which is what we want, so that the picture
  // hits full black & white on the same frame the clock runs out rather than
  // needing two numbers kept in sync by hand.
  drainFullMs: 0,
  drainMax: 1.0,         // 1 = fully grey at the end; 0.85 keeps a last tint
  // Ease-in: colour holds for a good while, then goes noticeably. 1 = linear,
  // higher = more of the drain crammed into the late game.
  drainCurve: 1.6,
  // Lightness, drained alongside the colour — the world dims as well as greys.
  // Fraction of black laid over the background at full drain; 0 = greyscale
  // only, no dimming.
  drainDarken: 0.12,

  // --- Bleach: the SAME idea run the other way, below zero ------------------
  // Forward time drains the world toward black & white and DIMS it. Going
  // backwards past zero drains it just the same but LIFTS it instead — washed
  // out and ultra-luminous by the time the clock reaches the boss at -2:00.
  //
  // The two can never both be on: the drain needs gameMs past drainStartMs
  // (+20s), the bleach needs it below zero. So they are computed as one signed
  // wash — same desaturation on both sides, opposite sign on the lightness.
  bleachOn: true,
  bleachStartMs: 0,      // GAME ms — begins the instant time goes negative
  // GAME ms at which it is fully bleached. 0 = "end where the boss begins",
  // i.e. track bossAtMs (-2:00) — the same one-number trick drainFullMs uses,
  // so the world hits its brightest exactly as the boss is summoned.
  bleachFullMs: 0,
  bleachMax: 1.0,        // desaturation at the end; 1 = no colour left at all
  // Linear, unlike the forward drain's ease-in: the player is actively pulling
  // the clock back here, so the picture should answer in proportion to what
  // they are doing rather than hold flat and then rush.
  bleachCurve: 1.0,
  // The lift — white laid over the picture at full bleach. 1.0 means the world
  // ENDS PURE WHITE: by -2:00 the dungeon has not faded, it has been erased
  // into light.
  //
  // The ramp is what carries it — desaturation and lift climb together across
  // the whole two minutes, so the picture washes out progressively and only
  // reaches solid white at the very bottom. Lowering this leaves a ghost of the
  // tray behind at the end instead (0.80 keeps a luminance range of ~51 of 255,
  // a bright fog; 0.45 is clearly still a photograph).
  //
  // No second "extra white layer" is possible or needed: another source-over
  // pass of white at alpha a is arithmetically just a bigger a, and 1.0 is
  // already the whole way. (It is also identical to SCREENING with the same
  // grey — so there is no blend mode to feature-detect here, and nothing that
  // can fail to a grey slab.)
  bleachLift: 1.0,

  // --- Colour drain: the plane (and its muzzle flash) ----------------------
  // The player drains too, but on its OWN curve and only HALF WAY. The world
  // dies around a plane that is still holding some of its colour, so it stays
  // the thing your eye tracks even at the end — which it would not if it faded
  // into the greyscale with everything else.
  //
  // Starts a full minute in, when the background is already well on its way, so
  // the two are visibly separate events rather than one global fade.
  //
  // Done with ctx.filter = saturate(), NOT the background's blend-mode fill: a
  // fill would have to be clipped to the plane, and clipping to its BOX would
  // grey a rectangle of the background behind it. The plane is ~7% of the
  // canvas, so a filter pass over it is cheap. Where ctx.filter is unsupported
  // the assignment is simply ignored and the plane stays in colour — a safe
  // failure, unlike the blend mode's.
  planeDrainOn: true,
  planeDrainStartMs: 60000,  // GAME ms — 1:00
  planeDrainFullMs: 0,       // 0 = end with the run (timeOverMs), i.e. 2:00
  planeDrainMax: 0.5,        // caps HALF grey and goes no further
  planeDrainCurve: 1,        // linear: an even slide from 1:00 to 2:00
  defaultReverse: true,  // free-run order before the player takes control

  // --- Player plane -------------------------------------------------------
  CHARACTERS: ['lemon', 'tomato', 'eggplant'],
  CH_FRAMES: 6,          // pitch poses per character
  CH_REST: 3,            // level pose (0-based frame 4)
  planeScale: 0.32 * 0.6 * 1.6, // plane height as a fraction of the stage height (60% of prior, then +60%)
  tiltMs: 110,           // ms per pitch-pose step
  moveSpeed: 0.30,       // vertical speed, stage-fraction / sec
  startX: 0.35,          // where it settles after flying in
  // Where the plane spawns in its 0..1 travel range. Kept as a FRACTION of the
  // canvas, not a pixel count, so it survives a resolution change; 100/GAME_H is
  // the "100px up" written out rather than pre-multiplied.
  //
  // startY drives TWO things: the sprite's position AND the vertical camera pan
  // (camY is a function of plane.displayY()). So lifting it also lifts the
  // opening shot up the tray — that is the real spawn moving, not an overlay on
  // top of a fixed shot. The full stick still reaches the bottom of the frame,
  // so the corpse floor plane stays reachable.
  startY: 0.90 - 100 / 720,
  // Purely a DRAW offset, in fractions of canvas height: it lifts the plane on
  // screen without touching displayY(), so the camera and background framing are
  // untouched. Negative = up. 0 = off (the default).
  //
  // BEWARE what it actually does: it shifts the plane's ENTIRE travel range, not
  // just where it starts. At -450/720 the plane spawned nicely high but could
  // fly clean off the top edge and could no longer reach below mid-screen at
  // all — which put the corpse floor plane out of reach. Left at 0 so the full
  // 0..1 stick maps to the full height of the frame.
  planeOffsetY: 0,

  // --- Entrance -----------------------------------------------------------
  // The plane used to just BE there the instant the game screen appeared. Now
  // it flies in from off the left edge, settles at startX, holds a beat, and
  // only then answers the controls.
  //
  // The fly-in is a DRAW-ONLY offset — see plane.js. Routing it through the
  // plane's x would drag the camera with it (the camera pans off displayX())
  // and swing it past its left inset into the blank studio margin.
  planeEntry: true,
  planeEntryFromX: -0.55, // screen fractions LEFT of startX to begin at. The
                          // sprite is ~0.225 of the canvas wide, so -0.55 puts
                          // it comfortably off-screen before it starts.
  // Fly-in, eased out (easeOutCubic) so it decelerates into place. The history
  // reads left to right: 900 base, then 30% slower, then another 10% — and now
  // pulled back in, because the whole entrance ran 1787ms before the player
  // could touch anything.
  //
  // Cutting HERE is cheap: with an ease-out, most of the visible travel happens
  // in the first third and the tail is the plane creeping the last few pixels.
  // Trimming the duration removes mostly that creep, not the entrance.
  planeEntryMs: 900 * 1.15,
  // The beat at rest before control is handed over. This one is pure dead air —
  // the plane has already arrived and nothing moves — so it takes the deeper
  // cut. Not zero: landing and instantly being live reads as a jump cut.
  planeEntryHoldMs: 150,

  // --- Float bob (same sine as the loading letters, +20% freq) ------------
  bobFreq: 2.52,         // rad/sec
  bobRel: 0.05,          // amplitude ÷ sprite height
  bobMin: 6,             // px floor

  // --- Stepped "stop-motion" plane (experiment) ---------------------------
  // Reproduce the background's low-framerate jank on the plane: sample its
  // drawn state (position, bob, pose) only every steppedMs instead of every
  // frame, and pan the camera off that same stepped value so plane + world hop
  // together. Toggled + tuned live by the controls under the canvas.
  stepped: true,
  steppedMs: 1000 / 23,  // hold per visual step — 23 fps. Written as a division
                         // so the framerate stays readable; the live slider
                         // under the canvas overrides it the same way.
                         // Independent of the background's frameMs (32ms, ~31
                         // fps): the plane deliberately hops slower than the
                         // world. The intro's takeoff reads this too, so it
                         // steps in the same style.

  // --- Old-film style (post effect) ---------------------------------------
  // The headline is the FRAME LINE: the dark gap between film frames, rolling
  // down the picture like a misframed projector. Around it: grain, brightness
  // flicker, a vignette, gate weave, and the odd scratch. Colour is KEPT — just
  // the projector artifacts. Toggled live under the canvas.
  film: true,
  filmBarSpeed: 60,      // px/sec the frame-gap bar rolls down
  filmBarHeight: 0,      // px thickness of the dark frame gap (0 = no frame line)
  filmBarDark: 0.78,     // how dark the gap gets (0-1)
  filmGrain: 0.11,       // grain opacity
  filmFlicker: 0.06,     // max brightness dip (black overlay alpha) — half of 0.12
  // How long ONE brightness value is held before a new one is rolled. This used
  // to re-roll every frame (~60Hz at 60fps), which strobed; 24ms holds it for
  // ~1.4 frames, i.e. 30% fewer changes per second. Raise it to slow the
  // flicker further, 0 = back to every frame.
  filmFlickerMs: 24,
  filmVignette: 0.22,    // corner darkening strength (0.55 -> 0.275 -> -20%)
  filmWeave: 1.4,        // px vertical gate jitter of the whole picture
  filmScratchChance: 0.04, // per-frame chance a vertical scratch flickers in
  // Optional CSS grade for the canvas (kept EMPTY = full colour). You could put
  // a gentle 'contrast(1.08)' here for a filmic punch, but no desaturation.
  filmCss: '',

  // --- Time over: the end of a run ----------------------------------------
  // The run is over at 2:00 on the HUD. That is GAME time (rate 1.15), so it
  // arrives after ~1m44s of wall clock — the clock the player is watching is
  // the one that ends them.
  //
  // The colour drain above is tied to this same number (drainFullMs 0), so the
  // world finishes going black & white on the very frame time runs out, and the
  // fade begins from an already-dead picture.
  timeOverMs: 120000,
  // The handover: dip the played scene to black, hold there a beat, then bring
  // the panel up. The hold matters — cross-fading straight from the dungeon to
  // the worms reads as a glitch, whereas a moment of black reads as a cut.
  overFadeOutMs: 900,
  overHoldMs: 350,
  overFadeInMs: 900,
  // Then ANY key or click starts a fresh run from the title sequence. The
  // listener is armed only once the panel has finished arriving and OVER is on
  // screen — plus this beat to read it — so a key pressed during the fade, or
  // still held from the last seconds of the run, can't blow straight past the
  // screen the player is meant to see. Arming works out at ~3s into the panel.
  overRestartArmMs: 500,
  // And after the restart the key is very probably STILL DOWN, with the OS
  // repeating keydown — which would land on the intro's skip handler and blow
  // past the title sequence too. Skips are ignored for this long afterwards.
  restartSkipGuardMs: 400,
  // The panel: 3 frames, pre-cropped to their shared band (3002x1687 ≈ 16:9) by
  // tools/build-game-over-frames.py, so they stretch to fill the canvas and stay
  // aligned with each other. Tuned in tools/game-over-anim.html.
  GAME_OVER_DIR: 'game-over/',
  GAME_OVER_FRAMES: [
    'saborosa-natureza-vermes-001.webp',
    'saborosa-natureza-vermes-002.webp',
    'saborosa-natureza-vermes-003.webp',
  ],
  overHoldsMs: [105, 105, 105],   // ≈9.5fps, looping 1·2·3
  // "TIME OVER", one line, TIME then OVER. Sizes are % of the CANVAS height so
  // the layout holds at any resolution.
  overTitle: {
    on: true,
    words: ['TIME', 'OVER'],
    // Heaviest Futura cuts first, then the usual geometric stand-ins. Same open
    // problem as hudFont: Futura is NOT bundled, so most machines land on
    // Century Gothic / URW Gothic / Jost.
    family: '"Futura Extra Bold","Futura ExtraBold","Futura Std Extra Bold",' +
            '"Futura PT Extra Bold","Futura Bold","Futura","Futura PT","Futura Std",' +
            '"Century Gothic","URW Gothic","Jost",sans-serif',
    weight: 900,
    color: '#FAFA30',    // CMYK 2/2/81/0
    sizePct: 20.4,       // % of canvas height
    lsPct: 3,            // letter spacing, % of font size
    gapPct: 20,          // space between TIME and OVER, % of font size
    yPct: 50,            // vertical middle of the text, down the canvas
    offX: 0, offY: 0,
    d1: 1500,            // ms after the panel appears before TIME shows
    d2: 1000,            // ms after TIME before OVER shows
    revealMs: 0,         // 0 = hard pop; >0 fades each word up
    fauxBold: 1.5,       // extra weight as a stroke, % of font size
    outline: 0,          // % of font size (0 = none)
    outlineColor: '#000000',
  },

  /* The OTHER ending: dying to the Time Boss. Everything goes WHITE instead of
     black, and the words read THE END.

     Named for the MODE it belongs to (the death that can only happen inside
     no-time mode), not for what it says — the words are just config and have
     already changed once.

     ⚠️ This is an OVERRIDE, not a second title block. It is merged over
     overTitle, so the font, the size, the spacing, the reveal delays — every
     number that decides HOW the letters appear — are shared with TIME OVER and
     retuning one retunes both. Only what must differ is listed. */
  /* And the THIRD ending: knocked out of the sky by the Mosca Boss. Same
     coloured worm panel the clock running out gives — it is a death in a world
     that still has its colour — but the words are different, because running out
     of time and being killed are not the same thing to say.

     An override merged over overTitle, exactly like noTimeTitle. It inherits the
     yellow, which is what that panel is designed for.

     "YOU FAILED" is one glyph longer than "TIME OVER"; at sizePct 20.4 it still
     fits the 1280 frame with room, but that is the number to drop if a longer
     phrase is ever wanted. */
  failedTitle: {
    words: ['YOU', 'FAILED'],
  },

  /* THE FINALE'S LETTERING. Same machinery, same font, same colour as the end
     panels — merged over overTitle like every other title override — but with
     the reveal timings switched OFF (d1/d2/revealMs all 0) because the finale
     drives its own fades through the alpha it passes in. The words arrive
     together and leave together; they are a card, not a countdown.

     sizePct has to come down. "THANK YOU FOR PLAYING" is 18 glyphs against TIME
     OVER's 8, and at the panel's 20.4 it would be some 2000px wide in a 1280
     frame. At 9.5 it measures ~960px, so it sits with ~160px either side. */
  finaleThanksTitle: {
    words: ['THANK', 'YOU', 'FOR', 'PLAYING'],
    sizePct: 9.5,
    d1: 0, d2: 0, revealMs: 0,
  },
  finaleObrigadoTitle: {
    words: ['OBRIGADO'],
    sizePct: 15,
    d1: 0, d2: 0, revealMs: 0,
  },

  noTimeTitle: {
    words: ['THE', 'END'],
    // BLACK. The yellow this inherits from overTitle is what TIME OVER wears on
    // a dark photograph; on this screen's white field it barely showed.
    color: '#000000',
    // EXTRA BOLD. Futura's real Extra Bold cut only exists on machines that
    // happen to have Futura at all (see `family` above), so weight here is
    // bought by stroking the glyphs in their own colour — 4.5% of the font size
    // against the shared 1.5%, which is ~3× the added thickness. Pushing much
    // past this starts closing the counters in E and D.
    //
    // Deliberately scoped to THIS ending rather than raised in overTitle: TIME
    // OVER was not asked to change. It is the one thing about the letters the
    // two screens do not share, and moving it up one block would share it.
    fauxBold: 4.5,
  },

  // --- Enemies ------------------------------------------------------------
  // Enemies live in the tray's WORLD space (the same larger plane the camera
  // pans), so they stay put in the dungeon while the player/camera moves — not
  // glued to the screen. X WRAPS at the world width: reach the edge and circle
  // back to the start, the same loop the tray makes around the basket.
  FLY_SHEET: 'enemy-sheets/saborosa-mosca.png',
  // Tight per-frame source rects [x, y, w, h]; the sheet is NOT evenly spaced.
  // Frame 0 = live fly; 1-4 = its burst/death animation (wired up later).
  FLY_RECTS: [
    [20, 98, 168, 181],
    [245, 92, 181, 192],
    [447, 80, 188, 222],
    [707, 84, 238, 225],
    [1002, 54, 273, 263],
  ],
  // Dead fly (single sprite, on its back) — drops after the burst finishes.
  FLY_DEAD_SHEET: 'enemy-sheets/saborosa-mosca dead.png',
  FLY_DEAD_RECT: [547, 102, 189, 178],
  flyGravity: 900,       // px/sec² — how fast the corpse accelerates downward
  // true  = corpse inherits the fly's velocity → parabolic arc
  // false = corpse just drops straight down (the original behaviour)
  // Live-toggled by the checkbox under the canvas.
  corpseBallistic: true,
  // How long BEFORE the burst ends the corpse drops in, so the two overlap.
  // Clamped to the moment of the hit (the burst itself is only ~280ms), so
  // anything >= that makes the body fall the instant the fly is shot.
  flyCorpseLead: 500,    // ms
  // --- The pile (a fake floor plane) --------------------------------------
  // Corpses don't fall out of the world any more: they come to rest on a flat
  // plane laid across the BOTTOM of the dungeon map — the tablecloth in front of
  // the tray — the same idea as the projected floor in the main game's
  // DungeonScreen. It lives in WORLD space, so the pile scrolls with the tray
  // instead of being stuck to the viewport.
  //
  // Bounds measured off the annotated screenshot: template-matching that shot
  // back to the tray frames puts its camera at camY 1680 — the very bottom of
  // the pan range — so the marked band's canvas y 478..720 is world y 2158..2400.
  corpsePlaneTop: 0.899,    // far edge, as a fraction of world height
  corpsePlaneBottom: 1.0,   // near edge
  // A body keeps its SIZE wherever it lands on the plane — no perspective shrink
  // toward the far edge. Only its ANGLE varies: one uniform sample in
  // ±corpseTiltDeg, drawn once when it lands and never touched again.
  corpseTiltDeg: 25,
  // How many spawn (killed for good — no respawn). A pacing number rather than
  // a scenery one: clearing all of them is what summons the Mosca Boss, so this
  // is how long the swarm lasts before the fight starts. At 13 that is a real
  // swarm to work through rather than three shots.
  flyCount: 13,
  flyScale: 0.13 * 0.5 * 1.4, // fly height as a fraction of the canvas height (50% of prior, then +40%)
  flySpeed: 200,         // base leftward speed (world px/sec) — net right-to-left
  flyVSpeed: 300,        // vertical wander speed (world px/sec) — big up/down darts
  flyRetargetMin: 0.25,  // s — shortest hold before it changes heading
  flyRetargetMax: 0.90,  // s — longest hold
  flyWobbleAmp: 6,       // px — fast micro-buzz on top of the wander
  flyWobbleFreq: 13,     // rad/sec
  // How many finished LEGS (straight stretches between heading changes) a fly
  // remembers, so a rewind can unwind back through them and retrace its real
  // path rather than reversing along its latest heading. Legs run 0.25-0.9s, so
  // 12 covers roughly 3-11 seconds of flight — well past any single rewind, and
  // it is 3 numbers per leg, so the cost is nothing.
  flyLegMemory: 12,
  flyMaxTilt: 15,        // deg — frame rotation at full vertical speed
  flyTiltEase: 9,        // how fast the tilt eases toward the heading (1/sec)

  // --- Coins ---------------------------------------------------------------
  // The spinning time-coin. Built by tools/build-coin-frames.py and timed in
  // tools/coin-anim.html — the numbers below are that tool's config dump.
  //
  // ONLY the upright spin (01) is in the game. The tilted/isometric one (02) is
  // still built and still previewable in tools/coin-anim.html — it just isn't
  // used here. Both share one cell size, so putting it back (or swapping to it)
  // is purely a matter of this map: add the line, and coins are dealt the
  // variants round-robin with no other change anywhere.
  COIN_SHEETS: {
    '01': 'coin/saborosa-coin-time-01.webp',
  },
  // A uniform grid: frame k is (k*COIN_CELL, 0, COIN_CELL, COIN_CELL). The
  // masters are NOT laid out like this — the build script re-lays them. Change
  // either of these only alongside a rebuild.
  COIN_CELL: 160,
  COIN_FRAMES: 22,       // one full rotation
  /* WHEN THE COINS ARRIVE. They no longer exist at spawn — the world starts
     with none, and each wave drops its coins in when the game clock first
     reaches its mark. The opening 30 seconds therefore have no rewind available
     at all: time can only run forward until the first wave lands, and the
     choice the whole game is about does not open up until then.

     `count` is how many APPEAR in that wave, not a target for the field — coins
     are destroyed for good when shot, so nothing tops them back up. Left alone,
     the three waves put 30 coins in the world.

     ⚠️ LATCHED, AND IT HAS TO BE. The clock goes BACKWARDS in this game — that
     is what the coins are for — so a wave testing `clock.now() >= atMs` every
     frame would undo itself the moment the player used the thing it gave them:
     shoot a coin at 0:31, the clock drops under 0:30, and the coins that made
     it possible vanish. Each wave fires once, on the way up, and stays fired.

     ⚠️ THE 2:00 WAVE LANDS EXACTLY ON timeOverMs (120000) — the same instant
     the run ends. As written it can never be played. Left at the requested
     value rather than quietly moved, because moving it is a design decision:
     either pull it back (1:45 gives it fifteen seconds to matter) or push
     timeOverMs out. */
  COIN_WAVES: [
    { atMs: 30000, count: 5 },    // 0:30
    { atMs: 90000, count: 10 },   // 1:30
    { atMs: 120000, count: 15 },  // 2:00 — see the warning above
  ],
  // Drawn height in the fixed 1280x720 canvas, NOT a fraction of it — the coin
  // is a pickup sized against the plane and the HUD, both of which are also in
  // canvas px, rather than something that should grow with the window.
  coinSizePx: 76,
  coinHoldMs: 60,        // per-frame hold: 22 frames ≈ 1.3s for a full turn
  // X only, always leftward, wrapping at the world width — the fly's drift
  // without the fly's darting. The spread stops the field moving as one block.
  coinSpeed: 120,        // world px/sec
  coinSpeedVar: 0.25,    // ± this fraction, per coin
  // The bob, lifted from the plane (bobFreq/bobRel/bobMin) so a coin floats on
  // the same air the plane rides. Kept as its own keys so retuning the coin
  // can't move the plane. At 76px, bobRel gives 3.8px and the floor wins, so
  // the coin bobs 6px — a little, which is the point.
  coinBobFreq: 2.52,     // rad/sec
  coinBobRel: 0.05,      // amplitude ÷ drawn size
  coinBobMin: 6,         // px floor
  // Where they spawn down the world, as fractions of its height. Kept clear of
  // the corpse floor plane at the bottom (corpsePlaneTop 0.899) so coins don't
  // sit buried in the tablecloth.
  coinBandTop: 0.10,
  coinBandBottom: 0.80,
  // --- Shooting a coin -----------------------------------------------------
  // Each connected hit throws the coin into reverse for coinHurtMs: it travels
  // backwards at the speed it was drifting, its spin runs backwards with it,
  // and it jolts. Holding fire therefore walks a coin back up the screen
  // against its own drift.
  // THE POINT OF THE COIN: every connected hit winds the run clock BACK by this
  // much game t  ime. Shooting a coin buys you time — 12 hits, so a full coin is
  // worth 12 seconds off the clock.
  //
  // It rewinds the game clock, which the colour drain and the 2:00 deadline are
  // both read from, so this does not just move a number: the world visibly
  // RECOVERS its colour as you shoot, and time over is pushed further away.
  // GameClock.rewind() clamps at 0, so the clock can never go negative however
  // many coins are cashed in.
  // GAME ms per hit. Live-editable from the controls under the canvas (in
  // SECONDS there), so this is the starting value rather than a fixed one.
  coinRewindMs: 5000,
  // How long the tray keeps orbiting BACKWARDS after each rewind tick, so the
  // world reacts while you are actually pulling time back rather than only once
  // the clock happens to be negative.
  //
  // MUST be longer than coinHurtMs (160), and that is the whole reason it isn't
  // just set to it: hits land every ~166ms once the frame quantisation is in,
  // so a 160ms window would lapse for a single frame between them and the tray
  // would flip direction and back once per hit — a stutter, not a reversal. The
  // surplus also buys a short flourish after the last hit instead of the world
  // snapping round the instant you stop firing.
  rewindSpinMs: 240,
  coinHealth: 7,
  // The rate limit, and it is NOT optional: the beam is re-tested every frame
  // while fire is held, so without it the whole health bar drains in as many
  // frames (~200ms) and reads exactly like a one-shot kill. It doubles as the
  // reverse window and the jolt window, so the i-frames are always exactly as
  // long as the feedback showing them — the same bargain flyHurtMs makes.
  // 7 × 160ms ≈ 1.1s of held fire to empty a coin, pushing it ~130 world px
  // backwards on the way.
  coinHurtMs: 160,
  // Collision box as a fraction of the drawn size. Fixed, not the frame's own
  // silhouette: face-on the coin is 76px but edge-on only ~15px, and a box that
  // collapsed with it would flicker in and out of being shootable twice per
  // rotation.
  coinHitScale: 0.72,
  // The jolt. A DAMPED OSCILLATION, not random jitter — noise reads as a
  // rendering fault, a decaying shake reads as a flinch. Slightly shorter than
  // coinHurtMs so each hit's jolt finishes before the next shot can land.
  coinSpasmMs: 140,
  coinSpasmAmp: 5,       // px of shake, mostly sideways (it was hit from the side)
  // Radians across the whole jolt, so this is "how many shakes it packs in":
  // 13 ≈ 2 cycles. MIND THE FRAME RATE — 140ms is only ~8 frames at 60fps, so
  // anything much above this samples at under 4 frames per cycle and aliases
  // into the random-looking jitter the damped shake exists to avoid.
  coinSpasmFreq: 13,
  coinSpasmScale: 0.12,  // size pop at the moment of impact, decaying to 0
  // The impact puff — the SAME one a non-lethal hit puts on a fly: the fly
  // sheet's burst frames (FLY_RECTS 1..4), pinned to where the shot connected
  // rather than following the coin, so it doesn't get dragged backwards with
  // the knockback.
  coinHitFxFrames: 4,    // = FLY_RECTS.length - 1, the whole burst
  coinHitFxMs: 70,       // = flyHitBurstMs
  // Size of the puff at its widest frame, as a multiple of the coin. 1.3 on a
  // 76px coin works out to the same 0.362 px-per-source-px the fly draws its
  // puff at, so it reads identically — but follows if the coin is resized.
  coinHitFxSize: 1.3,
  // NOTE: 4 × 70 = 280ms is LONGER than coinHurtMs (160), so held fire
  // re-triggers the puff before it ends. Same as the fly: there is only ever
  // one per coin, so a new hit just restarts it at the new impact point.
  // --- Death: the coin explodes and is gone --------------------------------
  // The main game's explosion sheet, converted to webp for this build (41KB ->
  // 9KB; it is flat art, so lossless). Frame coords are unchanged because the
  // conversion kept the sheet at its native 1228x845.
  BOOM_SHEET: 'saborosa-boom.webp',
  // ALL TWELVE frames — grow → peak → fade. The main game's hole-fall plays a
  // 7-frame TAIL-ONLY subset (assets-v2/saborosa-boom.json) that starts at the
  // peak and only fades; this is the full set (saborosa-boom-full.json), which
  // is the whole explosion. Verified against the sheet's alpha: 12 sprites is
  // everything on it. Two of them have DETACHED DEBRIS sitting beside the main
  // blob — the rects below deliberately span both, so don't re-cut this sheet
  // by island detection or you will get 14 frames, two of them stray sparks.
  BOOM_RECTS: [
    [243, 234,  93,  86],
    [438, 179, 134, 134],
    [638, 143, 162, 156],
    [844, 128, 173, 158],
    [210, 380, 190, 162],   // widest — the peak, and what coinBoomSize measures
    [431, 363, 182, 164],
    [642, 347, 179, 155],   // spans a detached debris fleck at x 808
    [851, 335, 160, 151],
    [233, 619, 129, 120],
    [448, 610,  97, 112],
    [663, 616,  99,  84],
    [901, 615,  56,  67],   // spans a second fleck at x 920
  ],
  // ms per frame. 78 was the main game's rate; /1.1 runs it 10% faster, so the
  // whole blast is ~852ms instead of ~940ms.
  //
  // Named for the BOOM, not for the coin, because the rate belongs to the
  // explosion rather than to whatever exploded — the boss's spawn blast reads
  // from the same value, and they should never be able to drift apart. Only the
  // SIZE is per-user (coinBoomSize / bossBoomSize).
  boomMs: 78 / 1.1,
  // Size of the blast AT ITS PEAK, as a multiple of the coin's drawn size. One
  // scale is derived from this and applied to every frame, so the frames keep
  // their relative sizes and the animation still grows and shrinks. Measured
  // against the WIDEST frame, not the first — with the full set the first frame
  // is the smallest, so anchoring on it would make the blast enormous.
  coinBoomSize: 1.7,

  // --- The Time Boss ------------------------------------------------------
  // A furious alarm clock that only turns up once the player has driven the run
  // clock down to bossAtMs by shooting coins — so it is what abusing the rewind
  // earns you, not something the game hands out on a timer. Negative GAME ms.
  bossAtMs: -120000,     // -2:00 on the HUD
  BOSS_SHEET: 'enemy-sheets/saborosa-boss-time.png',
  // The 7 frames are a TURN, not a walk cycle: profile-left → full-front →
  // profile-right. The widths say so — 120px in profile, 269px face-on, and
  // symmetric about the middle.
  //
  // Hand-placed at irregular pitch (centre-to-centre 170-275px) and differing
  // sizes, so there is no grid; these are measured off the sheet's alpha. Every
  // frame shares TOP y=79, which is why the draw hangs them from the top: it is
  // exact, and the 4px the front-facing frames gain is the stance widening at
  // the feet, which belongs downward rather than centred away.
  BOSS_RECTS: [
    [ 177, 79, 120, 219],   // profile, looking LEFT
    [ 326, 79, 171, 219],
    [ 530, 79, 228, 223],
    [ 784, 79, 269, 223],   // full front
    [1078, 79, 228, 223],
    [1334, 79, 171, 219],
    [1530, 79, 120, 219],   // profile, looking RIGHT
  ],
  BOSS_REF_H: 223,       // tallest frame — what bossSizePx is measured against
  bossSizePx: 260,       // drawn height in the fixed 1280x720 canvas
  // World px/sec. Horizontally this is the speed at full profile, tapering to 0
  // face-on (see the facing coupling in boss.js); vertically it is used flat,
  // so the boss keeps closing on the player's altitude even mid-turn. ONE knob
  // for both axes on purpose — a second would only drift away from it.
  bossSpeed: 120,
  // How close the player has to get before it notices them. Once it has, that
  // LATCHES — it never goes back to minding its own business, which is what
  // makes it stalking rather than a proximity trigger.
  bossSeeRange: 420,     // world px
  // Stand-off. Without it the boss walks THROUGH the player, dx changes sign
  // underneath it, and it shudders on the spot flipping sides instead of
  // looming. Vertically it uses half this.
  bossStopRange: 140,
  bossBandBottom: 0.85,  // keeps it out of the corpse floor plane at 0.899
  // Arrival blast: the same explosion a coin dies in, at the same boomMs rate,
  // scaled to the boss. As a multiple of bossSizePx at the blast's PEAK, so
  // 1.5 => a 390px fireball around a 260px boss — it announces him rather than
  // just puffing at his feet.
  bossBoomSize: 1.5,
  // Time for the full profile-to-profile sweep. Because travel speed is derived
  // from the same value, this also sets how long it spends decelerating into
  // the turn and accelerating out — one number, not three.
  bossTurnMs: 420,
  bossBobFreq: 1.9,      // rad/sec — slower and heavier than the coin's
  bossBobRel: 0.03,
  bossBobMin: 5,

  // --- The fight ----------------------------------------------------------
  // The boss can be shot, and shoots back.
  //
  // KEEP THIS A MULTIPLE OF 22 (= BAR_FRAMES − 1). Then the health bar steps
  // down one square every bossHealth/22 connected hits with nothing left over;
  // anything else and it skips squares unevenly. 88 is four hits per square.
  //
  // Time to kill is bossHealth × bossHurtMs of CONNECTED fire — 13.2s here —
  // and those are the only two knobs. It was 44 (6.6s), which played far too
  // short, though most of that was really the boss not fighting back at all:
  // see the alert-on-hit note in boss.js hit().
  bossHealth: 88,
  // ⚠️ The same bargain flyHurtMs and coinHurtMs make, and just as compulsory:
  // the beam is re-tested EVERY FRAME while fire is held, so without a rate
  // limit all 45 points come off in 45 consecutive frames (~0.75s) and the boss
  // dies before he has finished arriving. It doubles as the jolt window, so the
  // i-frames last exactly as long as the feedback showing them.
  bossHurtMs: 150,
  // A FIXED box, not the frame's own silhouette — the coin's lesson, for a
  // different reason. The turn takes the boss from 120px in profile to 269px
  // face-on, so a box that breathed with it would make him a HARDER target
  // exactly when he sets off after you: the player punished for the boss's own
  // animation. Multiples of bossSizePx, centred on him.
  bossHitWRel: 0.62,
  bossHitHRel: 0.82,
  // The jolt, same damped oscillation the coin and the HUD timer use. Smaller
  // relative amplitude: 6px on a 260px boss is a flinch, where the coin's 5px on
  // 76px is a real shove. A thing this size should barely move.
  bossSpasmMs: 140,
  bossSpasmFreq: 13,     // radians across the whole jolt — see coinSpasmFreq
  bossSpasmAmp: 6,
  bossSpasmScale: 0.02,
  // The fly's impact puff, reused. As with the coin this is the puff's WIDTH as
  // a multiple of the thing it hit — but unlike the coin it is well under 1,
  // because the puff is really about the BULLET, not the target: 0.4 of a 260px
  // boss is ~104px, near as makes no difference the 99px the coin gets. A puff
  // that scaled with the boss would be a 338px cloud from a rifle round.
  bossHitFxSize: 0.4,

  // STAGE 2. Below this fraction of health he winds up: he turns and travels
  // bossStage2Speed faster. A threshold rather than a stage counter — there are
  // only the two, and one number can't fall out of step with itself.
  //
  // His THROW used to change here as well — orbs that missed curved back like a
  // boomerang — and that was removed for not playing well. Speed is what is left.
  //
  // 0.5 is also exactly where the health bar runs out of red and goes solid
  // yellow (frame 11 of 22 — the one build-hustlebar.py had to draw). So the
  // stage change has a tell the player can read, without a word of UI: the bar
  // stops being red at the moment he speeds up.
  bossStage2At: 0.5,
  // A boss that visibly speeds up says "that did something" without needing a
  // health bar to say it — and now that the throw no longer changes, this is the
  // only thing that marks the stage at all.
  bossStage2Speed: 1.3,

  // --- The orb: what the boss throws --------------------------------------
  // The spiky ink sphere from the ROOT game's ambient FX pack (assets-003, the
  // `animation` block in saborosa-assets-003-fx-small.json — the ping-pong
  // "ball"). tools/build-orb-frames.py cuts those 5 frames onto a uniform grid
  // so this needs no per-frame table: frame k is (k*ORB_CELL, 0, CELL, CELL).
  //
  // The frames are CENTRED in their cells and grow 132px→216px inside them, so
  // drawing the whole cell at a fixed size gets the inflation for free — the
  // draw code never resizes anything.
  ORB_SHEET: 'saborosa-orb.webp',
  ORB_CELL: 216,
  ORB_FRAMES: 5,
  orbSizePx: 88,         // drawn CELL size, i.e. how big the largest ring is
  orbHoldMs: 100,        // = the root game's ball at fps 10
  // Fixed, like the coin's: the art pulses and a hitbox that pulsed with it
  // would be dodging the player twice a second.
  orbHitScale: 0.5,
  orbSpeed: 330,         // world px/sec on the way out
  // Released CLOSE TO HIM — this far out from his centre, along the throw, as a
  // multiple of bossSizePx. It inflates out of nothing there (frame 0 is the
  // smallest), so the throw reads as him producing it rather than it appearing.
  orbSpawnRel: 0.3,
  orbEveryMs: 1500,      // gap between throws, once he has noticed you
  orbFirstMs: 800,       // grace after noticing before the first one
  orbLifeMs: 3200,       // stage 1: long enough to leave the screen, then gone


  // --- The Mosca Boss -----------------------------------------------------
  // Turns up when the last fly is dead. Sliced from tools/mosca-boss-anim.html
  // — same algorithm (union alpha of the sheets, gap 6, alpha 16, minW 12), run
  // offline so the game needs no detection at boot.
  //
  // ⚠️ THERE ARE THREE SHEETS ON DISK AND ONLY TWO ARE LOADED. 01 and 03 are
  // byte-identical (verified by hash), so the delivered 1·2·3 flap is really
  // A-B-A. MOSCA_CYCLE reproduces it exactly against two images and saves 279KB
  // of duplicate PNG. Note the cycle is NOT A-B: looping [0,1,0] holds A for two
  // frames at the seam, which is what the artist's three-file cycle does.
  MOSCA_SHEETS: [
    'enemy-sheets/saborosa-boss-mosca-01.png',
    'enemy-sheets/saborosa-boss-mosca-02.png',
  ],
  MOSCA_CYCLE: [0, 1, 0],
  moscaFlapMs: 90,       // the tool's frameMs
  // The 7 poses are a TURN, exactly like the time boss's: profile-left (0),
  // head-on (3), profile-right (6). The widths say so — 253px in profile down to
  // 176px face-on, symmetric about the middle. So `facing` is again a continuous
  // 0..1 and the pose is just that value quantised.
  //
  // Every pose shares the y band 38..302, which is why they can be drawn from a
  // common top with no per-pose offset: the fly cannot bob or resize as it turns.
  MOSCA_RECTS: [
    [  57, 38, 253, 265],   // profile, facing LEFT
    [ 323, 38, 212, 265],
    [ 570, 38, 176, 265],
    [ 823, 38, 188, 265],   // head-on
    [1068, 38, 176, 265],
    [1278, 38, 212, 265],
    [1504, 38, 252, 265],   // profile, facing RIGHT
  ],
  /* WHERE ITS FACE IS in each pose, as a fraction of that pose's own rect —
     same indexing as MOSCA_RECTS above, so the two are read together.

     This exists because the impact puff was landing on the CENTRE of the
     sprite, and the centre of this fly is its black abdomen: a black-outlined
     burst drawn on a solid black body is feedback the player cannot see. The
     face is the only part of it with any contrast — two red compound eyes — so
     that is where a hit has to register.

     MEASURED, not guessed, the same way gunAnchorX/Y were: the centroid of the
     red eye pixels in each pose, as a fraction of the pose rect.

         python3 -c "..."   # see the Mosca Boss section of STATE.md

     Note how far the face travels — from 0.22 of the width in profile-left to
     0.77 in profile-right — which is exactly why one fixed offset would not do
     and this has to be per pose. Vertically it barely moves at all (0.475-0.489,
     i.e. dead centre), so the problem was only ever horizontal.

     Identical across all three flap sheets: the flap moves the wings and
     nothing else, so one table serves them all. */
  MOSCA_FACE: [
    [0.224, 0.480],   // profile, facing LEFT
    [0.248, 0.489],
    [0.307, 0.489],
    [0.484, 0.475],   // head-on
    [0.684, 0.489],
    [0.750, 0.489],
    [0.773, 0.479],   // profile, facing RIGHT
  ],
  MOSCA_REF_H: 265,
  flyBossSizePx: 300,    // drawn height in the fixed 1280x720 canvas

  /* THE ENTRANCE, in three beats. It is a cutscene the player cannot interrupt
     and cannot be hurt by (see fly-boss.js) — nothing about it is a fight yet.

       1 CHARGE  — in from off the RIGHT at the player's own height, straight
                   across at full speed, and out the other side.
       2 DESCEND — reappears at the TOP of the map, above the world, and comes
                   down the middle.
       3 SETTLE  — stops at the centre of the map. The health bar appears.

     The charge is timed by DISTANCE TRAVELLED, not by testing its position
     against the screen edge: the world wraps on X, so a position test would have
     to be wrap-aware and would still be wrong if the player moved the camera
     mid-charge. Distance is neither. */
  flyBossChargeSpeed: 950,   // world px/sec — "full speed", and it should read as it
  flyBossDescendSpeed: 430,  // slower: this beat is the arrival, not the threat
  flyBossEnterMargin: 300,   // px beyond the view edge it enters from / exits to
  flyBossHomeXRel: 0.5,      // where it stops, as a fraction of the world
  flyBossHomeYRel: 0.5,
  /* STALKING, which begins the instant the entrance ends — there is no pause at
     the map's centre, it arrives there and comes straight for you.

     ⚠️ THIS MUST STAY WELL UNDER THE PLAYER'S OWN SPEED. The plane travels
     0.30 of the camera-plus-screen span per second, which works out at ~851
     world px/s across and ~1117 down. At 420 the boss manages about half that,
     so it can always be outrun — which is the whole point, because touching it
     HURTS. Contact has to be a mistake the player made, not something that
     happens to them. Raise this past ~800 and the fight becomes unloseable in
     the other direction: unavoidable. */
  flyBossStalkSpeed: 420,    // world px/sec
  flyBossTurnMs: 380,        // profile-to-profile sweep, as bossTurnMs
  flyBossBobFreq: 2.6,       // rad/sec — quicker and lighter than the clock's
  flyBossBobRel: 0.02,
  flyBossBobMin: 4,

  // Health. A multiple of 22 (= BAR_FRAMES − 1) for the same reason the time
  // boss's is: 66 steps the bar down one square every three connected hits.
  flyBossHealth: 66,
  flyBossHurtMs: 150,        // the i-frame rate limit — never optional, see boss.js
  flyBossHitWRel: 0.7,       // fixed box, as multiples of flyBossSizePx
  flyBossHitHRel: 0.72,
  flyBossSpasmMs: 140,
  flyBossSpasmFreq: 13,
  flyBossSpasmAmp: 7,
  flyBossSpasmScale: 0.025,
  flyBossHitFxSize: 0.36,    // the fly's puff again — about the BULLET, see bossHitFxSize
  flyBossBoomSize: 1.4,      // death blast, × flyBossSizePx at its peak

  /* --- THE FINALE: what beating the Time Boss actually gives you -----------
     Not "the run carries on" — the run is OVER, and this is the ending. The
     player stops flying the plane and watches.

     THE WHOLE SEQUENCE IS DERIVED FROM THESE DURATIONS, never from hand-written
     absolute timestamps: finale.js sums them into marks, so retiming any one
     beat shifts everything after it instead of leaving a gap. Same trick the
     intro's liftoff window uses.

     TIME COMES BACK, FAST. The clock is scrubbed from bossAtMs (-2:00) to 0
     over finaleClockMs — and because the background's bleach is read from the
     clock, the world un-washes from pure white back to full colour on exactly
     that curve for free. There is no separate background transition to keep in
     step; there is only the clock. */
  finaleClockMs: 5000,      // -2:00 → 0:00, and the world comes back with it
  // The plane glides to the middle of the screen, low, and stays there bobbing.
  // eased, so it arrives rather than stopping dead.
  finalePlaneX: 0.5,
  finalePlaneY: 0.80,
  finalePlaneMoveMs: 2600,
  finaleSettleMs: 900,      // a beat after BOTH the clock and the plane land
  finaleFadeMs: 700,        // every word fade, in and out
  finaleThanksHoldMs: 2200,
  finaleGapMs: 500,         // black between the two cards
  finaleObrigadoHoldMs: 2600,
  // The plane accelerates out to the right. QUADRATIC, so it reads as building
  // speed rather than sliding off at a constant crawl.
  //
  // ⚠️ A DRAW-ONLY offset, not a change to plane.x — the same trap the entrance
  // documents. The camera pans off displayX(), so flying the exit through x
  // would drag the world past its inset and expose the blank studio margin.
  finaleExitMs: 1300,
  finaleExitX: 0.9,         // screen fractions travelled by the end of it
  // The logo runs the Mosca Boss's entrance MIRRORED: a fast pass across the
  // screen (left→right, where the fly went right→left), then in again from
  // off-frame and up to the middle (where the fly came down from the top).
  LOGO_SHEET: 'saborosa-logo.webp',
  finaleLogoWRel: 0.5,      // drawn width, as a fraction of the canvas
  finaleLogoPassMs: 850,
  finaleLogoRiseMs: 1100,
  finaleLogoHoldMs: 1800,   // before "press anything" arms

  // --- The boss's health bar ----------------------------------------------
  // 23 hand-drawn states of one 11-square bar, cut and rotated by
  // tools/build-hustlebar.py: frame 22 solid RED (full), frame 11 solid YELLOW
  // (the changeover — and the frame that had to be generated, the master was
  // missing it), frame 0 empty WHITE, which means dead.
  //
  // Laid out as a COLUMN, not a row: the frames are 333px wide, so a row would
  // be a 7659×50 texture. Frame k is (0, k*BAR_CELL_H, BAR_CELL_W, BAR_CELL_H).
  BAR_SHEET: 'saborosa-hustlebar.webp',
  BAR_CELL_W: 333,
  BAR_CELL_H: 50,
  BAR_FRAMES: 23,
  // Top-centre. As a fraction of canvas WIDTH so it holds its proportion of the
  // frame; the height follows from the cell's aspect, never stretched — those
  // squares are drawn square.
  bossBarWRel: 0.252,
  bossBarTop: 34,        // px below the top of the frame

  // --- The player's health: he AGES ---------------------------------------
  // Three points, and NO BAR anywhere — the character himself is the readout.
  // Each point lost deteriorates him one stage (3 = as he starts, 2 = worn,
  // 1 = badly gone), and the third kills him. That is also why `wear` is
  // continuous rather than an integer counter: a hit adds exactly 1.0, which
  // always crosses a stage boundary, and anything that ages him GRADUALLY later
  // (the boss's aging attack) just adds to the same number.
  planeHealth: 3,
  /* What TOUCHING a little fly costs. Half a point, so it takes two of them to
     age him one stage — the swarm is a nuisance that accumulates, where the
     bosses and the orbs deal a full point and cost a third of the run outright.

     This is precisely what `wear` being continuous was for. Nothing in the
     plane needed changing to support it: `hp()` and `stage()` already floor the
     number, so the first touch is invisible and the second ages him, and
     `isDead()` is a `>=` that six halves reach exactly.

     ⚠️ It is rate-limited by planeHurtMs like everything else, which is what
     makes 13 flies survivable at all — without it, flying into the swarm would
     be six frames from full health to dead. */
  flyTouchDamage: 0.5,
  // i-frames, and the blink that shows them. Long by this game's standards
  // because a hit here costs a THIRD of the run, not 1/45th.
  planeHurtMs: 1100,
  planeBlinkMs: 100,     // half-period of the blink through those i-frames

  /* --- THE FLINCH --------------------------------------------------------
     A hit now rattles him as well as making him blink, and the two are saying
     DIFFERENT THINGS — which is the whole reason this is a second timer rather
     than more behaviour hung off hurtT.

       the blink   lasts planeHurtMs (1100ms) and reports a STATE: you are
                   invulnerable, and for exactly this much longer.
       the flinch  lasts planeShakeMs (260ms) and reports an EVENT: that hit
                   just landed, and it hurt.

     Stretching the shake over the full i-frame window would turn the impact
     into a condition — a plane that vibrates for over a second reads as broken
     machinery rather than as having been struck — and the moment of contact,
     which is the thing the player needs to feel, would be lost inside it.

     ⚠️ DRAW-ONLY. It is added to the render translate, never to x/y, so it
     moves neither the camera (which pans off displayX/displayY) nor the
     collision box. A hitbox that jitters would make what hits you a matter of
     luck at exactly the moment the game is punishing you. The muzzle stays put
     with it, so the shot line leaves the nose's true position while the sprite
     rattles around it — a few px for a quarter-second, and far better than a
     beam whose origin shakes. */
  planeShakeMs: 260,
  planeShakeAmp: 12,     // px in the fixed 1280x720 canvas, at the instant of impact
  // ~14Hz: about four oscillations across the 260ms, which is a rattle. Slower
  // and it is a wobble; faster and at 60fps it aliases into a blur.
  planeShakeFreq: 90,    // rad/sec
  // Y is shorter and runs at a different rate, so the two axes trace a small
  // erratic figure instead of sliding up and down one diagonal.
  planeShakeYRel: 0.55,
  planeShakeYFreqRel: 0.7,
  planeHitWRel: 0.35,    // collision box vs the drawn sprite
  planeHitHRel: 0.5,

  /* THE DEATH FALL. The last hit does not cut straight to a panel — the plane
     drops out of the sky exactly the way a dead fly does, and only once it is
     gone from the frame does the ending begin.

     It falls under `flyGravity`, the flies' own constant, deliberately reused
     rather than copied: "like the flies" should stay literally true if that
     number is ever retuned. What differs is the start — a fly's corpse inherits
     the fly's heading, while the plane gets a small upward LURCH first, which is
     what makes it read as losing lift rather than as a sprite beginning to slide
     down the screen. */
  planeFallVy0: -150,    // px/sec, upward: the stall before the drop
  planeFallSpin: 2.4,    // rad/sec — the tumble; a plane that fell flat reads as a bug
  planeFallMaxMs: 3000,  // safety net only. The geometry ends the fall long before
                         // this; it exists so a mistuned gravity cannot hang the run
  // ⚠️ The deteriorated sprite packs DO NOT EXIST YET. Turn this on when they
  // land and the plane looks for `saborosa-plane-{name}-wearN-NN.png`; until
  // then it keeps the one pack and the stage shows through planeWearFilter.
  planeWearSheets: false,
  // The stopgap, and it is only a stopgap: a ctx.filter per stage, so the
  // character visibly sickens even with one set of art. Index = stage, so [0]
  // is empty by definition. Composed with the drain's own saturate() in the
  // same filter string, which is why these are strings and not numbers.
  planeWearFilter: [
    '',
    'sepia(0.55) contrast(0.9) brightness(0.94)',
    'sepia(0.9) contrast(0.72) brightness(0.8)',
  ],

  // --- Shooting -----------------------------------------------------------
  // Firing projects a thin hitscan line forward from the nose. Anything whose
  // collision box the line crosses is hit and plays its burst animation.
  // Hold C to visualise the boxes (and the line, while firing).
  rayThickness: 2,       // px — thickness of the shot line
  // px at gunOffRefScale; muzzle() scales it by planeScale/gunOffRefScale (same
  // as the flash offsets) so the shot line tracks the plane through any resize.
  // 15 here ≈ the hand-tuned 9px at the pre-resize scale.
  rayOffsetY: 15,
  flyHitScale: 0.8,      // fly collision box vs its drawn size
  flyBurstMs: 70,        // ms per burst (death) frame

  // --- Fly health ---------------------------------------------------------
  // Three hits to kill, one damage per shot. The catch: the shot is a hitscan
  // beam re-tested EVERY FRAME while fire is held, so without a rate limit all
  // three points would come off in three consecutive frames (~50ms) and it
  // would still die instantly. flyHurtMs is that limit — and doubles as the
  // blink and knockback window, so the i-frames are always exactly as long as
  // the feedback that shows them.
  flyHealth: 3,          // hits to kill
  rayDamage: 1,          // damage per connected shot
  flyHurtMs: 180,        // immune + blinking + knocked back for this long
                         // (3 hits => ~360ms of held fire to kill)
  flyHurtBlinkMs: 45,    // half-period of the blink
  flyHurtAlpha: 0.35,    // how faint it goes on the blink's off beat
  flyKnockback: 260,     // px/sec shoved away from the gun, decaying to 0
  // Impact puff on a NON-lethal hit. Identical to the death burst — same frames
  // (FLY_RECTS 1..4), same size, same rate — the only difference being that it's
  // pinned to where the shot connected instead of following the fly apart.
  // Keep these in step with FLY_RECTS / flyBurstMs above if those change.
  flyHitBurstFrames: 4,  // = FLY_RECTS.length - 1, the whole burst
  flyHitBurstMs: 70,     // = flyBurstMs
  flyHitBurstScale: 1,   // = the death burst's size
                         // NOTE: 4 x 70 = 280ms is LONGER than flyHurtMs (180),
                         // so holding fire re-triggers the puff before it ends.
                         // That's fine — there's only ever one per fly, so a new
                         // hit restarts it at the new impact point rather than
                         // stacking a second one.

  // --- Machine gun --------------------------------------------------------
  GUN_FRAMES: 6,
  fireMs: 70,            // ms per muzzle-flash frame while firing
  // Flash offsets are in px, TUNED at gunOffRefScale. render() rescales them by
  // planeScale/gunOffRefScale so they track the plane's size automatically —
  // change planeScale and the flash stays glued to the nose, no re-tuning.
  gunOffRefScale: 0.32,  // the planeScale the offsets below were dialled in at
  gunOffX: 12,           // px toward the plane (closes the nose gap)
  gunOffY: 5,            // px upward, level pose only (aligns with the muzzle)
  // Size of the flash relative to the plane's own box. 1 = the original, where
  // the flash sheet was drawn at exactly the plane's size.
  //
  // It grows about the MUZZLE, not the box centre — see gunAnchor* — so the
  // flash stays welded to the nose at any value and gunOffX/gunOffY keep
  // meaning what they always meant. Scaling about the centre instead would
  // push the attach point right and down and force both offsets to be re-tuned
  // every time this changed.
  gunScale: 1.30,
  // Where the flash meets the nose, as a fraction of the flash frame. MEASURED,
  // not guessed: the fire frames are 1980x1521, exactly 3x the 660x507 plane
  // frames, so the two share a registration and the flash's position inside its
  // frame is meaningful. Across the 6 frames the flash's left edge sits at plane
  // x 425-441 (mean 432, with the rest-pose nose tip at 422) and the centroid of
  // its leftmost 30 columns at y 280-290 (mean 286).
  //   432.3 / 660 = 0.655      285.7 / 507 = 0.564
  // Re-measure if the fire art is redrawn.
  gunAnchorX: 0.655,
  gunAnchorY: 0.564,
};
