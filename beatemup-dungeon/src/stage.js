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
 * ⚠️ THE LOCK IS WHAT COMMUNICATES THE FIGHT, and it does it without a word of
 * UI. Every player of this genre already knows what a camera refusing to scroll
 * means. That is why the walls are invisible: the camera stopping IS the
 * message, and drawing a gate on top of it would be saying the same thing
 * twice. (They can be seen on the debug key.)
 *
 * ⚠️ THE SEGMENT ALSO SETS THE BACKDROP'S MODE, which is the whole reason the
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
    this.banner = 0;        // seconds left on the "GO" arrow
  }

  segment() { return CONFIG.SEGMENTS[this.index] || null; }
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
    if (s && this.isArena()) {
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
    return { minX: this.camX + CONFIG.gateMarginX, maxX: CONFIG.levelEndX };
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
      if (this.lockX == null) this.lockX = s.camX != null ? s.camX : this.camX;
      this._lockCamera(dt, this.lockX);

      if (!this.spawned) {
        this.spawned = true;
        crowd.clear();       // the mooks are done; this is between two of you
        this.boss = new FlyBoss(
          this.camX + CONFIG.GAME_W * 0.5,
          CONFIG.beltDepth * 0.5,
          this.camX);
      }
      /* Waits for `finished()`, not for `dead` — the death fall and fade play
         out before the level is called, so the boss is not deleted out from
         under its own last beat. */
      if (this.boss && this.boss.finished()) {
        this.boss = null;
        this.index++;
        this.spawned = false;
        this.lockX = null;
        this.done = true;
        return 'clear';
      }
      return null;
    }

    // --- arena -------------------------------------------------------------
    this.backdrop.setMode('plate', 'play');

    /* ⚠️ `camX` IS OPTIONAL, AND LEAVING IT OUT IS USUALLY RIGHT. Omitted, the
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
    if (this.lockX == null) this.lockX = s.camX != null ? s.camX : this.camX;
    this._lockCamera(dt, this.lockX);

    if (!this.spawned) {
      this.spawned = true;
      this._spawn(s, crowd);
    }
    if (crowd.cleared()) {
      this.index++;
      this.spawned = false;
      this.lockX = null;
      this.banner = 1.6;                // the arrow that says "this way"
      const r = this._enter(player, crowd);
      return r || 'advance';
    }
    return null;
  }

  _enter(player, crowd) {
    const s = this.segment();
    if (!s) { this.done = true; return 'clear'; }
    return null;
  }

  _spawn(seg, crowd) {
    crowd.clear();
    for (const e of seg.enemies || []) {
      /* ⚠️ ENEMIES ARE PLACED OFF THE RIGHT-HAND EDGE AND WALK IN, rather than
         appearing at the spot they will fight from. A fighter that materialises
         in front of the player reads as a bug even when it is the design, and
         the walk-in also gives the player the beat they need to see how many
         are coming and where from. Their configured x is where they head FOR;
         the entry delay staggers them so a group does not arrive as a wall. */
      const fromX = this.camX + CONFIG.GAME_W + 70;
      const en = new Enemy(e.kind, fromX, e.z, {
        delayMs: e.delayMs || 0,
        entryX: e.x,          // the spot it walks IN to before it starts fighting
      });
      crowd.add(en);
    }
  }

  _followCamera(dt, player) {
    /* A DEADZONE, not a hard follow. The camera only moves once the player has
       walked out of a band around its focus point, so small adjustments and the
       back-and-forth of a fight do not drag the whole background with them. A
       camera glued to the player makes the backdrop twitch on every step, which
       on a SCROLLING BACKGROUND — and even more on filmed footage, where every
       twitch is a frame change — is the difference between a walk and a
       treadmill. */
    const focus = CONFIG.GAME_W * CONFIG.camFocusX;
    const sx = player.x - this.camX;
    if (sx > focus + CONFIG.camDeadzone) this.camTarget = player.x - focus - CONFIG.camDeadzone;
    else if (sx < focus - CONFIG.camDeadzone) this.camTarget = player.x - focus + CONFIG.camDeadzone;

    // Never scrolls back past ground already cleared: the genre's rule, and
    // what makes the left edge a wall rather than a suggestion.
    this.camTarget = Math.max(this.camTarget, this.camX);
    this.camTarget = Math.min(this.camTarget, CONFIG.levelEndX - CONFIG.GAME_W);
    this.camX += (this.camTarget - this.camX) * Math.min(1, CONFIG.camEaseRate * dt);
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
