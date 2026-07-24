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
  FRAME_CAP: 2000,       // downscale longest side to this on load = world size
                         // (world ~1992×2000; canvas covers ~64%W/36%H; ~510MB VRAM)
  frameMs: 60,           // ms per sharp angle
  blurMs: 24,            // ms per blurred (-B) transition frame
  withBlur: true,        // interleave the -B frames
  dupFrames: true,       // each frame twice → smoother cadence
  defaultReverse: true,  // free-run order before the player takes control

  // --- Player plane -------------------------------------------------------
  CHARACTERS: ['lemon', 'tomato', 'eggplant'],
  CH_FRAMES: 6,          // pitch poses per character
  CH_REST: 3,            // level pose (0-based frame 4)
  planeScale: 0.32 * 0.6, // plane height as a fraction of the stage height (60% of prior)
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
  steppedMs: 60,         // hold per visual step (~16 fps; matches bg sharp frame)

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
  filmVignette: 0.55,    // corner darkening strength
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
  flyScale: 0.13 * 0.5,  // fly height as a fraction of the canvas height (50% of prior)
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
  rayOffsetY: 9,         // px — nudge the shot line down from the muzzle
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
