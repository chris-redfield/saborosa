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
  flyCount: 30,          // how many spawn (killed for good — no respawn, for testing)
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
  coinCount: 22,         // how many drift the world at once (12 + 10)
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
  // much game time. Shooting a coin buys you time — 12 hits, so a full coin is
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
  coinHealth: 12,
  // The rate limit, and it is NOT optional: the beam is re-tested every frame
  // while fire is held, so without it the whole health bar drains in as many
  // frames (~200ms) and reads exactly like a one-shot kill. It doubles as the
  // reverse window and the jolt window, so the i-frames are always exactly as
  // long as the feedback showing them — the same bargain flyHurtMs makes.
  // 12 × 160ms ≈ 1.9s of held fire to empty a coin, pushing it ~230 world px
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
  coinBoomMs: 78 / 1.1,
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
  bossSpeed: 90,
  // How close the player has to get before it notices them. Once it has, that
  // LATCHES — it never goes back to minding its own business, which is what
  // makes it stalking rather than a proximity trigger.
  bossSeeRange: 420,     // world px
  // Stand-off. Without it the boss walks THROUGH the player, dx changes sign
  // underneath it, and it shudders on the spot flipping sides instead of
  // looming. Vertically it uses half this.
  bossStopRange: 140,
  bossBandBottom: 0.85,  // keeps it out of the corpse floor plane at 0.899
  // Time for the full profile-to-profile sweep. Because travel speed is derived
  // from the same value, this also sets how long it spends decelerating into
  // the turn and accelerating out — one number, not three.
  bossTurnMs: 420,
  bossBobFreq: 1.9,      // rad/sec — slower and heavier than the coin's
  bossBobRel: 0.03,
  bossBobMin: 5,

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
