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
  constructor(backdrop) {
    this.backdrop = backdrop;
    this.reset();
  }

  reset() {
    this.index = 0;
    this.camX = 0;
    this.camTarget = 0;
    this.lockX = null;      // resolved on entering an arena; see update()
    this.boss = null;       // the Mosca Boss, during a 'boss' segment only
    this.spawned = false;
    this.done = false;
    this.roomIndex = 0;
    /* Put the backdrop back on the first room's footage. A restart from the
       boss room would otherwise replay the street against the boss's shot. */
    const first = CONFIG.ROOMS && CONFIG.ROOMS[0];
    if (first && this.backdrop) this.backdrop.setPlate(first.plate);
    this.banner = 0;        // seconds left on the "GO" arrow
    /* The follow reference. Null means "re-seed from wherever the player is on
       the next frame" — which is what a restart wants, since the player jumps
       back to the start of the level and the distance between the two is not a
       walk. See _followCamera. */
    this.lastPlayerX = null;
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
    this.boss = null;
    this.spawned = false;
    this.banner = 0;
    this.lastPlayerX = null;
    const r = this.room();
    if (r && this.backdrop) this.backdrop.setPlate(r.plate);
    if (player && r) {
      player.x = r.startX != null ? r.startX : 220;
      player.z = CONFIG.beltDepth * 0.6;
    }
  }
  isArena() {
    const s = this.segment();
    // A boss segment IS an arena — same locked camera, same walls, one very
    // large occupant. Anything asking "am I penned in" wants both.
    return !!s && (s.kind === 'arena' || s.kind === 'boss');
  }

  /** The walls the player may not walk past, in world x. */
  bounds() {
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
    if (this.banner > 0) this.banner -= dt;
    const s = this.segment();
    if (!s) { this.done = true; return null; }

    if (s.kind === 'scroll') {
      // One plate, one call — the shot IS the background and the floor. See the
      // LAYERS note in config.js for why this is not two layers.
      this.backdrop.setMode('plate', 'scrub');
      this._followCamera(dt, player);
      if (player.x >= s.toX) {
        this.index++;
        this.spawned = false;
        this.lockX = null;      // the next arena resolves its own
        return this._enter(player, crowd);
      }
      return null;
    }

    // --- boss --------------------------------------------------------------
    if (s.kind === 'boss') {
      // Same locked, living shot an arena gets — the world carries on around a
      // fight the player cannot walk away from.
      this.backdrop.setMode('plate', 'play');
      if (this.lockX == null) {
        this.lockX = s.camX != null ? s.camX : this.camX;
        this.banner = 0;         // penned in; see the arena branch
        this.lastPlayerX = null; // and the follow budget; see the arena branch
      }
      this._lockCamera(dt, this.lockX);

      if (!this.spawned) {
        this.spawned = true;
        crowd.clear();       // the mooks are done; this is between two of you
        /* WHICH BOSS. `who` defaults to the Mosca because every boss segment
           written before the horse existed means the Mosca, and a default that
           changes the meaning of existing data is not a default. The two share
           no code -- only the interface combat.js and the overlay talk to. */
        const bx = this.camX + CONFIG.GAME_W * 0.5;
        const bz = CONFIG.beltDepth * 0.5;
        this.boss = (s.who === 'horse')
          ? new HorseBoss(bx, bz, this.camX)
          : new FlyBoss(bx, bz, this.camX);
      }
      /* Waits for `finished()`, not for `dead` — the death fall and fade play
         out before the level is called, so the boss is not deleted out from
         under its own last beat. */
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
        this.index++;
        this.spawned = false;
        this.lockX = null;
        const r = this._enter(player, crowd);
        if (!r) this.banner = (CONFIG.goMs || 1600) / 1000;
        return r || 'advance';
      }
      return null;
    }

    // --- arena -------------------------------------------------------------
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
        this.index++;
        this.spawned = false;
        const r = this._enter(player, crowd);
        if (!r) this.banner = (CONFIG.goMs || 1600) / 1000;
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
      this.index++;
      this.spawned = false;
      this.lockX = null;
      const r = this._enter(player, crowd);
      /* THE ARROW ONLY MEANS SOMETHING IF THERE IS SOMEWHERE TO WALK. `_enter`
         returns null when a next segment exists and an event when the room is
         over -- 'clear' at the end of the game, 'room' at a door. Neither is a
         walk the player controls, so neither gets an arrow. It used to be set
         before asking at all, which put a GO over the clear card. */
      if (!r) this.banner = (CONFIG.goMs || 1600) / 1000;
      return r || 'advance';
    }
    return null;
  }

  _enter(player, crowd) {
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
    crowd.clear();
    for (const e of seg.enemies || []) {
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
      const fromX = behind ? this.camX - 70
                           : this.camX + CONFIG.GAME_W + 70;
      const en = new Enemy(e.kind, fromX, e.z, {
        delayMs: e.delayMs || 0,
        entryX: e.x,          // the spot it walks IN to before it starts fighting
        facing: behind ? 'right' : 'left',
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
    this.camX = Math.max(0, Math.min(maxX, this.camX + step));
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
