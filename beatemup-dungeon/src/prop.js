/**
 * prop.js — the things in the level that are not fighters.
 *
 * BARRELS, which can be punched apart or picked up and thrown, and FOOD, which
 * is stooped for with the punch button. Both arrived on 2026-08-22 off one sheet
 * (`barril-coconutbash.png`, cut by tools/build-beat-prop-defs.py).
 *
 * ⚠️ THEY ANSWER THE FIGHTERS' INTERFACE, AND THAT IS THE WHOLE DESIGN. A prop
 * has `x`, `z`, `jumpY`, `groundX()`, `depthScale()`, `draw()`, and a barrel
 * additionally has `vulnerable()`, `overlaps()` and `hurt()` -- the same shapes
 * `Fighter` and both bosses answer. So the shell's z-sort, its shadow pass and
 * the hit resolver all take props with no branch anywhere: a barrel is just
 * another thing a punch can find. That is the same bargain HorseBoss makes, and
 * it is why adding these cost combat.js three lines rather than a subsystem.
 *
 * WHAT A BARREL IS AT ANY MOMENT is one of five states:
 *
 *      idle ──punched──► smash ──► gone
 *        │                 ▲
 *      lifted              │
 *        │                 │
 *      held ──thrown──► thrown ─(lands, or hits someone)─┘
 *
 * ⚠️ `held` IS NOT A POSITION, IT IS AN OWNER. A held barrel reads its x and z
 * off the player every frame rather than being moved by whoever picked it up.
 * The other arrangement -- the player pushing the barrel around -- was what the
 * first sketch did, and it desynchronises the moment anything else moves the
 * player: knockback, the walk-out, a room fade. The barrel would stay where the
 * player was.
 *
 * ⚠️ AND IT IS DRAWN OVER HIS HEAD BECAUSE THE ART HAS NOTHING IN ITS HANDS.
 * The coconut's `carryWalk` row is five drawings of him with both arms raised
 * and NOTHING between them -- the object is meant to be drawn separately. So a
 * held barrel sits at `carryYRel` of a body height above his feet, and it sorts
 * just after him (see `sortZ`) so it is never hidden behind his own head.
 *
 * FOOD IS NOT A PROP, IT IS A PICKUP, and they are separate classes on purpose:
 * nothing about food is punchable, liftable, throwable or breakable, and a
 * single class covering both would be a barrel with four dead states or a
 * chicken with a hit box. They share only the atlas.
 */

/** Shared: the belt projection, identical to Fighter's so nothing drifts. */
function propGroundX(o, camX) { return o.x - camX; }
function propGroundY(o) { return CONFIG.beltTopY + o.z - (o.jumpY || 0); }
function propDepthScale(o) {
  const t = CONFIG.beltDepth ? o.z / CONFIG.beltDepth : 1;
  return CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
}

class Prop {
  constructor(kind, x, z) {
    const C = (CONFIG.PROPS && CONFIG.PROPS[kind]) || {};
    this.kind = kind;
    this.cfg = C;
    this.x = x;
    this.z = z;
    this.jumpY = 0;
    this.hp = C.hp || 5;
    this.state = 'idle';
    this.t = 0;
    this.facing = 'right';
    this.holder = null;
    this.vx = 0;                 // thrown: px/sec along the belt
    this.vy = 0;                 // thrown: px/sec of height
    this.hitIds = null;          // who this throw has already hit
    /* ⚠️ THE VARIANT AND THE SMASH ARE ROLLED HERE, ONCE, not at draw time.
       The sheet gives four upright barrels (two drawings and their mirrors) and
       two break sequences; picking per frame would make a barrel shimmer
       through all four and explode differently sixty times a second. Same rule
       as the impact bursts and the boss explosions. */
    this.variant = Math.floor(Math.random() * 4);
    this.smashPose = Math.random() < 0.5 ? 'smash' : 'smash2';
    /* ⚠️ WHAT IT DROPS IS DECIDED AT BIRTH, NOT AT DEATH, and that is not a
       nicety. Rolled when it breaks, a player who reloads and re-fights the
       same barrel gets a different answer each time, and -- worse -- so does
       the SAME barrel if anything ever breaks it twice. Decided here, a barrel
       either has a chicken in it or does not, which is what "os barris podem
       conter um frango" describes: it is in the barrel, not in the breaking. */
    this.drops = Math.random() < (C.dropChance != null ? C.dropChance : 0.5);
    /* The shell reads these two off everything it draws. A barrel is never
       knocked down and never dies as a fighter does; `dead` goes true when it
       is smashed so the hit resolver stops finding it. */
    this.dead = false;
    this.downPhase = '';
    /* ⚠️ NOT AN ENEMY. combat.js counts a kill whenever a target it damaged
       goes from alive to dead; without this a barrel would score on the CLEAR
       board as a fighter downed. */
    this.scores = false;
  }

  // --- The fighters' interface ---------------------------------------------
  groundX(camX) { return propGroundX(this, camX); }
  groundY() { return propGroundY(this); }
  depthScale() { return propDepthScale(this); }
  halfW() { return (this.cfg.sizePx || 110) * (this.cfg.hitWRel || 0.8) / 2; }
  halfZ() { return (this.cfg.hitZ || 46) / 2; }

  /** Only an intact barrel standing on the floor can be hit. */
  vulnerable() { return this.state === 'idle'; }

  overlaps(box) {
    if (!box) return false;
    const hw = this.halfW(), hz = this.halfZ();
    return box.x1 >= this.x - hw && box.x0 <= this.x + hw
        && box.z1 >= this.z - hz && box.z0 <= this.z + hz;
  }

  /**
   * Take a punch. The signature is the fighters' because the resolver calls it
   * the same way; everything past the damage is ignored -- a barrel cannot be
   * knocked back, lifted or floored, it can only be intact or not.
   */
  hurt(dmg) {
    if (!this.vulnerable()) return false;
    this.hp -= dmg;
    if (this.hp <= 0) this.smash(false);
    return true;
  }

  // --- Being carried --------------------------------------------------------

  /** Can `f` reach it? Range is a box, like every other reach in this game. */
  inLiftRange(f) {
    if (this.state !== 'idle') return false;
    const C = this.cfg;
    return Math.abs(f.x - this.x) <= (C.liftRangeX || 74)
        && Math.abs(f.z - this.z) <= (C.liftRangeZ || 46);
  }

  /**
   * Start being picked up. `ms` is how long the reach takes, so the barrel and
   * the animation finish together.
   *
   * ⚠️ THIS BEGINS AT THE PRESS, NOT AT THE END OF THE REACH. It used to be
   * called when the hoist animation finished, which meant the barrel spent
   * 640ms on the floor and then TELEPORTED to above his head on one frame. The
   * arms swing through an arc and the barrel has to be on it -- see
   * `_liftArc()`.
   */
  lift(by, ms) {
    if (this.state !== 'idle') return false;
    this.state = 'lifting';
    this.holder = by;
    this.t = 0;
    this.liftMs = ms || (CONFIG.PICKUP_MS && CONFIG.PICKUP_MS.heavy) || 640;
    this.fromX = this.x;
    this.fromZ = this.z;
    this.liftQ = 0;              // 0..1 along the arc; the draw reads it
    return true;
  }

  /**
   * One frame of the hoist: along the arc, turning over as it goes.
   *
   * THE PATH IS A STRAIGHT LINE PLUS A BULGE, which is the cheapest thing that
   * reads as an arm's swing: lerp from where it stood to where it will be
   * carried, then add a hump of `bulgePx` at the middle, biggest exactly when
   * the barrel is furthest from both ends. A straight lerp reads as the barrel
   * being slid up an invisible ramp.
   *
   * ⚠️ IT WAITS BEFORE IT MOVES. `startRel` of the reach is spent with the
   * barrel still on the floor, because the first frames of `lift` are him
   * REACHING DOWN for it -- start the barrel at zero and it leaves before he
   * has touched it.
   *
   * ⚠️ AND IT ABORTS IF HE IS HIT. Nothing else would: `player.carrying` is not
   * set until the hoist COMPLETES, so a barrel interrupted mid-lift would sail
   * up to a pair of hands that are busy being knocked over, arrive `held` with
   * nobody holding it, and follow him around forever. That is the fourth way
   * this pair of references can come apart -- see the header.
   */
  _liftArc(dt) {
    const h = this.holder;
    if (!h || h.dead || h.state === 'hurt' || h.state === 'down') { this.letGo(); return; }
    const L = (this.cfg.LIFT_ARC) || {};
    const startRel = L.startRel != null ? L.startRel : 0.3;
    const p = Math.min(1, this.t * 1000 / Math.max(1, this.liftMs));
    const raw = p <= startRel ? 0 : (p - startRel) / (1 - startRel);
    // Smoothstep: it leaves the floor gently and settles gently into the hands.
    const q = raw * raw * (3 - 2 * raw);
    this.liftQ = q;

    const toY = this._carryY();
    this.x = this.fromX + (h.x - this.fromX) * q;
    this.z = this.fromZ + (h.z - this.fromZ) * q;
    this.jumpY = toY * q + (L.bulgePx != null ? L.bulgePx : 34) * Math.sin(Math.PI * q);
    this.facing = h.facing;
    if (p >= 1) {
      this.state = 'held';
      this.liftQ = 1;
    }
  }

  /**
   * Thrown, in the direction the holder faces.
   *
   * IT LEAVES FROM WHERE IT WAS BEING HELD -- over the head -- rather than from
   * the floor, so the arc starts at the height the drawing has it at and the
   * throw reads as a throw rather than as a barrel appearing at his feet and
   * sliding away.
   */
  throwFrom(f) {
    if (this.state !== 'held') return false;
    const C = this.cfg;
    this._release();                    // clears both ends of the hold
    this.state = 'thrown';
    this.t = 0;
    this.facing = f.facing;
    this.x = f.x;
    this.z = f.z;
    this.jumpY = this._carryY();
    this.vx = (f.facing === 'right' ? 1 : -1) * (C.throwSpeed || 520);
    // `!= null` -- 0 is a legal value here (a flat throw with no arc at all),
    // and `||` would silently replace it with the default. See the bob.
    this.vy = C.throwLift != null ? C.throwLift : 120;
    this.hitIds = [];
    this.swingCounted = false;     // combat.js counts one swing per throw
    return true;
  }

  /**
   * Put down, where the holder is standing. Not a throw: the barrel is intact
   * and can be picked up again.
   *
   * ⚠️ IT LANDS AT HIS FEET, NOT AT HIS HANDS -- `jumpY` back to zero. A barrel
   * left at carry height with nothing holding it hangs in the air, and nothing
   * in the idle state ever brings it down again: `update` only moves a barrel
   * that is held or thrown.
   */
  drop(f) {
    if (this.state !== 'held') return;
    const by = f || this.holder;
    this._release();
    this.jumpY = 0;
    if (by) { this.x = by.x; this.z = by.z; }
    this.t = 0;
  }

  /**
   * Let go of it, whatever stage of the pickup it is at.
   *
   * ⚠️ IT COVERS `lifting` AS WELL AS `held`, AND THAT CLOSES A ONE-FRAME RACE.
   * The barrel arrives (`held`) on the frame the reach ends, and the player
   * takes hold of it on the NEXT frame -- his catch runs at the top of update
   * and the arc finishes below it. Get hit in that gap and the old code cleared
   * `liftTarget`, found `carrying` still null, and let go of nothing: the
   * barrel stayed `held`, following a player who did not know he had it, with
   * no way to throw or drop it ever again. Fifth of the family, same shape as
   * the other four -- two references, one relationship.
   *
   * Back where it stood if it never made it up; at his feet if it did. Intact
   * either way: being hit costs the lift, not the barrel.
   */
  letGo(f) {
    if (this.state === 'held') { this.drop(f); return; }
    if (this.state !== 'lifting') return;
    this.x = this.fromX;
    this.z = this.fromZ;
    this.jumpY = 0;
    this.liftQ = 0;
    this._release();
  }

  /** Break the hold, from both ends. See the note in update(). */
  _release() {
    if (this.holder && this.holder.carrying === this) this.holder.carrying = null;
    this.holder = null;
    this.state = 'idle';
  }

  _carryY() {
    return (this.cfg.carryYRel != null ? this.cfg.carryYRel : 1.15) * CONFIG.fighterSizePx;
  }

  /**
   * Break. `sideways` picks the rotated scatter, which is what a barrel that
   * was in the air when it broke has to use -- the upright burst drops its
   * splinters straight down out of a barrel that is not standing up.
   */
  smash(sideways) {
    if (this.state === 'smash' || this.state === 'gone') return;
    this.state = 'smash';
    this.t = 0;
    this.dead = true;
    this.sideways = !!sideways;
    this.holder = null;
  }

  /* NO GROUND SHADOW ONCE IT IS IN PIECES. An intact or airborne barrel keeps
     one -- it is what makes the throw's arc readable, the same job it does for
     a jumping fighter -- but a cloud of splinters casting one tidy ellipse
     reads as a shadow that outlived the thing making it. */
  get noShadow() { return this.state === 'smash' || this.state === 'gone'; }

  /** Where it sorts in the draw order. See the header: a held barrel is drawn
      just after the fighter holding it, never behind his own head. */
  get sortZ() {
    /* IN FRONT OF THE MAN HOLDING IT, and in front of the man LIFTING it too:
       the hoist ends with the barrel over his head, and drawing it behind him
       for the second half of that -- which is what sorting on its own `z` does
       once the arc has carried it to his -- puts his face through it. */
    return (this.holder && (this.state === 'held' || this.state === 'lifting'))
      ? this.holder.z + 0.5 : this.z;
  }

  update(dt, bounds) {
    this.t += dt;
    const C = this.cfg;

    if (this.state === 'lifting') { this._liftArc(dt); return; }

    if (this.state === 'held') {
      /* READ OFF THE HOLDER, never pushed by it -- see the header. */
      /* ⚠️ AND IT COMES BACK DOWN. Losing the holder without zeroing `jumpY`
         leaves the barrel hanging at carry height forever -- nothing brings an
         idle barrel down, because `update` only moves one that is held or
         thrown. It is the same trap `drop()` documents. */
      if (!this.holder || this.holder.dead) {
        /* ⚠️ THE HANDS ARE CLEARED FROM THIS SIDE TOO. `holder.carrying` and
           `this.holder` are one relationship stored twice, and breaking only
           half of it leaves the player in the carry pose holding a barrel that
           has decided it is on the floor -- with the punch button still trying
           to throw it. Every path that ends a hold goes through here or
           drop(); both clear both ends. */
        this._release();
        this.jumpY = 0;
        return;
      }
      this.x = this.holder.x;
      this.z = this.holder.z;
      this.jumpY = this.holder.jumpY + this._carryY();
      this.facing = this.holder.facing;
      return;
    }

    if (this.state === 'thrown') {
      this.x += this.vx * dt;
      // Likewise: 0 gravity is a legal (if silly) setting -- it flies straight.
      this.vy -= (C.throwGravity != null ? C.throwGravity : 900) * dt;
      this.jumpY += this.vy * dt;
      // Landed, or gone off the end of the belt: it breaks either way.
      if (this.jumpY <= 0) { this.jumpY = 0; this.smash(true); return; }
      if (bounds && (this.x < bounds.minX - 200 || this.x > bounds.maxX + 200)) {
        this.smash(true);
      }
      return;
    }

    if (this.state === 'smash') {
      if (this.t * 1000 >= (C.smashMs || 480)) this.state = 'gone';
    }
  }

  /** Which pose and frame it is drawing this instant. */
  _frame(sheets) {
    const C = this.cfg;
    if (this.state === 'smash') {
      const pose = this.sideways ? 'smashSide' : this.smashPose;
      const n = Math.max(1, sheets.poseLength('barril', pose));
      const p = Math.min(1, this.t * 1000 / (C.smashMs || 480));
      return { pose, step: Math.min(n - 1, Math.floor(p * n)) };
    }
    if (this.state === 'lifting' || this.state === 'thrown' || this.state === 'held') {
      /* ON ITS SIDE the moment it leaves the floor. The sheet's `side` row is
         the upright drawings rotated, so a barrel over the head and a barrel in
         the air are both drawn from it; `spinMs` is what makes a thrown one
         tumble and a held one sit still.

         ⚠️ THE HOIST DRAWS THE **SIDE** FRAME TOO, ROTATED BACK UPRIGHT, and
         that is what makes the turn seamless. The obvious way round -- draw the
         upright frame and rotate it to 90 -- ends the move on a rotated `idle`
         frame and then swaps to the `side` frame for the carry, and the two do
         not land on the same pixels because they are cut with their own
         anchors. Starting from the side frame at -90 and rotating to 0 puts the
         discontinuity at the START instead, where the barrel is lifting off the
         floor and the eye is following the movement. */
      const n = Math.max(1, sheets.poseLength('barril', 'side'));
      const ms = C.spinMs || 90;
      const step = this.state === 'thrown'
        ? Math.floor(this.t * 1000 / ms) % n
        : this.variant % n;
      return { pose: 'side', step };
    }
    const n = Math.max(1, sheets.poseLength('barril', 'idle'));
    return { pose: 'idle', step: this.variant % n };
  }

  draw(ctx, sheets, camX) {
    if (this.state === 'gone') return;
    const f = this._frame(sheets);
    const L = (this.cfg.LIFT_ARC) || {};
    /* THE TURN. -90 degrees is the barrel standing up; 0 is it lying on its
       side, which is how the `side` frame is drawn. So the hoist rotates from
       -90 to 0 as it travels, and everything after it is at 0.

       ⚠️ IT ROTATES ABOUT ITS OWN MIDDLE, not about its ground point, and that
       is what `pivotY` is for (see sheets.js). About the ground point it swings
       like a felled tree -- the far end scribes a huge arc and leaves his hands
       completely.

       ⚠️ AND THE SIGN IS NOT MIRRORED HERE. `sheets.draw` applies the facing
       flip AFTER the rotation, so a barrel lifted while facing left turns the
       other way for free; doing it here as well would cancel that out. */
    let rot = 0, pivotY = 0, drawY = this.groundY();
    if (this.state === 'lifting') {
      const spin = (L.spinDeg != null ? L.spinDeg : 90) * Math.PI / 180;
      rot = -(1 - this.liftQ) * spin;

      /* ⚠️ ROTATING IS NOT ENOUGH -- THE POSITION HAS TO BE CORRECTED WITH IT,
         and getting this wrong is a 40px sideways jump on the frame the hoist
         starts, which looks exactly like the teleport this was built to remove.
         The reason is that the frame is placed by its ANCHOR (the base of the
         lying barrel) and rotating about the middle swings that anchor away:
         at -90 degrees it lands a half-height to one side, so the drawing is
         offset by that much from where the barrel actually is.
   
         So the arithmetic is done on the CENTRE instead, which is the one point
         a rotation about the centre leaves alone:
   
           half      how far the centre sits above the floor, and it CHANGES as
                     the barrel turns -- half its width while standing on end,
                     half its height once flat (55px and 40px here)
           drawY     the anchor position that puts that centre where it belongs,
                     which is `centre + pivotY` because sheets.js pivots at
                     `pivotY` ABOVE whatever ground point it is given
   
         At liftQ 1 this collapses to plain `groundY()`, so the hoist ends
         exactly where the carry begins with nothing to reconcile. */
      const sz = sheets.size('barril', f.pose, f.step);
      const ds = this.depthScale();
      const halfLying = sz.h * ds / 2;         // flat: half its height
      const halfStanding = sz.w * ds / 2;      // on end: half its width
      const half = halfStanding + (halfLying - halfStanding) * this.liftQ;
      pivotY = halfLying;
      drawY = this.groundY() - half + halfLying;
    }
    /* ⚠️ THE SMASH DOES NOT SHRINK WITH DEPTH-SCALE THE WAY THE BARREL DOES.
       It does -- both use `depthScale()` -- and that is the point of saying so:
       the burst is drawn at the barrel's own depth, so a barrel broken at the
       back of the belt scatters smaller. Dropping the scale for the burst
       (which looked like more spectacle) makes the debris arrive from nowhere
       in a different perspective from the thing it came out of. */
    sheets.draw(ctx, 'barril', this.facing, f.pose, f.step,
                this.groundX(camX), drawY,
                { scale: this.depthScale(), rotate: rot, pivotY: pivotY });
  }
}

/**
 * A thing on the floor that is picked up with the PUNCH button, on purpose.
 *
 * ⚠️ IT USED TO BE EATEN BY WALKING OVER IT, AND THAT WAS REPLACED ON
 * 2026-08-24. The old note here argued that contact-eating was the genre's
 * arrangement and kept the pickup BUTTON free for barrels, "two things on one
 * button means the player who wanted the barrel gets the chicken that was lying
 * next to it". That reasoning was about the PICKUP button and it still holds --
 * which is why the verb moved to the PUNCH button instead. Standing over food
 * and punching stoops for it; the pickup button is untouched and still lifts
 * barrels.
 *
 * ⚠️ SO A PLAYER STANDING ON FOOD CANNOT PUNCH. That is the cost of the third
 * verb on that button and it is accepted: the level places food BETWEEN fights
 * rather than inside them (see CONFIG.ROOMS), so the case is rare by design. If
 * food ever ends up inside an arena, this is the thing that will go wrong.
 *
 * ⚠️ HE STOOPS FOR IT WITH THE PICKUP ANIMATION -- `pickGround`, row 9, the
 * same drawing the pickup button uses for a light object. Requested: the crouch
 * should be what taking food looks like. Nothing new was cut for it.
 *
 * ⚠️ IT IS TAKEN AT FULL HEALTH TOO, AND THAT IS DELIBERATE. The heal is
 * CAPPED rather than banked (see PROPS.food), so a chicken taken at a full bar
 * is worth nothing and is gone. The old rule refused it for exactly that
 * reason -- but that rule was written when food was eaten by WALKING OVER IT,
 * where the player had no say and losing one was an accident. With a button
 * there is no accident: he stoops because the player asked him to, and a punch
 * coming out of a press made to pick something up is worse than a wasted
 * drumstick. Changed on request 2026-08-24.
 *
 * ⚠️ THE FOOD OWNS THE REACH, NOT THE PLAYER, and it aborts itself if the
 * hand reaching for it is knocked over -- the same rule and the same test as
 * `Prop._liftArc`. A heal applied by a caller that had stopped existing is the
 * bug family this game keeps finding.
 */
class Pickup {
  constructor(kind, x, z) {
    this.kind = kind;              // 'chicken' | 'coxinha'
    this.x = x;
    this.z = z;
    this.jumpY = 0;
    this.t = 0;
    this.taken = false;
    /* 'idle' | 'taking'. The same two-word vocabulary Prop uses, so the player
       can ask this the way it asks a barrel whether it has arrived rather than
       counting frames of its own. */
    this.state = 'idle';
    this.claimedBy = null;
    this.claimT = 0;
    this.claimMs = 0;
    this.fromBarrel = false;      // set by whoever spawned it; DEV readout only
    this.dead = false;
    this.downPhase = '';
    this.scores = false;
    /* No ground shadow: it is lying ON the floor. An ellipse under a drumstick
       reads as the drumstick hovering. */
    this.noShadow = true;
  }

  get sortZ() { return this.z; }
  groundX(camX) { return propGroundX(this, camX); }
  groundY() { return propGroundY(this); }
  depthScale() { return propDepthScale(this); }

  /** How much health it is worth, in HP. */
  heal() {
    const F = (CONFIG.PROPS && CONFIG.PROPS.food) || {};
    const rel = (this.kind === 'chicken')
      ? (F.chickenRel != null ? F.chickenRel : 0.5)
      : (F.coxinhaRel != null ? F.coxinhaRel : 1 / 3);
    return Math.round(CONFIG.playerHealth * rel);
  }

  /**
   * Is `f` standing close enough to stoop for this? The geometry only -- what
   * the player's HEALTH is, is Props.eatTarget()'s business.
   *
   * ⚠️ `!= null` THROUGHOUT: a 0 here means "cannot be reached", which is a
   * legitimate thing to configure and which `||` would turn into the default.
   * See the bob in draw() below for what that mistake cost once already.
   */
  inEatRange(f) {
    if (this.taken || this.state !== 'idle' || !f || f.dead) return false;
    const F = (CONFIG.PROPS && CONFIG.PROPS.food) || {};
    if (Math.abs(f.x - this.x) > (F.rangeX != null ? F.rangeX : 52)) return false;
    if (Math.abs(f.z - this.z) > (F.rangeZ != null ? F.rangeZ : 40)) return false;
    if (Math.abs(f.jumpY) > (F.rangeY != null ? F.rangeY : 60)) return false;
    return true;
  }

  /**
   * He has started stooping for it. `ms` is the reach's own duration, handed in
   * so the food and the animation cannot drift apart -- the same bargain
   * `Prop.lift()` makes with the hoist.
   */
  claim(by, ms) {
    if (this.state !== 'idle' || this.taken) return false;
    this.state = 'taking';
    this.claimedBy = by;
    this.claimT = 0;
    this.claimMs = ms || (CONFIG.PICKUP_MS && CONFIG.PICKUP_MS.ground) || 420;
    return true;
  }

  /** Put it back on the floor, untouched. */
  letGo() {
    this.state = 'idle';
    this.claimedBy = null;
    this.claimT = 0;
  }

  /* `player` is still passed by Props.update and is deliberately not read: the
     food answers to whoever CLAIMED it, which is not necessarily whoever is
     being updated, and reading the argument would be a second opinion about
     the same thing. */
  update(dt) {
    this.t += dt;
    if (this.taken || this.state !== 'taking') return;
    /* ⚠️ IT ABORTS IF THE HAND REACHING FOR IT IS KNOCKED OVER, and this is the
       same test `Prop._liftArc` makes for the same reason. Being hit out of a
       stoop must leave the food ON THE FLOOR -- healing a player who is at that
       moment being punched across the room is the "what was still moving when
       this started" bug, and it would have read as a chicken vanishing for
       nothing. */
    const h = this.claimedBy;
    if (!h || h.dead || h.state === 'hurt' || h.state === 'down') { this.letGo(); return; }
    this.claimT += dt;
    if (this.claimT * 1000 < this.claimMs) return;
    /* ⚠️ CAPPED, NOT BANKED. Decided 2026-08-22: the heal fills the visible bar
       and anything past it is lost -- it does not roll into a life. Written as
       a clamp here rather than in the caller so there is one place that knows
       what eating does. */
    h.hp = Math.min(h.maxHp, h.hp + this.heal());
    this.state = 'idle';
    this.claimedBy = null;
    this.taken = true;
    this.dead = true;
  }

  draw(ctx, sheets, camX) {
    if (this.taken) return;
    const F = (CONFIG.PROPS && CONFIG.PROPS.food) || {};
    /* The bob, which is OFF (`bobPx` 0) -- food sits still.
       ⚠️ `!= null`, NOT `||`. Written as `F.bobPx || 3` this reads a configured
       ZERO as "not configured" and substitutes the default, so turning the bob
       off left it bobbing at exactly the rate it always had -- with a config
       value of 0 sitting right there in the file, and `CONFIG.PROPS.food.bobPx`
       answering 0 in the console. That cost a round trip with the user to find,
       and the whole class of it is: any knob whose OFF value is 0 must be read
       with `!= null`. Drawn-only either way -- `z` never moves, so what can be
       reached does not breathe in and out with the picture. */
    const amp = F.bobPx != null ? F.bobPx : 3;
    const bob = amp === 0 ? 0 : Math.sin(this.t * (F.bobRate || 3.2)) * amp;
    sheets.draw(ctx, 'barril', 'right', this.kind, 0,
                this.groundX(camX), this.groundY() + bob,
                { scale: this.depthScale() });
  }
}

/**
 * Everything in the room that is not a fighter.
 *
 * ONE LIST, TWO KINDS, and the shell asks it for `all()` to fold into the same
 * z-sorted draw the fighters use.
 *
 * ⚠️ PROPS BELONG TO THE ROOM, NOT TO THE SEGMENT. Enemies are spawned by the
 * segment they fight in, because a wave is an event; a barrel is scenery and
 * lives for as long as the room does. Hanging them off segments would make them
 * appear as the player walked into a fight, which is exactly the "materialising
 * in front of you" that the enemy walk-in exists to avoid.
 */
class Props {
  constructor() { this.list = []; }

  /**
   * Lay out a room's props. `room` is a CONFIG.ROOMS entry.
   *
   * ⚠️ IT EMPTIES THE PLAYER'S HANDS, and forgetting to was a real bug: he can
   * walk out of a room still carrying a barrel, and the list it belonged to is
   * discarded here. The prop then exists only as `player.carrying` -- never
   * drawn, never updated, never released -- so he arrives in the next room
   * stuck in the carry pose, with the punch button throwing a barrel nobody can
   * see. The room owns its props; leaving one means losing it.
   */
  enterRoom(room, player) {
    this.clear(player);
    for (const p of (room && room.props) || []) {
      this.add(p.kind, p.x, p.z);
    }
  }

  clear(player) {
    if (player) { player.carrying = null; player.liftTarget = null; }
    this.list = [];
  }

  /**
   * Put one thing in the room. Returns it, or null if it was refused.
   *
   * ⚠️ THE BARREL FEATURE SWITCH IS HERE, at the ONE funnel everything goes
   * through -- room layout, and the chicken a break leaves behind. Gating it in
   * `enterRoom` instead would let any later caller slip a barrel past a switch
   * that is supposed to mean "there are no barrels in this game".
   *
   * `PROPS.barrel.on: false` turns them off whole: none are laid out, so
   * nothing can be punched apart or picked up, `liftTarget()` never finds
   * anything and the pickup button goes back to a stoop at empty air -- which
   * is exactly what it did before barrels existed. The PLACEMENTS STAY IN THE
   * CONFIG, unread; turning them back on is the same one line.
   *
   * ⚠️ IT DOES NOT TAKE THE FOOD WITH IT. Drumsticks are placed by hand and are
   * their own feature; what does go is the chicken that would have been INSIDE
   * a barrel, because there is no barrel. Nor does it unload the ART: the food
   * and the barrels are one sheet, so `CHARACTERS.barril` stays loaded either
   * way.
   */
  add(kind, x, z) {
    const food = (kind === 'chicken' || kind === 'coxinha');
    if (!food) {
      const C = (CONFIG.PROPS && CONFIG.PROPS[kind]) || {};
      if (C.on === false) return null;
    }
    const o = food ? new Pickup(kind, x, z) : new Prop(kind, x, z);
    this.list.push(o);
    return o;
  }

  /** Everything still worth drawing. */
  all() { return this.list; }

  /** The barrel a fighter could pick up right now, or null. Nearest wins. */
  liftTarget(f) {
    let best = null, bestD = Infinity;
    for (const o of this.list) {
      if (!(o instanceof Prop) || !o.inLiftRange(f)) continue;
      const d = Math.abs(o.x - f.x);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /**
   * The food a fighter could stoop for right now, or null. Nearest wins, the
   * same way `liftTarget` picks a barrel.
   *
   * ⚠️ HEALTH IS NOT ASKED ABOUT, AND THAT IS A DECISION. It used to return
   * nothing at a full bar, so a chicken could not be wasted by taking it when
   * it was worth nothing -- that rule dated from when food was eaten by WALKING
   * OVER IT, where the player had no say and a wasted one was an accident.
   * With a button there is no accident: he stoops because the player asked him
   * to. Requested 2026-08-24, and the button being predictable is worth more
   * than the chicken -- the alternative is a punch coming out of a press the
   * player made to pick something up.
   */
  eatTarget(f) {
    if (!f) return null;
    let best = null, bestD = Infinity;
    for (const o of this.list) {
      if (!(o instanceof Pickup) || !o.inEatRange(f)) continue;
      const d = Math.abs(o.x - f.x);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /** Intact barrels, for the hit resolver to consider as targets. */
  targets() {
    const out = [];
    for (const o of this.list) if (o instanceof Prop && o.vulnerable()) out.push(o);
    return out;
  }

  update(dt, player, crowd, combat, bounds, boss) {
    for (const o of this.list) {
      if (o instanceof Pickup) { o.update(dt, player); continue; }
      o.update(dt, bounds);
      /* A BARREL IN THE AIR IS A WEAPON, and this is the only place in the game
         where the PLAYER damages something without having punched it. It goes
         through combat.propHits() rather than calling hurt() directly, so the
         blow gets the same impact burst, the same sound and the same stats as
         any other -- the resolver stays the one place a blow is decided. */
      if (o.state === 'thrown' && combat) combat.propHits(o, crowd, player, boss);
      /* WHAT WAS INSIDE IT. Spawned on the frame it BREAKS rather than when the
         debris clears, so the chicken is revealed by the burst instead of
         appearing in a settled pile a beat later. */
      if (o.state === 'smash' && o.drops) {
        o.drops = false;
        /* ⚠️ FLAGGED AS A DROP. It matters for exactly one thing -- the DEV
           readout counts placed food and dropped food separately -- and that
           one thing is worth it: "there are three drumsticks on the floor and
           the config only places two" is not a contradiction, it is a chicken
           out of a barrel, and there was no way to see that from the outside. */
        const drop = this.add('chicken', o.x, o.z);
        if (drop) drop.fromBarrel = true;
      }
    }
    // Reap. Held barrels are never reaped -- `gone` is only ever set by smash().
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if ((o instanceof Prop && o.state === 'gone') || (o instanceof Pickup && o.taken)) {
        this.list.splice(i, 1);
      }
    }
  }
}
