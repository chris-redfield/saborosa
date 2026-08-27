/**
 * FlyBoss — the Mosca Boss, brought over from STILL LIFE and re-taught to fight
 * on a belt.
 *
 * The art is that game's exactly: `enemy-sheets/saborosa-boss-mosca-0N.png`,
 * read IN PLACE out of the flying dungeon's asset folder rather than copied.
 *
 * THE SHEET IS A TURN, NOT A WALK CYCLE — 7 poses sweeping profile-left (0)
 * through head-on (3) to profile-right (6). The widths give it away: 253px in
 * profile down to 176px face-on, symmetric about the middle. So `facing` is a
 * continuous 0..1 and the pose is just that value quantised. Every pose shares
 * the y band 38..302, which is why they can be drawn from a common anchor with
 * no per-pose offset.
 *
 * THE FLAP IS ACROSS FILES, NOT ACROSS THE SHEET: a pose holds its column
 * while the sheet underneath it cycles. Three were delivered but 01 and 03 are
 * byte-identical, so only two are loaded and `MOSCA_CYCLE` ([0,1,0]) reproduces
 * the delivered A-B-A exactly — including the double-length A at the loop seam.
 * That is the flying dungeon's finding, inherited whole.
 *
 * WHAT IS NEW HERE IS THE FIGHT. In Still Life it stalks a plane across an open
 * sky; on a belt it has to threaten a lane instead, so it runs a two-attack
 * rotation and the belt's DEPTH is the thing being attacked:
 *
 *   AMBUSH  THE ENTRANCE, and it is Still Life's: in from off the right at the
 *           player's OWN LANE, flat out, straight through where they are
 *           standing and out the far side. See _ambush() — it is the whole
 *           reason the entrance is worth having.
 *   DESCEND beat two, also Still Life's: it reappears above the arena and comes
 *           down the middle, turning to face the camera as it falls, so it is
 *           already looking at the player by the time it stops.
 *   HOVER   bobbing above the belt, drifting after the player, out of reach of
 *           a standing punch. This is the rest beat.
 *   SWOOP   a dive at where the player IS. Comes down to near ground level,
 *           which is also the moment it becomes easy to punch. Aimed once, on
 *           the tell, and never corrected — so it is dodged by moving.
 *   SWEEP   THE GROUND PASS. It drops to the floor at one end of the arena and
 *           charges the ENTIRE width at ground level. See _sweep() for why this
 *           is the attack the belt exists for.
 *
 * THE ROTATION IS DETERMINISTIC — swoop, sweep, swoop, sweep. A boss whose
 * next move is a coin flip cannot be learned, and learning the pattern IS the
 * fight in this genre. Only the timing inside each beat varies.
 *
 * AND IT CAN BREAK OFF AND LEAVE. `fleeAt` — a fraction of its health, passed
 * in by the SEGMENT and not by this file — is the point at which it stops
 * fighting, climbs out of reach and flies off the side. It does not die, the
 * segment ends anyway, and the level carries on with the thing that beat it
 * still alive somewhere ahead. See _beginFlee().
 *
 * ⚠️ FLEEING IS NOT A KIND OF DYING, and every place that asks "is this fight
 * still on" has to be told so separately: `vulnerable()` (nobody may finish it
 * off on the way out), the health bar in game.js (a bar over something that
 * cannot be hit is a lie), its theme (the fight is over the moment it
 * disengages) and `finished()` (which now has two ways to be true).
 *
 * ⚠️ WHETHER IT FLEES IS THE ENCOUNTER'S BUSINESS, NOT THE BOSS'S. Without
 * `fleeAt` this is exactly the boss it was: it fights until it is dead. That is
 * what makes the same class serve both halves of the street — the sub-boss
 * declares a threshold, the rematch declares nothing — with no memory carried
 * between them and no "is this the second time" flag anywhere.
 */
class FlyBoss {
  /* `opts.fleeAt` is a fraction of full health, 0..1, and it is the whole of
     what one encounter can say about itself. Omitted (or 0) it fights to the
     death, which is what every boss segment written before the rematch meant
     and what the last one still means. */
  constructor(x, z, camX, opts) {
    this.kind = 'mosca';
    this.x = x;
    this.z = z;
    this.jumpY = CONFIG.flyBossHoverY;

    this.maxHp = CONFIG.flyBossHealth;
    this.hp = this.maxHp;
    this.dead = false;
    /* The health it breaks off at, in HP rather than as a fraction, so the
       comparison in hurt() is one number against another. Zero means never. */
    this.fleeHp = (opts && opts.fleeAt > 0) ? this.maxHp * opts.fleeAt : 0;
    this.fleeing = false;
    this.fleeDir = 1;           // always RIGHT -- see _beginFlee()
    /* THE MUSIC SHE BRINGS WITH HER, by asset key. Declared as a PROPERTY OF
       THE BOSS rather than tested for in game.js, because that is the bargain
       every other thing about a boss makes here: `combat.js` and the overlay
       talk to an interface and never ask which boss this is. The horse simply
       does not declare one, which is exactly what "his theme belongs to the
       ROOM" should look like from the outside.

       ⚠️ NULL WITHOUT THE CONFIG ENTRY, or game.js would ask Sound for a key
       the manifest never loaded -- `manifest.js` gates on the same field. */
    this.musicKey = CONFIG.MOSCA_TRACK ? 'musicMosca' : null;
    /* ⚠️ NO VOICE. The crowd's grunt and death cry are for MOOKS: a boss taking
       a hit is announced by its own art, its own health bar and, here, by an
       explosion when it goes. Asked for 2026-08-24 -- "I want just the punch
       hit noise, not the cry".

       A PROPERTY RATHER THAN A `kind` TEST IN combat.js, which is the bargain
       every other thing about a boss makes: the resolver talks to an interface
       and never asks which one this is. A third boss is silent by declaring it. */
    this.voiced = false;
    /* The death explosions. Shared with the horse -- see boom.js. Empty until
       it dies, and it never fills if `flyBossDeathBoom.on` is false, in which
       case the old tumble out of the sky plays instead. */
    this.booms = new Booms();
    this.downPhase = '';        // drawShadow reads it; a fly never lies down

    this.facing = 0.5;          // 0 profile-left · 0.5 head-on · 1 profile-right
    this.faceTarget = 0.5;

    this.phase = 'ambush';
    this.t = 0;
    this.attackIndex = 0;       // walks ATTACKS, deterministically
    this.laneSet = false;       // the ambush lane is chosen on the first frame,
                                // which is the first time the player is in hand
    this.hasHit = false;        // one hit per pass; re-armed by _to()
    this.vxSign = -1;           // which way a contact blow shoves

    this.hurtT = 0;
    this.flash = 0;
    this.showBarT = 0;
    this.vx = 0;
    this.bobT = Math.random() * Math.PI * 2;

    // Where the entrance flies from and to.
    this.enterFromX = camX + CONFIG.GAME_W + CONFIG.flyBossEnterMargin;
    this.enterToX = camX + CONFIG.GAME_W * 0.5;
    this.x = this.enterFromX;

    // Set by _armSweep(); the lane the ground pass will scour.
    this.sweepZ = z;
    this.sweepDir = -1;
  }

  // --- The small interface Combat and the renderer need ---------------------

  /** Only a fight once the entrance is over — see the class header. */
  arrived() { return this.phase !== 'ambush' && this.phase !== 'descend'; }

  /* ⚠️ AND NOT WHILE IT IS LEAVING. `arrived()` is about the ENTRANCE and stays
     that way; the exit is a separate thing to be untouchable during, and it has
     to be, or the escape is only an escape when the player misses. */
  vulnerable() {
    return !this.dead && !this.fleeing && this.arrived() && this.hurtT <= 0;
  }

  halfW() { return CONFIG.flyBossSizePx * CONFIG.flyBossHitWRel / 2; }
  halfZ() { return CONFIG.flyBossHitZ / 2; }
  bodyHeight() { return CONFIG.flyBossSizePx; }

  groundX(camX) { return this.x - camX; }
  groundY() { return CONFIG.beltTopY + this.z - this.jumpY; }
  depthScale() {
    const t = CONFIG.beltDepth ? this.z / CONFIG.beltDepth : 1;
    return CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
  }

  overlaps(box) {
    if (!box) return false;
    const hw = this.halfW(), hz = this.halfZ();
    return box.x1 >= this.x - hw && box.x0 <= this.x + hw
        && box.z1 >= this.z - hz && box.z0 <= this.z + hz;
  }

  hurt(dmg, dir) {
    if (!this.vulnerable()) return false;
    this.hp -= dmg;
    this.flash = 1;
    this.showBarT = CONFIG.enemyBarFadeMs / 1000;
    this.hurtT = CONFIG.flyBossHurtMs / 1000;
    /* Knocked back only a LITTLE, and never out of its attack. This thing
       weighs several fighters; a punch that shoved it across the arena — or
       that cancelled a ground pass already under way — would make the pattern
       something the player could simply switch off, and the pattern is the
       fight. Compare Fighter.hurt(), which does interrupt, because a mook's
       swing is supposed to be beatable. */
    this.vx = dir * CONFIG.flyBossKnockback;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.phase = 'die';
      this.booms.arm(CONFIG.flyBossDeathBoom, CONFIG.flyBossSizePx);
      this.t = 0;
      return true;
    }
    /* IT HAS HAD ENOUGH. Tested here rather than in update() so it breaks off
       on the HIT that took it under, in the same frame the player sees land --
       a boss that carried on to the end of its current attack and then left
       would read as the attack ending, not as the punch driving it away.
       That also means it can leave from the middle of a sweep, which is
       correct: the pass simply stops, and `hitbox()` goes cold with it. */
    if (this.fleeHp && this.hp <= this.fleeHp) this._beginFlee();
    return true;
  }

  /**
   * Its attack: CONTACT, live only while it is actually coming at you. There is
   * no projectile and no swing — a fly's body IS the weapon, which is the same
   * bargain Still Life's version makes.
   *
   * Returns the shape Combat expects from Fighter.hitbox(), so the boss needs no
   * special case in the resolver.
   */
  hitbox() {
    if (this.dead) return null;
    /* THE AMBUSH IS THE ONE THING THAT CAN TOUCH YOU BEFORE arrived().
       Still Life's rule is that the entrance can neither hurt nor be hurt, and
       the second half of that still holds here — it cannot be punched until it
       has taken position, so nobody gets a free bar off a cutscene. But being
       run down by the ambush has to LAND, or the entrance is a screensaver.

       It is safe because of what the blow is: `flyBossAmbushDamage` is 0, so it
       knocks the player off their feet and costs them nothing but the beat it
       takes to get up. That is an ambush the player feels without being chipped
       for something they were given no warning about — which in this genre is
       the cardinal sin. Set the knob above 0 to make it bite. */
    const live = this.phase === 'swoop' || this.phase === 'sweepRun'
              || this.phase === 'ambush';
    // `hasHit` limits it to ONE hit per pass — see the note in _sweep().
    if (!live || this.hasHit) return null;
    const hw = this.halfW(), hz = this.halfZ();
    const ambush = this.phase === 'ambush';
    return {
      x0: this.x - hw, x1: this.x + hw,
      z0: this.z - hz, z1: this.z + hz,
      def: {
        damage: ambush ? CONFIG.flyBossAmbushDamage
          : this.phase === 'sweepRun'
            ? CONFIG.flyBossSweepDamage : CONFIG.flyBossSwoopDamage,
        knockback: CONFIG.flyBossTouchKnockback,
        lift: ambush ? CONFIG.flyBossAmbushLift : 0,
        knockdown: ambush,
        pose: 'straight',
      },
      dir: this.vxSign || (this.sweepDir >= 0 ? 1 : -1),
    };
  }

  /** The contact box for the debug view, live or not, annotated with why. */
  debugHitbox() {
    if (this.dead) return null;
    const live = this.phase === 'swoop' || this.phase === 'sweepRun'
              || this.phase === 'ambush';
    if (!live) return null;
    const hw = this.halfW(), hz = this.halfZ();
    return {
      x0: this.x - hw, x1: this.x + hw,
      z0: this.z - hz, z1: this.z + hz,
      phase: this.phase,
      spent: !!this.hasHit,
      live: !this.hasHit,
    };
  }

  // --- Per-frame -----------------------------------------------------------

  update(dt, player, bounds) {
    // Stashed because the phase handlers are called without arguments and two
    // of them (the sweep's arming and its run) need the arena's edges.
    this._bounds = bounds;
    this.t += dt;
    this.bobT += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.showBarT > 0) this.showBarT -= dt;

    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.exp(-CONFIG.knockbackDecay * dt);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    switch (this.phase) {
      case 'ambush':   this._ambush(dt, player); break;
      case 'descend':  this._descend(dt); break;
      case 'hover':    this._hover(dt, player); break;
      case 'tell':     this._tell(dt, player); break;
      case 'swoop':    this._swoop(dt); break;
      case 'recover':  this._recover(dt); break;
      case 'sweepSet': this._sweepSet(dt, bounds); break;
      case 'sweepRun': this._sweep(dt, bounds); break;
      case 'flee':     this._flee(dt); break;
      case 'die':      this._die(dt); break;
    }

    // Turn toward whatever the phase asked to look at.
    const rate = dt / (CONFIG.flyBossTurnMs / 1000);
    this.facing += Math.max(-rate, Math.min(rate, this.faceTarget - this.facing));
    this.facing = Math.max(0, Math.min(1, this.facing));

    this.z = Math.max(0, Math.min(CONFIG.beltDepth, this.z));
  }

  _to(phase) { this.phase = phase; this.t = 0; this.hasHit = false; }

  /**
   * THE AMBUSH — beat one, and Still Life's entrance translated to a belt.
   *
   * Over there it comes in from off the right AT THE PLAYER'S OWN HEIGHT and
   * screams straight across the screen. The whole effect is that it is not
   * crossing at some arbitrary altitude — it is coming for YOU, specifically,
   * and you did not see it coming.
   *
   * On a belt, "the player's own height" is THEIR OWN LANE. Which means the
   * ambush is, geometrically, the ground pass — and that turns out to be the
   * best thing about it:
   *
   * THE ENTRANCE IS A FREE DEMONSTRATION OF THE BOSS'S SIGNATURE ATTACK.
   * It performs the ground sweep once, at full speed, down the player's lane,
   * before the fight has started and before it can be hurt. So by the time the
   * boss does it for real the player has already been shown exactly what it
   * looks like, exactly what it threatens, and — if they were standing in it —
   * exactly what it costs. A boss that teaches its own hardest move during its
   * entrance is being harder to beat and fairer at the same time.
   *
   * AIMED ONCE AND NEVER CORRECTED, like Still Life's. The lane is the
   * player's z on the frame it appears, and it holds that line whatever they do
   * afterwards. It is a fly-past, not a homing missile: stepping out of the
   * lane beats it, which is the same answer the real sweep has. Teaching the
   * dodge is the entire point.
   */
  _ambush(dt, player) {
    if (!this.laneSet) {
      // First frame with the player in hand: take their lane and commit to it.
      this.laneSet = true;
      this.z = player.z;
      this.sweepZ = player.z;
    }
    this.x -= CONFIG.flyBossSweepSpeed * dt;
    this.faceTarget = 0;                       // profile-left: already flying left
    this.vxSign = -1;
    // Down to the floor as it comes in, so it arrives scraping the ground —
    // this is a ground pass, and it has to read as one.
    this.jumpY = Math.max(0, this.jumpY - CONFIG.flyBossFallSpeed * 2.4 * dt);

    const b = this._bounds;
    const out = b ? b.minX - CONFIG.flyBossSweepOverrun
                  : this.enterToX - CONFIG.GAME_W;
    if (this.x <= out) {
      /* Beat two. It is off-screen either way, so lifting it above the arena is
         a CUT, not a teleport the player can watch happen — the same trick
         Still Life uses to get it from the far edge back to the top of the map. */
      this.x = (b ? (b.minX + b.maxX) / 2 : this.enterToX);
      this.z = CONFIG.beltDepth * 0.5;
      this.jumpY = CONFIG.flyBossDescendFromY;
      this._to('descend');
    }
  }

  /** Beat two: down the middle, turning to face the camera as it falls, so it
      is already looking at the player by the time it stops. */
  _descend(dt) {
    this.jumpY = Math.max(CONFIG.flyBossHoverY,
                          this.jumpY - CONFIG.flyBossDescendSpeed * dt);
    this.faceTarget = 0.5;                     // head-on
    if (this.jumpY <= CONFIG.flyBossHoverY + 1) this._to('hover');
  }

  _bob() {
    return Math.sin(this.bobT * CONFIG.flyBossBobFreq) * CONFIG.flyBossBobAmp;
  }

  _hover(dt, player) {
    /* Drifts after the player but stays HIGH — out of reach of a standing
       punch, so the player cannot simply stand under it and mash. It is
       reachable at the apex of a jump, which is the skill window, and it comes
       down of its own accord to attack, which is the patient one. */
    const want = CONFIG.flyBossHoverY + this._bob();
    this.jumpY += (want - this.jumpY) * Math.min(1, 4 * dt);

    const dx = player.x - this.x;
    if (Math.abs(dx) > 40) this.x += Math.sign(dx) * CONFIG.flyBossHoverSpeed * dt;
    const dz = player.z - this.z;
    if (Math.abs(dz) > 20) this.z += Math.sign(dz) * CONFIG.flyBossHoverSpeed * 0.5 * dt;

    this._look(player);
    if (this.t >= CONFIG.flyBossHoverMs / 1000) this._to('tell');
  }

  /** The wind-up shared by both attacks — and the only warning the player gets. */
  _tell(dt, player) {
    // Rises and squares up. A visible pause before something dangerous is what
    // separates a boss from an accident.
    this.jumpY += (CONFIG.flyBossTellY - this.jumpY) * Math.min(1, 5 * dt);
    this._look(player);
    if (this.t < CONFIG.flyBossTellMs / 1000) return;

    const next = CONFIG.flyBossAttacks[this.attackIndex % CONFIG.flyBossAttacks.length];
    this.attackIndex++;
    if (next === 'sweep') {
      this._armSweep(player);
      this._to('sweepSet');
    } else {
      // Aimed ONCE, here, and never corrected. No homing: it is dodged by
      // moving, which is the whole point of having a dive at all.
      this.aimX = player.x;
      this.aimZ = player.z;
      this._to('swoop');
    }
  }

  _swoop(dt) {
    const tx = this.aimX, tz = this.aimZ;
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const step = CONFIG.flyBossSwoopSpeed * dt;
    if (d > 1) {
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
    }
    this.faceTarget = dx >= 0 ? 1 : 0;
    this.vxSign = dx >= 0 ? 1 : -1;    // which way a contact hit shoves
    // Down to just off the floor — which is exactly when it can be punched.
    this.jumpY += (CONFIG.flyBossSwoopY - this.jumpY) * Math.min(1, 6 * dt);

    if (d <= 12 || this.t > CONFIG.flyBossSwoopMaxMs / 1000) this._to('recover');
  }

  _recover(dt) {
    this.jumpY += (CONFIG.flyBossHoverY - this.jumpY) * Math.min(1, 3 * dt);
    this.faceTarget = 0.5;
    if (this.t >= CONFIG.flyBossRecoverMs / 1000) this._to('hover');
  }

  /**
   * Arm the ground pass: pick the end to run from and the LANE to scour.
   *
   * The lane is the player's depth AT THE MOMENT OF THE TELL, not at the moment
   * of the charge. That one choice is what makes this a dodge rather than a
   * tax: the player is shown, during the wind-up, exactly which line is about to
   * become lethal, and has the length of the wind-up to leave it.
   */
  _armSweep(player) {
    this.sweepZ = player.z;
    // Start from whichever end is FURTHER from the player, so the pass always
    // has room to build up and always arrives from a readable distance rather
    // than materialising on top of them.
    const b = this._bounds;
    const mid = b ? (b.minX + b.maxX) / 2 : this.x;
    this.sweepDir = player.x < mid ? -1 : 1;   // -1 = run leftward, so start right
  }

  _sweepSet(dt, bounds) {
    /* Move to the starting corner, drop to the floor, and hold. Two things are
       being said at once here and both matter: the ALTITUDE says what is coming
       (it is on the ground, so the ground is what it will hit) and the LANE says
       where. */
    const startX = this.sweepDir < 0
      ? bounds.maxX + CONFIG.flyBossSweepOverrun
      : bounds.minX - CONFIG.flyBossSweepOverrun;
    const dx = startX - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), CONFIG.flyBossSweepSetSpeed * dt);
    this.z += (this.sweepZ - this.z) * Math.min(1, 5 * dt);
    this.jumpY += (0 - this.jumpY) * Math.min(1, 5 * dt);
    this.faceTarget = this.sweepDir < 0 ? 0 : 1;

    const inPlace = Math.abs(dx) < 8 && this.jumpY < 6;
    if (inPlace && this.t > CONFIG.flyBossSweepHoldMs / 1000) this._to('sweepRun');
  }

  /**
   * THE GROUND PASS — the attack the belt exists for.
   *
   * It charges the ENTIRE width of the arena at floor level, in one lane. There
   * is nowhere along x to stand and nothing to outrun: the only answer is to
   * step OUT OF THE LANE, in z. Every other threat in this game can be handled
   * by backing off along the belt, so this is the one move that makes depth —
   * the axis the whole genre is built on — the thing being tested.
   *
   * It runs to the far edge and does NOT stop at the player. A pass that
   * ended on contact would reward standing in it (one hit and the attack is
   * over) rather than leaving it. `hasHit` still limits it to one hit per pass,
   * so being clipped costs a hit and not a whole health bar.
   */
  _sweep(dt, bounds) {
    this.x += this.sweepDir * CONFIG.flyBossSweepSpeed * dt;
    this.z += (this.sweepZ - this.z) * Math.min(1, 8 * dt);
    this.jumpY = Math.max(0, this.jumpY - dt * 200);
    this.faceTarget = this.sweepDir < 0 ? 0 : 1;
    this.vxSign = this.sweepDir;

    const past = this.sweepDir < 0
      ? this.x < bounds.minX - CONFIG.flyBossSweepOverrun
      : this.x > bounds.maxX + CONFIG.flyBossSweepOverrun;
    if (past) {
      // Climb back into the arena rather than turning on the spot — it has to
      // come back in from the edge it left by.
      this.jumpY = CONFIG.flyBossTellY;
      this._to('recover');
    }
  }

  /**
   * BREAKING OFF — it stops fighting and goes, and the fight is over without
   * anybody winning it.
   *
   * IT ALWAYS LEAVES TO THE RIGHT, which is up the street, the way it came in,
   * and the way it will come back. Asked for 2026-08-27, and it is the better
   * rule: fleeing is the level pointing FORWARD, at the fight still to come,
   * and a boss that escapes back over ground the player has already cleared
   * says the opposite.
   *
   * It was first written to leave the way the punch sent it -- `dir` is already
   * "away from whoever just hit it" -- which never flew out through the player
   * but did send it left half the time, for no reason the player could read.
   *
   * ⚠️ SO IT CAN CROSS THE PLAYER, and that is safe rather than tolerated: it
   * is climbing to `flyBossFleeY`, out of reach, and `hitbox()` has been cold
   * since the frame it broke off (`flee` is not in the live list). It passes
   * over them, not through them.
   *
   * ⚠️ THE KNOCKBACK IS CANCELLED. `hurt()` has just set `vx`, and leaving it
   * would have the exit fighting a shove for its first half second -- most
   * visibly when the blow shoved it left and it is leaving right, which is now
   * every blow landed from the player's right-hand side.
   */
  _beginFlee() {
    this.fleeing = true;
    this.fleeDir = 1;
    this.vx = 0;
    this._to('flee');
  }

  /**
   * The exit: up out of reach first, then away.
   *
   * THE CLIMB LEADS AND THE SPEED RAMPS, so the shape of it is a thing giving
   * up rather than a thing being teleported off screen -- and it stays in the
   * frame long enough to be seen leaving, which is the entire point of a boss
   * that comes back. `flyBossFleeY` is deliberately NOT above the canvas top:
   * it exits by the side, in view.
   */
  _flee(dt) {
    this.jumpY += (CONFIG.flyBossFleeY - this.jumpY) * Math.min(1, 3 * dt);
    const ramp = Math.min(1, this.t / (CONFIG.flyBossFleeAccelMs / 1000));
    this.x += this.fleeDir * CONFIG.flyBossFleeSpeed * ramp * dt;
    this.faceTarget = this.fleeDir < 0 ? 0 : 1;
  }

  _die(dt) {
    /* IT USED TO FALL OUT OF THE SKY, tumbling, and fade where it landed. Since
       2026-08-22 it BLOWS UP WHERE IT IS HIT, on request -- so it neither falls
       nor turns, and the explosions do the work the fall used to.

       ⚠️ THE FALL IS KEPT, NOT DELETED, and it is one flag away: with
       `flyBossDeathBoom.on` false this is exactly the old death again. A boss
       that tumbles out of the sky WHILE exploding reads as two deaths playing
       at once -- the eye follows the fall and stops reading the blasts as the
       thing that killed it, which is the same trap the horse's tip-over set. */
    if (this.booms.armed) return;
    this.jumpY = Math.max(0, this.jumpY - CONFIG.flyBossFallSpeed * dt);
    this.faceTarget = 0.5;
  }

  _look(player) {
    const dx = player.x - this.x;
    // Continuous: a small offset barely turns it, a big one puts it in profile.
    this.faceTarget = 0.5 + Math.max(-0.5, Math.min(0.5, dx / CONFIG.flyBossFaceSpanX * 0.5));
  }

  // --- Draw ----------------------------------------------------------------

  /**
   * Which of the 7 turn poses the current facing quantises to.
   *
   * THE isFinite GUARD IS NOT DEFENSIVE PADDING — it is here because this
   * function has already made the boss invisible once. `facing` is advanced by a
   * rate divided out of CONFIG.flyBossTurnMs; with that knob missing the rate is
   * NaN, facing goes NaN, Math.round(NaN) is NaN, MOSCA_RECTS[NaN] is undefined,
   * and draw() bails before drawing anything — while the shadow, which never
   * reads facing, carries on as though nothing were wrong. An invisible boss
   * with a working shadow is a genuinely confusing thing to debug.
   *
   * Falling back to head-on turns that whole failure into "the boss does not
   * turn", which is visible, obviously wrong, and points straight at the cause.
   */
  poseIndex() {
    const n = CONFIG.MOSCA_RECTS.length;
    const f = isFinite(this.facing) ? this.facing : 0.5;
    return Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))));
  }

  draw(ctx, assets, camX) {
    // The flap: the POSE holds its column while the sheet under it cycles.
    const cyc = CONFIG.MOSCA_CYCLE;
    const k = cyc[Math.floor(this.bobT * 1000 / CONFIG.moscaFlapMs) % cyc.length];
    const img = assets.getDrawable('mosca' + k);
    if (!img) return;

    const rect = CONFIG.MOSCA_RECTS[this.poseIndex()];
    if (!rect) return;
    const s = (CONFIG.flyBossSizePx / CONFIG.MOSCA_REF_H) * this.depthScale();
    const w = rect[2] * s, h = rect[3] * s;
    const gx = this.groundX(camX);
    const gy = this.groundY();

    let alpha = 1;
    if (this.hurtT > 0) {
      const period = CONFIG.hurtBlinkMs / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.4 : 1;
    }
    if (this.dead) {
      /* IT GOES FASTER THAN THE BLASTS DO. The old fade started at 0.9s and ran
         to 2.0; against a string of explosions that left a fly still faintly
         visible under the thing that was supposed to have destroyed it. */
      const B = CONFIG.flyBossDeathBoom;
      alpha *= this.booms.armed
        ? Math.max(0, 1 - this.t / (((B && B.fadeMs) || 620) / 1000))
        : Math.max(0, 1 - Math.max(0, this.t - 0.9) / 1.1);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(gx, gy);
    // The tumble belongs to the fall; see _die().
    if (this.dead && !this.booms.armed) ctx.rotate(Math.min(1, this.t * 1.6) * 0.9);
    ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -w / 2, -h, w, h);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 0.5);
      ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -w / 2, -h, w, h);
    }
    ctx.restore();

    /* OVER it, and OUTSIDE the transform above -- that one is translated to the
       ground point and, on the old death, rotated. Blasts drawn inside it would
       inherit both and swing around with the corpse. */
    this.booms.draw(ctx, assets.getDrawable('boom'), gx, gy, this.t);
  }

  /**
   * True once the death has played out and it can be cleared away.
   *
   * ⚠️ IT WAITS FOR THE BLASTS, NOT FOR THE FADE. The level advances on this,
   * and advancing while a blast is still on screen cuts it off mid-frame -- the
   * same bug shape that once hung a corpse in mid-air through an outro. The
   * span is derived from the boom config rather than written as a second
   * constant, so retiming the string moves this with it.
   */
  finished() {
    /* GONE COUNTS AS FINISHED. The segment advances on this and does not ask
       why, which is what lets a boss that flew away and a boss that blew up end
       the same segment without stage.js learning the difference.

       ⚠️ THE FUSE IS NOT PADDING. This is the only thing that ends the segment,
       so an exit that never clears the edge -- no bounds, a speed knob at zero,
       an arena wider than the ramp can cross -- would hang the level on a boss
       nobody can hit, with nothing visibly wrong. */
    if (this.fleeing) {
      /* Both edges, though `_beginFlee` only ever sets +1 today: the exit
         direction is a named thing rather than a sign written into three
         places, so turning it around again is one assignment and not a hunt. */
      const b = this._bounds;
      const gone = b && (this.fleeDir < 0
        ? this.x < b.minX - CONFIG.flyBossEnterMargin
        : this.x > b.maxX + CONFIG.flyBossEnterMargin);
      return !!gone || this.t > CONFIG.flyBossFleeMaxMs / 1000;
    }
    if (!this.dead) return false;
    const span = this.booms.armed ? Booms.spanMs(CONFIG.flyBossDeathBoom) / 1000 : 0;
    return this.t > Math.max(2.0, span);
  }
}
