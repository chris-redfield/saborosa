/**
 * Fighter — everything the player and the enemies have in common: a position
 * on the belt, health, an attack state machine, and the several ways of being
 * knocked about.
 *
 * THE WORLD MODEL, in one place:
 *
 *     x       along the belt, world px. The level is thousands of these.
 *     z       across the belt, 0 (far) .. CONFIG.beltDepth (near).
 *     jumpY   height off the floor. DRAWN ONLY — see below.
 *
 * `jumpY` NEVER TOUCHES x OR z, and that is a rule rather than an
 * implementation detail. If a jump moved a fighter in world space it could
 * clear another fighter's depth slab and come down somewhere the walk could not
 * reach, and every question about who can hit whom would need a third axis in
 * it. Keeping height purely visual means the belt stays a flat 2D problem and
 * the hit tests stay two comparisons.
 *
 * THE STATE MACHINE. States are exclusive and the transitions are all here:
 *
 *     enter  → idle          walking in from off-screen at spawn
 *     idle  ↔  walk          free movement
 *     idle/walk → attack     a press; runs startup → active → recover
 *     any    → hurt          took a blow that did not knock down
 *     any    → down          took a blow that did: launch → land → lie → rise
 *     down/hurt → idle       the stun expires
 *     any    → dead          hp hit zero
 *
 * `hurt` AND `down` INTERRUPT AN ATTACK. Being hit out of your own punch is
 * the cost of throwing it at the wrong moment, and a game where the swing
 * completes regardless is a game where trading is always correct.
 */
class Fighter {
  constructor(kind, x, z, opts) {
    const o = opts || {};
    this.kind = kind;
    this.x = x;
    this.z = z;
    this.jumpY = 0;

    this.facing = o.facing || 'left';
    this.state = 'idle';
    this.stateT = 0;

    this.maxHp = o.hp || 100;
    this.hp = this.maxHp;

    // Knockback velocity, decayed toward rest. Separate from walking so a
    // fighter can be shoved while stunned, which is what makes a combo push an
    // enemy across the screen instead of hitting it in place.
    this.vx = 0;
    this.vz = 0;

    // The live attack, or null. `hasHit` is what stops one active window
    // hitting the same target on every frame it overlaps — a beam problem the
    // flying dungeon solved with i-frames; here the ATTACK remembers instead,
    // which is stricter and means one punch is one hit however long it lingers.
    this.atk = null;
    this.comboIndex = 0;
    this.comboWindow = 0;      // time left in which a press advances the combo

    this.hurtT = 0;            // stun + i-frames remaining
    this.flash = 0;            // hit-flash strength, decays
    this.downPhase = '';       // 'land' | 'lie' | 'rise'
    this.launch = 0;           // apex of the current knockdown arc
    this.jumping = false;
    this.jumpT = 0;
    // Time left holding the landing frame after the arc ends. See
    // CONFIG.jumpLandHoldMs -- cosmetic only, it blocks nothing.
    this.landHoldT = 0;

    this.step = 0;             // frame within the current pose
    /* Free-running animation clock, in seconds. Looping poses (idle, walk)
       read it directly; one-shot poses (hurt, down) read `stateT` instead, so
       they start at frame 0 the moment the state is entered rather than
       wherever a shared clock happened to be. Death has its own, below. */
    this.animT = 0;
    /* THE DEATH ANIMATION NEEDS ITS OWN CLOCK, and this is why it cannot share
       one. `stateT` is reset every time the knockdown changes phase (land ->
       lie), so a death driven by it restarts halfway through. `animT` is a
       free-running loop clock and would start the death wherever it happened
       to be. `deathT` starts at zero when the fighter dies and only ever goes
       up, which is exactly what a play-once-and-hold animation wants. */
    this.deathT = 0;
    this.dead = false;
  }

  // --- Queries the rest of the game asks -----------------------------------

  /** Can it start a new action this frame? */
  canAct() {
    return !this.dead && this.state !== 'hurt' && this.state !== 'down'
      && this.state !== 'enter' && !this.atk;
  }

  /** Can it be hit? i-frames run for the whole of hurt AND the whole knockdown,
      including getting up — a fighter picking itself off the floor that could
      be hit again would never get up at all. */
  vulnerable() {
    return !this.dead && this.hurtT <= 0 && this.state !== 'down' && this.state !== 'enter';
  }

  /** Half-extents of the hurtbox, in world units. */
  halfW() { return CONFIG.bodyW / 2; }
  halfZ() { return CONFIG.bodyZ / 2; }
  /** Drawn height, for the debug overlay's ownership connector only. Nothing in
      the simulation has a height — see the note on verticalReach. */
  bodyHeight() { return CONFIG.fighterSizePx; }

  /** Screen position of the point its feet stand on. */
  groundX(camX) { return this.x - camX; }
  groundY() { return CONFIG.beltTopY + this.z - this.jumpY; }

  /** Depth scale — 1 at the near edge, CONFIG.beltFarScale at the far one. */
  depthScale() {
    const t = CONFIG.beltDepth ? this.z / CONFIG.beltDepth : 1;
    return CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
  }

  // --- Actions -------------------------------------------------------------

  /**
   * Throw a punch. `defs` is the combo table; which entry comes out depends on
   * whether the previous one is still inside its cancel window.
   */
  attack(defs) {
    if (!this.canAct()) return false;
    const i = this.comboWindow > 0 ? Math.min(this.comboIndex + 1, defs.length - 1) : 0;
    const def = defs[i];
    if (!def) return false;
    this.comboIndex = i;
    this.comboWindow = 0;
    this.atk = { def, phase: 'startup', t: 0, hasHit: false };
    this.state = 'attack';
    this.step = 0;
    this.animT = 0;
    return true;
  }

  jump() {
    if (!this.canAct() || this.jumping) return false;
    this.jumping = true;
    this.jumpT = 0;
    return true;
  }

  /**
   * Take a blow.
   *
   * `dir` is -1 or +1 along the belt: which way the hit pushes. Passed in
   * rather than derived from the two positions, because a fighter hit while it
   * is on the far side of its attacker mid-swing should still be pushed the way
   * the PUNCH went, not the way the geometry happens to read on that frame.
   */
  hurt(dmg, dir, knockback, lift, knockdown) {
    if (!this.vulnerable()) return false;
    this.hp -= dmg;
    this.flash = 1;
    this.atk = null;            // interrupted — see the class header
    this.comboWindow = 0;
    this.vx = dir * (knockback || 0);

    if (this.hp <= 0) {
      this.hp = 0;
      // Death is a knockdown that never gets up, so it runs the same arc and
      // there is one piece of code deciding how a body falls.
      this.state = 'down';
      this.downPhase = 'land';
      this.stateT = 0;
      this.launch = Math.max(lift || 0, 140);
      this.dead = true;
      this.deathT = 0;
      return true;
    }

    if (knockdown) {
      this.state = 'down';
      this.downPhase = 'land';
      this.stateT = 0;
      this.launch = lift || 150;
    } else {
      this.state = 'hurt';
      this.stateT = 0;
      this.hurtT = CONFIG.hurtMs / 1000;
    }
    return true;
  }

  // --- Per-frame -----------------------------------------------------------

  /**
   * Move under the player's or the AI's intent. `ix`/`iz` are -1..1. Returns
   * nothing; it writes x/z directly, clamped to the belt and the level.
   */
  walk(dt, ix, iz, bounds, speedScale) {
    const sc = speedScale || 1;
    const moving = Math.abs(ix) > 0.01 || Math.abs(iz) > 0.01;
    if (moving) {
      // Normalised, so walking a diagonal is not faster than walking a straight
      // line — the oldest bug in the genre.
      const m = Math.hypot(ix, iz) || 1;
      this.x += (ix / m) * CONFIG.walkSpeedX * sc * dt;
      this.z += (iz / m) * CONFIG.walkSpeedZ * sc * dt;
      this.facing = facingFor(ix, iz, this.facing);
      if (this.state === 'idle') this.state = 'walk';
    } else if (this.state === 'walk') {
      this.state = 'idle';
    }
    this.clamp(bounds);
    return moving;
  }

  clamp(bounds) {
    this.z = Math.max(0, Math.min(CONFIG.beltDepth, this.z));
    if (bounds) this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
  }

  update(dt, bounds) {
    this.stateT += dt;
    this.animT += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);

    // Knockback drift, decayed exponentially toward rest.
    if (this.vx || this.vz) {
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      const k = Math.exp(-CONFIG.knockbackDecay * dt);
      this.vx *= k;
      this.vz *= k;
      if (Math.abs(this.vx) < 2) this.vx = 0;
      if (Math.abs(this.vz) < 2) this.vz = 0;
      this.clamp(bounds);
    }

    if (this.landHoldT > 0) this.landHoldT -= dt;
    if (this.dead) this.deathT += dt;
    if (this.comboWindow > 0) this.comboWindow -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;

    if (this.jumping) this._updateJump(dt);
    if (this.atk) this._updateAttack(dt);

    if (this.state === 'hurt' && this.hurtT <= 0) {
      this.state = 'idle';
      this.stateT = 0;
    }
    if (this.state === 'down') this._updateDown(dt);
  }

  _updateJump(dt) {
    this.jumpT += dt;
    const p = this.jumpT / (CONFIG.jumpMs / 1000);
    if (p >= 1) {
      this.jumping = false;
      this.jumpY = 0;
      this.landHoldT = (CONFIG.jumpLandHoldMs || 0) / 1000;
      return;
    }
    // A sine arc rather than real gravity: the shape is what matters and a sine
    // gives the float at the apex that a parabola does not.
    this.jumpY = Math.sin(Math.PI * p) * CONFIG.jumpHeight;
  }

  _updateAttack(dt) {
    const a = this.atk;
    a.t += dt;
    const d = a.def;
    const startup = d.startupMs / 1000;
    const active = d.activeMs / 1000;
    const recover = d.recoverMs / 1000;

    /* Only the PHASE is written here. Which sprite frame that corresponds to is
       derived in frameStep() from the phase and the pose's length, so a pose
       gaining or losing frames never needs this machine touched. */
    if (a.t < startup) {
      a.phase = 'startup';
    } else if (a.t < startup + active) {
      if (a.phase !== 'active') {
        a.phase = 'active';
        // The cancel window opens WITH the active frames, not with the recovery
        // — a player who presses on the frame their punch lands must be heard.
        this.comboWindow = d.cancelMs / 1000;
      }
    } else if (a.t < startup + active + recover) {
      a.phase = 'recover';
    } else {
      this.atk = null;
      this.state = 'idle';
      this.stateT = 0;
      // Combo resets on its own if nothing extended it, so the next press
      // starts a fresh chain rather than continuing a stale one.
      if (this.comboWindow <= 0) this.comboIndex = 0;
    }
  }

  _updateDown(dt) {
    const land = CONFIG.downLandMs / 1000;
    const lie = CONFIG.downLieMs / 1000;
    const rise = CONFIG.downRiseMs / 1000;

    if (this.downPhase === 'land') {
      const p = Math.min(1, this.stateT / land);
      this.jumpY = Math.sin(Math.PI * p) * (this.launch || 150);
      if (p >= 1) {
        this.jumpY = 0;
        this.downPhase = 'lie';
        this.stateT = 0;
        // A dead fighter stops here — `lie` never ends for it. Handled by the
        // dead test below rather than a separate phase, so the fall itself is
        // identical whether it is the last one or not.
      }
    } else if (this.downPhase === 'lie') {
      if (this.dead) return;
      if (this.stateT >= lie) { this.downPhase = 'rise'; this.stateT = 0; }
    } else if (this.downPhase === 'rise') {
      if (this.stateT >= rise) {
        this.state = 'idle';
        this.downPhase = '';
        this.stateT = 0;
        // A short grace after standing up, so the player is not immediately
        // clipped by whoever knocked them over.
        this.hurtT = 0.35;
      }
    }
  }

  /**
   * Advance ONLY what a corpse needs, for the frames after the world stops.
   *
   * The shell freezes the simulation the moment the player dies -- combat, AI
   * and the stage all stop, which is right, because a dead player should not
   * still be being punched. But the death animation has to keep playing, or it
   * freezes on frame one and reads as no death animation at all. So the shell
   * calls this instead of update(): the clock the death row runs on, and
   * nothing else.
   */
  tickDeath(dt) {
    if (!this.dead) return;
    this.deathT += dt;
    this.animT += dt;
  }

  /** How long the death row still has to run, in seconds. 0 if it has none. */
  deathRemaining(sheets) {
    if (!this.dead || !sheets.has(this.kind, 'death')) return 0;
    const n = sheets.poseLength(this.kind, 'death');
    const ms = (CONFIG.POSE_MS && CONFIG.POSE_MS.death) || 110;
    return Math.max(0, n * (ms / 1000) - this.deathT);
  }

  /** The pose to draw, derived from state — never stored, so it cannot fall out
      of step with the state that decides it. */
  pose(sheets) {
    /* DEATH IS ITS OWN ANIMATION when the pack has one. The coconut's sheet
       draws being knocked down and dying as two different rows, so a dead
       fighter plays the death row rather than holding the knockdown pose and
       fading. The grid packs have neither, so they fall through to `down` and
       keep the old behaviour. */
    if (this.dead && sheets && sheets.has(this.kind, 'death')) return 'death';
    if (this.state === 'down') return 'down';
    if (this.state === 'hurt') return 'hurt';
    if (this.atk) return this.atk.def.pose;
    /* IN THE AIR, BUT BELOW THE ATTACK — punching while jumping draws the
       punch, because that is the thing with a hitbox on it.

       `this.jumping` rather than `jumpY > 0`: a fighter LAUNCHED by the
       uppercut also has height, and that is a knockdown, which the `down`
       branch above has already claimed. */
    if ((this.jumping || (this.landHoldT > 0 && this.state !== 'walk'))
        && sheets && sheets.has(this.kind, 'jump')) return 'jump';
    if (this.state === 'walk') return 'walk';
    return 'idle';
  }

  /**
   * Which frame of the current pose to draw. THREE KINDS OF POSE, and which
   * one a pose is decides what clock drives it:
   *
   *   attack   driven by the attack PHASE, not by time — so a punch's frames
   *            are always in step with the window that can actually hit. Each
   *            combo hit is a 2-frame slice: wind-up on startup, strike on
   *            active and recover.
   *   one-shot hurt / down / death. Driven by `stateT`, played forward once and
   *            HELD on the last frame. Holding matters: a death that looped
   *            would resurrect the corpse every second.
   *   looping  idle / walk. Driven by the free-running `animT` and wrapped.
   *
   * The borrowed grid packs give every pose a length of 1, so all three
   * branches collapse to frame 0 for them and nothing changes.
   */
  frameStep(sheets) {
    const p = this.pose(sheets);
    const n = sheets.poseLength(this.kind, p);
    if (n <= 1) return 0;

    if (this.atk) {
      const a = this.atk;
      return a.phase === 'startup' ? 0 : a.phase === 'active' ? Math.min(1, n - 1) : n - 1;
    }

    /* THE JUMP IS DRIVEN BY THE ARC, NOT BY A CLOCK, and it is the only pose
       that is. Its frames are leaving the floor, apex, and coming down, so
       they have to stay married to the height the fighter is actually at — a
       fixed frame rate would drift the apex drawing into the descent the
       moment `jumpMs` is retuned. Spreading n frames over the arc means the
       jump animation retimes itself for free.

       At the current jumpMs 620 over six frames that is ~103ms a frame; it is
       NOT a POSE_MS entry, so changing the walk or idle rate leaves it alone. */
    if (p === 'jump') {
      if (!this.jumping) return n - 1;      // the landing hold
      const t = Math.min(1, this.jumpT / (CONFIG.jumpMs / 1000));
      return Math.min(n - 1, Math.floor(t * n));
    }

    const ms = (CONFIG.POSE_MS && CONFIG.POSE_MS[p]) || 110;
    // Death reads its own clock; the other one-shots reset with their state.
    if (p === 'death') {
      return Math.min(n - 1, Math.floor(this.deathT / (ms / 1000)));
    }
    if (p === 'hurt' || p === 'down') {
      return Math.min(n - 1, Math.floor(this.stateT / (ms / 1000)));
    }
    return Math.floor(this.animT / (ms / 1000)) % n;
  }

  draw(ctx, sheets, camX) {
    const gx = this.groundX(camX);
    const gy = this.groundY();

    /* The blink. A hit fighter flickers for the length of its i-frames, so the
       invulnerability is always exactly as long as the thing showing it — the
       same bargain every health bar in the flying dungeon makes. */
    let alpha = 1;
    if (this.hurtT > 0) {
      const period = CONFIG.hurtBlinkMs / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.35 : 1;
    }
    if (this.dead && this.downPhase === 'lie') {
      // Fade out where it fell, rather than vanishing.
      alpha *= Math.max(0, 1 - (this.stateT - 0.6) / 1.2);
    }

    /* A knocked-down fighter is ROTATED rather than given a lying-down frame,
       because the GRID packs have no such frame. It reads correctly: the
       squashed carry pose (col 3) tipped onto its back is a body on the floor.
       Rotation goes the way the blow pushed.

       THE ROTATION IS SKIPPED FOR A PACK THAT DRAWS ITS OWN KNOCKDOWN. The
       coconut's sheet has real falling and dying rows, and spinning a sprite
       that is already drawn lying down tips it face into the floor. */
    let rotate = 0;
    if (this.state === 'down' && !sheets.has(this.kind, 'down')) {
      const dir = this.vx >= 0 ? 1 : -1;
      const p = this.downPhase === 'land'
        ? Math.min(1, this.stateT / (CONFIG.downLandMs / 1000))
        : this.downPhase === 'rise'
          ? 1 - Math.min(1, this.stateT / (CONFIG.downRiseMs / 1000))
          : 1;
      rotate = dir * p * (Math.PI / 2) * 0.85;
    }

    sheets.draw(ctx, this.kind, this.facing, this.pose(sheets), this.frameStep(sheets),
                gx, gy, { alpha, rotate, flash: this.flash * 0.55, scale: this.depthScale() });
  }

  /**
   * The geometry of the current attack, whatever phase it is in. World coords,
   * on the FLOOR PLANE — an attack is a rectangle in (x, z), never a polygon
   * and never anything with a height in it.
   *
   * ONE SOURCE OF GEOMETRY, read by both the resolver and the debug view.
   * They must not each compute it: a debug overlay that draws a box other than
   * the one being tested is worse than no overlay, because it is believed.
   */
  _attackGeom() {
    const a = this.atk;
    if (!a) return null;
    const d = a.def;
    const s = facingSign(this.facing);
    return {
      // Extends FORWARD from the body only — a punch that reached behind the
      // fighter would let a player clear a crowd by standing in it and mashing.
      x0: s > 0 ? this.x : this.x - d.reachX,
      x1: s > 0 ? this.x + d.reachX : this.x,
      z0: this.z - d.reachZ,
      z1: this.z + d.reachZ,
      def: d,
      dir: s,
    };
  }

  /** The LIVE hitbox — only during the active frames, and only once. */
  hitbox() {
    const a = this.atk;
    if (!a || a.phase !== 'active' || a.hasHit) return null;
    return this._attackGeom();
  }

  /** The same box for the debug view, annotated with why it is or isn't live. */
  debugHitbox() {
    const g = this._attackGeom();
    if (!g) return null;
    g.phase = this.atk.phase;
    g.spent = !!this.atk.hasHit;
    g.live = this.atk.phase === 'active' && !this.atk.hasHit;
    return g;
  }

  /** Does a hitbox overlap this fighter's body? */
  overlaps(box) {
    if (!box) return false;
    const hw = this.halfW(), hz = this.halfZ();
    return box.x1 >= this.x - hw && box.x0 <= this.x + hw
        && box.z1 >= this.z - hz && box.z0 <= this.z + hz;
  }
}
