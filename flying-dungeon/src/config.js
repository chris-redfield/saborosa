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
    8:  { hold: 1000 },  // "3" — one full second each, it's a countdown
    9:  { hold: 1000 },  // "2"
    10: { hold: 1000 },  // "1"
    11: { hold: 900 },   // "GO!" — long enough for the plane to clear the frame
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
  // takeoff to match. At the current beats that window is ~4.4s:
  //   0.00-0.12 STOP DECAY   0.12-0.80 "3" "2" "1"   0.80-1.00 GO!
  introLiftoffFrom: 7,   // board 8 (STOP DECAY) — where the plane appears
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
  startX: 0.49,          // pinned horizontal position
  startY: 0.90,

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
  steppedMs: 60,         // hold per visual step (~16 fps). NOTE: this used to be
                         // frameMs, so plane and background hopped in lockstep;
                         // the background is faster now, so they no longer match.
                         // Set it to 32 to re-lock them, or keep the plane slower
                         // than the world on purpose. Live slider under the canvas.

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
  filmFlicker: 0.12,     // max brightness dip (black overlay alpha)
  filmVignette: 0.275,   // corner darkening strength (half the original 0.55)
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
  flyCount: 15,          // how many spawn (killed for good — no respawn, for testing)
  flyScale: 0.13 * 0.5 * 1.4, // fly height as a fraction of the canvas height (50% of prior, then +40%)
  flySpeed: 200,         // base leftward speed (world px/sec) — net right-to-left
  flyVSpeed: 300,        // vertical wander speed (world px/sec) — big up/down darts
  flyRetargetMin: 0.25,  // s — shortest hold before it changes heading
  flyRetargetMax: 0.90,  // s — longest hold
  flyWobbleAmp: 6,       // px — fast micro-buzz on top of the wander
  flyWobbleFreq: 13,     // rad/sec
  flyMaxTilt: 15,        // deg — frame rotation at full vertical speed
  flyTiltEase: 9,        // how fast the tilt eases toward the heading (1/sec)

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

  // --- Machine gun --------------------------------------------------------
  GUN_FRAMES: 6,
  fireMs: 70,            // ms per muzzle-flash frame while firing
  // Flash offsets are in px, TUNED at gunOffRefScale. render() rescales them by
  // planeScale/gunOffRefScale so they track the plane's size automatically —
  // change planeScale and the flash stays glued to the nose, no re-tuning.
  gunOffRefScale: 0.32,  // the planeScale the offsets below were dialled in at
  gunOffX: 12,           // px toward the plane (closes the nose gap)
  gunOffY: 5,            // px upward, level pose only (aligns with the muzzle)
};
