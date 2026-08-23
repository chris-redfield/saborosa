/**
 * prop.js — the things in the level that are not fighters.
 *
 * BARRELS, which can be punched apart or picked up and thrown, and FOOD, which
 * is walked over and eaten. Both arrived on 2026-08-22 off one sheet
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

  lift(by) {
    if (this.state !== 'idle') return false;
    this.state = 'held';
    this.holder = by;
    this.t = 0;
    return true;
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
  get sortZ() { return this.state === 'held' && this.holder ? this.holder.z + 0.5 : this.z; }

  update(dt, bounds) {
    this.t += dt;
    const C = this.cfg;

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
    if (this.state === 'thrown' || this.state === 'held') {
      /* ON ITS SIDE the moment it leaves the floor. The sheet's `side` row is
         the upright drawings rotated, so a barrel over the head and a barrel in
         the air are both drawn from it; `spinMs` is what makes a thrown one
         tumble and a held one sit still. */
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
    /* ⚠️ THE SMASH DOES NOT SHRINK WITH DEPTH-SCALE THE WAY THE BARREL DOES.
       It does -- both use `depthScale()` -- and that is the point of saying so:
       the burst is drawn at the barrel's own depth, so a barrel broken at the
       back of the belt scatters smaller. Dropping the scale for the burst
       (which looked like more spectacle) makes the debris arrive from nowhere
       in a different perspective from the thing it came out of. */
    sheets.draw(ctx, 'barril', this.facing, f.pose, f.step,
                this.groundX(camX), this.groundY(),
                { scale: this.depthScale() });
  }
}

/**
 * A thing on the floor that is eaten by walking over it.
 *
 * ⚠️ NO BUTTON. Food is taken on contact, which is the genre's arrangement and
 * the reason the pickup BUTTON stays free for barrels: two things on one button
 * means the player who wanted the barrel gets the chicken that was lying next
 * to it. The button lifts, walking eats.
 *
 * ⚠️ AND IT IS NOT EATEN AT FULL HEALTH. It stays on the floor instead, so a
 * chicken cannot be wasted by walking over it on the way past -- which matters
 * here more than in most games, because the heal is capped rather than banked
 * (see PROPS.food) and a wasted one is gone for nothing.
 */
class Pickup {
  constructor(kind, x, z) {
    this.kind = kind;              // 'chicken' | 'coxinha'
    this.x = x;
    this.z = z;
    this.jumpY = 0;
    this.t = 0;
    this.taken = false;
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

  update(dt, player) {
    this.t += dt;
    if (this.taken || !player || player.dead) return;
    const F = (CONFIG.PROPS && CONFIG.PROPS.food) || {};
    if (player.hp >= player.maxHp) return;         // not wasted -- see the header
    // `!= null` throughout: a 0 here means "cannot be reached", which is a
    // legitimate thing to configure and which `||` would turn into the default.
    if (Math.abs(player.x - this.x) > (F.rangeX != null ? F.rangeX : 52)) return;
    if (Math.abs(player.z - this.z) > (F.rangeZ != null ? F.rangeZ : 40)) return;
    if (Math.abs(player.jumpY) > (F.rangeY != null ? F.rangeY : 60)) return;
    /* ⚠️ CAPPED, NOT BANKED. Decided 2026-08-22: the heal fills the visible bar
       and anything past it is lost -- it does not roll into a life. Written as
       a clamp here rather than in the caller so there is one place that knows
       what eating does. */
    player.hp = Math.min(player.maxHp, player.hp + this.heal());
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
