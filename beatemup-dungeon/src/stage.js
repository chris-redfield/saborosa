/**
 * Stage — the level director. Walks CONFIG.SEGMENTS, drives the camera, raises
 * the arena walls, and spawns the crowd.
 *
 * A beat 'em up level is a SEQUENCE OF SEGMENTS alternating between walking and
 * fighting, and that alternation is the genre's spine:
 *
 *     scroll   the camera follows the player rightward. Nothing stops them but
 *              the end of the segment.
 *     arena    THE CAMERA LOCKS. Walls go up at both edges of the view, the
 *              listed enemies walk in, and neither the camera nor the player
 *              may leave until every one of them is down.
 *
 * THE LOCK IS WHAT COMMUNICATES THE FIGHT, and it does it without a word of
 * UI. Every player of this genre already knows what a camera refusing to scroll
 * means. That is why the walls are invisible: the camera stopping IS the
 * message, and drawing a gate on top of it would be saying the same thing
 * twice. (They can be seen on the debug key.)
 *
 * THE SEGMENT ALSO SETS THE BACKDROP'S MODE, which is the whole reason the
 * backdrop is a source rather than an image. Once the footage lands, a scroll
 * segment scrubs the film by camera position (a dolly — walking winds the shot
 * forward) and an arena plays it on time in a loop (the world alive around a
 * locked fight). Neither the level nor the footage knows about the other; this
 * one call is the join.
 */
class Stage {
  /* `sheets` is here for ONE job: measuring how far off screen an enemy has to
     start so that nothing of it is visible before it walks on. See _spawn().
     Optional -- without it the spawn falls back to the bare margin, which is
     what this did before the packs got big enough for it to matter. */
  constructor(backdrop, sheets) {
    this.backdrop = backdrop;
    this.sheets = sheets;
    this.reset();
  }

  reset() {
    this.index = 0;
    this.camX = 0;
    this.camTarget = 0;
    this.lockX = null;      // resolved on entering an arena; see update()
    this.reverseFloorX = 0;   // the last cleared fight; see _checkpoint()
    this.backT = 0;          // how long they have been pushing back; tryingBack()
    this.boss = null;       // the Mosca Boss, during a 'boss' segment only
    this.spawned = false;
    this.done = false;
    this.roomIndex = 0;
    /* Put the backdrop back on the first room's footage. A restart from the
       boss room would otherwise replay the street against the boss's shot. */
    const first = CONFIG.ROOMS && CONFIG.ROOMS[0];
    if (first && this.backdrop) this.backdrop.setPlate(first.plate);
    /* AND THE BELT GOES BACK TO THE FIRST ROOM'S, for the same reason the plate
       does: a restart from the desert would otherwise play the street on a
       double-depth floor. See belt.js -- how much ground a room has is a
       property of the room. */
    Belt.set(first);
    this.banner = 0;        // seconds left on the "GO" arrow
    /* The follow reference. Null means "re-seed from wherever the player is on
       the next frame" — which is what a restart wants, since the player jumps
       back to the start of the level and the distance between the two is not a
       walk. See _followCamera. */
    this.lastPlayerX = null;
    // LEVEL 3 HOOK 1/4 -- see src/level3.js. Unconditional because resetting a
    // module that is not in play costs nothing and forgetting it would carry a
    // half-climbed bookcase into a restart.
    if (typeof Level3 !== 'undefined') Level3.reset();
  }

  /** The room being played, and the segment within it. */
  room() { return (CONFIG.ROOMS && CONFIG.ROOMS[this.roomIndex]) || null; }
  segment() {
    const r = this.room();
    return (r && r.segments[this.index]) || null;
  }
  /** Is there another room after this one? */
  hasNextRoom() { return !!(CONFIG.ROOMS && CONFIG.ROOMS[this.roomIndex + 1]); }
  /** The right-hand end of the room, in world x. */
  endX() {
    const r = this.room();
    return (r && r.endX) || CONFIG.GAME_W;
  }

  /**
   * Move into a room: its footage, its origin, its segments.
   *
   * The camera and the player BOTH reset to the room's own origin rather than
   * continuing a single world x. A room is a place, not a stretch of the same
   * street, and its plate is a different shot that starts at its own beginning.
   */
  enterRoom(i, player) {
    this.roomIndex = i;
    this.index = 0;
    this.camX = 0;
    this.camTarget = 0;
    this.lockX = null;
    this.reverseFloorX = 0;   // the last cleared fight; see _checkpoint()
    this.backT = 0;          // how long they have been pushing back; tryingBack()
    this.boss = null;
    this.spawned = false;
    this.banner = 0;
    this.lastPlayerX = null;
    const r = this.room();
    if (r && this.backdrop) this.backdrop.setPlate(r.plate);
    /* ⚠️ THE BELT BEFORE THE PLAYER, AND THE ORDER IS LOAD-BEARING. Where he
       stands is `Belt.depth * playerStartZRel`, so setting the room's band one
       line later would place him on the PREVIOUS room's floor -- 114 into a
       380-deep desert instead of 228, which reads as the character standing too
       far up the picture and looks like a sprite-anchor bug. */
    Belt.set(r);
    if (player && r) {
      player.x = r.startX != null ? r.startX : 220;
      player.z = Belt.depth * CONFIG.playerStartZRel;
    }
    /* LEVEL 3 HOOK 2/4. AFTER the player is placed, because level3.js lays out
       its own world-x bands and moves him to the first one -- doing it earlier
       would have this line put him straight back. */
    if (Level3.owns(r)) Level3.enterRoom(r, player);
  }
  isArena() {
    const s = this.segment();
    // A boss segment IS an arena — same locked camera, same walls, one very
    // large occupant. Anything asking "am I penned in" wants both.
    return !!s && (s.kind === 'arena' || s.kind === 'boss');
  }

  /** The walls the player may not walk past, in world x. */
  bounds() {
    // LEVEL 3 HOOK 4/4 -- per-leg walls, closing to the platform on a lift.
    if (Level3.owns(this.room())) return Level3.bounds(this);
    const w = CONFIG.GAME_W;
    const s = this.segment();
    if (s && this.isArena() && s.lock !== false) {
      return {
        minX: this.camX + CONFIG.gateMarginX,
        maxX: this.camX + w - CONFIG.gateMarginX,
      };
    }
    /* In a scroll segment the LEFT wall still exists — it is the left edge of
       the view. A beat 'em up never lets the player walk back out of the shot,
       because the camera does not follow them backwards past ground it has
       already cleared and they would simply disappear. The right edge is open:
       walking right is what advances the level. */
    return { minX: this.camX + CONFIG.gateMarginX, maxX: this.endX() };
  }

  /**
   * Advance the level. Returns 'clear' on the frame the last segment is
   * finished, so game.js can run the win state without polling.
   */
  update(dt, player, crowd) {
    /* LEVEL 3 HOOK 3/4, AND IT IS THE LOAD-BEARING ONE. The bookcase never
       reaches the segment machinery below: its shot is a switchback, and the
       scroll branch completes on `player.x >= toX` -- the rightward assumption
       shelf 2 breaks. One early return rather than a direction threaded through
       every branch; see the note at the top of src/level3.js for why that was
       asked for in those terms. */
    if (Level3.owns(this.room())) {
      const r = Level3.update(dt, this, player, crowd);
      // 'room' is a door and 'clear' is the end of the game -- level3 decides
      // which off hasNextRoom(), exactly as _enter() does. Both mean this room
      // is finished with.
      if (r) this.done = true;
      return r;
    }
    if (this.banner > 0) this.banner -= dt;
    const s = this.segment();
    if (!s) { this.done = true; return null; }

    if (s.kind === 'scroll') {
      // One plate, one call — the shot IS the background and the floor. See the
      // LAYERS note in config.js for why this is not two layers.
      this.backdrop.setMode('plate', 'scrub');
      this._followCamera(dt, player);

      /* ⚠️ A SCROLL ALSO HAS TO BE WALKED, NOT JUST REACHED. `toX` is an
         absolute line, and the player can already be past it when the scroll
         begins: an arena or a boss LOCKS the camera but still gives them the
         width of the screen to move in, so a fight that ends with them on the
         right-hand side can leave them beyond the next scroll's target. That
         scroll then completes on its first frame and the wave after it spawns
         on top of them.

         That is exactly what happened after the Mosca. Its lock sits around
         camX 2762, the arena walls run to camX+1240 ~ 4002, and the scroll that
         follows asks for 3690 -- so finishing the boss anywhere right of centre
         skipped the walk entirely and the roaches arrived in the player's lap.

         So the target is whichever is FURTHER: the absolute line, or a minimum
         walk from where they actually are. `scrollFrom` is sampled here rather
         than in _enter because the first frame of the segment is the first
         moment the player's position means anything for it. */
      if (this.scrollFrom == null) this.scrollFrom = player.x;
      const minWalk = CONFIG.scrollMinWalkPx || 0;
      /* ⚠️ AND CLAMPED TO THE ROOM'S RIGHT WALL, WHICH IS NOT OPTIONAL. In a
         scroll the player may walk as far as `endX()` and no further, so a
         minimum walk measured from near that wall would ask for a position they
         can never stand in -- the segment would never advance and the game
         would sit there with nothing visibly wrong. A fight ending against the
         right-hand gate is enough to cause it. */
      const target = Math.min(Math.max(s.toX, this.scrollFrom + minWalk),
                              this.endX());

      if (player.x >= target) {
        this.index++;
        this.spawned = false;
        this.lockX = null;      // the next arena resolves its own
        return this._enter(player, crowd);
      }
      return null;
    }

    // --- boss --------------------------------------------------------------
    if (s.kind === 'boss') {
      /* ⚠️ THIS IS A NO-OP FOR THE PLATE AND HAS ALWAYS BEEN ONE. `setMode`
         only touches a source of kind `film`, and the plate is kind `video` --
         which has no 'play' mode at all: `_drawVideo` is scrubbed by the CAMERA
         and by nothing else. The call is kept because the film contract is
         real and a film plate would want it, but do not read it as "the shot
         carries on by itself during a fight". It does not, and that is what
         made a locked boss fight freeze its own backdrop. */
      this.backdrop.setMode('plate', 'play');
      /* A BOSS THE CAMERA FOLLOWS, `lock: false`, exactly as an arena can be --
         the branch is a copy of the one below and deliberately so.

         ⚠️ AND IT IS NOT ONLY A FRAMING CHOICE HERE, IT IS WHAT KEEPS THE
         BACKDROP ALIVE. The plate is a video scrubbed by camera position, so a
         camera that does not move is a shot that does not move: lock the boss
         fight and the room freezes on one frame for the whole of it. The horse
         room is the one that needed this -- reported 2026-08-24 as "the
         background animation gets stuck when the boss enters".

         ⚠️ IT IS SAFE FOR THE HORSE AND WOULD NOT BE FOR THE MOSCA. He is pure
         world coordinates -- the `camX` his constructor takes is vestigial and
         never read. The Mosca computes `enterFromX`/`enterToX` from the camera
         AT SPAWN, so a camera that moved afterwards would leave her flying in
         to a place that is no longer the middle of the screen. Her street also
         cannot seek backwards (its keyframes are eleven seconds apart), which
         is the other reason her fight stays penned. */
      if (s.lock === false) {
        this.banner = 0;
        this._followCamera(dt, player);
      } else {
        if (this.lockX == null) {
          this.lockX = s.camX != null ? s.camX : this.camX;
          this.banner = 0;         // penned in; see the arena branch
          this.lastPlayerX = null; // and the follow budget; see the arena branch
        }
        this._lockCamera(dt, this.lockX);
      }

      if (!this.spawned) {
        this.spawned = true;
        /* ⚠️ THE CROWD IS **NOT** CLEARED HERE ANY MORE. It used to be, on the
           reasoning that "the mooks are done, this is between two of you" --
           and it deleted every body still fading the instant the boss arrived,
           so the last wave blinked out of existence instead of settling. There
           is nothing to clear anyway: this segment is only reached once
           `crowd.cleared()` is true, so nobody is alive; what is left is
           corpses, and Crowd.update now reaps those on their own clock. */
        /* WHICH BOSS. `who` defaults to the Mosca because every boss segment
           written before the horse existed means the Mosca, and a default that
           changes the meaning of existing data is not a default. The two share
           no code -- only the interface combat.js and the overlay talk to. */
        const bx = this.camX + CONFIG.GAME_W * 0.5;
        const bz = Belt.depth * 0.5;
        /* AND ON WHAT TERMS. `fleeAt` is the fraction of health the Mosca
           breaks off at, and it is read off the SEGMENT because the same boss
           is fought twice in the street on different terms -- see ROOMS. The
           stage carries nothing between the two: the first encounter ends when
           it flies away, the second is a fresh one at full health, and neither
           this file nor the boss remembers the other happened. */
        this.boss = (s.who === 'horse')
          ? new HorseBoss(bx, bz, this.camX)
          : new FlyBoss(bx, bz, this.camX, { fleeAt: s.fleeAt });
      }
      /* Waits for `finished()`, not for `dead` — the death fall and fade play
         out before the level is called, so the boss is not deleted out from
         under its own last beat.

         ⚠️ AND `finished()` DOES NOT MEAN DEAD. The Mosca's first encounter
         ends with it ALIVE and off the side of the screen (see `fleeAt` above);
         it finishes the segment exactly as a death does, and the level advances
         without knowing which of the two happened. Anything added here that
         assumes a corpse -- a tally, a drop, a one-time unlock -- has to ask. */
      /* THE BOSS HANDS OFF LIKE ANY OTHER SEGMENT -- it does not end the level
         itself. It used to set `done` and return 'clear' directly, which made
         it permanently the last thing in the game and SILENTLY IGNORED anything
         placed after it. Advancing instead makes it a sub-boss when segments
         follow, and still ends the level when they do not, because `_enter`
         returns 'clear' once there is no next segment.

         It gets the GO prompt for the same reason an arena does: the camera
         unlocking is the message that the way forward has opened. */
      if (this.boss && this.boss.finished()) {
        this.boss = null;
        this._checkpoint();
        this.index++;
        this.spawned = false;
        this.lockX = null;
        const r = this._enter(player, crowd);
        if (!r) this._goPrompt();
        return r || 'advance';
      }
      return null;
    }

    // --- arena -------------------------------------------------------------
    /* AN ARENA WITH NOBODY IN IT IS A DOORWAY, NOT A FIGHT, and it hands over
       on its first frame without doing any of the three things a fight does.
       Added 2026-08-27 for the desert room, which is laid out as a real level --
       two arenas, in the places its waves will go -- and has no cast yet: "when
       the player enters the arena, he can already move forward, he doesn't get
       blocked (because there aren't any enemies)".

       ⚠️ IT IS NOT ENOUGH TO LEAVE `enemies` EMPTY AND LET IT CLEAR ITSELF.
       That already advanced on the first frame -- `crowd.cleared()` is true when
       nothing spawned -- but on the way through it did three things that only a
       fight has earned:

         * IT LEFT A CHECKPOINT. `_checkpoint()` raises `reverseFloorX` to the
           camera, which is a floor the player can never walk back past. Behind
           a fight that is the point; in the middle of an empty walk it is an
           invisible wall across ground nothing happened on -- and this room has
           `reverse: true`, so walking back is a thing it offers.
         * IT RAISED THE GO ARROW. The prompt means "the way forward has
           OPENED", and nothing had closed it. 2.6s of arrow over an
           uninterrupted walk.
         * IT DROPPED THE CAMERA'S FOLLOW REFERENCE and locked for a frame, so
           the shot stopped for one frame in the middle of a scroll.

       So the emptiness is read HERE, before any of that. The segment still
       exists and is still consumed -- it holds the place a wave will go, and
       the moment one is written into it this branch stops matching and it is an
       ordinary arena again, with nothing to undo.

       ⚠️ IT IS CURRENT FOR EXACTLY ONE FRAME, and `bounds()` is asked before
       this runs -- so the walls it would raise do apply for that frame. Harmless
       where an empty arena can be: the scroll before it hands over with the
       player around screen x 670, and the walls are 40..1240. */
    if (!(s.enemies && s.enemies.length)) {
      this._followCamera(dt, player);
      this.index++;
      this.spawned = false;
      this.lockX = null;
      return this._enter(player, crowd);
    }

    this.backdrop.setMode('plate', 'play');

    /* `camX` IS OPTIONAL, AND LEAVING IT OUT IS USUALLY RIGHT. Omitted, the
       arena locks wherever the camera had got to when the scroll handed over —
       which can never disagree with the segment before it. A hand-written value
       can, and does: the camera stops short of the player by the focus point
       plus the deadzone (~670px at the current tuning), so a lock naively set
       to the same x the scroll ended at yanks the view most of a screen forward
       at the exact moment the fight starts.

       Set it only to FRAME a fight deliberately — which is what the filmed
       backdrop will want, since a locked shot is a composed one. Then the
       number has to be picked against where the camera actually is, not against
       where the player is. */
    /* A FIGHT THE CAMERA FOLLOWS INSTEAD OF LOCKING. `lock: false` is what the
       boss room is: small enough that penning the player to one screen would
       leave no room to move, and the whole point of it is a camera that trails
       them back and forth. Everything else about an arena is unchanged -- the
       spawn, the token, clearing it -- so this is a camera decision, not a new
       kind of segment.

       The walls come from `bounds()`, which gives a non-locking fight the whole
       ROOM rather than the current screen. */
    if (s.lock === false) {
      this.banner = 0;
      this._followCamera(dt, player);
      if (!this.spawned) {
        this.spawned = true;
        this._spawn(s, crowd);
      }
      if (crowd.cleared()) {
        this._checkpoint();
        this.index++;
        this.spawned = false;
        const r = this._enter(player, crowd);
        if (!r) this._goPrompt();
        return r || 'advance';
      }
      return null;
    }

    if (this.lockX == null) {
      this.lockX = s.camX != null ? s.camX : this.camX;
      /* LOCKING THE CAMERA CANCELS THE GO ARROW. The prompt lasts `goMs`
         (2.6s) and the walks between fights are under a second, so it was
         routinely still on screen when the next arena penned the player in --
         an arrow saying "this way" over a fight they cannot walk away from.
         The arrow means the way is OPEN; the moment it is not, it goes. */
      this.banner = 0;
      /* And drop the follow reference. `_followCamera` spends a budget earned
         by walking, and it is not called while the camera is locked -- so a
         fight's worth of movement would otherwise be sitting in that budget the
         instant the lock lifts, and buy exactly the lurch the budget exists to
         prevent. Nulled here, re-seeded on the first frame after the fight. */
      this.lastPlayerX = null;
    }
    this._lockCamera(dt, this.lockX);

    if (!this.spawned) {
      this.spawned = true;
      this._spawn(s, crowd);
    }
    if (crowd.cleared()) {
      this._checkpoint();
      this.index++;
      this.spawned = false;
      this.lockX = null;
      const r = this._enter(player, crowd);
      if (!r) this._goPrompt();
      return r || 'advance';
    }
    return null;
  }

  /**
   * Raise the GO arrow — but only if there is somewhere to go.
   *
   * ⚠️ THE ARROW MEANS "THE WAY FORWARD HAS OPENED", so it may only appear when
   * the thing that follows is a WALK. Two ways it can be wrong:
   *
   *   * `_enter` returned an event. 'clear' ends the game and 'room' is a door
   *     the game walks him through itself -- neither is a walk the player
   *     controls. Setting the banner before asking put a GO over the clear card
   *     once already, which is why the callers check `r` first.
   *   * THE NEXT SEGMENT IS NOT A SCROLL. This is the boss room: clearing its
   *     wave hands straight to HIPÓLITO, so the camera never unlocks and there
   *     is nowhere to walk -- but the arrow went up anyway, pointing the player
   *     at a wall. Found in play.
   *
   * Everywhere in the street an arena is followed by a scroll, so this changes
   * nothing there; it is the boss room's arena→boss hand-off that it fixes.
   */
  _goPrompt() {
    const next = this.segment();
    if (next && next.kind === 'scroll') {
      this.banner = (CONFIG.goMs || 1600) / 1000;
    }
  }

  _enter(player, crowd) {
    /* WHERE THE NEXT SCROLL IS MEASURED FROM. Cleared on EVERY segment change,
       so a scroll always takes it from wherever the player is standing when it
       actually begins -- see the scroll branch in update(). */
    this.scrollFrom = null;
    const s = this.segment();
    /* OUT OF SEGMENTS. If another room follows, this is a door rather than the
       end of the game -- game.js walks the player out and fades into it. Only
       the last room clears. */
    if (!s) {
      if (this.hasNextRoom()) return 'room';
      this.done = true;
      return 'clear';
    }
    return null;
  }

  _spawn(seg, crowd) {
    /* THE DEAD STAY AND FINISH FADING. This was a `clear()`, and with the
       minimum walk between fights down to ~0.87s against a 1.8s fade, that
       deleted bodies from the previous wave that were still visibly on screen.
       See Crowd.clearLiving(). */
    crowd.clearLiving();
    /* ⚠️ THE INDEX IS PASSED DOWN, and it is used for exactly one thing: the
       diggers of a wave are DEALT different scenery planes to come up behind
       rather than each hashing its own. Three enemies hashing over a
       three-value range collided on the first arena. See Emerge.pickPlane. */
    let idx = -1;
    /* ONE SEED FOR THE WHOLE WAVE, so the deal above steps cleanly through the
       range. Per-enemy seeds put two of three back on the same plane. */
    const waveSeed = (seg.enemies && seg.enemies.length) ? seg.enemies[0].x : 0;
    for (const e of seg.enemies || []) {
      idx++;
      /* ENEMIES ARE PLACED OFF SCREEN AND WALK IN, rather than appearing at the
         spot they will fight from. A fighter that materialises in front of the
         player reads as a bug even when it is the design, and the walk-in also
         gives the player the beat they need to see how many are coming and
         where from. Their configured x is where they head FOR; the entry delay
         staggers them so a group does not arrive as a wall.

         `from: 'behind'` BRINGS ONE IN FROM THE LEFT INSTEAD -- out of the
         ground the player has already cleared, which is the one direction they
         are not watching. Everything else follows for free: the walk-in already
         steers toward `entryX` and takes its facing from the direction it
         walks, so an enemy placed to the left arrives walking and facing right
         without a special case. Only its starting side and its first-frame
         facing are set here. */
      const behind = e.from === 'behind';
      /* `from: 'ground'` COMES UP THROUGH THE FLOOR, and it is the one entrance
         that is not a walk-in at all -- see emerge.js and Enemy's `enter` branch.
         Asked for 2026-08-31 for the desert, whose floor is a sea of cigarette
         butts: *"make the enemies come out of the pile of cigarettes, like make
         them come out of the ground"*.

         ⚠️ IT IS SPAWNED ON ITS MARK, NOT PAST THE EDGE OF THE SCREEN, and that
         is the whole of the difference here. Everything below this exists to put
         a body somewhere it cannot be seen and steer it in; a digger is already
         where it is going to fight, so `entryX` is null (there is nothing to walk
         to) and the margin, the overhang and the side are all irrelevant to it.

         ⚠️ AND THE REASON IT MAY MATERIALISE IN FRONT OF THE PLAYER -- which the
         walk-in exists to prevent -- is that it does not materialise. The mound
         heaves for the best part of half a second before any of it is visible,
         which is the same beat the walk-in buys, spent in place instead of
         sideways. If that ever stops reading, `heaveMs` is the number, not this. */
      /* ⚠️ GATED ON `EMERGE.on` HERE, NOT ONLY IN THE ENEMY, AND THAT IS WHAT
         MAKES THE FLAG A REAL ROLLBACK. Without this, turning the effect off
         left the wave data still saying `from: 'ground'`: the enemy would be
         spawned ON its mark with no walk-in and no climb, so it would simply
         appear standing in the arena -- worse than either version. Off, a
         digger is an ordinary walk-in and the level plays exactly as it did
         before any of this existed. */
      const ground = e.from === 'ground'
                  && !!(CONFIG.EMERGE && CONFIG.EMERGE.on);
      /* ⚠️ THE MARGIN IS MEASURED OFF THE DRAWING, NOT PICKED. It used to be a
         flat 70px past the edge, and that quietly stopped working the moment
         the roaches were scaled up: a barata's sprite reaches 169px from its
         ground point on one side (the anchor is nowhere near its centre), so
         at 70 its horns sat on screen announcing where it would come from
         while the fighter itself was still legitimately off it.

         So the pad clears the sprite as well as the edge, and it now follows
         `drawScale` for free -- which matters, because that number has moved
         three times in one day.

         THE LARGER OF THE TWO SIDES, because a mirrored frame swaps them and
         this does not know which way the pack faces natively. It costs a few
         px of extra walk-in and it cannot be wrong. */
      const over = this.sheets ? this.sheets.overhang(e.kind, 'walk')
                               : { left: 0, right: 0 };
      const pad = (CONFIG.spawnMarginPx != null ? CONFIG.spawnMarginPx : 70)
                + Math.max(over.left, over.right);
      const fromX = ground ? e.x
                  : behind ? this.camX - pad
                           : this.camX + CONFIG.GAME_W + pad;
      const en = new Enemy(e.kind, fromX, e.z, {
        delayMs: e.delayMs || 0,
        // The spot it walks IN to before it starts fighting. A digger has none:
        // it came up standing on it.
        entryX: ground ? null : e.x,
        /* A digger's first-frame facing is thrown away -- it is faced at the
           player the moment it is out, and until then it is under the sand. */
        facing: behind ? 'right' : 'left',
        emerge: ground,
        emergeIndex: idx,
        emergeSeed: waveSeed,
      });
      crowd.add(en);
    }
  }

  /**
   * Follow the player. THE CAMERA ONLY EVER MOVES BECAUSE THE PLAYER MOVED.
   *
   * It used to ease toward a target POSITION, and that is the wrong quantity.
   * Any time the player was outside the band -- which is most of the time after
   * a fight, since they finish it wherever they were standing -- the camera set
   * off on its own and kept going while they stood still. Worst after an arena
   * unlocked: up to 572px of travel that the player never asked for, arriving
   * as a lurch. It also drove the plate, so the film whipped along with it.
   *
   * Now the framing error is closed out of a BUDGET earned by walking. Stand
   * still and the camera is still, however badly framed the shot is; walk, and
   * it comes back to frame as you go. `camFollowGain` is how many px of
   * correction a px of walking buys.
   *
   * A DEADZONE STILL SITS AROUND THE FOCUS POINT, and it is what keeps a step
   * or the back-and-forth of a fight from dragging the whole background along.
   * A camera glued to the player makes the backdrop twitch on every step, which
   * on filmed footage -- where every twitch is a frame change -- is the
   * difference between a walk and a treadmill.
   *
   * IT STILL ONLY GOES FORWARD. The left edge of the view is a wall (see
   * `bounds`), so a player pushing left is stopped rather than followed. Making
   * the camera reverse is a real feature and not a free one: the plate is
   * video, and no browser can play a video backwards.
   */
  /**
   * A CLEARED FIGHT IS A CHECKPOINT: the camera may never go back past it.
   *
   * ⚠️ IT IS A FLOOR ON THE CAMERA AND NOT A WALL ON THE PLAYER, because the
   * player's wall is already derived from the camera -- `bounds()` gives a
   * scroll `camX + gateMarginX`. Stopping the camera stops the wall with it,
   * one number, and the two can never disagree about where the level's past
   * ends. A second wall kept in step with this would be the copied-value bug
   * this file has hit repeatedly.
   *
   * ⚠️ ONLY FIGHTS CALL IT, NOT SEGMENTS. A scroll finishing is not a
   * checkpoint -- the whole point of the reverse camera is that the walk
   * between fights can be walked both ways. It is the three places a fight
   * ENDS: an arena cleared, a follow-camera arena cleared, and a boss done.
   *
   * The camera is at the fight's own framing when this is called, so the
   * player can still walk back across the arena they just won, and no further.
   */
  /**
   * THE PLAYER IS ASKING TO GO BACK AND CANNOT. Counts how long they have held
   * it, and raises the GO arrow once that reads as being lost rather than as
   * stepping back for a barrel.
   *
   * ⚠️ IT TAKES THE BUTTON, NOT THE MOVEMENT, AND IT HAS TO. A player pinned
   * against a wall is not moving, so a check on "did their x go down" measures
   * exactly nothing at the only moment that matters -- they walk back, stop,
   * and from then on look identical to a player standing still. The held key is
   * the only evidence that they are still trying.
   *
   * ⚠️ IT REUSES `_goPrompt`, WHICH SELF-GATES. That only raises the banner
   * when the CURRENT segment is a scroll, so pushing left against an arena's
   * wall mid-fight cannot summon an arrow pointing at an exit that is not open
   * yet -- the prompt still means "the way forward is that way" and nothing
   * else. Nothing here needs to know it is in a fight.
   */
  tryingBack(dt, held, player) {
    const b = this.bounds();
    const blocked = !!player && !!b && player.x <= b.minX + 1.5;
    if (!held || !blocked) { this.backT = 0; return; }
    this.backT = (this.backT || 0) + dt;
    if (this.backT >= (CONFIG.goBackNudgeS || 1.2)) {
      this.backT = 0;
      this._goPrompt();
    }
  }

  _checkpoint() {
    /* ⚠️ A FIGHT THE CAMERA FOLLOWS DOES NOT LEAVE ONE, and the horse's room is
       why. `lock: false` exists to say "this fight is a place, not a screen" --
       the room is small, the camera trails the player both ways, and that is
       the whole character of it. The boss room is TWO such segments, an arena
       and then the horse, so checkpointing the first one pinned the camera for
       the entire boss fight and took the back half of the room away.

       Read off the segment rather than the room, so a follow-camera fight keeps
       its own rules wherever one is placed -- and a LOCKED arena in the same
       room would still leave a checkpoint, because a locked arena already
       penned the player to that screen and there is nothing behind it to give
       back. */
    const s = this.segment();
    if (s && s.lock === false) return;
    this.reverseFloorX = Math.max(this.reverseFloorX || 0, this.camX);
  }

  _followCamera(dt, player) {
    const focus = CONFIG.GAME_W * CONFIG.camFocusX;
    const px = player.x;
    if (this.lastPlayerX == null) this.lastPlayerX = px;
    /* ONLY WALKING FORWARD EARNS BUDGET. This was `Math.abs` and that was a
       bug: walking LEFT also earned it, so the camera crept right while the
       player moved left and their screen position fell away twice as fast. */
    /* The signed distance walked since the last follow frame. Both directions
       are kept: the budget must be earned in the direction the camera needs to
       go, so a step left can never drive the camera right. */
    const moved = px - this.lastPlayerX;
    this.lastPlayerX = px;

    // How far the framing is out, in px. Zero inside the band.
    const sx = px - this.camX;
    const dz = CONFIG.camDeadzone;
    let err = sx - (focus + dz);
    if (err <= 0) {
      /* GOING BACK, IN A ROOM THAT ALLOWS IT. Only some do: the camera can
         only reverse where the plate can be scrubbed backwards, which is a
         property of the footage (see CONFIG.ROOMS and `allowReverse`). Where it
         cannot, the left edge of the view stays a wall and `bounds` handles it. */
      const r = this.room();
      if (!r || !r.reverse) return;
      err = sx - (focus - dz);
      if (err >= 0) return;               // inside the band
    }

    /* THE PLAYER IS NOT DRAGGED BACK TO THE MIDDLE. At `camFollowGain` 1 the
       step is exactly the distance walked, so the camera matches the player and
       their position on screen DOES NOT CHANGE -- wherever they are when they
       push the edge is where they stay, and where they will be standing when
       the next arena locks. Above 1 the camera outruns them and hauls them back
       toward the focus point, which reads as the player sliding across the
       frame under their own feet. */
    const walked = (err > 0) ? Math.max(0, moved) : Math.max(0, -moved);
    const budget = walked * (CONFIG.camFollowGain || 1);
    const step = (err > 0) ? Math.min(err, budget) : Math.max(err, -budget);
    const maxX = this.endX() - CONFIG.GAME_W;
    const minCam = this.reverseFloorX || 0;
    this.camX = Math.max(minCam, Math.min(maxX, this.camX + step));
    this.camTarget = this.camX;           // kept in step for _lockCamera's hand-over
  }

  _lockCamera(dt, target) {
    // Eased rather than snapped, and more slowly than the follow — the lock
    // should read as the world coming to a stop, not as a cut.
    this.camTarget = target;
    this.camX += (target - this.camX) * Math.min(1, CONFIG.camLockEaseRate * dt);
  }

  /* The wall/belt debug drawing has moved to src/debug.js, which now owns the
     whole C-key overlay — it draws the walkable area as the single REGION it
     actually is (the belt crossed with these walls) rather than as two loose
     lines and two loose bars that the reader had to intersect by eye. */
}
