/**
 * CONFIG — every tunable for the beat 'em up, in one place.
 *
 * Plain data, no logic, exactly like flying-dungeon/src/config.js: so it can
 * lift into the main game (or a settings screen) untouched.
 *
 * THE THREE PATHS AT THE TOP are what package.sh rewrites to build a
 * self-contained itch zip. Adding a fourth source of assets means adding a
 * fourth rewrite line over there, so don't.
 */
/**
 * BODY_SCALE — how big the FIGHTERS are, and nothing else.
 *
 * ONE NUMBER, MOVED ONCE. This used to be a literal `* BODY_SCALE` written out
 * twenty-odd times, with a comment telling you to grep for it and move them
 * all together. That is a footgun rather than a knob: the one you miss does
 * not fail, it just quietly makes a punch land across a visible gap.
 *
 * EVERYTHING MEASURED AGAINST A BODY IS SCALED BY IT: the drawn height, the
 * hurtbox, every punch's reach and lift, the enemy stand-off and their reach,
 * the jump height, the ground shadow, and the floating enemy bars.
 *
 * WHAT IS DELIBERATELY NOT SCALED is everything measured against the LEVEL:
 * belt depth, walk speed, the camera, knockback distance -- and the player's
 * own life bar across the top of the screen. Those describe the world the
 * fighters stand in, or the furniture around it, not the fighters. Scaling
 * them would shrink the whole game rather than the cast in it.
 *
 * Lower it to make everyone smaller. 0.8 was the original; 0.72 is 10% down.
 */
const BODY_SCALE = 0.72;

const CONFIG = {
  /* The MAIN GAME's assets — the character packs live here, and we read them
     rather than copying them, so a re-run of tools/build-character-defs.py
     updates both games at once. */
  ASSET_BASE: '../assets/',
  /* The masters folder — the infinite dungeon floor tile is in here and has no
     packed copy in assets/. */
  ASSET_V2_BASE: '../assets-v2/',
  /* Controller mapping: the MAIN GAME's own file, not a copy — a pad set up
     once in tools/gamepad-mapper.html works in all three games and there is no
     second copy to drift. Optional; input.js keeps standard-layout defaults if
     it is missing.

     RELATIVE TO ASSET_BASE, like every other path in this file. The flying
     dungeon writes its equivalent as a full '../assets/...' path, which is why
     its package.sh needs a THIRD sed line to rewrite it. Resolving it the same
     way as everything else means the build has exactly two paths to rewrite and
     the manifest needs no special case. */
  GAMEPAD_MAPPING: 'gamepad-mapping.json',

  // --- Canvas: fixed internal resolution (matches the other two games) -----
  GAME_W: 1280,
  GAME_H: 720,
  fitMarginPx: 0,
  fitMaxScale: 0,        // 0 = uncapped, so itch's fullscreen button can fill a
                         // big monitor — see flying-dungeon/STATE.md for why

  /* =========================================================================
     THE BELT
     =========================================================================
     A belt-scroller's world is (x, z): x runs along the level, z is DEPTH
     across the walkable strip. Jump height is a third value that is drawn but
     never simulated in world space — see `Fighter.jumpY`.

         screenX = x - camX
         screenY = beltTopY + z - jumpY

     z is in SCREEN PIXELS, not an abstract 0..1, and that is deliberate: it
     makes `beltDepth` directly readable as "how tall is the walkable strip on
     screen", and it makes the depth half of a hitbox comparable with the
     horizontal half without a conversion factor sitting between them.

     z = 0 is the FAR edge (back wall), z = beltDepth is the NEAR edge. Draw
     order is z ascending, so bigger z draws later and therefore in front.

     THE BELT IS A LANE DEFINED OVER THE PLATE, NOT DERIVED FROM IT. The
     background is one photograph and knows nothing about where a fighter may
     stand; these two numbers are the whole of that agreement, and they are the
     ONLY thing that has to be re-measured when the real footage is cut in —
     read the ground band off a frame of the shot and set them to it. Everything
     else (hit tests, draw sorting, the camera, the AI) is expressed in z and
     follows automatically.

     They are what stops the player walking up off the floor and into the
     scenery, which stays true whatever the plate turns out to be. */
  beltTopY: 430,         // screen y of z = 0 — the FAR edge of the walkable band
  beltDepth: 190,        // its height in px; z runs 0..this
  /* Optional perspective: how much smaller a fighter is drawn at the FAR edge
     than at the near one. 1.0 = off, which is the classic arcade look (Final
     Fight and Streets of Rage both scale nothing). Kept as a knob because the
     filmed backdrop may want a little of it to sit correctly in the footage. */
  beltFarScale: 1.0,

  /* =========================================================================
     THE LAYER STACK
     =========================================================================
     Rendering is an ORDERED LIST rather than a fixed back-to-front sequence in
     the renderer, because a foreground plane in front of everything was asked
     for on day one and more layers are likely once the filmed backdrop lands.
     Adding one is an entry here; it is never surgery in the draw code.

     `source` names a backdrop source registered in backdrop.js.
     `parallax` is px of layer movement per px of camera movement: below 1 the
     layer lags behind (far away), above 1 it outruns the camera (close to the
     lens, which is what sells a foreground).
     `entities: true` is the slot the fighters are drawn in, z-sorted. Exactly
     one layer should carry it. */
  LAYERS: [
    /* ONE PLATE, NOT A BACKDROP PLUS A FLOOR, AND THIS IS LOAD-BEARING.
       The filmed background is a SINGLE SHOT: the far scenery and the ground
       the fighters stand on are the same photograph, baked together by the
       camera that took it. There is no seam between them and nothing to slide
       one against the other.

       This started as two tiled layers at 0.35 and 1.0 parallax, and it was
       wrong for exactly that reason — the moment real footage arrived, the
       "backdrop" half would have been a second copy of a shot that already
       contains its own floor, sliding underneath it. It is one layer at
       parallax 1.0 now, so when the plate becomes a film the ONLY change is
       `kind: 'tile'` → `kind: 'film'` in SOURCES.

       Parallax 1.0 is also the only honest value for a plate: a real camera
       move already carries its own parallax inside the frame. Anything else
       here would be sliding the photograph against itself. */
    { name: 'plate',      source: 'plate',      parallax: 1.0 },
    { name: 'fighters',   entities: true },
    /* The plane in front of everything. Off until there is art for it — the
       stack is what had to exist early, not the layer itself. Turn `on` to true
       and point `source` at a registered source to bring it in. */
    { name: 'foreground', source: 'foreground', parallax: 1.25, on: false },
  ],

  /* --- Backdrop sources ---------------------------------------------------
     A source answers draw(ctx, scrollX, w, h) and nothing else, so the level
     never knows whether it is looking at a tile, a painting or a film. Three
     kinds exist:

       tile   an image repeated forever in x (and optionally y)
       image  one long painted strip
       film   a FRAME SEQUENCE — the filmed backdrop this game is heading for

     THE FILM SOURCE IS THE POINT OF THIS INDIRECTION. The plan is to shoot
     real footage and cut it in, and footage behaves differently from a
     painting: it has its own time. So a film source runs in one of two modes,
     and which one is chosen by the SEGMENT it is playing under (see SEGMENTS):

       scrub  the frame is indexed by CAMERA POSITION. Walking right winds the
              footage forward — the camera is travelling, so the film travels.
              This is what a scrolling section wants.
       play   the frame is indexed by TIME, looping. The camera is locked and
              the world is alive around a fight. This is what an arena wants.

     Neither mode exists in the other's segment, which is why the mode is not
     configured here: `stage.js` sets it from the segment kind. */
  SOURCES: {
    /* THE PLATE — the whole shot, scenery and ground together.
       Standing in as the infinite dungeon tile until the footage is cut. It is
       a big square, so at this scale one tile is most of a screen: a place, not
       a field of little repeats.

       WHEN THE FOOTAGE ARRIVES this entry becomes, and nothing else in the
       game changes:

           plate: {
             kind: 'film',
             frames: ['plate/shot-0001.webp', ... ],
             pxPerFrame: 24,     // camera px per frame of footage — the number
                                 // that syncs a walk to the dolly
             holdMs: 66,         // ...and the frame rate it plays at when an
                                 // arena locks the camera
           }

       No tint on it. The old two-layer version dimmed its far half to fake a
       distance the single plate simply has. */
    plate: {
      kind: 'tile',
      src: 'v2:rafe-saborosa-escaladalow-01.png',
      /* The tile is 820x1169 native. 0.65 makes it 533x760, which COVERS the
         720-high canvas with a little to spare and repeats every 533px across.
         Covering matters: a plate is the whole picture by definition, and any
         row of canvas it fails to reach shows the clear colour behind it. */
      scale: 0.65,
      repeatY: false,
      // Small lift so the seam at the tile's top edge sits off-screen.
      // PLACEHOLDER-ONLY — a film source fills the frame and ignores this.
      offsetY: -30,
      tint: '',
    },
    // Declared but unused until there is art — see the LAYERS note.
    foreground: { kind: 'image', src: '', scale: 1 },
  },

  /* =========================================================================
     THE LEVEL
     =========================================================================
     A beat 'em up level is a SEQUENCE OF SEGMENTS, alternating between walking
     and fighting. That structure is the genre's spine and it is also exactly
     what was asked for: parts where the background moves, parts where it is
     static.

       scroll  the camera follows the player rightward and the level plays like
               a walk. Nothing gates the player except the segment's end.
       arena   THE CAMERA LOCKS. A wall goes up at each edge of the view, the
               listed enemies spawn, and neither the camera nor the player may
               leave until every one of them is down.

     `toX` is the world x at which a scroll segment hands over. For an arena it
     is the camera's locked position, and the walls are derived from it — one
     number rather than three that can disagree.

     Enemy entries are { kind, x, z, delayMs }. x/z are WORLD coords; for an
     arena they are usually written relative to the lock, but they are absolute
     here so a segment can be moved by editing one number and nothing else. */
  /* NO `camX` ON THE ARENAS, ON PURPOSE — each locks wherever the camera had
     got to when the scroll before it handed over, which can never disagree with
     that scroll. Enemy x's below are written against where that lands.

     The camera trails the player by the focus point plus the deadzone, so a
     scroll ending at `toX` leaves the camera at roughly
     `toX - (GAME_W*camFocusX + camDeadzone)` — about 670px back at the current
     tuning — and the view is the 1280 to the right of that. Retune the camera
     and these enemy positions want re-checking; the arena lock does not,
     because it is derived. */
  SEGMENTS: [
    { kind: 'scroll', toX: 900 },          // camera ends ≈ 230; view ≈ 230..1510
    /* THE FIRST WAVE TEACHES THAT THE BELT HAS TWO ENDS. Two walk in from the
       front, and then TOM comes in from BEHIND -- out of the ground the player
       has already walked over, which is the one direction they have had no
       reason to watch. His delay is long on purpose: the player commits to the
       two in front first, and the third arrives once they have turned their
       back on the way they came. It is the cheapest lesson in the genre and
       the first arena is the place to teach it, while a mistake costs almost
       nothing. */
    {
      kind: 'arena',
      enemies: [
        { kind: 'eggplant', x: 1080, z: 60 },
        { kind: 'laranja',  x: 1240, z: 150, delayMs: 700 },
        { kind: 'tomato',   x: 1010, z: 110, delayMs: 1800, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 2100 },         // camera ends ≈ 1430; view ≈ 1430..2710
    /* THE SECOND WAVE IS THE FIRST ONE THAT DOES NOT END WHERE IT LOOKS LIKE IT
       WILL. Three walk in from the front and read as the whole fight; then, five
       seconds after the last of them has arrived, a SECOND ERKPA comes in from
       the left, and three seconds after that a second JUIXY behind him.

       The reinforcements come from the left for the same reason TOM does in the
       first arena -- it is the direction the player has stopped watching -- but
       here the lesson has teeth, because by then they are committed to a fight
       and cannot simply back off the way they came.

       All `delayMs` are measured from the moment the ARENA STARTS, so the
       later two are 1400 + 5000 and then + 3000. Change the reference and both
       want moving together. */
    {
      kind: 'arena',
      enemies: [
        { kind: 'laranja',  x: 2280, z: 40 },
        { kind: 'tomato',   x: 2450, z: 120, delayMs: 500 },
        { kind: 'eggplant', x: 2360, z: 175, delayMs: 1400 },
        { kind: 'eggplant', x: 2200, z: 90,  delayMs: 6400, from: 'behind' },
        { kind: 'laranja',  x: 2240, z: 160, delayMs: 9400, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 3300 },
    /* THE BOSS. Last segment before the level is clear. Locks the camera like
       an arena — it is one, with one very large occupant — and ends when the
       Mosca Boss is dead. */
    { kind: 'boss' },
  ],
  /* How far past the last segment the level runs before it is won. */
  levelEndX: 4000,

  // --- Camera --------------------------------------------------------------
  /* A DEADZONE, not a hard follow: the camera only moves once the player has
     walked out of a band in the middle of the screen. A camera locked to the
     player makes the backdrop twitch on every step, which on a scrolling
     BACKGROUND is the difference between a walk and a treadmill. */
  camDeadzone: 130,       // px either side of the camera's focus point
  camFocusX: 0.42,        // where in the view that focus point sits (0..1)
  camEaseRate: 7,         // how quickly it closes the gap, 1/sec
  camLockEaseRate: 4,     // ...and when snapping to an arena lock (slower, so
                          // the lock reads as the world stopping, not a cut)

  /* =========================================================================
     THE FIGHTERS
     =========================================================================
     TWO PACK FORMATS, because only the player has been redrawn. The coconut
     now has a sheet made FOR this game (`pack: 'ragged'` — named animations,
     per-frame anchors, cut by tools/build-beat-coconut-defs.py). The villains
     are still the main game's 9-col x 5-row packs (`pack: 'grid'` — rows are
     directions, columns are poses), read through the same sheets.js.

     ONLY TWO FACINGS ARE BUILT — left and right. The grid packs do carry
     diagonals, and this game used to build six facings out of them, but the
     coconut's new sheet is drawn side-on only. Running the player on two
     facings while the enemies kept six reads immediately wrong, so the whole
     game is side-on now. `up` and `down` were already never selected, for the
     genre reason: fighters face ALONG the belt so the read of who is about to
     hit whom survives three enemies closing at once. Two facings is that rule
     taken to its end.

     When villain sheets are drawn, they get `pack: 'ragged'` and the grid path
     in sheets.js can go. */
  CHARACTERS: {
    coconut:  { sheet: 'v2:beatemup-dungeon/coconut-beat', pack: 'ragged',
                name: 'COCONUT' },
    tomato:   { sheet: 'saborosa-elementos-tomato',   name: 'TOM' },
    laranja:  { sheet: 'saborosa-elementos-laranja',  name: 'JUIXY' },
    eggplant: { sheet: 'saborosa-elementos-eggplant', name: 'ERKPA' },
  },

  /* Pose → sheet column. The packs were drawn for the main game's grab/throw
     verbs, so a beat 'em up has to READ them as punches — which works better
     than it sounds, because a lift windup and a jab windup are the same
     shape:

       col 0      resting                     → idle / walk
       col 1      first lift pose, arms out   → JAB
       col 2      second lift pose, committed  → STRAIGHT
       col 3      flattened carry pose        → HURT (it is a squash, and a
                                                squash is what a flinch is)
       cols 4-8   the charged throw swing     → the FINISHER: 5 is the wind-up,
                                                6 the strike, 7 the recovery.
                                                4 and 8 are the extreme ends of
                                                the charge and read as a pause
                                                rather than a blow, so they are
                                                left out of the punch.

     No new art was drawn for any of this. When real punch frames exist, this
     table is the only thing that changes. */
  POSE: {
    idle:     [0],
    walk:     [0],
    jab:      [1],
    straight: [2],
    finisher: [5, 6, 7],
    hurt:     [3],
    down:     [3],
  },

  /* Pose → animation, for the RAGGED packs. The coconut's sheet is 13 named
     animations (the illustrator's 13 rows); this table says which one a pose
     plays and, where a row holds more than one move, which slice of it.

     THE COMBO IS ONE ROW SLICED INTO FIVE. Row 5 is ten frames — five
     wind-up/strike PAIRS — so each hit of the combo is a 2-frame slice, and
     fighter.js's existing startup → active → recover walk lands the wind-up on
     startup and the strike on active. Nothing in the attack machine had to
     change to go from three hits to five.

     `comboLow5` is CUT BUT NOT WIRED. Row 6 is the same string ending in a low
     lunging punch instead of the uppercut; which finisher a player gets, and
     how they choose, is not decided yet. It is mapped here so that deciding it
     is a one-line change rather than a trip back to the cutter.

     The same is true of `lift` / `liftThrow` / `pickGround` / `carryWalk`:
     rows 7-10 are a complete pickup loop, and this game has no liftable
     objects yet. The art is cut and named, waiting on the mechanic. */
  POSE_RAGGED: {
    idle:       { anim: 'idle' },
    walk:       { anim: 'walk' },
    jump:       { anim: 'jump' },
    airPunch:   { anim: 'airPunch' },

    combo1:     { anim: 'combo', from: 0, to: 2 },
    combo2:     { anim: 'combo', from: 2, to: 4 },
    combo3:     { anim: 'combo', from: 4, to: 6 },   // the leaning punch
    combo4:     { anim: 'combo', from: 6, to: 8 },
    combo5:     { anim: 'combo', from: 8, to: 10 },  // the UPPERCUT
    comboLow5:  { anim: 'comboLow', from: 8, to: 10 },

    hurt:       { anim: 'hurt' },
    down:       { anim: 'knockdown' },
    death:      { anim: 'death' },

    lift:       { anim: 'lift' },
    liftThrow:  { anim: 'liftThrow' },
    pickGround: { anim: 'pickGround' },
    carryWalk:  { anim: 'carryWalk' },
  },

  /* How long ONE FRAME of a non-attack pose is held, in ms, per pose.
     Attack poses are not here on purpose: their frames are driven by the
     attack's own startup/active/recover windows, so a punch's drawing can
     never drift out of step with the window that can actually hit.

     Idle is slow because it is a breath, not an animation; walk is slow enough
     that the six frames read as steps rather than a scramble; death is slowest
     of all, because the last three frames are the dissolve and hurrying them
     throws the body away before the player registers it died.

     THESE WERE TUNED AGAINST A BUG, so the history is worth one paragraph.
     `animT` used to be advanced twice per frame, so every looping pose ran at
     DOUBLE the rate written here -- 95 played as 47, 220 played as 110. A 30%
     slowdown was asked for against what was on screen; fixing the double-
     advance and applying the 30% compounded, and idle landed 2.6x slower
     rather than 1.3x. Walk happened to land right; idle did not.

     Idle ended up at 200 by eye, after trying 110 (too fast), 286 (too slow)
     and 143 (still too fast). Both numbers are now literal: what is written
     here is what is drawn. */
  POSE_MS: { idle: 200, walk: 124, hurt: 100, down: 110, death: 130 },

  /* How long the LANDING frame of a jump is held after the arc has finished,
     in ms. Purely cosmetic and deliberately outside the jump itself: the six
     jump frames are spread across `jumpMs`, so buying the last one more time
     by re-weighting them would have to take that time off the other five, and
     the rise is not what needed slowing. Holding it past touchdown adds time
     instead of moving it, and leaves `jumpMs` -- which sets the window the
     player can punch the Mosca Boss in -- untouched.

     The hold is DROPPED THE MOMENT THE PLAYER MOVES, so it reads as landing
     rather than as being stuck. */
  jumpLandHoldMs: 150,

  /* How long the final frame of the death row is held BEFORE the game will
     accept a restart, in ms, on top of the row playing out (8 frames x 130ms).

     THIS IS NOT PADDING. A player who dies is almost always mid-mash, so
     without it the first press lands a heartbeat after the animation ends and
     the death is gone before it registers -- you know you lost, but not how.
     The DOWN card is held back for the same span, so the one moment the death
     row was drawn for is not spent behind a piece of UI. */
  deathHoldMs: 1000,

  /* How long a pick-up takes, in ms, by weight. ONE BUTTON, TWO ANIMATIONS --
     the object decides which, not the player:

       ground  a light thing off the floor, taken with a stoop  (row 9)
       heavy   a barrel or the like, hoisted from in front      (row 7)

     These are also the ANIMATION lengths: the rows spread their frames across
     the action rather than running at a fixed rate, so the drawing always fills
     exactly the time the player is committed for. Change one and the other
     follows.

     Heavy is longer because it looks longer -- four frames of hoisting against
     two of stooping -- and because a barrel should cost more to pick up than a
     bottle. It is the only difference between them today; when there are real
     objects it is the natural place to hang a weight penalty. */
  PICKUP_MS: { ground: 420, heavy: 640 },

  /* Drawn height of a fighter, in the fixed 1280x720 canvas — NOT a fraction
     of it. A fighter is sized against the belt and the other fighters, all of
     which are in canvas px, rather than being something that should grow with
     the window. */
  /* Sized by BODY_SCALE, along with everything else measured against a body —
     see the note on the knob at the top of this file. */
  fighterSizePx: 190 * BODY_SCALE,
  /* The HURTBOX, in world units — deliberately NOT the sprite's own silhouette.
     The poses run from 79px to 149px tall and from 74px to 137px wide, and a box
     that breathed with the art would make a fighter harder to hit exactly as it
     wound up to punch. It is the lesson the flying dungeon's coin and Time Boss
     both learned; here it applies to every fighter in the game.

     `bodyZ` is the DEPTH of the box, and it is small on purpose: a fighter
     occupies one narrow line across the belt, so lining up in depth is a real
     act. Widen it and the belt stops mattering. */
  bodyW: 74 * BODY_SCALE,
  bodyZ: 30 * BODY_SCALE,

  /* Frames are BOTTOM-ALIGNED to the fighter's ground line, so the feet stay
     planted while the poses change height (the packs run 79px to 149px tall).
     The main game does something cleverer here — a body-colour centroid scan,
     see src/entities/spritesheet.js — which is worth porting if a pose ever
     visibly floats. Bottom-align is right for a side view and costs nothing.

     Per-pose nudges in px for hand-correcting the ones that don't sit. Positive
     is DOWN. */
  poseNudge: { finisher: -6 * BODY_SCALE },

  /* The ground shadow's radii, in canvas px at the near edge of the belt. These
     lived as literals in game.js until the characters were resized and it
     became obvious they were a body measurement like any other — a shadow that
     kept its old size would sit visibly wider than the feet standing on it. */
  shadowW: 44 * BODY_SCALE,
  shadowH: 13 * BODY_SCALE,
  /* The altitude at which a shadow reaches its smallest and faintest; above it
     nothing more happens.

     THIS IS NOT `jumpHeight`, AND THE DIFFERENCE IS THE WHOLE POINT. It was
     jumpHeight once, which silently assumed every shadow-caster jumps like the
     player. The Mosca Boss FLIES — it sits at 620 during its descent — and
     dividing that by a 94px reference produced a negative ellipse radius, which
     throws, kills the frame before any sprite or HUD is drawn, and escapes the
     loop before the next frame is scheduled. One number took the game down.

     Set above anything that hovers (the boss's tell is 210) so the ramp is
     still meaningful across the range that matters, and the clamp in
     drawShadow() handles everything past it. */
  shadowLiftRef: 240,

  // --- Movement ------------------------------------------------------------
  /* Depth movement is SLOWER than travel along the belt, which every game in
     the genre does. The belt is only ~190px deep against a level thousands
     wide, so matching the speeds would make a tap of `up` cross the whole
     strip while the same tap along x barely registers. */
  walkSpeedX: 300,        // px/sec along the belt
  walkSpeedZ: 165,        // px/sec across it
  /* A jump is a DRAW-ONLY arc — it never touches x/z, so a fighter cannot jump
     over another fighter's depth slab and land somewhere it could not walk to.
     Height and airtime are separate knobs rather than one derived from the
     other, because the FEEL of a beat 'em up jump is floatiness, and that is
     the ratio between them. */
  jumpHeight: 118 * BODY_SCALE,  // px at the top of the arc — scaled with the body, so
                          // a jump stays the same height IN FIGHTERS
  jumpMs: 620,
  // --- Health --------------------------------------------------------------
  /* A MULTIPLE OF 22 (= BAR_FRAMES − 1), and it should stay one. The life
     bar has 22 squares above empty, so at 110 each square is exactly 5 damage
     with nothing left over — TOM's jab takes one square, ERKPA's takes two.
     Off a multiple, the squares fall at uneven damage values and the bar stops
     being something a player can count in hits. Was 100 before the hand-drawn
     bar landed; the bar is what makes the number matter. */
  playerHealth: 110,
  enemyHealth: { tomato: 40, laranja: 34, eggplant: 55 },

  /* =========================================================================
     COMBAT
     =========================================================================
     An attack is four numbers and a box. The four numbers are the whole feel
     of the game:

       startup   wind-up. NO hitbox. This is the window an opponent can see the
                 blow coming and get out of it, and it is what stops a fight
                 being a contest of who mashed first.
       active    the hitbox is live. Short, because a long active window lets
                 one punch sweep a room.
       recover   committed, cannot act. What LOSING a trade costs.
       cancel    a window, measured from the start of `active`, in which
                 pressing attack again advances the combo instead of being
                 dropped. Wider than the active window on purpose: a player who
                 presses on the frame the punch lands should be heard.

     `reachZ` IS THE ONE THAT MAKES THIS A BEAT 'EM UP. A punch has to line
     up in DEPTH as well as distance, and the size of that tolerance is the
     whole difficulty dial of the genre — too tight and the game is a fight
     with the belt, too loose and depth stops meaning anything and it plays
     like a side-scroller with extra steps. */
  /* FIVE HITS NOW, because the art has five. The coconut's combo row is ten
     frames — five wind-up/strike pairs — where the old borrowed pack could
     only fake three punches out of the main game's lift-and-throw poses.

     THE FULL-COMBO TOTAL IS STILL 28 DAMAGE, deliberately. Spreading the same
     28 over five hits instead of three keeps every enemy's time-to-kill
     exactly where it was tuned (JUIXY 34, TOM 40, ERKPA 55) — this was a
     sprite replacement, not a rebalance, and a combo that suddenly hit 40
     would have quietly made TOM a one-combo enemy. Retune here, on purpose,
     rather than inheriting it by accident.

     Hit 3 is the LEANING PUNCH and hit 5 the UPPERCUT — the two frames the
     artist drew bigger than the rest, so they carry more damage and more
     reach. The three plain punches share one drawing and read as the fast
     part of the string. */
  COMBO: [
    { pose: 'combo1', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 4, reachX:  96 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  60, lift: 0 },
    { pose: 'combo2', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 5, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    // The leaning punch: the body commits forward, so it reaches further.
    { pose: 'combo3', startupMs: 70, activeMs: 80, recoverMs: 100, cancelMs: 250,
      damage: 6, reachX: 110 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 140, lift: 0 },
    { pose: 'combo4', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 240,
      damage: 4, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    /* The uppercut KNOCKS DOWN, and that is what the combo is for: the first
       four hits are worth 19 damage between them, this one is worth 9 on its
       own AND takes the enemy off its feet, which buys the player the room to
       turn round and deal with whoever else has walked up behind them.

       It LAUNCHES — `lift` throws the target off the floor — because the frame
       is an uppercut and a knockdown that slid along the ground would fight
       the drawing. Row 6's low lunging punch is the alternative ending and is
       cut but unwired; see POSE_RAGGED. */
    { pose: 'combo5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,
      damage: 9, reachX: 118 * BODY_SCALE, reachZ: 52 * BODY_SCALE, knockback: 320,
      lift: 190 * BODY_SCALE, knockdown: true },
  ],

  /* THE ALTERNATE FINISHER. Row 6 is the same five-hit string as row 5 through
     hit four -- literally the same drawings -- and then ends in a LOW LUNGING
     PUNCH instead of the uppercut. So the two combos are not two moves; they
     are one move with two endings, and this is the ending.

     THE PLAYER PRESSES THE SAME BUTTON AND NEVER CHOOSES. Chains alternate:
     the first string ends in the uppercut, the next in this, and so on. Both
     drawings get used, the combo stops looking like a loop, and there is
     nothing new to learn -- see Player._comboDefs().

     IT DOES THE SAME 9 DAMAGE, deliberately. Alternating is a LOOK, not a
     rotation the player has to track: if one ending hit harder, the string
     would become worth counting, and mashing would silently become optimal on
     every other chain. What differs is the shape of the blow -- no `lift`,
     because the fist drives forward and down rather than up, so this one shoves
     the target down the belt instead of launching it, and reaches slightly
     further for the lunge. */
  COMBO_ALT_FINISH: {
    pose: 'comboLow5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,
    damage: 9, reachX: 124 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 420,
    lift: 0, knockdown: true,
  },

  /* HITSTOP — both fighters freeze for a moment on a connect. It is the single
     cheapest piece of juice in the genre and the one most responsible for a
     punch feeling like it weighed something: the picture holding still for two
     frames reads as impact far more strongly than any amount of particle.
     Scaled by the blow, so the finisher hits visibly harder than the jab. */
  hitstopMs: { jab: 55, straight: 70, finisher: 130 },
  /* NO SCREEN SHAKE. There was a shakeAmp/shakeMs/shakeFreq block here and it
     was REMOVED BY REQUEST — the effect is not wanted in this game. Hitstop
     carries the weight of a blow on its own. Noted rather than left as zeroed
     knobs so it does not read as an unfinished feature and get "fixed". */

  // --- Being hit -----------------------------------------------------------
  /* THE THIRD DIMENSION OF A HIT, and the only part of the test with no
     geometry drawn for it in the game itself. Two fighters whose floor boxes
     overlap still miss each other if their ALTITUDES differ by more than this —
     which is what makes jumping a real evasion and what puts an airborne
     fighter out of reach of a ground punch.

     Read by Combat AND by the debug overlay. It was a bare 70 written twice
     inside combat.js; the debug view has to test exactly what the resolver
     tests or it draws a lie, so it lives here now and both read it. */
  verticalReach: 70,

  hurtMs: 260,            // stun + i-frames. One number, so the invulnerability
                          // is always exactly as long as the flinch showing it.
  hurtBlinkMs: 60,        // flicker period while stunned
  knockbackDecay: 6,      // 1/sec — how fast a shoved fighter comes to rest
  /* A knockdown: launched, falls, lands, then lies there before getting up.
     The lie-down is generous because it is the player's breathing room. */
  downLandMs: 520,        // the arc, launch to floor
  downLieMs: 620,         // flat on the ground
  downRiseMs: 320,        // getting up — i-frames continue through this
  // How far a knocked-down fighter slides while airborne, px/sec.
  downSlideSpeed: 210,

  /* =========================================================================
     ENEMIES
     =========================================================================
     THE ATTACK TOKEN IS THE ONE THING HERE THAT MATTERS. Beat 'em ups let
     only one or two enemies commit to an attack at a time, however many are on
     screen; the rest close in, hover at a stand-off distance and wait their
     turn. Without it, six enemies that each attack when in range all attack at
     once, the player is hit from three sides on the same frame, and the game
     is not hard — it is arbitrary. This is the single most important AI rule
     in the genre and it is four lines of code.

     `maxAttackers` is the difficulty dial: 1 is forgiving, 2 is a real fight,
     3 is a beating. */
  maxAttackers: 2,
  /* How close an enemy gets before it stops walking in. Enemies that walk all
     the way to the player's exact position end up standing inside them, and
     two fighters in the same pixel is a shoving match rather than a fight. */
  enemyStandoffX: 88 * BODY_SCALE,
  enemyStandoffZ: 16 * BODY_SCALE,
  // How long an enemy hangs at the stand-off before it takes a swing, once it
  // holds the token. The randomised half stops a group attacking in lockstep.
  enemyWindupMinMs: 260,
  enemyWindupMaxMs: 900,
  // Off-token enemies drift to a spot around the player rather than standing
  // still — the circling that makes a crowd read as alive.
  enemyCircleRadius: 210,
  enemyCircleSpeed: 0.9,  // rad/sec around the player
  enemySpeedScale: { tomato: 0.72, laranja: 0.88, eggplant: 0.58 },
  enemyDamage: { tomato: 7, laranja: 5, eggplant: 10 },
  enemyReachX: 92 * BODY_SCALE,
  enemyReachZ: 48 * BODY_SCALE,
  enemyStartupMs: 200,
  enemyActiveMs: 90,
  enemyRecoverMs: 420,
  // Enemies spawn by WALKING IN from the nearest side of the screen rather
  // than appearing — a fighter that materialises in front of the player reads
  // as a bug even when it is the design.
  enemyEnterMs: 500,

  /* =========================================================================
     THE MOSCA BOSS
     =========================================================================
     STILL LIFE's fly boss, read IN PLACE out of the flying dungeon's asset
     folder — the same files that game plays, not copies.

     THREE SHEETS EXIST ON DISK AND ONLY TWO ARE LOADED. 01 and 03 are
     byte-identical (the flying dungeon verified this by hash), so the delivered
     1·2·3 flap is really A-B-A. MOSCA_CYCLE reproduces it exactly against two
     images. Note the cycle is NOT [0,1]: looping [0,1,0] holds A for two frames
     at the seam, which is what the artist's three-file cycle does. */
  MOSCA_SHEETS: [
    'v2:flying-dungeon/enemy-sheets/saborosa-boss-mosca-01.png',
    'v2:flying-dungeon/enemy-sheets/saborosa-boss-mosca-02.png',
  ],
  MOSCA_CYCLE: [0, 1, 0],
  moscaFlapMs: 90,
  /* The 7 poses are a TURN: profile-left (0), head-on (3), profile-right (6).
     The widths say so — 253px in profile down to 176px face-on, symmetric about
     the middle. Every pose shares the y band 38..302, so they draw from a common
     anchor with no per-pose offset. Measured by the flying dungeon's tooling;
     inherited unchanged because the sheets are unchanged. */
  MOSCA_RECTS: [
    [  57, 38, 253, 265],   // profile, facing LEFT
    [ 323, 38, 212, 265],
    [ 570, 38, 176, 265],
    [ 823, 38, 188, 265],   // head-on
    [1068, 38, 176, 265],
    [1278, 38, 212, 265],
    [1504, 38, 252, 265],   // profile, facing RIGHT
  ],
  MOSCA_REF_H: 265,

  // Drawn height in the fixed canvas. Fighters are 152, so at 230 it is half as
  // tall again as the thing fighting it — big enough to read as a boss without
  // filling the belt it has to move along.
  flyBossSizePx: 230,
  // A MULTIPLE OF 22 (= BAR_FRAMES − 1), like the player's, so its bar steps
  // evenly: 88 is exactly 4 damage a square.
  flyBossHealth: 88,
  flyBossHurtMs: 150,        // i-frames. Never optional — see the note on hurtMs.
  flyBossHitWRel: 0.62,      // hurtbox width, × flyBossSizePx. Fixed, not the
                             // pose's own silhouette: the turn takes it from
                             // 253px to 176px wide, and a box that breathed with
                             // that would make it a harder target as it turned.
  flyBossHitZ: 46,           // ...and its depth on the belt
  flyBossKnockback: 40,      // barely shoved: it outweighs a fighter, and a boss
                             // a combo could push around would never finish a move

  /* Profile-to-profile sweep time — how long the 7-pose turn takes end to end.
     Still Life's value, and the turn reads the same here.

     THIS ONE IS LOAD-BEARING IN AN UNOBVIOUS WAY. It divides into the turn
     rate, so leaving it undefined makes `facing` NaN, which makes the pose index
     NaN, which indexes MOSCA_RECTS to undefined — and the boss draws NOTHING
     while its shadow carries on perfectly. That exact bug has already happened
     once. poseIndex() now falls back to head-on if facing goes non-finite, so
     the failure is a boss that will not turn rather than one you cannot see. */
  flyBossTurnMs: 380,

  /* THE ENTRANCE — two beats, Still Life's, adapted to a belt. See _ambush().
     It cannot be HURT during either (no free health bar off a cutscene), but
     the ambush pass can land — see the note on hitbox(). */
  flyBossEnterMargin: 260,   // px beyond the view edge it starts from
  /* What being run down by the ambush costs. ZERO DAMAGE ON PURPOSE: it knocks
     the player off their feet and takes the beat needed to get up, and nothing
     else. An ambush is by definition something the player had no warning about,
     and chipping health for that is the cardinal sin of the genre — but an
     entrance that passes harmlessly through them is a screensaver. A knockdown
     is the middle: it lands, it is felt, it cannot kill. Raise it to bite. */
  flyBossAmbushDamage: 0,
  flyBossAmbushLift: 150,    // how high the knockdown throws them
  flyBossDescendSpeed: 430,  // beat two: down the middle. Slower — this beat is
                             // the arrival, not the threat
  flyBossDescendFromY: 620,  // altitude it reappears at, above the canvas top

  /* THE ROTATION, and it is DELIBERATELY NOT RANDOM. Learning a boss's pattern
     is the fight in this genre; a coin flip cannot be learned. Only the timing
     inside each beat varies. Add entries to lengthen the cycle. */
  flyBossAttacks: ['swoop', 'sweep'],

  flyBossHoverY: 150,        // rest altitude. ABOVE a standing punch (see the
                             // 70px vertical tolerance in combat.js) but inside
                             // the apex of a jump — that gap is the skill window
  flyBossHoverSpeed: 120,
  flyBossHoverMs: 1500,      // the rest beat before it winds up again
  flyBossTellY: 210,         // it RISES to telegraph: the only warning given
  flyBossTellMs: 620,
  flyBossFaceSpanX: 520,     // px of offset that turns it fully to profile

  flyBossSwoopSpeed: 560,
  flyBossSwoopY: 16,         // bottoms out just off the floor — which is also
                             // exactly when it becomes easy to punch
  flyBossSwoopMaxMs: 1400,   // a fuse, in case the aim point is unreachable
  flyBossSwoopDamage: 12,
  flyBossRecoverMs: 700,
  flyBossTouchKnockback: 260,

  /* THE GROUND PASS. It charges the ENTIRE width of the arena at floor level in
     one lane, and the only answer is to step OUT of that lane in z. Every other
     threat in this game can be handled by backing off along the belt, so this is
     the one move that makes DEPTH the thing being tested — which is the whole
     reason the game is on a belt at all. See _sweep() in fly-boss.js. */
  flyBossSweepSetSpeed: 620, // moving to the starting corner
  flyBossSweepHoldMs: 420,   // the pause on the floor before it goes
  flyBossSweepSpeed: 980,    // and then it is faster than the player can run
  flyBossSweepOverrun: 220,  // px past each edge, so it enters and leaves clean
  flyBossSweepDamage: 18,    // it hurts more than the dive, because it is harder
                             // to be caught by and easier to read

  flyBossFallSpeed: 240,     // out of the sky when killed
  flyBossBobFreq: 2.6,       // rad/sec — quicker and lighter than a fighter's
  flyBossBobAmp: 9,
  // Its health bar: the same hand-drawn bar, top-centre and wider than the
  // player's, which is how the flying dungeon stages a boss too.
  flyBossBarWRel: 0.34,
  flyBossBarTop: 26,

  // --- Gates ---------------------------------------------------------------
  /* The arena walls. Drawn only in debug; what the player sees is that they
     cannot walk further, which every beat 'em up communicates the same way —
     by the camera refusing to move. */
  gateMarginX: 40,        // px inside the view edge the wall sits

  // --- HUD -----------------------------------------------------------------
  hudFont: 'Futura, "Futura PT", "Century Gothic", "URW Gothic", "Trebuchet MS", sans-serif',
  hudColor: '#FAFA24',
  hudSize: 26,
  hudMargin: 22,
  /* --- The player's life bar ----------------------------------------------
     STILL LIFE's hand-drawn bar, the one the flying dungeon's boss fights use.
     Read IN PLACE from that game's asset folder rather than copied — one file,
     no second copy to drift, the same arrangement as the shared gamepad
     mapping. (package.sh will need a copy line for it; there is nowhere else it
     could come from in a standalone build.)

     23 frames of 333x50 stacked as a COLUMN, so frame k is (0, k*50). Not a
     meter that shortens: every state is its own drawing. Frame 22 is solid red
     (full), 11 solid yellow (the changeover), 0 empty white (dead).

     THE SQUARES ARE DRAWN SQUARE — never stretch it. Width is a fraction of
     the canvas and the height follows from the cell's aspect. */
  BAR_SHEET: 'v2:flying-dungeon/saborosa-hustlebar.webp',
  BAR_CELL_W: 333,
  BAR_CELL_H: 50,
  BAR_FRAMES: 23,
  /* NOT scaled by BODY_SCALE: the player's bar across the top of the screen is
     HUD, not a fighter. It was caught in the original find-and-replace that
     shrank the characters; this is the value that left it at, kept literal so
     shrinking the cast never shrinks the interface again. */
  lifeBarWRel: 0.24,      // of canvas width
  lifeBarLeft: 22,
  lifeBarTop: 18,

  // The ENEMY bars stay plain slabs — see the note in hud.js. They are ~50px
  // wide and the hand-drawn bar's 11 squares are illegible at that size.
  hudBarW: 300,
  hudBarH: 18,
  enemyBarW: 62 * BODY_SCALE,
  enemyBarH: 6,
  enemyBarLift: 14 * BODY_SCALE, // px above the sprite's top
  enemyBarFadeMs: 1400,   // how long after its last hit an enemy's bar shows

  /* --- The GO prompt -------------------------------------------------------
     Shown when an arena clears and the way forward opens. The word plus the
     MAIN GAME'S POINTING HAND (assets/intro-hand.png) — the same cursor the
     title screen uses to point at a menu item.

     It is reused rather than redrawn for the reason the flying dungeon reused
     its game-over panel on the title screen: it costs no new art, and a game
     whose UI furniture recurs reads as one game. It also happens to already
     point RIGHT, which is the direction this prompt exists to indicate, so it
     needs no flip.

     The bob is HORIZONTAL, not vertical — the prompt nudges toward the exit
     rather than bouncing on the spot, so the motion itself carries the same
     message the arrow does. */
  /* The word itself is the HAND-LETTERED "GO!" off the title sheet
     (assets/saborosa-letras-01.png), cut by tools/build-go-glyph.py — the same
     sheet the SABOROSA logo glyphs and the pointing hand come from. So the
     prompt is entirely drawn by hand and there is no typeface on it at all,
     which matters here: a geometric sans "GO" beside a hand-inked hand looked
     like two games.

     `saborosa-go-white.png` is cut alongside it, pixel-aligned, for the
     yellow/white flicker the SABOROSA letters do. NOT used yet — it is built so
     that choosing to flicker later is a draw-code change rather than another
     trip through the tool. */
  GO_SHEET: 'v2:beatemup-dungeon/saborosa-go.png',
  goY: 150,
  goH: 74 * 1.3,          // on-screen height of the GO! art; width follows aspect
  goHandH: 54 * 1.3,      // on-screen height of the hand; width follows its aspect
  goGap: 22,              // px between the word and the hand
  goMarginRight: 60,
  goBobFreq: 9,           // rad/sec
  goBobAmp: 8,            // px of horizontal nudge

  /* How long the prompt is up for, in ms, from the moment an arena clears.

     THE FADE IS INSIDE THIS, NOT ADDED TO IT: the last `goFadeMs` of the span
     is the fade-out, so the prompt is at full strength for goMs - goFadeMs and
     then leaves. Raising goMs buys solid time, not fade.

     It lived as a bare `1.6` in stage.js while everything else about the
     prompt -- its place, its size, its bob, its fade -- was already a knob
     here, so the one number anyone actually wants to change was the one that
     took a code edit. */
  goMs: 2600,
  goFadeMs: 400,          // the fade as it leaves; part of goMs, not extra

  // --- Debug ---------------------------------------------------------------
  /* Hold C: draw the boxes. Same key as the other two games, deliberately —
     it is the same gesture in all three. */
  debugColors: {
    body:   'rgba(90,190,255,0.85)',
    hit:    'rgba(255,80,80,0.9)',
    belt:   'rgba(255,255,255,0.18)',
    gate:   'rgba(255,200,60,0.6)',
  },
};
