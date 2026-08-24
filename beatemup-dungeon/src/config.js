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
    /* ⚠️ OFF. This is the shipping state, and `package.sh` refuses to build
       while it is true -- so a forgotten `true` costs a failed build rather
       than a shipped cheat.

       It went off for the first itch build on 2026-08-22, back on the same day
       to test the horse fight and the barrels, off again for the final package,
       on again on 2026-08-23 to walk the level end to end after the jam pass,
       and off again to package it. Everything below is dead while it is false,
       and so is the number-key ROOM JUMP, which is refused in input.js as well
       as here (see the note there). */
    on: false,
    /* vs the real string's 4 / 5 / 6 / 4 / 9.

       ⚠️ THIS IS THE ONE THING THAT MAKES A DEV SESSION UNABLE TO JUDGE THE
       FIGHT -- at 50 a punch the horse dies in three combos and every mook in
       one. So it has its own escape hatch: `combat.js` reads it as
       `punchDamage != null`, which means setting this to **null** keeps the
       room jumps and the readout while leaving the DAMAGE REAL. Use that to
       walk the level for pacing; use 50 to get somewhere quickly. */
    punchDamage: 50,

    /* WHICH ROOM THE GAME STARTS IN, by index into ROOMS. 0 is the street, 1
       the boss room. Testing a late room by playing to it is how a late room
       stops getting tested; this is the shortcut.

       The NUMBER KEYS do the same thing live -- 1 for the first room, 2 for the
       second -- so a room can be jumped to mid-session without touching this
       file. Both are dev-only and dead when `on` is false. */
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

  /* --- Old-film style (post effect) ---------------------------------------
     STILL LIFE'S FILTER, COPIED VALUE FOR VALUE on request (2026-08-22), and
     `src/film.js` is that game's file unchanged. The headline is the FRAME
     LINE: the dark gap between two film frames rolling down the picture like a
     misframed projector. Around it: grain, brightness flicker, a vignette, gate
     weave, and the odd scratch. Colour is KEPT -- these are projector
     artifacts, not a black-and-white grade.

     ⚠️ THREE OF THESE HAVE SINCE BEEN SOFTENED AND NO LONGER MATCH STILL LIFE.
     Seen on this game's plate the flicker read as a blink rather than as a
     projector -- watched on the wall photograph and the filmed street it is the
     one artifact with nowhere to hide, where over there it sits under a busy
     scrolling world. So on the same day it landed: the dip is 30% shallower and
     it is HELD more than three times as long (24ms -> 80ms), which is the part
     that was actually wrong -- a value re-rolled every 24ms changes ~42 times a
     second and the eye reads that as strobing, not as a lamp. The scratch came
     down 30% with it. Still Life's originals are in the comments beside each.

     ⚠️ EVERYTHING ELSE HERE IS THAT GAME'S, VALUE FOR VALUE, and should stay
     that way: the point of the request was that the two games look like they
     came off the same projector. If the grain, the vignette or the weave move,
     move them in flying-dungeon/src/config.js too. They are duplicated rather
     than imported for the same reason TITLE_FONT is: each game's config.js is
     self-contained.

     ⚠️ IT SITS OVER EVERYTHING, INCLUDING THE HUD AND THE END CARDS, which is
     one difference from that game -- there the HUD is drawn outside the film
     pass. Here the whole frame is one projected picture: the grain, the
     vignette and the 1.4px gate weave take the health bar with them. If the
     HUD ever needs to sit outside it, the split point is `renderFilmed()` in
     game.js, not a knob in here. */
  /* ⚠️ OFF. It was built, seen, and turned down on the day it landed
     (2026-08-22): "it causes a terrible feeling". The flicker was softened
     first -- see the note above -- and it still was not wanted, so the answer
     is not another pass on these numbers.

     EVERYTHING BELOW STAYS, AND THE CODE PATH STAYS, on request: `film.js`,
     `renderFilmed()` and this whole block are live and one flag from working.
     Set this true to see it again. Do not delete any of it to tidy up. */
  film: false,
  filmBarSpeed: 60,      // px/sec the frame-gap bar rolls down
  filmBarHeight: 0,      // px thickness of the dark frame gap (0 = no frame line)
  filmBarDark: 0.78,     // how dark the gap gets (0-1)
  filmGrain: 0.11,       // grain opacity
  filmFlicker: 0.042,    // max brightness dip (black overlay alpha). 0.06 there
  /* How long ONE brightness value is held before a new one is rolled -- this is
     the BLINK RATE, and it is the knob that matters. At Still Life's 24ms the
     lamp changes ~42 times a second, which strobes; at 80 it changes ~12 times,
     which breathes. Raise it further to slow the flicker, lower it to bring the
     strobe back, 0 = a new value every single frame. */
  filmFlickerMs: 80,     // 24 there
  filmVignette: 0.22,    // corner darkening strength
  filmWeave: 1.4,        // px vertical gate jitter of the whole picture
  filmScratchChance: 0.028, // per-frame chance of a vertical scratch. 0.04 there
  /* Optional CSS grade on the canvas element (kept EMPTY = full colour). A
     gentle 'contrast(1.08)' would add filmic punch; desaturation would not be
     this effect. Empty in Still Life too. */
  filmCss: '',

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
  beltTopY: 520,         // screen y of z = 0 — the FAR edge of the walkable band
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
    /* THE FLIES, BETWEEN THE PLATE AND THE FIGHTERS. They live in the band
       above the belt, so in practice they overlap nothing and the order barely
       matters -- except for a jumping coconut at the back of the belt, who
       should pass IN FRONT of something that is up by the rooftops. Declared as
       a layer rather than drawn inline for the reason the entities layer is:
       where a thing sits in the stack is level data, not a line buried in
       render(). Off with `CONFIG.FLIES.on` -- see the note there. */
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
      src: 'v2:beatemup-dungeon/batidao-de-coco-background-original.mp4',

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
      reverse: false,
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
    /* THE MOSCA. Locks the camera like an arena — it is one, with one very
       large occupant — and ends when the boss is dead. It is a SUB-boss: the
       level carries on past it. */
    { kind: 'boss' },

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
    },],
    },

    /* THE BOSS ROOM. Small on purpose: 337px of camera travel, about a quarter
       of a screen, so the camera barely moves and mostly just breathes with the
       player. The fight is what the room is for, not the walk. */
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
        { kind: 'boss', who: 'horse' },
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
               drawScale: 0.8,
               poses: {
                 idle:      { anim: 'idle' },       // 4: two drawings + mirrors
                 smash:     { anim: 'brk' },
                 smash2:    { anim: 'brk2' },
                 side:      { anim: 'side' },       // carried, and in flight
                 smashSide: { anim: 'brkSide' },
                 /* ONE ROW, TWO OBJECTS: slot 0 is the roast chicken and slot 1
                    the drumstick, so each is a one-frame slice of `food`. */
                 chicken:   { anim: 'food', from: 0, to: 1 },
                 coxinha:   { anim: 'food', from: 1, to: 2 },
                 /* ⚠️ CUT BUT NOT WIRED, like the coconut's pickup rows were
                    before barrels arrived. The sheet carries six frames of a
                    lit bomb and there is no bomb mechanic; they are named here
                    so that deciding to have one is a one-line change rather
                    than a trip back to the cutter. */
                 bomb:      { anim: 'bomb' },
                 bomb2:     { anim: 'bomb2' },
               } },

    cigarro3: { sheet: 'v2:beatemup-dungeon/cigarro3-beat', pack: 'ragged',
                name: 'DEDÉ',
                drawScale: 1.691,
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
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
    carryThrow: { anim: 'liftThrow', from: 2, to: 5 },
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
     invisible forever. */
  corpseFadeDelayS: 0.6,
  corpseFadeS: 1.2,

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

  /* =========================================================================
     PROPS -- BARRELS AND FOOD
     =========================================================================
     Added 2026-08-22 off one sheet. A barrel can be punched apart or picked up
     and thrown; food is walked over and eaten. The art and the pose names are
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
         from there and this is what can be hit. 0.8 x fighterSizePx is 110. */
      sizePx: 110,
      hitWRel: 0.8,      // hurtbox width, as a fraction of sizePx
      hitZ: 46,          // and its depth on the belt, in px
      /* How close he has to be to pick it up. Generous in x and tight in z, the
         same shape every reach in this game has: the belt is 210px deep and a
         barrel two lanes away should not jump into his hands. */
      liftRangeX: 74,
      liftRangeZ: 46,
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
      carryYRel: 0.70,
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
      },

      /* THE THROW. Fast and flat: 520px/s with a small upward kick, so it
         crosses about two thirds of the screen before it lands rather than
         lobbing. `throwGravity` is what brings it down; raise the lift and the
         gravity together to keep the same distance with a higher arc. */
      throwSpeed: 520,
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
         chicken -- against about ten items before. */
      dropChance: 0.35,
    },
    food: {
      /* WHAT EATING IS WORTH, as a fraction of the visible bar. A half and a
         third, as asked for: 55 and 37 HP against `playerHealth` 110.

         ⚠️ CAPPED, NOT BANKED, decided 2026-08-22. The heal fills the bar and
         anything past it is LOST -- it does not roll over into restoring a life.
         Both readings were put and this is the one chosen, so a chicken eaten
         at 100/110 is worth ten points and not a spare life. Pickup.update()
         is the one place that clamps. */
      chickenRel: 0.5,
      coxinhaRel: 1 / 3,
      /* Reach. ⚠️ FOOD IS TAKEN BY WALKING OVER IT, not with the button -- the
         button lifts barrels, and putting both on it means the player who
         wanted the barrel gets the chicken lying next to it. */
      rangeX: 52,
      rangeZ: 40,
      /* And not while jumping over it. A drumstick eaten from the top of a jump
         is a drumstick that was never picked up. */
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
  enemyHealth: { cigarro2: 40, cigarro: 34, cigarro3: 55, barata: 50, barata2: 66 },

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
  enemySpeedScale: { cigarro2: 0.72, cigarro: 0.88, cigarro3: 0.58,
                     // Faster than any cigarette. It is a roach; it should
                     // skitter, and the charge only reads as a charge if the
                     // walk it interrupts was already brisk.
                     barata: 1.05, barata2: 0.9 },
  /* IGNORED FOR A KIND THAT HAS A COMBO — its hits carry their own damage, in
     ENEMY_COMBOS below. The cigarette's entry is kept as the number his string
     was balanced against (JUIXY's old swing), and because dropping him out of
     these three tables would make him look like a kind that has no stats. */
  enemyDamage: { cigarro2: 7, cigarro: 5, cigarro3: 10, barata: 6, barata2: 8 },
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
  enemyComboWeights: {
    cigarro:  [4, 3, 3],
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

     NOTHING DRAWS IT YET. Names only surface on the CLEAR board, through
     stats.downedBy(), which walks CHARACTERS and therefore cannot see this one.
     It is recorded so the name exists in one place when a boss nameplate is
     wanted, rather than being retyped into whatever draws it first. */
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
  titleWalkAfterMs: 250,
  titleWalkStartXRel: -0.12,   // off the left edge, so he walks ON
  titleWalkEndXRel: 1.12,      // and keeps going until he is clear of the right
  titleWalkSpeed: 210,         // px/s -- the ending's, so the two walks match
  titleWalkGroundYRel: 0.93,   // his feet, down the canvas: the near dirt
  titleWalkScale: 1.0,
  /* Gap before he crosses AGAIN, in ms. 0 = he crosses once and the screen is
     still after that, which is what was asked for. Set it to a couple of
     seconds if a title left sitting for minutes ever wants to keep moving --
     the crossing itself takes about seven seconds at these numbers. */
  titleWalkRepeatMs: 0,

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
     TIME OVER; here it says PERDEU!

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
    /* The lettering. Same machinery and the same numbers as that game's
       `overTitle`, so the two screens are set identically -- and the FONT is
       `TITLE_FONT`, which is already its stack.

       THE WORD IS NOT LISTED HERE ON PURPOSE. It comes from
       `RESULTS.LABELS.lost`, so PERDEU! is written in exactly one place and the
       death card and this panel can never disagree. Set `words` to override. */
    title: {
      sizePct: 20.4,     // % of canvas height
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
       1.5 seconds AFTER the pose lands, not after he starts walking. */
    poseHoldMs: 1500,
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
  MUSIC_LOOP: {
    music: 5.115,
    musicTitle: 60.107,
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
  /* Per-track level on the music bus, by ASSET KEY. Anything unlisted plays at
     `musicVolume` flat. It trims AND it lifts -- above 1 is allowed and the
     title theme needs it.

     ⚠️ THE BED'S LEVEL IS THE FIXED POINT AND MUST NOT MOVE. It is balanced
     against the punch effects, so every other track is brought to it rather
     than the other way round. Measured RMS, which is what these numbers came
     from:

       music      -16.9 dBFS   the bed, at 1.0 -- the reference
       musicBoss  -13.7 dBFS   a finished mix, hotter -> 0.85 puts it at -15.1
       musicTitle -26.5 dBFS   MIKE is mastered quiet -> 2.6 puts it at -18.2

     musicTitle sits a little UNDER the bed on purpose: it is a dense full mix
     against a sparse percussion loop, and matched by RMS the dense one reads as
     the louder of the two. Its buffer peaks at 0.31, so 2.6 is nowhere near
     clipping the bus. */
  MUSIC_GAIN: {
    musicBoss: 0.85,
    musicTitle: 2.6,
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
