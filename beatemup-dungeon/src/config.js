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

/* THE BELT, AND WHERE THE PLAYER STANDS ON IT, hoisted out of CONFIG so more
   than one entry can be DERIVED from them. A JS object literal cannot refer to
   its own siblings, and these three are the answer to "how high up the screen
   is the coconut" -- which the title screen now has to give the same answer to
   as the fight does. See `titleWalkGroundYRel`.

   They are the only reason these consts exist; `beltTopY`, `beltDepth` and
   `playerStartZRel` below are still the names everything reads. */
const BELT_TOP_Y = 520;
const BELT_DEPTH = 190;
const PLAYER_START_ZREL = 0.6;
const CANVAS_H = 720;

const CONFIG = {
  /* DEV MODE. Off is the shipping state; on is for getting through the level
     quickly while building it.

     IT CHANGES DAMAGE AND NOTHING ELSE. Reach, timing, knockdown, the combo,
     the attack token and every enemy's HP behave exactly as they ship, so what
     is being tested is the real fight at speed rather than a different game.

     IT IS LOUD ON PURPOSE. The HUD draws a DEV marker while it is on and
     `package.sh` REFUSES TO BUILD, because the one thing a dev switch must
     never do is ship silently -- a build where every punch does 50 would look
     like a balance disaster rather than a forgotten flag. */
  DEV: {
    /* ⚠️ CURRENTLY **ON**, WHICH IS NOT THE SHIPPING STATE. Off is what ships,
       and `package.sh` refuses to build while this is true -- so a forgotten
       `true` costs a failed build rather than a shipped cheat.

       ⚠️ THIS LINE IS THE ONE THING IN THE BLOCK THAT DESCRIBES A VALUE RATHER
       THAN A RULE, so read the value below and not this sentence. It said "OFF"
       for three days while the flag was true.

       It went off for the first itch build on 2026-08-22, back on the same day
       to test the horse fight and the barrels, off again for the final package,
       on again on 2026-08-23 to walk the level end to end after the jam pass,
       and off again to package it, on again on 2026-08-24 to test the food
       pickup and the air attack, and OFF AGAIN THE SAME DAY for the jam
       submission build. Everything below is dead while it is false,
       and so is the number-key ROOM JUMP, which is refused in input.js as well
       as here (see the note there). */
    on: true,
    /* vs the real string's 4 / 5 / 6 / 4 / 9.

       ⚠️ THIS IS THE ONE THING THAT MAKES A DEV SESSION UNABLE TO JUDGE THE
       FIGHT -- at 50 a punch the horse dies in three combos and every mook in
       one. So it has its own escape hatch: `combat.js` reads it as
       `punchDamage != null`, which means setting this to **null** keeps the
       room jumps and the readout while leaving the DAMAGE REAL. Use that to
       walk the level for pacing; use 50 to get somewhere quickly. */
    punchDamage: 50,
    /* ⚠️ HOW MANY LIVES A RUN STARTS WITH, OVERRIDING `playerLives` -- and it is
       here rather than there ON PURPOSE. Asked for 2026-08-31: *"change the
       number of extra lives of the player to 0 so I can quickly test the
       continue screen"*, which is a testing value, and `playerLives: 3` is the
       tuned one every fight in the game is balanced against. Editing that would
       have shipped the change; this cannot, because `package.sh` refuses to
       build while `on` is true.

       ⚠️ IT IS TOTAL LIVES, NOT EXTRA ONES. The HUD's "x2" is lives MINUS the
       one being played, so "0 extra lives" is **1** here and the first death
       goes straight to the continue screen.

       ⚠️ AND A CONTINUE GIVES BACK THIS SAME NUMBER, not `playerLives`. Both
       sites ask `player.fullLives()`, which is the only thing that knows what a
       full set is -- otherwise continuing during a dev session would hand back
       three and the screen under test would not come round again.

       null = leave `playerLives` alone, which is what a dev session testing
       anything else wants. */
    lives: 1,

    /* WHICH ROOM THE GAME STARTS IN, by index into ROOMS. Testing a late room
       by playing to it is how a late room stops getting tested; this is the
       shortcut.

           0  street     1  desert     2  bookcase     3  boss room (HIPÓLITO)

       The NUMBER KEYS do the same thing live, and they are **one-based** --
       `input.js` sets the jump to `n - 1`, so 1 is the street, 2 is the desert,
       **3 is the bookcase** and **4 is the boss room**. Both are dev-only and
       dead when `on` is false.

       ⚠️ THE KEYS FOLLOW THE ARRAY AND NOTHING ELSE, which is why inserting the
       desert at index 1 on 2026-08-27 moved 2 off the boss room and on to it
       without a line of input code changing, and why inserting the bookcase at
       index 2 later the same day moved the boss room from 3 to 4. Re-order
       ROOMS again and the keys re-order with it -- so THIS COMMENT is the thing
       that goes stale, not the behaviour.

       ⚠️ IT HAS NOW GONE STALE TWICE, and both times it was predicting itself.
       It said "1 the boss room" through the desert's insertion and "2 the boss
       room" through the bookcase's. If a third room is inserted, this line is
       the first thing to fix, not the last. */
    startRoom: 0,
  },

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
  /* The longest side a `big` asset is allowed to keep, in px. Anything over it
     is downscaled AS IT DECODES, before it ever reaches VRAM -- so this is the
     one number standing between a backdrop and the thrash PERFORMANCE.md
     records.

     3200 rather than 2400 so the filmed plate keeps its native 3114x478. At
     that size it is 6MB decoded, which is affordable; capping it to 2400 would
     have cost a quarter of the vertical resolution to save 2MB. Lower it if a
     future backdrop is genuinely large -- `fitH` means the plate keeps covering
     the frame whatever this does to it, so the only thing at stake is
     sharpness. */
  bigTextureCap: 3200,

  fitMaxScale: 0,        // 0 = uncapped, so itch's fullscreen button can fill a
                         // big monitor — see flying-dungeon/STATE.md for why

  /* How far PAST the edge of the view an enemy is placed to walk in from, in
     px -- ON TOP OF its own sprite's reach past its ground point, which
     Stage._spawn() measures off the drawing and adds. So this is clearance,
     not the whole distance, and it does not need revisiting when a pack is
     rescaled.

     ⚠️ IT USED TO BE THE WHOLE DISTANCE, a bare 70 in stage.js, and that broke
     silently the day the roaches were scaled up: a barata's drawing reaches
     169px from its ground point on one side, so 70px past the edge left its
     horns on screen, announcing where it would come from before it walked on.
     The cigarettes reach 60-68 and had always just fitted, which is why this
     had never shown. */
  spawnMarginPx: 70,

  /* =========================================================================
     THE DAY PASSING (stage 2's colour grade)
     =========================================================================
     ONE COMPOSITED RECTANGLE OVER THE WHOLE FRAME, walking from orange to purple
     as the player crosses the desert. Asked 2026-08-27: "a color filter on stage
     2 ... begin with a color like orange, and end with purple, that will give the
     player the impression that the day is passing ... it should affect everything
     on screen, except the HUD ... smooth transition, almost unperceivable".

     ⚠️ "EXCEPT THE HUD" IS THE DRAW ORDER AND NOTHING ELSE. game.js paints the
     layers, then the combat FX, then this, then the bars. There is no mask and no
     second canvas. Anything that must stay ungraded goes AFTER the `grade.draw`
     call, which is also why the room fade, the dev text and the debug overlay are
     untouched -- they already sat below it.

     ⚠️ IT IS DRIVEN BY DISTANCE, NOT TIME. "Purple at the end" is a promise about
     a PLACE, and only a position clock keeps it: a wall clock turns the sky
     purple early for a player who lingers in the first fight and leaves it orange
     for one who runs. The trade is that the sunset pauses inside a locked arena,
     which cannot be seen -- nothing is moving to compare it against.

     ⚠️ AND IT IS A HIGH-WATER MARK. This room reverses, so `camX / span` would
     rewind the evening every time the player walked back. Evenings do not do
     that; `peak` only goes up.

     ⚠️ THE STOPS EXIST BECAUSE ORANGE TO PURPLE IS NOT A STRAIGHT LINE. In one
     hop, #ffa24a -> #6b3fa0 lerps through a dead grey-brown at the midpoint --
     the two sit on opposite sides of the wheel and the straight line between them
     runs through the middle of it. The stops bend the path the way a sky goes:
     orange, red, pink-purple, purple. No leg crosses the grey.

     ⚠️ `multiply`, NOT A PLAIN RECTANGLE. Flat source-over at 20% is a sheet of
     coloured plastic: it lifts the blacks and flattens the frame toward one
     value. Multiply is coloured LIGHT -- black stays black, midtones take the
     tint, and the picture darkens as the tint darkens. The alpha ramps with the
     colour, so dusk is dimmer than noon without a second darkening pass.

     ⚠️ "ALMOST UNPERCEIVABLE" IS A RATE, NOT A STRENGTH. The end colours are
     meant to be seen -- orange at the start and purple at the end is the brief --
     what must not be seen is the CHANGE. It is spread over 5006px of camera
     travel, which is minutes of play, so the per-second delta is far under what
     the eye tracks. If it ever reads as a wipe, the fault will be a stop with too
     big a jump to its neighbour, not the overall spread.

     ⚠️ OPT IN PER ROOM (`ROOMS[n].grade`), like `scenery` and `flies`. The street
     is a different day and the boss room is indoors.

     ⚠️ THE BOSS ROOM IS NOT GRADED AND THAT IS A DECISION TO REVISIT. The desert
     ends purple and cuts to an ungraded room, which reads as the lights coming
     back on. It was left alone because the ask named stage 2 and the boss room is
     its own place -- one `grade: true` plus a stops list that opens where this one
     closes is the fix if that cut looks wrong in play. */
  GRADE: {
    on: true,
    mode: 'multiply',
    /* ⚠️ HOW MUCH OF THE RAMP IS LET THROUGH -- THE ONE KNOB TO TUNE. It scales
       every stop's alpha, so the SHAPE of the day (which colour, and how the
       weight builds toward dusk) is preserved by construction and only the level
       moves. Editing the four alphas by hand is four chances to change the shape
       while trying to change the level.

       ⚠️ IT LANDED AT 1.0, WAS HALVED, AND CAME BACK UP. 1.0 was refused -- "its
       too strong, too perceivable, can you make it more subtle" -- and 0.50 was
       the correction. Seen in play that was further than wanted, and it settled
       at 0.70: "instead of 0.5 in the knob, make it 0.7". So the useful range is
       narrow and the middle of it is the answer, which is worth knowing before
       anyone reaches for the ends again.

           0.35   barely there; the end stops reading as purple
           0.50   the over-correction; visibly a warm/cool shift, easy to miss
           0.70   ships
           1.00   the first pass, refused

       ⚠️ AND IT IS NOT THE SAME DIAL AS THE TRANSITION. "Too perceivable" here
       meant the tint's STRENGTH; the RATE of change is set by the room's length
       and the spacing of the stops. If the change ever reads as a wipe, that is
       a stop with too big a jump to its neighbour and this number will not fix
       it. */
    strength: 0.70,
    /* t is the fraction of the room crossed. Colour AND alpha ramp together --
       see the note above about dusk being dimmer as well as bluer. */
    stops: [
      { t: 0.00, color: '#ffa24a', alpha: 0.16 },   // low warm sun
      { t: 0.45, color: '#ff6a4d', alpha: 0.22 },   // late afternoon
      { t: 0.80, color: '#b0508f', alpha: 0.30 },   // dusk, pink over the sand
      { t: 1.00, color: '#6b3fa0', alpha: 0.38 },   // purple
    ],
  },

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
  /* MEASURED OFF THE FILMED PLATE, which is what these numbers were always
     waiting for. The rubbish pile the shot tracks past bottoms out between y
     480 and 540 across the strip, and the sand floor is over 70% of every row
     below y 586. 430 put the belt's FAR edge inside the pile, so fighters at
     z = 0 stood in the rubbish rather than in front of it.

     `beltDepth` is DELIBERATELY UNCHANGED. It is the depth dial of the whole
     genre — `reachZ` gives about 49px of slack on this 190px belt — and moving
     the band down onto the sand is a placement question, not a difficulty one.
     Change one at a time or neither change can be judged. */
  /* ⚠️ THESE ARE THE DEFAULT NOW, NOT THE ONLY BELT. As of 2026-08-27 a ROOM may
     declare its own — `ROOMS[n].belt: { topY, depth }` — and the desert does,
     at double the depth. A room that declares none gets these two, which is
     every other room, so nothing here moved.

     ⚠️ AND NOTHING IN THE GAME READS THEM DIRECTLY ANY MORE: `src/belt.js`
     resolves the room's band and everything on the floor reads `Belt.topY` /
     `Belt.depth`. A read left on CONFIG is a body standing on the street's floor
     in the desert, and it presents as a sprite-anchor bug rather than as a
     missed find-and-replace.

     TWO EXCEPTIONS, both correct: `Belt` itself falls back to them, and
     `titleWalkGroundYRel` below measures against them — the title screen is not
     a room and has no belt to be a property of. */
  beltTopY: BELT_TOP_Y,  // screen y of z = 0 — the FAR edge of the walkable band
  beltDepth: BELT_DEPTH, // its height in px; z runs 0..this
  /* WHERE HE STARTS, up the belt, as a fraction of its depth. It was a bare
     0.6 written twice in game.js -- at the start of a run and at the DEV room
     jump -- and it is a knob now because the TITLE SCREEN has to put him at the
     same height (see `titleWalkGroundYRel`). Three copies of a number that has
     to agree with itself is two too many. */
  playerStartZRel: PLAYER_START_ZREL,
  /* --- HE WALKS ON AT THE START OF A RUN -----------------------------------
     How far LEFT of his starting mark he begins, in px. Asked for 2026-08-24:
     "instead of just making the coconut fade in with the background, also make
     him come from the left". 0 turns it off and he is simply there.

     ⚠️ IT MUST CLEAR THE LEFT EDGE OF THE FRAME. His mark is `ROOMS[n].startX`
     (220 in the street) and he is about 100px wide, so anything under ~280
     starts him partly on screen and the walk-on reads as a slide. 360 puts his
     centre 140px off the edge, and at `walkSpeedX` 300 the walk takes 1.2s.

     ⚠️ HE IS `state: 'enter'` FOR IT, which `canAct()` and `vulnerable()`
     ALREADY tested for -- that state existed and nothing had ever set it. So
     the controls are dead and nothing can hit him until he arrives, with no new
     gate to add anywhere. */
  playerEnterPx: 360,
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
    /* THE FLIES, BETWEEN THE PLATE AND THE FIGHTERS. They live in the band
       above the belt, so in practice they overlap nothing and the order barely
       matters -- except for a jumping coconut at the back of the belt, who
       should pass IN FRONT of something that is up by the rooftops. Declared as
       a layer rather than drawn inline for the reason the entities layer is:
       where a thing sits in the stack is level data, not a line buried in
       render(). Off with `CONFIG.FLIES.on` -- see the note there. */
    /* THE GROUND ITSELF, between the plate and everything that stands on it.
       The desert's floor is covered in cigarette mounds; the player walks over
       the top of them, so they are BEHIND every fighter and there is nothing to
       z-sort. Declared as a layer for the reason the flies are: where a thing
       sits in the stack is level data, not a line buried in render(). Off with
       `CONFIG.SCENERY.on`, and per room with `ROOMS[n].scenery`. */
    { name: 'scenery',    scenery: true },
    { name: 'flies',      flies: true },
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
    /* THE FILMED PLATE: THE MOVIE ITSELF, projected behind the fighters. One
       layer at parallax 1.0, which was always the rule — the far scenery and
       the ground the fighters stand on are the same photograph.

       A STITCHED PANORAMA WAS TRIED HERE AND REJECTED. It is cheaper on
       paper — one static texture instead of a per-frame video blit — and it
       looked wrong. DO NOT PROPOSE IT AGAIN FOR THIS LEVEL. The plate is the
       moving footage; that is the point of it. */
    plate: {
      kind: 'video',
      /* ⚠️ THE RE-ENCODE, NOT THE MASTER, AND THE ONLY DIFFERENCE IS KEYFRAMES.
         Same 887 frames at the same rate -- tools/build-street-plate.py asserts
         the count, because `worldPxPerSecond` below is measured against it and
         a re-timed clip desyncs the background from the world standing in front
         of it. What changed is the spacing: one keyframe every 12 frames rather
         than three in the whole shot, which is what makes a backward SEEK cost
         a dozen frames of decode instead of nearly three hundred. 8.1MB -> 11MB
         buys exactly that. */
      src: 'v2:beatemup-dungeon/street-plate.mp4',

      /* ⚠️ EXPERIMENTAL, 2026-08-26 -- the camera may now run this shot
         BACKWARDS. It is half of the switch and the useless half on its own:
         this one lets the PLATE be scrubbed back, `ROOMS.street.reverse` lets
         the CAMERA ask. Turning off either one restores the old behaviour, and
         turning off this one while leaving the other is the bad state -- the
         camera would follow the player left over a shot that cannot go with
         it. If the experiment is dropped, drop both. */
      allowReverse: true,

      /* THE SYNC, AND IT IS A MEASUREMENT. How many px of CAMERA travel one
         second of the shot's own pan is worth, so the background moves 1:1
         with the world — which is what parallax 1.0 means.

         Derived, not guessed: phase correlation over all 887 frames puts the
         pan at 2266px of the 848-wide source across 29.52s. Drawn at 720 tall
         the source scales by 720/478 = 1.506, so that is 3413 screen px in
         29.52s = 116 px/s.

         Too low and the film races the player; too high and they slide across
         a still. If it looks wrong while walking, this is the only number.

         At walkSpeedX 300 the shot plays at about 2.6x, which reads as normal
         because nothing in the scene moves on its own — the only motion is the
         pan, and 2.6x is exactly what makes it match the walk. The level needs
         23.4s of the 29.5s, so it never runs out. */
      worldPxPerSecond: 116,

      /* How far out of step the shot may drift before it SEEKS rather than
         catching up by playing faster.

         6s LOOKS ENORMOUS AND IS DELIBERATE. When an arena hands over, the
         camera unlocks and yanks forward to re-acquire the player — up to 572px
         in one movement, which is 4.93s of film. At the old 0.75s that tripped
         a seek, and because the camera keeps moving for another half second it
         tripped one EVERY FRAME, each cancelling the last, so no frame ever
         decoded. That was the black backdrop in Firefox and the frozen one in
         Chrome, both at the moment the GO arrow appeared.

         Above the size of that yank, the handoff is absorbed by playing fast
         instead: the shot whips forward to catch up, which is what the camera
         is doing anyway. A seek is now reserved for a genuine discontinuity —
         a restart, where the camera returns to 0 and the film is 23s along. */
      resyncS: 6.0,

      /* How hard drift is corrected, in rate per second of error. */
      trackGain: 1.2,

      /* Ceiling on playbackRate. Raised from 6 so the 4.93s handoff gap closes
         in about half a second rather than lingering as a visibly wrong
         background. Browsers get choppy well before their nominal 16x limit,
         and the decode cost is real, so this is not free to raise further. */
      maxRate: 10,
      tint: '',
    },

    /* THE BOSS ROOM'S PLATE. Same treatment as the street's, with two
       differences that both come from the room being small and two-way.

       IT IS CROPPED AT THE TURN. The source pans right for 5.2s, rests, then
       comes back to where it started; played whole it would walk the player
       into the room and then drag the room back past them.
       tools/build-boss-plate.py finds that turn by phase correlation rather
       than by eye -- frame 156 -- and cuts there.

       IT IS RE-ENCODED FOR SCRUBBING. `allowReverse` lets the camera run this
       shot backwards, and a video cannot PLAY backwards, so going back means
       seeking. The clip therefore carries a keyframe every third frame, which
       makes a backward step decode three frames instead of the several hundred
       the original's eleven-second keyframe spacing would have cost. That is
       the whole reason the boss room can have a camera that follows the player
       both ways and the street cannot. */
    bossPlate: {
      kind: 'video',
      src: 'v2:beatemup-dungeon/boss-room-plate.mp4',
      /* 337 screen px of pan across 5.206s. Measured, like the street's. */
      worldPxPerSecond: 64.8,
      allowReverse: true,
      resyncS: 2.0,          // the room is small; a big drift here is visible
      trackGain: 1.2,
      maxRate: 8,
      tint: '',
    },
    /* THE DESERT'S PLATE — the second walking room, and the street's treatment
       applied to a different shot. Nothing here is a new idea: it is a video
       scrubbed by camera position, it may be run backwards, and its sync is a
       measurement. See tools/build-desert-plate.py, which produces the file and
       prints the number below.

       ⚠️ IT PANS 1.7x FASTER THAN THE STREET, and that is the only thing about
       this room that is not the street's numbers. 3317px of pan across a
       848-wide picture is 5007px at the 1280 canvas, in 26.026s — 192.4 px/s
       against the street's 116. Two consequences worth knowing before touching
       the room's segments:

         * ONE SECOND OF FILM BUYS MORE WALKING. 5007px of camera travel here
           against the street's 3424, out of a SHORTER clip. That is why the
           room's `endX` is 6286 and the street's is 4704.
         * AND IT PLAYS SLOWER TO KEEP UP. At `walkSpeedX` 300 the shot runs at
           about 1.6x, where the street runs at 2.6x.

       ⚠️ AND IT IS THE ONLY PLATE THAT WAS DOWNSCALED. The master is 1920x1080
       HEVC at 17.7 Mbps — 56MB, against a whole itch build of 30 — and the
       plate is stretched to the canvas whatever its own size, so it is cut to
       the 848x478 both other plates already are, and encoded at CRF 32.
       56MB -> 4.8MB, twelve to one, and the per-frame blit cost stays exactly
       what PERFORMANCE.md measured.

       ⚠️ THE SIZE KNOB IS CRF AND NOT THE RESOLUTION, which is the opposite of
       the obvious move and was measured both ways: at the same file size,
       640x360 scores 0.831 against 848x478's 0.884, and it LOOKS it — the small
       one goes mushy on the gravel where the high-CRF one only loses grain.
       VP9 and a denoise pass were tried too and are both dead ends. The whole
       ladder, and why each lever was dropped, is in tools/build-desert-plate.py.
       Do not shrink this plate by scaling it further. */
    desertPlate: {
      kind: 'video',
      src: 'v2:beatemup-dungeon/desert-plate.mp4',
      /* 5007 screen px of pan across 26.026s. Measured by phase correlation
         over all 780 frames, like the other two. */
      worldPxPerSecond: 192.4,
      /* Paired with `reverse` on the room — see the note on the street's plate,
         both flags go together or the camera follows the player over a shot
         that cannot go with it. The clip carries a keyframe every 12 frames,
         which is what makes the backward seek affordable. */
      allowReverse: true,
      /* The street's 6.0, and for the street's reason: an arena handing over
         yanks the camera most of a screen, and a threshold under that tripped a
         seek every frame so nothing ever decoded. Absorb the handoff by playing
         fast; reserve a seek for a genuine discontinuity. */
      resyncS: 6.0,
      trackGain: 1.2,
      maxRate: 10,
      tint: '',
    },

    /* THE BOOKCASE — level 3's plate, and the only one in the game whose shot
       does not travel in one direction.

       ⚠️ `worldPxPerSecond` IS INERT FOR THIS ROOM AND IS KEPT ONLY SO THE
       ROUND TRIP CANCELS. `_drawVideo` computes `filmTime = scrollX / pps`, and
       level3.js hands it `progress * pps` in place of a camera position — so
       whatever number is here divides straight back out. It is NOT a sync knob
       for this plate; the sync lives in `CONFIG.LEVEL3.legs`, which ties film
       SECONDS to camera pixels leg by leg. The value is the shot's average
       (13530 screen px of pan over 74.0s) so that anything reading it for a
       sanity check gets a truthful number rather than a magic one.

       ⚠️ AND THAT IS WHY THE SWITCHBACK COSTS THE SHARED CODE NOTHING. backdrop.js
       never learns that a room with its own clock exists; it is handed a
       different number by one guarded line in game.js. See src/level3.js.

       15.26MB -> 5.04MB (3.0x) at CRF 30, and the two levers were an AAC track
       nothing plays (15% of the file) and the CRF ladder — see
       tools/build-level-3-plate.py. ⚠️ IT WAS NOT RESCALED and must not be: the
       master arrived already at 848x478, so the desert's "resolution is the
       wrong knob" finding applies with nothing left to spend. */
    level3Plate: {
      kind: 'video',
      src: 'v2:beatemup-dungeon/level-3-plate.mp4',
      worldPxPerSecond: 182.8,
      /* ⚠️ NEVER ACTUALLY EXERCISED, AND KEPT ANYWAY. `progress` is monotonic,
         so the scroll value this plate sees can only rise and the reverse branch
         in `_drawVideo` cannot fire. The clip still ships at GOP 12 like the
         others: the cost is small, and the day someone gives this room a
         checkpoint that walks the film back, the encoding is already right. */
      allowReverse: true,
      resyncS: 6.0,
      trackGain: 1.2,
      maxRate: 10,
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
  /* ===== ROOMS ===============================================================
     A room is a PLACE with its own footage, its own length and its own rules
     about which way the camera may go. The level used to be one flat list of
     segments against one plate; the boss room made that insufficient, because
     it is a different shot, a different size, and the only place the camera is
     allowed to run backwards.

     Rooms hand over through a FADE (see game.js): the player walks out of the
     right-hand edge of one and fades in at the start of the next. That is why
     each carries its own `startX` -- the camera and the player both reset to
     the new room's origin rather than continuing a single world x.

     `reverse` IS PER ROOM AND NOT A GLOBAL SETTING, because it is not free. It
     costs a plate that can be scrubbed backwards, which costs a re-encode with
     dense keyframes. The street's shot is eight megabytes at eleven-second
     keyframe spacing and could never do it; the boss room's is a five-second
     clip cut for exactly this. */
  ROOMS: [
    {
      name: 'street',
      plate: 'plate',
      startX: 220,
      /* THE FLIES BELONG TO THIS ROOM AND NOT TO THE OTHER ONE. See CONFIG.FLIES:
         they cross the band above the belt, and the boss room is indoors. The
         flag is here rather than a room name tested in flies.js so that a third
         room says which it wants by declaring it, the way `music` and `props`
         already do. */
      flies: true,
      /* --- WHAT IS LYING AROUND ------------------------------------------
         BARRELS AND FOOD, placed by hand like the enemies are, and belonging to
         the ROOM rather than to a segment: a wave is an event, a barrel is
         scenery, and hanging these off segments would make them appear as the
         player walked into a fight -- the "materialising in front of you" that
         the enemy walk-in exists to avoid.

         WHERE THEY ARE IS THE DESIGN. The first sits in the opening walk,
         before anything can hit back, so the lift and the throw are learned
         somewhere safe; after that they cluster at the near edge of each arena,
         where a player who is being surrounded can reach one. The food sits
         BETWEEN fights rather than inside them, so eating is a decision made
         while walking rather than a scramble mid-combo.

         ⚠️ THINNED TWICE ON 2026-08-22, AFTER PLAYING IT: nine barrels here
         became six and then FOUR. Both passes were "too many" on sight.

         ⚠️ AND ON 2026-08-23 THE STREET LOST ITS BARRELS ALTOGETHER, on
         request -- "remova todos os barris na fase principal, mantenha somente
         na boss room". The four entries are COMMENTED OUT rather than deleted,
         the same way the bomb rows and `trotMs` are kept: where they went was a
         design decision that took two passes to reach, and re-deriving it costs
         more than the six lines. Uncommenting is how they come back.

         SO THE BARREL IS NOW A BOSS-ROOM OBJECT ONLY -- two of them, against
         eleven in the level when they were first built. ⚠️ THAT ALSO MOVES
         WHERE THE MECHANIC IS TAUGHT: the barrel at 1450 sat in the opening
         walk precisely so the lift and the throw were learned somewhere nothing
         could hit back, and the first barrel a player now meets is on the floor
         of the last fight. The FOOD is untouched -- it was never part of the
         request and it is its own feature.

         ⚠️ x IS WORLD SPACE, THE SAME AXIS THE ENEMIES USE, and z is the belt
         depth (0..beltDepth, 210). A barrel at the same x as an arena's enemies
         is IN that fight; one 200px short of it is on the way in. */
      props: [
        /* ⚠️ TWO BARRELS IN THE FIRST FEW STEPS, added 2026-08-24 so the pickup
           can be tried the moment a run starts -- "add 2 barrels right at the
           beginning of the map, so I can test it out immediately". He walks on
           to x 220 and the opening segment is a PASSAGE rather than a fight, so
           these are the safest place in the game to learn a verb: nothing can
           hit back while he is holding one.

           ⚠️ THE FIRST ONE IS IN HIS OWN LANE ON PURPOSE. `liftRangeZ` is 46
           and he walks on at z 114, so a barrel at z 55 would be 59 away and
           would NOT lift until he stepped up -- which is the first way this
           mechanic looks broken when it is working exactly as specified. z 110
           is instant. The second sits at 165, a step down the belt, so the
           depth reach gets exercised deliberately rather than by accident.

           ⚠️ THESE ARE NEW PLACEMENTS, NOT THE OLD ONES BROUGHT BACK. The four
           commented out below were thinned deliberately in the jam pass and are
           left exactly as they were -- whether the street wants barrels again
           is a level decision, and this is a test rig. */
        /* ⚠️ `drops: true` -- THIS ONE ALWAYS HAS SOMETHING IN IT. Asked for
           2026-08-24, and it is a test rig rather than a balance choice: at the
           real 35% you would break four barrels to see one chicken, and this
           barrel exists to be broken the moment a run starts. The KIND is still
           the honest 50/50 -- "always drop a chicken or a bomb".

           ⚠️ AND `dropKind: 'bomb'` FORCES THE HALF, FOR DEV REASONS. At the
           honest 50/50 half the runs hand over a chicken, which is no way to
           look at an eight-second fuse. **This is a test rig and not a design
           decision** -- take the line off and it goes back to the real odds,
           which are what the other barrels in the level play by. */
        { kind: 'barrel',  x: 430, z: 110, drops: true, dropKind: 'bomb' },
        { kind: 'barrel',  x: 620, z: 165 },
        // The opening walk: a barrel, and nothing that can hit back.
        // { kind: 'barrel',  x: 1450, z: 60 },
        { kind: 'coxinha', x: 1900, z: 105 },
        // The first arena.
        // { kind: 'barrel',  x: 2180, z: 40 },
        // Past the sub-boss: the roaches. Far side of the belt, for variety --
        // the other three are all within a lane of the near edge.
        { kind: 'coxinha', x: 3480, z: 120 },
        // { kind: 'barrel',  x: 3860, z: 180 },
        // The last stand.
        // { kind: 'barrel',  x: 4120, z: 55 },
      ],
      /* Far enough right that the camera can reach 3424 — the end of the film
         at `worldPxPerSecond` 116. `camX` is clamped to `endX - GAME_W`, so
         this is a hard ceiling on how much of the shot can ever be seen. */
      endX: 4704,
      /* ⚠️ EXPERIMENTAL, 2026-08-26. FALSE UNTIL THE PLATE COULD TAKE IT: the
         camera follows the player back the way they came, which on filmed
         footage means scrubbing the shot in reverse. The master's eleven-second
         keyframe spacing could never do it; `street-plate.mp4` can. Paired with
         `allowReverse` on the plate -- see the note there, both go together.

         ⚠️ IT ONLY APPLIES WHERE THE CAMERA FOLLOWS AT ALL. Arenas lock and
         still pen the player to one screen, which is what an arena is; this
         changes the SCROLLS between them, where the left edge of the view used
         to be a wall. `bounds()` derives that wall from `camX`, so it comes
         back with the camera on its own. */
      reverse: true,
      segments: [
    /* THE OPENING IS A PASSAGE, NOT A FIGHT. It used to be 680px of walking
       into an arena that locked the camera again almost immediately — an inch
       of movement and the screen stops, before the player has any sense of
       walking through a place at all. The first wave was removed and the two
       scrolls merged, so the level now opens with ~1900px of uninterrupted
       travel: long enough to establish the shot, the belt and the walk before
       anything asks the player to fight. It also spends 42% of the film before
       the first lock, which is the stretch of footage most worth seeing
       uninterrupted. */
    { kind: 'scroll', toX: 2100 },         // camera ends ≈ 1430; view ≈ 1430..2710
    /* THE SECOND WAVE IS THE FIRST ONE THAT DOES NOT END WHERE IT LOOKS LIKE IT
       WILL. Three walk in from the front and read as the whole fight; then, five
       seconds after the last of them has arrived, a SECOND ERKPA comes in from
       the left, and three seconds after that a second CIGARRO behind him.

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
        { kind: 'cigarro',  x: 2280, z: 40 },
        { kind: 'cigarro2',   x: 2450, z: 120, delayMs: 500 },
        { kind: 'cigarro3', x: 2360, z: 175, delayMs: 1400 },
        { kind: 'cigarro3', x: 2200, z: 90,  delayMs: 6400, from: 'behind' },
        { kind: 'cigarro',  x: 2240, z: 160, delayMs: 9400, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 3300 },
    /* THE MOSCA, THE FIRST TIME. Locks the camera like an arena — it is one,
       with one very large occupant — and it is a SUB-boss: the level carries on
       past it.

       ⚠️ THIS ONE CANNOT BE KILLED. `fleeAt` is a fraction of its health: at
       half a bar it stops fighting, climbs out of reach and flies off the side,
       and the segment ends with it alive. Asked for 2026-08-27, and the reason
       it is worth having is what it does to the REST of the street -- every
       fight after this one is fought knowing the thing is still out there. The
       rematch is the last segment of this room.

       ⚠️ AND THE SEGMENT IS THE ONLY PLACE THAT KNOWS. FlyBoss without a
       `fleeAt` is the boss it always was; nothing remembers that this encounter
       happened, and nothing has to, because the rematch is a fresh one at full
       health rather than the same animal carried forward. Delete this one field
       and the street is exactly what it was before, twice. */
    { kind: 'boss', fleeAt: 0.5 },

    /* ===== PAST THE SUB-BOSS ==================================================
       THE LEVEL IS AS LONG AS THE FILM, and this stretch is what makes it so.
       The shot is 29.5s and `worldPxPerSecond` is 116, so it is worth 3424px of
       camera travel. The level used to give the camera 2632 and stop, which
       left the last quarter of the footage unseen. These segments spend the
       missing 792px.

       WAVES ARE FREE, SCROLLS ARE NOT, and that is the useful fact here. An
       arena LOCKS the camera, so a fight costs no footage at all — only walking
       moves the film on. So the number of waves is unconstrained; it is only
       the three short scrolls between them that have to add up.

       The last scroll's `toX` is set so the camera lands on 3424 as the player
       crosses it — the final frame — and the last fight plays out against it.
       The camera trails the player by `camFocusX` + `camDeadzone` (~668px), so
       retuning those moves where the film lands and these numbers move with
       them. */
    { kind: 'scroll', toX: 3690 },        // camera 2632 -> 3022   (film 88%)
    /* MORE ENEMIES, NOT MORE ARENAS. There are only 792px of film left after
       the sub-boss, and it was first spent as three 260px walks — under a
       second each, which is shorter than the GO prompt, so the arrow was still
       on screen when the next fight penned the player in. Two longer stretches
       read as walking; the extra enemies go INSIDE the fights instead, staged
       by `delayMs`, which costs no film at all because an arena locks the
       camera. */
    {
      kind: 'arena',
      /* THE FIRST BUG FIGHT, and the cast changes here on purpose. Past the
         sub-boss only ONE cigarette is left -- CIGARRO3, the strongest of the
         three -- and everything else is baratas. Keeping the hardest of the
         old gang rather than the easiest is what stops the new wave reading as
         a reset: the enemy the player has learned to respect is now the
         familiar one.

         THE TAN ROACH STILL OPENS, but the wave is TWO AND TWO. It was three
         tan to one red, which was meant to teach the charge on one animal
         before the other arrived and instead just read as a colour that had
         been used too often. The tell gets learned from the move, not from how
         many are wearing the same shell -- and both roaches charge, so it is
         taught either way. */
      enemies: [
        { kind: 'cigarro3', x: 3600, z: 70 },
        { kind: 'barata',   x: 3800, z: 150, delayMs: 600 },
        { kind: 'barata2',  x: 3500, z: 110, delayMs: 2400, from: 'behind' },
        { kind: 'barata',   x: 3900, z: 50,  delayMs: 5200 },
        { kind: 'barata2',  x: 3450, z: 170, delayMs: 8000, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 4092 },        // camera 3022 -> 3424   (film 100%)
    /* THE LAST STAND, fought against the final frame of the shot. Two of the
       five come from behind, which by now the player has been taught twice. */
    {
      kind: 'arena',
      enemies: [
        { kind: 'barata2',  x: 4000, z: 60 },
        { kind: 'cigarro3', x: 4230, z: 150, delayMs: 500 },
        { kind: 'barata',   x: 3950, z: 110, delayMs: 1600, from: 'behind' },
        { kind: 'barata2',  x: 4100, z: 180, delayMs: 4200, from: 'behind' },
        { kind: 'barata',   x: 4300, z: 40,  delayMs: 7000 },
      ],
    },
    /* NARUTÃO COMES BACK, and this is what the street has been building to
       since he flew off. Added 2026-08-27 with the escape above; the two are
       one change and neither is worth anything alone.

       AFTER THE LAST WAVE, NOT INSTEAD OF IT. The player clears the street's
       final fight, the GO arrow does not come up -- there is nothing left to
       walk to -- and the camera locks again on the same boss they could not
       finish. It is the last thing in the room, so beating it is what opens the
       door to the boss room.

       ⚠️ NO `fleeAt`. This is the fight that ends him, and the absence of one
       field is the whole difference between the two encounters.

       IT COSTS NO FILM, which is the only reason there is room for it here. The
       shot is 29.5s and the camera has already spent all 3424px of it by the
       time the last wave is over; an arena and a boss both LOCK the camera, so
       this fight plays against the final frame exactly as the wave before it
       does. See the note at the top of this stretch -- scrolls are what the
       footage pays for, and this adds none. */
    { kind: 'boss' },],
    },

    /* ===== THE DESERT ========================================================
       THE SECOND WALKING ROOM, added 2026-08-27, and it goes BETWEEN the street
       and the horse: "after the player kills the fly boss, the next level is
       this one", with the boss room pushed to the end of everything. Nothing
       about the horse's room changed — a room's place in the game is its index
       in this array and nothing else reads one, so moving it was inserting this
       entry above it.

       IT IS THE STREET'S LOGIC AND NOT A NEW KIND OF PLACE, as asked. A filmed
       plate scrubbed by the camera, a camera that may run backwards, and a list
       of segments alternating walking with fighting. The only numbers that
       differ are the ones the FOOTAGE decides: 26.0s of shot at 192.4 px/s is
       5007px of camera travel (the street gets 3424 out of a longer clip), so
       this is the LONGER of the two rooms. See SOURCES.desertPlate.

       ⚠️ IT HAS NO CAST OF ITS OWN, AND THE TWO ARENAS HOLD ONE DUDU EACH AS A
       TEST RIG. They were placed empty first — "don't add any enemies yet, just
       try to add 2 arenas" — and given a body an hour later, "so I can test the
       arena effect". So each is now a REAL arena: the camera locks, the walls
       go up at the edges of the view, and clearing it leaves the checkpoint
       that stops the camera coming back. The waves that eventually live here
       are still an open design question; these two are one enemy each.

       ⚠️ THE EMPTY-ARENA PATH IS STILL THERE AND STILL WORKS. `Stage.update`
       reads an empty `enemies` list as a DOORWAY — hands over on the first
       frame, no lock, no GO arrow, no checkpoint. Emptying either list below
       puts this room back to one uninterrupted 5450px walk.

       ⚠️ NO FLIES AND NO PROPS. Both are per-room declarations and neither was
       asked for; the street's flies were placed for its rooftops and its
       barrels are a pickup test rig. Add them here as deliberate choices rather
       than by copying the street wholesale.

       ⚠️ IT PLAYS NOTHING. `music: false` — see below. */
    {
      name: 'desert',
      plate: 'desertPlate',
      startX: 220,
      /* ⚠️ SILENT, AND THAT IS `false` RATHER THAN AN ABSENT FIELD. Requested
         2026-08-27: "remove the main song from the desert level, we will use
         other songs later". Leaving `music` out is the OTHER thing — it means
         "the level bed", which is exactly the song being removed.

         `roomMusic()` in game.js reads the three states: absent is the bed, a
         key is that track, `false` stops the music on the way in. The room is
         then quiet until something asks for a track — nothing in it does, since
         it has no boss and the whistle layer rides the bed it no longer has.

         ⚠️ AND THE STREET'S BED DOES NOT COME BACK BY ITSELF AFTERWARDS. The
         boss room declares `musicBoss`, so walking out of here starts the
         horse's theme as it always did; but a room added after this one with no
         `music` would pick the bed up again mid-game. Put the song here when
         there is one. */
      music: false,
      /* ⚠️ A BELT TWICE THE STREET'S, AND IT IS THE FIRST ROOM TO HAVE ITS OWN.
         Requested 2026-08-27: "for the second level, double the height of the
         belt". The band a fighter walks in is 190px deep everywhere else; here
         it is 380.

         THE SHOT IS WHY. The street was filmed low and tight and 190px is the
         ground it has. This plate is a high, open shot of dirt with the wall
         along the top of the frame, so the walkable floor runs from about y 330
         to the bottom of the picture -- and the default band left the bottom
         third of it unusable.

         ⚠️ `topY` MOVES WITH `depth` AND THEY ARE A PAIR. z runs 0..depth and
         lives at `topY + z`, so doubling the depth alone would put the near edge
         at 900 -- 180px below a 720-tall canvas, and the player would walk off
         the bottom of the screen. 330 + 380 = 710 keeps the near edge exactly
         where the street's is, 10px off the bottom. That is why belt.js takes
         the ROOM rather than two loose numbers.

         ⚠️ IT MOVES EVERY z IN THIS ROOM, because a z is a position on a band
         and the band changed. The enemies below sit at 220 (58% across) where
         the street's equivalents sit at 110 -- the same PLACE on the belt, a
         different number. And the player walks on at `playerStartZRel` 0.6,
         which is 228 here against 114 there, for free.

         WHAT DOES NOT CHANGE: the perspective. `depthScale` is `z / depth`, a
         fraction, so bodies still shrink from far to near across exactly the
         same range -- a deeper belt is more room to move, not a different
         camera. And the C-key debug overlay reads the same two numbers, so its
         band, its walkable region and its depth ruler follow this room without
         being told. */
      belt: { topY: 330, depth: 380 },
      /* THE FLOOR IS CIGARETTES. Opt-in per room like `flies`, and for the same
         reason: the street is a filmed pavement and the boss room is indoors.
         See CONFIG.SCENERY -- the mounds are drawn behind every fighter and
         collide with nothing, so this changes what the room LOOKS like and
         nothing about how it plays. */
      scenery: true,
      /* THE DAY PASSES OVER THIS ROOM AND ONLY THIS ONE. Orange at the start,
         purple at the end, driven by how far across the room the camera has been
         -- see CONFIG.GRADE. Declared per room for the same reason `scenery` is:
         which rooms a whole-frame effect covers is level data. */
      grade: true,
      /* 5007px of pan + one screen. `camX` is clamped to `endX - GAME_W`, so
         this is the hard ceiling on how much of the shot can ever be seen —
         set at exactly the end of the film, the way the street's 4704 is. */
      endX: 6286,
      /* Paired with `allowReverse` on the plate; both go together or the camera
         follows the player back over a shot that cannot follow. The clip is
         re-encoded at GOP 12 for it — tools/build-desert-plate.py. */
      reverse: true,
      /* THE CAMERA TRAILS THE PLAYER BY ~668px (`GAME_W * camFocusX` +
         `camDeadzone`), so a scroll ending at `toX` leaves the camera at
         roughly `toX - 668`. Every film percentage below is derived that way,
         and retuning either camera number moves all of them together. */
      segments: [
        /* THE OPENING IS A PASSAGE, like the street's and for the same reason:
           long enough to establish the shot and the walk before anything asks
           for a fight. 2180px, and it spends the first third of the film. */
        { kind: 'scroll', toX: 2400 },   // camera 0 -> 1732   (film 35%)
        /* THE FIRST FIGHT. ⚠️ ONE ENEMY, AND IT IS A TEST RIG RATHER THAN A
           WAVE -- asked for 2026-08-27 as "one cigarrete enemy, so I can test
           the arena effect". One body is enough to make the arena a real one:
           the camera locks, the walls go up, and clearing it leaves the
           checkpoint that stops the camera going back. What is being tested is
           the lock, not the fight.

           DUDU IS THE LIGHTEST OF THE THREE CIGARETTES (34 HP, 5 damage against
           DEDÉ's 55 and 10), which is what a rig wants -- the arena is the
           thing under test and a long fight is in the way of looking at it.
           Change `kind` to `cigarro2` or `cigarro3` for a heavier one; nothing
           else moves.

           WHERE IT STANDS IS DERIVED. The camera locks around 1732, so the view
           is 1732..3012 and the walls (`camX + gateMarginX`) are 1772..2972 --
           that is the window an `x` has to fall inside. The scroll before it
           lands the player on 2400, and 2600 puts this 200px in front of him,
           which is the same beat the street's first arena opens on. ⚠️ z 220 is
           mid-belt ON THIS ROOM'S BELT, which is 380 deep rather than the usual
           190 -- the same 58% across the band the street's enemies sit at, and a
           step in front of where the player walks on (228). A z copied from a
           street wave would land at half the depth it means. */
        /* ⚠️ EVERY WAVE IN THIS ROOM NOW COMES UP OUT OF THE FLOOR. It started
           as this arena alone (*"make the first enemies come out from the ground
           so we can test them"*, 2026-08-31) with the other two left as ordinary
           walk-ins for comparison; the comparison was made and the answer was
           *"make all the enemies in this stage spawn like this (for now)"*. So
           `from: 'ground'` is on all three arenas.

           ⚠️ "FOR NOW" IS THE USER'S OWN WORD AND IT IS WHY THIS IS STILL WAVE
           DATA rather than a room flag. Taking it off is one word per enemy, in
           three places, and nothing else moves.

           ⚠️ THE EXCEPTION IS THE WALK-IN CHARUTOBI -- one here, three in the
           second arena. Those are deliberately NOT diggers: the point of them is
           that a rusher can also come at the player from off the screen, and a
           room where every single arrival is a hole in the ground has no
           contrast left in it. See their own notes below.

           ⚠️ THEIR `x` NOW MEANS WHERE THEY COME UP, NOT WHERE THEY WALK TO. It
           is the same number and the same spot -- a digger is spawned standing on
           its mark rather than off the edge of the screen (Stage._spawn) -- but
           it is on camera from the first frame of the heave, so a mark that used
           to be merely sensible is now framing. See CONFIG.EMERGE. */
        {
          kind: 'arena',
          enemies: [
            { kind: 'cigarro', x: 2600, z: 220, from: 'ground' },
            /* ⚠️ ONE ESPETO IN EACH OF THE THREE ARENAS, asked for 2026-08-27
               the moment his sheet was cut. He comes in AFTER the cigarette
               (900ms) and on the NEAR side of the belt where DUDU is mid-band,
               so the pair arrive as two things from two places rather than as a
               line -- the same staggering every street wave uses.

               z 300 is 79% across this room's 380-deep belt. Written against
               THAT, not against the street's 190 -- see the room's `belt`. */
            { kind: 'espeto',  x: 2750, z: 300, delayMs: 900, from: 'ground' },
            /* ⚠️ ONE CHARUTOBI IN EACH OF THE THREE ARENAS, placed the way the
               espetos were and for the same reason -- a new enemy that is not in
               the room is a new enemy nobody has watched. ONE, never two: he is
               outside the attack token (see CONFIG.SUICIDE_RUSH), so a pair
               would both run at the player on the same frame and there is no
               system left to stagger them.

               HE ARRIVES LAST (1800ms), which is a full second after the espeto.
               The run is the thing that has to be READ, and it reads as a run
               only against a fight that is already happening -- coming in with
               the others he is just a third body walking on. z 150 puts him on
               the FAR half of the belt (39% across this room's 380-deep band)
               where neither of the other two is, so the diagonal he takes across
               the floor is visible from the moment he sets off. */
            /* ⚠️ AND THE RUSHER DIGS TOO, WHICH IS THE ONE COMBINATION WORTH
               WATCHING FOR. His entrance normally drops the mark entirely -- he
               is running at the player from the moment he is due (see the note in
               Enemy's `enter` branch) -- so digging gives him a mark back, and
               the run starts from the hole rather than from off-screen. That is a
               shorter run than the one that was tuned, and this is the wave to
               judge it on. */
            { kind: 'charutobi', x: 2900, z: 150, delayMs: 1800, from: 'ground' },
            /* ⚠️ A SECOND CHARUTOBI, AND HE WALKS IN. Asked for 2026-08-31:
               *"at the first arena, add 1 more charutobi that spawns outside of
               the screen"*. No `from`, so he is the ordinary off-screen entrance
               every other wave in the game uses.

               ⚠️ THIS IS A DELIBERATE OVERRIDE OF "ONE PER ARENA, NEVER TWO."
               That rule is real and the reason still stands -- he is outside the
               attack token (CONFIG.SUICIDE_RUSH), so nothing in the crowd can
               stagger a pair; two due on the same frame both run at the player
               at once. The ONLY tool left is `delayMs`, so it does all the work
               here: 2600 against the digger's 1800, and the digger does not
               actually set off until his climb ends at 1800 + 940 = 2740. They
               are therefore a beat apart on purpose, and if they ever arrive
               together THIS number is the fix, not the AI.

               THE CONTRAST IS THE POINT of putting the two entrances side by
               side: one comes up out of the floor in front of the player, the
               other comes at him from off the right edge. z 260 keeps him well
               clear of the digger's 150 so the two runs are separate diagonals.
               ⚠️ HIS `x` IS UNREAD. A rusher never takes a mark -- he is running
               from the moment he is due -- so this is documentation of where he
               is aimed, nothing more. His `z` IS read. */
            { kind: 'charutobi', x: 2900, z: 260, delayMs: 2600 },
          ],
        },
        { kind: 'scroll', toX: 4000 },   // camera 1732 -> 3332 (film 67%)
        /* THE SECOND FIGHT, and the same rig again. Camera locks around 3332;
           view 3332..4612, walls 3372..4572, player lands on 4000. */
        {
          kind: 'arena',
          enemies: [
            { kind: 'cigarro', x: 4200, z: 220, from: 'ground' },
            { kind: 'espeto',  x: 4350, z: 300, delayMs: 900, from: 'ground' },
            // Same three-in-a-row staggering as the first arena; see the note
            // on the charutobi there for why he comes in a second behind.
            { kind: 'charutobi', x: 4500, z: 150, delayMs: 1800, from: 'ground' },
            /* ===== AND THEN THREE MORE CHARUTOBI, FROM OFF THE SCREEN ========
               Asked for 2026-08-31: *"at the second enemy wave, create like 3
               more of the charutobi enemy (red and explosive) that also come
               from outside the screen, instead of spawning from the ground"* --
               and then, the same day, *"make 2 of them come from the left"*. So
               it is one off the right edge and two `from: 'behind'`; see the
               note on those two for why they are the LAST two.

               ⚠️ THIS IS THE ROOM'S HARDEST MOMENT BY A LONG WAY AND IT IS NOT
               ACCIDENTAL. Four charutobi in one arena, each 30 HP, each doing
               12 damage AND a knockdown when he goes off
               (`DEATH_BLAST.charutobi`) against `playerHealth` 110. If all four
               land that is 48 -- getting on for half a bar -- plus four
               knockdowns, and a knockdown is the state in which the next one
               reaches you. **Judge this wave before judging the room.**

               ⚠️ NOTHING STAGGERS THEM BUT `delayMs`. He is outside the attack
               token (CONFIG.SUICIDE_RUSH), so the crowd has no way to hold one
               back while another commits -- the standing rule was ONE per arena
               for exactly this reason, and four is a deliberate override of it.
               900ms apart, the same spacing every other wave in this room uses,
               and the run itself takes about a second from the screen edge. Tune
               the fight HERE; there is no AI knob that will do it.

               ⚠️ AND THEY ARRIVE AFTER THE DIGGER, not with him. His climb ends
               at 1800 + 940 = 2740, so 2800 is the first frame at which a second
               one is a second one rather than a pair. See the first arena.

               THREE DEPTHS, DELIBERATELY: 250 / 330 / 190 across a 380-deep
               belt, none of them on the digger's 150. Three rushers on one z
               would run the same line and read as one thick enemy. ⚠️ Their `x`
               is unread -- a rusher never takes a mark. */
            { kind: 'charutobi', x: 4500, z: 250, delayMs: 2800 },
            /* ⚠️ THE LAST TWO COME FROM THE LEFT. Asked for 2026-08-31: *"when
               the charutobis come, make 2 of them come from the left, instead of
               the right"*. `from: 'behind'` is the entrance the street's roaches
               already use -- out of the ground the player has just cleared,
               which is the one direction they are not watching.

               ⚠️ WHICH TWO IS THE WHOLE READING, and it is the LAST two on
               purpose. The first runner still comes from the right, where the
               three diggers and every other enemy in the game have taught the
               player to look; the two behind him then break that. Reversed --
               left first -- the wave teaches nothing and then confirms it.

               IT COSTS NO TIME. The spawn is `camX - pad` against
               `camX + GAME_W + pad`, and with the camera locked at ~3332 and the
               player landing on 4000 the run in is ~858px from the left against
               ~802px from the right -- a difference of about 110ms on a 1.6s
               run. The 900ms spacing below is unaffected.

               ⚠️ AND NOTHING ELSE HAS TO CHANGE FOR IT. `Stage._spawn` puts him
               on the other side and hands him a first-frame facing; the rush
               branch takes its direction from the player every frame, so he
               turns and runs the right way without a special case. The `z`s stay
               where they are -- what has changed is the side, not the line. */
            { kind: 'charutobi', x: 4500, z: 330, delayMs: 3700, from: 'behind' },
            { kind: 'charutobi', x: 4500, z: 190, delayMs: 4600, from: 'behind' },
          ],
        },
        /* THE LAST WALK, and it lands the camera on the final frame of the shot
           exactly as the player crosses it. */
        { kind: 'scroll', toX: 5674 },   // camera 3332 -> 5006 (film 100%)

        /* ===== THE BOSS ARENA =================================================
           THE LAST THING IN THE ROOM, asked for 2026-08-27: "place a final arena
           at the end of the level, this will be the boss arena". Clearing it is
           what opens the door -- the segments run out, which with a room still
           to come is a DOOR rather than the end of the game, so he walks off the
           right-hand edge and fades into HIPÓLITO's room. No GO arrow: there is
           nothing left to walk to, and `_goPrompt` self-gates on that.

           ⚠️ IT IS STILL AN `arena`, BECAUSE THE DESERT HAS NO BOSS YET. When
           one exists this becomes `{ kind: 'boss', who: '<name>' }` and the
           enemy below goes. ⚠️ DO NOT LEAVE `who` OFF WHEN THAT HAPPENS: a boss
           segment with no `who` is the MOSCA, which is a default that predates
           the horse and means "the Mosca" everywhere it appears -- and she is
           already fought twice in the street and dies there.

           ⚠️ AND A LOCKED BOSS FIGHT HERE WILL FREEZE THE BACKDROP. The plate is
           a video scrubbed by camera position and nothing else, so a camera that
           does not move is a shot that does not move -- the boss room hit this
           on 2026-08-24 and answered it with `lock: false`. That answer is worth
           less here than it was there: this fight sits on the FINAL FRAME of the
           film, so even unlocked the camera has nowhere forward to go and the
           shot can only move if the player walks BACK. So expect a still
           backdrop for this fight whichever way it is set, exactly as the
           Mosca's street fight already looks. Framing it deliberately with an
           explicit `camX` a few hundred px short of the end is the way to buy
           room for the shot to keep running.

           IT COSTS NO FILM, which is the only reason it fits. An arena locks the
           camera, and the camera has already spent all 5007px of the shot by the
           time the walk before it is over -- the same trade the street's last
           two fights make.

           THE OCCUPANT IS A STAND-IN AND IT IS DEDÉ, the strongest cigarette
           (55 HP, 10 damage) rather than the DUDU the other two arenas hold. One
           body is what makes this a real arena rather than a doorway, and the
           heavier one reads as the last fight of the room. He stands 226px in
           front of where the walk leaves the player (5674), mid-belt. The walls
           are 5046..6246, so there is a whole screen of room around him. */
        {
          kind: 'arena',
          enemies: [
            { kind: 'cigarro3', x: 5900, z: 220, from: 'ground' },
            /* The third one, and this is the BOSS arena -- so until a boss
               exists it is the room's hardest fight by having two in it. */
            { kind: 'espeto',   x: 6050, z: 300, delayMs: 900, from: 'ground' },
            // ...and the third, so the room's hardest fight is the one that has
            // all three of its enemies in it. See the first arena's note.
            { kind: 'charutobi', x: 6200, z: 150, delayMs: 1800, from: 'ground' },
          ],
        },
        /* ===== HORACIO ========================================================
           THE ACTUAL BOSS, added 2026-09-02: *"this boss should appear at the
           second stage, after the last wave of enemies in the end of the
           stage"*. So the arena above is NOT replaced -- it stays as the last
           wave and he follows it, which is what "after the last wave" says.

           ⚠️ `who` IS REQUIRED. A boss segment without it is the MOSCA, which is
           a default that predates the horse; she is already fought twice in the
           street and dies there. The warning on the arena above said exactly
           this and it is kept because it is still the trap.

           ⚠️ NOT LOCKED, and the note above the arena explains why it buys
           little: the fight sits on the FINAL FRAME of the film, so the camera
           has nowhere forward to go and the backdrop is still either way. It is
           left unlocked so the shot can move if the player walks BACK, rather
           than being pinned for no gain.

           HE COSTS NO FILM, like the arena before him -- the camera spent all
           5007px of the shot before the walk ended. */
        { kind: 'boss', who: 'horacio', lock: false },
      ],
    },

    /* THE BOSS ROOM. Small on purpose: 337px of camera travel, about a quarter
       of a screen, so the camera barely moves and mostly just breathes with the
       player. The fight is what the room is for, not the walk. */
    /* =====================================================================
       LEVEL 3 — THE BOOKCASE (2026-08-27)
       =====================================================================
       ⚠️ INSERTED ABOVE THE BOSS ROOM, WHICH IS HOW THE HORSE GOT PUSHED TO THE
       END. A room's place in the game is its INDEX in this array and nothing
       else reads a room number, so "put the boss last" is an insertion and not
       a rename. The DEV number keys follow the array (`n - 1`), so they are now
       1 = street, 2 = desert, 3 = bookcase, 4 = boss room -- and the stale thing
       will be a COMMENT somewhere, never the behaviour.

       ⚠️ THIS ROOM DOES NOT USE THE SEGMENT MACHINERY, AND THAT IS THE POINT.
       `level3: true` hands it to src/level3.js at the top of `stage.update()`,
       which owns its camera, its walls, its film clock and its lifts. The
       `segments` list below is a single formality so that anything iterating
       rooms finds a well-formed one; level3.js never reads it. Do not "fix" it
       by adding scrolls and arenas -- the scroll branch completes on
       `player.x >= toX`, which is exactly the rightward assumption shelf 2
       breaks. Fights go in `CONFIG.LEVEL3.legs` when they arrive.

       WHAT IT IS: a switchback climb of a comic-book bookcase, filmed. Walk
       right along shelf 1, ride up, walk LEFT along shelf 2, ride up, walk
       right along shelf 3. See CONFIG.LEVEL3 for the measured legs.

       ⚠️ NO ENEMIES YET, DELIBERATELY. What was asked for was the level, the
       reordering, a smaller video and a placeholder elevator to test -- so this
       ships as a traversal. It is also the honest order to build it in: the
       switchback and the lifts are the parts that could be wrong, and a fight
       on top of them would only make that harder to see. */
    {
      name: 'level-3',
      plate: 'level3Plate',
      startX: 220,
      level3: true,
      /* ⚠️ SILENCE, LIKE THE DESERT'S. Leaving `music` out means *the level bed*,
         which is the opposite of nothing: `playMusic(key)` opens with
         `key || 'music'`, so a falsy key cannot express "none" and the decision
         has to be made before the call. */
      music: false,
      /* THE BELT. The shelves are shallow -- a fighter stands on a plank, not in
         a desert -- so this is nearer the street's 520/190 than the desert's
         330/380. ⚠️ `topY` AND `depth` ARE A PAIR: z lives at `topY + z`, so
         changing one alone puts the near edge off the bottom of the canvas. */
      /* ⚠️ `depth` IS ALSO THE ELEVATOR'S TOP FACE — 960 x 0.2080 — and the two
         cannot drift apart without the player walking off the back of a drawn
         platform. Move `LEVEL3.platform.widthPx` and this follows; the formula
         and the reason are in the note on that block. */
      belt: { topY: 470, depth: 200 },
      /* ⚠️ NOT A REAL WALL, AND NOTHING READS IT. level3.js pens the player to
         the current leg's band (`Level3.bounds`), so the room's own end is only
         here so `stage.endX()` returns something sane if anything asks. It is
         the far end of the last band; see the band layout in level3.js. */
      endX: 24500,
      /* ⚠️ NO `reverse`. The camera never runs the film backwards here --
         `progress` is monotonic by construction -- so the flag would claim a
         capability the room does not use. The clip is still cut at GOP 12. */
      segments: [
        /* A formality; level3.js drives the room. See the note above. */
        { kind: 'scroll', toX: 24000 },
      ],
    },
    {
      name: 'boss-room',
      plate: 'bossPlate',
      startX: 220,
      /* THE ROOM'S OWN MUSIC, and it starts the moment the player walks in --
         NOT when the horse arrives. The room opens with a wave of roaches, and
         starting the song on the boss left that whole first fight playing under
         the street's bed with the door already shut behind you. See roomMusic()
         in game.js; nothing ever stops it, so it carries the ending too. */
      music: 'musicBoss',
      /* TWO BARRELS AND NOTHING ELSE -- the chicken that was here was removed on
         request the same day. This is the one room where the placement is
         tactical rather than scenic: they sit BEHIND where the player enters
         and to either side of the belt, so they are still there when the horse
         arrives -- a thrown barrel is 22 damage against his 150, which is most
         of a clean combo for one press, and it is the answer to a charge you
         cannot get out of the way of.

         ⚠️ THE ROACHES COME FIRST and will happily eat both barrels. That is
         the choice the room is asking: spend them on the wave, or save them for
         the horse. */
      props: [
        { kind: 'barrel',  x: 620, z: 55 },
        { kind: 'barrel',  x: 780, z: 170 },
      ],
      /* 337px of pan + one screen. The camera crosses the whole shot and
         stops, which is the room's right-hand wall. */
      endX: 1617,
      reverse: true,
      segments: [
        /* THE WAVE FIRST, THE BOSS AFTER IT -- decided 2026-08-21. These three
           are no longer a placeholder standing in for an undecided occupant;
           they are the room's opening, and clearing them is what brings the
           horse out. */
        {
          kind: 'arena',
          /* THE CAMERA FOLLOWS THIS FIGHT, it does not lock. The room is 337px
             of travel — penning the player to one screen would leave nowhere to
             move, and a camera that trails them back and forth is the whole
             reason the room's footage was cut to be scrubbable in reverse. */
          lock: false,
          /* ⚠️ COCKROACHES ONLY IN HERE. The cigarettes are the street's gang
             and they are spent by the time the player reaches this room; the
             baratas took the whole stretch after the sub-boss, so the run
             arrives here already in roach country and the boss room reads as
             the end of that stretch rather than a reprise of the first one.
             Do not put a cigarette back in this wave. */
          enemies: [
            { kind: 'barata',  x: 900,  z: 70 },
            { kind: 'barata2', x: 1100, z: 150, delayMs: 900 },
            { kind: 'barata',  x: 700,  z: 110, delayMs: 2600, from: 'behind' },
          ],
        },
        /* THE FINAL BOSS. `who` picks the occupant: without it a boss segment
           is the Mosca, which is what every existing one means. The Mosca is a
           SUB-boss mid-street and is long spent by the time the player gets
           here, so this is the only place `who` is not the default. */
        /* ⚠️ `lock: false` LIKE THE WAVE BEFORE IT, and it is not only framing.
           The plate is a VIDEO scrubbed by camera position, so a camera that
           does not move is a shot that does not move -- locked, this fight
           froze the room on one frame for its whole duration. Reported
           2026-08-24: "the background animation gets stuck when the boss
           enters". The camera following the player is what keeps the footage
           running.

           ⚠️ THE MOSCA'S BOSS SEGMENT IS DELIBERATELY NOT GIVEN THIS. She
           computes her fly-in from the camera AT SPAWN, so a camera that moved
           afterwards would land her somewhere that is no longer the middle of
           the screen -- and the street cannot seek backwards anyway (keyframes
           eleven seconds apart). Her backdrop does still freeze during her
           fight; that is the same cause and a separate decision. */
        { kind: 'boss', who: 'horse', lock: false },
      ],
    },
  ],
  /* How far past the last segment the level runs before it is won. */
  /* Far enough right that the camera can reach 3424 — the end of the film at
     `worldPxPerSecond` 116. `camX` is clamped to `levelEndX - GAME_W`, so this
     number is a hard ceiling on how much of the shot can ever be seen, and at
     4000 it stopped the level 792px short whatever the segments asked for. */
  /* ⚠️ THE FLOOR UNDER EVERY SCROLL, and it exists because `toX` alone is not
     enough. A scroll's target is an absolute world x, but the player can
     already be past it when the scroll starts -- an arena or a boss locks the
     camera and still leaves them a screen's width to move in, so a fight that
     ends on the right-hand side can put them beyond the next target. The scroll
     then finishes on its first frame and the following wave spawns on top of
     them, which is what happened after the Mosca.

     A scroll now ends at whichever is further: `toX`, or this far from wherever
     the player was standing when it began. 260px is about a second of walking
     -- long enough that enemies are always found by walking INTO them.

     IT COSTS NO FILM in the normal case, because in the normal case the player
     is behind `toX` and this never binds. */
  scrollMinWalkPx: 260,

  levelEndX: 4704,

  // --- Camera --------------------------------------------------------------
  /* A DEADZONE, not a hard follow: the camera only moves once the player has
     walked out of a band in the middle of the screen. A camera locked to the
     player makes the backdrop twitch on every step, which on a scrolling
     BACKGROUND is the difference between a walk and a treadmill. */
  camDeadzone: 130,       // px either side of the camera's focus point
  camFocusX: 0.42,        // where in the view that focus point sits (0..1)
  /* How many px of camera movement one px of FORWARD walking buys. The camera
     moves only out of this budget, so it can never move while the player is
     still.

     1.0 IS THE VALUE THAT LEAVES THE PLAYER ALONE, and that is why it is set
     here. The camera matches the walk exactly, so the player's position ON
     SCREEN never changes: wherever they are when they push the edge of the
     deadzone is where they stay, and where they will be standing when the next
     arena locks.

     Above 1 the camera outruns them to re-frame the shot, which sounds tidy and
     reads as the player sliding backwards across the frame under their own
     feet. It was 1.8 and that was the complaint. */
  camFollowGain: 1.0,

  camEaseRate: 7,         // still used by the arena lock hand-over         // how quickly it closes the gap, 1/sec
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
  /* THE HERO'S PACKS, IN TAB ORDER. The list is data; which one is currently
     being played is state and lives in PlayerPick (src/player.js).

     Every entry must be a CHARACTERS key with the coconut's thirteen rows --
     the pose table, the hitboxes, the reaches and the walk speed are shared, so
     a pack here is a SKIN and not a character with stats of its own. Adding one
     is: cut it with tools/build-beat-coconut-defs.py, give it a CHARACTERS
     entry, name it here. Nothing else in the game asks who is being played. */
  PLAYER_PACKS: ['coconut', 'coconutStrong'],

  CHARACTERS: {
    /* `drawScale` is a DRAWN size only, applied on top of `fighterSizePx`, and
       the coconut is 10% down on everyone else. It does NOT touch the hurtbox,
       the punch reaches or the jump, which are global and stay exactly as
       tuned — so this is a look, not a rebalance. Worth knowing because the
       file's own rule elsewhere is that a sprite must not shrink while its
       reach does not; at 10% the mismatch is under 6px of reach and was judged
       worth it, but scale it much further and the punches start landing across
       a visible gap. */
    coconut:  { sheet: 'v2:beatemup-dungeon/coconut-beat', pack: 'ragged',
                drawScale: 0.9, name: 'LEBRON',
                /* 8% more air than the global arc, asked for on 2026-08-26 --
                   his jump only, IPANEIMA stays on the plain `jumpHeight`.
                   ⚠️ IT IS HEIGHT AND NOT AIRTIME. `jumpMs` is untouched, so
                   his air punch still lands on the same frames at the same
                   times and the AIR_ATTACK windows still line up with the arc.
                   ⚠️ AND IT STAYS UNDER `AIR_ATTACK.reachY` (120): the apex
                   goes from 85 to 92, so he can still reach the floor from the
                   top of it. Push this much past 1.4 and he starts sailing over
                   enemies he is punching at. */
                jumpScale: 1.08,
                /* THE VICTORY POSE, for the ending screen only. Atlas frame 10
                   -- row 1, column 3 of `coconut-beat-game.png` counting from
                   zero -- reached as slot 2 of the `jump` row, which is the row
                   the packer happened to put it in.

                   ⚠️ IT IS ADDRESSED BY ATLAS POSITION, NOT BY MEANING, and
                   that makes it fragile in a way the other poses are not:
                   re-running tools/build-beat-coconut-defs.py repacks the atlas,
                   and if the dedupe ever folds this frame differently the slot
                   moves. If the ending suddenly shows the wrong drawing, this
                   line is why. Verify against the atlas, not against the name. */
                poses: { victory: { anim: 'jump', from: 2, to: 3 } } },

    /* THE STRONG COCONUT — the same thirteen rows, drawn again as a different
       character, from `coconut-strong-sprites-fim.png` (2026-08-26). Same pose
       table, same `drawScale`, so he steps into the coconut's hitboxes, reaches
       and walk speed without moving one of them.

       ⚠️ HIS PACK IS CUT AT A DIFFERENT SCALE AND THAT IS NOT A STYLE CHOICE.
       The master is drawn 1.967x the size of the first coconut's (median body
       299px against 152px), so tools/build-beat-coconut-defs.py cuts him at
       0.8/1.967 to land him on screen at the SAME height. Every number that
       hits or gets hit in this game was tuned against a 152px body; shipping
       the art at its drawn size would have retuned all of them silently.

       ⚠️ AND ROW 8 HAS SIX DRAWINGS WHERE THE COCONUT'S HAS FIVE -- an extra
       arms-overhead tween. That is why POSE_RAGGED.carryThrow no longer pins
       `to: 5`; see the note there. Nothing else about him is a special case.

       ⚠️ THE `victory` SLOT WAS CHECKED AGAINST HIS ATLAS, NOT COPIED. The
       coconut's is addressed by atlas POSITION rather than by meaning, and the
       packer deduped the two sheets differently -- the coconut's jump row opens
       by reusing its idle drawing (atlas 10 at slot 2) and his does not (atlas
       11). The slot happens to hold the same arm-raised pose in both, which is
       why the same two numbers are written here; the two frames were put side
       by side and looked at before that was believed. If the ending ever shows
       him doing something other than raising a fist, this is the line, and the
       fix is to look at the atlas again. */
    /* ⚠️ 0.936 IS LEBRON'S 0.9 PLUS THE 4% ASKED FOR ON 2026-08-26, and it is
       a DRAWN size only -- `drawScale` never touches the hurtbox, the punch
       reaches or the jump, which stay global and stay exactly as tuned. So he
       is 4% bigger to look at and identical to fight with, which is the whole
       reason the number is here and not in the cutter: re-cutting the pack 4%
       larger would have moved the body height the pack scale was measured
       against and quietly retuned nothing-in-particular. */
    coconutStrong: { sheet: 'v2:beatemup-dungeon/coconut-strong-beat',
                     pack: 'ragged', drawScale: 0.9 * 1.04, name: 'IPANEIMA',
                     /* His strike frame held for two frames' worth of the arc
                        instead of one -- see Fighter.frameStep. Slot 4 is the
                        punch in both packs; only his needs the room. */
                     airDwell: { slot: 4, share: 2 },
                     /* 10% off the walk, and the WALK alone -- see
                        Player.update. Was 6% on 2026-08-26 and did not read as
                        heavy enough. The big one moves a shade heavier than
                        LEBRON without being worse to play: his reach, damage
                        and airtime are untouched, so nothing he can DO gets
                        harder, it just reads as weight. */
                     walkScale: 0.90,
                     /* His blows shove 15% further than LEBRON's. Damage is
                        untouched -- see the note at the hit site in combat.js
                        -- so this is weight, not power. */
                     knockbackScale: 1.15,
                     poses: { victory: { anim: 'jump', from: 2, to: 3 } } },

    /* CIGARRO — THE FIRST VILLAIN WITH ART OF HIS OWN, and he replaced JUIXY
       wave for wave rather than joining the cast: the orange was the main
       game's grab-and-throw pack read as punches, and this is a fighter drawn
       as a fighter. His stats are JUIXY's untouched (34 HP, 0.88 speed) so no
       fight's time-to-kill moved when the art did; what changed is that he
       THROWS A STRING — see ENEMY_COMBOS.

       `poses` overrides the shared ragged table only where his rows are not
       the coconut's, which is the knockdown alone: his falls over AND stands
       back up, so it is sliced by phase. His punch row needs no override — it
       is three wind-up/strike PAIRS, and `combo1`..`combo3` already slice a
       row in pairs, so the shared entries land on his hits exactly. That is
       worth knowing before editing them: those three are now read by two
       characters with different rows behind them. */
    cigarro:  { sheet: 'v2:beatemup-dungeon/cigarro-beat', pack: 'ragged',
                name: 'DUDU',
                /* UP ON REQUEST THREE TIMES: 20%, 10% and 10% again, from
                   1.0 he had implicitly when he was the reference every other
                   pack was measured against. He still is that reference -- the
                   stub below is expressed as a ratio to him and both moved by
                   the same factors, so the size difference the illustrator drew
                   between them is untouched and the pair still reads as one
                   gang with two builds.

                   ⚠️ THE REACHES HAVE NOT MOVED AT ALL. `drawScale` is drawn
                   size only; `ENEMY_COMBOS.cigarro` still swings 92/92/108 x
                   BODY_SCALE, the numbers it had when he was drawn a third
                   smaller than this. 1.2 was the limit the stub's note below
                   describes and he is well past it: his fist now ends visibly
                   PAST his hitbox, by roughly half his own reach again.
                   Growing those three reaches by the same 45% is the fix, and
                   it is a REBALANCE, which is why it waits to be asked for. */
                drawScale: 1.452,
                poses: {
                  /* The knockdown row, cut where the motion changes: three
                     frames of going over, one flat on the floor, two getting
                     up. These bounds are read off the ART — see the row table
                     in README.md — not chosen to divide evenly. */
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    /* THE STUB — TOM's replacement, and the pair to CIGARRO. Same eight rows,
       drawn bigger and cut at his own atlas scale; in the fight he is the
       HEAVIER of the two, because he inherited TOM's numbers exactly (40 HP,
       0.72 speed) the same way CIGARRO inherited JUIXY's. So the pair reads as
       one gang with two tempos: the white one is quick and comes at you, the
       stub is slow and costs more when it lands. */
    cigarro2: { sheet: 'v2:beatemup-dungeon/cigarro2-beat', pack: 'ragged',
                name: 'DIDI',
                /* HE IS BIGGER, AND THE NUMBER IS MEASURED OFF THE ART RATHER
                   THAN CHOSEN. Packs are scaled so their idle BODY is
                   `fighterSizePx` tall, which is what stops a sheet drawn at a
                   different size from arriving as a giant — but it also flattens
                   a size difference the illustrator drew ON PURPOSE. In the
                   masters his body is 405px against the first cigarette's 348:
                   16.4% bigger. That ratio is still what this number is FOR: it
                   is now 1.164 x the 1.452 both cigarettes have been raised by
                   between them, so the difference the illustrator drew survives
                   and the pair simply got bigger together.

                   It is a DRAWN size only. His hurtbox, his reaches and the
                   jump are global and unchanged, so this is a look and not a
                   rebalance — but that is also its limit.

                   ⚠️ AND HE IS A LONG WAY PAST IT. This note used to end "push
                   it much past 1.2 and his fist visibly outruns the reach it
                   actually has". At 1.691 he is drawn nearly 70% over the size
                   the pack was scaled to, while `ENEMY_COMBOS.cigarro2` still
                   swings the 92/92/108 x BODY_SCALE it had at 1.164. He is the
                   bigger of the two and so the worse offender: his swing will
                   look like it should have connected from a good deal further
                   out than it does, and at this size that is a thing a player
                   can notice rather than a thing only the config knows.

                   The fix is to grow those three reaches to match. It IS a
                   rebalance -- it makes him hit from further away, which is a
                   harder fight, not a bigger sprite -- so it waits to be asked
                   for rather than riding along with a size change. */
                drawScale: 1.691,
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    /* THE THIRD CIGARETTE, AND ERKPA'S REPLACEMENT. He took the eggplant's
       waves, HP and speed the same way CIGARRO took JUIXY's and the stub took
       TOM's, so no fight's time-to-kill moved when the art did.

       ⚠️ WITH HIM THE CAST IS ALL RAGGED PACKS. ERKPA was the last character
       on a main-game 9x5 grid sheet read as punches, which is why `sheets.js`
       carries two formats and why `POSE` (the grid pose-to-column table) is
       still in this file. Both are now dead weight. Removing them is a
       separate job and has deliberately NOT been done here -- a cast change and
       a loader refactor in one commit is two things to bisect.

       HIS SIZE IS THE STUB'S, AND IT IS MEASURED. Packs are scaled so the idle
       body is `fighterSizePx` tall, so every cigarette arrives on screen the
       same height whatever the master was drawn at, and `drawScale` is what
       puts the illustrator's intended difference back. At the cutter's shared
       0.49 his body measures 198.4px -- cigarro2's 198, not cigarro's 170. He
       was drawn as one of the BIG ones, so he carries the big one's number.
       Copied rather than re-derived, so the trio keeps the proportions that
       were drawn. */
    /* THE BARATAS. A different animal and a SHORTER SHEET -- six rows, not
       eight. No jump row and no knockdown row, because a cockroach does
       neither; what it has instead is the BALL, row 6, which is a move nothing
       else in the game has. See BARATA_CHARGE.

       THREE POSE OVERRIDES, AND EACH IS A CONSEQUENCE OF THE SHEET:

       `combo1..3` -- his punch row is FIVE frames, not the cigarettes' six, and
       it is not wind-up/strike pairs. Frame 0 is a guard he returns to and
       frames 1-4 are four separate strikes, so each punch is ONE drawing and
       the shared table's pair-slicing would cut every hit in half. The fourth
       strike is cut and unwired -- three is the longest string.

       `down` -- there is no knockdown row. It borrows the death row's last
       frame, which is the roach on its back with its legs up: that IS what
       being knocked down looks like for this animal, and he gets up out of it.
       A knocked-down barata and a dead one therefore share a drawing, which is
       correct rather than a collision.

       `ball` -- the charge, and it needs POSE_MS because an attack pose is
       normally frozen to three frames (startup/active/recover). See the ball
       branch in Fighter.frame(). */
    barata:  { sheet: 'v2:beatemup-dungeon/barata-beat', pack: 'ragged',
               name: 'CLAUDINHO',
               /* THE CIGARETTES' SCALE, 1.452, and they arrived without one at
                  all -- drawn at the bare normalised size while the rest of the
                  cast had been raised 45%, which is most of why they looked
                  like insects at the wrong end of a telescope.

                  ⚠️ THEY STILL READ SMALLER THAN A CIGARETTE AT THE SAME
                  NUMBER, and the reason is worth knowing before anyone retunes
                  this. `sheets.js` scales a pack so its idle BODY is
                  `fighterSizePx` tall, and for a cigarette every pixel of that
                  is cigarette. For a roach the top 44px of 168 -- 26% -- is
                  horns and antennae, so the animal itself only gets the
                  remaining 124px.

                  30% ON TOP OF THAT, ON REQUEST, and it lands at almost exactly
                  the number that argument predicts: matching a cigarette's
                  visible MASS rather than its normalised height wanted ~1.97,
                  and 1.452 x 1.3 is 1.888. So the roach stands as big as the
                  gang he replaced, rather than as tall.

                  AND 30% AGAIN, ASKED FOR ON 2026-08-22: 1.888 x 1.3 = 2.4544
                  -- then 10% BACK OFF the same day, 2.4544 x 0.9 = 2.20896,
                  and a last 5% on 2026-08-23: 2.20896 x 1.05 = 2.3194, which
                  is where it sits. He is still well past the mass
                  argument above: this is not matching a cigarette any more, it
                  is a roach that is bigger than the men, which is a choice
                  about what the fight looks like rather than a correction.

                  ⚠️ HIS REACHES HAVE NOT MOVED, AND THAT IS THE STANDING
                  WARNING ON THIS FIELD. `drawScale` is drawn size only: the
                  hurtbox, the punch boxes and the charge lane are all global or
                  per-attack numbers and none of them knows about it. At 2.21
                  the picture is about 17% wider than the boxes underneath it,
                  so a swing that looks like it grazed him will miss. If that
                  starts to read wrong in play, the fix is ENEMY_COMBOS'
                  reaches, not this number. */
               drawScale: 2.3194,
               poses: {
                 combo1: { anim: 'combo', from: 1, to: 2 },
                 combo2: { anim: 'combo', from: 2, to: 3 },
                 combo3: { anim: 'combo', from: 3, to: 4 },
                 down:   { anim: 'death', from: 2, to: 3 },
               } },
    /* The red one. Same six rows drawn to one plan, heavier in the fight. */
    barata2: { sheet: 'v2:beatemup-dungeon/barata2-beat', pack: 'ragged',
               name: 'ZIDANE',
               // The same number as the tan one, and measured rather than
               // assumed: both sheets cut to an identical 167.8px body, so the
               // pair is drawn at one size and there is no ratio to preserve
               // between them the way there is between the cigarettes. They
               // took the 2026-08-22 +30% and the -10% after it together, and
               // the 2026-08-23 +5% as well, for the same reason.
               drawScale: 2.3194,
               poses: {
                 combo1: { anim: 'combo', from: 1, to: 2 },
                 combo2: { anim: 'combo', from: 2, to: 3 },
                 combo3: { anim: 'combo', from: 3, to: 4 },
                 down:   { anim: 'death', from: 2, to: 3 },
               } },

    /* THE HORSE. THE FINAL BOSS, and the only entry here that is not a mook --
       it is in this table purely so the SHEET is loaded and built like any
       other ragged pack (manifest.js and game.js both walk these keys). Nothing
       spawns it as a crowd enemy; `HorseBoss` owns it, the way `FlyBoss` owns
       the Mosca.

       ⚠️ ITS ROWS ARE NOT THE CAST'S ROWS. Five rows, all of them movement or
       offense: runAttack, trot, walk, kick, turn. There is NO idle, NO hurt, NO
       knockdown and NO death, and that is confirmed rather than missing -- it
       takes damage the way the Mosca does, through a flash, a blink and the
       impact burst. Do not press a movement row into service as a hurt pose.

       ⚠️ THE `poses` MAP BELOW IS AN IDENTITY MAP, AND IT IS LOAD-BEARING.
       `sheets.draw()` takes a POSE name and resolves it through `pack.poses`;
       an unknown pose silently falls back to `idle`, and this pack has no idle,
       so the fallback lands on `anims.idle || [0]` -- frame 0 of runAttack, for
       every pose, forever. It does not error and it does not look obviously
       wrong at a glance. So each of his five rows is declared as a pose of its
       own name. What he must NOT get is the fighter vocabulary -- no combo1,
       no down, no hurt -- because there is no art behind any of it.

       `turn` IS NOT A FACING. It is a rotation: frame 0 is the left profile,
       frame 3 is head-on, frame 6 is the right profile. Drawing it through the
       pack's mirror would fold the rotation in half, so HorseBoss draws that row
       with the flip forced off. Rows 1-4 face RIGHT like the rest of the cast.

       `drawScale` 1.711 put his 234px body on screen at 234px -- the atlas is
       drawn at almost exactly 1:1, which is what the master was reduced FOR
       (tools/shrink-master.py).

       ⚠️ 30% BIGGER ON REQUEST, 2026-08-22: 1.711 x 1.3 = 2.2243, so he is
       drawn at 304px against a 137px fighter -- AND 5% MORE ON 2026-08-23,
       2.2243 x 1.05 = 2.3355, which puts him at 319px. THAT IS PAST 1:1 AND THE
       TEXTURE IS NOW UPSCALED -- there is no more detail in the atlas to find,
       so he will be very slightly softer than the men he is fighting. If that
       shows, the answer is a bigger master through shrink-master.py, not a
       smaller number here.

       ⚠️ AND HE DID NOT GROW ALONE, EITHER TIME. `HORSE_BOSS.sizePx` went to
       304 and then 319 with him so the hurtbox tracks the picture, and the two
       attack REACHES went up by the same factor because this file's rule is
       that a reach is measured off the drawing -- see the notes on each. What
       did NOT scale is anything measured in DEPTH (hitZ, kickReachZ,
       chargeReachZ): the belt is as deep as it was and a 2D drawing does not
       get deeper when it gets taller.

       NAMED HIPOLITO BY THE USER, 2026-08-21. */
    horse:   { sheet: 'v2:beatemup-dungeon/horse-beat', pack: 'ragged',
               name: 'HIPÓLITO',
               drawScale: 2.3355,
               poses: {
                 runAttack: { anim: 'runAttack' },
                 trot:      { anim: 'trot' },
                 walk:      { anim: 'walk' },
                 kick:      { anim: 'kick' },
                 turn:      { anim: 'turn' },
               } },

    /* THE BARREL, AND THE FOOD, AND THEY ARE ONE PACK because they are one
       sheet -- `barril-coconutbash.png`, cut by tools/build-beat-prop-defs.py.

       ⚠️ IT IS IN `CHARACTERS` AND IT IS NOT A CHARACTER. Nothing spawns it as
       a fighter; it is here because this table is what manifest.js loads and
       what sheets.js builds, so an entry here is how a ragged pack gets into
       the game at all. The horse is in the same position and for the same
       reason -- see its note. Adding a `PACKS` table beside this one would be
       the tidier shape and would mean touching both loaders for no behaviour.

       ⚠️ THE POSES ARE AN EXPLICIT MAP, LIKE THE HORSE'S, and load-bearing for
       the same reason: `sheets.draw()` resolves a pose through `pack.poses` and
       an unknown one falls back silently to `idle`. What this pack must NOT get
       is the fighter vocabulary -- no walk, no combo, no hurt -- because there
       is no art behind any of it.

       `drawScale` 0.8: the atlas holds 140px of barrel and this puts it on
       screen at 110 against LEBRON's 123, so it comes up to his shoulder. It is
       the number PROPS.barrel.sizePx is measured against -- ⚠️ move one and
       move the other, or the hit box stops matching the picture. */
    barril:  { sheet: 'v2:beatemup-dungeon/barril-beat', pack: 'ragged',
               name: 'BARRIL',
               /* ⚠️ 0.8 UNTIL 2026-08-24, THEN +30% BY REQUEST. `PROPS.barrel
                  .sizePx` is 0.8 -> 1.04 of `fighterSizePx` and MOVED WITH IT
                  -- see the warning above this entry: the picture comes from
                  here and the hit box comes from there, and a barrel that is
                  drawn bigger than it can be hit is the version of this bug
                  that is invisible until someone swings at one. */
               drawScale: 1.144,
               poses: {
                 idle:      { anim: 'idle' },       // 4: two drawings + mirrors
                 smash:     { anim: 'brk' },
                 smash2:    { anim: 'brk2' },
                 side:      { anim: 'side' },       // carried, and in flight
                 smashSide: { anim: 'brkSide' },
                 /* ONE ROW, TWO OBJECTS: slot 0 is the roast chicken and slot 1
                    the drumstick, so each is a one-frame slice of `food`. */
                 /* THE BOMB, AND `bomb2` IS ITS OTHER FACING, NOT A VARIANT.
                    Three frames each of a round black bomb whose FUSE BURNS
                    DOWN -- the spark walks in toward the casing and the sprite
                    loses 8px of height doing it. `bomb` has the fuse to the
                    RIGHT and `bomb2` to the LEFT.

                    ⚠️ THEY ARE HAND-DRAWN VIEWS, NOT MIRRORS: the coil of the
                    fuse and the highlight on the casing are different, and the
                    anchors sit at 41% and 59% of the frame. So `Bomb._frame`
                    PICKS THE ROW from its facing and draws at the pack's native
                    side, instead of letting sheets.draw flip one -- a flip
                    would leave the other row unused, which is exactly what was
                    happening.

                    ⚠️ THE SAME PAIRING EXISTS FOR `side` / `side2` AND THE
                    BARREL USES ONLY `side`. That is not an oversight to copy:
                    a barrel lying down is near enough symmetrical for the flip
                    to pass, and a lit fuse is not. */
                 bomb:      { anim: 'bomb' },    // fuse to the right
                 bomb2:     { anim: 'bomb2' },   // fuse to the left
                 chicken:   { anim: 'food', from: 0, to: 1 },
                 coxinha:   { anim: 'food', from: 1, to: 2 },
                 /* ⚠️ CUT BUT NOT WIRED, like the coconut's pickup rows were
                    before barrels arrived. The sheet carries six frames of a
                    lit bomb and there is no bomb mechanic; they are named here
                    so that deciding to have one is a one-line change rather
                    than a trip back to the cutter. */
                 bomb:      { anim: 'bomb' },    // fuse to the right
                 bomb2:     { anim: 'bomb2' },   // fuse to the left
               } },

    cigarro3: { sheet: 'v2:beatemup-dungeon/cigarro3-beat', pack: 'ragged',
                name: 'DEDÉ',
                drawScale: 1.691,
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    /* ESPETO — THE HEDGEHOG, and the DESERT'S OWN VILLAIN. Added 2026-08-27;
       the first enemy drawn for a room other than the street.

       NINE ROWS AGAINST THE CIGARETTES' EIGHT. It is their plan with a SECOND
       COMBO ROW in it — see tools/build-beat-enemy-defs.py, where the row table
       and the two things about the sheet that are not like theirs are written
       down: he BURSTS when he dies (four frames of loose spines, which needed a
       new kind of cut), and rows 5 and 6 share their first eight drawings.

       ⚠️ `drawScale` IS 1.0, WHICH MAKES HIM THE SMALLEST VILLAIN IN THE GAME,
       AND THAT IS A DECISION WAITING TO BE CONFIRMED. Every other pack carries
       a number well over 1 — the cigarettes 1.452 and 1.691 after three rounds
       of "make them bigger", the roaches and the horse 2.32 — so he arrives at
       the size the cutter gives him and reads smaller than the gang. At 1.0 his
       body is `fighterSizePx` (136.8px), which is a shade TALLER than LEBRON's
       123, so this is not a mistake, it is the others being oversized.

       ⚠️ AND GROWING HIM MEANS GROWING HIS REACHES WITH HIM, which is the trap
       the cigarettes fell into and their own notes describe: `drawScale` is
       DRAWN SIZE ONLY, and both of them now swing a fist that ends visibly past
       the hitbox it actually has. His reaches below are MEASURED off the art at
       1.0. Multiply this and multiply `ENEMY_COMBOS.espeto`'s `reachX` by the
       same factor, or he inherits the same fault on his first day.

       `poses` overrides only the knockdown, exactly as the cigarettes do and
       with the same bounds: three frames going over, one flat, two getting up.
       Read off the art (see the tool's row table); the shared `combo1`..`combo5`
       already slice his 10-frame punch row into its five wind-up/strike pairs,
       so nothing else needs saying. */
    espeto:   { sheet: 'v2:beatemup-dungeon/espeto-beat', pack: 'ragged',
                name: 'ESPETO',
                /* ⚠️ 0.9 = 10% OFF, ASKED FOR 2026-08-27, AND THE REACHES CAME
                   WITH IT. He shipped at 1.0 -- the honest size the cutter gives
                   him -- and the note below that predicted this is exactly the
                   move it warned about: `drawScale` is DRAWN SIZE ONLY, so
                   shrinking it without shrinking `ENEMY_COMBOS.espeto`'s three
                   `reachX` values and `DEATH_BLAST.espeto`'s would leave him
                   swinging and exploding further than he looks. All five were
                   multiplied by the same 0.9:

                       146 / 116 / 138  ->  131 / 104 / 124   (the string)
                       208              ->  187               (the blast)
                       70               ->   63               (its depth)
                       10               ->    9               (`groundNudge`)

                   That is the discipline both cigarettes failed at over three
                   size changes, and their own notes now admit to. Change this
                   number again and the same five follow it. */
                drawScale: 0.9,
                /* ⚠️ NO CORPSE FADE. Every other body in the game lies where it
                   fell and fades out over `corpseFadeS`; his does not, on
                   request 2026-08-27 -- "don't do this fade when the hedgehog
                   dies, trust the sprites, don't touch the opacity of it".

                   IT WORKS FOR HIM AND WOULD NOT FOR THE OTHERS, which is why
                   it is a flag rather than a change to the fade. The fade exists
                   because a cigarette's death row ENDS with a body on the floor,
                   and something has to take it away. His ends with the body
                   GONE: four frames of spines scattering, the last of them
                   almost empty. The drawing already does what the fade was
                   added to do, so doing both is dimming an explosion.

                   ⚠️ HE IS STILL REAPED ON THE SAME CLOCK. This is the OPACITY
                   only -- `corpseGone()` is untouched, so he is removed exactly
                   when any other corpse would be. Turning off the removal as
                   well would leave the last frame of the burst lying in the
                   desert forever. */
                corpseFade: false,
                /* ⚠️ 10px FURTHER DOWN, BY EYE, AND IT IS THE SECOND HALF OF THE
                   FLOATING FIX. The first half was in the cutter (`bodyMinRun`
                   80) and moved his ground line off the spike tip onto his body,
                   which is a real correction and worth 27px. This is the rest,
                   reported as "he is still too high, bring him down a little bit
                   more" -- and it is here rather than in the cutter because
                   `bodyMinRun` also decides `bodyH`, so a second pass of it
                   would move his drawn SIZE and the reaches measured off him
                   again, for what is a pure vertical taste call.

                   ⚠️ IT MOVES THE PICTURE, NOT THE FIGHTER. The hurtbox, the
                   reaches, the shadow and `depthScale` all still use the ground
                   point -- so this is the one knob on him that makes the drawing
                   disagree with the simulation, and a big value here is a sprite
                   standing somewhere its hitbox is not. 10px against a 170px
                   body is fine; if it ever wants 30, re-cut instead.

                   WHY HE NEEDED IT AND NOBODY ELSE DOES: his IDLE row is drawn
                   with the ball tucked up. His feet sit 24px above the line on
                   the first idle frame and 7 on the third, against 4-7px across
                   the whole walk -- so the pose the player looks at while
                   standing still is the one that reads as floating. */
                groundNudge: 9,
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    /* CHARUTOBI — THE SUICIDE BOMBER. Added 2026-08-28, off
       `espeto2-sprites-fim.png`, so he is espeto's red cousin: same master size,
       same spikes, same yellow gloves, same burst at the end of his death row.

       ⚠️ HE HAS NO PUNCH, AND THAT IS THE CHARACTER RATHER THAN A GAP IN THE
       ART. His sheet is SIX rows against espeto's nine and the three that are
       missing are both combo rows and the air punch: *"this enemy will be an
       explosive suicide enemy, that doesn't hit you with punches, it just blows
       when it gets near you. it comes running in the player's direction."* So
       there is no `ENEMY_COMBOS.charutobi`, no `enemyComboWeights` entry and no
       `enemyLeapChance` -- and none of them are omissions to be filled in later.
       His only move is CONFIG.SUICIDE_RUSH and his only damage is
       CONFIG.DEATH_BLAST.

       ⚠️ AND HIS DEATH ROW OPENS WITH THE KNOCKDOWN ROW, DRAWING FOR DRAWING.
       Measured, not assumed: the six knockdown tiles and the death row's first
       six are byte-identical, so the cutter's dedupe folds them and both rows
       index the same six tiles. That is the illustrator's plan (espeto's rows 5
       and 6 share eight drawings the same way) and it means his death reads as
       "knocked down, gets up, swells, detonates" -- which is the right shape for
       a bomb that goes off standing up.

       `drawScale` 0.9 IS ESPETO's NUMBER, so the pair stand the same height and
       read as one species. It costs nothing to copy here that it cost espeto,
       because there are no measured reaches on this character to drag along with
       it -- his one hitbox is the blast, and that one IS measured off the art
       (see DEATH_BLAST.charutobi), so shrinking him again means moving that.

       ⚠️ NO `groundNudge`, AND IT WAS CHECKED RATHER THAN LEFT OFF. Espeto needed
       9px because his ground line still sat 21px under his feet on the idle
       frame after the cutter's `bodyMinRun`. Charutobi's gloves land within
       ±2.5px of the line on every standing frame of every row, measured off the
       packed atlas -- so the second half of that fix has nothing to correct.

       ⚠️ `corpseFade: false` IS NOT COPIED FROM ESPETO -- IT IS LOAD-BEARING,
       AND LEAVING IT ON WOULD HAVE DELETED THE FEATURE THAT WAS ASKED FOR. The
       fade runs on `stateT` from the moment the body settles, so it reaches
       alpha 0 at 1320ms after death: `downLandMs` (520) + `corpseFadeDelayS` +
       `corpseFadeS` (800). His tremble begins at 910ms and his first drawn burst
       frame at 1710ms -- so with the fade on, the red flashing would dim out
       mid-blink and the three explosion drawings, the whole of *"keep the frames
       from the spritesheet"*, would be painted at alpha 0. Only the boom would
       have shown, which is espeto's death, which is the one thing this was asked
       NOT to be.

       ⚠️ AND IT IS AN OLDER TRAP THAN IT LOOKS. Espeto's flag was asked for on
       looks ("trust the sprites, don't touch the opacity") and it has been
       hiding this arithmetic ever since: ANY fighter whose death row plays past
       1320ms needs it. Found by printing `deathFrameStartS` for every frame
       against the fade clock, not by watching. The opacity only -- `corpseGone`
       does not read the flag, so he is still reaped on the same clock as
       everyone else (2561ms here, the boom being the last thing to finish). */
    charutobi: { sheet: 'v2:beatemup-dungeon/charutobi-beat', pack: 'ragged',
                name: 'CHARUTOBI',
                /* ⚠️ 0.6885 = 0.9 x 0.85 x 0.9 -- SHRUNK TWICE ON 2026-08-28
                   ("15% smaller", then "10% smaller"), AND FOUR MEASURED NUMBERS
                   CAME WITH IT BOTH TIMES. `drawScale` is DRAWN
                   SIZE ONLY, so every number read off his picture had to be
                   multiplied by the same 0.85 or he would explode further than
                   he looks -- the exact trap espeto's entry above spends a
                   paragraph on, and the one both cigarettes fell into:

                       DEATH_BLAST reachX   228 -> 194 -> 174
                       DEATH_BLAST reachZ    77 ->  65 ->  59
                       DEATH_BOOM  refPx    150 -> 127 -> 115  (drawn frame height)
                       DEATH_BOOM  sizePx   252 -> 214 -> 193

                   ⚠️ `baseYRel` DID NOT MOVE EITHER TIME, and that is the CHECK
                   that the rest was done right: it is a FRACTION of `refPx`, so
                   0.46 x 115 = 52.9 lands on the burst's new centre (52.4) by
                   itself, exactly as 0.46 x 127 landed on the old one. **A ratio
                   follows a rescale; an absolute number does not** -- which is
                   the cheapest test for whether a size change was finished.
                   Change this number again and the same four follow it. */
                drawScale: 0.6885,
                corpseFade: false,
                /* Row 5 is "takes 2 hits, knockdown, and then gets up", named by
                   the illustrator when the sheet arrived — so the six frames are
                   two hits, one flat, three getting up, and the three slices
                   below are that sentence. Espeto's are 3/1/2 because his row
                   spends longer going over. */
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 2 },
                  downLie:  { anim: 'knockdown', from: 2, to: 3 },
                  downRise: { anim: 'knockdown', from: 3, to: 6 },
                } },
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

    /* THE BARATA'S CHARGE -- ALL FIVE DRAWINGS AS ONE POSE, tell included.
       Frame 0 is him tucking in and frames 1-4 are the spin, and they are one
       pose rather than two because the ATTACK already separates them: the tell
       is the attack's `startup` window and the roll is its `active` one. Split
       into two poses, something would have to keep the pose and the attack
       phase in step by hand, and that is the class of bug this file keeps
       finding. In the shared table because that is where poses live, not
       because anything else can play it -- only the baratas have a `ball`
       animation, and `sheets.has()` keeps every other pack off it. */
    ball:       { anim: 'ball' },

    lift:       { anim: 'lift' },
    /* THE WHOLE ROW: reach, reach forward, arms up, swing, follow-through. It
       is a complete pick-up-AND-throw, which is why the game does not play it
       whole -- see `carryThrow`. Kept mapped because it is the row as drawn. */
    liftThrow:  { anim: 'liftThrow' },
    /* ⚠️ THE THROW STARTS AT FRAME 2, AND THAT IS A BUG FIX. Played from the
       top while he is ALREADY holding a barrel, frames 0 and 1 replay the grab
       -- and frame 1 is a fist punched straight forward, so pressing throw made
       him throw a PUNCH first and then heave. It read as the animation chain
       breaking, because it was two animations.

       Frame 2 is both arms overhead -- the same POSE the carry holds, though a
       separate drawing of it (atlas 26 against carryWalk's 25; the cutter's
       dedupe kept them apart, so they are two hands-up drawings and not one).
       Close enough that the chain reads straight through: carry -> heave ->
       follow-through, with nothing repeated. */
    /* ⚠️ NO `to`, AND THAT IS DELIBERATE AFTER 2026-08-26. It used to say
       `to: 5`, which was not a choice of ending -- it was the length of the
       row, written out. Sheets.draw reads a missing `to` as "to the end", so
       the two mean the same thing for the coconut and only one of them still
       means it for the strong coconut, whose row 8 has SIX drawings: the
       artist added a second arms-overhead tween. Pinned at 5 the new pack
       would throw and then stop one drawing early, dropping its
       follow-through, which reads as the arm sticking. */
    carryThrow: { anim: 'liftThrow', from: 2 },
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
  /* `ball` is here and no other ATTACK pose is, which is the exception worth
     knowing about. Attack frames are normally driven by the attack's own
     startup/active/recover windows so a punch's drawing can never drift out of
     step with the window that can actually hit. A charge is not a punch: it is
     one long active window that lasts until he leaves the screen, and read off
     the phases it would show a single frozen drawing the whole way across.
     So the ball spins on a clock, like the walk does. */
  POSE_MS: { idle: 200, walk: 124, hurt: 100, down: 110, death: 130, ball: 55 },

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
  /* HOW A CORPSE LEAVES. It lies where it fell, waits `corpseFadeDelayS`, then
     fades over `corpseFadeS` and is removed from the crowd once it is fully
     transparent.

     ⚠️ READ BY BOTH THE FADE AND THE REAPER, which is the point of them being
     here. They were two literals inside Fighter.draw(); nothing removed a body
     at all, and `crowd.clear()` was the only cleanup -- so the moment a segment
     handed over, every corpse still fading was deleted mid-fade. Split across
     two places these would drift and bodies would either vanish early or linger
     invisible forever.

     ⚠️ HALVED ON 2026-08-24: "os inimigos precisam desaparecer um pouco mais
     rápido depois que eles morrem". 0.6 + 1.2 was 1.8s of lying and fading, and
     the ask put it at under a second. 0.25 + 0.55 is 0.8.

     ⚠️ AND THE CLOCK DOES NOT START AT THE DEATH. `stateT` resets when the body
     reaches the floor, so the full time from the killing blow to an empty patch
     of street is `downLandMs` + these two -- 520ms + 800ms = 1.32s, not 0.8.
     Anyone reading "how long does a corpse last" off this pair alone gets the
     wrong answer by half a second.

     ⚠️ `downLandMs` IS DELIBERATELY NOT TOUCHED. It is the knockdown ARC, and
     it belongs to every fighter who is knocked over and gets back UP as much as
     to the ones who do not -- shortening it to get the total under a second
     would speed up every knockdown in the game, including the player's. If the
     total has to come down further, that is the conversation to have first. */
  corpseFadeDelayS: 0.25,
  corpseFadeS: 0.55,

  deathHoldMs: 1000,

  /* =========================================================================
     THE CLEAR BOARD
     =========================================================================
     What the run looked like, counted up a row at a time when the last room is
     cleared. `src/stats.js` gathers the figures, `Hud.drawResults` draws them.

     ⚠️ THE WHOLE TALLY MUST STAY UNDER ABOUT TWO SECONDS. Seven rows at
     `rowMs` each, started `rowStaggerMs` apart, then the rank: long enough to
     watch a number climb, short enough that nobody reaches for the button. A
     count-up is a reward, and a reward that outstays its welcome is a loading
     bar. A press part-way through SKIPS to the finished board rather than
     dismissing it -- a player must never lose their figures by being early.

     THE RANK JUDGES THREE THINGS AT ONCE, because any one alone is farmable:
     accuracy alone rewards poking at one enemy from safety, damage taken alone
     rewards running away, and time alone rewards skipping the fights alto-
     gether. Weighted together they describe a player who hit what they aimed
     at, did not get hit back, and kept moving.

     Both budgets are deliberately generous. `rankDamageBudget` is two full
     health bars and `rankParS` a comfortable clear, so C still reads as having
     finished the level and S is worth chasing. Retune S downward only after
     watching somebody who is not you play it. */
  RESULTS: {
    /* ⚠️ THESE TWO SET THE LENGTH OF THE WHOLE COUNT-UP, AND IT IS 4.0s:
       the last row STARTS at (rows - 1) staggers in and then takes `rowMs`, so
       with seven rows it is 6 x 500 + 1000 = 4000ms to the last number landing.
       Retiming means solving that again — a stagger raised on its own moves the
       finish by six times what it looks like.

       THE SPLIT BETWEEN THEM IS THE FEEL, not just the total. At 500/1000 each
       row gets its own beat before the next arrives while its number is still
       climbing, so the eye has somewhere to be and the board reads as a tally
       rather than seven counters running at once. Pushed the other way — a
       short stagger and a long roll — every number moves at the same time and
       it reads as noise, which is what 195/806 was starting to do.

       They were 620/150 (2.4s), then 806/195 (3.0s), now this. */
    rowMs: 1000,            // how long one number takes to roll up
    rowStaggerMs: 500,      // gap between rows starting
    rankDelayMs: 400,       // beat between the LAST ROW FINISHING and the stamp
    /* --- THE COUNT-UP TICK ------------------------------------------------
       STILL LIFE'S COIN HIT, once every `ms` for exactly as long as a number is
       moving. Asked for 2026-08-24: "os números indo pra cima no final ...
       reutilizar o hit da moedinha do still life", and then "o sfx precisa
       acompanhar a contagem dos números, começa quando os números começam a
       subir e para junto com eles".

       ⚠️ IT STOPS AT `resultsRollS`, NOT AT THE END OF THE BOARD. The numbers
       land, then `rankDelayMs` passes, THEN the rank is stamped. Ticking
       through that beat would fill the silence the stamp needs to land in.

       ⚠️ AND THE FILE IS A CUT, NOT THE ORIGINAL. `coin-hit-01.ogg` in the
       flying dungeon's folder is a TAKE: it holds a quiet first event and then
       the actual coin 672ms in, so playing it raw would tick two thirds of a
       second late every time. `tools/build-beat-sfx.py coin-tick --src ...`
       finds the loud event and cuts it to 340ms. That is why this one is
       COPIED where her sheets and her music are read in place -- a cut is a new
       file, not a view of the original.

       `rise` PITCHES THE TICK UP ACROSS THE ROLL, 1.0 to 1.25. A counter that
       ticks at one pitch for four and a half seconds is a metronome; one that
       climbs is going somewhere. Set it to 0 for a flat tick.

       `ms` 90 is about eleven a second. The cut rings for 340ms, so three or
       four are always overlapping -- which is what makes it sound like coins
       rather than like a clock. Slower than ~140 and it starts sounding like
       one. */
    TICK: { on: true, sfx: 'coin', ms: 90, rise: 0.25 },
    rankMs: 420,
    /* LAID OUT DOWNWARD FROM THE TITLE, and the whole column has to clear the
       rank stamp: seven rows at `rowStep` from `rowsY`, plus `noteStep` for the
       one row that carries a breakdown line, plus the stamp's own half-height
       above `rankY`. At the first numbers tried the breakdown line landed
       directly under the word RANK. If a row is added, move `rankY` down with
       it -- nothing here is computed from the row count. */
    /* ⚠️ NOTHING ON THIS BOARD IS IN ENGLISH, by request (2026-08-21): "quando
       aparece a contagem de pontos nada deve ser em inglês". The labels are
       Brazilian slang rather than translations of the English ones -- PORRADAS
       rather than "hits", VACILOS rather than "hits taken" -- because a literal
       translation of a scoreboard reads like a scoreboard, and these read like
       someone describing the fight afterwards.

       THE ONE DELIBERATE EXCEPTION IS `thanks2`. The end card was asked for as
       "obrigado por jogar THANK YOU" -- both languages, on purpose, the same
       pairing the flying dungeon's finale uses. It is not an oversight; leave
       it in English.

       ⚠️ WHICH WORD GOES ON WHICH ROW IS PARTLY MINE. The request listed
       "rango, sagacidade, vacilos, comédia etc" as the flavour to aim at, not
       as a mapping. PORRADAS, SAGACIDADE and VACILOS place themselves; ESTRAGO,
       PREJUÍZO, TEMPO and NOTA are mine in the same register; RANGO went on the
       body count because this is a game about food. COMÉDIA is NOT USED -- see
       the note in STATE.md; it wants to be the bottom rank tier, not a label,
       and that is a change to how ranks are drawn rather than a string. */
    LABELS: {
      hits:     'PORRADAS',      // hits landed / swings
      accuracy: 'SAGACIDADE',    // accuracy %
      taken:    'VACILOS',       // times the player got hit
      dealt:    'ESTRAGO',       // damage dealt
      suffered: 'PREJUÍZO',      // damage taken
      time:     'TEMPO',
      downed:   'RANGO',         // enemies put down
      rank:     'NOTA',          // the letter stamp's caption
      thanks:   'OBRIGADO POR JOGAR',
      thanks2:  'THANK YOU',     // in English ON PURPOSE -- see above
      prompt:   'pressione qualquer botão',
      lost:     'PERDEU!',
      dev:      'MODO DEV: os números de dano não são reais',
    },
    titleY: 100,
    titleSize: 54,         // was 76 when the word was just CLEAR
    subTitleSize: 26,
    subTitleGap: 40,       // px below the title line
    rowsY: 190,
    rowStep: 42,
    noteStep: 30,
    labelX: 366,
    valueX: 914,
    rowSize: 27,
    noteSize: 17,
    rankY: 588,
    rankSize: 76,
    rankColors: { S: '#FFD23F', A: '#7BD389', B: '#6FB3E0', C: '#E8E8E8' },
    // score >= min, first match wins. Keep it sorted downward.
    rankTiers: [['S', 0.90], ['A', 0.75], ['B', 0.55], ['C', 0]],
    rankWeights: [0.40, 0.40, 0.20],   // accuracy, health kept, pace
    rankDamageBudget: 220,             // two full bars of damage taken = 0
    rankParS: 150,                     // a comfortable clear, in seconds
  },

  /* How far PAST the right edge the coconut walks before the level is called,
     in px. Enough that he is fully gone rather than clipped at the frame edge —
     a fighter is up to ~137px wide and drawn from its own anchor, so a smaller
     pad ends the level with a sliver of him still showing. */
  outroExitPad: 220,

  /* The room-to-room fade, in ms, for the WHOLE thing: down to black over the
     first half and back up over the second. The room swaps at the blackest
     point so the change of shot, camera origin and player position all happen
     unseen. */
  fadeMs: 900,

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
  /* How long a reach takes, in ms. `heavy` is the over-the-head hoist a barrel
     gets, `ground` the stoop for anything else -- the object chooses; see
     Fighter.pickup(). `throw` is the wind-and-release, and `throwReleaseRel` is
     how far through it the object actually leaves his hands.

     ⚠️ 0.45 IS NOT A ROUND NUMBER BY ACCIDENT. `liftThrow` is five drawings --
     reach, reach forward, arms up, arm swinging through, follow-through -- so
     the arm passes his head somewhere around the middle. Release at 0 and the
     barrel leaves before he has moved; release at 1 and it leaves after the arm
     has already come down, which reads as it falling out of his hands. */
  PICKUP_MS: { ground: 420, heavy: 640, throw: 420, throwReleaseRel: 0.45 },

  /* --- IS THE PICKUP BUTTON WIRED AT ALL -----------------------------------
     ⚠️ TRUE AGAIN. It was turned OFF earlier on 2026-08-24 -- "L does nothing
     anymore, and I understand that now the player won't be able to pick up the
     barrels" -- and turned back ON the same day: "bring the pickup mechanic for
     the player to pick up barrels, we removed that".

     ⚠️ THE OFF PASS COST NOTHING BECAUSE THE MACHINERY WAS LEFT BEHIND THE
     FLAG RATHER THAN DELETED, which is exactly the argument that was made for
     keeping it. `Prop.lift`/`_liftArc`/`throwFrom`, `Props.liftTarget`,
     `Player.carrying`/`liftTarget`/`throwHeld`, `combat.propHits` and the
     `lift`/`liftThrow`/`carryWalk` poses were all still here and still correct;
     restoring the whole verb was this one boolean.

     ⚠️ AND IT DOES NOT CLASH WITH FOOD, which moved to the PUNCH button in
     between. That was the reasoning at the time and it holds: punch stoops for
     food (and throws a held barrel), pickup lifts and puts down. The two verbs
     never wanted the same button.

     WHAT GOES WITH IT: lifting a barrel, carrying one, throwing one, and
     putting one down. That is the whole verb, and it is the only thing that
     button did.

     WHAT DOES NOT: barrels are still PUNCHED APART and still drop a chicken, so
     they keep the job they do in the level -- see PROPS.barrel. And the stoop
     animation is not orphaned either, because taking food now plays it.

     ⚠️ THE MACHINERY IS ALL STILL HERE AND IS DELIBERATELY NOT DELETED.
     `Prop.lift`/`_liftArc`/`throwFrom`, `Props.liftTarget`, `Player.carrying`
     /`liftTarget`/`throwHeld`, the `lift`/`liftThrow`/`carryWalk` poses and
     `combat.propHits` are a working feature behind one flag, not dead code
     being kept out of sentiment: this is a taste call made in play and it can
     come back the same way it went. Turning it true is the whole restoration.

     ⚠️ THE PRESS IS STILL CONSUMED while this is false (`player.js` calls
     `takePickup()` and then ignores it) so a press cannot sit in the queue and
     fire later if it is ever flipped back mid-run. */
  pickupButton: true,

  /* =========================================================================
     PROPS -- BARRELS AND FOOD
     =========================================================================
     Added 2026-08-22 off one sheet. A barrel can be punched apart or picked up
     and thrown; food is stooped for with the punch button. The art and the pose names are
     CHARACTERS.barril; this is how they behave.

     ⚠️ A BARREL IS NOT SOLID. The player and the enemies walk straight through
     it, and that is a decision rather than an omission: nothing else in this
     game has body collision -- fighters pass through each other freely, which
     is what keeps a five-enemy crowd from wedging the player against a wall --
     and one solid object in a world with no collision is where a player gets
     stuck. If it ever wants to be solid, that is a mechanic for everything, not
     a flag on this. */
  PROPS: {
    barrel: {
      /* ⚠️ THE FEATURE SWITCH. `false` and there are no barrels in the game:
         none are laid out, nothing can be punched apart, lifted or thrown, and
         the pickup button goes back to a stoop at empty air -- which is what it
         did before they existed. Added 2026-08-22 at the user's request, ON,
         against the possibility that the mechanic does not survive playtesting.

         WHAT IT DOES NOT DO, on purpose:
           * it does not touch the FOOD. Drumsticks are placed by hand and are
             their own feature; only the chicken that would have been inside a
             barrel goes, because there is no barrel.
           * it does not delete the PLACEMENTS. `ROOMS[n].props` keeps its
             barrel entries, unread, so turning them back on is this same line.
           * it does not unload the ART. Barrels and food are one sheet.

         The gate is `Props.add()` -- the one funnel every prop goes through --
         rather than the room layout, so nothing added later can slip past it. */
      on: true,
      /* ONE PUNCH BREAKS IT, and every punch in the game does at least 5. That
         is deliberate: the resolver only ever hits the NEAREST target, so a
         barrel standing between the player and an enemy eats a blow meant for
         the enemy. Costing two punches would turn every barrel into an ambush
         rather than a thing you smash on the way past. */
      hp: 5,
      /* Drawn height in canvas px, and what the hit box is derived from.
         ⚠️ IT MUST AGREE WITH CHARACTERS.barril.drawScale -- the picture comes
         from there and this is what can be hit. 1.144 x fighterSizePx (136.8)
         is 156.

         ⚠️ GREW TWICE ON 2026-08-24, AND IT IS TWO NUMBERS EACH TIME. 110
         (drawScale 0.8) -> +30% -> 142 (1.04) -> +10% -> 156 (1.144). `hitWRel` is a FRACTION of this so the width
         follows on its own; `hitZ` below is absolute px and deliberately did
         NOT grow -- it is how much BELT the barrel occupies, and a taller
         barrel does not stand in more of the lane. */
      sizePx: 156,
      hitWRel: 0.8,      // hurtbox width, as a fraction of sizePx
      hitZ: 46,          // and its depth on the belt, in px
      /* How close he has to be to pick it up. Generous in x and tight in z, the
         same shape every reach in this game has: the belt is 210px deep and a
         barrel two lanes away should not jump into his hands. */
      /* ⚠️ 74 UNTIL 2026-08-24, AND IT HAD SILENTLY TIGHTENED. This is measured
         CENTRE TO CENTRE, so the margin a player actually feels is this minus
         the barrel's half-width -- 74 - 44 = 30px against the old 110px barrel,
         and 74 - 62.4 = **11.6px** once it grew to 156. The barrel got 43%
         bigger and the reach did not follow, so grabbing one quietly became
         four times fussier. 105 is 74 x 156/110 -- the RANGE scaled by the size
         ratio, which gives 42.6px of margin rather than the original 30. ⚠️
         Scaling the range is NOT the same as restoring the margin: an exact
         restore would be 62.4 + 30 = 92, and 92 leaves only 3px of slack over
         `dropAheadPx` 89, which one frame of movement would eat. 105 is
         deliberately the more generous of the two.

         ⚠️ SAME SHAPE AS THE THROW SPEED one entry down, and the second time in
         a day: **rescaling a sprite silently retunes every distance and speed
         measured against it.** After a `drawScale` change, walk the numbers that
         touch that object.

         ⚠️ AND IT IS THE CEILING ON `dropAheadPx` BELOW. Put a barrel down
         further away than he can reach and he cannot pick it back up. Move one
         and look at the other. */
      liftRangeX: 105,
      liftRangeZ: 46,
      /* HOW FAR IN FRONT OF HIM A BARREL IS PUT DOWN, in px, on the side he is
         FACING. Added 2026-08-24: it used to land on his exact position and
         draw over him.

         ⚠️ 89 IS DERIVED, NOT BY EYE: his half-width 26.6 plus the barrel's
         62.4, which is exactly where the two hitboxes stop overlapping. Any
         less and it still stands partly on him, which is the complaint this
         answers.

         ⚠️ IT ONLY FITS BECAUSE `liftRangeX` WENT TO 105 IN THE SAME PASS. At
         the old 74 the choice was "still overlapping" or "cannot pick his own
         barrel back up" -- 89 was unreachable. The two numbers are one
         decision: to push the drop further out, the reach goes with it. */
      dropAheadPx: 89,
      /* Height above his feet the BASE of the barrel is drawn at while carried,
         as a fraction of a body (`fighterSizePx`, 137) -- so 0.7 is 96px up.

         ⚠️ MEASURED OFF THE CARRY DRAWING, NOT GUESSED. `carryWalk` frame 0 is
         140px tall against an anchor 132 up, which at the coconut's pack scale
         puts the top of his raised hands 104px above his feet. 96 sets the
         barrel down INTO that grip by 8px; the first value here was 1.15 (157px)
         and left it floating half a barrel above his fingers. Re-measure if the
         coconut's sheet is ever re-cut -- this number depends on his drawing,
         not on the barrel's.

         It is also where a throw leaves from -- see Prop.throwFrom(). */
      /* ⚠️ 0.70 UNTIL 2026-08-24, LOWERED 10px BY EYE. 0.70 x fighterSizePx
         (136.8) was 95.8 above the belt line; 0.627 is 85.8. It is the barrel's
         GROUND POINT while held, so the whole barrel comes down with it -- and
         `throwFrom` starts the throw from `_carryY()`, so the throw now leaves
         from the lower place too, which is what keeps the two looking like one
         motion. */
      carryYRel: 0.627,
      /* --- THE HOIST -------------------------------------------------------
         HOW THE BARREL GETS FROM THE FLOOR TO OVER HIS HEAD. It used to not:
         it sat still for the whole 640ms reach and then appeared above him on a
         single frame, which read as a teleport because it was one. It now rides
         an arc for the length of the reach, turning 90 degrees onto its side as
         it goes -- the arms swing through an arc, so the barrel is on it.

         ⚠️ THE CLOCK IS `PICKUP_MS.heavy`, PASSED IN, not a duration of its own.
         The barrel and the animation have to finish together, and two numbers
         for one action drift the moment either is retuned. */
      LIFT_ARC: {
        /* How much of the reach passes before the barrel moves at all. The
           first frames of `lift` are him REACHING DOWN for it; start the barrel
           at zero and it leaves the floor before he has touched it. */
        startRel: 0.3,
        /* Extra height at the middle of the path, in px. This is the whole
           difference between an arc and a straight line -- without it the
           barrel slides up an invisible ramp. 34 is about a third of a barrel. */
        bulgePx: 34,
        /* Upright to flat. 90 is the drawing's own turn: the sheet's `side` row
           IS the upright row rotated a quarter turn, so the hoist ends exactly
           on the frame the carry uses and there is nothing to blend. */
        spinDeg: 90,
        /* ⚠️ THE HOIST BLINKS BETWEEN FOUR POSITIONS INSTEAD OF GLIDING.
           Asked for 2026-08-24: "when you are picking the barrel up, make 4
           frames and blink between them."

           4 IS THE LIFT ROW'S FRAME COUNT, and that is the whole point rather
           than a coincidence -- the coconut's `lift` is exactly four drawings.
           A barrel gliding continuously past an arm that moves in four steps is
           two motions at two rates; snapped to the same four, they are one. It
           is the same complaint as the throw one entry down, answered the other
           way round: there by speeding the barrel up, here by taking the
           smoothness out.

           ⚠️ IT MUST MATCH THE ROW. Re-cut the sheet with more `lift` frames
           and this has to move with it, or the barrel steps on boundaries the
           drawing does not. 0 or 1 turns it off and the arc glides as before --
           the smoothstep is still underneath, this only samples it. */
        steps: 4,
      },

      /* THE THROW. Fast and flat: 520px/s with a small upward kick, so it
         crosses about two thirds of the screen before it lands rather than
         lobbing. `throwGravity` is what brings it down; raise the lift and the
         gravity together to keep the same distance with a higher arc. */
      /* ⚠️ +20% ON 2026-08-24: 520 -> 624. "the throwing animation is
         dissincronyzed with the barrel actually moving."

         ⚠️ AND THE LIKELY CAUSE IS THAT THE BARREL GOT 43% BIGGER AN HOUR
         EARLIER. Speed reads relative to the size of the thing moving. The
         throw was tuned against a 110px barrel: in the 231ms of follow-through
         after the release, 520px/s carries it 120px, which was 1.09 of its own
         width. At 156px that same 120px is only 0.77 of a width -- the barrel
         is doing less than cross its own body while the arm completes a full
         throw, and that is what reads as lagging behind the animation.

         To restore the ORIGINAL feel against the bigger barrel the number is
         520 x 156/110 = 737. 624 is the 20% that was asked for and is the
         conservative half of the distance; if it still trails the arm, 737 is
         where the arithmetic points and there is nothing else wrong.

         ⚠️ IF SPEED ALONE DOES NOT FIX IT, look at `throwLift` next, NOT at
         `throwReleaseRel`. The release is at 0.45 of a 5-frame row = frame 2 of
         5, which is the middle of the swing and is right. But the barrel leaves
         travelling UP at 120px/s and does not reach its apex for another 133ms
         -- so for the first half of the follow-through it is rising while the
         arm is coming down, which is its own kind of disagreement. */
      throwSpeed: 624,
      throwLift: 120,
      throwGravity: 900,
      /* What it does to whoever it hits. It is the hardest single blow in the
         game -- a full player combo is 36 across five hits -- and it knocks
         down, which is the point of it: a thrown barrel is how you answer being
         surrounded. */
      throwDamage: 22,
      throwKnockback: 260,
      throwLiftHit: 90,
      throwKnockdown: true,
      /* ⚠️ HOW HIGH OFF THE FLOOR IT CAN STILL HIT. Without this a barrel
         sailing over an enemy's head knocks him down from above it. 130 is a
         little under a body height, so it connects while it is at chest level
         and stops mattering once it is genuinely overhead. */
      throwReachY: 130,
      /* false = it breaks on the first enemy it touches. true = it carries on
         through the crowd, which is a different (and much stronger) move than
         the one that was asked for. */
      throwPierce: false,
      spinMs: 90,        // per frame of the tumble while in flight
      smashMs: 480,      // the three break frames, then it is gone
      /* HOW OFTEN A BARREL HAS A CHICKEN IN IT. ⚠️ Rolled when the barrel is
         BUILT, not when it breaks -- see prop.js.

         ⚠️ 0.35, DOWN FROM 0.5, AND IT IS HALF OF A THINNING PASS. The first
         build had too much food lying about, and the placed drumsticks are only
         part of where it comes from: every barrel is a potential chicken on the
         floor as well. Cutting the placed food alone would have missed most of
         it. At 0.35 against the eight barrels in the level that is under three
         chickens a run, on top of two placed drumsticks and the boss room's
         chicken -- against about ten items before.

         ⚠️ AND SINCE 2026-08-24 IT IS ONLY REACHED BY PUNCHING ONE APART. A
         THROWN barrel gives up whatever was in it (`Prop.smash` clears `drops`
         when the break is `sideways`), so this is now the chance per barrel
         the player chooses to BREAK rather than per barrel in the level. The
         real number of chickens a run therefore depends on how the player
         plays, and the ceiling above is a ceiling rather than an estimate.

         ⚠️ WHICH MEANS THIS MAY WANT TO GO BACK UP. 0.35 was tuned when every
         barrel was a potential chicken however it broke; if food now feels
         scarce, this is the knob and not the placed drumsticks. */
      dropChance: 0.35,
      /* ⚠️ AND THEN WHAT IT IS. Asked for 2026-08-24: "35% chance of something
         dropping, and then 50/50 between chicken and bomb." So `dropChance` is
         unchanged and this splits it -- a barrel is a chicken 17.5% of the
         time, a bomb 17.5%, and empty the rest.

         ⚠️ BOTH ROLLS HAPPEN AT BIRTH, NOT AT THE BREAK, which is the rule the
         chance above already followed: a barrel either has a bomb in it or does
         not, and breaking it twice cannot give two answers. See Prop's
         constructor. */
      bombChance: 0.5,
    },
    /* --- THE BOMB ----------------------------------------------------------
       WHAT COMES OUT OF THE OTHER HALF OF A BARREL, and it is a BARREL THAT
       ENDS DIFFERENTLY -- `Bomb extends Prop`, so every knob a barrel has means
       the same thing here. The art decided the rest: three frames of a fuse
       burning down, the spark walking in toward the casing.

       ⚠️ IT DOES NOT GO OFF ON LANDING ANY MORE, IT IS A WEAPON. Asked for
       2026-08-24: pick it up, throw it, and it explodes on whatever it hits --
       and on nothing at all if it hits nothing. It goes off FOUR ways and only
       the last is its own code:

         thrown into an enemy   `combat.propHits` -> smash(true)
         thrown, lands on floor `Prop.update`, jumpY <= 0 -> smash(true)
         punched where it lies  `Prop.hurt`, hp <= 0 -> smash(false)
         the FUSE runs out      8 seconds, wherever it is

       ⚠️ AND THE FUSE RUNS WHILE IT IS HELD. Picking one up starts a countdown
       you are now carrying; the throw is how you spend it. Pausing it in his
       hands would make holding a lit bomb the safest thing in the game.

       ⚠️ IT HURTS EVERYBODY IN RANGE, THE PLAYER INCLUDED -- which is what makes
       the 50/50 with the chicken a gamble, and what makes throwing it a
       decision rather than a free attack. `Props._blast` is the one place to
       change that. Bosses are NOT in the blast (they are not in `crowd`), but
       they ARE hit by the throw itself: `propHits` already concats the boss.

       ⚠️ `throwDamage` IS NOT 0 AND CANNOT BE. combat.js reads it as
       `C.throwDamage || 22`, so a deliberate zero becomes 22 -- the falsy trap
       this file documents in four other places. 8 is the thump of being hit by
       a thrown object; the blast is the rest.

       ⚠️ `smashMs` IS THE BURST'S OWN LENGTH, not a guess: `gone` arrives that
       long after the smash and the reaper removes it then, so a short value
       would delete the explosion mid-draw. Booms.spanMs for this pattern is
       0 + 3x90 + 12x70.9 = 1121ms, so 1200. ⚠️ It was 1100 for one draft, which
       is SHORTER than the burst -- the explosion would have been reaped 21ms
       before its last frame. Recompute this if `BOOM.count` or `everyMs` move. */
    bomb: {
      /* 15% down from 96 on sight, 2026-08-24. As with the barrel, the DRAWN
         size and the hit box are one number here -- `Prop` derives its box from
         `sizePx` -- so there is no second value to move with it. */
      sizePx: 82,
      hitWRel: 0.8,
      hitZ: 40,
      /* One punch, like a barrel: it is a bomb, and it goes off. */
      hp: 1,
      /* THE FUSE. 8 seconds, asked for. Long enough to be a decision and not a
         reflex, and long enough that a barrel broken across the room is still
         worth walking to. */
      fuseMs: 8000,
      /* ⚠️ AND THE SPUTTER IS A SEPARATE, MUCH FASTER CLOCK. The three drawings
         were spread across the whole 8s at first -- one every 2.7 seconds,
         reported as "extremely slow" -- on the idea that a burning fuse should
         be a readable countdown. Look at the art and it is not one: the frames
         differ by EIGHT PIXELS of fuse. That is a spark jumping, not a fuse
         burning down. So the row LOOPS at this rate and the 8 seconds are
         carried by the game rather than by the drawing.

         ⚠️ 60ms, BECAUSE THE READ IS "THE WICK IS FLASHING" and not "the bomb
         is animating". 90 was a walk-cycle rate -- the barata's roll spins at
         it -- and at that speed three near-identical drawings read as a loop
         you can follow. At 60 the eye stops tracking the individual frames and
         sees a spark FLICKERING, which is the whole job of the drawing: the
         bomb has to look live from across the room. Faster than about 40 and it
         starts to strobe rather than flicker.

         ⚠️ 75 NOW -- 60 was 25% too fast on sight. The window is narrow and
         both walls have been hit from the inside: 90 reads as an animation you
         can follow, 60 reads as busy. 75 was that, and 82 is 10% slower again on
         sight -- 12 frames a second. ⚠️ PANIC IS NOT SCALED WITH IT: the two
         rates are tuned against different jobs, one to look alive and one to
         look urgent, and the GAP between them is the signal. */
      animMs: 82,
      /* ⚠️ AND IT PANICS FOR THE LAST THREE SECONDS. Asked for 2026-08-24:
         faster from three seconds out until it goes off. A steady flicker says
         "this is a bomb"; a flicker that suddenly doubles says "this one is
         about to go off", which is the only thing a player actually needs to
         read off an eight-second fuse.

         ⚠️ A STEP, NOT A RAMP. A threshold is something you can NOTICE -- the
         moment it changes is the warning -- where a gradual acceleration is
         only visible in hindsight, by which time it has gone off. 40ms is 25 a
         second, which is the strobe wall the note above draws: right at the
         edge is where it should be for three seconds and nowhere else. */
      animPanicS: 3,
      animPanicMs: 40,
      /* ⚠️ AND THE BOMB GOES RED WITH IT, for the same three seconds.

         ⚠️ IT WAS A GLOW AROUND THE BOMB FIRST, AND THAT WAS HORRIBLE. The halo
         was reached for because it is cheap and because `sheets.draw`'s `flash`
         pass cannot do colour -- it is `lighter` with the sprite as its own
         source, and adding a black bomb to itself adds nothing. Cheap was not
         the requirement: "the bomb itself should be painted red, not around
         it". So the sprite is now REPAINTED, as a third pass through the same
         blit that drew it -- see the `tint` block in Sheets.draw.

         ⚠️ THE MASKED-FILL VERSION IN BETWEEN WAS WORSE THAN WRONG, IT WAS
         RIGHT-LOOKING. It built the silhouette on an offscreen canvas with
         `source-in` and blitted it back, which meant re-deriving Sheets.draw's
         transform -- anchor, depth scale, flip, rotation, pivot -- by hand at
         the call site. Every headless check of it passed. It could not survive
         the bomb being thrown, because a thrown bomb rotates and the copy did
         not. Drawing through the same closure is both simpler and unable to
         drift.

         ⚠️ AND THE FILTER HAS TO OPEN WITH brightness(0). The bomb art measures
         median luma 0 -- it is black -- and hue-rotate/saturate are no-ops on
         black, so a "tint" built the obvious way comes out invisible. Crushing
         to black and rebuilding the colour out of invert+sepia+saturate lands
         on rgb(255,42,27), which is the red that was asked for, and works the
         same on any sprite rather than only on pale ones.

         ⚠️ "TOGETHER WITH THE NEW SPRITE FREQUENCY" IS MET BY DERIVATION, not
         by matching two numbers. The red is lit for one frame in three, so it
         pulses at exactly a third of whatever rate the fuse is flickering at --
         8.6 a second while panicking -- and it follows `animPanicMs` if that
         ever moves. Given a timer of its own the two would drift in and out of
         phase and read as two effects rather than one alarm.

         Clearing `panicTint` turns it off. */
      panicTintAlpha: 0.85,
      panicTint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +
                 'hue-rotate(-8deg) brightness(110%)',
      /* Reach and carry, the barrel's numbers scaled to a smaller object. */
      liftRangeX: 88,
      liftRangeZ: 46,
      dropAheadPx: 60,
      carryYRel: 0.627,
      spinMs: 90,
      smashMs: 1200,
      /* THE THROW. Faster and flatter than a barrel -- it is a fraction of the
         weight and it is meant to be lobbed at somebody. */
      throwSpeed: 700,
      throwLift: 150,
      throwGravity: 900,
      throwDamage: 8,
      throwKnockback: 240,
      throwLiftHit: 80,
      throwKnockdown: true,
      throwReachY: 130,
      LIFT_ARC: { startRel: 0.3, bulgePx: 26, spinDeg: 0, steps: 4 },
      /* THE BLAST, once it goes off. */
      blastR: 150,          // px on the floor plane, with depth weighted x2
      damage: 18,
      knockback: 380,
      lift: 150,
      knockdown: true,
      /* The burst, in the shape Booms already takes -- the same class the Mosca
         dies in, so a bomb and a boss explode with one piece of code. */
      BOOM: { on: true, count: 4, everyMs: 90, startMs: 0,
              spreadXRel: 0.5, spreadYRel: 0.5, sizePx: 170, sizeJitter: 0.25 },
    },

    food: {
      /* WHAT EATING IS WORTH, as a fraction of the visible bar. A half and a
         third, as asked for: 55 and 37 HP against `playerHealth` 110.

         ⚠️ CAPPED, NOT BANKED, decided 2026-08-22. The heal fills the bar and
         anything past it is LOST -- it does not roll over into restoring a life.
         Both readings were put and this is the one chosen, so a chicken eaten
         at 100/110 is worth ten points and not a spare life. Pickup.update()
         is the one place that clamps.

         ⚠️ WHICH MEANS ONE TAKEN AT A FULL BAR IS WORTH NOTHING, AND IT IS
         STILL TAKEN. That combination is deliberate as of 2026-08-24: the old
         rule refused food at full health so it could not be wasted, and that
         made sense while food was eaten by WALKING OVER IT -- the player had no
         say, so losing one was an accident. On a button it is a choice, and a
         punch coming out of a press made to pick something up is worse than a
         wasted drumstick. */
      chickenRel: 0.5,
      coxinhaRel: 1 / 3,
      /* Reach -- how close he has to be STANDING for the punch button to stoop
         for it instead of throwing a punch.

         ⚠️ IT USED TO BE HOW CLOSE HE HAD TO WALK TO EAT IT AUTOMATICALLY.
         Changed 2026-08-24 by request: food is taken deliberately now, with the
         crouch, and walking over a drumstick does nothing. The numbers did not
         move -- what they measure did, from "close enough to be swept up" to
         "close enough to reach down for", which is the same distance.

         ⚠️ AND IT IS THE PUNCH BUTTON, NOT THE PICKUP ONE. The old note here
         argued food must not share the pickup button, because the player who
         wanted the barrel would get the chicken lying next to it. That is still
         true and is why it went on the other button: punch already chooses its
         verb by what is in his hands (it throws when he is carrying), so a
         third case costs nothing new to explain. ⚠️ The price is that a player
         STANDING ON FOOD CANNOT PUNCH -- accepted, because food is placed
         between fights rather than inside them. Put food in an arena and this
         is what will go wrong. */
      rangeX: 52,
      rangeZ: 40,
      /* And not from the air. `pickup()` refuses in mid-air anyway, so this is
         the second of two guards -- but it is the one that keeps the food from
         being OFFERED to a jumping player, which is what would otherwise eat
         the press and cancel his air attack. */
      rangeY: 60,
      /* ⚠️ 0 -- FOOD SITS STILL. It bobbed gently at first, on the usual
         argument that a floating pickup reads as something to take rather than
         as scenery; seen in the level it read as the drumstick being unable to
         decide whether it was on the floor. Turned off on request the same day.
         The machinery stays (`bobPx` is the whole of it) and it was always
         drawn-only -- `z` never moved, so what could be reached never breathed
         in and out with the picture. */
      bobPx: 0,
      bobRate: 3.2,
    },
  },


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
  /* LIVES, THE GENRE'S WAY: dying does not end the run while you have one
     spare. The HUD has always shown "LEBRON x2" beside the bar -- it reads
     `lives - 1`, the number of tries you have LEFT AFTER this one -- and until
     2026-08-21 nothing ever decremented it, so the count was decoration and a
     single death was game over.

     3 = three attempts. The game over panel is the third death, not the first. */
  playerLives: 3,
  /* Invulnerability on respawn, in ms. It is spent as `hurtT`, so the existing
     hurt BLINK comes with it for free and the player can see they are safe --
     the same treatment a hit gives, used for the opposite reason.

     ⚠️ IT IS NOT OPTIONAL. He comes back exactly where he fell, and in this
     genre that is usually underneath whoever killed him: without a moment of
     safety the respawn is a free hit, then another, and the remaining lives
     evaporate without the player touching anything. */
  respawnInvulnMs: 1500,
  /* THE BARATAS ARE THE POST-MOSCA CAST and are meant to be a step up: the
     tan one is quicker than anything before it, the red one tougher than
     anything before it. Both untested numbers -- see the note on their
     string. */
  /* ⚠️ ESPETO IS 60, BETWEEN THE TWO ROACHES, AND IT IS A GUESS. He is the
     DESERT's enemy and the desert comes after the whole street, so the floor is
     the toughest thing the player has already beaten (ZIDANE, 66) rather than
     the weakest. He is under it on purpose: a new room's first villain should
     not also be the hardest body in the game before anyone has watched him
     fight. Move this first if he reads wrong -- it is the number the whole
     encounter turns on. */
  /* ⚠️ CHARUTOBI IS 30, THE LOWEST IN THE GAME, AND THAT IS THE FIGHT HE MAKES.
     He is answered by killing him BEFORE he arrives, so his health is the length
     of the window the player gets to do it in -- and a bomb that soaks damage
     like a cigarette turns "read the run and hit it" into "there was nothing you
     could do". Killing him still detonates him where he stands (the blast comes
     out of the death row, see DEATH_BLAST), so this buys distance, not safety.
     ⚠️ IT IS THE NUMBER TO MOVE FIRST IF THE RUN READS UNFAIR -- before the
     speed, which is what makes the move read as a run at all. */
  enemyHealth: { cigarro2: 40, cigarro: 34, cigarro3: 55, barata: 50, barata2: 66,
                 espeto: 60, charutobi: 30 },

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
     exactly where it was tuned (34 / TOM 40 / ERKPA 55; the 34 was JUIXY's and
     is now the cigarette's, who took his waves) — this was a
     sprite replacement, not a rebalance, and a combo that suddenly hit 40
     would have quietly made TOM a one-combo enemy. Retune here, on purpose,
     rather than inheriting it by accident.

     Hit 3 is the LEANING PUNCH and hit 5 the UPPERCUT — the two frames the
     artist drew bigger than the rest, so they carry more damage and more
     reach. The three plain punches share one drawing and read as the fast
     part of the string. */
  COMBO: [
    { pose: 'combo1', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 5, reachX:  96 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  60, lift: 0 },
    { pose: 'combo2', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 6, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    // The leaning punch: the body commits forward, so it reaches further.
    { pose: 'combo3', startupMs: 70, activeMs: 80, recoverMs: 100, cancelMs: 250,
      damage: 8, reachX: 110 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 140, lift: 0 },
    { pose: 'combo4', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 240,
      damage: 5, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    /* The uppercut KNOCKS DOWN, and that is what the combo is for: the first
       four hits are worth 19 damage between them, this one is worth 9 on its
       own AND takes the enemy off its feet, which buys the player the room to
       turn round and deal with whoever else has walked up behind them.

       It LAUNCHES — `lift` throws the target off the floor — because the frame
       is an uppercut and a knockdown that slid along the ground would fight
       the drawing. Row 6's low lunging punch is the alternative ending and is
       cut but unwired; see POSE_RAGGED. */
    { pose: 'combo5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,
      damage: 12, reachX: 118 * BODY_SCALE, reachZ: 52 * BODY_SCALE, knockback: 320,
      lift: 190 * BODY_SCALE, knockdown: true, lungePx: 30 * BODY_SCALE,
      sweep: true },
  ],

  /* =========================================================================
     THE PLAYER'S AIR ATTACK
     =========================================================================
     PUNCHING WHILE JUMPING IS ITS OWN MOVE NOW, asked for 2026-08-24: it should
     launch everyone the way the finisher does. Until then a jump-punch simply
     played the next link of the ground combo in mid-air -- one target, no
     knockdown, and drawn with a standing punch.

     ⚠️ IT WIRES ART THAT HAS BEEN CUT AND UNUSED SINCE 2026-08-17. The
     coconut's row 4 is a SEVEN-FRAME air punch drawn as a whole jump --
     take-off, rise, the punch, the fall -- and `POSE_RAGGED.airPunch` has
     mapped it all along with nothing selecting it. fighter.js already knew what
     to do with it: `frameStep` marries an `airPunch` pose to `jumpT` rather
     than to the attack phases, so the drawing follows the ARC and the punch is
     never shown at a height it was not drawn for. Nothing in the animation
     machine had to change.

     ⚠️ `reachY` IS THE WHOLE REASON THIS CONNECTS AT ALL, and it is not a
     generosity. `verticalReach` is 70 and the jump apex is 118 * BODY_SCALE =
     85, so a fighter at the top of his own arc CANNOT REACH THE FLOOR. That is
     deliberate for the enemy jump-in, which is a scripted leap and opens its
     window as it drops back through the band (see THE JUMP-IN below). The
     player presses at a moment of their own choosing, so the same rule would
     make the move pass cleanly through a standing enemy about half the time --
     which reads as broken hit detection, not as a miss. 120 clears the apex
     with margin.

     ⚠️ AND IT MEANS A LAUNCHED ENEMY CAN BE CAUGHT AGAIN. At the apex, 120
     reaches a body up to 205 off the floor, which is above the 137 this move
     launches to. Juggling is a genre staple and it is not free here -- it costs
     a landing and a fresh jump, some 800ms, so it is not an infinite. If it
     turns out to be one, lower this rather than removing the launch.

     ⚠️ IT SWEEPS AND IT KNOCKS DOWN, which is the request: everyone in the box
     goes up. That makes it the finisher's crowd-clear available from one press
     instead of five -- so the DAMAGE is deliberately low (8 against the
     finisher's 12). It is a POSITIONING move, not a damage race: it buys the
     room, it does not win the fight. If it starts being the only thing worth
     doing, this number is the reason and it should come down before the launch
     does.

     THE COST IS THE COMMITMENT. A jump is 620ms with no steering but the
     direction latched at take-off, the string is broken by it (`attack()`
     clears the combo window), and 190ms of the recovery lands after he does.

     ⚠️ ITS TIMINGS ARE THE HITBOX, NOT THE DRAWING. The drawing is on `jumpT`
     as described above; these three numbers only say when the box is live.
     `activeMs` is long because the player may press at any point in the arc and
     a window that closed early would eat the press. */
  AIR_ATTACK: {
    pose: 'airPunch', startupMs: 80, activeMs: 420, recoverMs: 190, cancelMs: 0,
    damage: 8, reachX: 100 * BODY_SCALE, reachZ: 56 * BODY_SCALE, reachY: 120,
    knockback: 300, lift: 190 * BODY_SCALE, knockdown: true, sweep: true,
  },

  /* --- THE FINISHER SWEEPS THE BOX ----------------------------------------
     `sweep: true` on an attack def makes it hit EVERY valid target in its
     hitbox instead of only the nearest. Asked for 2026-08-24; only the two
     finishers have it.

     WHY ONLY THE FINISHER. Every other link hits one person, which is the
     genre's default and what stops mashing from clearing a room. The ending is
     the move that buys space back when three of them have walked up -- it
     already knocks down and launches for exactly that reason, and hitting one
     of the three was the half of it that never worked.

     ⚠️ EACH BODY TAKES THE FULL DAMAGE, not a share of it. Splitting would make
     the finisher WORSE the better it connected, which is backwards. So a
     finisher into a crowd of three is 36 damage dealt rather than 12, and THE
     HP TABLE HAS NOT BEEN MOVED FOR IT -- the fight gets easier when the player
     is surrounded, which is the point, but it is a real change to the economy
     and it is the first thing to look at if crowds stop being frightening.

     ⚠️ IT IS STILL ONE SWEEP PER SWING. `hasHit` closes the box afterwards
     exactly as it does after a single connect; without that the finisher would
     re-hit everyone every frame for the whole 100ms window. See
     Combat.playerHits().

     ⚠️ ACCURACY COUNTS SWINGS, NOT BODIES. `Stats.hit()` takes the attack
     object and dedupes on it, or one punch that caught three would score 300%.

     ⚠️ AND A SWEEP TAKES BARRELS AND ENEMIES TOGETHER, where a normal punch
     spends itself on whichever was in the way. That follows from the move, not
     from a rule about barrels.                                               */

  /* --- THE STEP INTO THE FINISHER -----------------------------------------
     `lungePx` on an attack def moves the body FORWARD across the blow. Asked
     for 2026-08-24: "as if he was actually physically punching". Only the two
     finishers carry it -- a five-hit string where every link stepped would walk
     the player across the room and turn a combo into a charge.

     THE TWO ENDINGS STEP DIFFERENTLY BECAUSE THEY ARE DIFFERENT PUNCHES. The
     uppercut plants and rises, so it gets 30 (22px drawn); the low ending is
     literally a lunging punch, so it gets 50 (36px). Same rule as everything
     else about that pair: the drawing decides.

     ⚠️ RAISED FROM 18/30 ON SIGHT, 2026-08-24 -- "give me a bit more lunge,
     make him move more". Over the 220ms the step spans, 50 averages 164 px/s
     and peaks near 490 as the ease-out opens, against a walk of 300: the low
     ending briefly outruns a run, which is what a lunge is. That peak is the
     number to watch if it is pushed further -- past roughly double this the
     step stops reading as weight and starts reading as a dash.

     ⚠️ IT IS ON THE DEF, NOT ON THE PLAYER, so an enemy string can have it by
     adding the field. Nothing in ENEMY_COMBOS does yet, and that is a choice
     rather than an oversight -- an enemy that steps in reaches further than the
     player has learned it reaches.

     ⚠️ IT ADDS A LITTLE REACH TO THE FINISHER, ON PURPOSE, AND IT IS NOT FREE.
     `hitbox()` is rebuilt from the body's x every frame, so ground covered
     while the active window is open is ground the punch can now connect from.
     fighter.js starts the step on the STRIKE frame precisely so the first
     active frame tests from exactly where it always did -- the gain is at the
     end of the window, not at the start, which is what stepping into a punch
     is. If it ever needs to be exactly neutral, take `lungePx` off the pose's
     `reachX` rather than removing the step. THE HP TABLE HAS NOT BEEN MOVED
     FOR THIS; if the fight starts feeling easier, that is the knob that did it.

     TIMING IS NOT CONFIGURED HERE. The step runs from `startupMs` for
     `activeMs + recoverMs / 2`, eased out -- it lands with the fist and settles
     through the first half of the follow-through. Retune a pose's timings and
     the step follows; see Fighter._updateLunge().                            */

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
     every other chain. What differs is the reach -- slightly further, for the
     lunge -- and the knockback, 420 against the uppercut's 320.

     ⚠️ `lift: 150` IS THE CODE'S NUMBER, NOT THE DESIGN'S, AND IT IS WRITTEN
     HERE SO THE FILE STOPS LYING. This was `lift: 0` with a note saying the
     fist drives forward and DOWN, so the low ending shoved the target along the
     belt where the uppercut launched it. It never did that. `fighter.js` reads
     the value as `lift || 150` -- and 0 is falsy in JavaScript, so a
     deliberate zero is indistinguishable from an unset field and becomes the
     150 default. There is a SECOND copy of the same trap in `_updateDown`
     (`this.launch || 150`), so correcting one line would not have changed
     anything either.

     The result is that the low punch has always launched HIGHER than the
     uppercut (150 against 136.8), which is the opposite of what was intended
     and is what the game has been played and tuned with for weeks. So the value
     now records what happens. ⚠️ THE DESIGN IS STILL WORTH HAVING: two endings
     that differ in SHAPE rather than only in reach is a better move than two
     that both pop. Restoring it means fixing both `||` reads AND looking at
     what `downLandMs` (520ms of falling animation) does over a knockdown with
     no arc in it -- see the bug list in STATE.md. It was raised on 2026-08-22
     and deliberately left for later.

     ⚠️ AND IT IS A FLAT 150, NOT `* BODY_SCALE`, unlike every other body
     measurement in this file -- because the number it is recording is a
     hardcoded fallback in fighter.js, which does not scale either. If the cast
     is ever rescaled, this and the two `|| 150` fallbacks are what will not
     follow it. */
  COMBO_ALT_FINISH: {
    pose: 'comboLow5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,
    damage: 12, reachX: 124 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 420,
    lift: 150, knockdown: true, lungePx: 50 * BODY_SCALE, sweep: true,
  },

  /* HITSTOP — both fighters freeze for a moment on a connect. It is the single
     cheapest piece of juice in the genre and the one most responsible for a
     punch feeling like it weighed something: the picture holding still for two
     frames reads as impact far more strongly than any amount of particle.
     Scaled by the blow, so the finisher hits visibly harder than the jab. */
  /* ⚠️ THE PLAYER'S COMBO WAS RAISED 2026-08-22, BY REQUEST, FOR THE FIRST ITCH
     BUILD: 4+5+6+4+9 = 28 became 5+6+8+5+12 = 36. That is +28.6%, not exactly
     the 30% asked for -- these are integers and 28 x 1.3 is 36.4, so 36 is the
     closest whole-number string. The alternate finisher moved with it (9 -> 12)
     or the two endings would have stopped costing the same.

     IT IS A FIRST GUESS AND IT IS UNPLAYED. The fight economy had never been
     seen at real damage at all before this build -- dev mode had been on since
     the game was started -- so this is a rebalance on top of an untested
     baseline. Every enemy's time-to-kill divides by 1.29; nothing else moved.
     Judge it in play and expect to move the HP table rather than this. */
  hitstopMs: { jab: 55, straight: 70, finisher: 130 },
  /* NO SCREEN SHAKE. There was a shakeAmp/shakeMs/shakeFreq block here and it
     was REMOVED BY REQUEST — the effect is not wanted in this game. Hitstop
     carries the weight of a blow on its own. Noted rather than left as zeroed
     knobs so it does not read as an unfinished feature and get "fixed". */

  /* --- The impact burst ----------------------------------------------------
     effects-porrada-01.png, cut by tools/build-beat-fx-defs.py into SIX
     four-frame animations: three hand-drawn stars, each in yellow and in red,
     each one going solid -> outline -> broken -> dots while it expands about
     40%. It replaced a four-spoke starburst drawn in code, which was honest
     placeholder and said so in its own comment.

     ONE IS PICKED AT RANDOM PER BLOW, which is the point of having six -- a
     five-punch combo must not stamp the identical mark five times. The pick is
     made once, in Combat._impact, and remembered on the event; rolling it
     inside the draw would strobe through all six in a fifth of a second.

     THE COLOUR IS PART OF THAT DRAW by default: all six are in the hat whoever
     is being hit. `colorByRole` makes it mean something instead -- yellow when
     the player lands one, red when the player takes one -- which is the
     readability convention most of the genre uses. It is one line either way
     and it is a taste call, so both are here rather than one being baked in.

     THE SIZES ARE `* BODY_SCALE` FOR THE SAME REASON THE FIGHTERS ARE. A burst
     is measured against the character it is stamped on, so shrinking the cast
     has to shrink the mark with it or the next rescale leaves punches throwing
     stars bigger than the people throwing them. */
  HIT_FX: {
    on: true,
    /* Requested size of the FIRST frame, as a geometric mean of its box -- NOT
       a height. The three stars are drawn at three different aspects and
       normalising on height alone makes the squat one arrive visibly wider than
       the tall one, so which variant the dice picked would change how big the
       hit looked. The later frames are drawn at the same scale and come out
       bigger on their own; that growth IS the animation. Peak is about 1.4x
       these numbers. */
    sizePx: 90 * BODY_SCALE,
    bigSizePx: 132 * BODY_SCALE,   // the finisher, and every blow the boss lands
    /* Height up the victim the mark is stamped, as a fraction of
       `fighterSizePx` above the feet. 0.42 is chest height, and it is the
       number the code-drawn placeholder used -- kept so the art landed in the
       same place the shape it replaced did. */
    chestRel: 0.42,
    /* Life of the burst. The event's own lifetime, so the four frames divide it
       evenly. NOTE this clock does not advance during hitstop -- the simulation
       is frozen -- so a finisher actually shows its solid first frame for
       hitstopMs.finisher (130ms) BEFORE these 220 begin. That is deliberate and
       it is free: the held frame is the one with the most ink in it. */
    ms: 220,
    /* Fraction of the life spent fading out, at the end. Small on purpose: the
       art dissipates on its own, and an alpha ramp over the whole burst fades
       out the solid star -- the part that reads as the hit -- to pay for a
       disappearance the dots already do for free. */
    fadeTail: 0.3,
    /* Randomly mirror. The stars are hand-drawn and asymmetric enough that a
       flipped one does not read as the same drawing, so this covers twelve
       marks with six animations for the cost of a negative scale. */
    mirror: true,
    /* false = all six in the hat, whoever is being hit. true = the colour
       carries the information instead. See above.

       ⚠️ TRUE SINCE 2026-08-22, ON REQUEST: yellow is always the player landing
       one, red is always the player taking one. It was built as a taste call
       with both sides argued and this is the side that was chosen -- so the
       colour is now INFORMATION, and the six-variant random draw has become a
       three-variant draw within a colour. Do not "restore variety" by turning
       it back off; the variety is still there, it is just inside each colour.

       ⚠️ AND IT ONLY WORKS BECAUSE `_impact` IS TOLD WHICH WAY THE BLOW WENT.
       `byPlayer` is passed in rather than derived -- combat.js has no idea
       which of two fighters is the player. Any new damage path has to pass it
       correctly or its marks come out the wrong colour, which is now a lie
       rather than a coin toss. */
    colorByRole: true,
    playerColour: 'yellow',   // used only when colorByRole is on
    enemyColour: 'red',
  },
  /* The atlas and its defs, under one base name -- manifest.js appends
     `-game.png` and `-sprites.json`, the same pair every character pack is
     loaded as. Re-cut it with tools/build-beat-fx-defs.py; do not hand-edit
     the JSON. */
  FX_SHEET: 'v2:beatemup-dungeon/effects-porrada',

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

  /* ⚠️ HOW FAR THE KNOCKBACK MOVES A BODY BETWEEN JUMPS, in px. 0 is the old
     smooth glide. Asked for 2026-08-24: the same "choppy" treatment the
     barrel's hoist got, because the thing that was fluid about being hit was
     never the DRAWING -- the `hurt` row is two frames cycling at 100ms -- it
     was the shove sliding the body along underneath it.

     10 against a total travel of `knockback / knockbackDecay` means an enemy
     jab (110) arrives in 2 jumps and a string's last hit (300) in 5. Raise it
     for a harder stutter; the total distance does not change either way,
     because `_drift` BANKS the remainder rather than dropping it.

     ⚠️ IT APPLIES TO EVERY FIGHTER, NOT JUST THE PLAYER. The `hurt` state is
     shared and a choppy shove on him against a smooth one on the enemies he is
     hitting would be two visual languages in one fight. If it turns out to be
     wanted on the player alone, that is a `kind` test in `_drift` -- but ask
     first. */
  /* WHICH GRUNTS A KNOCKDOWN CAN PLAY. One is picked at random each time.
     Asked for 2026-08-24: "alternate between the current one and this one
     randomly".

     ⚠️ ONE ENTRY AGAIN, AND IT IS STILL A LIST FOR A REASON. `enemy-hit-3` was
     the second grunt for an hour and then became the HERO's voice instead, so
     this went from two back to one. Left as a pool because it has already been
     both: a second grunt is one entry here and one in SFX, with nothing in
     combat.js to touch, and the random pick degrades to "the only one" on its
     own.

     ⚠️ RANDOM, NOT ALTERNATING, once there is more than one. Strict alternation
     is perfectly predictable -- every other knockdown the same sound -- which
     is the pattern an ear finds fastest. */
  ENEMY_HIT_SFX: ['enemyHit'],

  /* --- THE PAUSE SCREEN -----------------------------------------------------
     ENTER, or START on the pad. Added 2026-08-24. `on: false` takes it away and
     the key goes back to doing nothing.

     ⚠️ IT IS ONLY REACHABLE FROM THE PLAY PHASE. Pausing a title screen, a
     walk-out or a results board is either meaningless or actively unhelpful --
     the board is already a screen you read at your own pace -- and every one of
     those reads "press anything", which Enter is.

     ⚠️ ONE WORD, AND THE CONTROL LIST WAS TAKEN BACK OUT. It was put here on
     the reasoning that a pause screen is where a player who needs the keys goes
     to look -- the same day the key list was removed from the bottom of the
     canvas for cluttering the shot. Overruled within the hour: "remove
     everything that appears after PAUSA, leave only PAUSA". The screen is the
     word and the frame behind it.

     ⚠️ SO THE GAME NOW TELLS THE PLAYER NOTHING ABOUT ITS CONTROLS, anywhere.
     That is a decision and not an oversight -- it was made twice, in two
     places, in one day. The itch page is the remaining place for them.

     LINE 0 IS DRAWN BIG by `Hud.drawCard`; anything after it would be drawn
     small and evenly spaced, which is why the list fitted here in the first
     place. */
  PAUSE: {
    on: true,
    LINES: ['PAUSA'],
    /* HOW BLACK THE WASH OVER THE FROZEN FRAME IS, 0..1. 0.72 was what
       `Hud.drawCard` was written with; 0.50 is that 30% more transparent, asked
       for 2026-08-24 -- the shot behind the word is worth seeing, which is the
       whole reason the pause draws the world rather than a black screen. */
    dimAlpha: 0.5,
  },

  /* ⚠️ THE WHITE HIT FLASH, AND IT IS THE FIGHTERS' ONLY. `false` since
     2026-08-24: mooks and the player no longer whiten when they are hit, and
     the two BOSSES still do -- their flash lives in their own classes and this
     knob cannot reach it.

     WHY THE ASYMMETRY IS THE POINT RATHER THAN AN EXCEPTION: a fighter already
     announces a hit three other ways -- the flinch pose, the knockback, and a
     grunt if it was floored. The bosses have NO hurt art at all (horse-boss.js
     says so at the top, "confirmed rather than assumed"), so the flash is the
     only thing that tells you a punch landed on one. Taking it off everybody
     else is what turns it from decoration into their tell.

     The machinery stays: `flash` is still a field, still decays, still reaches
     `sheets.draw`. This is one boolean away from coming back. */
  hitFlash: false,

  hurtStepPx: 10,
  hurtMs: 260,            // stun + i-frames. One number, so the invulnerability
                          // is always exactly as long as the flinch showing it.
  hurtBlinkMs: 60,        // flicker period while stunned
  knockbackDecay: 6,      // 1/sec — how fast a shoved fighter comes to rest

  /* --- HOW A DEATH IS THROWN ------------------------------------------------
     Both are FLOORS on the fatal blow, not replacements. A finisher that
     already lifts 137 and shoves 320 is unchanged; a jab worth 45 of knockback
     still puts a body on the floor instead of tipping it over on the spot.
     Applied in `Fighter.hurt()` on the death branch, so it is one rule for
     everyone who dies.

     `up` HAS ALWAYS BEEN HERE, as a bare 140 in fighter.js. It is a knob now
     because `back` needed one beside it and a lone magic number next to a named
     one is worse than either.

     ⚠️ AND 140 WAS TOO HIGH: "make he be launched basically his own height".
     LEBRON is drawn `fighterSizePx` (190 * BODY_SCALE = 137) times his own
     `drawScale` of 0.9, so his height on screen is 123 -- and the arc peaks at
     exactly this number, so 140 was launching him 14% over his own head. It is
     written as the same arithmetic rather than as `123` so a rescale of the
     cast carries it. ⚠️ The 0.9 is a COPY of CHARACTERS.coconut.drawScale and
     will not follow if that moves; there is no one number to point at, because
     this knob is shared by everyone who dies and they are not all his size.

     ⚠️ NO ENEMY BLOW LIFTS, so for the PLAYER this is always the launch: every
     non-zero `lift` in this file belongs to one of his own attacks, and
     `Math.max(lift, up)` only ever matters for the bodies he throws.

     `back` IS NEW, 2026-08-24: "o player tem que cair pra trás depois ao
     morrer, igual os inimigos. um pouco launched". ⚠️ THE REAL FAULT WAS NOT
     THIS NUMBER -- the player's corpse was not moving AT ALL, because the world
     stops on his death and `tickDeath` ticked only the drawing (see the note
     there). This is the second half: with the freeze fixed he is thrown by
     whatever killed him, and enemy jabs are worth 45 to 140, which at
     `knockbackDecay` 6 is 7 to 23 px of travel. That is a stumble.

     ⚠️ TUNED IN PLAY, TWICE, AND THE MIDDLE VALUE IS THE ONE. 300 was chosen
     to match what the player's finisher already gives an enemy -- correct as a
     floor, invisible as an effect at 50px. 520 (87px) was put up next and was
     right in kind but too hard: "the player is launched back with force, I like
     it -- make this hitback slightly less". 440 is 73px, a little over half a
     body width. THE ARITHMETIC IS `back / knockbackDecay` = total travel, so
     read those two together before moving either.

     ⚠️ AND IT IS CLAMPED BY `bounds`. An ARENA pens the player to one screen
     (`Stage.bounds`, `camX + gateMarginX` to `camX + GAME_W - gateMarginX`),
     and dying with your back to that wall is common -- the corpse cannot be
     thrown through it, so the launch is partly or wholly eaten. Nothing is
     wrong when that happens; it is the same wall that stops him walking there.
     If it needs to stop happening, a corpse could be exempted from the walk
     gate -- but `revive()` would then have to clamp him back inside.

     ⚠️ IT APPLIES TO ENEMY DEATHS TOO, and that is deliberate: one rule, and a
     mook finished off by a jab was the same stumble. It changes nothing about
     the deaths that already looked right, because those were already over the
     floor. If it ever needs to be the player's alone, the branch is in
     `hurt()` and `this.kind === 'coconut'` is the test -- but ask first,
     because two death rules is how a game starts feeling inconsistent. */
  DEATH_THROW: { up: 190 * BODY_SCALE * 0.9, back: 440 },
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
     3 is a beating.

     ⚠️ 3 SINCE 2026-08-24, ASKED FOR: "make maximum 3 hitting you at the same
     time". It IS a beating -- that is the point of the number and it should be
     judged as a difficulty change, not as a crowd-shape change. The HP table
     has not moved for it. ⚠️ And it lands on a player whose finisher now sweeps
     and whose air attack launches, both of which exist to answer exactly this,
     so the two changes are meant to be read together. */
  maxAttackers: 3,
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
  /* --- THE UNDERSTUDY -------------------------------------------------------
     THE NEAREST ENEMY WITHOUT A TURN WAITS CLOSER THAN THE REST. Asked for
     2026-08-24: "the 4th stays close so he can replace if anyone dies, after
     that make the others gravitate from afar."

     So the crowd is three rings rather than two: up to `maxAttackers` fighting,
     ONE holding at `enemyReadyRadius`, and everybody else out at
     `enemyCircleRadius`. Without the middle ring a freed slot was filled by
     whoever was nearest -- which was still 210px away, so every hand-over cost
     a walk and the fight breathed in and out.

     ⚠️ 180 AGAINST 210, AND IT WAS 130 FOR ONE PASS -- "the 4th guy is still too
     close, make him a couple of steps further away from the crowd". At the
     enemy walking speed of ~192px/s a step is about 40px, so 130 -> 180 is the
     couple of steps asked for. It is still inside the outer ring and still far
     outside `enemyStandoffX` (63), so he reads as WAITING rather than crowding
     -- which was the intent at 130 and simply overshot. It circles at half
     speed for the same reason: someone about to move in should look settled.

     ⚠️ WHO IT IS, IS THE CROWD'S ANSWER AND IT IS STICKY -- held until that
     enemy takes a turn, is hit, goes down or dies. It was rechosen every frame
     by distance for one pass and that PUT THE JIGGLE BACK: the flag ping-ponged
     between the two nearest candidates whenever they were about equally far,
     and since being the understudy moves your target radius by 80px, the pair
     lurched between 130 and 210 on alternate frames. Same shape as the orbit
     bug below -- a decision read from a live quantity the decision itself moves.
     See Crowd.update().

     ⚠️ AND WHICH WAY EACH ONE CIRCLES IS ALSO THE CROWD'S, dealt out
     alternating in `Crowd.add` -- see the note there for why a position-seeded
     direction clumped. It used to be recomputed per frame from the enemy's own
     depth against the player's, which oscillated on the crossing: that was the
     "jiggly at a distance" bug. */
  enemyReadyRadius: 180,
  enemyReadySpeedRel: 0.5,
  /* HOW FAST AN ENEMY SLIDES BETWEEN THE TWO RINGS, 1/sec. At 3 a promotion
     covers the 30px in about a second, which reads as stepping in.
     ⚠️ IT IS ALSO A GUARD. The radius used to be read fresh from `ready` every
     frame, so any change of the flag teleported the target 30px and the enemy
     lurched "between two loops". Eased, it cannot -- see Enemy's orbit branch. */
  enemyRingEase: 3,

  /* --- THE OUTER RING WANDERS OFF ------------------------------------------
     EVERYBODY PAST THE UNDERSTUDY GETS BORED. Asked for 2026-08-24: "the 5th
     and beyond can distract themselves from time to time, going to the other
     end of the screen and coming back to check the fight and reposition if
     needed."

     What it buys is that the back of the crowd stops being a ring of identical
     circling shapes. One peeling off across the shot and drifting back is the
     difference between a CROWD and a carousel -- the same argument the orbit
     itself was written on, one ring further out.

     ⚠️ ONLY FOR ENEMIES WITH NO TURN AND NO UNDERSTUDY FLAG. An enemy about to
     fight must not be walking away from the fight, and the understudy's whole
     job is to be near. A stroller CAN still be handed a turn mid-stroll --
     `stroll` is deliberately not in the token's skip list -- which is the
     "coming back to check the fight" half of the request, and it costs nothing
     because the token branch runs before this one.

     ⚠️ THE TARGET IS FIXED WHEN THE STROLL STARTS: the far end of the walkable
     span from where the PLAYER stood at that moment, read once and never
     re-read. Recomputing it per frame is the bug this file has now produced
     twice -- the orbit direction, then the understudy flag -- a destination
     derived from a live quantity that walking towards it changes.

     `maxMs` is the giving-up clock. Without it an enemy pinned against a wall by
     `bounds`, or one whose target is on the far side of a player who has since
     walked past it, strolls forever.

     ⚠️ IT MUST BE LONGER THAN A CROSSING OR IT IS NOT A SAFETY NET, IT IS THE
     NORMAL EXIT -- and it was 4000 for one pass, which is exactly that mistake.
     The arena is 1160px wide (GAME_W 1280 less two `gateMarginX` of 40), the
     target sits `padPx` inside the far wall, and an enemy out at the 210 ring
     is typically ~840px from it. At 192 x `speedRel` = 163px/s that is 5.1
     seconds. 6000 leaves headroom; at 4000 nobody ever arrived, they simply
     turned round three quarters of the way and it read as aimless rather than
     as going somewhere. */
  ENEMY_STROLL: {
    on: true,
    everyMinMs: 4200,      // shortest gap between one enemy's strolls
    everyMaxMs: 9000,      // longest
    padPx: 110,            // how far short of the wall it stops
    maxMs: 6000,           // give up and rejoin the ring -- see the note above
    arrivePx: 46,          // close enough to call it arrived
    speedRel: 0.85,        // a wander, not a march
  },
  enemySpeedScale: { cigarro2: 0.72, cigarro: 0.88, cigarro3: 0.58,
                     // Faster than any cigarette. It is a roach; it should
                     // skitter, and the charge only reads as a charge if the
                     // walk it interrupts was already brisk.
                     barata: 1.05, barata2: 0.9,
                     // A ball with legs, and the second-quickest thing on the
                     // belt. Under the tan roach, over every cigarette: he
                     // should close the distance rather than trudge into it,
                     // because a spiky ball that plods is a pillow.
                     espeto: 0.95,
                     /* ⚠️ THIS IS HIS WALK-IN ONLY, NOT HIS RUN. The suicide run
                        carries its own absolute speed (SUICIDE_RUSH.speed), the
                        way the barata's charge does, so this number is spent
                        entirely on the few seconds he spends entering the arena
                        from off-screen. Matched to espeto's so the two arrive
                        together when they are placed together. */
                     charutobi: 0.95 },
  /* IGNORED FOR A KIND THAT HAS A COMBO — its hits carry their own damage, in
     ENEMY_COMBOS below. The cigarette's entry is kept as the number his string
     was balanced against (JUIXY's old swing), and because dropping him out of
     these three tables would make him look like a kind that has no stats. */
  enemyDamage: { cigarro2: 7, cigarro: 5, cigarro3: 10, barata: 6, barata2: 8,
                 /* IGNORED, like every other kind with a string -- his hits
                    carry their own damage in ENEMY_COMBOS.espeto. Listed for
                    the reason the cigarette's is: it is the single number his
                    string was balanced against, and a kind missing from this
                    table reads as one nobody thought about. */
                 espeto: 7 },
  /* ⚠️ CHARUTOBI IS DELIBERATELY ABSENT FROM ALL THREE TABLES ABOVE EXCEPT
     `enemyHealth` AND `enemySpeedScale`, AND HE IS THE FIRST KIND THAT SHOULD BE.
     The others are missing from `enemyDamage` only in spirit -- their strings
     override it -- and the table keeps their entry so nobody reads a gap as an
     oversight. He has NO ATTACK AT ALL: `Enemy` still builds the shared one-swing
     combo out of these knobs for him, because it does that for every kind, but
     his branch in `_think` returns above the wind-up and the swing is never
     thrown. A number here would be a knob that looks tunable and is not.
     ⚠️ AND WRITING `charutobi: 0` WOULD BE WORSE THAN LEAVING HIM OUT: the read
     site is `CONFIG.enemyDamage[kind] || 6`, so the zero would come back as 6 --
     the knob-set-to-zero trap this file has been caught by before (see the note
     in boom.js). Everything he can do to the player is DEATH_BLAST.charutobi. */
  enemyReachX: 92 * BODY_SCALE,
  enemyReachZ: 48 * BODY_SCALE,
  enemyStartupMs: 200,
  enemyActiveMs: 90,
  enemyRecoverMs: 420,

  /* =========================================================================
     ENEMY COMBOS
     =========================================================================
     AN ENEMY WITH A COMBO IS NORMALLY A BOSS, and this file said so until the
     cigarette arrived with three punches drawn for him. What keeps him a mook
     rather than a small boss is that the STRING IS DECLARED BEFORE IT IS
     THROWN: `Enemy` rolls its length at the top of the wind-up, so a two-hit
     string and a three-hit string open identically and the player is never
     asked to react to a decision made mid-swing.

     A kind with no entry here keeps the single swing built from
     `enemyStartupMs` and friends, which is TOM and ERKPA — they have no punch
     art to chain and reading the main game's grab pack as a three-hit string
     would show immediately.

     THE DAMAGE IS SPREAD, NOT ADDED. JUIXY hit for 5 and the cigarette
     replaced him wave for wave, so his string is 3 + 3 + 5: any single hit
     costs the player less than the orange's did, and only the full string
     costs more. A player who eats all three has stood still for 900ms.

     THE LAST HIT IS THE PUNISH WINDOW. Its recovery is more than double the
     others' — that is what the player is buying by backing out of the string,
     and it is the only reason walking away from one is worth doing. Shorten it
     and the cigarette becomes a wall that is never safe to approach.

     Startup shortens as the string goes on (200 → 150 → 190) so it reads as
     momentum. It never goes below the length of a flinch: at `hurtMs` 260 a
     player hit by the first punch is still stunned when the second lands, and
     dropping startup under that would make the whole string unavoidable once
     the first one connects. */
  ENEMY_COMBOS: {
    cigarro: [
      { pose: 'combo1', startupMs: 200, activeMs: 90, recoverMs: 200,
        cancelMs: 0, damage: 3, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 110, lift: 0 },
      { pose: 'combo2', startupMs: 150, activeMs: 90, recoverMs: 200,
        cancelMs: 0, damage: 3, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 110, lift: 0 },
      /* The lunge. It reaches further because the drawing does — his body goes
         with the fist on that frame, and a hitbox that stopped where the other
         two stop would leave the punch visibly passing through the player. */
      { pose: 'combo3', startupMs: 190, activeMs: 110, recoverMs: 460,
        cancelMs: 0, damage: 5, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 210, lift: 0 },
    ],
    /* THE STUB'S STRING IS THE SAME SHAPE, PLAYED SLOWER AND HEAVIER, which is
       the whole of the difference between the two of them. He took TOM's 7
       damage and 0.72 speed, so his string is 4 + 4 + 7 against the white one's
       3 + 3 + 5 — the same ~2.2x spread over the swing each replaced — and
       every window is longer. Two enemies throwing the identical string at
       different HP would be one enemy in two colours.

       His startups are well clear of `hurtMs` 260, so there is more room to
       leave between his hits than between the other's; his last hit's recovery
       is longer again, because a slow heavy fighter that recovers quickly is
       just a fast one. */
    cigarro2: [
      { pose: 'combo1', startupMs: 260, activeMs: 100, recoverMs: 240,
        cancelMs: 0, damage: 4, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 130, lift: 0 },
      { pose: 'combo2', startupMs: 200, activeMs: 100, recoverMs: 240,
        cancelMs: 0, damage: 4, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 130, lift: 0 },
      { pose: 'combo3', startupMs: 240, activeMs: 120, recoverMs: 540,
        cancelMs: 0, damage: 7, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 260, lift: 0 },
    ],

    /* ESPETO'S IS THE ONLY FIVE-HIT STRING IN THE GAME, and the sheet is why:
     his punch row is TEN drawings, which is five wind-up/strike PAIRS where
     every cigarette has three. `combo1`..`combo5` in POSE_RAGGED already slice a
     row in pairs, so all five land on his hits without an override.

     ⚠️ FIVE HITS IS NOT FIVE TIMES THE DAMAGE. The house rule at the top of this
     block, applied again: 3+3+5+3+7 is 21 for the whole string, a shade UNDER
     DEDÉ's 22 over three hits. No single blow of his costs more than 7, and only
     eating the entire string costs more than eating DEDÉ's -- which is what
     stops a longer string from being a harder enemy by arithmetic alone. The
     LENGTH is the character, not the total.

     ⚠️ THE REACHES ARE MEASURED, NOT INHERITED, and this is the one place in the
     file where that is true. Both cigarettes carry 92/108 x BODY_SCALE from when
     they were drawn a third smaller, and both of their notes now admit the fist
     ends visibly past the box. His were read off the atlas: the yellow fist tip
     sits 105.0 drawn px right of the anchor on the common strike, 83.8 on the
     third pair and 99.5 on the fifth, which is 146/116/138 x BODY_SCALE. So the
     third hit REACHES LESS while hurting more, because that is what the drawing
     does -- he pulls in and headbutts rather than extending.

     ⚠️ AND THEY ARE x0.9 OF THOSE MEASUREMENTS, because he was shrunk 10% on
     2026-08-27 (CHARACTERS.espeto.drawScale). 146/116/138 is the art at
     `drawScale` 1.0; 131/104/124 is what ships. **Move the scale and move these
     with it** -- that is the whole discipline, and it is the one both cigarettes
     failed at over three size changes.

     ⚠️ THEY WERE ALSO RE-MEASURED AFTER THE GROUND LINE MOVED, and that is a
     second trap this note exists to flag. `bodyMinRun` in the cutter changed what counts
     as his BODY -- the solid ball rather than spike-tip to spike-tip -- which
     changed `bodyH`, which changed the pack scale, which moved every drawn
     distance on him by 24%. The first cut of these numbers was 123/97/121 and
     was correct for a sprite that no longer exists. Any change to the cutter's
     sizing invalidates them.

     ⚠️ AND THEY ARE ONLY TRUE AT `drawScale` 1.0. See CHARACTERS.espeto: grow
     the sprite and these three numbers have to grow by the same factor, or he
     inherits the exact fault the cigarettes have.

     ⚠️ THE TIMINGS ARE EXTRAPOLATED, NOT WATCHED, the same admission cigarro3's
     entry makes. He is quicker than any cigarette (0.95 against 0.88/0.72/0.58)
     so his startups sit under the first one's, and the two heavy hits -- the
     third and the fifth -- pay for themselves in recovery. Every startup stays
     clear of `hurtMs` 260, so the string is escapable by design rather than by
     luck. */
  espeto: [
    { pose: 'combo1', startupMs: 190, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    { pose: 'combo2', startupMs: 150, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    /* THE HEADBUTT. He balls up -- the drawing has no fist out at all -- so it
       is the SHORTEST reach in his string and the second-heaviest hit. */
    { pose: 'combo3', startupMs: 210, activeMs: 110, recoverMs: 420,
      cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 200, lift: 0 },
    { pose: 'combo4', startupMs: 150, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    /* The finisher, and the longest commitment any mook makes to a single blow.
       Rarely seen -- see the weights -- which is what it is for. */
    { pose: 'combo5', startupMs: 240, activeMs: 120, recoverMs: 520,
      cancelMs: 0, damage: 7, reachX: 124 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 260, lift: 0 },
  ],

  /* THE THIRD ONE IS THE SLOWEST AND THE HARDEST TO PUT DOWN, because he
       inherited ERKPA's 55 HP and 0.58 speed.

       THE DAMAGE IS SPREAD, NOT ADDED -- the rule at the top of this block,
       applied a third time. ERKPA swung once for 10, so the string is
       6 + 6 + 10: no single hit costs more than the eggplant's did, the last
       one costs exactly what it did, and only eating the whole string costs
       more. That is the same ~2.2x the other two spread over the swing each
       replaced (5 -> 11, 7 -> 15, 10 -> 22).

       ⚠️ THE TIMINGS ARE EXTRAPOLATED, NOT WATCHED. The other two were tuned
       in play; these continue their trend one step slower (startups
       200/150/190, then 260/200/240, now 300/240/280) on the reasoning that a
       fighter who walks slower should wind up slower. That reasoning has not
       been tested. The startups stay well clear of `hurtMs` 260 as both others
       do, so the string is escapable by design rather than by luck, and the
       last hit's recovery is the punish window -- longest of the three, since
       he is the one you most need a reason to walk away from. */
    /* THE ROACH JABS. Three hits like everyone else, but each is ONE drawing
       rather than a wind-up/strike pair, so the punches are shorter and come
       faster than a cigarette's -- which is the whole read on him: he is not
       stronger per hit, he is quicker to the next one. 4 + 4 + 6 = 14 against
       CIGARRO's 11 over a string that takes less time to throw.

       ⚠️ HIS STARTUPS ARE THE ONLY ONES UNDER `hurtMs` 260, AND THAT IS
       DELIBERATE BUT DANGEROUS. At 190 the second hit lands while the player is
       still stunned by the first, so his string is harder to escape once it has
       begun -- that is what makes a fast enemy frightening rather than merely
       busy. It is also the exact property the cigarettes' note warns against.
       He gets away with it because he only ever throws three and his recovery
       is long; if the fight reads as unfair rather than fast, this is the first
       number to move, not his damage. */
    /* ⚠️ REACH MUST CLEAR THE STAND-OFF **PLUS** THE PREVIOUS HIT'S KNOCKBACK,
       and this string was written twice because the first version cleared
       neither.

       An enemy swings from `enemyStandoffX` -- 63.4px -- and DOES NOT STEP IN
       between the hits of a string: the combo branch throws the next hit from
       exactly where it stood. So each hit has to reach far enough to cover the
       gap its own predecessor opened. Knockback decays exponentially at
       `knockbackDecay` 6, so a blow of k moves the player k/6 px in total.

       The first cut used 84 (= 60.5px), which is SHORTER THAN THE STAND-OFF
       ITSELF -- the roach was swinging from a spot it could not reach, and the
       second hit of a string missed most of the time. 104 (= 74.9px) clears
       63.4 + 7.5 with 4px to spare, and the mid-string knockback is down from
       100 to 45 so it stops shoving the player out of the flurry that is
       supposed to be his whole identity. The FINISHER still launches. */
    barata: [
      { pose: 'combo1', startupMs: 200, activeMs: 80, recoverMs: 170,
        cancelMs: 0, damage: 4, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo2', startupMs: 190, activeMs: 80, recoverMs: 170,
        cancelMs: 0, damage: 4, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo3', startupMs: 190, activeMs: 100, recoverMs: 430,
        cancelMs: 0, damage: 6, reachX: 114 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 200, lift: 0 },
    ],
    // The red one: the same string played heavier, the way the stub is to
    // CIGARRO. Every window longer, every hit worth more.
    barata2: [
      { pose: 'combo1', startupMs: 250, activeMs: 90, recoverMs: 220,
        cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 50, lift: 0 },
      { pose: 'combo2', startupMs: 230, activeMs: 90, recoverMs: 220,
        cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 50, lift: 0 },
      { pose: 'combo3', startupMs: 240, activeMs: 110, recoverMs: 520,
        cancelMs: 0, damage: 9, reachX: 118 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 240, lift: 0 },
    ],

    cigarro3: [
      { pose: 'combo1', startupMs: 300, activeMs: 100, recoverMs: 280,
        cancelMs: 0, damage: 6, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 140, lift: 0 },
      { pose: 'combo2', startupMs: 240, activeMs: 100, recoverMs: 280,
        cancelMs: 0, damage: 6, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 140, lift: 0 },
      { pose: 'combo3', startupMs: 280, activeMs: 120, recoverMs: 620,
        cancelMs: 0, damage: 10, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 300, lift: 0 },
    ],
  },
  /* =========================================================================
     THE JUMP-IN
     =========================================================================
     THE ENEMY LEAPS AT YOU AND PUNCHES ON THE WAY DOWN, and the "on the way
     down" is not flavour — it is the only part of the arc where the attack can
     legally connect. `verticalReach` is 70 and the jump apex is 85, so a
     fighter at the top of his own jump is OUT OF REACH OF THE FLOOR. An air
     attack timed to the apex would pass cleanly through a standing player every
     single time, and would look like a hit detection bug rather than a miss.

         jumpY = sin(PI * p) * 85        <= 70  when  p <= 0.27 or p >= 0.73
         p 0.73 of jumpMs 620            =  451ms after take-off

     So `startupMs` is 420 — the hitbox opens just before he drops back through
     the reachable band, and stays open until he lands. Retiming `jumpMs` or
     `jumpHeight` moves that band and this number has to move with it.

     THE RECOVERY IS THE WHOLE COST OF THE MOVE. 150ms of it happens after he
     has landed, so a leap that misses leaves him standing in front of the
     player unable to act. Take that away and jumping in becomes free.

     HE MUST LINE UP IN DEPTH BEFORE HE LEAVES THE GROUND (`enemyLeapMaxZ`) —
     the leap is along x only. That is the same bargain the Mosca Boss's ground
     pass makes: the answer to a committed charge is to step out of the LANE,
     not to out-run it, and a leap that tracked the player through the air would
     have no answer at all. */
  ENEMY_LEAP: {
    cigarro: {
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 150,
      cancelMs: 0, damage: 6, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 300, lift: 0,
    },
    /* THE STUB JUMPS IN TOO, and `startupMs` is the SAME 420 — it has to be.
       That number is not a feel, it is where the arc drops back inside
       `verticalReach`, and both of them jump on the same global `jumpMs` and
       `jumpHeight`. What differs is what the landing costs: 8 damage, and 260ms
       of recovery on the floor afterwards against the other's 150. */
    cigarro2: {
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 260,
      cancelMs: 0, damage: 8, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 340, lift: 0,
    },
    /* SAME 420 AGAIN, for the reason above: it is where the arc drops back
       inside `verticalReach`, not a feel, and all three jump on the same global
       `jumpMs` and `jumpHeight`. He is the heaviest, so he costs the most to
       eat and the most to miss with -- 340ms on the floor afterwards. */
    cigarro3: {
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 340,
      cancelMs: 0, damage: 10, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 380, lift: 0,
    },
  },
  /* HOW OFTEN HE JUMPS IN, PER TURN. 0.10 — roughly one turn in ten — chosen in
     play after watching it at 1, where the leap was the only thing he did.

     ⚠️ **PER TURN, NOT PER FRAME**, and the difference is not small. This is
     rolled once, on the frame the attack token is handed to him
     (`Enemy.takeTurn()`); the same number evaluated every frame would be 10%
     sixty times a second, which is not "sometimes he jumps" — it is a certainty
     inside two frames, and the ground combo would never come out again.

     THE VALUE IS A RATE OF SURPRISE, NOT A DIFFICULTY DIAL. Raise it far and
     the jump-in stops being a thing that happens to you and becomes the fight;
     the reason it works at all is that his ordinary approach is a walk. */
  enemyLeapChance: {
    cigarro:  0.10,
    // The stub jumps in HALF as often. He is the slow one; a heavy fighter who
    // closes the distance as readily as the quick one is not a second enemy,
    // and the leap is the one move that hides how slowly he walks.
    cigarro2: 0.05,
    /* The slowest of the three, and the leap is the one move that hides that --
       so he gets the stub's rate rather than a lower one. Reused rather than
       invented: 0.05 is a number that has been watched. */
    cigarro3: 0.05,
    /* THE HEDGEHOG JUMPS MOST, and it is the one thing his silhouette promises:
       he is a ball, and a ball that only ever walks is a ball nobody believes
       in. He gets the FIRST cigarette's rate rather than a new one -- 0.10 is a
       number that has been watched -- and he is quicker than that cigarette, so
       expect this to be the first thing that wants lowering if he reads as
       never being on the floor. His row 4 is a real air attack, drawn. */
    espeto:   0.10,
  },
  /* The band he will leap from. Under `enemyLeapMinX` there is nothing to leap
     over and he simply walks in; over `enemyLeapMaxX` he would be crossing most
     of the screen in the air, which no longer reads as a jump-in.

     A TURN THAT ROLLED A LEAP AND IS TOO CLOSE FOR ONE IS NOT WASTED — he falls
     through to the ordinary walk-in and ground combo, and the roll is spent.
     That is deliberate: the alternative is an enemy who backs away to make room
     for a jump, which telegraphs it completely. */
  enemyLeapMinX: 90,
  enemyLeapMaxX: 520,
  enemyLeapMaxZ: 34,      // how lined up in depth he has to be before take-off
  /* Where he AIMS TO LAND, in px from the player. Deliberately tighter than
     `enemyStandoffX` (63) and not the same knob: the punch is only live for the
     last stretch of the arc — he has to be both low enough to reach the floor
     and close enough at the same moment — so landing a little inside the walking
     stand-off is what gives that overlap any width at all. Land him further out
     and the leap becomes a move that can only connect on the landing frame. */
  enemyLeapLandX: 50,
  /* Cap on how fast the leap may carry him, as a multiple of walk speed. The
     speed is otherwise DERIVED — distance to cover divided by the time in the
     air — so he lands where the player was standing rather than at some fixed
     hop length that only occasionally reaches. */
  enemyLeapMaxSpeed: 2.6,

  /* How likely a string is to be one, two or three hits — rolled once, at the
     start of the wind-up. Weights rather than a length so the shape of the
     fight is one line to change.

     WEIGHTED TOWARD THE SHORT ONE ON PURPOSE. Three hits every time is a
     rhythm the player stops reading and starts waiting out; a single jab that
     might be the start of a string is what makes them respect the wind-up. */
  /* =========================================================================
     LEVEL 3 — THE BOOKCASE
     =========================================================================
     The one room in this game that runs its own logic, and it is deliberately
     quarantined. Asked for 2026-08-27: *"please isolate this behavior to this
     level, otherwise you will break other levels... Trying to make this logic
     work alongside the other logic (the default one) will be our demise."*

     ⚠️ EVERYTHING HERE IS READ BY src/level3.js AND BY NOTHING ELSE. There are
     six hooks into shared code and every one is a single guarded early return;
     turn `on: false` and the room falls back to being an ordinary (and broken)
     scroll room, which is the switch to reach for if this is ever suspected of
     something.

     WHY IT NEEDS ITS OWN LOGIC. The shot climbs a bookcase in a switchback —
     pan right along a shelf, rise, pan LEFT along the next, rise, pan right
     along the last. The engine winds the plate with one ratio,
     `filmTime = camX / worldPxPerSecond`, and that cannot express this shot:

       * on shelf 2 the player walks LEFT, so camX falls — which under that
         ratio means REWIND, i.e. back down the lift onto shelf 1; and
       * it is not a sign flip, because a switchback visits the SAME camX three
         times at three different heights, so no function of camX alone can say
         which frame to show.

     So the two ideas come apart: PROGRESS (monotonic, in film seconds, drives
     the plate) and CAMERA X (right, then left, then right).

     ⚠️ THE LEGS ARE MEASURED, NOT DESIGNED. tools/build-level-3-plate.py
     phase-correlates the footage on BOTH axes — the other plate tools only ever
     needed x — and prints exactly this table. Re-cut the clip and every number
     moves; run it with `--measure` and paste the result.

         leg  film (s)        screen px   what
         0    0.00 - 18.98      +3647     shelf 1, pans right
         1   18.98 - 32.65      -4868     the first rise
         2   32.68 - 46.96      -5515     shelf 2, pans LEFT
         3   46.99 - 55.20      -2329     the second rise
         4   55.23 - 73.97      +3390     shelf 3, pans right

     ⚠️ `px` IS CAMERA TRAVEL, AND IT IS THE SYNC. A walk leg's camera runs
     exactly `px` — the leg's own pan converted to the 1280-wide canvas — so the
     background moves 1:1 with the world, which is all `worldPxPerSecond` ever
     bought the other rooms. Using the tool's SOURCE-pixel column instead would
     run the shot about 1.5x fast and read as the player sliding.

     ⚠️ AND THE THREE SHELVES PAN AT DIFFERENT SPEEDS — 192, 386 and 181 screen
     px per second of film. That is why one ratio could never have covered this
     room even if it went one way: shelf 2 pans twice as fast as the other two,
     so the player has to cross twice as much ground for the same seconds of
     film. Per-leg `px` handles it without anyone having to notice. */
  /* =========================================================================
     HORACIO — the desert's boss
     =========================================================================
     The last thing in stage 2, after the three-enemy wave that used to stand in
     for him. Asked for 2026-09-02 in nine beats; beats 1 and 2 are built, 3-9
     are not yet. src/horacio-boss.js carries the list and its own reasons.

     ⚠️ HE IS NOT IN `CONFIG.CHARACTERS` AND MUST NOT BE PUT THERE. His pack is
     LEVEL x STATE x FACING with no `anims` row, so `sheets.build()` cannot
     measure a scale off it and everything that walks the cast would trip on
     him. He is listed by hand in manifest.js, exactly like the ground cover.

     ⚠️ AND THE PACK HAS NO ANIMATION FRAMES AT ALL -- no idle, no walk, no
     boil. Every level/state/facing is ONE drawing. Anything that needs to look
     alive here has to come from moving him, turning him, or changing his state.
     ⚠️ DO NOT ALTERNATE armoured/exposed AS AN IDLE: those are a well body and
     a hurt one and it would read as him flickering between the two.

     ⚠️ `who: 'horacio'` IS LOAD-BEARING ON THE SEGMENT. A boss segment with no
     `who` is the MOSCA -- a default that predates the horse -- and she already
     dies in the street. See the ROOMS note where the segment is written.

     HIS NAMEPLATE COSTS NOTHING: HORACIO was cut into the hand-drawn letter
     pack on 2026-09-01 and wired to nothing, and `Letters.nameKey` derives the
     frame from whatever name a fighter declares. That cut is why this line is
     all it takes. */
  HORACIO_BOSS: {
    name: 'HORÁCIO',
    sheet: 'v2:beatemup-dungeon/horacio',
    /* ⚠️ DOUBLED 2026-09-02 ON REQUEST, 230 -> 460 at level 1, reaching 583 as
       the grandao -- so he is now considerably BIGGER than HIPOLITO (319), the
       final boss, which is a deliberate instruction and not a drift.

       120 against HIPOLITO's 150. He is a stage 2 boss and the fight is long by
       construction -- it has a scripted opening before a punch is thrown -- so
       the health has to buy phases rather than a slugging match. ⚠️ JUDGE THIS
       WITH DEV OFF: at `DEV.punchDamage` 50 he dies in three hits. */
    health: 120,
    /* THE BODY HE ARRIVES IN: level 1, the small spikes, as specified. */
    enterLevel: 1,
    /* HOW TALL HE DRAWS AT EACH LEVEL, straight out of the cutter's printout.
       ⚠️ THE HURTBOX READS THIS, so it grows with him -- a fixed box would let
       punches pass through the grandao or connect with air around the joaninha.
       Re-run tools/build-beat-horacio-defs.py with a different TARGET_H and
       these four move with it. */
    sheetLevels: 4,       // one atlas per level -- see manifest.js
    /* ⚠️ THESE FOUR ARE THE CUTTER'S PRINTOUT AND MOVE WITH ITS `TARGET_H`,
       which has now changed twice on request: 230 -> 460 -> 322. The hurtbox
       reads them, so they cannot be left behind when the art is re-cut. */
    sizeByLevel: [324, 354, 404, 449],
    sizePx: 354,          // the fallback, and the level he enters at
    /* NO GROUND SHADOW, on request -- see the note in horacio-boss.js for why
       it is worse than useless on a boss that lives inside the floor. */
    shadow: false,
    /* ⚠️ HIS HITS BURST YELLOW, overriding the game-wide rule that yellow means
       "you landed one" and red means "you took one". Asked for 2026-09-02, and
       it is read by combat._impact off the ATTACKER, so it is his property
       rather than a branch in the impact code. */
    fxColour: 'yellow',
    hitWRel: 0.62,        // he is round, not long like the horse (0.86)
    hitZ: 52,
    /* WHERE HIS HOLE OPENS, down the belt. Not mid-belt like the other two
       bosses: he ARRIVES by digging up, so this is the hole's position and one
       at 0.5 with the player at the near edge would open behind him. */
    spawnZRel: 0.62,
    dieMs: 900,
    /* THE SPIKE THEATRE, beat 2, written as data so it can be judged by eye and
       retuned without touching the class: *"o spike pequeno entra, ele fica como
       joaninha por 1 segundo, daí sai o máximo 2 vezes, sai grandao, joaninha e
       sai grandao, daí no final ele volta pro nível 1."*

       Levels are 0 joaninha / 1 small / 2 medium / 3 grandao. He enters at 1, so
       the script opens by retracting to 0 and closes by returning to 1.
       ⚠️ THE LIFE BAR COMES UP WITH THIS PHASE, gated on `arrived()`. */
    THEATRE: [
      { level: 0, ms: 1000 },   // "fica como joaninha por 1 segundo"
      { level: 3, ms: 620 },    // "sai grandao"
      { level: 0, ms: 380 },    // "joaninha"
      { level: 3, ms: 620 },    // "e sai grandao"
      { level: 1, ms: 520 },    // "no final ele volta pro nível 1"
    ],
    /* HOW FAR OUT OF THE GROUND HE HAS TO BE BEFORE A PUNCH COUNTS. Under this
       he is not there to hit; the PEEK comes up to 0.55 and is therefore an
       opening, and roaming at 1.0 is not. ⚠️ RAISING THIS PAST `BALL.peekSunk`
       CLOSES THE ONLY RELIABLE WINDOW IN THE FIGHT and he becomes hittable just
       when he surfaces to attack. */
    hittableSunk: 0.6,
    /* THE BALL PHASE -- beats 3, 4, 5 and the walking half of 7. */
    BALL: {
      digMs: 480,        // going down, and balling up
      peekRiseMs: 260,   // the head coming out
      peekSunk: 0.55,    // how much of him shows while he looks about
      peekMs: 1250,      // ⚠️ the fight's one reliable opening -- see hittableSunk
      lookMs: 380,       // how long he holds each side while "olhando pros lados"
      /* ⚠️ ALL THREE SPEEDS IN THIS BLOCK AND `CHARGE.speed` WERE CUT 10% ON
         REQUEST 2026-09-02 ("make him move 10% slower"): 430 -> 387,
         88 -> 79, and the charge 620 -> 558. They move together because the ask
         was about HIM, not about one attack -- slowing only the charge would
         have made the hunt and the stroll relatively faster. */
      roamSpeed: 387,    // px/s underground -- he crosses ground fast, unseen
      roamMaxMs: 1800,   // a ceiling, so an unreachable goal cannot hang the phase
      /* ⚠️ THE LEAST HE MAY TRAVEL BEFORE SURFACING. *"ele submerge totalmente e
         sai em outro ponto"* -- without a floor on the distance the goal can be
         drawn next to where he already is, the roam finishes on its first frame
         and he pops up in the spot he just left. Set this to 0 and that comes
         straight back. */
      roamMinPx: 280,
      /* HOW BURIED HE IS WHILE HUNTING. ⚠️ NOT 1: the tip of one spike travels
         through the cigarettes, which is the only cue to where he is and was
         asked for explicitly. ⚠️ AND IT MUST STAY ABOVE `hittableSunk` (0.6) or
         roaming stops being cover and becomes a free window on him. */
      roamSunk: 0.86,
      /* THE FLOAT, *"as like he was floating in water"*. ⚠️ APPLIED TO THE
         DRAWING ONLY, never to the depth the hitbox reads -- see `_bob()`. */
      bobMs: 1500,
      bobAmp: 0.035,
      surfaceMs: 300,    // coming all the way out
      walkMs: 1700,      // beat 7: how long he strolls before digging back in
      walkSpeed: 79,
    },
    /* THE THREE CHARGE LANES, as fractions of belt depth: *"em cima, em baixo ou
       no meio"*. Back, middle, front -- and the direction is a separate coin
       flip, so the same lane runs both ways. */
    LANES: [0.18, 0.5, 0.86],
    /* THE CHARGE ITSELF. ⚠️ `def` FIELDS ARE READ BY combat.bossHits -- damage,
       knockback, lift, knockdown -- so this doubles as the attack table. It
       knocks down: a spiked ball at 620px/s that merely staggered you would let
       the player walk straight back into the next one. */
    CHARGE: {
      speed: 558,
      startPad: 220,     // how far past the screen edge he surfaces to run up
      /* ⚠️ HOW DEEP THE ROLLING BALL SITS, and it must not be 0. At 0 he rests
         exactly on the ground line and reads as FLOATING -- a sphere has no feet
         and nothing overlaps its lower edge. Sinking him puts the floor in front
         of that edge, and because `behindScenery()` is true at any depth the
         cigarette mounds paint over it as well. Raise it and he ploughs deeper;
         set it to 0 and the floating comes straight back.

         ⚠️ 0.26 -> 0.38 ON REQUEST 2026-09-02 ("sink him a little bit more...
         make the crop in his lower end slightly bigger"). THIS IS THE VISIBLE
         ROLLING BALL ONLY. The other two ball depths were deliberately left
         alone: `BALL.roamSunk` (0.86) had just been raised the other way to show
         MORE spike while he hunts, and `BALL.peekSunk` (0.55) is the window you
         are meant to punch -- and it cannot pass `hittableSunk` (0.6) without
         making him untouchable in his own opening. */
      sunk: 0.38,
      overrun: 180,      // how far past the wall he carries before digging in
      damage: 12, knockback: 260, lift: 0, knockdown: true,
    },
    /* BEAT 9: up next to the player and the spikes go in. Timed in three parts
       like every other attack in this game, so the drawing and the window that
       can actually hit cannot drift apart. */
    STAB: {
      level: 3,          // he does it as the grandao -- the spikes are the move
      standOff: 90,      // how far to the side of the player he surfaces
      riseMs: 300, activeMs: 220, recoverMs: 420,
      reachX: 96, reachZ: 62,
      damage: 14, knockback: 200, lift: 0, knockdown: false,
    },
    /* WHAT HE PICKS WHEN HE HAS FINISHED LOOKING AROUND. ⚠️ THESE MUST SUM TO
       1: the third is whatever is left over, so a pair adding to more than 1
       silently deletes the walk. */
    WEIGHTS: { charge: 0.5, stab: 0.3, walk: 0.2 },
    /* WHICH WAY EACH OF THE EIGHT DRAWINGS LOOKS, in degrees: 0 is at the
       camera, 90 is screen RIGHT, 180 is away. Read off the sheet by eye.
       ⚠️ THIS IS THE FIRST THING TO SUSPECT IF HE FACES THE WRONG WAY. The main
       game's telephone enemy shipped with exactly this table mirrored and it
       took a session to spot, because a creature facing the wrong way still
       looks like a creature. Swap the 90 and 270 halves to correct it. */
    FACING_DEG: [0, 45, 90, 135, 180, 225, 270, 315],
  },

  LEVEL3: {
    on: true,
    /* Read for `worldPxPerSecond` in the round trip that hands the backdrop a
       progress clock — see level3.js `filmScroll()` and the source's own note. */
    plateSource: 'level3Plate',
    /* HOW FAR APART THE LEGS' WORLD-X BANDS SIT. Each walk leg gets its own
       non-overlapping stretch of world x and the player is teleported between
       them mid-lift, which is invisible: the plate is drawn stationary and wound
       by progress, so nothing on screen is a function of world x. Letting shelf
       2 walk back over shelf 1's x would make world x ambiguous for anything
       placed in this room later, which is a trap to leave for someone else. */
    bandGapPx: 4000,
    /* How far inside the near wall the player is dropped when a leg starts, so
       he does not begin the shelf standing in the gate. */
    startInsetPx: 200,
    /* HOW FAR THE LIFT STANDS FROM THE SHELF'S END WALL, in screen px.
       ⚠️ THIS IS BOUNDED ABOVE BY THE CAMERA, at about 367. The film has to
       finish the shelf before the lift takes over, so the camera must already be
       pinned at the end of its range when the player reaches the landing -- and
       it pins at `focus + deadzone` (667.6) past its end walking right and
       `focus - deadzone` (407.6) walking left. Measured from the end wall, 300
       puts the lift at screen 940 rightward and 340 leftward: mirror images,
       both safely past the pin. Push it past ~367 and the leftward landing falls
       inside the pin point, `progress` is short of the leg's end when the ride
       starts, and the shot jumps ~0.7s (~270px of pan) at the hand-over.
       ⚠️ AND THIS IS WHY "the middle of the final frame" IS NOT WHAT SHIPPED:
       640 is inside the pin point in BOTH directions. With a deadzone follow the
       player is never at screen centre while the camera is still. */
    landingInsetPx: 300,
    legs: [
      { kind: 'walk', dir: +1, px: 3647, film: [0.00, 18.98] },
      /* ⚠️ `sec` IS THE FILM'S OWN DURATION AND SHOULD STAY THAT WAY. A rise is
         the shot going up; play it at anything other than 1x and it reads as
         fast-forward, which is exactly what a filmed plate cannot do
         convincingly. 13.7s is a long time to stand on a platform with nothing
         to do — the answer to that is enemies riding up with you, not a faster
         lift. */
      { kind: 'lift', sec: 13.67, film: [18.98, 32.65] },
      { kind: 'walk', dir: -1, px: 5515, film: [32.68, 46.96] },
      { kind: 'lift', sec: 8.21, film: [46.99, 55.20] },
      { kind: 'walk', dir: +1, px: 3390, film: [55.23, 73.97] },
    ],
    /* THE ELEVATOR. Three hand-drawn frames of one platform, cut by
       tools/build-beat-elevador-defs.py. It replaced a DRAWN placeholder — a
       code trapezoid with a converging grating and rails on its back corners —
       and that whole block is gone rather than kept as a fallback, colours and
       all. The illustrator drew no rails; the room does not need them.

       ⚠️ ONE KNOB, AND EVERY OTHER PROPORTION COMES OUT OF THE DRAWING.
       `widthPx` is the near lip's width on screen and nothing else is declared,
       because an illustrated slab already HAS a perspective: the cutter measures
       the convergence (0.729), the top face (0.2080 x width) and the front face
       (0.0497 x width) off the alpha and writes them into the defs. The
       placeholder needed `backRatio`/`depthRel`/`thickPx` only because a drawn
       shape has to be told what it is. Do not add them back to "correct" the
       art — see the standing rule about never reshaping a pack to fit a number.

       ⚠️ AND THIS IS WHY THE ROOM'S BELT MOVED. The top face is what the player
       stands on, so it has to BE the walkable band — every z he can reach needs
       platform under it — which makes the belt's depth and the slab's depth one
       number seen twice:

           beltDepth = widthPx x 0.2080        960 x 0.2080 = 199.7 -> 200

       The placeholder ducked this with `depthRel: 0.42` and covered 42% of the
       belt, so he walked off the back of it into mid-air and nothing said so.
       ⚠️ CHANGE `widthPx` AND THE ROOM'S `belt.depth` MOVES WITH IT, or the far
       edge of the drawing stops being the far edge of the floor. The room's belt
       carries the same warning pointing back here.

       ⚠️ THE CEILING ON `widthPx` IS THE BOTTOM OF THE CANVAS, not taste. The
       front face hangs below the near edge, so the slab needs
       `topY + beltDepth + 0.0497 x widthPx <= 720`; at topY 470 that caps it at
       about 965, and going wider means lifting `topY` as well. 960 is that cap
       with a couple of px to spare, which is the one reason it is not a rounder
       number. */
    platform: {
      sheet: 'v2:beatemup-dungeon/elevador',
      widthPx: 960,      // the NEAR LIP's width on screen; the one size knob
      offsetX: 0,
      standHalfRel: 0.35,// how much of that width he may stand on, each way
      /* THE BOIL. It runs whenever the lift is MOVING RELATIVE TO THE VIEWER —
         while the camera pans past a parked one, and through a ride — and holds
         frame 0 when the camera is still. Both halves were asked for; the ride
         is an explicit exception rather than the same rule, because a rising
         lift does not move on screen at all. See level3.js `_tickBoil`. */
      boilMs: 110,
      /* HOW STILL "STILL" IS, in px of camera movement per frame. Not zero: the
         camera is a float chasing a deadzone, so it lands a hair off its target
         and keeps twitching after the player has stopped — at exactly 0 the lift
         would shiver on a motionless screen, which is the one state this whole
         rule exists to make quiet. */
      camStillPx: 0.05,
    },
  },

  /* =========================================================================
     THE GROUND COVER
     =========================================================================
     SIX DRIFTS OF CIGARETTE BUTTS, scattered across the desert's belt so the
     floor is made of them. Asked for 2026-08-27: "spread these bad boys all over
     stage 2, in the walkable zone -- these mounds should behave as the ground,
     the player will step on top of them -- cover like 80% of the ground".

     ⚠️ "BEHAVE AS THE GROUND" IS A DRAWING RULE, NOT A PHYSICS ONE, and that is
     what makes this affordable. They are painted BEHIND every fighter and
     nothing collides with them, so the belt is exactly as walkable as it was --
     the player passes over the top because there is nothing there to stop him.
     Anything that has to be STOOD ON for real (a height the fighter's z or
     jumpY answers to) is a different feature and a different file; see the note
     at the top of src/scenery.js about the two bargains an object can make.

     ⚠️ THE LAYOUT IS HASHED, NOT RANDOM. The desert's camera reverses, so the
     player walks back over ground they have already seen; a re-rolled scatter
     would be a different desert behind them. Same room, same layout, always.

     ⚠️ AND IT IS THE MOST EXPENSIVE SCENERY IN THIS GAME. 17-20 mounds are on
     screen at once at these settings, each roughly 550x140 -- about four screens
     of overdraw on top of the plate's own. The flies cost nothing next to this.
     `rows` and `spacing` are the dials and `on` is the switch; read
     PERFORMANCE.md before adding a second thing that paints the whole belt.

     ⚠️ IT IS STILL CHEAPER THAN THE LAST TIME THIS RAN AT 80%, which is the
     comparison that matters: the original 80% pass drew 29-35 a frame at the old
     mound size. Bigger mounds means fewer of them for the same cover, so the same
     look now costs about a third less fill than it did the first time.

     ⚠️ THE TARGET IS 90%, AND IT HAS NOW MOVED THREE TIMES. "cover like 80%" ->
     "its not 80%, its actually 60%" -> "lets bring that up to 80% back" -> "fill
     it 100% ... to the brim", immediately softened to "if 100% is unreasonable,
     try 90%". **The number is a LOOK, not a spec, and it is the USER'S look.**
     Every one of those was a new target rather than a complaint about the last.
     Do not defend whatever number is here against the next one; re-measure and
     move it. What ships now is 90.7%.

     ⚠️ MOVING THE FIELD DOWN RAISED COVERAGE INSTEAD OF LOWERING IT, which is
     the opposite of the obvious guess and worth keeping. Dropping far and mid by
     20% of the belt took the SAME 12 x 1.20 from 90.7% to 95.0% at an identical
     draw count. A mound's ink sits entirely ABOVE its ground point, so the top
     rows had been spending a slice of themselves painting up the back wall where
     it does nothing; moving them down brought that ink into the belt for free.
     Which is why `rows` came back DOWN from 12 to 9 to hold the 90% target -- the
     same look now costs 17-20 draws instead of 23-27.

     ⚠️ AND THE FAR BAND IS NOW THE ONE TO WATCH. Its first row sits at z 0.200
     (76px, screen y 406), so the top 76px of the belt has no ground point in it
     at all and is covered only by ink hanging up from that row. It measures 90.9%
     and is fine. Push the field down again and the BACK of the belt is what goes
     bare first -- the far edge, not the near one, which is the reverse of the
     failure this feature had on its first pass.

     ⚠️ 100% WAS MEASURED AND DECLINED ON COST, NOT ON TASTE, and the user made
     that call themselves by offering 90 as the fallback. It IS reachable -- the
     art is porous, so a solid mat is a question of stacking enough porous layers,
     and 28 x 0.80 measures a true 100.0% at every third and every camera. It
     costs **86-93 mounds a frame, about 16 screens of overdraw**, against 23-27
     and ~5 screens at 90%. That is FOUR TIMES the fill for the last nine points,
     on the one project whose frame rate has already collapsed once
     (PERFORMANCE.md). The knee is sharp and it is between 90 and 100:

         81.7%   18-23 drawn    ~4 screens of overdraw
         90.7%   23-27 drawn    ~5              <- shipped
         99.5%   49-55 drawn    ~9
        100.0%   86-93 drawn   ~16

     ⚠️ IF A TRUE CARPET IS EVER WANTED, THE ANSWER IS NOT MORE ROWS. Ninety
     mounds a frame to paint one belt is the scatter being used as a fill tool.
     Bake the six drifts into one wide repeating strip at build time and the whole
     floor is two or three blits -- but it is a different feature: a baked strip
     cannot have three bands moving at three speeds over it, so the parallax and
     the carpet are alternatives, not additions.

     COVERAGE IS `rows`, NOT `spacing`, AND THE FIRST PASS HAD THAT BACKWARDS.
     Packing tighter in x (spacing 0.52) merged each row into a continuous ridge
     and still left the belt at 78%, because what was uncovered was never the
     gaps between mounds -- it was the gaps between ROWS, and the near edge,
     which no row reached at all. Measured across four camera positions:

     ⚠️ EVERY NUMBER BELOW IS TIED TO THE MOUNDS' SIZE, which went up twice on
     2026-08-27 (SCALE in tools/build-beat-fundo-defs.py: 0.11 -> 0.143 -> 0.157).
     The scatter spaces mounds by their own WIDTH so x looks after itself, but a
     bigger mound covers more DEPTH -- the same 6 x 1.30 that gave 62% at 0.11
     gives 68% at 0.143. Re-cut the pack and re-measure.

     ⚠️ THE SECOND BUMP (+10%) NEEDED NO RETUNE, and that is worth knowing rather
     than assuming: at 0.157 the shipped 6 x 1.45 measures 67% against 66% at
     0.143, which is inside the variation between one stretch of the room and the
     next. Only `marginPx` moved, to clear the wider mound. A third bump will not
     be free -- the trend is roughly +2 points of coverage per +10% of size.

     Measured over SEVEN camera positions across the room (four was not enough
     once the mounds got big and sparse -- the coverage varies by 15 points from
     one stretch of the room to the next, and a four-sample average hid that).

     ⚠️ THE MEASUREMENT IS A PORT OF scenery.js, AND ITS ONLY CLAIM TO BE TRUSTED
     IS THAT IT REPRODUCES A ROW OF THIS TABLE. It lays the scatter out with the
     same hash and the same math, blits the frames' ALPHA into the belt strip at
     seven camera positions and counts. Calibrated against the shipped 6 x 1.45
     row -- it prints 66.3% / 76.5 / 65.2 / 57.4 and 9-12 drawn against the 67% /
     77 / 66 / 57 and 9-12 recorded here, on an alpha > 63 threshold. A port that
     cannot reproduce a known row is measuring a fiction, and every number under
     it would be one:

                              belt        far/mid/near     drawn/frame
      old size, 0.11:
         5 x 0.52  z .10-.90   78%      95 / 91 / 42        31-35
         9 x 1.05  z 0-1.05    81%      92 / 84 / 83        29-32
         6 x 1.30  z 0-1.05    62%      71 / 63 / 68        15-16
      at 0.143:
         6 x 1.30  z 0-1.05    68%      80 / 71 / 53        12-16
         6 x 1.45  z 0-1.10    66%      74 / 64 / 58         9-12
         6 x 1.70  z 0-1.05    54%      72 / 53 / 39         8-11
      at 0.157 (current):
         6 x 1.45  z 0-1.10    67%      77 / 66 / 57         9-12
         6 x 1.55  z 0-1.12    64%      75 / 61 / 55         9-11
         5 x 1.45  z 0-1.12    58%      64 / 60 / 49         7-10
     at 0.157 WITH THE THREE BANDS (bandScale + bandOffsetZ), 2026-08-27:
         6 x 1.45  mid off 0   62.6%    75 / 46 / 66         9-12   <- the hole
         6 x 1.45  mid off .10 65.8%    66 / 64 / 67         9-12   <- ramp alone
        11 x 1.45  mid off .10 78.8%    83 / 76 / 77        17-21
        10 x 1.35  mid off .10 78.6%    85 / 76 / 74        17-22
        11 x 1.35  mid off .05 80.3%    89 / 76 / 76        18-23
        11 x 1.35  mid off .10 81.7%    86 / 78 / 80        18-23
        12 x 1.35  mid off .10 83.5%    87 / 79 / 85        19-25
        11 x 1.25  mid off .10 86.7%    90 / 85 / 85        20-24
     and the run at 90% (2026-08-27, "fill it 100% ... try 90%"):
        11 x 1.10  mid off .10 90.4%    94 / 88 / 89        25-28
        12 x 1.20  mid off .10 90.7%    93 / 87 / 92        23-27
        15 x 1.35  mid off .10 90.5%    87 / 91 / 94        25-31
        14 x 0.70  mid off .10 99.5%    99 / 99 /100        49-55
        28 x 0.80  mid off .10 100.0%  100 /100 /100        86-93
     then all three planes down 20% (offsets .20 / .30 / .20):
        12 x 1.20              95.0%    96 / 92 / 97        23-27   the drop alone
         9 x 1.20              90.3%    91 / 91 / 90        17-20   <- 3-plane ship
        12 x 1.35              90.5%    92 / 85 / 94        19-25
        13 x 1.35              91.3%    94 / 85 / 96        20-27
     and FIVE planes (bands 5, offsets flat .20, spread 0.25), 2026-08-27.
     `zFrom` is the second column now, because at five bands it is the knob that
     decides the shape and `spacing` only sets the level:
        10 x 1.20  zFrom 0      91.4%    95 / 90 / 89        19-22   the naive port
        10 x 1.20  zFrom .10    91.8%    92 / 93 / 90        19-22
        10 x 1.25  zFrom .10    90.4%    92 / 92 / 88        18-22
        10 x 1.25  zFrom .12    90.1%    90 / 92 / 88        19-21   <- ships
        15 x 1.60  zFrom .15    90.8%    89 / 90 / 93        20-26   3 rows a band
        10 x 1.30  zFrom .12    88.0%    90 / 91 / 84        15-20

     ⚠️ THE NAIVE PORT IS THE ROW TO LOOK AT. Changing ONLY the band count and
     the rows -- leaving the ladder where three planes had left it -- measures a
     perfectly respectable 91.4% average and a 7-point spread across the thirds,
     piling ink into the FAR third at the expense of the near one. That is the
     "read the thirds, not the average" trap for the FOURTH time, and it is now
     the reliable signature of this feature: **whenever the field's shape
     changes, the average barely moves and one third quietly pays for it.**
     `zFrom` 0 -> 0.12 is the fix, and it is a placement change, not a density one.

     ⚠️ THE FIVE-PLANE ROW IS LESS FLAT THAN THE THREE-PLANE ONE (3.9 points of
     spread against 1.4) AND MORE CONSISTENT PER CAMERA (86-93% against 83-95%).
     Those are not in tension: more, thinner bands even out what any one camera
     position sees while making the depth profile slightly lumpier. If one number
     has to be defended it is the per-camera one -- a player sees camera
     positions, never the average of thirds.

     ⚠️ AND THE BACK OF THE BELT IS 3 POINTS THINNER, which is the cost of
     pushing the ladder down. The top QUARTER runs 83-95% across 13 camera stops
     against the three-plane 86-96%. That is the failure the previous pass
     predicted -- "push the field down again and the BACK of the belt goes bare
     first" -- arriving, measured, and judged affordable at 83%: it is behind
     everything, and the whole belt's worst camera actually improved (83% against
     81%). If it ever reads bare, `zFrom` is the one knob, and it trades against
     the near third point for point.

     ⚠️ THE SHIPPED ROW IS THE EVENEST, NOT THE HIGHEST, and that is deliberate --
     86.5 / 78.4 / 80.3 is the flattest spread anything measured, and per-camera it
     runs 72-85% against the old 48-75%. A higher average with a weak third is
     what this feature has now got wrong twice.

     ⚠️ IT WILL NOT GO MUCH UNDER 65 WITHOUT GOING PATCHY at this mound size, and
     that is the trade to know: each drift is now most of a screen wide, so
     thinning them further stops meaning "more sand between mounds" and starts
     meaning "some screens have a bare stretch". 66% with an even spread beat 60%
     with holes in it. (Moot while the target is 80, and worth keeping for the
     next time it moves down.)

     ⚠️ `rows` IS STILL THE DIAL AND SPACING BARELY MOVED. Getting from 62.6% to
     81.7% was rows 6 -> 11 and spacing 1.45 -> 1.35, and rows did nearly all of
     it. Spacing stays ABOVE 1.0 on purpose -- under it the drifts in a row merge
     into one continuous ridge, which is the old "stuck together too much"
     complaint. Rows alone saturate: 11 x 1.45 measures 78.8%, so the last two
     points came from the small tighten and not the other way round.

     ⚠️ READ THE THIRDS, NOT THE AVERAGE. The first pass was 78% overall and 42%
     where the player actually walks -- "the lower part has no cigarettes" -- and
     that was a PLACEMENT bug rather than a density one. It is why the shipped
     row at 62% is EVEN across the depth (71/63/68) where the 78% one was not.
     See scenery.js.

     ⚠️ AND THE MEASURED NUMBER UNDERSTATES WHAT IT LOOKS LIKE. It counts ALPHA,
     and the art is porous on purpose -- a drift of loose butts with sand showing
     between them.

     -------------------------------------------------------------------------
     THE FIVE SPEEDS (2026-08-27)
     -------------------------------------------------------------------------
     Asked for as "one crazy feature": *"for the cigarrete bums mounts, we want
     to try to create a parallax effect on them, it should be 3 layers, a closer
     one, a mid one and a far away one, they should move in different speeds."*
     Then, the same day: *"instead of 3 planes of layers, I actually want 5
     planes of layers."*

     The rows are cut into depth BANDS -- `bands` of them, two rows each -- and
     each band scrolls at its own rate. The far drifts lag, the near ones keep up,
     and the belt reads as having thickness instead of as one flat decal.

     ⚠️ THE COUNT IS DATA NOW, AND MAKING IT SO WAS THE WHOLE JOB. Three was
     hardwired in scenery.js as `const BANDS = 3` and three times over in the
     config as `{far, mid, near}`. Going to five by adding two more names would
     have worked exactly once; the fix is that each block is a CURVE that gets
     SAMPLED at `bands` points, so 3, 5 and 7 all read the same file.

     ⚠️ THE ROLLBACK IS FIVE NUMBERS, NOT ONE, AND `bands: 3` ALONE IS NOT IT.
     The count came with a re-tune -- the spread widened, the ladder re-graded,
     the density came back down -- and dropping the count without undoing those
     leaves a THIRD configuration that was never measured or looked at. It is
     spelled out verbatim below so it is a paste and not a reconstruction:

         bands: 3,   rows: 9,   spacing: 1.20,   zFrom: 0.0,
         parallax.rates: [0.80, 0.90, 1.00],
         bandScale:      [1.00, 1.05, 1.10],
         bandOffsetZ:    [0.20, 0.30, 0.20],

     Those are exactly what shipped at 4a5d788, expressed as lists -- the reader
     takes either shape and at three bands a three-entry list is read literally,
     so this is byte-for-byte the old layout and not an approximation of it.

     ⚠️ THIS DELIBERATELY BREAKS "THEY BEHAVE AS THE GROUND". A band under 1.0 no
     longer sits on a fixed patch of sand -- it slides against the filmed plate,
     which is parallax 1.0, and against the fighters, who are 1.0 by definition.
     That IS the effect. It is only affordable because of the bargain at the top
     of scenery.js: nothing in this game ever asks a mound where it is, so there
     is nothing to be wrong. The moment one has to be stood on, this feature and
     that one cannot both exist.

     ⚠️ THE NEAR BAND IS PINNED AT 1.0, AND THAT IS THE CHOICE, NOT A DEFAULT.
     Textbook parallax anchors the FAR plane and makes the near one race (far 1.0
     / mid 1.1 / near 1.25). Try it and the ground directly under the player's
     feet outruns him -- he reads as skating on the butts rather than walking
     through them, and this is a beat 'em up where the feet are the whole
     contract with the belt. Anchoring the NEAR band instead keeps the ground he
     is actually standing on honest and spends the whole effect on the depth
     behind him, which is where a player looks for it anyway. Both are one edit;
     the values below are the anchored-near version.

     ⚠️ THE SPREAD IS THE DIAL, NOT THE INDIVIDUAL NUMBERS. 1.00 down to 0.75 is a
     0.25 spread: walk 1000px and the far band has drifted 250px against the
     sand. Under about 0.06 total it stops being visible at all and only costs
     the coherence; much over 0.25 and the back of the belt visibly crawls
     backwards when the camera moves fast, which reads as a bug rather than as
     distance -- so this now sits ON the ceiling rather than comfortably under it.

     ⚠️ AND MORE PLANES SPEND THAT SPREAD THINNER, WHICH IS THE THING TO WATCH.
     What the eye reads is the STEP between neighbouring planes, and dividing one
     budget five ways instead of three halves it (0.10 -> 0.05). That is why the
     total went 0.20 -> 0.25 with the count: at the old spread, five planes would
     have been a more expensive way to look like three. The step is still smaller
     than it was (0.0625), which is the honest cost of the ask -- five planes are
     necessarily less individually distinct than three unless the ceiling moves,
     and the ceiling is a real one.

     ⚠️ THE BANDS COME OFF THE ROW INDEX, NOT OFF THE JITTERED z. `zJitter` can
     move a row's ground point 30px, and a mound that changed SPEED because its
     scatter landed slightly forward would tear the boundary. Rows are what the
     bands are made of. `rows: 10` over `bands: 5` is a clean 2 each; keep `rows`
     a multiple of `bands` or the last plane -- the one the player walks through
     -- is built out of fewer rows than the rest (9/5 would be 2/2/2/2/1).

     ⚠️ A BAND OVER 1.0 COSTS DRAWS AND SCATTER, a band under it costs nothing.
     Below 1.0 a layer lags, so the existing field already over-covers the far
     end of the room. Above 1.0 it outruns the room and scenery.js has to extend
     the scatter past `endX` to keep it from going bare -- more items laid out,
     and the same number on screen. Nothing else changes; the cull already uses
     each item's own rate.

     ⚠️ N BANDS MEANS N-1 SEAMS, and five planes is four of them at 41px apart in
     depth and 0.0625 in speed. That is the trade the count makes: more planes is
     a smoother gradient AND more places for it to tear. Seams are cheaper here
     than they sound, because the rows overlap in depth -- a mound in one band is
     drawn over by mounds from the next -- but if a boundary ever reads as a tear
     rather than as distance, the fix is not a smaller spread. It is giving every
     ROW its own rate lerped from far to near, which at this point is deleting the
     band index and calling `_ramp(..., rows, ...)` instead of `_ramp(..., BANDS,
     ...)`: discrete planes are what was asked for twice, and five of them is
     already most of the way to that gradient.

     ⚠️ IT COSTS NOTHING PER FRAME TO ADD PLANES; THE ROWS ARE WHAT COST. Band
     count is one multiply per item either way. What five planes actually bought
     was `rows` 9 -> 10 to keep the split even, and that is +2 mounds a frame:
     **19-21 drawn against 17-20**, one atlas bind, unchanged. */
  SCENERY: {
    on: true,
    /* The pack, cut by tools/build-beat-fundo-defs.py. Loaded under the asset
       key `scenery` -- see src/manifest.js, which spells that key twice. */
    sheet: 'v2:beatemup-dungeon/cigarros-fundo',
    rows: 10,          // rows of drifts across the belt's depth -- the COVERAGE dial
    /* HOW MANY PLANES. Asked for 2026-08-27: *"instead of 3 planes of layers, I
       actually want 5 planes of layers"*. It was hardwired at 3 in scenery.js
       and is now one number, because the three curves below are SAMPLED at it
       (see Scenery._ramp) rather than indexed by it -- so 3, 5 or 7 all read the
       same config and nothing falls off the end of an array.

       ⚠️ `rows` MUST STAY A MULTIPLE OF THIS or the last plane is short. The
       split is `floor(r * bands / rows)`, so 9 rows over 5 bands is 2/2/2/2/1 --
       a near plane made of one row, which is the plane the player walks through.
       10/5 is a clean 2 each; 15 would be 3 each. */
    bands: 5,
    /* X STEP AS A FRACTION OF EACH MOUND'S OWN WIDTH. Over 1 they do not touch.
       ⚠️ IT WAS 0.52 AND THAT WAS THE COMPLAINT: at half a width apart the
       mounds in a row merged into one continuous ridge -- "stuck together too
       much". At 1.05 each drift is its own thing with sand between it and the
       next, and the COVERAGE comes from the rows overlapping in depth instead,
       which is what `rows` is for. */
    /* ⚠️ 1.20 -> 1.25 IS THE RETUNE THAT HOLDS 90%, NOT A LOOK CHANGE. Going 3
       planes -> 5 took `rows` 9 -> 10 (see `bands`), and ten rows at the old
       1.20 measures 91.7% against the 90% the user set by watching. Loosening
       the x step gives the point and a half back: 90.1%. Same rule as the last
       time two live instructions collided -- apply the new one, retune the
       standing number back, say that you did. */
    spacing: 1.25,
    zJitter: 60,       // px, so the rows do not read as stripes
    /* WHERE THE ROWS RUN, as fractions of the belt's depth, INCLUSIVE at both
       ends. A mound's ink sits entirely ABOVE its ground point, so a row at z
       covers about [z - 140, z] -- which is why `zTo` is past 1: the last row's
       ground point sits just beyond the near edge so its drawing reaches it.
       See the note in scenery.js; getting this wrong left the front of the belt
       bare while a quarter of the field was painted up the wall. */
    /* ⚠️ `zFrom` 0.0 -> 0.12 IS WHAT FLATTENS FIVE PLANES ACROSS THE BELT, and it
       is a placement fix rather than a density one -- the same class of change as
       the very first bug in this feature. Ten rows spread over the old ladder
       piled ink into the FAR third (95.4% far against 88.5% near, a 7-point
       spread where three planes measured 1.4). Starting the ladder 12% of the
       belt lower re-grades all ten rows down and evens it to 90.0 / 92.1 / 88.1.

       ⚠️ AND `zTo` DID NOT MOVE, DELIBERATELY. `zTo + bandOffsetZ(near)` = 1.30
       is where the front row's ground point lands (z 494), which is the "20% down
       the screen" the user set two turns before this. It is a CONSTRAINT on any
       future search here, not a free knob: several higher-scoring configs get
       there by pulling `zTo` back, which would silently undo that ask. */
    zFrom: 0.12,
    zTo: 1.10,
    /* How far outside the room the scatter runs. The player stands at `startX`
       with the camera at 0 and can see a screen of ground to his left, so a
       field that began at his feet would show bare sand in the one moment the
       room is introducing itself. */
    /* ⚠️ THE WIDEST MOUND IS 995px AND THE NEAR BAND DRAWS IT AT 1094 (bandScale
       below), so this no longer "clears the widest" -- and does not need to. The
       camera never goes below 0 (`stage.js`: `minCam = reverseFloorX || 0`), so
       the only thing the left margin has to do is put ink at x=0, which any
       value over about one mound-width does. It is slack, not a clearance. It is
       left at 1000 deliberately: `x0 = -marginPx` is where the scatter's index
       starts counting, so changing it re-rolls the layout of EVERY band, and
       there is nothing to buy with that. */
    marginPx: 1000,
    /* THE THREE SPEEDS -- px of mound movement per px of camera movement, the
       same meaning `parallax` has on a BACKDROP layer. The rows are split into
       three equal bands of depth and each band takes one of these.

       `on: false` and every row goes back to 1.0, which is what the ground cover
       was before this and what any room that is not the desert wants. */
    parallax: {
      on: true,
      /* FAR -> NEAR, one entry per plane. A LIST, not `far`/`mid`/`near`, because
         there are five of them now -- and it is read as a CURVE, so a shorter
         list is legal and simply gets interpolated (`[0.75, 1.00]` is this exact
         ramp written as two numbers). The old three names still read, for the
         same reason.

         ⚠️ THE LAST ENTRY IS PINNED AT 1.00 AND THAT IS THE CHOICE. See the note
         above: the ground under the player's feet holds still and the whole
         effect is spent on the depth behind him.

         ⚠️ THE SPREAD WENT 0.20 -> 0.25 BECAUSE FIVE PLANES SPLIT IT FIVE WAYS.
         The dial has always been the TOTAL, and 0.20 across three bands was a
         0.10 step between neighbours -- which is the difference you could
         actually see. Five bands over that same 0.20 is a 0.05 step, half of
         what was being watched, and "5 planes" would have shipped looking like
         3. Widening to 0.25 puts the step back at 0.0625.

         ⚠️ 0.25 IS THE DOCUMENTED CEILING AND THIS SITS ON IT. Much over it and
         the back of the belt visibly crawls backwards on a fast camera move,
         which reads as a bug rather than as distance. If it does that here, the
         first thing to try is `[0.80, 0.85, 0.90, 0.95, 1.00]` -- the old 0.20
         spread, five ways -- and NOT fewer planes.

         Coverage cost of the widening: none. Measured both ways, 90.1% vs 90.3%
         and the per-camera band is actually tighter (86-93 against 83-95). */
      rates: [0.75, 0.81, 0.87, 0.94, 1.00],
    },
    /* HOW BIG EACH BAND IS DRAWN, a multiplier on the pack's own scale. The SAME
       bands the parallax cuts -- rows 0-1 / 2-3 / 4-5 / 6-7 / 8-9 at `rows: 10`,
       `bands: 5`.

       ⚠️ THE LAST ENTRY IS 1.10 BECAUSE IT WAS ASKED FOR ("the cigarettes in the
       first plan, closer to the screen, make them 10% bigger"), and it is also
       the other half of the depth cue the parallax started: a closer thing moves
       faster AND is bigger, and doing only the first is what makes a parallax
       read as sliding rather than as distance.

       ⚠️ THIS IS NOT A RE-CUT, AND IT MUST NOT BECOME ONE. The pack is cut once
       at one scale (`SCALE` in tools/build-beat-fundo-defs.py, 0.157) and that
       stays the art's size -- see the wire-art rule: one scale per pack, never
       normalised per sprite. What this multiplies is a BAND, which is a piece of
       level composition, not a sprite. Every frame in the band is affected
       equally, so the mounds' sizes relative to each other are untouched.

       ⚠️ IT MOVES THE SPACING AND THE ANCHOR WITH IT, in scenery.js. `spacing`
       is a fraction of a mound's own width, so the step scales too or the band
       packs tighter as well as growing and "bigger" arrives as "denser". And the
       anchor is in frame pixels, so it scales or the whole band floats off the
       belt. Both are handled; a third consumer of these frames would have to be.

       ⚠️ COVERAGE: the near third gains ~2 points (the +2-per-+10% rule above --
       the mounds cover more DEPTH; x looks after itself via the spacing). Fill
       is ~+10% on the front rows, so ~+3% overall, and the draw count is
       unchanged to within a mound. Nothing here needed a retune.

       FAR -> NEAR, AND THE ENDPOINTS ARE THE TUNED ONES: 1.00 is the pack's own
       scale and 1.10 is the "make the closer cigarettes 10% bigger" that was
       asked for. Going to five planes only subdivides between them -- the back
       and the front of the field are drawn at exactly the size they were, and
       the three new steps are 0.025 apart.

       ⚠️ IF FIVE PLANES DO NOT READ AS DEPTH, THIS IS THE DIAL AND NOT THE
       PARALLAX. A 0.025 size step between neighbours is near-invisible, so the
       depth cue is carried almost entirely by the speed. Widening the ladder
       DOWNWARD -- `[0.95, 0.99, 1.02, 1.06, 1.10]`, i.e. shrinking the far
       drifts rather than growing the near ones -- is the one line that makes
       distance visible as size. It is left alone here because 1.00 at the far
       end is the art's own size and shrinking it is a decision nobody asked
       for; it also costs coverage in the far third and would want a retune. */
    bandScale: [1.00, 1.025, 1.05, 1.075, 1.10],
    /* WHERE EACH BAND SITS, as a fraction of the belt's DEPTH added to its rows'
       z -- positive is toward the viewer, i.e. DOWN the screen. The same unit
       `zFrom`/`zTo` are already in, and the same bands.

       FAR -> NEAR, AND FLAT ON PURPOSE. This is the "bring the planes down by 20%
       of the belt" that was asked for, and with five planes it is now the ONLY
       thing this block says: 0.20 for every one of them.

       ⚠️ IT USED TO BE 0.20 / 0.30 / 0.20 AND THAT WAS A PATCH, NOT A SHAPE. The
       extra 0.10 on the mid band existed to close a 129px hole that three coarse
       bands opened between the mid band's last row and the near band's first --
       the middle third had measured 45.9% against a 62.6% average, which is
       "read the thirds, not the average" arriving for the third time. **Five
       bands, ten rows and the re-graded `zFrom` close that hole geometrically**,
       so the patch has nothing left to do and carrying it forward would put a
       bump back into an otherwise even ladder. The ten ground points now land
       evenly from z 122 to z 494, 41px apart.

       ⚠️ THE UNIT IS THE BELT'S DEPTH, NOT THE SCREEN. 0.20 is 76px of the
       desert's 380, not 20% of GAME_H (which would be 144, and 0.38 here).

       ⚠️ A BAND MAY BE PUSHED PAST THE NEAR EDGE OF THE BELT, AND THE LAST TWO
       ARE. Their ground points sit at 411-494 against a belt 380 deep, off the
       bottom of the 720px screen -- and that is the point, because a mound's ink
       is entirely ABOVE its ground point, so the drift still reaches back up into
       the belt and only its bottom edge is cropped.

       ⚠️ IT DOES NOT MAKE THE FRONT PLANE A FOREGROUND. Scenery is ONE layer in
       CONFIG.LAYERS, drawn before every fighter, so a mound at z 494 is still
       painted BEHIND a player standing at z 380. It reads as ground sloping
       toward the lens; it will NOT read as something he walks behind. That is a
       draw-ORDER change -- a second scenery pass in the `foreground` slot, which
       is already in LAYERS at parallax 1.25 and `on: false` -- and no number in
       here reaches it. */
    bandOffsetZ: [0.20, 0.20, 0.20, 0.20, 0.20],
    /* =====================================================================
       THE SIXTH LAYER — THE ONE IN THE DEAD AREA
       =====================================================================
       Asked for 2026-08-28: *"testar outra camada de cigarros (sexta, no
       fundo): essa camada não vai no belt normal do jogo, ela vai na área
       morta, uma parte dela vai pegar na área morta e a outra pode estar no
       belt, ela pode ser do mesmo tamanho que a quinta camada."*

       ⚠️ IT IS A SEPARATE BLOCK AND **NOT** `bands: 6`, AND THAT IS WHAT MAKES
       IT SAFE TO TEST. The five bands share one row ladder running `zFrom` to
       `zTo`; adding a sixth means `rows` 10 -> 12 to keep the split even, which
       re-spaces the whole ladder and MOVES ALL FIVE PLANES that were tuned by
       eye. This leaves them at exactly the z they have today, and `on: false`
       takes it straight back out.

       ⚠️ NEGATIVE z IS THE FEATURE. z measures DOWN from the belt's top edge, so
       a negative ground point is above the belt entirely -- the dead area, where
       nothing walks. Nothing else in SCENERY uses it.

       ⚠️ AND `zTo` IS POSITIVE ON PURPOSE, which is the "uma parte na área morta
       e a outra no belt" half of the ask. A mound's ink sits ENTIRELY above its
       ground point, so a row placed just inside the belt still spends most of
       itself in the dead area and only its bottom edge crosses the line. At the
       desert's belt (topY 330, depth 380) these two rows land at screen y 311
       and 387, painting from y 111 down -- about 90% dead area, the rest belt.

       ⚠️ IT ANSWERS NONE OF THE COVERAGE RULES. Belt coverage is measured on the
       belt strip and this layer is almost entirely outside it, so the 90% the
       user set is untouched. It is backdrop, not ground cover. */
    backLayer: {
      on: true,
      rows: 2,
      /* Fractions of the belt's DEPTH, like every other z here -- but these may
         go negative, and the first one does. */
      /* ⚠️ DOWN 30% OF THE BELT, asked for 2026-08-28 ("bring the 6th layer 30%
         down"), read in the belt's depth like every other z here: 0.30 x 380 =
         114px. It WAS -0.05 / 0.15.

         ⚠️ AND AT THIS OFFSET IT IS NO LONGER REALLY IN THE DEAD AREA -- both
         ground points are now inside the belt (y 425 and 501 against a belt
         starting at 330) and it INTERLEAVES with the far band rather than
         sitting behind it. See the note in README; the user asked to see it
         anyway. Back to -0.05 / 0.15 restores the dead-area version. */
      zFrom: 0.25,
      zTo: 0.45,
      zJitter: 0,
      /* ⚠️ SLOWER THAN THE FAR BAND (0.75), WHICH TAKES THE TOTAL SPREAD TO 0.30
         AND PAST THE 0.25 CEILING THE BELT ROWS OBEY. That ceiling is about
         GROUND: a belt band under it visibly crawls backwards and stops reading
         as the floor the player is standing on. This layer is not floor -- it is
         up the back wall, where a slower rate is just distance. If it reads as
         sliding rather than as depth, 0.75 (matching the far band) is the first
         thing to try and it costs only the separation between the two. */
      parallax: 0.70,
      /* "Do mesmo tamanho que a quinta camada" -- the fifth plane counting from
         the front is the farthest, which is `bandScale[0]`, which is 1.00: the
         pack's own scale with no multiplier. */
      scale: 1.00,
      /* Defaults to SCENERY.spacing when absent; named here so the density of
         the dead area can be tuned without touching the belt. */
      spacing: 1.25,
    },
  },

  /* =========================================================================
     COMING UP OUT OF THE GROUND (2026-08-31)
     =========================================================================
     Asked for on 2026-08-31: *"make the enemies come out of the pile of
     cigarettes, like make them come out of the ground"*, for the desert and
     nowhere else, and with the improvisation named in the same message --
     *"we didn't plan for this animation, so lets try to improvise"*.

     THERE IS NO ART. Not a burrow row, not a dig pose, nothing in any pack that
     draws a body half-buried. So the arrival is two things, and src/emerge.js
     explains both:

       the HOLE   a dark ellipse in the floor, drawn UNDER the body.
       the BODY   drawn below its own ground point with everything under the
                  floor line SCISSORED OFF (Fighter.draw), so it is revealed
                  head-first -- the picture a dig-out row would have drawn.

     ⚠️ IT WAS THREE THINGS. A RIM cut from the desert's floor pack sat over his
     feet to hide the scissor line, and DEBRIS -- the same drifts shrunk and
     thrown in the air -- came out with him. Both were refused on sight:
     *"I don't like these effects with the tiny cigarettes being thrown in the
     air. Also the small cigarettes that appear in the feet of the enemy are not
     good as well."* Deleted rather than switched off. **Do not re-propose
     either.** It also removed a dependency nobody had asked for: the effect
     borrowed the floor pack, which quietly tied it to `SCENERY.on`. It now needs
     no art at all.

     ⚠️ IT IS PER-ENEMY WAVE DATA, NOT A ROOM SETTING. An enemy digs because its
     entry in a segment says `from: 'ground'` -- the same slot `from: 'behind'`
     already uses, read in Stage._spawn. So "only in the desert" is a fact about
     which waves say it, and putting one in the street costs no code.

     THE THREE DURATIONS ARE THE WHOLE FEEL and they are read in that order:
     the ground opens with nothing coming out of it, the body climbs, the hole
     closes. Only the first two are in the player's way -- `settleMs` runs while
     he is already fighting. */
  EMERGE: {
    on: true,
    /* THE GROUND OPENS BEFORE ANYTHING COMES OUT OF IT, and this is the beat
       that replaces the walk-in. A walk-in exists so that nobody MATERIALISES in
       front of the player: it buys them a moment to see how many are coming and
       from where. This spends the same moment in place instead of sideways -- so
       if a digger ever reads as popping into existence, THIS is the number, not
       anything in stage.js. */
    heaveMs: 380,
    /* THE CLIMB. He plays his JUMP row while he does it, spread across this
       duration -- asked for 2026-09-01: *"usar os frames que eles estão pulando,
       ao invés dos frames normais. Eles pulam para fora dos buracos."*

       ⚠️ IT WAS THE WALK ROW AND THE NOTE HERE USED TO SAY SO. That was the
       honest improvisation when the effect was built -- there is no dig-out art
       anywhere in this game -- but a walk cycle reads as a body being LIFTED
       through the floor, where a jump row is a whole-body push off the ground,
       which is the shape of the movement whether or not it was drawn for a hole.
       Both desert diggers own a six-frame `jump`; a pack without one falls back
       to the walk, so this is an improvement that cannot become a missing
       fighter. See `pose()` and `frameStep()` in fighter.js.

       ⚠️ HE IS UNTOUCHABLE FOR ALL OF THIS AND FOR `heaveMs` BEFORE IT -- see
       `buried` in fighter.js. Lengthening this lengthens the window in which the
       player can stand on top of him and hit nothing, which is the cost the
       effect has to earn. */
    riseMs: 560,
    /* HOW FAR CLEAR OF THE HOLE HE LANDS, in world px. Asked for 2026-09-01:
       *"ao invés de cair exatamente da onde eles saíram, eles caem um passo pra
       frente."*

       ⚠️ THE POINT IS THAT THE BODY AND THE HOLE END UP IN DIFFERENT PLACES.
       Rising straight up and stopping dead on the spot reads as an elevator; a
       body that throws itself out lands somewhere else, and the hole closing
       behind him is what makes the two read as two objects instead of one
       animation. 34px is about a walking pace at this scale -- a step, which is
       what was asked for, and not a leap.

       ⚠️ IT IS TOWARDS THE PLAYER, and it also decides which way he is drawn
       facing for the whole jump. `_face(player)` used to be the first thing to
       set his facing, on release -- so he came out facing however the wave was
       authored and snapped round on landing.

       ⚠️ AND IT MOVES THE FIGHTER, NOT THE HOLE, which is only safe because
       `Emerge.start` takes a COPY of the spot. 0 = the old behaviour, straight
       up and down. */
    stepPx: 34,
    /* THE HOP: how far ABOVE the ground line he gets, in px at the near edge of
       the belt, and how much of the rise is spent still coming through the
       floor. Asked for 2026-09-01: *"don't make him like come to the ground
       level, make him pass the ground level, and then come back, to simulate a
       jump."*

       ⚠️ THE TWO NUMBERS SPLIT ONE DURATION, THEY DO NOT ADD ONE. `clearAt` is a
       fraction of `riseMs`: 0.55 of 560ms is 308ms coming out of the hole and
       252ms in the air, and `released` still fires at the end of the rise -- so
       he touches down on the exact frame the AI takes him over. A hop with its
       own duration could outlast the climb, and what that looks like is a
       fighter who starts walking in mid-air.

       ⚠️ AND THE ARC IS A SINE, NOT TWO EASES. See `hop` in emerge.js: up and
       down have to be one curve with a smooth top, or the apex reads as hanging.

       hopPx: 0 = he stops at ground level, which is the old behaviour. */
    hopPx: 26,
    clearAt: 0.55,
    /* WHICH FRAME OF THE JUMP ROW HE HOLDS while he is coming out. Asked for
       2026-09-01: *"hold the frame where he is most stretched"*, and confirmed
       against the rows: 2 in all four digger packs (espeto, charutobi, cigarro,
       cigarro3).

       ⚠️ IT IS HELD, NOT PLAYED, AND THAT IS THE WHOLE POINT. The row is a jump
       from a STANDING start -- crouch, push, tuck, land -- so four of its six
       frames are a body doing something on the ground. A digger is in the air
       for all of this, so he holds the tuck.

       ⚠️ ONE NUMBER BECAUSE THE PACKS AGREE, not because anything makes them. A
       pack that draws its apex elsewhere needs a per-kind override, and this is
       where it would go. ⚠️ And the frame was picked BY EYE: the cigarettes'
       tallest frame is 0, because their smoke plume is tallest there. */
    holdFrame: 2,
    /* THE DUST AS HE BREAKS THE SURFACE -- and it is a SUBSET of an explosion
       this game already loads, not a new effect. Asked for 2026-09-01: *"add a
       small explosion for when they come out of the ground but there is an
       important detail, its not the regular explosion, its the explosion for
       when you are falling at a hole in the main game, so it omits some
       frames."*

       ⚠️ `boomFrom: 5` IS THAT DIFFERENCE, MEASURED. The main game loads two
       defs off ONE sheet: `saborosa-boom-full.json` (12 frames) for the furnace
       blast, and `saborosa-boom.json` (7) for `startDungeonFall` -- and those
       seven are exactly frames 5..11 of the twelve this game carries as
       `BOOM_RECTS`. So the hole version is the TAIL: no grow-in, no peak, just
       the dispersing half. It opens already large and thins out, which is what
       dust kicked up by something else looks like; the full string opens small
       and blooms, which is what a thing detonating looks like. That is why the
       ask was specific about which one.

       ⚠️ AN INDEX, NOT A SECOND SHEET OR A SECOND DEFS FILE. The two games
       already share the art; what they disagree about is where to start reading
       it.

       ⚠️ IT FIRES AT `clearAt`, off the same number as the hop, so the burst and
       the moment he leaves the ground cannot drift apart. And it is drawn with
       the HOLE, which is before the sprite -- dust behind him, not over the body
       it is announcing.

       ⚠️ IT IS SIZED IN THE SAME UNIT AS THE DEATH BLASTS, AND THAT ENDED SIX
       ROUNDS OF GUESSING. It began as a `boomScale` ratio and went 0.5 -> 0.35
       -> 0.455 -> 0.637 -> 0.828, every correction in the same direction, before
       the ask that settled it: *"make the explosion of they spawning the same
       size as the explosion of the enemies that explode."* `DEATH_BOOM.espeto
       .sizePx` is 208 and `charutobi`'s is 193, so this is 200 -- the middle,
       within 4% of both -- and `Emerge` now does the identical `size / peak`
       arithmetic `Booms.draw` does off the identical rects.

       ⚠️ **A NUMBER YOU CANNOT COMPARE TO ANYTHING IS A NUMBER YOU WILL GUESS AT
       FOREVER.** As a ratio it could only be judged by looking; in px against
       the sheet's widest frame it can be read straight against the two blasts
       above and be right by construction. Five of my six guesses were low
       because I was reasoning about what the dust sits ON -- the hole, the body
       -- and an effect in the air is judged against the SCREEN.

       ⚠️ ONE NUMBER FOR ALL FOUR DIGGERS. If a kind ever needs its OWN death
       blast's size, `Emerge` would have to be told its kind -- worth it only
       when two diggers' explosions actually differ enough to see.

       ⚠️ AND IT IS DRAWN IN ITS OWN PASS, IN FRONT OF THE FLOOR. `boomFrom 0` =
       the whole explosion, which is the thing that was explicitly not wanted. */
    boomFrom: 5,
    boomSizePx: 200,
    /* HOW MANY OF THE TAIL'S FRAMES ACTUALLY PLAY. Asked for 2026-09-01: *"the
       jump and the explosion animation, make it choppy in the same way we did it
       when picking up the barrel, consider like its few frames."*

       ⚠️ FRAMES DROPPED, NOT THE RATE SLOWED, and the difference matters. Every
       `stride`-th frame is drawn and held `stride` times as long -- 4 frames
       instead of 7 -- so the burst reads as a thing with few drawings rather
       than as the same animation running slowly. Slowing `boomMs` instead would
       have stretched it well past the hole's own life and clipped the tail.

       ⚠️ THE BARREL PICKUP IS THE REFERENCE AND IT IS NOT A STUTTER EFFECT: it
       reads chunky because its ROW has few frames, each owning a visible slice
       of the action (`floor(t * n)` in fighter.js). This is the same look asked
       for directly, on art that has more frames than it needs. */
    boomStride: 2,
    /* AND THE SAME FOR THE CLIMB: how many positions the whole rise is allowed
       to have. The body holds ONE drawing all the way out (`holdFrame`), so
       there is no row to thin -- the MOVEMENT is the only thing left to
       quantise, and 6 steps is what makes a smooth arc read as few frames of
       one.

       ⚠️ ONE QUANTISER FEEDS ALL THREE OF `sunk`, `hop` AND `travel` -- see
       `_riseU` in emerge.js. They are three views of one movement, and stepping
       them separately would land the forward step between two heights.

       steps: 0 or 1 = smooth, which is what it was. */
    steps: 6,
    /* HOW LONG AFTER HE CLEARS THE FLOOR THE DUST GOES OFF. It fired ON
       `clearAt` first and that was wrong: *"its starting too early... it blows
       before the enemy even becomes visible but in a bad way."*

       ⚠️ `clearAt` IS WHEN HIS HEAD PASSES THE LINE, NOT WHEN THERE IS A BODY TO
       SEE. **The instant a thing starts is not the instant it reads** -- a burst
       there is a puff of dust over nothing that he then walks out of.

       ⚠️ AND THE WINDOW IS FAR TIGHTER THAN IT LOOKS: 200 was *"too delayed"*,
       100 still too delayed, 50 *"almost there"*, 25, 15. The airborne half of
       the climb is 252ms long and the answer sits in its first SIXTEENTH --
       **the burst belongs ON the break-through**, near enough to `clearAt` that
       the delay is a nudge rather than a beat, and 0 is wrong only because
       nothing has broken through yet at that exact frame. Halving from 200
       walked down to it in five rounds; nothing here was reasoned to.

       ⚠️ MEASURED: the strided tail is ceil(7/2) x 2 x `boomMs` = 567ms, so from
       703ms it ends at 1270 against a `done` of 1360 -- 90ms of slack. `stride`
       lengthens the burst as well as thinning it, so the two knobs share this
       budget; `settleMs` is what buys more of it. */
    boomDelayMs: 15,
    /* THE HOLE CLOSING, and it runs AFTER he is released -- he is walking and
       swinging while this plays out. Ticked on the effect's own clock in
       Enemy.update rather than in the AI branch that waited on it, for the
       reason the note there gives. */
    settleMs: 420,
    /* THE HOLE ITSELF -- a dark ellipse under the body, drawn before the sprite
       so he climbs up out of it. The radii are canvas px at the NEAR edge of the
       belt and shrink with depth, exactly like `shadowW`/`shadowH` (44 x 13),
       which this is deliberately a bigger, darker version of.

       ⚠️ THIS IS THE WHOLE OF WHAT MAKES THE ARRIVAL VISIBLE, now that the rim
       and the debris are gone, and it was added only after the effect was
       rendered against the real desert floor. That floor is a carpet of pale
       butts at 90% coverage, and anything drawn on it in the same art is a floor
       tile on a floor. What the eye catches is a DARK GAP, and then a body
       coming up out of it. At `holeAlpha: 0` there is no arrival left to see --
       just a cigarette growing out of the sand. */
    /* ⚠️ 40% SMALLER THAN IT WAS, asked for 2026-08-31 ("decrease the size of the
       shadow on the ground that appears when they are spawning, make it 40%
       smaller"). It was 52 x 17; these are exactly 0.6 of that, written out
       rather than rounded so the instruction is still readable in the numbers.
       For scale, the ordinary ground shadow is 44 x 13 -- so the hole is now
       SMALLER than a fighter's own shadow rather than half again as big. */
    holeW: 31.2,
    holeH: 10.2,
    holeAlpha: 0.62,
    /* Not black. The floor is warm and the shot is graded orange, so a true
       black gap reads as a hole cut in the picture rather than as dirt under the
       butts. */
    holeColor: '#241609',

    /* ===== HE COMES UP FROM BEHIND THE CIGARETTES =========================
       Asked for 2026-08-31: *"can you make them, during the spawn, appear as if
       they were behind the 3 first layers of the level background? right after
       spawn, we make them go back to the first visual draw... The idea is to
       give the effect as if they are leaving from behind the pile of
       cigarettes"* -- and then, in the same breath, *"maybe we don't have to
       hard code it, just make them spawn between some layers randomly"*.

       So a digger is drawn BETWEEN two of the scenery's five bands while he is
       climbing, and rejoins the crowd's own z-sort the instant he is out. Which
       two is rolled per enemy. See `Emerge.pickPlane` and `drawScenery` in
       game.js.

       ⚠️ THE SCENERY IS ONE LAYER IN `LAYERS` AND STILL IS. This does not add a
       second scenery pass to the level's layer list -- it splits the one pass in
       two around the fighters being injected, which is why nothing else in the
       render stack knows about it. A room with no scenery lays out no bands,
       nobody is injected, and the draw is byte-for-byte the old one.

       ⚠️ IT ENDS AT `released`, NOT AT `done`. An enemy still occluded by a mound
       while he is walking and swinging reads as a draw bug, not as depth.

       ⚠️ ROLLBACK IS ONE FLAG. `spawnBehindScenery: false` puts every digger back
       on the ordinary fighter plane and restores the single-pass floor; nothing
       else has to be touched. */
    spawnBehindScenery: true,
    /* HOW MANY PLANES OF THE FLOOR COVER HIM, rolled per enemy between these
       two inclusive. `3` is the number that was asked for before the ask was
       relaxed, and it sits inside this range.

       ⚠️ THE MINIMUM IS 1, NOT 0. At 0 he is in front of the whole floor, which
       is the plane he was already on -- an enemy who rolled it would look like
       the feature had failed for him. The maximum is clamped to however many
       bands the room actually laid out (5 in the desert), so a bigger number
       here is a no-op rather than an error.

       ⚠️ THE MAXIMUM IS 3 AND IT IS THE POP DIAL. The hand-off back to the
       fighters' plane is instant, so whatever is still covering him at the end
       of the climb is revealed in one frame. At 4 and 5 the near bands hide most
       of his body right up to the last frame and the hand-off reads as him
       appearing rather than as him arriving -- rendered and checked: at 4 in
       front, the frame before release shows only his head. 3 is also the number
       that was asked for before the ask was relaxed to a range. Raise it for
       more variety and a bigger pop; they are the same number. */
    minBandsInFront: 1,
    maxBandsInFront: 3,
  },

  /* =========================================================================
     THE DEATH BURST'S OWN FRAME RATE
     =========================================================================
     A DEATH ROW MAY CHANGE PACE PART WAY THROUGH. Every animation in this game
     runs at one rate -- `POSE_MS[pose]` -- and for eight-frame rows of a body
     falling over that is right. ESPETO's row is two different things end to end:
     six frames of him going down at a fighter's pace, then four of an EXPLOSION,
     which is a different kind of event and wants a different clock.

     Reported 2026-08-27: "the big explosion frame is too fast".

     ⚠️ THE PRINCIPLE IS THE FLYING DUNGEON'S FLY, and it was read rather than
     remembered. Its burst is not part of any other animation: `FLY_RECTS[1..4]`
     play on `flyBurstMs` (70), their own number, and every frame is scaled by
     the factor derived from frame 0 -- so because the burst frames are drawn
     BIGGER on the sheet, the explosion visibly expands as it comes apart. The
     second half is already true here for free: espeto's burst tiles are 302px
     against his body's ~180 and the pack scale is one number, so his expands
     too. What was missing was the first half -- the burst having a clock of its
     own.

     `ms` MAY BE ONE NUMBER OR ONE PER FRAME. The fly uses a single rate; a list
     is what lets the BIGGEST frame hold longest, which is the specific thing
     that read as too fast. 200 / 300 / 420 / 320: it opens quick, the widest
     frame sits, and the last scatter goes.

     ⚠️ AND THE CORPSE HAS TO LIVE LONG ENOUGH TO PLAY IT. Slowing the burst took
     his death from 1.30s to 2.02s, well past the 1.32s at which a body is
     reaped -- so he would have been deleted mid-explosion. `Fighter.corpseGone`
     now also waits for the death ANIMATION to finish (frames only, not
     `deathHoldMs`). Nothing else moves: a cigarette's row is 8 x 130 = 1.04s,
     already inside the fade clock.

     ⚠️ `DEATH_BLAST.espeto.atMs` IS NOT AFFECTED. The blast goes off on frame 6,
     which is still 6 x `POSE_MS.death` = 780ms in -- the slowdown starts AT that
     frame, not before it. Change `from` and the blast's `atMs` has to move with
     it. */
  DEATH_BURST: {
    /* ⚠️ x0.7 ON 2026-08-27 -- "accelerate the explosion frames by 30%". It was
       200/300/420/320 (1240ms) and is now 868ms. Still well over the 520ms it
       had before the burst was given a clock of its own, which was the round
       before; the shape is kept and the whole thing plays quicker. */
    espeto: {
      /* ⚠️ `from` IS NOW ONLY A BOUNDARY, NOT A BURST. It still marks where the
         fall ends and the shudder begins -- and, with `hideBurst`, the moment he
         is GONE. Frames 6-9 of his death row (the drawn explosion) are no longer
         reached at all. */
      from: 6,
      /* ⚠️ HE BLOWS UP LIKE THE BOMB NOW, AND HIS OWN EXPLOSION FRAMES ARE OFF.
         Asked for 2026-08-28: *"remove the character explosion frames. Like keep
         the 'when he is going to blow' frames, but the actual explosion frames
         that he has, remove those. Make him blow like the bomb, including
         flashing red."*

         A bomb has no explosion drawings: it flickers, it goes red, and then it
         is simply not there while `boom.js` does the exploding. This is that,
         applied to a fighter. The body disappears and the boom fires on the SAME
         instant -- both hang on `deathFrameStartS(from)` -- so there is no frame
         where a hedgehog and an explosion are both on screen.

         ⚠️ THE FOUR BURST DRAWINGS ARE STILL IN THE PACK and cost nothing; this
         switches off DRAWING them, it does not re-cut anything. Set `hideBurst`
         false and the old death comes straight back, which is why `ms` below is
         kept rather than deleted -- it is the tuning those frames were given
         (the widest one held longest) and re-deriving it from scratch would be
         a day's work for a flag flip. */
      hideBurst: true,
      /* Unused while `hideBurst` is true. See above -- kept as the record of how
         those four frames were paced, not as live config. */
      ms: [140, 210, 294, 224],
      /* ⚠️ THE TREMBLE BEFORE HE GOES -- THE BOMB'S SPUTTER, ON A DEATH ROW.
         Asked for 2026-08-28: *"o ouriço, quando ele vai explodir, tem que
         repetir o frame, como se ele desse uma tremidinha, igual a bomba. Nesse
         momento, ele só passa um frame agonizando e depois ele explode, mas esse
         frame fica muito rápido."*

         The fall's six frames played once at `POSE_MS.death` and he was gone --
         so the moment he is visibly about to blow lasted 130ms. This LOOPS
         frames `from..to` at `ms` for `holdMs`, inserted between the fall and
         the burst, and everything downstream just happens later.

         ⚠️ A RANGE, NOT ONE FRAME, AND THE WORD "repetir o frame" IS A
         DESCRIPTION OF THE EFFECT RATHER THAN THE MECHANISM. Holding a single
         drawing longer reads as the animation STALLING; what makes the bomb read
         as live is that the picture keeps changing while going nowhere -- three
         drawings eight pixels apart on their own fast clock (Prop._frame).
         Espeto's frames 3-5 are the same writhe with the eyes and mouth
         shifting, so looping them IS a tremble with no new art.

         ⚠️ THE FRAMES ARE NOT IN THE DEATH ROW, AND THAT IS WHY `pose` EXISTS.
         The drawings wanted are row 4 sprites 6 and 7 of `espeto-sprites-fim.png`
         -- the hedgehog with its mouth wide open -- which the cutter packed as
         `airPunch` frames 5 and 6 (row 4 IS airPunch: its seven widths match to
         the pixel). They were pointed at by hand; my first guess used death
         frames 3-5, which was wrong. **They are ONLY for the agonising state
         before he blows** -- the fall and the burst are untouched, and nothing
         about `airPunch` as an attack changes.

         ⚠️ SO A DEATH CAN BORROW TWO FRAMES FROM ANOTHER ROW WITHOUT A RE-CUT.
         No new art, no duplicated frames in the pack, and no wire-art rule
         broken (nothing is rescaled -- see the one-scale-per-pack rule). If the
         named pose is missing the tremble falls back to the death row rather
         than drawing nothing. */
      shudder: {
        /* ⚠️ 40ms IS THE BOMB'S PANIC RATE, COPIED ON PURPOSE. Asked for
           2026-08-28: *"make the frequency where the espeto enemy blink red and
           animate, make it the same frequency as the bomb when its about to
           blow"* -- so this is `PROPS.bomb.animPanicMs` and not a number of its
           own. It was 80.

           ⚠️ AND IT IS RIGHT AT THE STROBE WALL, WHICH IS WHERE THE BOMB PUTS IT
           DELIBERATELY. 40ms is 25 drawings a second; the bomb's own note says
           faster than about 40 it stops flickering and starts strobing, and that
           it is worth being at the edge for the last three seconds and nowhere
           else. Espeto's tremble is 800ms, which is well inside that budget.

           ⚠️ `tintMs` FOLLOWS IT BY DEFAULT, so the red re-times with the
           drawing rather than drifting out of step -- one beat lit in three, now
           40ms lit every 120ms exactly like the bomb. */
        pose: 'airPunch', from: 5, to: 6, ms: 40, holdMs: 800,
        /* ⚠️ THE BOMB'S OWN RED, THE SAME FILTER STRING (CONFIG.PROPS.bomb
           .panicTint). Copied deliberately rather than referenced: these are two
           different objects that happen to want the same colour today, and a
           shared constant would tie a hedgehog's death to any future retune of
           the bomb's panic. If they should always match, that is a decision to
           make on purpose, not by aliasing.

           ⚠️ THE BLINK IS ONE BEAT LIT IN THREE, AND THREE IS NOT ARBITRARY.
           The tremble swaps drawing every `ms`, so a two-beat blink would light
           the SAME drawing every cycle -- which reads as "one of his two poses
           is red", not as flashing. At three the red walks across both frames.
           `tintMs` defaults to `ms`, keeping the red on the tremble's beat. */
        tint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +
              'hue-rotate(-8deg) brightness(110%)',
        tintAlpha: 0.85,
      },
    },

    /* CHARUTOBI, AND HE KEEPS HIS DRAWN EXPLOSION -- which is the one place he
       deliberately differs from espeto. Asked for 2026-08-28: *"use the same
       behavior as the espeto has, but keep the frames from the spritesheet, so
       it will be like 2 explosions at the same time."*

       ⚠️ SO `hideBurst` IS ABSENT, AND ABSENT IS THE ANSWER. Espeto's is `true`
       because he was asked to blow up like the bomb -- no drawings of his own,
       just the boom. This one is the state espeto was in the day before that
       change: the sheet's burst plays AND `DEATH_BOOM.charutobi` goes off inside
       it on the same frame. Two explosions, one event.

       ⚠️ `from` IS 7 AND ESPETO's IS 6, AND THE EXTRA FRAME IS THE SWELL. His
       burst is his last FOUR drawings; charutobi's is his last THREE, because
       death frame 6 is him puffing up into a ball of spikes -- still a body,
       still standing on the floor, and the single best drawing in the row to
       tremble on. It must agree with `centreFrom` in the cutter's row table
       (tools/build-beat-enemy-defs.py), which is what anchors those three tiles
       on their own centre instead of on the belt. */
    charutobi: {
      from: 7,
      /* THREE FRAMES, AND THE WIDEST IS THE LAST. Espeto's burst peaks in the
         middle and settles, so his `ms` holds frame 3 of 4; charutobi's expands
         all the way to the end (172 / 215 / 251 drawn px at his current
         `drawScale`), so the hold goes on the final drawing.

         ⚠️ CUT TWICE ON 2026-08-28, AND THE SECOND CUT WAS THE BIGGER ONE.
         [140, 210, 320] (670ms) -> x0.7 -> [98, 147, 224] (469ms) -> *"the last
         3 frames of the explosion are still slow... can you make them even
         faster"* -> [60, 80, 110] (250ms). That is **63% off the original**, and
         it puts the burst at ~83ms a frame, which is the same order as the boom
         playing underneath it (`boomMs` 71) -- so the drawn spines and the real
         explosion now come apart at one rate instead of two.

         ⚠️ THE TAIL-WEIGHTING SURVIVED BOTH CUTS ON PURPOSE. The widest drawing
         still holds longest (110 against 60), because that is what stops a burst
         reading as three equal flashes; at these speeds it is 50ms of difference
         rather than 180, which is as far as the shape can be squeezed before it
         is gone. Below about 200ms total the three drawings stop being legible
         as separate pictures at all -- that is the floor, not a preference.

         ⚠️ NOTHING DOWNSTREAM HAD TO BE CHASED, EITHER TIME: `DEATH_BLAST.atFrame`
         and `corpseGone` both ask `deathFrameStartS`, so they moved by
         themselves -- which is the whole return on those two knobs being
         questions rather than milliseconds.

         ⚠️ THE BOOM DID NOT SPEED UP WITH IT and cannot here. Its rate is
         `CONFIG.boomMs`, which is global and shared with both bosses, so it now
         outlives the drawn spines by ~380ms and finishes as smoke. Espeto's does
         the same thing; it is the established look, not an oversight. */
      ms: [60, 80, 110],
      /* ⚠️ THE SPINES GO WHEN THE ROW ENDS, AND THIS IS THE FIX TO *"the last
         frames are like staying on screen"* (2026-08-28). It was NOT a pacing
         problem: his final burst drawing was measured at **733ms on screen**
         against the 110ms this `ms` array asks for. `_deathFrame` clamps to the
         last frame once the row has played, and `corpseGone` holds the body until
         the BOOM finishes at 2561ms -- so it froze on the widest drawing for the
         601ms difference. See `Fighter.bodyHidden`.

         ⚠️ ESPETO DOES NOT NEED IT because `hideBurst` already takes his body
         away, and no other kind needs it because the corpse FADE takes theirs.
         It is for exactly this shape: a death row that ends in an explosion, a
         fade switched off so the explosion is not dimmed, and a boom that
         outlasts the drawings. ⚠️ SO IT PAIRS WITH `corpseFade: false` -- turning
         the fade back on and leaving this set would hide a body that was already
         being faded, which is harmless but means one of them is doing nothing. */
      hideAfterRow: true,
      /* THE TREMBLE, ON HIS OWN DEATH ROW. Espeto's borrows two drawings from
         `airPunch` because the frames his tremble wanted were not in his death
         row at all; charutobi has no airPunch row -- he has no punches of any
         kind -- and the two drawings this wants ARE in the death row, so there
         is nothing to borrow. `pose` is left off and `_shudderNow` falls back to
         `death`, which is exactly right here rather than a fallback being
         relied on by accident.

         ⚠️ FRAMES 5-6 ARE A PAIR ON PURPOSE. Frame 5 is him upright and
         wide-eyed and frame 6 is the SWELL -- so the loop reads as a body
         pumping up and dropping back, going nowhere, which is what makes the
         bomb read as live (see espeto's note: "repetir o frame" describes the
         effect, not the mechanism). ⚠️ AND IT MUST BE TWO DRAWINGS AND NOT
         THREE: `_shudderTint` lights one beat in three, so a three-frame loop
         would light the SAME drawing every cycle and read as "one of his poses
         is red" instead of as flashing. Two is what lets the red walk.

         `ms` 40 and `holdMs` 800 are espeto's, which are the BOMB's panic rate
         and the length that was tuned against it. Copied, not shared -- same
         reasoning as the tint below. */
      shudder: {
        from: 5, to: 6, ms: 40, holdMs: 800,
        /* The bomb's red, the same filter string, copied for the reason espeto's
           is: two objects that want the same colour today, and aliasing would
           tie this death to a future retune of the bomb's panic. */
        tint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +
              'hue-rotate(-8deg) brightness(110%)',
        tintAlpha: 0.85,
      },
    },
  },

  /* =========================================================================
     A REAL EXPLOSION ON TOP OF THE DRAWN ONE
     =========================================================================
     ⚠️ THE SAME EFFECT THE BOSSES BLOW UP WITH, AND EXACTLY ONE OF THEM. Asked
     for 2026-08-28: *"lets add an explosion to the last frames, at the same time
     the espeto blows up, the other explosion should appear as well, this
     explosion is the same that is used in the bosses, but lets use a single one.
     Try to sync both explosions."*

     `src/boom.js` already owned this -- it was lifted out of horse-boss.js the
     day the Mosca was asked for the same death, precisely so that "how many, how
     far apart, how big" would be config and not code. A third caller costs one
     config block and no new effect code, which is the whole return on that
     earlier refactor.

     ⚠️ KEYED BY `kind`, LIKE DEATH_BURST AND DEATH_BLAST. Anything not named
     here is untouched -- there is no fighter-wide behaviour being switched on.

     ⚠️ `atFrame`, NOT `startMs`, AND THAT IS THE "SYNC" IN THE ASK. The boom is
     hung on the frame the drawn burst BEGINS (death frame 6), read through
     `Fighter.deathFrameStartS` -- the same clock the row is drawn from. Written
     as a raw millisecond it would be right today and wrong the next time the
     fall, the shudder or the burst is retimed. This is the second knob to move
     to `atFrame` after the blast, and for the same reason.

     ⚠️ AND THE CORPSE IS KEPT ALIVE FOR IT. `corpseGone` now waits for the boom
     as well as the death row. At the shipped numbers the boom ends at 2434ms
     against a row ending at 2448 -- a 14ms margin, which is not a margin. The
     third time this feature has had to teach "the body has to live long enough
     to play the thing you just added", after the burst slowdown and the shudder.

     ⚠️ ONE BLAST WANTS `spreadXRel`/`spreadYRel` AT ZERO, and until 2026-08-28
     boom.js read those with `||` -- so zero silently became the seven-blast
     spread. Fixed at the read site; the horse's non-zero values are unchanged
     to the pixel. See the note in boom.js. */
  DEATH_BOOM: {
    espeto: {
      on: true,
      /* ONE, as asked. With `count: 1` the string has no rhythm to it, so
         `everyMs` is unused and the shuffle is a no-op. */
      count: 1,
      /* THE SYNC. Death frame 6 is the first drawn burst frame -- the small red
         starburst -- so the two explosions start on the same frame and read as
         one event. Frame 7 would put it on the widest drawing instead, which is
         where the damage lands (`DEATH_BLAST.atFrame`) but a beat after the
         picture says he has gone. */
      atFrame: 6,
      /* Dead centre on him: no spread, no jitter, one blast over the body. */
      spreadXRel: 0,
      spreadYRel: 0,
      jitterRel: 0,
      /* Up from his feet as a fraction of `refPx` below -- about the middle of
         a body that is roughly 180px tall on screen. */
      baseYRel: 0.5,
      /* ⚠️ WHAT THE SPREAD AND OFFSET ARE MEASURED AGAINST, and it is NOT
         `fighterSizePx` (136.8). That is a nominal body height for the hit
         resolver; espeto is DRAWN about 180px tall, and the blast has to sit on
         the picture rather than on the hitbox. */
      refPx: 180,
      /* Width of the peak frame on screen. ⚠️ 208 IS 260 x 0.8 -- "20% smaller",
         asked for 2026-08-28 after watching it. His own drawn burst peaks at
         302px wide, so the boom now sits well inside it and reads as a flash
         going off INSIDE the sprite's explosion rather than as a second, bigger
         one around it. Pure taste; move it freely. */
      sizePx: 208,
      sizeJitter: 0,
    },

    /* CHARUTOBI's, AND IT HAS TO SIT INSIDE A DRAWN EXPLOSION RATHER THAN
       REPLACE ONE. This is the case espeto was in for exactly one day, and the
       number that came out of watching it then is the number copied here: his
       boom was cut to 80% of its first size *specifically* so it read as a flash
       going off INSIDE the sprite's own burst instead of as a second, bigger
       explosion around it. Same ratio, his art. */
    charutobi: {
      on: true,
      count: 1,
      /* THE SYNC, and it is the same frame `DEATH_BURST.charutobi.from` names --
         the first drawn burst frame. Both explosions therefore start on one
         frame and read as one event, which is the whole of *"it will be like 2
         explosions at the same time"*. ⚠️ IT IS 7 AND ESPETO's IS 6 for the same
         reason `from` is: the swell is a frame of body, not of burst. */
      atFrame: 7,
      spreadXRel: 0,
      spreadYRel: 0,
      jitterRel: 0,
      /* ⚠️ THESE TWO ARE ONE MEASUREMENT AND NOT TWO TASTE CALLS. With `count: 1`
         and no spread, the blast centre lands exactly `baseYRel * refPx` above
         his ground point -- and the point it has to land on is where the cutter
         pinned his own burst: 68.5 drawn px up, the centre of the swell frame,
         which is the height those three tiles expand around (`centreFrom` in
         tools/build-beat-enemy-defs.py). 0.46 x 150 = 69. Move either one and
         the two explosions stop being concentric, which is the thing that makes
         them read as one.
         ⚠️ AND `refPx` IS THE DRAWN FRAME HEIGHT (150), NOT `fighterSizePx`
         (136.8), which is a hit-resolver nominal -- the same trap espeto's
         carries a warning about. */
      baseYRel: 0.46,
      refPx: 115,
      /* 193 IS 77% OF HIS WIDEST DRAWN BURST FRAME (251 px on screen), which is
         the ratio espeto's 208 has against his 271. Pure taste, inherited rather
         than re-judged; move it freely, and move it if the two explosions ever
         stop reading as one. ⚠️ IT FOLLOWED `drawScale` DOWN 15% on 2026-08-28 --
         left at 252 the boom would have grown from 77% of his burst to 90% and
         swallowed it, and the same again at the second shrink. */
      sizePx: 193,
      sizeJitter: 0,
    },
  },

  /* =========================================================================
     THE DEATH BLAST
     =========================================================================
     A HIT THAT COMES OUT OF A CORPSE. Asked for 2026-08-27 -- "when he dies,
     that explosion gives damage" -- and ESPETO is the only thing in the game
     that has one, because he is the only thing that ends by exploding.

     ⚠️ IT IS THE ONE ATTACK NOBODY DECIDES TO THROW. Every other blow in the
     game is a fighter choosing to swing; this one is armed by the DEATH
     ANIMATION reaching the frame where the spines fly, and it goes off whether
     the player is there or not. That makes it the first move in this game that
     is a CONSEQUENCE rather than an intention -- and it changes how the room is
     played: killing an espeto at arm's length now costs you, and killing him
     from outside the burst is a thing worth learning.

     ⚠️ `radial: true` IS NOT DECORATION. Every other hitbox in the game extends
     FORWARD from the fighter only (see Fighter._attackGeom, and the reason: a
     punch that reached behind would let a player clear a crowd by standing in
     it). An explosion that only went the way the corpse happened to be facing
     would be the one hitbox in the game a player could beat by standing behind
     it, which is exactly the wrong lesson.

     `atMs` IS READ OFF THE ART. His death row is 10 frames at `POSE_MS.death`
     130ms; frames 0-5 are the fall and frames 6-9 are the burst, so the spines
     start flying at 6 x 130 = 780ms. Move the frame the burst begins on and this
     moves with it.

     ⚠️ IT KNOCKS DOWN, WHICH IS A DESIGN CHOICE AND NOT AN OBVIOUS ONE. Nothing
     a mook throws floors the player except the barata's charge. An explosion
     that merely stings would be a tax; one that puts you down is a thing you
     step away from, which is the whole point of giving a corpse a hitbox.
     `knockdown: false` makes it a tax again.

     ⚠️ AND IT HITS THE PLAYER ONLY. `combat.crowdHits` is what resolves it and
     it only ever tests the player, so an espeto bursting in a crowd does not
     scratch the espeto beside him. Friendly fire would be new code in the
     resolver, not a number here. */
  DEATH_BLAST: {
    espeto: {
      /* ⚠️ `atFrame`, NOT `atMs`, AND THE OLD 920 WAS *TECHNICALLY* CORRECT.
         It was 6 x `POSE_MS.death` + 140 = the start of frame 7, hand-computed
         and right at the time. It was also silently wrong the instant anything
         before frame 7 changed duration -- and the shudder added on 2026-08-28
         is exactly that change: it pushes the explosion 800ms later, so a fixed
         920 would have detonated him while he was still trembling, with the
         damage arriving a whole second before the picture.

         ⚠️ THE RULE THIS REPLACES IS "when the burst REACHES you", and frame 7
         is still where that is. Frame 6 is a tight starburst barely wider than
         the body -- a hit landing on it reads as damage arriving BEFORE the
         explosion, which is how this was reported the first time: *"the hit is
         hitting too early, before the explosion even starts"*. Frames 7 and 8
         are the two widest drawings and the 300ms window spans them.

         ⚠️ SO THE FRAME IS THE DESIGN DECISION AND THE MILLISECOND IS AN
         IMPLEMENTATION DETAIL. `Fighter.deathFrameStartS` walks the same clock
         the row is drawn from, so this now moves by itself whenever the shudder
         or the burst pacing is retuned. `atMs` still works for anything that
         genuinely wants a raw time. */
      /* ⚠️ THE DAMAGE MOVED ONTO THE BOOM WHEN HIS OWN BURST WAS SWITCHED OFF.
         The rule has not changed -- "when the explosion REACHES you" -- but the
         explosion is now the boom rather than a drawing of his, and death frame
         7 is no longer painted at all. `atBoomPeak` asks for the WIDEST frame of
         the explosion sheet (index 4 of 12, +284ms), so re-cutting that art
         moves the hit with it instead of stranding a hand-computed offset.
         Set `hideBurst` false and this wants to go back to `atFrame: 7`. */
      atBoomPeak: true,
      activeMs: 300,      // live across frames 7 and 8, the two widest
      damage: 8,
      /* 208 x BODY_SCALE = 150 drawn px, which is HALF the widest burst frame
         (302 atlas px at his pack scale). Measured off the art like his reaches
         -- the box is the picture. */
      reachX: 187 * BODY_SCALE,
      reachZ: 63 * BODY_SCALE,
      knockback: 240,
      knockdown: true,
      radial: true,
    },

    /* CHARUTOBI's, AND FOR HIM IT IS NOT A CONSEQUENCE -- IT IS THE MOVE. Espeto
       has a blast because he happens to end by exploding; this enemy exists in
       order to. So the same block does a different job, and the numbers are the
       ones that job wants: bigger box, more damage, and the same knockdown.

       ⚠️ IT IS THE ONLY DAMAGE HE CAN DO. There is no `ENEMY_COMBOS.charutobi`
       and his `enemyDamage` entry is deliberately absent -- see the note there.
       If he ever feels harmless, this is the block, not a punch that does not
       exist. */
    charutobi: {
      /* ⚠️ `atFrame`, AND IT IS 8 RATHER THAN espeto's `atBoomPeak`. His moved
         onto the boom the day his own burst frames were switched off, and his
         note says in as many words: *"set `hideBurst` false and this wants to go
         back to `atFrame`."* Charutobi never had them switched off, so the rule
         is served by the drawing again -- and the rule has not changed: the hit
         lands WHEN THE EXPLOSION REACHES YOU. Frame 7 is the first burst frame
         and barely wider than the swell it comes out of; a hit on it reads as
         damage arriving before the explosion, which is how this was reported the
         first time on espeto. Frames 8 and 9 are the two widest drawings and the
         window spans them. */
      atFrame: 8,
      /* ⚠️ 200, DOWN FROM 300, AND IT FOLLOWED THE BURST RATHER THAN BEING
         RETUNED. The window is documented as "frames 8 and 9, the two widest
         drawings" and those two now last 190ms between them; left at 300 it
         would have gone on being live for a beat after the explosion had
         finished drawing -- a hitbox outliving its own picture, which is the
         thing `atFrame` exists to prevent at the other end. A faster explosion
         has a shorter dangerous moment; that is the trade the speed-up buys the
         player, and it is deliberate rather than a side effect. */
      activeMs: 200,
      /* 12 AGAINST ESPETO's 8, AND THE 50% IS THE WHOLE CHARACTER. His blast is
         a parting shot from a fighter who was already beaten; being caught by
         this one means a bomb ran the length of the arena at you and you did
         nothing about it. It still does not kill outright from full health
         (playerHealth 110). */
      damage: 12,
      /* MEASURED OFF THE ART, exactly as espeto's is: the box is HALF the widest
         burst frame, which is 251 drawn px for him against espeto's 271. So
         174 x BODY_SCALE = 125 drawn px, and `reachZ` keeps his 0.337 ratio of
         it. ⚠️ THESE ARE ONLY TRUE AT `CHARACTERS.charutobi.drawScale` 0.6885 --
         they were 228/77 at 0.9 and followed him down through both shrinks on
         2026-08-28. Change that number again and both follow it, which is the
         discipline espeto's file-length note exists to enforce. */
      reachX: 174 * BODY_SCALE,
      reachZ: 59 * BODY_SCALE,
      knockback: 280,
      knockdown: true,
      /* Radial for espeto's reason: an explosion you could beat by standing
         behind it is the wrong lesson, and here it would be a worse one -- he
         runs at you from either side. */
      radial: true,
    },
  },

  enemyComboWeights: {
    cigarro:  [4, 3, 3],
    /* FIVE ENTRIES, BECAUSE HIS STRING HAS FIVE HITS -- `_rollChain` reads
       `min(weights.length, combo.length)`, so a fourth and fifth weight left off
       would silently cap him at three and two of his ten drawings would never
       be seen in play.

       ⚠️ WEIGHTED HARD TOWARD THE SHORT ONE, harder than anyone else's, and the
       length is why. At flat weights a five-hit string is a fighter who pins you
       to a wall and empties a magazine; at these he averages 2.2 hits, throws a
       single jab 5 times in 12, and reaches the finisher 1 time in 12. That last
       one is the point of having it -- rare enough to stay a surprise, common
       enough to be learned, the same bargain DEDÉ's third hit makes. */
    espeto:   [5, 3, 2, 1, 1],
    // The stub leans SHORTER. His hits cost more and commit him for longer, so
    // a full string from him is a bigger promise than the white one's -- at the
    // same weights he would be reliably worth more than his 40 HP is meant to
    // buy, and the fights he opens would swing on whether he happened to roll
    // three.
    cigarro2: [5, 3, 2],
    /* THE HEAVY ONE LEANS SHORTEST -- the stub's reasoning, one step further.
       His hits are the most expensive in the game (6 + 6 + 10 against the
       stub's 4 + 4 + 7) and he commits longest to throwing them, so a full
       string from him is the biggest promise any mook makes. He is on the
       stub's weights rather than something lower because a third hit nobody
       ever sees is not a fight, it is dead config -- 2 in 10 is rare enough to
       stay a surprise and common enough to be learned.

       ⚠️ WITHOUT AN ENTRY HERE HE THROWS EXACTLY ONE HIT, FOREVER. `Enemy`
       rolls the length off this table and returns 1 when the kind is missing
       (see `_rollCombo`), so a new enemy with a perfectly good three-hit string
       in ENEMY_COMBOS silently never uses it. Nothing errors, nothing warns,
       and it reads in play as "that one does not have a combo". Adding a kind
       means adding it in BOTH places. */
    cigarro3: [5, 3, 2],
    /* THE ROACHES LEAN LONG, and they are the only ones that do. A cigarette's
       single jab is a threat because it MIGHT be the start of a string; the
       roach's whole identity is that he is already on the second one. Weighted
       toward three, his ordinary attack is a flurry and the charge is what
       breaks the rhythm. */
    barata:  [2, 3, 5],
    barata2: [3, 3, 4],
  },
  /* =========================================================================
     THE BARATA CHARGE
     =========================================================================
     He curls into a ball, rolls at the player, and LEAVES THE SCREEN -- he does
     not stop, does not turn, and is gone. A few beats later he walks back in
     from the side he vanished off.

     WHY IT IS BUILT AS AN EXIT RATHER THAN A DASH. A charge that stops next to
     the player is just a fast approach with a hitbox on it, and it puts him
     right back where a punch can reach -- which makes the biggest move in his
     repertoire the safest thing he can do. Running him off the screen costs him
     his place in the fight: the crowd is one shorter for as long as he is gone,
     he re-enters at walking pace from the far side, and the player has bought
     several seconds by stepping out of the lane. That is the trade the move is
     for, and it is why `chargeReturnMs` matters as much as the damage.

     IT IS DODGED IN Z, NOT IN X. The direction is latched on the tell and never
     corrected, exactly like the cigarettes' jump-in, so the answer to it is to
     step out of the lane -- not to outrun it, which nothing can. `chargeReachZ`
     is therefore the real difficulty dial: widen it and the move becomes
     unavoidable rather than merely fast.

     ⚠️ THE TELL IS THE WHOLE MOVE. `chargeCurlMs` is how long he sits in the
     one curled drawing before he goes. Shorten it and the charge stops being a
     thing the player answers and becomes a thing that happens to them. It is
     deliberately longer than any wind-up in the game. */
  BARATA_CHARGE: {
    // Per TURN, not per frame -- same rule as enemyLeapChance, and the same
    // trap if it is ever read anywhere else.
    /* CUT 30% ON REQUEST, from 0.22 / 0.16. The move costs him his place in
       the fight for a second and a half, so it was already the most expensive
       thing he can do; at the old rate the roaches spent too much of the fight
       off-screen rolling back in. It is a RATE OF SURPRISE, not a difficulty
       dial -- the same warning the jump-in carries. */
    chance:      { barata: 0.154, barata2: 0.112 },
    /* THE TELL, held on the curled drawing -- frame 0 of the `ball` row, shown
       for the whole of the attack's startup phase (see the ball branch in
       Fighter.frame()). HALVED FROM 520 ON REQUEST: it sat on that one drawing
       long enough to read as a stall rather than a wind-up.

       ⚠️ IT IS ALSO THE PLAYER'S REACTION WINDOW, by construction -- the tuck
       and the harmless startup are the same thing, so they cannot drift apart.
       Cutting it in half cut the time to step out of the lane in half with it.
       260ms is about 16 frames, which still reads; do not take it much lower
       without deciding that the charge is meant to be unfair. */
    curlMs:      260,
    speed:       3.4,        // x walk speed. Nothing outruns it; step aside.
    damage:      { barata: 12, barata2: 15 },
    reachX:      74 * BODY_SCALE,
    reachZ:      44 * BODY_SCALE,
    knockback:   420,
    knockdown:   true,       // it bowls the player over, which is the point
    // How far past the arena wall he must get before he counts as gone.
    exitMarginPx: 180,
    // Off-screen, out of the fight. Then he walks back in from that same side.
    returnMs:    { barata: 1500, barata2: 2100 },
    /* THE BAND HE WILL CHARGE FROM, like the leap's. Too close and there is no
       room for the tell to be read; too far and he is committing to a lane the
       player left several seconds ago. */
    minX:        150,
    maxX:        620,
  },

  /* =========================================================================
     THE SUICIDE RUN
     =========================================================================
     CHARUTOBI's ENTIRE MOVESET, and the shortest block of behaviour in this
     file. Asked for 2026-08-28: *"this enemy will be an explosive suicide enemy,
     that doesn't hit you with punches, it just blows when it gets near you. it
     comes running in the player's direction."*

     ⚠️ THERE IS NO ATTACK HERE, AND THAT IS THE STRUCTURE RATHER THAN AN
     OMISSION. Every other move in this file is an attack def -- startup, active,
     recover, a reach and a damage -- because every other move is a fighter
     deciding to swing. This one is a fighter deciding to STOP EXISTING: he runs
     until he is near, and then he dies. The damage is `DEATH_BLAST.charutobi`,
     which comes out of the corpse on the death clock, so a charutobi the player
     KILLS explodes exactly like one who arrives. That is the trade the whole
     enemy is: you can stop him reaching you, you cannot stop him going off.

     ⚠️ KEYED BY `kind`, LIKE DEATH_BURST / DEATH_BOOM / DEATH_BLAST. Anything not
     named here is null in `Enemy` and can never take the branch -- no test for
     the kind exists anywhere in enemy.js, which is the same bargain
     BARATA_CHARGE makes.

     ⚠️ HE IS OUTSIDE THE ATTACK TOKEN. See `ignoresToken` in enemy.js: he
     neither holds one nor counts against `maxAttackers`, because he has no swing
     to release it and a token handed to him would stall the crowd. THE PRICE OF
     THAT IS THAT TWO CHARUTOBIS BOTH RUN AT ONCE, which is a swarm and is
     deliberate -- but it is also why the placements below put ONE in a room. */
  SUICIDE_RUSH: {
    charutobi: {
      /* × `walkSpeedX`, ABSOLUTE, not scaled by `enemySpeedScale` -- the same
         arrangement `BARATA_CHARGE.speed` has, and for the same reason: a run
         that inherited the mook walk multiplier would be one knob hiding behind
         another.

         ⚠️ 1.25 IS 375px/s AGAINST THE PLAYER'S 300, AND THE GAP IS THE DESIGN.
         Faster, so walking away does not work and he is a thing that must be
         dealt with; only 25% faster, so the room to deal with him is real. The
         roach's roll is 3.4 because it crosses the screen and leaves; this is a
         chase and it has to stay one. */
      /* ⚠️ 1.7 (510px/s) SINCE 2026-08-28 -- *"make charutobi run faster"*. It
         was 1.25, which was chosen to leave room to deal with him and read as a
         jog rather than a run. At 1.7 he is 70% quicker than the player, so
         stepping away no longer buys any distance at all and the answer is
         entirely "kill him or get out of the blast". His 30 HP is what keeps
         that answerable; move THAT before moving this again. */
      speed: 1.7,
      /* HOW NEAR IS NEAR. A proximity test between the two GROUND POINTS, so it
         owes nothing to reach, facing or the target's half-width -- unlike every
         actual attack in this game (see the note on `enemyReachX`). He goes off
         from any side.

         ⚠️ 24 / 34 SINCE 2026-08-28, DOWN FROM 80 / 46, AND THE OLD NUMBERS WERE
         THE BUG: *"when he throws himself into the player, make him really throw
         himself in the position the player is, right now he is kinda stopping in
         front of the player."* He was already SEEKING the player's own spot --
         the stopping was entirely this trigger firing a body-width out (80
         against a half-width of 26.6), so he detonated at arm's length and read
         as braking.

         24 is inside the two half-widths added together (53), so the sprites
         genuinely overlap when he goes: he is ON the player, not in front of
         them. 34 across the belt is a shade over one body depth (`bodyZ` 21.6)
         and stays LOOSER than x on purpose -- depth is the axis a player dodges
         in, and a z trigger as tight as the x one would let a circling player
         hold him at a hair's distance forever without ever setting him off. */
      triggerX: 24,
      triggerZ: 34,
    },
  },

  // Enemies spawn by WALKING IN from the nearest side of the screen rather
  // than appearing — a fighter that materialises in front of the player reads
  // as a bug even when it is the design.
  enemyEnterMs: 500,

  /* =========================================================================
     THE FLIES -- background vermin
     =========================================================================
     Added 2026-08-23, on request: "traga as moscas do flying_dungeon". They are
     STILL LIFE's fly, the small one -- the same sheet its swarm is drawn from,
     read IN PLACE out of that game's folder like the Mosca Boss above and the
     explosion below. NARUTAO was already here; this is the rest of the family.

     ⚠️ THEY ARE SCENERY, NOT ENEMIES. Nothing about them touches the fight:
     no health, no hitbox, no hurt window, no death, no z, no shadow, no entry
     in the crowd and no entry in `stats`. That is the whole reason this is 200
     lines rather than the flying dungeon's 430 -- everything that file carries
     is there to be SHOT (health, i-frames, knockback, a burst, a corpse that
     lands on a pile) or to be REWOUND (the leg memory, the death snapshot), and
     a beat 'em up has neither gun nor clock. What was worth keeping is the
     steering, which is what makes a fly look like a fly.

     ⚠️ AND THEY FLY WHERE THE PLAYER CANNOT GO, which is the point of the
     request: the band ABOVE the belt. `beltTopY` (520) is the far edge of the
     walkable strip, so anything drawn above it is in the part of the shot the
     fight never reaches. `bottomY` is kept well clear of that line rather than
     sat on it -- a fly grazing the back wall reads as one that is about to join
     in, and they must never look like they can be punched.

     ⚠️ RIGHT TO LEFT, ALWAYS. `vx` is re-rolled on every heading change and is
     negative every time, so the wander never carries one backwards; the
     vertical dart is what makes the path erratic. A fly that crosses the left
     edge is RECYCLED to just past the right one with a fresh height, so they
     are a procession across the shot rather than a loop of the same path. They live in WORLD x at parallax 1.0 -- the same space the
     fighters and the plate use -- so they stay put in the street while the
     camera travels, instead of being glued to the viewport.

     ⚠️ THE STREET ONLY. It is `flies: true` on the ROOM (see ROOMS) rather than
     a room name tested here, for the same reason props belong to the room:
     asked for explicitly -- the boss room is indoors and a fly wandering
     through the last fight would be one more thing to read on a screen that
     already has a horse on it. */
  FLIES: {
    /* The feature switch, like PROPS.barrel.on. `false` and the sheet is not
       even loaded -- manifest.js gates on this -- so turning them off costs
       nothing at runtime and nothing in the download. */
    on: true,
    /* STILL LIFE's fly sheet, and only ITS FIRST RECT. That sheet is five
       frames -- one live fly and four of it coming apart -- and the burst is
       unreachable here because nothing can kill one. The other four rects are
       deliberately not copied in: they would be dead data pointing at art no
       code path can select. */
    SHEET: 'v2:flying-dungeon/enemy-sheets/saborosa-mosca.png',
    RECT: [20, 98, 168, 181],
    /* ⚠️ THIS IS A POPULATION, NOT A SPAWN RATE, and the difference is the
       whole reason the first number was wrong. There are ALWAYS exactly this
       many flies in the band: one that crosses the left edge is recycled to the
       right one on the same frame, so nothing ever thins out and no gap ever
       opens. `count` is therefore literally "how many flies can be seen at
       once", and 3 read as an infestation.

       TWO, ASKED FOR ON 2026-08-23 after seeing three in play -- "use 2 as a
       reference number for my request".

       ⚠️ IF TWO IS STILL TOO MANY, THIS IS THE WRONG KNOB TO KEEP TURNING. At
       1 the sky is empty for most of a crossing and then has a fly in it, which
       reads as a bug rather than as sparseness. Making it genuinely INFREQUENT
       means a fly waiting off-camera before it re-enters -- a gap between
       crossings, which is a frequency -- and that does not exist yet. Ask for
       it rather than dropping this to 1.

       They are spread ACROSS the view when a room starts rather than released
       together from the right edge -- flies entering in file looks like a
       spawn, flies already in the air looks like a place that has flies in
       it. */
    count: 2,
    /* AND HOW MANY CROSS THE OTHER WAY, left to right. Asked for on 2026-08-24:
       one, on top of the two. Same population rule, same band, same steering --
       flies.js negates every x term and draws them h-flipped, nothing else.

       ⚠️ THIS IS THE KNOB THAT MAKES THE SKY READ AS TRAFFIC RATHER THAN AS A
       CONVEYOR. Two flies going one way is a procession and the eye learns it
       in about four seconds; one going against them is what stops it being a
       loop. That is also why it is 1 and not 2 -- an equal split reads as a
       pattern again, just a symmetrical one.

       ⚠️ IT TAKES THE TOTAL TO THREE, which is the number that was tried on
       2026-08-23 and cut back to two for being an infestation. That finding was
       about three flies going the SAME WAY, all crossing the same line at the
       same angle; this is a different picture and was asked for after it. If it
       does read as too busy in play, drop THIS to 0 before touching `count` --
       the two-leftward baseline is the one that has been approved. */
    countRight: 1,
    /* Drawn height in canvas px, before the per-fly jitter. The source frame is
       181px tall, so this band is about 1:5.5 down to 1:4.7 -- small enough to
       read as something up near the rooftops rather than as an enemy that has
       not arrived yet.

       ⚠️ THESE TWO NUMBERS ARE A RANGE WRITTEN AS A CENTRE, and the range is
       what was asked for: 39 +/- 12% is 34px to 44px. Read them together or
       neither makes sense on its own.

       ⚠️ THE HISTORY IS THE SPEC, because the request was made in terms of it.
       It was 30 +/- 28% -- 22px to 38px -- which the user read in play as three
       sizes: a small, a medium and a big. Twice on 2026-08-24:

         1. "all the same size as the small one" -> 22 flat, jitter 0.
         2. "actually medium, keep medium and big, no fly small" -> 34 +/- 12%,
            which is the TOP HALF of the original roll: its midpoint (30) to its
            maximum (38), with the bottom 8px gone.
         3. "the flies can be slightly larger" -> the whole band up ~15% to
            34..44px, keeping the width. This one WAS `sizePx` alone, because
            the ask was about the average and not the floor.

       So the variety is back and the small one is not. The two asks tuned
       different axes: (2) was the FLOOR -- how small the smallest may be, which
       needs both numbers solved as a min/max -- and (3) was the CENTRE, which
       `sizePx` moves on its own. Work out which one is being asked for before
       reaching for a knob.

       Size is the only depth cue they have (there is no z up there and no
       parallax to separate them from the plate), which is the argument the
       jitter was originally there to serve. ⚠️ It is not a reliable one: at the
       old floor the big ones read as flies that had come CLOSER rather than as
       flies further away, which is the cue landing backwards. A narrower band
       high up is what survived that. */
    sizePx: 39,
    sizeJitter: 0.12,        // +/- this fraction, rolled once per fly -> 34..44px
    /* THE BAND, in SCREEN y. Both are above `beltTopY` (520) -- see the warning
       above -- and `topY` is off the top edge by enough that a fly at the
       ceiling is still whole. */
    topY: 64,
    bottomY: 404,
    /* Speed, in world px/sec. Slower than the flying dungeon's 200: there the
       fly is a target closing on the player, here it is something crossing the
       sky behind a fight, and at 200 the three of them shot past like debris.
       Each leg rolls 0.55..1.45 of this. */
    speed: 118,
    vSpeed: 165,             // vertical dart speed -- what makes it erratic
    retargetMin: 0.22,       // s -- shortest hold before a new heading
    retargetMax: 0.85,       // s -- longest
    wobbleAmp: 4,            // px -- the fast micro-buzz on top of the wander
    wobbleFreq: 13,          // rad/sec
    maxTilt: 15,             // deg -- bank at full vertical speed
    tiltEase: 9,             // how fast the bank eases toward the heading (1/s)
    /* How far past each screen edge a fly lives before it is recycled. Wide
       enough that the swap always happens off-camera; a fly popping in at the
       edge of frame is the one way this effect can look cheap. */
    marginPx: 140,
    alpha: 0.92,             // a touch back, so they sit INTO the plate
  },

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
  /* NARUTÃO, named by the user 2026-08-21. The Mosca is the only member of the
     cast with no CONFIG.CHARACTERS entry -- it is a FlyBoss with two raw sheets,
     not a ragged pack -- so its name has nowhere else to live.

     ⚠️ THE BOSS NAMEPLATE IS WHAT READS IT, as of 2026-08-27 -- `FlyBoss` takes
     it into `this.name` in its constructor and `hud.drawBoss` prints it under
     her bar. That is the thing this was recorded in advance FOR, and it is now
     the only reader: the CLEAR board's roll-call went in the same pass (see
     Stats.rows), and it walked CHARACTERS and could never have seen her anyway.

     ⚠️ DO NOT "TIDY" THIS INTO A CHARACTERS ENTRY to make the two bosses
     symmetric. That table is the PACK table -- sheets, scale, cut -- and an
     entry here would put her in front of everything that walks the cast. */
  MOSCA_NAME: 'NARUTÃO',
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
  /* Drawn height of the Mosca, in canvas px. 230 originally, then 10% to 253,
     now 20% on top of that. It is also the boss's size in the SIMULATION --
     `halfW()` and `bodyHeight()` are both derived from it -- so a bigger boss
     is a bigger target and a bigger threat together, which is the pairing
     `fighterSizePx` deliberately keeps for the fighters too.

     THAT PAIRING IS WHY THIS ONE CARRIES NO WARNING and the cigarettes'
     drawScale does: growing it moves the hurtbox with the picture, so nothing
     comes apart. It is easier to hit and it reaches further, both by 20%.

     What it does change is the ARENA. At 304 it is well over twice a fighter's
     137px and takes up correspondingly more of the belt it sweeps along, so the
     ground pass is harder to stand clear of than when that attack was tuned. */
  /* --- The Mosca's death ---------------------------------------------------
     IT BLOWS UP RATHER THAN FALLING, asked for on 2026-08-22 in the same breath
     as the horse's. Same machinery (boom.js), same sheet, its own numbers.

     ⚠️ FEWER AND SMALLER THAN THE HORSE'S, deliberately. It dies IN THE AIR,
     where there is no floor to hide the bottom of a blast and nothing else in
     the frame to measure against, so seven full-size explosions around a fly
     read as a screen-filling mess rather than as a fly coming apart. Five at
     170 sit inside its own silhouette.

     ⚠️ AND `on: false` GIVES BACK THE OLD DEATH INTACT -- the tumble out of the
     sky and the slow fade where it lands. Nothing was deleted for this. */
  flyBossDeathBoom: {
    on: true,
    count: 5,
    startMs: 0,
    everyMs: 165,
    spreadXRel: 0.45,
    spreadYRel: 0.6,
    sizePx: 170,
    sizeJitter: 0.3,
    /* How long the fly itself takes to go. Shorter than the string, so it is
       gone before the last blasts fire and they read as wreckage. */
    fadeMs: 560,
  },

  /* ===== THE HORSE BOSS ======================================================
     The final boss, and the last fight in the game. Five rows of art and no
     hurt/knockdown/death among them -- see CHARACTERS.horse.

     WHAT THE MOVESET IS, AND WHY IT IS THIS. The rows ARE the design: the
     illustrator drew a run-attack, a trot, a walk, a kick and a turn, so the
     fight is a big animal that closes the distance and then either runs you
     down or kicks you. Nothing here invents a move the art cannot show.

       walk   arriving, and drifting between passes
       trot   closing on the player -- the pressure beat
       run    the CHARGE: he crosses the room and anything in the lane goes down
       kick   the close-range answer, for when the player is already on him
       turn   played whenever he changes which way he faces, because he is a
              horse and cannot simply mirror on the spot the way a fighter does

     ⚠️ THE TURN IS A REAL COST, NOT A FLOURISH. Every other character in the
     game flips instantly -- one negative x-scale. This one plays seven frames
     to come about, and that window is the fight's main opening: get behind him
     and you have `turnMs` to hit something that cannot answer. Shortening it
     makes him strictly harder in a way no other number here does.

     HE TELEGRAPHS THE CHARGE BY STOPPING. `chargeTellMs` is spent standing
     still in the run row's first frame, facing the player. That is the only
     warning, and it is the same bargain the barata's curl makes -- the tell and
     the harmless window are the same thing, so they cannot drift apart. */
  HORSE_BOSS: {
    /* Drawn body height. The pack already scales to this through
       CHARACTERS.horse.drawScale; this is the number the SIMULATION uses --
       hurtbox width and height both come off it -- so the picture and the
       target grow together, the same pairing flyBossSizePx keeps.

       304, then x1.05 with the drawing on 2026-08-23. */
    sizePx: 319,
    /* 150 against the Mosca's 88. A full five-hit combo is 28 damage, so this
       is a little over five clean combos -- long enough to be the last fight,
       short enough that a player who never learns the turn opening can still
       finish it. ⚠️ JUDGE IT WITH CONFIG.DEV.on FALSE: at 50 damage a punch he
       dies in three combos and the fight cannot be read at all. */
    health: 150,
    hurtMs: 150,           // i-frames, same as the Mosca. Never optional.
    /* NO GROUND SHADOW. Asked for on 2026-08-22 and it is the only character in
       the game without one -- see the note in HorseBoss's constructor for why
       he can afford to lose it and the fighters cannot. `true` puts it back. */
    shadow: false,
    /* Hurtbox, as fractions of sizePx. WIDER THAN A FIGHTER'S because he is a
       horse seen side-on -- he is longer than he is tall, and a box built on
       height alone would leave his hindquarters unhittable. */
    hitWRel: 0.86,
    hitZ: 52,
    knockback: 30,         // barely shoved; he outweighs everything in the game

    // --- Arriving ------------------------------------------------------------
    /* He WALKS in from the right, and cannot be hurt until he has arrived --
       Still Life's rule, the same one the Mosca's entrance follows. */
    enterMargin: 240,      // px beyond the view edge he starts from
    /* 880px of walk-in at this speed is about 3.4s -- a beat long enough to
       read as an arrival, short enough not to be dead air. He is created off
       the right edge (enterMargin past it) and walks to mid-screen. */
    enterSpeed: 260,

    // --- Choosing what to do -------------------------------------------------
    /* ⚠️ HE PICKS A MOVE AND THEN MAKES IT POSSIBLE. This used to be decided by
       distance alone -- kick inside 210, charge outside 320 after trotting for
       1500ms -- and the charge almost never happened. The reason is arithmetic
       rather than luck: he trots TOWARD the player at 200px/s, so by the time
       the 1500ms was up he had closed 300px, and to still be beyond 320 he had
       to have started more than 620px away. Anywhere nearer and he hit kick
       range first. The signature move of the final boss fired maybe once a
       fight, and it read as broken because it nearly was.

       So the intent is ROLLED FIRST, from these weights, and the positioning
       serves it: pick the charge from too close and he turns, backs off to get
       a run-up, and turns again -- which is more telegraph, not less, and uses
       animations that already exist.

       DISTANCE DECIDES WHAT IS IN THE HAT; THE ROLL DECIDES BETWEEN THEM. Far
       out he can charge or simply walk you down; up close he can kick or keep
       repositioning. Distance gating the charge is right -- a run-up needs room
       -- and the mistake the first version made was letting distance pick the
       move OUTRIGHT, so his own approach kept talking him out of it.

       ⚠️ `approach` IS WHY THIS IS THREE ACTIONS AND NOT TWO. With only charge
       and kick, every moment at range became a charge and the fight was one
       move on repeat. Approach is him just closing the distance like any other
       enemy, committing to nothing, and it is what makes the charge read as a
       decision rather than as a tic.

       These are relative weights inside each band, not percentages of the
       fight. `kick` and `approach` are flat; `charge` is NOT -- see below. */
    ACTIONS: { charge: 60, kick: 50, approach: 50 },
    /* ⚠️ THE CHARGE'S WEIGHT SCALES WITH DISTANCE, AND A FLAT WEIGHT GOT THIS
       BACKWARDS. Past `chargeMinRange` the odds used to be the same at 250px as
       at 900px, so how far away the player stood barely changed how often he
       ran at them -- and once the cooldown was taken into account a RETREATING
       player actually saw fewer charges than one moving around normally, which
       is exactly wrong for the move. It is the long-range answer; it should get
       likelier the further away you are.

       So the weight ramps: `chargeNearWeight` of full at the threshold, rising
       to full at `chargeFarRange`. At the defaults that is half the odds at
       240px and double them out past 600 -- which is the relationship the
       distance gate was only ever pretending to express. */
    chargeNearWeight: 0.35,
    chargeFarRange: 600,
    /* ⚠️ AND THE COOLDOWN RELAXES WITH DISTANCE, for the same reason the weight
       rises. The cooldown exists to stop every walk-up ending in a charge at
       MEDIUM range; out where the charge is the obvious answer it was fighting
       the distance ramp instead -- he would charge, and then the next few
       decisions, also taken from far away, were all blocked. The bucket rates
       came out flat and a retreating player still saw no more charges than a
       nearby one.

       At `chargeFarRange` and beyond only this fraction of the cooldown is
       applied, so a player who keeps running gets run at. */
    chargeCooldownFarScale: 0.2,
    /* ⚠️ A CHARGE CANNOT FOLLOW A CHARGE, OR VERY NEARLY ONE. For this long
       after a pass ends, the charge is out of the hat and the aggressive option
       is the kick instead -- so he has to walk in and do something else before
       he can run at you again.

       This exists because of how it read in play, not how it read in a table.
       The weights were already only asking for half his rolls at range, but at
       range the kick is rarely reachable, so the actual sequence came out
       walk > CHARGE > walk > CHARGE > walk > CHARGE. Every walk-up terminated
       in a charge, which turns the walk into a wind-up: the player stops
       reading it as movement and starts reading it as a tell. Forcing another
       action in between is what makes the walk mean nothing again, which is the
       whole point of having it. */
    chargeCooldownMs: 2400,
    /* WHERE AN APPROACH SETTLES -- A RANGE, ROLLED PER APPROACH, NOT ONE
       DISTANCE.

       ⚠️ THIS IS WHY IT IS TWO NUMBERS. It was a single 300, which is above
       `chargeMinRange` (240) -- so EVERY approach parked him at exactly charge
       distance and the roll that followed had the charge in it every time. The
       result read as one fixed pattern: walk at you for a moment, then charge,
       over and over. The approach had stopped being a behaviour and become the
       wind-up for the charge.

       Straddling `chargeMinRange` instead means where he ends up is genuinely
       uncertain: settle short and the next roll is kick-or-approach, settle
       long and it is charge-or-approach. That is what makes the walk-up read as
       him working his way in rather than as a tell. Keep `chargeMinRange`
       BETWEEN these two. */
    approachStopMin: 165,
    approachStopMax: 340,
    /* ⚠️ AN APPROACH MUST ACTUALLY TRAVEL. The standoff distance is rolled, so
       it can easily land within a few px of where he is already standing -- the
       approach then ends on its first frame and he immediately rolls another
       one. That is not visible as a bug; it just quietly turns two thirds of the
       fight into a horse shuffling on the spot. Measured before this: 67% of
       his actions were approaches, against a weight that asks for half. If
       neither standoff spot is at least this far away, he takes the further
       one. */
    approachMinTravel: 95,
    approachMs: 1800,
    /* A fuse on closing for a kick, so a player who keeps running cannot lead
       him around the room forever without him committing to anything. */
    approachMaxMs: 2400,

    // --- The rhythm ----------------------------------------------------------
    walkSpeed: 92,
    trotSpeed: 200,
    idleMs: 620,           // the breath between passes, stood in the turn row
    /* DEAD KNOB, kept only so its absence is not mistaken for an oversight:
       nothing reads it any more. It used to be how long he trotted before he
       was allowed to charge, which is exactly the gate that made the charge
       unreachable. `approachMaxMs` is the live equivalent. Delete it whenever
       config.js next gets a tidy. */
    // trotMs: 1500,
    /* How close he has to be, in x, before the kick becomes the choice instead
       of the charge. Inside this he has no room to build a run. */
    kickRange: 210,
    /* ⚠️ "SLIGHTLY AWAY", AND THAT IS MUCH NEARER THAN IT SOUNDS. He may only
       roll a charge from beyond this. It was 320 and the charge starved: he
       settles at 210-300 after any approach or kick, so the condition was
       almost never true and the move fired once every 27 seconds at best.

       IT HAS TO SIT INSIDE THE `approachStop` BAND (165..340). Above it and no
       approach ever leaves him far enough to charge, and the move starves --
       which has now happened twice, in two different ways. Below it and every
       approach leaves him able to charge, which is the lockstep that band
       exists to break. */
    chargeMinRange: 240,

    // --- The charge ----------------------------------------------------------
    chargeTellMs: 420,     // stood still, facing you. The only warning.
    chargeSpeed: 520,      // faster than the player runs. Step out of the lane.
    chargeMaxMs: 2200,     // a fuse, for the case where he cannot reach the edge
    chargeDamage: 16,
    /* ⚠️ MEASURED OFF THE DRAWING, NOT PICKED. Every reach in this file has to
       be checked against the frame it belongs to -- no cigarette's second or
       third punch has ever connected, because those numbers were written by
       eye. The run row reaches 202px in front of the ground anchor, so the
       chest arrives about there; 168 kept the box just inside the picture, so
       a charge that looks like it went through you did.

       ⚠️ x1.3 WITH THE DRAWING ON 2026-08-22 (168 -> 218), THEN x1.05 ON
       2026-08-23 (218 -> 229). The measurement is of the PICTURE, so when the
       picture grows this has to grow with it or the box would stop where his
       chest used to be. The 202 above is likewise now 276 on screen. */
    chargeReachX: 229,
    chargeReachZ: 52,
    chargeKnockback: 480,
    chargeKnockdown: true, // it bowls you over, which is the whole point
    /* px past the wall he runs before he is considered to have finished the
       pass and turns around. He commits to the run; he does not brake. */
    chargeOverrun: 90,

    // --- The kick ------------------------------------------------------------
    /* THE KICK IS THROWN BACKWARDS. `coice` is a horse kicking with its hind
       legs, so it lands BEHIND him -- which is why it is the answer to a player
       who has walked round the back, and why its hitbox is on the opposite side
       to every other attack in the game. Getting this the normal way round
       makes the animation and the damage disagree. */
    kickTellMs: 260,
    kickActiveMs: 180,
    kickRecoverMs: 420,
    kickDamage: 14,
    /* ⚠️ 260, NOT THE 132 THIS WAS FIRST WRITTEN AS. The hooves reach 300px
       BEHIND the ground anchor in kick[6] and kick[7] -- measured -- so a
       132px box put the damage barely past his own hindquarters while the
       drawing threw legs most of a body-length further. That is the exact
       failure the cigarettes' strings still have; it was caught here only
       because the frame extents were printed before the number was chosen.
       Kept a little inside 300 so the box never leads the picture.

       IT ALSO HAS TO CLEAR `kickRange` (210) -- the distance at which he
       chooses to kick. A reach shorter than the range he commits from is an
       attack that can never land, which is the rule in STATE.md.

       ⚠️ x1.3 WITH THE DRAWING ON 2026-08-22 (260 -> 338), THEN x1.05 ON
       2026-08-23 (338 -> 355), for the same reason as chargeReachX: the 300px
       measurement it was cut from is 409px now. The ranges he DECIDES from
       (`kickRange`, `chargeMinRange`) were deliberately left where they are --
       they are about the fight's spacing, not about the drawing -- so the
       practical effect is that a kick he commits to now lands more reliably.
       That is a bigger animal doing what a bigger animal does, but it IS a
       difficulty change and it was not separately asked for. */
    kickReachX: 355,
    kickReachZ: 50,
    kickKnockback: 420,
    kickKnockdown: true,

    // --- Turning -------------------------------------------------------------
    turnMs: 460,           // seven frames of coming about. See the warning above.

    // --- Animation -----------------------------------------------------------
    /* Per-frame holds, ms. The run is fastest because it is a gallop; the walk
       is slow because a walking horse is slow, and both rows are 12 frames of
       one full cycle, so these numbers are the gait. */
    runMs: 52,
    trotAnimMs: 62,
    walkAnimMs: 84,
    kickAnimMs: 62,

    // --- Dying ---------------------------------------------------------------
    /* NO DEATH ROW, so the death is drawn rather than animated. He used to TIP
       OVER and fade -- what the Mosca does, for the same reason -- and since
       2026-08-22 HE BLOWS UP INSTEAD, on request. `finished()` still waits for
       the whole of it, so the level cannot advance out from under his last beat
       -- the bug that hung a corpse in mid-air through the outro. */
    /* ⚠️ 2000, NOT THE 1700 THE TIP-OVER USED. The blasts are the death now and
       they have to finish INSIDE this: the last one starts at
       startMs + (count-1) x everyMs = 1080ms and runs for 12 x boomMs = 852ms
       more, so the string is over at 1932. `finished()` waits for this number,
       and the level advancing before it would cut a blast off mid-frame -- the
       same failure that once hung a corpse in mid-air through the outro.
       RE-CHECK THAT SUM if count, everyMs or startMs ever move. */
    dieMs: 2000,
    /* How far over he goes before he is gone. ⚠️ DEAD WHILE `DEATH_BOOM.on` IS
       TRUE, and kept rather than deleted: the tip is the fallback death and it
       is one flag away. A body that tips over WHILE exploding reads as two
       different deaths playing at once, which is what trying both looked
       like. */
    dieTipRad: 1.15,
    /* --- Going up ----------------------------------------------------------
       A STRING OF EXPLOSIONS ACROSS HIM, not one. The request was "multiple
       explosions when the horse boss dies, instead of him falling dead", and
       the plural is the effect: one blast in the middle of an animal this size
       reads as a hit, several walking across him over a second reads as the
       thing coming apart.

       ⚠️ THE ART IS STILL LIFE'S EXPLOSION, READ IN PLACE out of that game's
       folder like the game over frames and the death sting. See BOOM_RECTS at
       the bottom of this file for what is on the sheet and why it must not be
       re-cut by island detection.

       ⚠️ THE PATTERN IS ROLLED ONCE, AT THE MOMENT HE DIES, and stored. Rolling
       it per frame would give a different scatter sixty times a second, which
       is not an explosion, it is static -- the same lesson the impact bursts
       learned (see hit-fx.js). */
    DEATH_BOOM: {
      on: true,
      count: 7,
      /* When the first one goes off and how far apart the rest are, in ms. The
         last STARTS at startMs + (count-1) x everyMs = 1080 and then runs for
         another 852 (twelve frames at boomMs), so the string ends at 1932 --
         ⚠️ which is what `dieMs` 2000 is sized for. Raise either of these and
         raise dieMs with them, or the level will advance while a blast is
         still on screen. */
      startMs: 0,
      everyMs: 180,
      /* Where they land, as fractions of his drawn size: x across his body from
         his ground point, y up from his feet. He is drawn side-on and longer
         than he is tall, so the spread is wider than it is high. */
      spreadXRel: 0.55,
      spreadYRel: 0.75,
      /* Width of the PEAK frame on screen, in px, before the per-blast jitter
         below. 210 against a 304px-tall horse: each one covers a good third of
         him, so seven of them cover him several times over. */
      sizePx: 210,
      sizeJitter: 0.3,     // +/- this fraction, per blast
      /* How long he takes to go, in ms. SHORTER THAN THE BLASTS RUN FOR, on
         purpose: he is gone before the last ones fire, so they read as the
         wreckage still going up rather than as fireworks over a body that is
         somehow still standing there. */
      fadeMs: 620,
    },
  },

  flyBossSizePx: 304,
  /* A MULTIPLE OF 22 (= BAR_FRAMES − 1), like the player's, so its bar steps
     evenly: 110 is exactly 5 damage a square.

     RAISED FROM 88 ON 2026-08-27, asked for as "+20%". 20% of 88 is 105.6,
     which is not a multiple of 22 and would make a square 4.8 damage -- so
     identical hits would sometimes move the bar and sometimes not. 110 is the
     multiple on the other side of it and was chosen deliberately over the exact
     figure; the rule above is worth more than five points of percentage.

     ⚠️ IT IS NOT THE WHOLE ENCOUNTER ANY MORE. The Mosca is fought TWICE (see
     ROOMS -> street), breaks off at half a bar the first time and comes back
     whole, so this number is what the player spends 1.5 times over. Read it
     against the pair, not against one fight. */
  flyBossHealth: 110,
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

  /* --- BREAKING OFF ---------------------------------------------------------
     The Mosca does not fight to the death the first time. The threshold itself
     is NOT here: it is `fleeAt` on the boss SEGMENT, because it is a property
     of the encounter and the same boss has two of them -- see ROOMS -> street.
     These are only the shape of the exit.

     IT HAS TO BE WATCHABLE. The whole value of a boss that leaves is the beat
     where the player sees it go, so it climbs out of reach in view and exits by
     the SIDE rather than punching straight up through the top of the canvas.
     `flyBossFleeY` is therefore above the tell (210) and well under the height
     it descends from (620). */
  flyBossFleeY: 330,         // altitude it breaks off to -- out of reach, in shot
  flyBossFleeSpeed: 620,     // top speed of the exit: quicker than a hover drift
  flyBossFleeAccelMs: 400,   // ...ramped into, so it reads as turning tail
  /* THE FUSE ON THE WHOLE THING, and it is what stops an escape from becoming a
     level that never advances. `finished()` normally waits for it to clear the
     arena edge; this is the answer to every way that can fail to happen. */
  flyBossFleeMaxMs: 4000,

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
  /* THE NAMEPLATE UNDER A BOSS'S BAR, added 2026-08-27. Both bosses have had
     names since 2026-08-21 and nothing drew either of them; this is what uses
     them. Centred under a centred bar, in the same colour and the same relative
     size as the player's own name under his.

     ⚠️ THESE TWO ARE THE BOSS BAR'S, NOT THE PLAYER'S. The player's name is
     hard-coded to `hudSize * 0.62` and a 4px gap in hud.drawPlayer; these exist
     because a boss's plate is the one the fight is named after and is the one
     worth being able to tune. Both are read with a fallback, so deleting either
     line puts it back to the player's numbers. */
  bossNameSizeRel: 0.62,  // x hudSize (26) -> ~16px
  bossNameGap: 4,         // px below the bar

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

  /* --- The title screen ----------------------------------------------------
     The first thing the game shows: a photograph of a wall, and then the name
     over it. Any button starts the fight.

     ⚠️ IT USED TO BE THE FLYING DUNGEON'S CRAWLING VERMIN PANEL with the
     SABOROSA logo laid on it, read in place out of that game's folder. Both are
     gone from this screen -- replaced 2026-08-21 by one photograph and hand-set
     type. If the logo is wanted back it is a draw call, not a rebuild; the file
     is still `v2:flying-dungeon/saborosa-logo.webp`.

     THE PLATE IS A PHOTOGRAPH AND SO IS THE LEVEL. That is the whole reason it
     works: the backdrop of the street is filmed footage, so a title screen made
     of a photo of the same kind of wall reads as the same place rather than as
     a menu bolted to the front.

     ⚠️ IT IS 4:3 AND THE CANVAS IS 16:9, so it is drawn COVER -- scaled to fill
     and centre-cropped top and bottom. About an eighth is lost off each; the
     wall/ground line still lands around two thirds down, which is what leaves
     the pale upper wall clear for the type. Do not switch it to `contain`
     unless you want pillarboxing.

     LOADED AS `big`, so it is decoded and downscaled to `bigTextureCap` (2400)
     off the main thread. The file on disk is already 2400 wide for exactly that
     reason -- see tools/shrink-master.py. It arrived at 4000x3000 and 6.6MB. */
  title: true,           // false = straight into the fight
  TITLE_BG: 'v2:beatemup-dungeon/intro-background.jpg',

  /* THE NAME, AND HOW IT ARRIVES: IT FALLS IN FROM ABOVE THE SCREEN, AT ONCE.
     ⚠️ THIS REPLACED A TWO-SECOND HOLD, deliberately and on request
     (2026-08-22). The screen used to open on the bare photograph and let it be
     a photograph for two full seconds before the name faded up, on the argument
     that a picture given time reads as a place rather than as a background.
     That argument was heard and overruled: the title now enters on frame one.
     If anyone ever wants the old screen back, `titleDropAtMs` 2000 with
     `titleDropMs` 0 and `titleNameFadeMs` 320 is roughly it.

     THE DROP IS EASED OUT, so it arrives rather than stops -- a linear fall
     hitting its mark dead is the difference between a title landing and a title
     being teleported. It falls from clear of the top edge, so nothing is ever
     seen half-drawn at the top of the frame. */
  titleDropAtMs: 0,      // when the fall starts. 0 = the first frame
  /* How long the fall takes. ⚠️ IT READS FASTER THAN THIS NUMBER LOOKS, because
     with the bounce on the fall ACCELERATES -- most of a screen height is
     covered in the last third of it. 620 was the first value and was called too
     fast on sight; raise this rather than flattening the easing, which is what
     marries the fall to the bounce. */
  titleDropMs: 900,      // how long the fall takes
  /* THE LANDING BOUNCE, asked for as "a little bit of juice, no exaggeration".
     The block overshoots down, springs back, and settles -- a damped sine, one
     and a half cycles over `titleBounceMs`, `titleBouncePx` at its deepest.

     ⚠️ TURNING IT ON CHANGES THE FALL ITSELF, and that is the point. With a
     bounce the fall ACCELERATES (it is falling); without one it decelerates
     into place. A fall that eases to a stop and THEN bounces reads as two
     unrelated moves played back to back -- the type has already arrived, and
     then something shakes it. Set `titleBouncePx` to 0 and the old eased-out
     landing comes back with it.

     12px against a 74px name is about a sixth of a line: visible as weight, not
     as a wobble. Past ~25 it starts to read as comedy. */
  titleBouncePx: 12,
  titleBounceMs: 460,
  titleBounceCycles: 1.5,   // 1 = one dip and back. 2+ starts to jiggle
  /* Where it falls FROM, as a fraction of canvas height above its resting
     place. 1 = a full screen height up, which clears the top edge by a wide
     margin whatever the type is set at. */
  titleDropFromRel: 1.0,
  titleNameFadeMs: 0,    // the drop IS the entrance; 0 = no fade over it

  /* Two lines, and the weights are the point: the Portuguese name is the title
     and the English is a gloss under it, so one is bold and large and the other
     is not. Kept as data because the name is not settled -- BATIDAO DE COCO is
     what the user calls it, and the parenthetical is a translation for a jam
     audience that will not read Portuguese. */
  TITLE_NAME: 'BATIDÃO DE CÔCO',
  /* THE ENGLISH GLOSS, IN CAPS AND WITH THE "BIG" BACK IN, on request
     2026-08-22. It was `(Coconut Bash)`; the Portuguese is BATIDÃO -- the
     augmentative -- and dropping it lost the joke rather than translating it.
     Capitalised to sit under a line that is all caps. */
  TITLE_SUBNAME: '(BIG COCONUT BASH)',
  /* ⚠️ THE FLYING DUNGEON'S LETTERING FONT, COPIED STACK FOR STACK from its
     `overTitle.family` -- the face its TIME OVER / THE END panels are set in.
     Requested so the two games' type matches.

     THE HEAVIEST FUTURA CUTS COME FIRST and the geometric stand-ins follow.
     FUTURA IS NOT BUNDLED, in either game, so most machines fall straight
     through to Century Gothic / URW Gothic / Jost -- that is a known open
     problem over there and it is inherited wholesale here. If it is ever fixed,
     it has to be fixed in both.

     ⚠️ IT IS DUPLICATED RATHER THAN IMPORTED, and that is the house pattern:
     each game's config.js is self-contained, the way the two sound pipelines
     and the two cutters are. Do not make this game read the other's config --
     but do change both when the face changes. */
  TITLE_FONT: '"Futura Extra Bold","Futura ExtraBold","Futura Std Extra Bold",'
            + '"Futura PT Extra Bold","Futura Bold","Futura","Futura PT",'
            + '"Futura Std","Century Gothic","URW Gothic","Jost",sans-serif',
  /* 900 for the name and 400 for the gloss -- the weight difference IS the
     hierarchy, and it is what "batidao de coco should be bold" asked for. */
  titleNameWeight: 900,
  titleSubWeight: 400,
  /* Letter spacing and the faux-bold stroke, both % of the font size, both
     lifted from the flying dungeon's block. The stroke exists because the
     fallback faces are lighter than the Futura cut the design assumes; without
     it the same words come out visibly thinner on a machine with no Futura. */
  titleNameLsPct: 3,
  titleFauxBoldPct: 1.5,
  titleNameSize: 74,     // px on the 1280x720 canvas
  titleSubSize: 30,
  titleNameGap: 20,      // px between the two lines
  /* Higher than centre on purpose: the wall is palest in its upper third and
     browner below, so the block sits where BOTH lines have something clean to
     read against. Moved up from 0.30, where the gloss landed in a stain. */
  titleNameY: 0.26,      // centre of the block, as a fraction of canvas height
  /* THE FLYING DUNGEON'S YELLOW, the exact value its end panels are set in
     (`overTitle.color`, CMYK 2/2/81/0) -- requested so the two games' lettering
     matches in colour as well as in face.

     NO DROP SHADOW AND NOTHING DARKENED UNDER IT -- the house rule for every
     title screen in this project, and it is not up for a tasteful gradient. If
     the type needs more separation, move it to a cleaner part of the wall or
     lean on `titleFauxBoldPct`, the way that game's white ending does. */
  titleNameColor: '#FAFA30',
  titleFadeOutMs: 600,   // to black, once dismissed

  /* =========================================================================
     THE HAND-LETTERED FRONT END (2026-09-01)
     =========================================================================
     One sheet carrying every word the game shows outside a fight, delivered as
     seven numbered jobs: *"first 2 rows, batidao de coco and (big coconut bash)
     right at the beginning of the game, instead of using the generated
     lettering, use the hand drawn ones... this 3 next rows should appear in the
     start of the game: Começar, opções and Saborosa... add the row Escolha seu
     coco... add Lebrons and IPANEIMA below the characters at the character
     select screen... instead of X0, x1, x2, for the lives, use the coconut
     drawing line... 6 lines with names of the heros and the enemies, all these
     lines are to appear under their health bars... use that in case the player
     clicks that menu... if the player clicks SABOROSA in the starting menu,
     that is the credits.*

     Cut by `tools/build-letter-pack.py`; drawn by `src/letters.js`.

     ⚠️ THERE IS ONE SIZE KNOB FOR THE WHOLE PACK AND IT IS `titleWRel`. Every
     frame is drawn at the ratio that makes the TITLE span that much of the
     canvas -- so the artist's own hierarchy (title 1363px in the pack against a
     fighter name at 124) is what reaches the screen. A `wRel` per element would
     be eleven numbers to keep in proportion by hand, and the first one nudged
     would break a relationship the artist had already settled. Everything below
     is POSITION, not size. See letters.js.

     ⚠️ AND EVERY TYPED PATH IS STILL THERE UNDERNEATH. Each screen falls back
     to the Futura it used to set if the pack is missing -- a failed download
     costs the lettering's look, not the ability to start the game. */
  LETTERS: {
    SHEET: 'v2:beatemup-dungeon/batidao-letters',
    /* THE ONE SCALE. The title spans this much of the canvas width; everything
       else follows from it. */
    titleWRel: 0.72,
    /* THE TITLE SCREEN. Two lines of name, then the three menu items under
       them. Fractions of the canvas.

       ⚠️ THE MENU SITS LOW BECAUSE THE WALL IS BROWN THERE AND THE TYPE IS
       YELLOW. Same reasoning `titleNameY` already carries for the name: the
       photograph decides where words can go. */
    /* ⚠️ MEASURED, NOT GUESSED, AND THE FIRST GUESS OVERLAPPED. The title is
       drawn 922x161 and the gloss 588x74, so at 0.20/0.31 the two boxes shared
       38px of screen -- a picture has a HEIGHT, where the two lines of type
       these replaced were stacked by a font size and a gap. Preview, measure,
       then set. */
    titleYRel: 0.17,
    subtitleYRel: 0.35,
    /* ⚠️ 0.68, AND IT TOOK TWO GOES. At 0.55 COMEÇAR's box ended 7px from the
       gloss's; at 0.60 it still read as one stack with the name -- *"the
       começar, opções, and saborosa rows are too close to the title, bring them
       down"* (2026-09-01). The menu has to be separable from the title at a
       glance or the player cannot tell which of them is the thing to answer,
       and the gap that does that is bigger than the one that merely stops them
       touching. */
    menuYRel: 0.68,      // the middle of the three items
    /* THE MENU IS DRAWN 10% SMALLER THAN THE PACK'S ONE SCALE, asked for in the
       same breath as bringing it down: *"reduce their size by 10%"*. The two
       changes are one note -- a menu further from the title and smaller than it
       is a menu that reads as subordinate to the name rather than as a fourth
       line of it.

       ⚠️ IT MULTIPLIES `selectedMul` RATHER THAN COMPETING WITH IT. The
       highlighted item is 0.90 x 1.10 = 0.99 of the pack scale, so it is still
       10% bigger THAN ITS NEIGHBOURS, which is the only comparison the player
       makes. Reading 0.99 as "the highlight is gone" is the mistake to avoid
       here: the bump is relative, and it was never relative to the title. */
    menuMul: 0.90,
    /* THE MENU HAS NO TIMING OF ITS OWN, AND THAT IS DELIBERATE. It slides up
       from under the frame while the name drops into it, bounces the way the
       name bounces, and lands on the same frame -- all of it off `titleDropMs`,
       `titleDropFromRel`, `titleBouncePx` and `titleBounceMs`, which are the
       NAME's numbers. Three asks on 2026-09-01 walked it here: slide instead of
       fade, then bounce like the title, then *"make the 3 options come at the
       same time, like syncronized with the title."*

       ⚠️ IT HAD A `menuRiseMs` AND IT IS GONE. Setting it equal to `titleDropMs`
       would have looked synchronised until somebody retuned one of them; sharing
       the expression is the only version that cannot drift. If the menu ever
       genuinely needs its own pace, that is a new knob AND a note saying the two
       are deliberately apart.

       ⚠️ THE ONLY DIFFERENCE IS THE SIGN -- the travel is added rather than
       subtracted and the bounce is negated, because a thing overshoots past its
       rest in the direction it was moving and these arrive from the other edge.

       ⚠️ AND IT NO LONGER FADES AT ALL. A slide that also fades reads as a fade
       with some drift in it. `menuFadeMs` still fades the OPTIONS and CREDITS
       screens, which arrive rather than move. */
    /* THE TINY PUNCH ON AN ITEM THAT IS CHOSEN. Asked for: *"when the other
       menus are selected, they should have a tiny punch... all should have a
       tiny punch."* Same curve as the select screen's confirm stamp
       (`SELECT.PUNCH`), a fraction of its weight -- 0.10 against 0.25.

       ⚠️ THE CURVE IS COPIED AND ONLY THE AMOUNT CHANGES, which is what keeps
       the two reading as one interface: this gesture says "you took this one"
       at the weight of a menu, that one says it at the weight of a fighter.
       Two different easings would be two languages for one idea.

       ⚠️ IT FIRES ON THE CHOICE, NOT ON THE CURSOR. It stamped on every
       highlight move first and that was wrong: *"the punch is for when you click
       the option, not for when you place the cursor on top of it."* A punch
       answers a COMMITMENT; spent on every nudge of the d-pad it both cheapens
       itself and leaves the actual choice with no feedback of its own. What a
       cursor move gets is `selectedMul` -- a state, and a state does not need an
       animation to announce it. On the options screen "clicking" is setting a
       meter, so left/right stamps and up/down does not.

       ⚠️ IT MULTIPLIES ON TOP OF `selectedMul` and settles back to it, so the
       pop is a MOVE rather than a second way of being selected. */
    itemPop: 0.10,
    itemPopMs: 260,
    /* HOW LONG THE CHOSEN ITEM HOLDS BEFORE THE SCREEN ACTS ON IT.

       ⚠️ WITHOUT THIS THE PUNCH DOES NOT EXIST. Confirming COMEÇAR moves the
       screen on, so an item stamped and dismissed in the same frame is a pop
       nobody ever sees -- the beat is not decoration, it is the only reason the
       stamp is visible. 300 against `itemPopMs` 260, so the pop has settled by a
       hair before anything moves; the select screen buys the same beat with
       `SELECT.chosenHoldMs` and its note gives the same reasoning. */
    menuHoldMs: 300,
    menuGapRel: 0.11,    // between item centres, as a fraction of canvas height
    /* THE SELECTED ITEM IS 10% BIGGER. Asked for: *"when one option is
       selected, make it slightly bigger, like 10% bigger, so the player know
       that is selected."*

       ⚠️ SIZE IS THE WHOLE HIGHLIGHT -- there is no colour change, no marker and
       no box, because the art is one colour and a second colour would be a
       decision the artist did not make. 1.10 is small enough to read as the
       same word and large enough to be unambiguous next to its neighbours. */
    selectedMul: 1.10,
    menuFadeMs: 320,     // the items coming up once the name has landed
    /* THE SELECT SCREEN. `ESCOLHA SEU COCO` replaces the typed prompt, and the
       two names sit under the coconuts they belong to. `nameXRel` is measured
       from the canvas centre, so the pair is symmetrical by construction. */
    chooseYRel: 0.11,
    /* ⚠️ 0.117 IS WHERE THE COCONUTS ACTUALLY ARE, taken off the art rather
       than off the canvas: the left figure's ink is centred at 0.271 of the
       select sheet and the right at 0.714, which at `SELECT.artHRel` 0.64 puts
       them 155px and 145px either side of the middle. Half the picture's width
       would have put the names in the gap between the two.

       ⚠️ AND THEN PUSHED OUT TO 0.14, WHICH IS *NOT* UNDER THE COCONUTS' EXACT
       CENTRES, because at 0.117 the two words were 25px apart and read as one
       long word -- LEBRONIPANEIMA. `LEBRON` is 249px wide and `IPANEIMA` 299
       against 300px between the figures, so there is no setting that both
       centres them and separates them. 0.14 buys an 85px gap for a 25-35px
       offset, and the offset is invisible while the collision was not.

       ⚠️ AND 0.16 AFTER A LOOK AT IT: *"the lebron and ipaneima names are too
       close to each other, push them a little further apart"* (2026-09-01).
       85px of gap stopped them TOUCHING and still read as one line of text --
       the same lesson the title menu taught an hour earlier, that the gap which
       separates two things is much bigger than the gap that stops them
       overlapping. 0.16 makes it 136px, for an offset from the coconuts of
       50-60px, which is still the cheap half of the trade. */
    pickNameXRel: 0.16,
    /* ⚠️ 0.792 IS 0.90 MOVED BY THE SAME 78px THE PICTURE MOVED. It is not a
       taste decision: the row is a caption, so it travels with what it captions.
       If the coconuts move again, this moves with them. */
    pickNameYRel: 0.792,
    /* THE HUD. The lives row hangs under the player's bar and the fighter names
       under whichever bar names them. Both are offsets in PIXELS from the
       footprint the bar hands back, not fractions -- the bar is a fixed-size
       drawing and these have to sit on it. */
    hudNameGap: 6,
    lifeGap: 4,          // between coconuts
    /* THE LIVES, TRIMMED UNDER THE PACK'S ONE SCALE. Asked for 2026-09-01:
       *"the coconut drawing that represent each life is too big, make it 20%
       smaller."* 0.80.

       ⚠️ THIS IS THE ESCAPE HATCH, NOT A SECOND SIZE SYSTEM. `titleWRel` still
       sets the whole pack and everything keeps the artist's proportions against
       everything else; `lifeMul` and `menuMul` are the two places an element was
       asked to sit differently, and each one is a multiplier ON that scale rather
       than a size of its own. The moment a third or fourth appears, the question
       to ask is whether `titleWRel` is wrong -- not to add another. */
    lifeMul: 0.80,
    /* ⚠️ `lifeRowGap` IS GONE. It spaced a second row under the name, and the
       lives are not a second row: they sit at the RIGHT END of the bar on the
       name's own line, where the old `x2` readout was. Corrected 2026-09-01. */
    /* THE OPTIONS SCREEN. A heading and two meters, over the same photograph.
       ⚠️ THE METERS ARE THE ARTIST'S BARS, NOT A DRAWN RECTANGLE. Each row was
       lettered with eight bars and the cutter recorded where each one ends, so
       a level of n is that row drawn to the n-th bar's right edge -- the bars
       are spaced the way they were DRAWN. See letters.js `cutFor`. */
    optTitleYRel: 0.22,
    optRowYRel: 0.50,
    /* ⚠️ 0.115, DOWN FROM 0.17: *"at the opções menu, the rows are too distant
       from each other, bring them closer"* (2026-09-01). 0.17 put 122px between
       the two centres for rows only ~60px tall -- 60px of empty wall between
       them, which reads as two unrelated things rather than as a list. This is
       the title menu's own spacing (`menuGapRel` 0.11 against items of about
       the same height), and the two menus should not disagree about what a list
       looks like. */
    optRowGapRel: 0.115,
    /* THE CREDITS. `SABOROSA` over `é Gabriel Góes e Christian Miranda`. */
    credTitleYRel: 0.32,
    credNamesYRel: 0.58,
  },

  /* THE OPTIONS THE OPTIONS SCREEN SETS -------------------------------------
     Two levels, 0..8, because the artist drew eight bars. They are the game's
     own volumes expressed in bars: `sfxVolume` and `musicVolume` are what the
     sound engine reads, and these say how many bars that is.

     ⚠️ THEY START FULL RATHER THAN AT THE ENGINE'S CURRENT NUMBER. A meter that
     opens at 5/8 because 0.55 happens to be the music default would look like a
     setting somebody chose. */
  OPTIONS: {
    bars: 8,
    volume: 8,          // SFX, in bars
    music: 8,           // the music bus, in bars
  },

  /* --- LEBRON crosses the title screen -------------------------------------
     Once the name has landed he walks in from the left and off the right, and
     that is the whole of it: no stop, no pose, nothing to press. Asked for on
     2026-08-22.

     ⚠️ HE IS DRAWN THE WAY THE ENDING DRAWS HIM, out of the same packs, by the
     same two numbers and a frame clock -- NOT by ticking a `Player`. A Player
     is a belt entity with depth, a camera, gates, an attack machine and a life
     total, and none of that exists on a photograph. See the header of
     ending.js, which makes the same choice for the same reason.

     ⚠️ AND AT `scale` 1.0, WHICH IS EXACTLY HIS SIZE IN THE FIGHT. Same rule
     the ending screen keeps and for the same reason: a character who changes
     size between screens stops reading as the same character. If he needs to
     be bigger in the frame, that is a crop of the photograph, not a scale on
     the actor. */
  titleWalk: true,
  /* When he sets off, in ms AFTER THE NAME HAS FINISHED FALLING -- not after
     the screen opened. Retiming the drop therefore moves him with it, and the
     beat between the two stays the beat it was tuned to. */
  /* ⚠️ THE WALK NOW WAITS FOR A PRESS, so this is no longer "when he sets off"
     -- it is the EARLIEST he may. Changed 2026-08-24: the name lands, the
     screen waits, a press sends him across, and the game begins by itself once
     he is gone. A press made DURING the drop is remembered and spent here, so
     he never walks out from under falling type; a press after the name has
     landed sets him off at once, because this test is already true. */
  titleWalkAfterMs: 250,
  titleWalkStartXRel: -0.12,   // off the left edge, so he walks ON
  titleWalkEndXRel: 1.12,      // and keeps going until he is clear of the right
  /* WHERE HE COUNTS AS GONE, and the fade to the fight begins. He keeps walking
     to `titleWalkEndXRel` UNDERNEATH it, which is what that number has always
     been for.

     ⚠️ IT IS NOT THE SAME NUMBER, AND THE GAP IS THE POINT. 1.12 is 154px past
     the edge on a 1280 canvas -- three times more than his half-width needs --
     which as a WAIT would be three quarters of a second of a still title
     screen with nobody on it. As over-travel under a fade it costs nothing. */
  titleWalkExitXRel: 1.06,
  titleWalkSpeed: 210,         // px/s -- the ending's, so the two walks match
  /* HIS FEET, down the canvas -- and it is DERIVED, not chosen. Asked for
     2026-08-24: "na intro o coco passa um pouquinho mais pra cima no y (ou z):
     ele deve estar alinhado com a posição y que o coco está quando começa o
     jogo de fato". In the fight his feet are at `beltTopY + beltDepth *
     playerStartZRel` = 520 + 114 = 634, and this screen had him at 0.93 of the
     canvas = 670: thirty-six pixels too low.

     ⚠️ WRITTEN AS THE ARITHMETIC RATHER THAN AS 0.8806, so moving the belt or
     the spawn depth carries the title screen with it. A literal here would be
     correct today and silently wrong the first time `beltTopY` moved -- and the
     whole point of the request is that these two agree.

     ⚠️ THE SCALE ALREADY MATCHED AND WAS LEFT ALONE. `beltFarScale` is 1.0, so
     a fighter is drawn the same size at every depth and `titleWalkScale` 1.0 is
     already his in-game size. If perspective is ever turned on, that number
     stops being right and has to be derived too. */
  titleWalkGroundYRel: (BELT_TOP_Y + BELT_DEPTH * PLAYER_START_ZREL) / CANVAS_H,
  titleWalkScale: 1.0,
  /* Gap before he crosses AGAIN, in ms. 0 = he crosses once and the screen is
     still after that, which is what was asked for. Set it to a couple of
     seconds if a title left sitting for minutes ever wants to keep moving --
     the crossing itself takes about seven seconds at these numbers. */
  /* ⚠️ DEAD SINCE 2026-08-24 AND KEPT AT 0. It was the gap before he came round
     again on a screen that waited for a press; now the FIRST crossing ends the
     screen, so a second one can never be reached. Above 0 it would also make
     `_walker` wrap the clock the exit test reads. Left in place because the
     drawing side still honours it and it is one line to revive if the title
     ever stops being a walk-and-go. */
  titleWalkRepeatMs: 0,

  /* =========================================================================
     THE FRUIT SELECT (2026-08-31)
     =========================================================================
     Asked for on 2026-08-31, and the sequence was described exactly: *"the
     letters of the name of the game go up back, leave the screen, then new
     letters go down, written 'ESCOLHA SUA FRUTA', and the 3 images are used,
     one image has no one selected, and the two others represent each coconut
     selected. After selecting the coconut, the selectd coconut appears walking
     on screen like it used to do before."*

     ⚠️ IT IS PART OF THE TITLE SCREEN, NOT A SCREEN OF ITS OWN, and that is not
     an implementation shortcut -- it is what was described. There is no cut: the
     same photograph is held throughout, the name leaves the way it arrived, the
     prompt arrives the same way, and the walk-across at the end is the walk this
     screen has always had, now carrying whoever was chosen. A second phase would
     mean a second copy of the cover-fit plate and a hand-off between two screens
     drawing the same picture -- a seam where the design has none. See
     `src/title.js`, which runs it as stages off one clock.

     ⚠️ THE ART DECIDES THE LAYOUT, NOT THIS FILE. The two coconuts are drawn
     into one picture, LEBRON on the LEFT and IPANEIMA on the RIGHT, so left and
     right here mean the order of `PLAYER_PACKS` and the two MUST agree.
     Reordering that list without redrawing these images points the highlight at
     the wrong figure -- and it would look like a bug in the input, not in a
     list. Adding a third hero needs a fourth image, not a code change.

     ⚠️ THREE FULL PICTURES FOR TWO BITS OF STATE, and that is the right trade
     here. The difference between them is a repaint of one body, and the obvious
     saving -- one base image plus a tinted overlay -- would mean re-colouring
     the artist's drawing at runtime. The masters are 7249x4924 / 3.1MB each; the
     `-game.png` copies the game loads are 1600x1087 / 0.62MB, cut by
     `tools/shrink-master.py --max-dim 1600 --no-crop`.

     ⚠️ `--no-crop` IS NOT OPTIONAL AND IT IS EASY TO MISS. The tool crops to the
     opaque bounding box by default, and the three pictures have DIFFERENT
     bounding boxes (6821 / 6885 / 6886 px wide) because the highlighted body
     reaches a little further. Cropped, each one lands on its own geometry and
     the two coconuts JUMP every time the selection moves -- which reads as a
     bug in the select and is a bug in the asset pipeline. Uncropped they are all
     1600x1087 and can never disagree. */
  SELECT: {
    /* false = the old screen exactly: a press sends the chosen-by-Tab hero
       walking and the game begins. The whole feature is behind this. */
    on: true,
    PROMPT: 'ESCOLHA SUA FRUTA',
    /* ⚠️ NOBODY HIGHLIGHTED -- AND THE SCREEN NO LONGER OPENS ON IT. It is kept
       for two reasons: it is the fallback if a hero's own picture fails to load
       (a missing highlight must cost the highlight, never the ability to
       choose), and `defaultPick: -1` brings it back as the opening state in one
       number. In normal play it is not reached. */
    NONE: 'v2:beatemup-dungeon/batidao-player-select-003-game.png',
    /* ⚠️ THE COLOURED ONE IS THE SELECTED ONE, AND I HAD IT THE WRONG WAY ROUND.
       Corrected by the user on 2026-08-31: *"the all yellow is not the selected,
       the selected is the colored one."* The flat yellow is a WASH over the
       coconut you did NOT pick -- it is brighter than its own colours, which is
       what made it read as a highlight to me and is exactly why this is written
       down rather than left to be re-derived off the pixels.

       So: 001 has the LEFT coconut in its own colours (LEBRON chosen), 002 has
       the RIGHT one (IPANEIMA chosen), and 003 has both, which is nobody.

       KEYED BY PACK, NOT BY POSITION. A picture belongs to a character, and
       naming it by the slot it happens to sit in is the copied-value bug this
       codebase keeps re-finding: the day the list is reordered, the names still
       read correctly and the pictures do not. */
    PICKED: {
      coconut:       'v2:beatemup-dungeon/batidao-player-select-001-game.png',
      coconutStrong: 'v2:beatemup-dungeon/batidao-player-select-002-game.png',
    },
    /* =====================================================================
       ONE LAYER PER COCONUT (2026-09-01) -- WHAT UNBLOCKED THE PUNCH.
       =====================================================================
       The note under PUNCH below says the pop could not be limited to the
       chosen figure because the art was ONE drawing of two coconuts that touch:
       measured, a single connected component of 837,483px, still one at an
       alpha threshold of 254, and not separable by eroding 32px. It also says
       exactly what would unblock it -- *"the two figures exported as SEPARATE
       PNGs on the same 7249x4924 canvas (so they still line up by
       construction), for each of the two picked states"*. That is what arrived,
       and it is why nothing here had to be measured or guessed: the four files
       share the master canvas, so they are drawn at ONE rect and land where the
       artist put them.

       ⚠️ `on` IS THE ONE WITH THE WHITE HALO. Measured rather than assumed --
       the difference between each pair is 1.6M pixels of pure white (255,255,255)
       present in `coco-0N` and absent from `coco-0N-V2`. That is the same
       highlight convention the old three-picture pack used, and this is written
       down for the same reason that note was: it is not derivable by looking at
       a thumbnail, and I had the old pair the wrong way round.

       ⚠️ `off` IS THE FLAT YELLOW WASH. The highlight has TWO halves -- the
       chosen coconut gains a white outline AND the other loses its colours --
       and that is the convention the old three-picture pack used. The first
       delivery carried only the outline half (measured: `coco-0N` and
       `coco-0N-V2` differ by 1.6M pure-white pixels and ZERO colour pixels), so
       for an afternoon an unselected coconut kept its colours; `yellow-01/02`
       arrived the same day and finished it.

       ⚠️ THEY LAND WITHOUT A SINGLE CODE CHANGE, and that is the payoff for
       wiring the slot and waiting. Verified on arrival rather than assumed:
       same 7249x4924 canvas, ink bboxes within 1px of the plain figures'
       (168,594,3757,4774 against 169,594,3758,4774), silhouettes overlapping
       0.996/0.997, mean RGB 199,169,25 -- the same yellow as the old
       composites -- and ZERO pure-white pixels, so no halo on the one that is
       not chosen. Four numbers, and every one of them had to be right for a
       path swap to be the whole job.

       ⚠️ SO `coco-0N-V2` IS NOW DRAWN BY NOTHING. The plain, halo-less colour
       version has no state that shows it: chosen is `coco-0N`, unchosen is
       `yellow-0N`. Its files are left in the folder and out of the manifest --
       nothing downloads them.

       ⚠️ `cxRel`/`cyRel` ARE THE FIGURE'S OWN CENTRE, and they are why the pop
       does not slide. Each file is a FULL-CANVAS overlay with one coconut on it,
       so scaling the layer about the picture's centre would swing the figure
       sideways -- 39px at a 1.25 pop, 155px off-centre. These are the ink
       centres of the two masters (bbox 168..3758 x 594..4774 of 7249x4924, and
       3322..7038 x 408..4416), so the swell happens where the coconut is.

       ⚠️ KEYED BY PACK, NOT BY POSITION, for the reason the note above gives. */
    LAYERS: {
      coconut: {
        off: 'v2:beatemup-dungeon/batidao-player-select-yellow-01-game.png',
        on:  'v2:beatemup-dungeon/batidao-player-select-coco-01-game.png',
        cxRel: 0.2708, cyRel: 0.5451,
      },
      coconutStrong: {
        off: 'v2:beatemup-dungeon/batidao-player-select-yellow-02-game.png',
        on:  'v2:beatemup-dungeon/batidao-player-select-coco-02-game.png',
        cxRel: 0.7146, cyRel: 0.4899,
      },
    },
    /* WHO IS HIGHLIGHTED WHEN THE SCREEN OPENS -- an index into PLAYER_PACKS.
       Asked for 2026-08-31: *"make the left one already selected by default when
       the player enters this screen."* 0 is the left of the picture, which is
       the first of `PLAYER_PACKS`; the two agree by construction, see the note
       above about the art deciding the layout.

       ⚠️ IT ALSO MEANS THE CONFIRM ALWAYS HAS AN ANSWER. With nobody selected a
       press did nothing, which is correct but is a screen that can be pressed at
       and not respond. Now the first press commits LEBRON, and moving first
       commits whoever you moved to. -1 restores the opening question and the
       picture that goes with it. */
    defaultPick: 0,
    /* THE NAME LEAVING. It accelerates out (p squared) where the arrival eases
       to a stop, because the two are opposite moves: a thing landing decelerates
       into place, a thing leaving picks up speed as it goes. Matching easings
       would make the exit read as the fall played backwards. */
    liftMs: 520,
    // A beat of empty screen between the name leaving and the prompt arriving.
    // Without it the two moves overlap and read as one lump of type passing
    // another going the other way.
    gapMs: 140,
    artFadeMs: 320,
    /* THE PUNCH -- the confirm beat, lifted from the MAIN GAME's own character
       select (`src/screens/select.js`, its "lock-in"), which is where the same
       moment already existed and therefore what "reproduce the punch effect"
       had to mean. Its numbers are copied rather than re-invented: a stamp pop
       of 1.25 settling to 1.0 on an easeOutBack over 0.40s, and a decaying
       screen shake of 9px over 0.18s at 82 / 71 rad/s.

       ⚠️ THE POP IS THE CHOSEN FIGURE ALONE SINCE 2026-09-01 -- see `LAYERS`
       above, which is the art that unblocked it. Everything from here to the end
       of this note is the record of why it could not be done before, kept
       because it is the argument for asking for art instead of writing code:
       three measurements said the picture could not be split, the note said what
       would unblock it, and the answer was one export.

       ⚠️ [HISTORICAL] THE POP WAS THE WHOLE PICTURE, NOT THE CHOSEN FIGURE, AND
       THAT WAS BLOCKED ON THE ART RATHER THAN ON THE CODE. Asked for on the first
       playtest -- *"make it only move the selected character"* -- and it cannot
       be done from these files. The main game stamps ONE fruit because its art
       is a row of separate panels it can clip to (`p.rect`). Ours is a single
       drawing of two coconuts that TOUCH. Measured, three ways:

         * one connected component of 837,483px spanning the whole picture, and
           still one at an alpha threshold of 254 -- so it is ink, not a faint
           halo, joining them;
         * eroding the mask by 32px does not separate them either, so it is a
           wide overlap and not a thin bridge;
         * the thinnest column between them still carries 385 rows of ink out of
           1087.

       So there is no line to clip on, and any split invents a boundary through
       the artist's drawing -- during a 25% pop the seam would be a hard vertical
       edge with an arm growing across it.

       ⚠️ WHAT WOULD UNBLOCK IT: the two figures exported as SEPARATE PNGs on the
       same 7016x4924 canvas (so they still line up by construction), for each of
       the two picked states. Then the pop clips to one layer and this note goes
       away. -- AND THAT IS EXACTLY WHAT ARRIVED, four days of notes later. The
       note is kept rather than deleted because it is the thing that made the ask
       one sentence long.

       ⚠️ AND THE MAIN GAME'S TRAILING FADE-TO-BLACK IS DELIBERATELY NOT COPIED.
       There it covers a hand-off to a synchronous stage load; here the hand-off
       is the chosen coconut walking across the title photograph, which is the
       thing that was asked for. Fading to black over it would hide the feature.

       ⚠️ IT HAS TO FIT INSIDE `chosenHoldMs`. The pop settles at 400ms and the
       hold is 500, so the beat is over before the prompt lifts. Drop the hold
       below the stamp and the pop is cut off mid-bounce by the screen leaving. */
    PUNCH: {
      on: true,
      stampMs: 400,       // pop settle time
      pop: 0.25,          // swells to 1.25 and bounces back to ~1.0
      shakeAmp: 9,        // px at its peak, decaying linearly
      shakeMs: 180,
      shakeFreqX: 82,     // rad/sec -- the main game's numbers, unchanged
      shakeFreqY: 71,
    },
    /* THE BEAT AFTER THE CHOICE, before anything moves. The highlight IS the
       feedback for the press, and it needs a moment on screen or the player
       never sees the picture they picked -- the screen would answer a press by
       throwing everything off the top. */
    chosenHoldMs: 500,
    /* WHERE THE PROMPT SITS, and it is HIGHER than the title's 0.30 because it
       shares the screen with two large figures where the title had it to
       itself. Everything below is a fraction of the canvas. */
    promptYRel: 0.11,
    promptSize: 58,
    /* THE PICTURE: how much of the canvas height it fills and where its middle
       sits. Its width follows from the art's own 7249x4924 -- never set
       separately, or the coconuts stretch.

       ⚠️ 0.64 IS 0.80 TAKEN DOWN 20%, ASKED FOR ON 2026-09-01 -- *"make the
       coconuts slightly smaller, 20% smaller"*. It is the DRAWN SIZE that
       shrinks, not the art: nothing is re-cut and the two figures keep every
       proportion the artist gave them.

       ⚠️ AND IT LIFTED THEM OFF THE BOTTOM EDGE, WHICH IS `artYRel`'S DOING, NOT
       A SECOND CHANGE. The rect is built around `artYRel` as its MIDDLE, so
       shrinking pulls the bottom up as much as it pulls the top down: at 0.80
       the picture ended at y=720, exactly the canvas edge with the feet 17px
       inside it; at 0.64 it ends at 662 and they stand on the ground with room
       under them. Keeping the feet where they were is `artYRel` 0.64, one line
       -- left alone because the smaller figures reading as standing IN the
       photograph rather than sitting on its edge is the better picture. */
    artHRel: 0.64,
    /* ⚠️ 0.60 -> 0.545 TO MAKE ROOM FOR THE NAMES UNDER THEM (2026-09-01). At
       0.60 the picture ended at y=662 and the coconuts' feet at 649, and
       `LEBRON` / `IPANEIMA` are 66px tall -- there was no strip of screen left
       to put them in that did not sit on the feet. The SIZE the user approved is
       untouched; the picture moved up 40px, which is the smallest change that
       buys the row.

       ⚠️ AND THEN UP AGAIN, 20% (2026-09-01): *"at the escolha seu coco screen,
       bring the coconut drawings up by 20%"*. 0.545 x 0.8. The names follow by
       the same 78px -- see `LETTERS.pickNameYRel` -- because they are captions
       of the picture and leaving them put would open a 117px hole between the
       feet and the words that are meant to be under them. */
    artYRel: 0.436,
  },

  /* =========================================================================
     CONTINUE? (2026-08-31)
     =========================================================================
     Asked for on 2026-08-31: *"when the player dies his last life, keep the
     background with the game, but on top of it, add a new layer with the
     countdown animation... while the numbers go down, [the two figures] must be
     cycled on screen. also, if the counter reaches zero and the players didn't
     press any button, this other frame must be used."*

     ⚠️ THE WORLD BEHIND IT IS THE REAL FRAME, NOT A CAPTURE. `game.js` paints
     this from `drawEndCards()` -- the same slot the CLEAR tally and the game
     over veil use, which exists exactly because those cards sit OVER whatever
     was drawn. Nothing is snapshotted; the world simply stops being ticked, so
     the corpse holds mid-fade and the crowd holds where it stood. That is what
     makes it read as the game PAUSED on your death.

     ⚠️ THREE LAYERS, ONE RECT. The pictures are full-canvas overlays carrying
     different parts of one composition -- the figures in the left half of the
     sheet, the word and the number in the right, and the dead frame both. They
     are drawn at one rect derived from the IMAGE SIZE, never from the ink, so
     they line up because the artist drew them lined up. See src/continue.js.

     ⚠️ AND THAT RULE REACHED BACK INTO THE ASSET CUT. `shrink-master.py` crops
     to the opaque bbox by default; cropped, these would each land on their own
     geometry and the panel would shake as the digit changed. Cut with
     `--max-dim 1100 --no-crop`, all fifteen are 1100x799 and cannot disagree.
     10.4MB of masters became 2.5MB of `-game.png`, and the masters were deleted
     on request -- the user keeps the originals outside the repo.

     ⚠️ AND `blank-02` IS THE FLAP. This note used to say the blanks were cut and
     unused, kept in case a flash was ever wanted. The dark one was wanted, on
     2026-09-01, and not as a flash: it is the sign with its flap mid-turn, so
     the count now FLIPS to each digit instead of cutting to it. `blank-01`, the
     lit board, stays unused -- see `flapMs`. */
  CONTINUE: {
    /* false = the last death goes straight to the game over panel, exactly as
       it did before this screen existed. The whole feature is behind it, and
       the three pictures leave the manifest with it. */
    on: true,
    DIR: 'v2:beatemup-dungeon/continue/batidao-continue-',
    /* HOW LONG THE OFFER STANDS. The artist drew ten digits, 0 through 9, so
       this counts 9 down to 0 with each one holding a second -- ten seconds in
       all, because the 0 is a drawing that deserves its beat rather than a frame
       on the way to grey. Fewer seconds simply starts lower and skips the top
       digits; more than 9 would ask for art that does not exist. */
    seconds: 9,
    /* HOW LONG THE TWO BEATEN COCONUTS HOLD EACH DRAWING -- at the START of the
       count. Asked for 2026-09-01: *"make the coconuts animation gradually much
       faster during the countdown"*, so the period runs from `figureMs` down to
       `figureEndMs` in a straight line across the whole count, and the pair go
       from a slump to a panic as the offer closes. The picture then tells you
       the same thing the number does, a beat before you have read the number.

       ⚠️ 4.75x, WHICH IS WHAT "MUCH FASTER" HAD TO MEAN HERE. Anything gentler
       is not visible against a drawing that is already moving; much past this
       the two frames stop reading as one figure breathing and start reading as
       two pictures being swapped, because at 60fps an 80ms hold is five frames
       and there is a floor under how fast an alternation can go before it is a
       flicker rather than a movement.

       ⚠️ THE RAMP IS THE COUNTDOWN'S OWN LENGTH -- `seconds` + 1, the same span
       the offer stands for. A duration of its own would be one more number to
       keep in step, and a ramp that ended early or late would read as the
       animation having a reason of its own.

       ⚠️ AND THE MATH IS AN INTEGRAL, NOT A DIVISION, or the figures stutter
       instead of accelerating. See `_figureFrame()` in continue.js.

       figureEndMs equal to figureMs = the old constant pace. */
    figureMs: 380,
    figureEndMs: 80,
    /* THE SPLIT-FLAP. Asked for 2026-09-01: *"between the number frames, I want
       you to add the blank boards... the idea is to make it look as a split-flap
       display (also called a flap sign), for example that exists in the ferry
       building in san francisco."*

       Each second OPENS with the dark board (`blank-02`) up for this long, and
       then the digit for the rest of the second -- 110ms of turn against 890ms
       of readable number, which is the balance the sign itself strikes.

       ⚠️ THE DARK BOARD ALONE, AND THAT IS THE CORRECTION THIS KNOB CARRIES. The
       first build alternated dark and lit, four frames at 55ms, reasoning that a
       real sign shows the back of the falling leaf and then the empty face of
       the arriving one. *"I actually want you to use only the dark one... i see
       the bright one being used as well."* The lit board is brighter than any
       digit frame, so mid-turn it reads as a FLASH interrupting the count rather
       than as the count turning. One board, one beat.

       ⚠️ AND THAT MADE IT A DURATION RATHER THAN A SEQUENCE. With two boards
       there was a frame count to tune; with one there is only how long it is
       dark, so `flapFrames` is gone -- it would have meant `flapMs` twice.

       ⚠️ SHORT IS THE EFFECT. Much past ~200ms the board stops being a turn and
       becomes a blackout with the number missing from it.

       0 = no flip, the digits cut as they did before. */
    flapMs: 110,
    /* THE GREY FRAME'S BEAT BEFORE THE GAME OVER PANEL. It is the answer to a
       question the player just failed to answer, so it has to be READ -- handing
       straight on would make the count end in a cut.

       ⚠️ 1400 -> 2600 BECAUSE THE FRAME IS NOW LIT RATHER THAN JUST SHOWN. The
       light takes `deadLightMs` to come up and then wants a moment at the top;
       a hold that ends mid-rise is a light being switched off as it climbs. The
       two numbers move together -- this one is the ramp plus a beat. */
    deadHoldMs: 2600,
    /* THE LIGHT COMING UP ON THE GREY FRAME. Asked for 2026-09-01: *"when it
       gets black and white, it now gets black and white at once... after it gets
       black and white, make the grey more clear, give it a clearing to the gray,
       make the effect slow, like its illuminating the last frame"*.

       The frame lands DIM at `deadLightFrom` and rises to `deadLightTo` over
       `deadLightMs`, smoothstepped. So the count running out is still a hard
       switch to black and white -- that is the offer closing and it should land
       like one -- and what is slow is the light afterwards.

       ⚠️ IT STARTS BELOW 1, WHICH IS WHAT MAKES IT AN ILLUMINATION RATHER THAN A
       GLOW. Ramping 1.0 -> 1.4 only ever brightens a picture you have already
       read; arriving at 0.55 puts the frame in the dark first, so the rise has
       somewhere to come FROM and the grey visibly clears. The drop at the switch
       is part of the effect, not a cost of it.

       ⚠️ AND IT TOPS OUT SHORT OF WASHING OUT. 1.35 lifts the greys and keeps
       the artist's blacks; past about 1.6 the desaturated coconuts start losing
       their outlines into the light, which reads as the picture fading rather
       than as the picture clearing.

       deadLightMs: 0, or both ends at 1, = the frame simply appears, as before. */
    deadLightMs: 2000,
    deadLightFrom: 0.55,
    deadLightTo: 1.35,
    /* THE STAMP ON THE GREY FRAME, at the instant it arrives. Asked for
       2026-09-01: *"when at the last second, things turn gray, after it activate
       the gray thing, add a medium punch to the coconuts, at the same time."*

       ⚠️ TINY, NOT MEDIUM. It shipped at 0.18 -- reasoned as "between the menu's
       0.10 and the select's confirm 0.25" -- and was wrong on sight: *"the medium
       punch wasn't good, make it a tiny punch then."* 0.10, the menu's number.
       **The weight of a stamp is not a slot in a scale; it is what the thing
       being stamped can carry**, and a pair of beaten coconuts holding still on
       a grey screen carries very little.

       ⚠️ AND IT IS THE COCONUTS ONLY -- *"don't punch the number display"* --
       WHICH THIS PICTURE ALLOWS AND THE FRUIT SELECT'S DID NOT. I had written
       the usual note here saying `contagem-dead` is one picture so there is
       nothing to stamp but all of it. Then I measured it: the figures' ink ends
       at 0.545 of the panel width and the word and number begin at 0.575 -- a
       33px column of nothing between them. The select art had NO such gap (one
       connected component, 385 rows of ink in its thinnest column), which is why
       that one needed a new export and this one needs a clip. **The two cases
       look identical and are not; measure before repeating a refusal.**

       `deadPunchSplit` / `CX` / `CY` are those measurements: where to cut, and
       the figures' own ink centre so they swell in place instead of sliding.

       ⚠️ AND IT RUNS ON `deadT`, THE SAME CLOCK AS THE SWITCH AND THE LIGHT, so
       all three land on one frame. *"At the same time"* stays true through a
       retune only if there is one clock.

       ⚠️ AND IT IS NEGATIVE: THE SIGN IS THE DIRECTION. *"Reverse the punch of
       the continue screen, instead of punching to the front, punch it to the
       back."* A negative amount recoils the figures AWAY from the camera and
       springs them back; positive swells them towards it. Same easeOutBack
       curve either way, so the two directions are one gesture mirrored -- and
       backwards is the right shape here: the menu's stamp and the select's
       answer a PRESS, and this one answers a clock running out.

       0 = no stamp; the frame simply appears, lit. */
    deadPunch: -0.10,
    deadPunchMs: 400,
    deadPunchSplit: 0.5595,   // the empty column between figures and number
    deadPunchCX: 0.3009,      // the figures' ink centre, x
    deadPunchCY: 0.5282,      //   ...and y
    /* HOW MANY LIVES A CONTINUE BUYS. A full set, which is what the word means
       in this genre -- and `playerLives` rather than 3, so the two can never
       disagree about what a full set is. He comes back where he fell, in the
       fight he was losing; the crowd, the segment and the camera never moved. */
    lives: null,          // null = CONFIG.playerLives
    /* HOW FAR THE FIGHT IS PUSHED BACK UNDER THE PANEL. Asked for 2026-08-31:
       *"add a darkening filter like 30% to the game screen, before drawing these
       letters... so the gameplay kinda fades to background and the player has to
       decide."*

       ⚠️ IT IS UNDER EVERY LAYER, INCLUDING THE GREY DEAD FRAME -- it dims the
       WORLD, not the panel. Over the pictures it would take 30% off the artist's
       colours too and the yellow would go muddy.

       ⚠️ AND I HAD ARGUED THE OTHER WAY IN CODE. The note this replaces said
       darkening the thing the player is deciding whether to go back to was the
       wrong note. The ask is the better read: the world has stopped being what
       you are looking at and become what you are looking at a decision ABOUT. */
    /* ⚠️ 0.50, WHICH IS THE PAUSE SCREEN'S NUMBER. Asked on the first playtest:
       *"check the same logic that the pause button does now, that is correct."*
       The logic already was the same -- `renderFrame(render)`, a black fillRect,
       then the content on top at full alpha, which is exactly `Hud.drawCard`.
       What differed was the STRENGTH: this was 0.30 against `PAUSE.dimAlpha`
       0.50, so the world was pushed back less far and the panel popped less.
       Matching the screen the user named as correct is the answer; 0.30 is one
       line away if it turns out to be the panel that wanted changing. */
    veilAlpha: 0.50,
    /* THE VEIL RAMPS UP OVER THIS, AND THE PANEL DOES NOT -- it is solid from
       its first frame. ⚠️ IT CARRIED THE PANEL TOO AND THAT WAS A BUG: a
       translucent coconut shows the world through itself, and that world has
       just been dimmed 30%, so the characters really were darkened for the first
       quarter-second. Reported on the first playtest. **Anything drawn at less
       than full alpha above a veil takes the veil on.** 0 = both instant. */
    fadeInMs: 250,
    /* THE PANEL'S RECT. Fitted by HEIGHT and centred: the sheet is 1.377:1
       against a 1.778:1 canvas, so height is what keeps all of it on screen --
       fitting by width would push the figures' feet off the bottom, and they are
       the thing that has to sit on the floor. `yRel` is a hair below centre for
       the same reason. */
    hRel: 0.90,
    yRel: 0.52,
  },

  /* --- THE VERMIN, and BOTH screens that crawl on them ----------------------
     Three photographed frames, read IN PLACE out of `assets-v2/flying-dungeon/`
     rather than copied -- two copies of a picture drift the moment one is recut
     and the wrong one is always the one you are not looking at.

     ⚠️ ONE LIST, TWO CONSUMERS, LOADED ONCE. The LOGO screen at the front of
     the game and the GAME OVER panel at the end of a run are the same three
     photographs, and they share the draw as well as the files (see
     `GameOver.renderBackdrop`) so they can never end up on different frames of
     one animation. They were separate lists for about ten minutes and that is
     ten minutes longer than two copies of the same three paths deserved.

     The keys are `vermin0..2`. They used to be `gameover0..2`, which stopped
     being an honest name the moment the title screen drew them again. */
  VERMIN_FRAMES: [
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-001.webp',
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-002.webp',
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-003.webp',
  ],

  /* --- THE LOGO SCREEN: the front door -------------------------------------
     The crawling vermin with the SABOROSA logo over them, and then it hands to
     the BATIDÃO DE CÔCO title. Two front screens: the label, then the name.

     ⚠️ THIS SCREEN WAS DELETED ON 2026-08-21 AND ASKED FOR AGAIN ON 08-22 --
     in FRONT of the photograph this time rather than instead of it. It cost one
     30KB file to bring back, because neither of its assets was ever removed:
     the frames are the game over panel's, and the logo has been sitting unused
     in the other game's folder since July.

     ⚠️ IT AUTO-ADVANCES AND THE TITLE AFTER IT DOES NOT, which is the whole
     reason two screens is not two things to dismiss: this one is a label being
     shown to you and it leaves on its own; the next is where the game waits.
     `holdMs` 0 makes it wait for a press instead.

     ⚠️ AND IT IS ONLY THE FRONT DOOR OF THE SESSION. Finishing a run or losing
     one goes back to the TITLE, not to here -- decided when the game over panel
     was pointed at the title on this same day. `onRestart: true` sends restarts
     through the logo as well, which costs the player three seconds of branding
     every time they die. */
  LOGO: {
    on: true,
    onRestart: false,
    SHEET: 'v2:flying-dungeon/saborosa-logo.webp',
    wRel: 0.52,        // logo width as a fraction of the canvas. Still Life's
    yRel: 0.5,         // and its centre, down the canvas
    holdMs: 3000,      // it leaves on its own after this. 0 = wait for a press
    armMs: 250,        // before a press counts -- see the note in logo.js
    fadeInMs: 400,     // up out of the loading bar's black
    fadeOutMs: 600,    // down into the title screen
    /* Per-frame holds for the crawl, ms. Left to the game over panel's own
       `holdsMs` if absent, which is what shares the ~9.5fps cycle. */
  },

  /* --- The game over panel -------------------------------------------------
     THE FLYING DUNGEON'S SCREEN, brought over: its three photographed frames of
     crawling vermin, looping, with one word revealed over them. There it says
     TIME OVER; here it says one of seven hand-drawn phrases, picked at random.

     ⚠️ THE WORD USED TO BE TYPE AND IS NOW A PICTURE. See `title.SHEET`.

     ⚠️ THE FRAMES ARE `CONFIG.VERMIN_FRAMES`, SHARED WITH THE LOGO SCREEN and
     read in place out of `assets-v2/flying-dungeon/`, not copied. Two copies of a picture drift the moment one is recut, and the copy
     that is wrong is always the one you are not looking at. They are the same
     three files the TITLE screen used to crawl on before it became a
     photograph, so this game already knows how to load them.

     THE TIMINGS ARE THAT GAME'S, unchanged, because they were tuned in its
     tools/game-over-anim.html and there is nothing here that wants them
     different: dip the played scene to black, HOLD there a beat, then bring the
     panel up. The hold is the part worth keeping -- cross-fading straight from
     the fight to the worms reads as a glitch, whereas a moment of black reads
     as a cut.

     ⚠️ AND THE PRESS IS ARMED ONLY ONCE THE WORD IS UP, plus `armMs` to read
     it. Otherwise a key still held from the last seconds of the run blows
     straight past the screen the player is meant to see -- which is the whole
     reason the panel exists. */
  GAME_OVER: {
    on: true,
    holdsMs: [105, 105, 105],   // ~9.5fps, looping 1-2-3
    fadeOutMs: 900,             // the fight dipping to black
    holdMs: 350,                // black, before the panel
    fadeInMs: 900,              // the panel arriving
    armMs: 500,                 // after the word is up, before a press counts
    /* The lettering.

       ⚠️ IT IS A DRAWING NOW, NOT TYPE. Asked for 2026-09-01, with a sheet of
       seven hand-lettered phrases: *"instead of the current PERDEU that you
       wrote, I want us to randomize for each one of these words"*. `SHEET` is
       that pack (`tools/build-gameover-words.py` cuts it) and one of its frames
       is picked per game over. Everything below `SHEET`/`wRel` still describes
       the TYPE, which is now the fallback: if the sheet fails to load the panel
       sets `RESULTS.LABELS.lost` in Futura exactly as it did before, because a
       missing picture must cost the lettering's look and not the screen.

       ⚠️ `wRel` IS THE PACK'S ONE SCALE AND IT IS SET BY THE WIDEST PHRASE.
       `CAIU PRA FORA...` spans this much of the canvas and every other frame is
       drawn at that same px-per-source ratio -- so `VIIISH...`, which the artist
       drew half as wide, lands half as wide. Fitting each phrase to the screen
       would flatten exactly the difference the sheet is making. Standing rule
       for a pack here; see tools/build-beat-fundo-defs.py.

       ⚠️ AND `sizePct` DOES NOT APPLY TO THE PICTURE. It sets the FONT size, so
       moving it changes only the fallback -- the trap being that it looks like
       the knob for how big the words are. `wRel` is that knob now. */
    title: {
      SHEET: 'v2:beatemup-dungeon/batidao-gameover-words',
      wRel: 0.80,        // the WIDEST phrase, as a fraction of canvas width
      sizePct: 20.4,     // % of canvas height -- the TYPE fallback only
      yPct: 50,          // vertical middle of the text, down the canvas
      lsPct: 3,          // letter spacing, % of font size
      gapPct: 20,        // between words, if it ever has more than one
      fauxBold: 1.5,     // extra weight as a stroke, % of font size
      color: '#FAFA30',  // that game's yellow
      weight: 900,
      d1: 1100,          // ms into the panel before the word shows
      d2: 700,           // ...and before a second word, if there is one
      revealMs: 0,       // 0 = hard pop
      offX: 0, offY: 0,
    },
  },

  /* --- The ending ----------------------------------------------------------
     WON. Beating HIPÓLITO no longer cuts straight to the tally: the coconut
     walks out of the boss room to the right the same way he leaves every other
     room, and then this screen -- a photograph with the real coconut toy sat on
     a rock in it -- fades up and he walks in from the left to stand in front of
     it with his arms up.

     ⚠️ THE WALK-OUT AFTER THE LAST FIGHT IS NEW. The level used to hand
     straight to the CLEAR board when it ran out of segments in the last room,
     deliberately: `game.js` carried a note saying walking him off the edge
     there would be "walking him out of the level into nothing". There is now
     somewhere for him to walk TO, so that reasoning has expired -- but it is
     the reason the outro has to know which of the two it is handing to.

     Same plate rules as the title screen: 4:3 photograph on a 16:9 canvas,
     drawn COVER, loaded `big` so it is capped at `bigTextureCap`. It arrived
     4000x3000 / 4.2MB and was reduced by tools/shrink-master.py. */
  ENDING: {
    BG: 'v2:beatemup-dungeon/ending-background.jpg',
    fadeInMs: 700,        // the plate coming up out of the outro's black
    /* Where he enters and where he stops, as fractions of canvas width. He
       starts off-screen so the walk reads as an arrival rather than a fade-in
       of someone already standing there. */
    startXRel: -0.10,
    stopXRel: 0.5,        // the middle
    walkSpeed: 210,       // px/s
    /* His feet, down the canvas. The near dirt in front of the rock -- not the
       rock, which is a photographed object he is standing in FRONT of. */
    /* ⚠️ STILL 0.93, WHERE THE TITLE'S IS NOW DERIVED FROM THE BELT, and the
       divergence is deliberate rather than a missed edit. The title screen was
       aligned to where the coconut stands when the FIGHT starts, because that
       was the request. This screen is a different photograph with its own
       ground in it -- a rock rather than a wall -- so its number answers to the
       picture, not to the belt. If it ever looks wrong beside the title, that
       is a question about this photograph and not about consistency between the
       two. */
    groundYRel: 0.93,
    /* ⚠️ 1.0 = EXACTLY HIS SIZE IN THE FIGHT, and that is the point. It was
       1.55 on the reasoning that he is alone in the shot and the rock behind
       him is most of its height -- but a character who changes size between the
       level and the ending stops being the same character, and the ending is
       the last thing the player sees him do. If the framing needs him to fill
       more of the picture, move the CAMERA (the plate's crop) rather than the
       actor. */
    scale: 1.0,
    /* How long the arms-up pose is held before the tally comes up. Asked for as
       1.5 seconds AFTER the pose lands, not after he starts walking.

       ⚠️ 2500 SINCE 2026-08-24: "antes de aparecer os números na tela final,
       deixar o coquinho um pouquinho mais, depois que ele para no meio da tela
       e faz uma pose, deixa mais um segundo". One more second, on top of the
       1.5 -- and it is measured from the POSE LANDING, so lengthening the walk
       does not eat it. */
    poseHoldMs: 2500,
  },

  /* --- The explosion -------------------------------------------------------
     STILL LIFE'S BLAST, READ IN PLACE out of that game's folder rather than
     copied -- the same arrangement as the game over frames and the death sting,
     and for the same reason: two copies of a picture drift the moment one is
     recut, and the wrong one is always the one you are not looking at.

     ⚠️ ALL TWELVE FRAMES -- grow, peak, fade. The main game plays a 7-frame
     TAIL-ONLY subset of this sheet that starts at the peak; this is the whole
     explosion. The rects are that game's, unchanged, and they are correct for
     the sheet at its native 1228x845.

     ⚠️ DO NOT RE-CUT THIS SHEET BY ISLAND DETECTION. Two frames have DETACHED
     DEBRIS sitting beside the main blob and the rects below deliberately span
     both -- cut by connected components you get 14 frames, two of which are
     stray sparks that will flash on their own in the middle of the animation.

     Used by the horse boss's death; see HORSE_BOSS.DEATH_BOOM. */
  BOOM_SHEET: 'v2:flying-dungeon/saborosa-boom.webp',
  BOOM_RECTS: [
    [243, 234,  93,  86],
    [438, 179, 134, 134],
    [638, 143, 162, 156],
    [844, 128, 173, 158],
    [210, 380, 190, 162],   // widest -- the peak, and what `sizePx` measures
    [431, 363, 182, 164],
    [642, 347, 179, 155],   // spans a detached debris fleck at x 808
    [851, 335, 160, 151],
    [233, 619, 129, 120],
    [448, 610,  97, 112],
    [663, 616,  99,  84],   // spans a second fleck at x 920
    [901, 615,  56,  67],
  ],
  /* ms per frame -- 12 of them, so a blast is ~852ms. Still Life's rate
     (78 / 1.1), kept so the two games' explosions are the same explosion. */
  boomMs: 78 / 1.1,

  /* --- Music ---------------------------------------------------------------
     ONE FILE, ONE LOOP, NO MIXER AT RUNTIME. The track is three of the five
     takes layered and aligned in tools/beat-music-lab.html; the game does none
     of that. Three <audio> elements started together drift apart within a
     minute and the browser gives no way to bind them, so the layering is
     resolved offline or not attempted -- the flying dungeon's finding,
     inherited whole.

     WHERE IT WRAPS IS `MUSIC_LOOP.music`, BELOW, and the reasons a pin is
     needed at all live there. What belongs here is where the NUMBER comes from:

     ⚠️ IT IS THE CROP SCRIPT'S `--length`, NOT THE LAB'S `loopMs`. It used to
     be both, and on 2026-08-24 they parted company. The lab opened on 6146ms
     because that is the bed take's whole file length, and 1.2s of that is the
     take's own dead lead-in and dead tail -- which the loop put back to back at
     the wrap, so every 6 seconds the music fell into about nine tenths of a
     second of nothing but two stray ticks. The user heard it as a vacuum and it
     was one. tools/crop-beat-trilha.py re-cuts the lab's approved export to
     start on the bed's downbeat (745ms in) and run three bars, and the longest
     silence anywhere in the loop is now 320ms -- a rest the groove already
     plays. Change the crop, change this number with it; the script prints the
     value to paste. The lab's own loopMs stays at 6146 on purpose: it describes
     the ARRANGEMENT, and the crop needs the material outside the loop window to
     still be in the render it reads. */
  MUSIC_TRACK: 'v2:beatemup-dungeon/audio/trilha-mix.ogg',
  musicVolume: 0.55,

  /* --- The title screen's theme --------------------------------------------
     MIKE, the main game's intro theme, on the BATIDÃO DE CÔCO screen. Asked for
     2026-08-24.

     ⚠️ THIS REVERSES A DECISION, AND DELIBERATELY. MIKE was put on this screen
     on 2026-08-22 and taken off the same day for not suiting it, and the note
     in game.js said not to re-propose it. The user asked for it back, so it is
     back -- but not the same way: what went on last time was the whole 4m10s
     song from its quiet opening, and what is here is a 60s loop cut out of the
     fullest part of it (105.1s..165.3s of the original, 28 bars at 111.8 BPM).
     A title screen is a ten-second screen; it wants the part of a song that
     sounds like the middle of one.

     ⚠️ IT IS A SEPARATE FILE, NOT assets/MIKE.mp3. That file is the MAIN game's
     intro theme and src/main.js still plays it whole. tools/cut-song-loop.py
     writes this one; re-run it to move the cut, and move MUSIC_LOOP.musicTitle
     with it. 7.4MB became 812KB, which is why the cut was asked for.

     ⚠️ AND THE FIRST BOOT MAY BE SILENT, which is a browser rule and not a bug
     here. No page can play audio before the visitor has interacted with it, and
     on a cold load the first interaction IS the press that leaves this screen.
     It is asked for at the front door (the logo, one screen earlier) so that a
     press SKIPPING the logo lands the music on the title; a player who sits
     through the logo hears nothing until they play once and come back. Any real
     fix costs the player a press and would be a design change, not a wiring
     one. */
  TITLE_TRACK: 'v2:beatemup-dungeon/audio/mike-title.ogg',

  /* WHERE EACH TRACK WRAPS, by ASSET KEY, in seconds. A track with no entry
     loops at the end of its own decoded buffer.

     ⚠️ THIS IS NOT DECORATION, AND IT USED TO BE A SPECIAL CASE. Opus stores
     its length in a container field that decoders disagree about by a few
     milliseconds, and `AudioBufferSourceNode.loop` with no bounds wraps at
     whatever the DECODED buffer happens to be. A few ms of codec padding at the
     end is a few ms of silence inserted at every wrap -- a tick you will hear
     and will look for in the music. sound.js pins loopEnd from this instead, so
     the wrap is where the CUT says it is whatever decoded the file.

     ⚠️ IT IS A MAP BECAUSE A PIN BELONGS TO A TRACK. Until 2026-08-24 this was
     one number, `musicLoopSec`, and sound.js applied it `if (key === 'music')`
     -- a guard that existed only because the horse's 4m39s song would have been
     cut off after six seconds by the bed's crop. A second cropped track (the
     title theme) made that guard wrong in the other direction: it would have
     left the title loop unpinned and ticking once a minute. Keyed by asset key,
     the same shape as MUSIC_GAIN below, there is no guard to get wrong --
     `musicBoss` is simply absent, which is exactly what "loops at its own end"
     should look like.

     Both numbers here are the `--length` their cutter was last run with, and
     both scripts print the value to paste:
       music      tools/crop-beat-trilha.py
       musicTitle tools/cut-song-loop.py                                     */
  /* --- THE WHISTLE OVER THE STREET BED --------------------------------------
     A SECOND LOOPING VOICE, STARTED WITH A TRACK AND STOPPED WITH IT. Asked for
     2026-08-24: the whistle plays together with the gameplay song, looped
     together, and NOT baked into one file unless there was no other way.

     There was another way, and the reason is worth keeping: the "ONE FILE, ONE
     LOOP, NO MIXER AT RUNTIME" rule at the top of this section is inherited
     from the flying dungeon and it is about `<audio>` ELEMENTS -- three of
     those started together drift apart within a minute. This game plays music
     through `AudioBufferSourceNode`, which is sample-accurate by specification
     and scheduled against ONE audio clock. Two of them started at the same
     `currentTime` cannot drift; there is no second clock to drift against. So
     the whistle stays a whole, uncut file and the bed stays the approved mix.

     ⚠️ IT DOES NOT DIVIDE THE BED'S LOOP AND DOES NOT NEED TO. 7.5735s over
     5.115s: the two phase against each other and the whistle is never in the
     same place twice. The music lab flags a layer that does not divide because
     it RENDERS to one file and the remainder splices onto the head -- nothing
     is rendered here, each voice loops itself cleanly, and this soundtrack is
     already built out of layers that do not divide (its own takes repeat at
     2.09s and 2.22s inside a 6.15s arrangement).

     ⚠️ IT IS ON `music` ONLY, which is the request: the street bed. The horse's
     song and the title theme are finished pieces and are not accompanied.

     Keyed by TRACK, listing { key, src } -- the manifest walks this for the
     build, and `MUSIC_LOOP` / `MUSIC_GAIN` below carry the layer's own wrap and
     level under the same asset key everything else uses. */
  MUSIC_LAYERS: {
    music: [
      { key: 'musicWhistle', src: 'v2:beatemup-dungeon/audio/whistle-song.ogg',
        gated: true },
    ],
  },

  /* --- WHAT THE WHISTLE IS FOR ----------------------------------------------
     ⚠️ IT IS THE BARATAS' SOUND. Asked for 2026-08-24, immediately after the
     layer was built: "leave it mute, and make it appear only when the cockroach
     enemies are on screen." So `gated: true` above -- the voice starts SILENT
     and game.js raises it while one of these kinds is alive in the shot.

     ⚠️ THE VOICE IS NEVER STARTED AND STOPPED, ONLY FADED. Restarting it would
     play the melody from its first note every time a roach walked on, and would
     throw away the one property the layer exists to have: it is locked to the
     bed's clock and phases against it. Riding the gain means it comes UP
     wherever it happens to be -- a layer surfacing out of a mix rather than a
     cue being triggered. See Sound.setLayerOn().

     `WHISTLE_GATE.marginPx` IS NOT SLOP. Baratas WALK IN from off the edge, so
     a bare screen test would snap the whistle on somewhere in the middle of an
     arrival. One screen-width margin either side means it starts when they do.

     `fadeSec` is the ramp both ways. Long enough not to click on a sustained
     whistle, short enough that it is clearly THEIR sound. */
  WHISTLE_GATE: {
    layer: 'musicWhistle',
    kinds: ['barata', 'barata2'],
    marginPx: 160,
    fadeSec: 0.45,
  },

  MUSIC_LOOP: {
    music: 5.115,
    musicTitle: 60.107,
    /* THE WHOLE FILE, uncut. It loops on itself acceptably as delivered: the
       last second decays and the first builds, so the wrap is a breath rather
       than a splice -- measured, the seam step is 0.0019 against a head that is
       near-silent anyway, and the longest quiet stretch across it is 380ms. No
       crop tool was run on it and none is wanted; a cut through a
       through-composed melody has nowhere good to land (the best 5.115s window
       in it scores 0.23 for seam similarity, against 0.64 for MIKE). */
    musicWhistle: 7.5735,
    /* ⚠️ NOT OURS TO RE-DERIVE: this is `loopMs` out of tools/music-lab.html,
       which is the flying dungeon's arrangement, in seconds. That mix is
       14.452s and the Opus container says 14.4585 -- 6.5ms of padding, which
       unpinned is a tick every fourteen seconds. The number lives there;
       re-bake that game's trilha and move this with it. */
    musicMosca: 14.452,
  },

  /* --- The horse's theme ---------------------------------------------------
     A SONG, NOT A BED, and the difference is the whole entry. The level's music
     is a six-second loop built to disappear under a fight; this is 4m39s of
     finished track handed over on 2026-08-22 to play over the last fight.

     ⚠️ IT HAS NO `MUSIC_LOOP` ENTRY, AND THAT IS THE POINT OF THE MAP. Pinning
     it to a cropped track's length would cut the song off after a few seconds.
     Absent means it loops at its own end instead, which it will
     almost certainly never reach: the fight is a couple of minutes at most.

     ⚠️ AND IT PLAYS ALONE. Sound only ever holds one music source, so asking
     for this stops the bed -- which is what "tocar sozinha" asked for. Asking
     for a track already playing is a no-op and not a restart, or the theme
     would start again from the top every frame.

     ⚠️ IT IS DELIBERATELY NOT STOPPED WHEN THE HORSE DIES. Requested: it runs
     through his death, the walk-out, the ending photograph and the tally, and
     only the return to the title ends it. So the last thing the player hears is
     the same thing they beat the game to.

     4.5MB of mp3, which is a fifth of the whole build again -- the one asset
     here big enough to be worth noticing. It is mp3 rather than ogg because
     that is how it was delivered; re-encoding to ogg at the same quality would
     save about a third if the build ever needs it. */
  BOSS_TRACK: 'v2:beatemup-dungeon/audio/song-enmakun2011.mp3',

  /* --- The Mosca's theme ---------------------------------------------------
     STILL LIFE'S OWN SOUNDTRACK, played while NARUTÃO is alive. Asked for
     2026-08-24: "botar a música do still life quando a mosca boss entra. Quando
     ela morre, volta o batidão tchum tcha normal."

     ⚠️ READ IN PLACE OUT OF THE FLYING DUNGEON'S FOLDER, NOT COPIED -- exactly
     like MOSCA_SHEETS above, and for the same reason: this boss IS that game's
     boss, and the fight should be able to change there and change here. The
     file is that game's shipped `trilha-mix.ogg`, 14.45s, 240KB.

     ⚠️ IT IS THE ONLY BOSS-SCOPED TRACK IN THE GAME, and that is the exception
     rather than a second way of doing things. `ROOMS[n].music` exists because
     the horse's room OPENS with a wave of roaches -- the room is the unit the
     player experiences there, and hanging the song on the boss made it arrive a
     minute late. The Mosca is a SUB-BOSS mid-street: the bed is already
     playing, she flies in, and the SWITCH IS THE EVENT. Nothing about the room
     changed, so nothing room-scoped could express it.

     ⚠️ AND IT ENDS WHEN SHE DIES, which is the other half of the request and
     the opposite of the horse's rule ("⚠️ AND NOTHING EVER STOPS IT", above).
     The horse's theme runs through his death and the ending because his death
     IS the end of the game; the Mosca's ends because the street carries on
     without her. game.js reverts to `roomMusic()`, which for the street is the
     bed.

     NO `MUSIC_GAIN` ENTRY, AND THAT IS MEASURED, NOT ASSUMED: this track's RMS
     is -17.2 dBFS against our bed's -16.9, so it already sits where the bed
     sits and the punches stay balanced against it. */
  MOSCA_TRACK: 'v2:flying-dungeon/audio/trilha-mix.ogg',
  /* Per-track level on the music bus, by ASSET KEY. Anything unlisted plays at
     `musicVolume` flat. It trims AND it lifts -- above 1 is allowed and the
     title theme needs it.

     ⚠️ THE BED WAS THE FIXED POINT UNTIL 2026-08-24, AND THEN IT MOVED. Every
     other number here was derived against it sitting at 1.0 -- and then it was
     simply too loud in play and came down 20%. What that does NOT invalidate is
     the two absolute derivations: `musicBoss` and `musicTitle` were each brought
     to a level of their own in dBFS, not to the bed, so they are untouched.

     ⚠️ AND `musicMosca` MOVED WITH IT, which is the whole reason that entry now
     exists. It had none for a while, precisely BECAUSE it measured within 0.3dB
     of the bed and 1.0 was therefore already the right answer -- a level
     expressed as an ABSENCE. The moment the bed moved, the absence stopped
     meaning "level with the bed" and started meaning "3dB above it". It is 0.68
     now: the same trim, so the pair are level again wherever the bed goes next.
     ⚠️ Move one, move the other.

     ⚠️ AND THE WHISTLE FOLLOWS THE BED FOR FREE. It is a LAYER on `music`, and
     a layer's own gain node feeds the music bus that the main track's trim sets
     -- so 0.8 takes the whistle down with it and their balance is unchanged.
     That is worth knowing before anyone "fixes" the whistle to match.

     Measured RMS, which is what these numbers came from:

       music      -16.9 dBFS   the bed -- at 0.68 it arrives at -20.3
       musicBoss  -13.7 dBFS   a finished mix, hotter -> 0.85 puts it at -15.1
       musicTitle -26.5 dBFS   MIKE is mastered quiet -> 2.6 puts it at -18.2

     musicTitle sits a little UNDER the bed on purpose: it is a dense full mix
     against a sparse percussion loop, and matched by RMS the dense one reads as
     the louder of the two. Its buffer peaks at 0.31, so 2.6 is nowhere near
     clipping the bus. */
  MUSIC_GAIN: {
    /* THE STREET BED. It had no entry at all before 2026-08-24, because it WAS
       the 1.0 everything else was measured against. Down 20% that day for being
       too loud in play, and then another 15% on top: 1.0 -> 0.8 -> 0.68, which
       is 3.3dB and takes it from -16.9 to -20.3 dBFS. See the warnings above --
       this number moving is not free, and it has now moved twice. */
    music: 0.68,
    musicBoss: 0.85,
    musicTitle: 2.6,
    /* ⚠️ UNDER THE BED ON PURPOSE, AND NOT BECAUSE IT IS QUIET. Measured, the
       whistle is -16.4 dBFS RMS against the bed's -16.9 -- they arrive at
       almost exactly the same level. But one is a MELODY and the other is
       percussion, and matched by RMS a melody sits in front of a groove rather
       than on it. 0.8 was the first guess and it was 20% too present in play --
       0.64 is that, heard and taken down. The bed's own level is still the fixed
       point and does not move; this is the knob that does.

       ⚠️ IT IS ITS OWN GAIN NODE, not the music bus. The bus carries the main
       track's trim and stopMusic() puts it back to plain volume. */
    /* STILL LIFE'S, ON THE MOSCA. ⚠️ IT IS THE BED'S TRIM AND NOT A LEVEL OF ITS
       OWN -- her track measures -17.2 dBFS against the bed's -16.9, so the two
       were already level and the job of this number is only to keep them that
       way while the bed moves. It had no entry at all until the bed came down;
       an absence meant "level with the bed" right up to the moment that stopped
       being true. Move the bed, move this. */
    musicMosca: 0.68,
    musicWhistle: 0.64,
  },

  /* --- Sound effects -------------------------------------------------------
     name -> file. The name is what the game asks for (`sound.play('hit')`);
     everything else follows from this map, so adding an effect is one line
     here and one call at the moment it should be heard. manifest.js walks it,
     so the build carries whatever is listed.

     ⚠️ THESE ARE THE CUT FILES, under audio/sfx/, NOT the takes beside them.
     The takes are performances into a phone: single-hit.ogg is 2.17 seconds
     long and the hit is 300ms of it starting at 958ms, so playing the take on
     a connect would sound the punch almost a second after it landed.
     tools/build-beat-sfx.py finds the event and cuts it out. Re-run it, do not
     hand-trim, and never point this at the raw take. */
  SFX: {
    hit: 'v2:beatemup-dungeon/audio/sfx/single-hit.ogg',
    /* THE FINISHER, cut out of combo-1-4-hits.ogg -- a take of three ordinary
       punches and a different sound at the end. Only the end is in here:
       `build-beat-sfx.py combo-1-4-hits --gap 50 --event last --out combo-finish`.
       It is a genuinely different sound rather than a louder punch (it
       correlates at -0.00 with single-hit), which is why it gets its own entry
       instead of a pitch on the existing one. */
    comboFinish: 'v2:beatemup-dungeon/audio/sfx/combo-finish.ogg',
    /* THE RESULTS BOARD'S COUNT-UP TICK -- Still Life's coin hit, cut. See
       RESULTS.TICK for why this one is a cut copy rather than read in place
       like that game's death sting below. */
    coin: 'v2:beatemup-dungeon/audio/sfx/coin-tick.ogg',
    /* THE ENEMY'S REACTION TO BEING FLOORED -- layered UNDER the punch, not
       instead of it, on the two blows that knock down. TWO of them, picked at
       random per knockdown; see ENEMY_HIT_SFX for the pool.

       ⚠️ BOTH ARE CUT FILES AND BOTH NEEDED IT. The takes beside them are 1.93s
       and 2.27s with the grunt 452ms / 605ms of each, starting at 734ms and
       768ms -- either played raw would answer three quarters of a second after
       the enemy hit the floor. `build-beat-sfx.py enemy-hit-1` / `enemy-hit-3`.
       ⚠️ enemy-hit-3's take also PEAKS AT 1.015, i.e. it was already clipped on
       the phone; the cutter's -1 dBFS ceiling is what makes it usable. */
    enemyHit: 'v2:beatemup-dungeon/audio/sfx/enemy-hit-1.ogg',
    /* ⚠️ THIS ONE IS THE HERO'S, AND IT WAS THE ENEMIES' FOR AN HOUR. It went
       into `ENEMY_HIT_SFX` as the second grunt on 2026-08-24 and was moved the
       same day: "stop using this for the enemies, this one should be used for
       our hero." Same cut, same file, different mouth. The enemy pool is back
       to one entry -- which is why it is still a POOL and not a single name. */
    playerHit: 'v2:beatemup-dungeon/audio/sfx/enemy-hit-3.ogg',
    /* AND THE ONE HE MAKES ON THE WAY OUT. Cut from `enemy-hit-2`, the last of
       the four takes to be used -- they were all recorded as enemy noises and
       two of them turned out to be his. */
    playerDeath: 'v2:beatemup-dungeon/audio/sfx/player-death.ogg',
    /* AND THE LAST ONE THEY MAKE. Played on the blow that KILLS, in place of the
       knockdown grunt above rather than on top of it -- two vocal samples from
       one body in one frame is a mess, and the death is the more interesting of
       the two. Cut from `enemy-hit-4-oof` (a 1.81s take with the event 487ms of
       it at 614ms; its raw peak is 1.015, clipped on the phone like
       enemy-hit-3). */
    enemyDeath: 'v2:beatemup-dungeon/audio/sfx/enemy-death.ogg',
    /* THE VICTORY FANFARE -- STILL LIFE'S, READ IN PLACE like the death sting
       below it. ⚠️ Unlike the coin above, this one needs NO cutting: it is a
       finished 10.7s clip that starts on its first beat. Enveloped before
       wiring, because the coin next to it looked finished and was not. */
    victory: 'v2:flying-dungeon/audio/victory-sound-01.ogg',
    /* THE DEATH STING -- STILL LIFE'S, READ IN PLACE out of that game's folder
       rather than copied, exactly like the game over panel's three frames above
       it. Asked for by name on 2026-08-22: the two games are meant to end the
       same way, so they end on the same piece of music, and two copies of it
       would drift the moment one is recut.

       ⚠️ IT IS MUSIC, NOT AN EFFECT, and it is played as one -- see
       GAME_OVER_STING for the rate, the double and the level. It is in this map
       because this map is what gets fetched and decoded, not because a punch
       and a requiem are the same kind of thing. */
    gameOver: 'v2:flying-dungeon/audio/game-over.ogg',
  },
  /* Effects sit ABOVE the music: a punch that the bed swallows reads as a
     punch that did not connect. Both are under the mute. */
  sfxVolume: 0.9,

  /* Per-effect trim, multiplied onto sfxVolume. Anything not listed plays at 1.

     ⚠️ IT HAS TO BE HERE RATHER THAN IN THE FILE. The cut clips are normalised
     to -1 dBFS, so there is no room left to make one louder by re-cutting it --
     a finisher rendered 20% hotter would just be a finisher with its peaks
     flattened. Gain at playback has the headroom the file does not: Web Audio
     mixes in float and only meets the fixed point at the output.

     THE CEILING IS REAL THOUGH. sfxVolume 0.9 x 1.2 against a -0.94 dBFS clip
     comes to 0.97, which fits; push much past 1.3 here and the effect will
     clip against the music instead of getting louder. If it needs to dominate
     more than that, the thing to turn down is musicVolume. */
  SFX_GAIN: {
    comboFinish: 1.2,      // the last hit of a string reads as the biggest one
    /* 0.67 is not a taste decision, it is arithmetic: Still Life plays this
       clip at 1.0 on an sfx bus set to 0.6, so it reaches the master at 0.6.
       This game's bus is 0.9, and 0.9 x 0.67 is that same 0.6. Changing
       sfxVolume therefore breaks the match -- if the punches are ever
       rebalanced, re-derive this rather than nudging it by ear. */
    gameOver: 0.67,
    /* THE COUNT-UP TICK, and the arithmetic is the same shape as gameOver's
       above but the answer is not. Still Life plays this clip at 0.605 on an
       sfx bus of 0.6, so it reaches master at 0.363; matching that on this
       game's 0.9 bus would be 0.40.

       ⚠️ MATCHING IT WOULD BE TOO LOUD, because that game plays ONE coin and
       this one plays about fifty in four and a half seconds, three or four of
       them ringing at any moment. What is being matched has to be the sound of
       the EFFECT, not of one voice in it, so this sits well under the derived
       figure. 0.14 is roughly a third of it.

       If the tick is ever pulled apart from the roll -- one per row, say --
       0.40 is the number to go back to. */
    coin: 0.14,
    /* UNDER THE PUNCH THAT CAUSED IT. The cut measures -14.6 dBFS against
       combo-finish's -15.9, and that clip is already lifted to 1.2 -- so at 1.0
       the reaction would arrive level with the blow and the two would fight.
       0.7 is about 3dB under it: the punch is the event, this is the answer. */
    enemyHit: 0.7,
    /* THE SECOND GRUNT, at the same trim as the first. Their cuts measure
       -14.6 and -14.3 dBFS -- within a third of a decibel, so one number does
       for both and the random pick cannot also be a volume change. ⚠️ If a
       third is ever added, measure it before assuming 0.7 fits. */
    /* The hero, at the same trim as the enemies' -- all four cuts land between
       -14.6 and -14.2 dBFS, so one number does for the set and whose voice it
       is never doubles as a volume change. */
    playerHit: 0.7,
    /* ⚠️ 0.47 IS THE SAME LEVEL AS THE OTHERS, NOT A QUIETER ONE. This cut
       measures -10.8 dBFS where the other three land between -14.2 and -14.6 --
       it is 3.4dB hotter as a FILE, so 0.7 x 10^(-3.4/20) puts it where they
       are. Derived rather than judged, like every other number in this table.
       ⚠️ It is also the one sound here with a case for sitting ABOVE the set:
       it is the last thing that happens to the player. Lift it deliberately if
       so, rather than by leaving this at 0.7 and calling it a decision. */
    playerDeath: 0.47,
    /* The death, at the same trim as the two grunts -- all three cuts land
       between -14.6 and -14.2 dBFS, so one number does for the set and which
       sound plays never doubles as a volume change. */
    enemyDeath: 0.7,
    /* Same arithmetic as gameOver above, and here it stands: Still Life plays
       this at 1.0 on a 0.6 bus, reaching master at 0.6, and 0.9 x 0.67 is that
       same 0.6. It is ONE voice there and one here -- nothing about the usage
       differs, which is exactly why the coin's derivation had to be overruled
       and this one does not. */
    victory: 0.67,
  },
  /* --- The death sting -----------------------------------------------------
     HOW the game over music is played, kept apart from WHICH file it is because
     these three numbers ARE the sound: Still Life plays the clip 10% slow with
     a second voice 50ms behind it, and neither is a mix decision.

     ⚠️ `rate` RESAMPLES. It drops the pitch with the speed -- about 1.8
     semitones at 0.9 -- because that is what playbackRate on a buffer source
     does; Web Audio has no time-stretch. On a death sting the drop is the
     point, but it is a tape-speed change and not a tempo change.

     ⚠️ `doubleDelayMs` IS IN THE CLIP'S OWN TIME, so game.js divides it by
     `rate` before scheduling. Slowing the clip then slows the whole
     combination, exactly as it would if the two voices had been bounced to one
     file and that file played slower. At 50ms it sits right on the edge of
     fusion -- one thickened sound with a hard edge, rather than two attacks.
     Under ~40ms it fuses completely and starts colouring the tone instead.

     THE BED STOPS FOR IT. This is music standing in for the music that has just
     ended, not an effect layered over one -- the opposite of the CLEAR board,
     where the game carries on. */
  /* --- THE VICTORY FANFARE -------------------------------------------------
     STILL LIFE'S, and it arrives in TWO moments rather than one. Asked for
     2026-08-24 and then corrected the same message: "when the boss fight ends
     and the screen fades out (the cavalo boss fight), stop the song of the boss
     fight. Then the last screen is loaded and the coconut comes from the left,
     start playing the victory song."

       1. THE HORSE'S SONG STOPS when the walk-out begins -- `musicFadeSec`,
          rolled off across the walk rather than cut, so the room empties out.
       2. THE FANFARE STARTS when the ending screen does, as he comes in from
          the left. There is a beat of silence between the two, and that beat
          is the point: the song ending is what makes the fanfare an arrival.

     ⚠️ THIS REVERSES THE HORSE'S "NOTHING EVER STOPS IT" RULE, which is written
     up at BOSS_TRACK above and was itself an explicit request on 2026-08-22 --
     the song was to run through his death, the walk-out, the ending photograph
     and the tally, "so the last thing the player hears is the same thing they
     beat the game to". That is now the fanfare instead. Both notes are kept
     because the reasoning has not stopped being good; it was simply outvoted.

     ⚠️ IT IS `playOnce`, NOT `play`, AND THAT MATTERS. The clip is 10.7s and
     the ending screen plus the whole results board is about ten -- a player who
     skips the tally would otherwise be back on the title with a fanfare still
     going. `toTitle()` calls `stopOnce`. This is Still Life's own finding
     (`stopOnce('victory')`, "at 10.7s it easily outlives a run"), inherited
     rather than rediscovered. */
  VICTORY_STING: {
    on: true,
    musicFadeSec: 1.2,     // the horse's song rolling off across the walk-out
    stopFadeSec: 0.4,      // the fanfare getting out of the way at the title
  },

  GAME_OVER_STING: {
    on: true,
    rate: 0.9,
    doubleDelayMs: 50,
    musicFadeSec: 0.35,    // the bed getting out of the way
  },
  /* How much higher each successive hit of a combo is pitched. 0 turns it off
     and gives every punch the identical sample. At 0.045 the fifth hit is about
     20% up, which is a different punch rather than a different instrument. */
  sfxHitDetune: 0.045,
  /* THE SAME PUNCH, PLAYED LOWER, FOR A BLOW THE PLAYER TAKES. Asked for on
     2026-08-22 as "the porrada noise when the player gets hit, like when he
     hits the enemies" -- so it is deliberately the same recording rather than a
     second one. Pitched down instead of reused flat because the ear has to be
     able to tell "I landed that" from "I took that" without looking, and it is
     the one cue in the fight that has no picture of its own to lean on: an
     enemy's swing lands the same impact burst the player's does.

     1 turns the distinction off and gives both directions the identical sound.
     Do not go far under ~0.7 -- the clip is a 300ms crack and slowing it that
     far turns it into a thud, which reads as something falling over. */
  sfxTakeHitRate: 0.82,
  /* ⚠️ AND HE HAS A VOICE NOW, on top of that pitched-down punch. Asked for
     2026-08-24. It is layered UNDER the blow exactly as the enemies' grunt is:
     the punch is the event, this is the answer, and the two together are what
     tells the player they were the one hit without looking at the bar.

     ⚠️ ONLY ON A KNOCKDOWN -- `box.def.knockdown` -- which is the same rule the
     enemies' grunt follows. It was wired to EVERY hit for one pass, on a
     mistaken count of how rare knockdowns are: I had read the cigarettes' plain
     punches, which set nothing, and concluded the voice would be a once-a-level
     event. It is not. Four attacks bowl the player over:

       BARATA_CHARGE.knockdown        the rolling ball, all through the roach waves
       HORSE_BOSS.chargeKnockdown     his charge
       HORSE_BOSS.kickKnockdown       his kick
       FlyBoss, `knockdown: ambush`   the Mosca's ambush pass

     ⚠️ AND THEN THE BOSSES WERE TAKEN OUT AGAIN, the same day. `Combat
     .bossHits` passes `false`, so of that list only the BARATA CHARGE reaches
     it -- both bosses come through one function and both were grunting.

     Requested, and it holds up: a boss's blows already announce themselves. The
     Mosca's ambush drops the player for no damage at all as its entire point,
     and the horse's charge has a wind-up you are meant to read. A voice under
     either is one cue too many on the loudest moments in the game. The strike
     sound still plays for both.

     ⚠️ SO "A KNOCKBACK HIT" IS A REAL CATEGORY and not a description of every
     blow -- but it is now the ROACH's charge specifically. `on: false` turns it
     off entirely; putting the bosses back is one argument in bossHits. */
  PLAYER_HIT_VOICE: { on: true, sfx: 'playerHit' },
  /* WHAT HE SAYS WHEN HE GOES DOWN FOR GOOD. Played on the blow that kills him,
     in place of the knockdown voice above rather than on top of it -- the same
     precedence the enemies' death takes over their grunt, and for the same
     reason: two voices out of one body in one frame is a mess.

     ⚠️ IT IS NOT THE GAME OVER STING. That is `GAME_OVER_STING`, it is MUSIC,
     it stops the bed, and it only happens on the LAST life. This is a voice, it
     plays on every death, and the two are a beat apart when they do coincide --
     this one on the blow, that one when the death has finished being watched. */
  PLAYER_DEATH_VOICE: { on: true, sfx: 'playerDeath' },
  goY: 150,
  /* ⚠️ THE 1.1 IS A SECOND PASS, asked for on 2026-08-26 -- "make the hand with
     the go and the arrow, 10% larger". Kept as a factor rather than folded into
     the number so the two stay obviously the SAME size relative to each other:
     the hand and the word are one prompt, and a single edit that multiplied
     only one of them is how they would drift apart. */
  goH: 74 * 1.3 * 1.1,    // on-screen height of the GO! art; width follows aspect
  goHandH: 54 * 1.3 * 1.1,  // on-screen height of the hand; width follows its aspect
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
  /* HOW LONG THE PLAYER MAY PUSH BACKWARDS AGAINST NOTHING before the arrow
     comes up to say which way the level is. Asked for on 2026-08-26, once
     cleared fights became checkpoints and walking back stopped being possible
     everywhere -- a wall the player cannot see is a wall that reads as the
     controls having stopped working.

     ⚠️ IT IS A HOLD, NOT A TAP. Short enough to answer a player who is lost,
     long enough that stepping back to pick up a barrel or line up a punch never
     summons it -- that is 1.2s of CONTINUOUS left against a wall, and the timer
     resets the moment they let go. */
  goBackNudgeS: 1.2,
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
