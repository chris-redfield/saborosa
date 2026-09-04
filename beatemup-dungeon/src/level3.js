/**
 * Level 3 — the bookcase — and the ONE room in this game that runs its own
 * logic end to end.
 *
 * ⚠️ THIS FILE EXISTS TO BE ISOLATED, AND THAT IS ITS WHOLE DESIGN. Asked for
 * 2026-08-27, in these words: *"please isolate this behavior to this level,
 * otherwise you will break other levels... Trying to make this logic work
 * alongside the other logic (the default one) will be our demise."* So level 3
 * does not GENERALISE the stage, the camera or the backdrop; it REPLACES them
 * for itself and touches nothing else. Every hook into shared code is a single
 * guarded early return, listed at the bottom of this comment, and every other
 * room reaches byte-for-byte the code it reached before this file existed.
 *
 * WHY IT NEEDED ITS OWN LOGIC AT ALL. The shot is a switchback climb of a
 * bookcase -- pan right along a shelf, rise, pan LEFT along the next, rise, pan
 * right along the last. The engine winds the plate with one ratio,
 * `film time = camX / worldPxPerSecond` (backdrop.js `_drawVideo`), and that
 * mapping cannot express this shot for two separate reasons:
 *
 *   1. ON SHELF 2 THE PLAYER WALKS LEFT, so camX goes DOWN -- which under that
 *      ratio means "wind the film BACKWARD", i.e. rewind them down the lift onto
 *      shelf 1. The film has to keep going forward while the feet go left.
 *   2. AND IT IS NOT A SIGN FLIP. A switchback visits the SAME camX three times
 *      at three different heights, so no function of camX alone can say which
 *      frame to show. The two ideas have to come apart: PROGRESS (monotonic,
 *      drives the film) and CAMERA X (goes right, then left, then right).
 *
 * `Level3.progress` is that first number. It is measured in FILM SECONDS, so
 * the mapping to the plate is the identity and there is no second unit to keep
 * in sync -- see `filmScroll()` for the one multiplication that hands it to a
 * backdrop expecting camera pixels.
 *
 * ⚠️ IT IS MONOTONIC **BETWEEN LEGS**, NOT WITHIN ONE, and the difference is
 * what point 2 above actually needs. Each leg maps its own camera band into its
 * own `film` window and the lifts drive it forward between them, so the windows
 * stay ordered and no camX is ever ambiguous -- while inside a leg it follows
 * the camera in both directions, because walking back has to run the shot back.
 * It was clamped to rise only until 2026-09-04, and that clamp is what froze the
 * plate whenever anyone walked left. See the note in `update`.
 *
 * ⚠️ THE LEGS ARE MEASURED, NOT DESIGNED. `CONFIG.LEVEL3.legs` comes out of
 * tools/build-level-3-plate.py, which phase-correlates the footage on BOTH axes
 * (the other plate tools only ever needed x) and prints the five runs. Re-cut
 * the clip and those numbers move; run the tool with `--measure` and paste.
 *
 * ⚠️ EACH WALK LEG GETS ITS OWN NON-OVERLAPPING BAND OF WORLD X, and the player
 * is teleported to the next band when a lift takes them. That sounds violent
 * and is invisible: the plate is drawn stationary and wound by `progress`, so
 * nothing on screen is a function of world x except entities, and the jump
 * happens mid-lift when the player has no control. The alternative -- letting
 * shelf 2 walk back over shelf 1's x -- would make world x ambiguous for
 * anything placed in the room later, which is a trap to leave for someone else.
 *
 * ⚠️ THE LIFTS CARRY THE PLAYER; THEY DO NOT LIFT HIM. On a rise the film pans
 * up while the player holds his screen position, and THAT is what reads as
 * going up -- the world scrolls down past a man standing still. Giving him a
 * `y` as well would move him twice. His feet stay on the belt the whole time,
 * which is also why nothing in combat.js or fighter.js has to know a lift
 * exists.
 *
 * THE PLATFORM IS THE REAL ART NOW -- three hand-drawn frames, cut by
 * tools/build-beat-elevador-defs.py, in place of the trapezoid this file used to
 * paint as a placeholder. It is still scenery in the scenery.js sense: nothing
 * collides with it, nothing stands on it for real, and the moment something has
 * to, it becomes a prop and leaves this file. Two things about it are load
 * bearing and neither is obvious -- the top face IS the walkable belt (see the
 * config note on why those are one number), and it is DRAWN somewhere the player
 * cannot stand, because centring it in the frame and boarding it are different
 * x. See `drawPlatform` and the band loop.
 *
 * THE HOOKS. Six of them, all one line, all guarded by `Level3.owns(room)`:
 *   stage.js   reset()        -> Level3.reset()
 *   stage.js   enterRoom()    -> Level3.enterRoom(room, player, stage)
 *   stage.js   update()       -> returns Level3.update(...)   (before anything)
 *   stage.js   bounds()       -> returns Level3.bounds(...)
 *   game.js    the draw loop  -> the backdrop gets filmScroll() in place of camX
 *   game.js    the draw loop  -> Level3.drawPlatform() under the fighters
 */
const Level3 = {
  progress: 0,      // FILM SECONDS. Monotonic BETWEEN legs -- see the header.
  _camX: 0,         // this room's camera, mirrored onto stage.camX each frame
  leg: 0,           // index into CONFIG.LEVEL3.legs
  legT: 0,          // seconds spent in the current leg (lifts are timed)
  done: false,
  _bands: null,     // world-x band per leg, resolved once on entering the room
  /* THE ELEVATOR'S PACK, handed in by the draw hook and held rather than passed
     around. ⚠️ NEITHER IS CLEARED BY `reset()`: they are the loaded art, not
     this run's state, and dropping them on a retry would re-hunt the atlas on
     the first frame of every attempt. */
  _assets: null,
  _art: null,
  _camDX: 0,        // how far the camera moved THIS frame, after its clamp
  _boiling: false,  // is the elevator animating right now
  _boilT: 0,        // its own clock -- only runs while it boils. See _tickBoil.

  /** Is this the bookcase? The guard every hook is wrapped in. */
  owns(room) { return !!(room && room.level3 && CONFIG.LEVEL3 && CONFIG.LEVEL3.on !== false); },

  cfg() { return CONFIG.LEVEL3; },
  legs() { return (CONFIG.LEVEL3 && CONFIG.LEVEL3.legs) || []; },
  current() { return this.legs()[this.leg] || null; },

  reset() {
    this.progress = 0;
    this.leg = 0;
    this.legT = 0;
    this.done = false;
    this._bands = null;
    this._camX = 0;
    this._camDX = 0;
    this._boiling = false;
    this._boilT = 0;
  },

  /**
   * Lay the world-x bands out and put the player at the start of the first.
   *
   * ⚠️ A WALK LEG'S BAND IS AS LONG AS ITS FILM PAN, which is what makes the
   * background move 1:1 with the feet -- the same thing `worldPxPerSecond`
   * buys every other room. `px` is the leg's pan already converted to the
   * 1280-wide canvas by the tool; using the source-pixel figure here would run
   * the shot about 1.5x fast and read as the player sliding.
   */
  enterRoom(room, player, stage) {
    this.reset();
    const legs = this.legs();
    const C = this.cfg() || {};
    const gap = C.bandGapPx || 4000;
    const pad = CONFIG.gateMarginX;
    const inset = C.startInsetPx || 200;
    let cursor = (room && room.startX != null) ? room.startX : 220;
    this._bands = [];
    this._prevLandScreen = null;
    for (let li = 0; li < legs.length; li++) {
      const L = legs[li];
      if (L.kind !== 'walk') { this._bands.push(null); continue; }
      /* ⚠️ THE BAND IS THE LEG'S PAN PLUS ONE SCREEN, and the extra screen is
         not slack. `px` is how far the CAMERA must travel for the film to cross
         the shelf, and a camera can only reach `hi - GAME_W`; without the screen
         on the end the camera would run out with a third of the shelf unseen. */
      const lo = cursor;
      const hi = cursor + L.px + CONFIG.GAME_W;
      const camLo = lo, camHi = hi - CONFIG.GAME_W;   // exactly `px` apart

      /* ⚠️ THE LIFT IS A WORLD OBJECT STANDING AT THE END OF THE SHELF. It used
         to be drawn at a fixed SCREEN position, which produced both halves of
         what was reported -- *"it just appears out of nowhere"* and *"the player
         only goes up after he touches the border, he kinda gets pushed to the
         middle"*. One cause: a thing pinned to the screen cannot be walked up
         to, so it had to be conjured when the far wall was hit and the player
         had to be dragged onto it. Given a world x it simply stands there, comes
         into view as the camera nears the end of the shelf, and is stepped onto.

         ⚠️ AND ITS PLACE IS CONSTRAINED BY THE CAMERA RATHER THAN CHOSEN. The
         film has to FINISH the shelf before the lift takes over, which means the
         camera must already be pinned at the end of its range when the player
         reaches the lift. Otherwise `progress` is still short of the leg's end
         and the shot jumps when the lift picks up its own film times -- ~0.7s,
         about 270px of pan on shelf 2, plainly visible.

         The camera pins when the player is `focus + deadzone` past its end
         walking right and `focus - deadzone` past it walking left:

             focus = GAME_W * camFocusX = 537.6,  deadzone = 130
             landing screen x must be  >= 667.6 right,  <= 407.6 left

         ⚠️ WHICH IS WHY "THE MIDDLE OF THE FINAL FRAME" COULD NOT BE TAKEN
         LITERALLY: 640 satisfies NEITHER. With a deadzone follow the player is
         never at screen centre while the camera is pinned -- he is at 667.6 or
         at 407.6 and nowhere between. Measured from the END WALL instead, one
         inset gives 940 walking right and 340 walking left: mirror images, and
         it reads as the lift being at the end of the shelf, which is what it
         is. `landingInsetPx` is the knob; raising it past ~367 pushes the
         leftward landing inside the pin point and the film jump comes back. */
      const hasLiftAfter = !!(legs[li + 1] && legs[li + 1].kind === 'lift');
      const inset2 = C.landingInsetPx || 300;
      const landing = hasLiftAfter
        ? ((L.dir < 0) ? lo + pad + inset2 : hi - pad - inset2) : null;
      /* Its screen position once the camera is pinned. The ride happens there,
         so the NEXT shelf has to hand the player back at the same screen spot
         or he pops sideways at the moment he steps off. */
      const landScreen = (landing == null) ? null
        : landing - ((L.dir < 0) ? camLo : camHi);
      /* Where he steps OFF the lift he arrived on: that same screen offset put
         back into THIS band's world x, so the platform is under his feet on the
         first frame of the new shelf and he walks away from it. */
      const arrival = (this._prevLandScreen != null)
        ? ((L.dir < 0) ? camHi : camLo) + this._prevLandScreen : null;
      this._prevLandScreen = landScreen;

      /* ⚠️ WHERE THE LIFT IS *DRAWN* IS NOT WHERE IT IS BOARDED, and separating
         the two is what finally answers "can it be in the middle of the frame?".
         The note above is still true and still binding -- the PLAYER cannot be
         at screen centre while the camera is pinned, so the point he has to walk
         to is stuck at 940 or 340. But that only ever fixed the DRAWING because
         the slab used to be painted centred on him.

         With the real art the difference matters: it is 960px wide against the
         placeholder's 620, so centred on the landing it hangs 140px off the
         right of the canvas -- *"the elevator is in the right corner"*. Drawn at
         `platScreenX` instead, it is centred in the frame and he boards it
         off-centre, which is what stepping onto a lift looks like anyway.

         ⚠️ THE STANDING WALLS FOLLOW THE DRAWING, NOT THE LANDING (see
         `bounds`), and the two numbers have to keep letting him board without a
         jolt: he arrives at the landing, so the landing must be INSIDE
         `platX +/- widthPx * standHalfRel` or he is clamped sideways on the
         frame the ride begins -- the one thing the hand-over is built not to do.
         At 960 and 0.35 that is +/-336 against a 300px offset, so he boards 36px
         inside the near end of his own walking room. Widen the offset or narrow
         `standHalfRel` and that margin is what goes first. */
      const platS = (C.platScreenX != null) ? C.platScreenX : CONFIG.GAME_W / 2;
      const platX = (landing == null) ? null
        : ((L.dir < 0) ? camLo : camHi) + platS;
      /* The lift he STEPPED OFF, drawn at the same screen spot it occupied
         during the ride -- the camera has not moved, so that is the same
         `platS` measured from this band's other end. */
      const arrivalPlatX = (arrival == null) ? null
        : ((L.dir < 0) ? camHi : camLo) + platS;

      /* `from` is always where the player ENTERS and `to` where they LEAVE,
         whichever way that is in x, so nothing downstream has to sort them.

         ⚠️ `to` IS THE LIFT NOW, NOT THE WALL. Stepping onto the platform is
         what ends the leg, so there is no separate "walked into the boundary"
         event any more -- which is the whole of what was asked for. The wall is
         still there behind it as a backstop and should never be reached. */
      const from = (arrival != null) ? arrival
        : ((L.dir < 0) ? hi - pad - inset : lo + pad + inset);
      const to = (landing != null) ? landing
        : ((L.dir < 0) ? lo + pad : hi - pad);
      this._bands.push({ lo, hi, from, to, camLo, camHi, landing, arrival,
                         platX, arrivalPlatX });
      cursor = hi + gap;
    }
    /* ⚠️ `stage` IS PASSED SO THE CAMERA MOVES WITH HIM, AND LEAVING IT OFF WAS A
       BUG YOU COULD WATCH. Reported 2026-08-31: *"the player character is already
       at the room, but then vanishes and appears walking from the left"*.

       `Stage.enterRoom` sets `camX = 0` and then hands over to this; without the
       stage, `_place` set only OUR `_camX` and the stage's stayed at 0 until the
       first frame of `play`. And the room swap happens at the blackest point of
       a fade, during which `game.js` ticks NOTHING but the flies -- so the whole
       fade-in was drawn with the camera 220px behind where this room's camera
       actually starts. He stood, in view, at screen x 100; the first play frame
       snapped the camera to 220, put him at -120 (off the left edge), and only
       then did his walk-in start. Two entrances, one after the other.

       ⚠️ IT IS ONLY THIS ROOM BECAUSE IT IS THE ONLY ROOM WHOSE CAMERA DOES NOT
       START AT 0. Everywhere else `camX = 0` is already the right answer, so
       nothing was ever placed wrongly and nothing had to be corrected. */
    this._place(player, stage);
  },

  /**
   * Put the player and the camera at the start of the current leg's band.
   *
   * ⚠️ THE CAMERA IS MIRRORED ONTO THE STAGE HERE AND NOT ONLY IN `_camera`,
   * because `bounds()` is asked for the walls before this room's `update()`
   * runs on the frame a lift hands over. A stage camera still parked on the
   * PREVIOUS band gives walls from one leg and a player from the next -- and
   * since the bands are 4000px apart, `minX` comes out ABOVE `maxX`, the clamp
   * resolves to `minX`, and the player is teleported to the far end of the
   * shelf. Shelf 2 completed in a single frame exactly this way.
   */
  _place(player, stage) {
    const b = this._bands && this._bands[this.leg];
    if (!b) return;
    const L = this.current();
    if (player) player.x = b.from;
    this._camX = (L && L.dir < 0) ? b.camHi : b.camLo;
    if (stage) { stage.camX = this._camX; stage.camTarget = this._camX; }
  },

  /** The band the player is walking in, or the last one seen during a lift. */
  band() {
    if (!this._bands) return null;
    for (let i = this.leg; i >= 0; i--) if (this._bands[i]) return this._bands[i];
    return null;
  },

  /**
   * The number the backdrop is handed INSTEAD of camX.
   *
   * ⚠️ `_drawVideo` DIVIDES BY `worldPxPerSecond` AND THIS MULTIPLIES BY IT, and
   * that round trip is deliberate rather than silly: it means backdrop.js keeps
   * exactly the code every other room uses and never learns that a room with a
   * progress clock exists. `progress` is already in film seconds, so this is the
   * one place the two units meet.
   */
  filmScroll() {
    const src = (CONFIG.SOURCES && CONFIG.SOURCES[this.cfg().plateSource]) || null;
    const pps = (src && src.worldPxPerSecond) || 116;
    return this.progress * pps;
  },

  /**
   * Drive the room. Returns 'clear' on the frame the last leg finishes, which
   * is the same contract stage.update() has with game.js.
   */
  update(dt, stage, player) {
    const L = this.current();
    if (!L || this.done) return this._finish(stage);
    this.legT += dt;
    /* ⚠️ CLEARED EVERY FRAME AND SET BY `_camera`, so a leg that never calls it
       (a lift) reads as a still camera instead of keeping the last walk's
       value. */
    this._camDX = 0;

    if (L.kind === 'lift') {
      /* ⚠️ INPUT IS NOT DISABLED HERE, THE WALLS ARE CLOSED (see bounds()).
         Freezing the controls would also freeze his facing and his idle, and a
         rider who cannot even turn round reads as the game having hung. He can
         walk and swing on the platform; he simply has nowhere to go.

         ⚠️ AND THERE IS NO LONGER ANY BOARDING MOVE. There used to be a 0.35s
         ease that slid him onto the platform, because he reached the lift by
         walking into the far WALL, ~380px past it. Now the platform IS the end
         of the leg -- he is standing on its centre on the frame the ride starts,
         because touching it is what started the ride. Nothing to correct, and
         *"he kinda gets pushed to the middle of the screen"* goes with it. */
      const t = Math.min(1, this.legT / L.sec);
      this.progress = L.film[0] + (L.film[1] - L.film[0]) * t;
      /* THE CAMERA HOLDS. A rise is vertical and this camera is horizontal --
         what moves is the FILM, and the man standing still in front of it is
         the whole illusion (see the header). */
      stage.camX = this._camX;
      stage.camTarget = this._camX;
      this._tickBoil(dt, true);
      if (t >= 1) return this._nextLeg(stage, player);
      return null;
    }

    // --- a walk leg --------------------------------------------------------
    const b = this._bands[this.leg];
    this._camera(dt, stage, player, L, b);
    this._tickBoil(dt, false);

    /* ⚠️ PROGRESS IS DRIVEN BY THE CAMERA, NOT BY THE PLAYER, and that is the
       same rule every other room follows -- `worldPxPerSecond` ties the film to
       CAMERA travel, because the shot's own pan IS the parallax. Driving it off
       the player would wind the film while he crosses the last screen with the
       camera already pinned at the end of the band, and the shelf would run out
       from under him.

       ⚠️ IT USED TO BE CLAMPED SO IT COULD ONLY GO UP, AND THAT WAS THE BUG.
       The argument was that a backward step is a SEEK and a seek decodes from
       the previous keyframe, so a player shuffling on the spot should not be
       able to spend that. What it actually bought was the shot FREEZING the
       moment anyone walked left, reported 2026-09-04 as *"a HUGE BUG... the
       video won't play in reverse. It will just freeze. The character can still
       move, but the video gets frozen."* Trading a decode nobody notices for a
       dead backdrop everybody does is the wrong way round, and the cost was
       never actually measured -- the clip already ships GOP 12 (checked:
       keyframe every twelfth frame), so a step back decodes at most twelve.

       ⚠️ AND `progress` IS STILL MONOTONIC WHERE IT MATTERS -- BETWEEN LEGS.
       That is what the header means by "the whole trick": the switchback visits
       the same camX three times, so the film position cannot be a function of
       camX alone. It still is not. Each leg maps its own camera band into its
       OWN `film` window (leg 0 into 0..18.98, leg 2 into 32.68..46.96) and the
       lifts drive it forward between them, so the windows stay ordered and a
       camX is never ambiguous. What was given up is monotonicity WITHIN one leg,
       which was never what made this work.

       ⚠️ NOR WAS THE CLAMP WHAT HANDED THE LIFT A FINISHED SHELF. That is the
       camera being PINNED at the end of its band before the player can reach the
       platform -- see the note on the platform's placement, which is where the
       0.7s film jump was actually fixed. `f` reaches 1 because the camera is
       pinned, not because the maximum was remembered.

       Reverse is a seek, and the seeking is backdrop.js's business: the source
       already declares `allowReverse: true` and its `camSpeed < -1` branch keeps
       a frozen frame up while the seek lands. */
    const f = (L.dir < 0) ? (b.camHi - this._camX) / L.px
                          : (this._camX - b.camLo) / L.px;
    this.progress = L.film[0]
                  + (L.film[1] - L.film[0]) * Math.max(0, Math.min(1, f));

    // Reached the far end of the shelf: the lift is waiting.
    const arrived = (L.dir < 0) ? (player.x <= b.to) : (player.x >= b.to);
    if (arrived) return this._nextLeg(stage, player);
    return null;
  },

  _nextLeg(stage, player) {
    this.leg++;
    this.legT = 0;
    const L = this.current();
    if (!L) return this._finish(stage);
    if (L.kind === 'lift') {
      /* A lift owns no band and needs no placement: the player is already
         standing on the platform, which is why touching it ended the last leg.
         The camera does not move either -- it was pinned at the end of its range
         before he could reach the landing at all. */
      return null;
    }
    this._place(player, stage);
    return null;
  },

  /**
   * Out of legs.
   *
   * ⚠️ 'room' vs 'clear' DECIDES WHETHER THE GAME ENDS HERE, AND THIS ASKS
   * RATHER THAN KNOWING. game.js reads this room's return value with exactly the
   * same switch it reads the shared stage's: 'room' is a door -- walk the player
   * out, fade, load the next room -- and 'clear' is the end of the whole game,
   * which rolls the ending card.
   *
   * ⚠️ AND THE ANSWER HAS NOW FLIPPED, WITHOUT THIS LINE CHANGING. The bookcase
   * used to have the boss room after it, so it was a door; since the 2026-09-04
   * swap it is the LAST room and this returns 'clear'. That flip is the entire
   * payoff of asking `hasNextRoom()` instead of hard-coding an answer -- the
   * room order moved in config and no logic here did. */
  _finish(stage) {
    this.done = true;
    return (stage && stage.hasNextRoom && stage.hasNextRoom()) ? 'room' : 'clear';
  },

  /**
   * The camera, owned outright rather than shared.
   *
   * ⚠️ stage._followCamera IS BUILT ON "FORWARD IS RIGHT" -- it has an explicit
   * note that walking left must never earn budget -- so shelf 2 would fight it
   * every frame. This is the same deadzone idea written symmetrically: the
   * camera trails the player in whichever direction the LEG runs, and is penned
   * to the leg's own band so it can never wander onto ground the film is not
   * showing.
   */
  _camera(dt, stage, player, L, b) {
    const focus = CONFIG.GAME_W * CONFIG.camFocusX;
    const dz = CONFIG.camDeadzone;
    const sx = player.x - this._camX;
    let step = 0;
    if (sx > focus + dz) step = sx - (focus + dz);
    else if (sx < focus - dz) step = sx - (focus - dz);
    /* PENNED TO THE LEG'S OWN BAND. `camLo`/`camHi` are exactly `px` apart --
       the leg's film pan -- so the camera cannot wander onto ground this stretch
       of the shot does not show. */
    /* ⚠️ MEASURED AFTER THE CLAMP, NOT FROM `step`. `step` is what the deadzone
       ASKED for, and at either end of the band the answer is refused -- the
       player keeps walking into a pinned camera and `step` stays fat while
       nothing on screen moves. Reading the clamped result is the difference
       between "he is pushing" and "the world is sliding", and the boil wants
       the second one. */
    const was = this._camX;
    this._camX = Math.max(b.camLo, Math.min(b.camHi, this._camX + step));
    this._camDX = this._camX - was;
    stage.camX = this._camX;
    stage.camTarget = this._camX;
  },

  /**
   * The walls. On a lift they close to the platform; on a shelf they are the
   * band's ends, which is the same "you may not walk out of the shot" rule the
   * shared bounds() states -- just applied in both directions.
   */
  bounds(stage) {
    const L = this.current();
    const m = CONFIG.gateMarginX;
    /* ⚠️ OFF `this._camX`, NEVER `stage.camX`. This room owns its camera and
       writes it onto the stage as a courtesy; reading it back would mean reading
       a value that is one frame stale exactly when it matters -- see `_place`.
       The rule for anything added here: level3 is the source of truth for its
       own camera and the stage is the mirror, not the other way round. */
    const cam = this._camX;
    if (!L) return { minX: cam + m, maxX: cam + CONFIG.GAME_W - m };
    if (L.kind === 'lift') {
      /* ⚠️ THE PLATFORM IS A WORLD OBJECT NOW, SO ITS WALLS NEED NO CONVERSION,
         and the bug that used to live here is worth remembering: the rect was in
         SCREEN space and was returned raw as world bounds, which clamped the
         player to screen x -3010 -- three screens to the left -- and read as
         *"the character vanishes and the elevator goes up by itself"*. */
      const P = (this.cfg() && this.cfg().platform) || {};
      /* ⚠️ THE PLATFORM'S DRAWN x, NOT THE BOARDING POINT. They are different
         numbers since the lift was centred in the frame, and the walls belong to
         the thing he is standing on -- penning him around the landing would let
         him walk off the right-hand end of a slab that is no longer under it. */
      const at = this._liftPlatX();
      if (at == null) return { minX: cam + m, maxX: cam + CONFIG.GAME_W - m };
      const half = (P.widthPx || 960) * (P.standHalfRel || 0.35);
      return { minX: at - half, maxX: at + half };
    }
    const b = this._bands[this.leg];
    return { minX: Math.max(b.lo, cam + m),
             maxX: Math.min(b.hi, cam + CONFIG.GAME_W - m) };
  },

  /**
   * The platform's geometry on screen, given where it stands in the WORLD.
   *
   * ⚠️ WORLD SPACE AND NOT SCREEN SPACE -- this is the reverse of what it used
   * to be, and the reversal is the whole fix. A lift pinned to the screen cannot
   * be approached, so it had to appear at the end of the walk and drag the
   * player aboard. Standing at a world x it comes into view on its own as the
   * camera nears the end of the shelf, and walking onto it is the event.
   *
   * It still ends up motionless on screen during the ride -- but for a REASON
   * now rather than by construction: the camera is pinned at the end of its
   * range before the player can reach the landing, so `worldX - camX` stops
   * changing on its own. That is also what makes the hand-over seamless; nothing
   * moves on the frame the ride begins.
   */
  platformRect(worldX, camX) {
    const P = (this.cfg() && this.cfg().platform) || {};
    const A = this.art();
    const wFront = P.widthPx || 1010;
    /* ⚠️ THE NEAR LIP SITS ON THE BELT'S NEAR EDGE, and that is now the whole
       of the placement -- the `zRel`/`depthRel` pair it used to take is gone.
       A drawn trapezoid had to be TOLD how deep it was; an illustrated one
       already is, so the only freedom left is how wide to draw it, and where
       the front edge lands follows from the belt. See the config note on why
       the two depths are one number. */
    const y = Belt.topY + Belt.depth;
    return {
      cx: worldX - camX + (P.offsetX || 0),   // screen x of the lip's centre
      y,                                      // screen y of the lip
      wFront,
      scale: A ? wFront / A.frontW : 1,
    };
  },

  /**
   * Where the lift being ridden is DRAWN, in world x.
   *
   * ⚠️ RESTORED AFTER I DELETED IT. Replacing the drawn slab meant rewriting the
   * tail of this file and this four-line accessor sat inside the replaced range,
   * so `drawPlatform` and `bounds` both called a method that was no longer
   * there -- an every-frame TypeError on the first draw of the room, which is
   * to say the room did not run at all.
   */
  _liftPlatX() {
    const prev = this._bands && this._bands[this.leg - 1];
    return prev ? prev.platX : null;
  },

  /**
   * The art, once the loader has it. Null until then, which is a real state:
   * `drawPlatform` draws nothing rather than falling back to a shape, because a
   * trapezoid appearing for one frame where the elevator will be is a worse
   * failure than an empty shelf -- it reads as the placeholder coming back.
   */
  art() {
    /* ⚠️ IT MOVED TO src/elevador.js ON 2026-09-04, when HIPÓLITO's room got a
       lift of its own. What stayed here is everything about WHERE this room's
       lifts stand and which are on screen; what left is how to draw one, which
       was never about the bookcase. The miss-is-not-cached rule went with it --
       see that file. */
    return Elevador.art(this._assets);
  },

  /**
   * WHEN THE ELEVATOR IS ALIVE, and it is a question about MOTION rather than
   * about which leg is running.
   *
   * The rule arrived in two halves. First: *"when the elevator is not moving, it
   * should use only frame 1, when it starts moving vertically, it should cycle
   * the 3 frames"*. Then, widened: *"when the camera is moving, like when the
   * elevator is moving referent to the camera, also make it animate with the 3
   * frames, only when the camera is stopped we use the single frame"*.
   *
   * So it boils when it is MOVING RELATIVE TO THE VIEWER, by either route:
   *
   *   the camera pans   -- a parked lift at the end of a shelf slides across the
   *                        screen while he walks, and stops dead when he does
   *   the ride          -- ⚠️ AN EXPLICIT EXCEPTION, not the same rule twice.
   *                        During a rise the platform is motionless in screen
   *                        space by construction (see `platformRect`) and it is
   *                        the PLATE that pans, so relative motion is exactly
   *                        zero. Left to the camera test the lift would freeze
   *                        for the whole climb -- and the boil is the ONLY thing
   *                        on screen saying it is moving, so it would read as
   *                        stuck. Hence the `riding` flag.
   *
   * ⚠️ AND IT HAS ITS OWN CLOCK RATHER THAN READING `legT`. A boil driven by the
   * leg timer keeps advancing while it is held on frame 0, so every time the
   * player stopped and started the drawing would jump to wherever the timer had
   * got to. `_boilT` only runs while `_boiling`, so stopping holds and walking
   * on resumes from the frame it held.
   */
  _tickBoil(dt, riding) {
    const P = (this.cfg() && this.cfg().platform) || {};
    const eps = (P.camStillPx != null) ? P.camStillPx : 0.05;
    this._boiling = riding || Math.abs(this._camDX || 0) > eps;
    if (this._boiling) this._boilT += dt;
  },

  _liftFrame() {
    const A = this.art();
    const n = A ? A.frames.length : 1;
    if (!this._boiling || n < 2) return 0;
    const ms = (this.cfg() && this.cfg().platform && this.cfg().platform.boilMs) || 110;
    return Math.floor(this._boilT * 1000 / ms) % n;
  },

  /**
   * The elevator. Three hand-drawn frames, in the belt's own perspective.
   *
   * ⚠️ THE PERSPECTIVE IS IN THE DRAWING, NOT IN THIS FILE ANY MORE. The slab
   * that shipped here was code -- a trapezoid narrower at the back, a grating
   * that converged with it, and rails on the back corners only -- built to be
   * thrown away when the art landed. All of it is gone rather than kept as a
   * fallback: the shape, the seven slats, the four colours and the rails, which
   * the illustrator did not draw and the room does not need.
   *
   * What survives is the RELATIONSHIP, and it is the reason the drawn slab was
   * written that way: the top face is exactly as deep as the walkable belt, so
   * every z the player can reach is a z with platform under it. The old code
   * approximated that with `depthRel` and got 42% of it. See `tools/
   * build-beat-elevador-defs.py` for where the numbers come from.
   *
   * Drawn only where a lift stands, and behind every fighter.
   */
  drawPlatform(ctx, stage, assets) {
    if (assets) this._assets = assets;
    const A = this.art();
    if (!A) return;
    const L = this.current();
    if (!L || !this._bands) return;
    const camX = this._camX;
    /* ⚠️ EVERY LIFT THAT IS ON SCREEN, NOT JUST THE ONE BEING RIDDEN. On a walk
       leg that means the lift AHEAD (standing at the end of the shelf, coming
       into view as the camera nears it -- *"is it possible for the elevator to
       already be there when we arrive?"*) and the one BEHIND, which he stepped
       off a moment ago and which should recede rather than blink out. */
    const at = [];
    if (L.kind === 'lift') {
      at.push(this._liftPlatX());
    } else {
      const b = this._bands[this.leg];
      if (b) { at.push(b.arrivalPlatX); at.push(b.platX); }
    }
    /* ONE FRAME FOR EVERY LIFT ON SCREEN, which is right because the thing that
       decides it -- the camera -- is shared by all of them. Both lifts on a walk
       leg slide by the same amount, so they boil together; see `_tickBoil`. If a
       lift ever moves on its OWN (a second one rising in the background), this
       becomes a per-lift question and the call moves inside the loop. */
    const f = this._liftFrame();
    for (const worldX of at) {
      if (worldX == null) continue;
      const r = this.platformRect(worldX, camX);
      // Culled on the slab's own width, like everything else that scrolls.
      if (r.cx + r.wFront < 0 || r.cx - r.wFront > CONFIG.GAME_W) continue;
      this._drawSlab(ctx, A, f, r);
    }
  },

  /** One slab. Split out so the draw loop above stays about WHICH lifts. */
  _drawSlab(ctx, A, f, r) {
    Elevador.draw(ctx, this._assets, f, r);
  },
};
