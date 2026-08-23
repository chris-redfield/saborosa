/**
 * HorseBoss — the final boss, and the second thing in this game that fights
 * without being a Fighter.
 *
 * It answers the same handful of questions FlyBoss does — `vulnerable()`,
 * `overlaps()`, `hurt()`, `hitbox()`, `update()`, `draw()`, `finished()` — so
 * combat.js needs no branch for it and the debug overlay draws its box on the
 * same terms as everyone else's. That interface is the contract; everything
 * below it is its own.
 *
 * WHY IT IS NOT AN Enemy. A mook's `_think` is approach, circle, wind, commit,
 * and every villain in the game is that loop with different numbers. This one
 * cannot be: it has no circling (a horse does not sidestep), its main attack
 * CROSSES THE WHOLE ROOM and ends at a wall, and turning round costs it half a
 * second of real vulnerability. The barata's charge already forced that loop to
 * branch once; a second branch this deep would be a different animal wearing
 * the same brain.
 *
 * THE ART IS THE DESIGN. Five rows arrived — runAttack, trot, walk, kick, turn
 * — and the moveset is exactly those five. Nothing here invents a move the
 * sheet cannot show, which is the rule that kept the cigarettes honest too.
 *
 * ⚠️ THERE IS NO hurt, knockdown OR death ART, confirmed rather than assumed.
 * Damage reads as an additive FLASH plus a blink, which is precisely what the
 * Mosca does for the same reason, now with the impact burst stamped on top of
 * it (see hit-fx.js). Do not press one of the movement rows into service as a
 * hurt pose: a horse that trots when you punch it reads as a horse ignoring
 * you, which is worse than one that only flashes.
 *
 * ⚠️ THE TURN IS SEVEN DRAWN FRAMES AND IT IS THE FIGHT'S ONE OPENING.
 * Everything else in the game changes facing with a negative x-scale, for free.
 * This one plays a rotation — left profile, head-on, right profile — and cannot
 * attack while it does. Get behind him and that window is the reward. It is
 * also why `turn` must be drawn with the mirror FORCED OFF: the row already
 * contains both profiles, so flipping it would fold the rotation in half and he
 * would appear to turn back the way he came.
 */
class HorseBoss {
  /* Tells drawEntities in game.js which art source to hand `draw()`. The Mosca
     answers with raw images out of `assets` because its art is a 7-pose turn
     across two flapping files; this one is a proper ragged pack and wants
     `sheets`. Asked rather than assumed, so a third boss can be either. */
  get usesSheets() { return true; }

  constructor(x, z, camX, facing) {
    const C = CONFIG.HORSE_BOSS;
    this.kind = 'horse';
    this.x = x;
    this.z = z;
    this.jumpY = 0;          // he never leaves the floor; kept so the shared
                             // depth/ground helpers read the same as a fighter
    /* NO GROUND SHADOW, on request 2026-08-22. Every other fighter casts one
       and it is load-bearing for them -- an ellipse on the floor is the only
       way to read where a jump will land and which of two bodies is in front.
       ⚠️ HE NEVER JUMPS AND HE IS NEVER BEHIND ANYTHING: the boss room holds
       exactly two characters, and by the time he arrives the ellipse was doing
       nothing but sitting under an animal whose own hooves already say where he
       stands. `game.js`'s shadow pass reads this flag; it is a property rather
       than a `kind === 'horse'` test there so a future boss can say the same
       thing without that function learning about it. */
    this.noShadow = CONFIG.HORSE_BOSS.shadow === false;
    this.hp = C.health;
    this.maxHp = C.health;
    this.dead = false;
    this.facing = facing || 'left';
    this.phase = 'enter';
    this.t = 0;
    this.animT = 0;
    this.hurtT = 0;
    this.flash = 0;
    /* The attack currently live, or null. Shaped like a Fighter's `atk` on
       purpose -- combat.js reads `hasHit` off whatever hitbox() came from, and
       one shape for "a blow in progress" is one less thing to get wrong. */
    this.atk = null;
    /* The death explosions, rolled on the frame he dies and not before -- see
       _armBooms(). Empty until then, so draw() has nothing to skip. */
    this.blasts = [];
    this.turnTo = null;      // facing being turned toward, during 'turn'
    this.passes = 0;         // charges completed; only used to vary the rhythm
    this.chargeZ = null;     // the lane a charge committed to; see _charge()
    this.afterTurn = null;   // what the turn in progress is FOR; see _face()
    this.approachTarget = null;  // committed destination of an approach
    /* Seconds since the last charge ended. Starts high so the fight can open
       with one; see chargeCooldownMs. */
    this.sinceCharge = 999;
    this.kickArmed = false;
    this.intent = null;      // the move he is currently committed to; see _decide()
    this.hasHit = false;     // the live blow has connected; see hitbox()
    /* Where the walk-in stops. He is CREATED off the right-hand edge and given
       a destination inside the room, rather than being placed and then told to
       walk -- so `x` is always where he really is and the entrance needs no
       separate "am I still arriving" position. */
    this.targetX = x;
    this.x = x + (CONFIG.HORSE_BOSS.enterMargin || 240)
               + CONFIG.GAME_W * 0.5;
  }

  // --- The shared fighter surface -------------------------------------------

  /* Cannot be hurt while walking in. Still Life's rule, and the Mosca's: an
     entrance that can be interrupted is not an entrance. */
  arrived() { return this.phase !== 'enter'; }
  vulnerable() { return !this.dead && this.arrived() && this.hurtT <= 0; }

  halfW() { return CONFIG.HORSE_BOSS.sizePx * CONFIG.HORSE_BOSS.hitWRel / 2; }
  halfZ() { return CONFIG.HORSE_BOSS.hitZ / 2; }
  bodyHeight() { return CONFIG.HORSE_BOSS.sizePx; }

  groundX(camX) { return this.x - camX; }
  groundY() { return CONFIG.beltTopY + this.z - this.jumpY; }
  /* The belt's own near/far scale, read the same way FlyBoss reads it. Copied
     rather than invented: a second formula here would put the boss on a
     different floor from everyone else. */
  depthScale() {
    const t = CONFIG.beltDepth ? this.z / CONFIG.beltDepth : 1;
    return CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
  }

  /**
   * Does an attacker's box reach him?
   *
   * ⚠️ BOXES IN THIS GAME ARE EDGES (x0/x1/z0/z1), NOT CENTRE-AND-HALF-EXTENT,
   * and this must match Fighter.overlaps() character for character. Written the
   * other way it does not throw and does not warn -- it reads `box.x` off a
   * box that has no `x`, compares against undefined, and quietly answers false
   * forever. The boss simply cannot be punched, which presents as a hitbox
   * tuning problem and is not one.
   */
  overlaps(box) {
    if (!box) return false;
    const hw = this.halfW(), hz = this.halfZ();
    return box.x1 >= this.x - hw && box.x0 <= this.x + hw
        && box.z1 >= this.z - hz && box.z0 <= this.z + hz;
  }

  /**
   * Take a hit.
   *
   * IT DOES NOT INTERRUPT. A mook's `hurt()` cancels whatever it was doing;
   * this one keeps running, kicking or turning, and only flashes. That is the
   * difference between a boss and a mook in this genre — if a charge could be
   * punched out of the air the move would never land and the fight would have
   * no shape. Compare Fighter.hurt(), which does interrupt, and FlyBoss.hurt(),
   * which does not, for the same reason.
   */
  hurt(dmg) {
    if (!this.vulnerable()) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 1;
    this.hurtT = (CONFIG.HORSE_BOSS.hurtMs || 150) / 1000;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.atk = null;
      this.phase = 'die';
      this.t = 0;
      this._armBooms();
    }
    return true;
  }

  /**
   * The live hitbox, or null.
   *
   * ⚠️ THE KICK REACHES BACKWARDS AND THAT IS NOT A BUG. `coice` is a horse
   * kicking with its hind legs: the hooves come out of the end he is NOT facing.
   * So its box sits on the opposite side to every other attack in this game,
   * and it is the answer to a player who has walked round behind him. Flip this
   * to the "normal" side and the damage stops agreeing with the drawing.
   */
  _attackGeom() {
    const a = this.atk;
    if (!a) return null;
    const face = this.facing === 'right' ? 1 : -1;
    const dir = a.backwards ? -face : face;
    return {
      x0: dir > 0 ? this.x : this.x - a.reachX,
      x1: dir > 0 ? this.x + a.reachX : this.x,
      z0: this.z - a.reachZ,
      z1: this.z + a.reachZ,
      def: a,
      dir,
    };
  }

  /**
   * The live contact box, or null.
   *
   * ⚠️ THE SPENT FLAG IS `this.hasHit`, ON THE BOSS, NOT ON THE ATTACK, and
   * that is combat.bossHits()'s contract rather than a choice: it writes
   * `boss.hasHit = true` directly after a connect, exactly as FlyBoss expects.
   * Gate this on `atk.hasHit` instead and the flag combat sets lands on an
   * unread property -- the box stays live and the CHARGE damages the player on
   * every single frame it overlaps them. `_swing()` clears it.
   *
   * ⚠️ THE KICK REACHES BACKWARDS AND THAT IS NOT A BUG. `coice` is a horse
   * kicking with its hind legs: the hooves come out of the end he is NOT facing.
   * So its box sits on the opposite side to every other attack in this game,
   * and it is the answer to a player who has walked round behind him. Flip it
   * to the "normal" side and the damage stops agreeing with the drawing.
   */
  hitbox() {
    if (this.dead || !this.atk || this.atk.phase !== 'active' || this.hasHit) {
      return null;
    }
    return this._attackGeom();
  }

  /* The same box for the overlay, annotated with why it is or is not live --
     the shape debug.js reads, and it draws from THIS rather than from its own
     copy of the geometry. See the header of debug.js. */
  debugHitbox() {
    const g = this._attackGeom();
    if (!g) return null;
    g.phase = this.atk.phase;
    g.spent = !!this.hasHit;
    g.live = this.atk.phase === 'active' && !this.hasHit;
    return g;
  }

  // --- The fight ------------------------------------------------------------

  _to(phase) { this.phase = phase; this.t = 0; this.animT = 0; }

  /** Start an attack. `backwards` is the kick; see hitbox(). */
  _swing(def, backwards) {
    // Cleared HERE, because this is the flag combat.bossHits() sets. One blow,
    // one connect -- see hitbox().
    this.hasHit = false;
    this.atk = Object.assign({ phase: 'startup', backwards: !!backwards }, def);
  }

  /** Advance the live attack's phases. Returns true once it is spent. */
  _tickAttack(dt) {
    const a = this.atk;
    if (!a) return false;
    a.t = (a.t || 0) + dt * 1000;
    if (a.t < a.startupMs) a.phase = 'startup';
    else if (a.t < a.startupMs + a.activeMs) a.phase = 'active';
    else if (a.t < a.startupMs + a.activeMs + a.recoverMs) a.phase = 'recover';
    else { this.atk = null; return true; }
    return false;
  }

  /** Which way the player is, as a facing. */
  _sideOf(player) { return player.x >= this.x ? 'right' : 'left'; }

  /**
   * The boss's OWN movement limits: the player's walls, widened by the charge
   * overrun.
   *
   * ⚠️ HE MUST NOT BE CLAMPED TO THE PLAYER'S WALLS, and this is not cosmetic.
   * A charge deliberately overruns them -- that is what stops him braking -- so
   * he finishes a pass standing outside them. Clamp the next phase to the
   * narrower box and he is teleported back to the wall, which is exactly where
   * the player he just charged past is standing: measured, he ended up a median
   * of 36px from them, permanently "walled", unable to open any distance, and
   * therefore kicking forever with the charge never offered again.
   *
   * One set of limits, used by every phase that moves him.
   */
  _limits(bounds) {
    const o = CONFIG.HORSE_BOSS.chargeOverrun || 0;
    const lo = (bounds && bounds.minX != null) ? bounds.minX : 0;
    const hi = (bounds && bounds.maxX != null) ? bounds.maxX : CONFIG.GAME_W;
    return { lo: lo - o, hi: hi + o };
  }

  /**
   * Begin coming about, if he is not already facing that way.
   *
   * Returns true if a turn was started. The seven frames are real time in which
   * he does nothing else — see the warning in the header.
   *
   * ⚠️ `after` IS NOT OPTIONAL IN SPIRIT, and leaving it out caused the first
   * bug this class had. The turn used to always hand back to `idle`, so the
   * kick — which needs him facing AWAY from the player, because he kicks
   * backwards — could never happen: he closed in, turned his hindquarters to
   * the player, went to idle, idle turned him back to face them, and he trotted
   * in again. An infinite pirouette that never threw a single kick, and it
   * looks like an AI that cannot make up its mind rather than like a missing
   * return value. A turn is a means to something; say what.
   */
  _face(want, after) {
    if (want === this.facing) return false;
    this.turnTo = want;
    this.afterTurn = after || 'idle';
    this._to('turn');
    return true;
  }

  update(dt, player, bounds) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    if (this.hurtT > 0) this.hurtT -= dt;
    this.t += dt;
    this.animT += dt;
    if (this.phase !== 'charge') this.sinceCharge += dt;

    /* Stashed because two phases besides the charge need the arena's edges --
       the back-off has to know when it has run out of room. */
    this._bounds = bounds;

    if (this.phase === 'die') { this._die(dt); return; }

    /* The attack clock runs regardless of phase, so a kick that is mid-recover
       cannot be cut short by the state machine moving on. */
    this._tickAttack(dt);

    switch (this.phase) {
      case 'enter':  this._enter(dt, player); break;
      case 'idle':   this._idle(dt, player); break;
      case 'turn':   this._turn(dt); break;
      case 'trot':   this._trot(dt, player); break;
      case 'approach': this._approach(dt, player); break;
      case 'tell':   this._tell(dt, player); break;
      case 'charge': this._charge(dt, bounds); break;
      case 'kick':   this._kick(dt); break;
    }
  }

  /* Walks in from the right and stops. Not hittable until this ends. */
  _enter(dt, player) {
    const C = CONFIG.HORSE_BOSS;
    this.facing = 'left';
    this.x -= C.enterSpeed * dt;
    if (this.x <= this.targetX) {
      this.x = this.targetX;
      this._to('idle');
    }
  }

  /**
   * Roll the next move.
   *
   * ⚠️ DISTANCE DECIDES WHAT IS AVAILABLE; THE ROLL DECIDES WHICH. That split is
   * the whole lesson of this function, and it took three attempts.
   *
   *   1. Distance picked the move outright. He trots toward the player at
   *      200px/s, so by the time the check ran he had closed 300px and was
   *      never far enough to charge -- he had to START more than 620px out.
   *      The signature move fired about once a fight.
   *   2. A pure roll, with a back-off to manufacture the range. A player who
   *      simply stays close follows him as he retreats, so the range never
   *      arrives: measured, 0 charges in three minutes.
   *   3. This. Being far enough is a real precondition -- a run-up needs room --
   *      but it only decides what is IN the hat, never what comes out of it.
   *
   * And `approach` is why there are three actions rather than two. With only
   * charge and kick, every roll taken at range was a charge, and the fight was
   * one move on a loop. Approach is him closing the distance committing to
   * nothing, which is what makes the charge read as a choice.
   */
  _decide(player) {
    const C = CONFIG.HORSE_BOSS;
    const W = C.ACTIONS || { charge: 50, kick: 50, approach: 50 };
    const gap = Math.abs(player.x - this.x);
    /* THE BAND. Far enough for a run-up, and he may charge; otherwise the
       aggressive option is the kick. Either way `approach` is always in the
       hat, so neither band can become a single move on repeat. */
    /* Far enough to run at them, AND not fresh off a pass. On cooldown the
       aggressive option becomes the kick, so he walks in and does that instead
       -- see chargeCooldownMs. */
    /* How far out he is, 0 at the threshold and 1 from `chargeFarRange` on.
       Both the charge's weight and its cooldown are read off this. */
    const span = Math.max(1, (C.chargeFarRange || 600) - C.chargeMinRange);
    const far = Math.max(0, Math.min(1, (gap - C.chargeMinRange) / span));

    const farScale = C.chargeCooldownFarScale != null ? C.chargeCooldownFarScale : 1;
    const cool = ((C.chargeCooldownMs || 0) / 1000) * (1 - (1 - farScale) * far);
    const canCharge = gap >= C.chargeMinRange && this.sinceCharge >= cool;
    const attack = canCharge ? 'charge' : 'kick';
    /* ⚠️ THE CHARGE'S WEIGHT RISES WITH DISTANCE. Flat, it made a retreating
       player see FEWER charges than one milling about nearby -- backwards for
       the one move that exists to cover ground. Half weight at the threshold,
       full weight from `chargeFarRange` out. */
    let wa = (attack === 'charge' ? W.charge : W.kick) || 0;
    if (attack === 'charge') {
      const near = C.chargeNearWeight != null ? C.chargeNearWeight : 0.5;
      wa *= near + (1 - near) * far;
    }
    const wp = W.approach || 0;
    const total = Math.max(1e-6, wa + wp);
    this.intent = (Math.random() * total < wa) ? attack : 'approach';
    return this.intent;
  }

  _idle(dt, player) {
    const C = CONFIG.HORSE_BOSS;
    if (this.t * 1000 < C.idleMs) return;
    const want = this.intent || this._decide(player);

    /* ⚠️ IT DOES NOT TURN HIM HERE. Each phase picks its own facing, and doing
       it in advance caused a visible thrash: idle turned him TOWARD the player,
       then `_approach` -- which faces the way it is travelling, and travels away
       when it wants room -- immediately turned him back. Two 460ms turns per
       cycle, and measured, he spent 45% of the fight pirouetting. Whoever moves
       decides which way he faces. */
    this._to(want === 'charge' ? 'tell' : want === 'approach' ? 'approach' : 'trot');
  }

  /**
   * Working his way to a comfortable distance. No attack at the end of it.
   *
   * ⚠️ HE WALKS TO A STANDOFF SPOT, NOT SIMPLY "TOWARD" OR "AWAY", and the
   * difference only shows up in a corner. There are two places at the right
   * distance -- one either side of the player -- and the naive version always
   * picked the one directly away from them. Finish a charge in the pocket
   * between the wall and the player and that spot is outside the room: he
   * walks into the wall, gives up, and kicks, forever, with the charge never
   * offered again because the gap never reaches `chargeMinRange`. Measured, he
   * sat a median of 36px from a cornered player for four minutes.
   *
   * Picking the nearest REACHABLE spot fixes it without a special case: in the
   * open it is the one behind him, and in a corner it is the one on the far
   * side, so he walks past the player to get his room back.
   *
   * This is also the beat that stops the fight being one move on repeat, so
   * resist giving it a payoff. Its job is to be what he does when he is not
   * attacking.
   */
  _approach(dt, player) {
    const C = CONFIG.HORSE_BOSS;
    const { lo, hi } = this._limits(this._bounds);

    /* ⚠️ CHOSEN ONCE PER APPROACH AND THEN COMMITTED TO. Recomputing it every
       frame looks harmless and is not: the player moves too, so the nearest of
       the two spots flips the moment he crosses the midpoint between them, and
       he turns round to chase the new one. Against a player who follows him
       that flapped every couple of steps -- measured, 78% of the fight spent
       turning and one kick thrown in four minutes. A destination you re-pick
       continuously is not a destination. */
    if (this.approachTarget == null) this.approachTarget = this._standoff(player);
    const target = this.approachTarget;
    const want = Math.abs(target - player.x);

    const d = target - this.x;
    const side = d >= 0 ? 'right' : 'left';
    if (this._face(side, 'approach')) return;

    // Depth is tracked only while CLOSING; giving himself room in x must not
    // cost him the lane he wants to charge down.
    this._step(dt, player, side, C.trotSpeed, Math.abs(player.x - this.x) > want);
    this.x = Math.max(lo, Math.min(hi, this.x));

    const arrived = Math.abs(target - this.x) <= 14;
    if (arrived || this.t * 1000 >= C.approachMs) {
      this.intent = null;
      this.approachTarget = null;
      this._to('idle');
    }
  }

  /**
   * The nearest place at standoff distance that is actually inside the room.
   *
   * The distance is ROLLED per approach, across a band that straddles
   * `chargeMinRange` -- see the config note. A fixed distance made every
   * approach end at charge range, so the fight became walk-then-charge on a
   * loop.
   */
  _standoff(player) {
    const C = CONFIG.HORSE_BOSS;
    const { lo, hi } = this._limits(this._bounds);
    const want = C.approachStopMin
      + Math.random() * Math.max(0, C.approachStopMax - C.approachStopMin);
    const spots = [player.x - want, player.x + want]
      .filter(v => v >= lo && v <= hi)
      .sort((a, b) => Math.abs(a - this.x) - Math.abs(b - this.x));
    // Nothing reachable at all (a room narrower than the standoff): take the
    // corner furthest from the player rather than standing still.
    if (!spots.length) {
      return Math.abs(lo - player.x) > Math.abs(hi - player.x) ? lo : hi;
    }
    /* PREFER THE NEAREST SPOT THAT IS ACTUALLY WORTH WALKING TO. A target a few
       px away ends the approach on its first frame and he rolls another one
       straight away -- see approachMinTravel. */
    const min = CONFIG.HORSE_BOSS.approachMinTravel || 0;
    const worth = spots.find(v => Math.abs(v - this.x) >= min);
    return worth != null ? worth : spots[spots.length - 1];
  }

  /** Walk in `side`, and close in DEPTH unless told otherwise. Shared. */
  _step(dt, player, side, speed, trackZ) {
    this.x += (side === 'right' ? 1 : -1) * speed * dt;
    /* Depth is tracked even while backing off in x, because the charge lines up
       on the lane the player is in -- losing depth every time he gave himself
       room would make every charge miss by construction. */
    if (trackZ === false) return;
    const dz = player.z - this.z;
    if (Math.abs(dz) > 4) this.z += Math.sign(dz) * Math.min(Math.abs(dz), 70 * dt);
  }

  _turn(dt) {
    const C = CONFIG.HORSE_BOSS;
    if (this.t * 1000 < C.turnMs) return;
    this.facing = this.turnTo || this.facing;
    this.turnTo = null;
    const next = this.afterTurn || 'idle';
    this.afterTurn = null;
    this._to(next);
  }

  /* Closing in ON A KICK. Distinct from _approach, which closes on nothing:
     this one has somewhere to be and throws a kick when it arrives. */
  _trot(dt, player) {
    const C = CONFIG.HORSE_BOSS;
    const side = this._sideOf(player);
    if (this._face(side, 'trot')) return;
    this._step(dt, player, side, C.trotSpeed);

    const gap = Math.abs(player.x - this.x);
    if (gap <= C.kickRange) {
      /* CLOSE IN MEANS THE KICK, AND THE KICK LANDS BEHIND HIM -- so he turns
         AWAY from the player to throw it, and the turn has to know that is what
         it is for. See _face(). */
      if (this._face(side === 'right' ? 'left' : 'right', 'kick')) return;
      this._to('kick');
      return;
    }
    /* ⚠️ NO CHARGE BRANCH HERE, AND NEVER AGAIN. The trot used to be allowed to
       switch to a charge if it happened to still be far enough out after a
       timer -- and trotting is precisely what closes that distance, so the
       condition almost never held. `_decide()` owns the choice now, taken
       before any walking happens. Do not put it back.

       What is left is a fuse: a player who keeps running can otherwise be
       chased around forever without him committing to anything. */
    if (this.t * 1000 >= C.approachMaxMs) {
      this.intent = null;
      this._to('idle');
      this.t = C.idleMs / 1000;      // re-decide immediately rather than resting
    }
  }

  /* Stood still, facing you. The only warning the charge gives. */
  _tell(dt, player) {
    const C = CONFIG.HORSE_BOSS;
    if (this._face(this._sideOf(player), 'tell')) return;
    if (this.t * 1000 < C.chargeTellMs) return;
    this.chargeZ = player.z;          // committed HERE, so stepping out works
    this._swing({
      startupMs: 0, activeMs: C.chargeMaxMs + 500, recoverMs: 0,
      damage: C.chargeDamage, reachX: C.chargeReachX, reachZ: C.chargeReachZ,
      knockback: C.chargeKnockback, lift: 0, knockdown: !!C.chargeKnockdown,
      pose: 'finisher',
    });
    this._to('charge');
  }

  /**
   * The charge. He crosses the room and does not brake.
   *
   * THE LANE IS FIXED WHEN HE COMMITS, not steered during the run. A charge
   * that tracked the player would be unavoidable, and the whole move is a
   * question the player answers by stepping out of the way — which only works
   * if the answer stays correct once given.
   */
  _charge(dt, bounds) {
    const C = CONFIG.HORSE_BOSS;
    const dir = this.facing === 'right' ? 1 : -1;
    this.x += dir * C.chargeSpeed * dt;
    // Slides into the lane he committed to, rather than snapping.
    if (this.chargeZ != null) {
      const dz = this.chargeZ - this.z;
      if (Math.abs(dz) > 2) this.z += Math.sign(dz) * Math.min(Math.abs(dz), 260 * dt);
    }
    const { lo, hi } = this._limits(bounds);
    const past = dir > 0 ? this.x >= hi : this.x <= lo;
    if (past || this.t * 1000 >= C.chargeMaxMs) {
      this.x = Math.max(lo, Math.min(hi, this.x));
      this.atk = null;
      this.chargeZ = null;
      this.sinceCharge = 0;        // starts the cooldown; see _decide()
      this.intent = null;          // spent; _idle rolls the next one
      this.passes++;
      this._to('idle');
    }
  }

  /* Armed on entry and held until the attack's own clock has run all three
     phases out. The two-step (`kickArmed`) is what distinguishes "the kick has
     not started yet" from "the kick is over" -- both of which are `atk == null`,
     and conflating them either fires nothing or fires forever. */
  _kick(dt) {
    const C = CONFIG.HORSE_BOSS;
    if (!this.kickArmed) {
      this._swing({
        startupMs: C.kickTellMs, activeMs: C.kickActiveMs,
        recoverMs: C.kickRecoverMs, damage: C.kickDamage,
        reachX: C.kickReachX, reachZ: C.kickReachZ,
        knockback: C.kickKnockback, lift: 0, knockdown: !!C.kickKnockdown,
        pose: 'straight',
      }, true);
      this.kickArmed = true;
      return;
    }
    if (!this.atk) {
      this.kickArmed = false;
      this.intent = null;          // spent; _idle rolls the next one
      this._to('idle');
    }
  }

  _die(dt) {
    // Nothing to drive: the blasts and the fade are read off `t` by draw().
  }

  /**
   * Roll the explosions, ONCE, on the frame he dies.
   *
   * ⚠️ ROLLED HERE AND STORED, NOT IN draw(). A scatter re-rolled every frame
   * is not an explosion, it is static -- the same lesson hit-fx.js records for
   * the impact bursts, where the random pick is frozen on the event. Everything
   * random about this death happens in this function and nowhere else.
   *
   * THE TIMES ARE SHUFFLED AGAINST THE POSITIONS on purpose. Laid out along his
   * body and then fired in that order, the blasts sweep from nose to tail like
   * something being unzipped; dealt out at random they read as him coming apart
   * from the inside, which is what was asked for.
   */
  _armBooms() {
    this.blasts = [];
    const B = (CONFIG.HORSE_BOSS.DEATH_BOOM) || {};
    if (!B.on) return;
    const n = Math.max(1, B.count || 7);
    const h = CONFIG.HORSE_BOSS.sizePx;

    // The order the blasts go off in: 0..n-1, shuffled.
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    const jit = B.sizeJitter || 0;
    for (let i = 0; i < n; i++) {
      /* Spread ALONG him first and jittered second, so seven blasts cover the
         whole animal instead of clustering wherever the rolls happened to fall
         -- a horse is longer than he is tall and the middle of him is not where
         this reads. */
      const spanX = (n === 1) ? 0 : ((i + 0.5) / n * 2 - 1);
      this.blasts.push({
        ox: (spanX * (B.spreadXRel || 0.55) + (Math.random() - 0.5) * 0.16) * h,
        // Up from his feet: never at ground level, never over his head.
        oy: -(0.18 + Math.random() * (B.spreadYRel || 0.75)) * h,
        at: (B.startMs || 0) + order[i] * (B.everyMs || 180),
        size: (B.sizePx || 210) * (1 + (Math.random() * 2 - 1) * jit),
      });
    }
  }

  /* Waits for the WHOLE death, not for `dead`. The level advances on this, and
     advancing on `dead` is what once left a corpse hanging in mid-air through
     an outro -- see the bug family in STATE.md. */
  finished() {
    return this.dead && this.t >= (CONFIG.HORSE_BOSS.dieMs || 1700) / 1000;
  }

  // --- Drawing --------------------------------------------------------------

  /**
   * Which row, and which frame of it.
   *
   * Returns { anim, step, noFlip }. `noFlip` is the turn's, and it is the whole
   * reason this returns a flag at all — see the header.
   */
  _frame(sheets) {
    const C = CONFIG.HORSE_BOSS;
    /* ⚠️ WRAPPED HERE, BECAUSE `sheets.rect()` CLAMPS. It takes the frame index
       as `min(step, len-1)`, which is right for a one-shot pose and wrong for a
       gait: a free-running millisecond counter would ride up to the last
       drawing of the walk and stay there, and a horse frozen mid-stride while
       sliding along the belt looks like a physics bug rather than an animation
       one. Every looping row therefore takes its length from the pack and wraps
       against it. */
    const ms = (t, anim) => {
      const n = Math.max(1, sheets.poseLength('horse', anim));
      return Math.floor(this.animT * 1000 / t) % n;
    };

    if (this.phase === 'turn') {
      /* SEVEN FRAMES OF ROTATION, PLAYED IN THE DIRECTION HE IS TURNING. The
         row runs left-profile (0) to right-profile (6), so turning right plays
         it forward and turning left plays it backwards. Drawn with the mirror
         OFF, because the row already contains both sides. */
      const p = Math.max(0, Math.min(1, this.t * 1000 / C.turnMs));
      const fwd = this.turnTo === 'right';
      const i = Math.min(6, Math.floor(p * 7));
      return { anim: 'turn', step: fwd ? i : 6 - i, noFlip: true };
    }
    if (this.phase === 'charge') return { anim: 'runAttack', step: ms(C.runMs, 'runAttack') };
    /* THE KICK DOES NOT LOOP -- it is one throw. Driven off the attack's own
       clock so the drawing and the window that can actually hit cannot drift
       apart, which is the rule every attack pose in this game follows. */
    if (this.phase === 'kick') {
      const n = Math.max(1, sheets.poseLength('horse', 'kick'));
      const a = this.atk;
      const total = a ? a.startupMs + a.activeMs + a.recoverMs : 1;
      const p = a ? Math.min(1, (a.t || 0) / total) : 1;
      return { anim: 'kick', step: Math.min(n - 1, Math.floor(p * n)) };
    }
    if (this.phase === 'trot' || this.phase === 'approach') {
      return { anim: 'trot', step: ms(C.trotAnimMs, 'trot') };
    }
    if (this.phase === 'enter')  return { anim: 'walk', step: ms(C.walkAnimMs, 'walk') };
    if (this.phase === 'tell') {
      // Stood in the run row's first frame: coiled, and going nowhere yet.
      return { anim: 'runAttack', step: 0 };
    }
    /* IDLE HAS NO ROW. He stands in whichever profile of the turn row matches
       the way he is facing -- frame 0 or frame 6 -- rather than in a walk frame
       with a leg in the air. Mirror off for the same reason as the turn. */
    return { anim: 'turn', step: this.facing === 'right' ? 6 : 0, noFlip: true };
  }

  draw(ctx, sheets, camX) {
    const C = CONFIG.HORSE_BOSS;
    const f = this._frame(sheets);
    const gx = this.groundX(camX);
    const gy = this.groundY();

    let alpha = 1;
    /* The blink. Same treatment the Mosca gets, and for the same reason: with
       no hurt drawing, the only way to say "that landed" is to interrupt the
       picture. The impact burst does the rest. */
    if (this.hurtT > 0) {
      const period = (CONFIG.hurtBlinkMs || 60) / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.4 : 1;
    }
    const boom = (C.DEATH_BOOM && C.DEATH_BOOM.on) ? C.DEATH_BOOM : null;
    if (this.dead) {
      /* HE GOES FASTER THAN THE BLASTS DO. Fading him across the whole of
         `dieMs` left a horse still faintly visible under explosions that were
         supposed to have destroyed him; `fadeMs` takes him out early and the
         rest of the string reads as the wreckage still going up. Without the
         booms it is the old full-length fade. */
      const ms = boom ? (boom.fadeMs || 620) : (C.dieMs || 1700);
      alpha *= Math.max(0, 1 - this.t / (ms / 1000));
    }

    /* HE USED TO TIP OVER, because there is no death row -- rotated about his
       own ground point, which is what made it read as falling rather than as
       sliding sideways.

       ⚠️ NOT WHILE HE IS EXPLODING. A body toppling THROUGH a string of blasts
       reads as two deaths playing at once: the eye follows the rotation and
       stops reading the explosions as the thing that killed him. He now stands
       where he is and goes up. The tip is still here and still correct -- turn
       `DEATH_BOOM.on` off and it comes back. */
    const rot = (this.dead && !boom)
      ? Math.min(1, this.t / ((C.dieMs || 1700) / 1000) * 1.6) * (C.dieTipRad || 1.15)
        * (this.facing === 'right' ? 1 : -1)
      : 0;

    /* `noFlip` draws the frame in the art's own orientation. Passing the pack's
       native side as the facing is how you say "do not mirror this" without
       sheets.js needing to know what a turn row is. */
    const facing = f.noFlip ? 'right' : this.facing;
    sheets.draw(ctx, 'horse', facing, f.anim, f.step, gx, gy, {
      alpha, rotate: rot, flash: this.flash,
    });

    // OVER him, always -- an explosion behind the thing exploding is a sunrise.
    if (boom) this._drawBooms(ctx, sheets, gx, gy);
  }

  /**
   * The death explosions.
   *
   * ⚠️ THE SHEET COMES THROUGH `sheets.assets` RATHER THAN THROUGH A SECOND
   * ARGUMENT. `draw(ctx, sheets, camX)` is the interface every drawable in this
   * game answers to, and widening it for one boss's death would have meant
   * touching the shell, the Mosca and the crowd for something none of them
   * needs. Sheets owns an Assets; this borrows it. If a second effect ever
   * wants raw art, THAT is the moment to give the interface an assets slot
   * rather than to borrow twice.
   *
   * NOTHING IS TICKED HERE. Each blast knows when it starts, and `this.t` says
   * what time it is -- so the whole string is a pure function of the death
   * clock, which is the same arrangement the game over panel uses and it means
   * there is no second thing to keep in step.
   */
  _drawBooms(ctx, sheets, gx, gy) {
    if (!this.blasts || !this.blasts.length) return;
    const img = sheets.assets && sheets.assets.getDrawable('boom');
    const rects = CONFIG.BOOM_RECTS || [];
    if (!img || !rects.length) return;               // no art: no explosion, no crash
    const ms = CONFIG.boomMs || 71;
    const t = this.t * 1000;

    /* Measured off the WIDEST frame, not the first. With the full 12-frame set
       the first frame is the smallest one -- the blast growing -- so anchoring
       the scale on it would make every explosion enormous. */
    let peak = 1;
    for (const r of rects) if (r[2] > peak) peak = r[2];

    ctx.save();
    for (const b of this.blasts) {
      const local = t - b.at;
      if (local < 0) continue;
      const i = Math.floor(local / ms);
      if (i >= rects.length) continue;               // this one has finished
      const r = rects[i];
      const s = b.size / peak;
      const w = r[2] * s, h = r[3] * s;
      /* Centred on its own point, so the frames grow and shrink about it. Every
         frame shares one scale, which is what keeps their RELATIVE sizes -- the
         animation is the sheet's, not something re-timed here. */
      ctx.drawImage(img, r[0], r[1], r[2], r[3],
                    gx + b.ox - w / 2, gy + b.oy - h / 2, w, h);
    }
    ctx.restore();
  }
}
