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
  planeEntryMs: 900 * 1.3 * 1.1, // fly-in, eased out so it decelerates into
                           // place. Chained so the history reads: 900 base,
                           // then 30% slower, then another 10%.
  planeEntryHoldMs: 500,  // the beat at rest before control is handed over

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
  coinCount: 12,         // how many drift the world at once
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
