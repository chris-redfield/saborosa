/**
 * Enemy — CIGARRO, the stub and ERKPA, doing the villain's job.
 *
 * READ THE ATTACK TOKEN NOTE BEFORE CHANGING ANY OF THIS. It is in
 * `Crowd.update()` below and it is the single most important rule in the file:
 * however many enemies are on screen, only `CONFIG.maxAttackers` of them may be
 * committing to an attack at any moment. The rest close in, hover at a
 * stand-off distance, and circle. Without it, six enemies that each attack when
 * in range all attack on the same frame, the player is hit from three sides at
 * once, and the game is not difficult — it is arbitrary. Every beat 'em up
 * worth the name does this and almost none of them mention it.
 *
 * An enemy's own states are a thin layer over Fighter's:
 *
 *     enter      walking in from off-screen at spawn
 *     approach   closing on the player's stand-off spot
 *     circle     in range but WITHOUT the token: orbiting, waiting a turn
 *     wind       has the token, hesitating before the swing (the tell)
 *     combo      throwing a string; Fighter drives each hit, this counts them
 *     leap       in the air, mid jump-in; the only state that MOVES mid-attack
 *     curl       a barata tucking into a ball -- the tell before a charge
 *     charge     rolling across the screen and off it; also MOVES mid-attack
 *     gone       off-screen after a charge, waiting to walk back in
 *     attack     Fighter's own attack state does the work
 *
 * TWO OF THEM THROW COMBOS NOW. Both cigarettes have three punches drawn for
 * them, so their attack is a STRING rather than a swing — see CONFIG.ENEMY_COMBOS
 * for the rule that keeps that a mook's move and not a boss's, and `_think`'s
 * 'combo' branch for how the hits are counted out. They also JUMP IN: see
 * `takeTurn()` for when that is decided and CONFIG.ENEMY_LEAP for why the
 * punch has to be thrown on the way down.
 *
 * THE BARATAS ARE THE FIRST ENEMIES THAT DO NOT SHARE THE ONE BRAIN. Every
 * fighter before them ran the same loop -- approach, circle, wind, commit --
 * and differed only in numbers. The roach's charge is a shape that loop cannot
 * express, because it ENDS WITH HIM LEAVING THE FIGHT: `curl` -> `charge` ->
 * `gone` -> back to `enter`, which is the spawn walk-in reused. While he is
 * `gone` he is not in the crowd's reckoning at all, and that absence is the
 * move's real cost to him. See CONFIG.BARATA_CHARGE.
 */
class Enemy extends Fighter {
  constructor(kind, x, z, opts) {
    const o = opts || {};
    super(kind, x, z, {
      hp: (CONFIG.enemyHealth && CONFIG.enemyHealth[kind]) || 40,
      // Which way it is drawn on its FIRST frame. The walk-in overwrites this
      // as soon as it moves; it matters only for one that spawns from behind,
      // which would otherwise flash facing away from the player as it appears.
      facing: o.facing || 'left',
    });
    this.ai = 'enter';
    this.aiT = 0;
    this.hasToken = false;
    this.windT = 0;
    this.enterT = (o.delayMs || 0) / 1000;
    // Where the walk-in heads for. Null = fight from where it was placed.
    this.entryX = o.entryX != null ? o.entryX : null;
    this.speedScale = (CONFIG.enemySpeedScale && CONFIG.enemySpeedScale[kind]) || 0.8;
    this.damage = (CONFIG.enemyDamage && CONFIG.enemyDamage[kind]) || 6;
    // Where on the circle this one sits. Seeded from the spawn position rather
    // than randomly so a restarted arena plays the same way — a fight that
    // reshuffles itself on every attempt cannot be learned.
    this.orbit = ((x * 0.017 + z * 0.031) % (Math.PI * 2));
    /* ⚠️ WHICH WAY ROUND IT GOES, DECIDED ONCE AND KEPT -- and this is a BUG
       FIX, not a tidy-up. It used to be recomputed every frame from
       `this.z > player.z`, which is a direction derived from a position the
       orbit itself moves. Crossing the player's depth line flipped the sign,
       which walked the enemy back across the line, which flipped it again: an
       enemy parked at the crossing shivered on the spot for as long as the
       fight lasted. That is the "jiggly at a distance" that was reported.

       ⚠️ THE DEFAULT HERE IS ONLY FOR AN ENEMY WITH NO CROWD. `Crowd.add`
       overwrites it with an ALTERNATING one -- see the note there. Seeding it
       off the spawn position was tried first and clumped: the whole first
       cigarette wave came out the same way round, because the x coefficient
       times the gap between two placements is smaller than one parity step. */
    this.orbitDir = 1;
    /* THE UNDERSTUDY. Set by the Crowd, not by the enemy: whether you are the
       next one in is a fact about the GROUP, exactly like the attack token.
       See Crowd.update(). */
    this.ready = false;
    /* THE WANDER. `strollT` counts down to the next one and then counts the
       current one out; `strollX` is where it is going, fixed when it sets off.
       See the orbit branch in _think and CONFIG.ENEMY_STROLL. */
    /* THE RING HE IS ACTUALLY ON, eased toward the one his role asks for. See
       the orbit branch: a promotion has to look like stepping in. */
    this.ringR = CONFIG.enemyCircleRadius;
    this.strollX = 0;
    this.strolling = false;
    /* ⚠️ SEEDED, NOT ZERO. At 0 the countdown is already expired, so every enemy
       set off the instant it stopped attacking -- the whole back of the crowd
       walking away at once, which is the opposite of the effect. */
    this._rollStroll(CONFIG.ENEMY_STROLL || {});
    this.showBarT = 0;
    /* THE DEATH BLAST HAS GONE OFF. Declared here rather than left to spring
       into existence as `undefined` in _deathBlast(): the window it latches is
       300ms wide, and a corpse that could arm a second one would explode twice
       on its way out. See _deathBlast(). */
    this.blastDone = false;
    /* WHAT THIS ONE THROWS. A kind with punch art of its own gets its STRING
       from CONFIG.ENEMY_COMBOS; everyone else keeps the single swing built
       from the shared knobs. The two are the same shape — a list of attack
       defs — so nothing downstream has to know which it got, and a one-entry
       list is simply a string of length one. */
    this.combo = (CONFIG.ENEMY_COMBOS && CONFIG.ENEMY_COMBOS[kind]) || [{
      pose: 'straight',
      startupMs: CONFIG.enemyStartupMs,
      activeMs: CONFIG.enemyActiveMs,
      recoverMs: CONFIG.enemyRecoverMs,
      cancelMs: 0,
      damage: this.damage,
      reachX: CONFIG.enemyReachX,
      reachZ: CONFIG.enemyReachZ,
      knockback: 150,
      lift: 0,
    }];
    this.chainStep = 0;      // which hit of the string is out
    this.chainLen = 1;       // how many it committed to, rolled at the wind-up
    // The jump-in. `leap` is the attack def; `wantsLeap` is rolled once per
    // turn by takeTurn() and spent by taking off. See _startLeap().
    this.leap = (CONFIG.ENEMY_LEAP && CONFIG.ENEMY_LEAP[kind]) || null;

    /* THE CHARGE. `charge` is the attack def, built once from BARATA_CHARGE
       rather than written per kind, because everything that differs between
       the two roaches is a number in that block. A kind with no `chance` entry
       gets null and can never roll one -- which is how every non-barata is kept
       out of it without a single test for the kind anywhere below. */
    const C = CONFIG.BARATA_CHARGE;
    const cd = C && C.damage && C.damage[kind];
    this.charge = cd == null ? null : {
      pose: 'ball',
      /* THE TELL IS THE ATTACK'S OWN STARTUP, so the curled drawing and the
         harmless window are the same thing by construction and cannot drift
         apart. `activeMs` is a CEILING, not a duration: the roll normally ends
         when he leaves the screen, and this only catches the case where
         something has stopped him crossing it. */
      startupMs: C.curlMs, activeMs: 4000, recoverMs: 0, cancelMs: 0,
      damage: cd, reachX: C.reachX, reachZ: C.reachZ,
      knockback: C.knockback, lift: 0, knockdown: !!C.knockdown,
    };
    this.wantsCharge = false;
    this.chargeIx = 1;
    this.wantsLeap = false;
    this.leapIx = 1;
    this.leapScale = 1;
  }

  /**
   * How long a string this one is about to throw. Rolled ONCE, before the
   * wind-up, and then honoured — see CONFIG.ENEMY_COMBOS for why an enemy must
   * not decide mid-swing whether to keep going.
   */
  _rollChain() {
    const w = (CONFIG.enemyComboWeights && CONFIG.enemyComboWeights[this.kind]);
    if (!w || this.combo.length < 2) return 1;
    const n = Math.min(w.length, this.combo.length);
    let total = 0;
    for (let i = 0; i < n; i++) total += w[i];
    let r = Math.random() * total;
    for (let i = 0; i < n; i++) {
      r -= w[i];
      if (r <= 0) return i + 1;
    }
    return n;
  }

  hurt(dmg, dir, knockback, lift, knockdown) {
    const took = super.hurt(dmg, dir, knockback, lift, knockdown);
    if (took) {
      this.showBarT = CONFIG.enemyBarFadeMs / 1000;
      // Losing the token on being hit is what stops an enemy tanking a combo
      // and swinging anyway — and it hands the turn to somebody else, so a
      // crowd keeps pressing while the player is busy with one of them.
      this.hasToken = false;
      this.ai = 'approach';
      this.aiT = 0;
    }
    return took;
  }

  /**
   * A TURN HAS JUST BEEN HANDED TO THIS ONE. Called by Crowd at the single
   * moment the attack token is granted — see the note there — and the only
   * place a per-turn decision may be made.
   *
   * ⚠️ THIS IS A CALLBACK RATHER THAN AN EDGE WATCHED IN `update()`, AND THAT
   * IS THE FIX TO A REAL BUG. Watching for `hasToken` going false→true means
   * keeping last frame's value, and the token is RELEASED from three places
   * that run at different points of the frame: `_think` (a string or a leap
   * ending), `hurt()` (called by Combat, which runs after the crowd has
   * updated), and Crowd itself. Whichever end of `update()` the snapshot is
   * taken at, one of those three releases lands on the other side of it, the
   * false is never recorded, and the next grant does not look like a new turn.
   * The symptom was exact and misleading: he leapt on the very first turn of
   * the fight and then never again, which reads as a broken random roll.
   *
   * The token being GRANTED is a single event in a single place. Rolling on the
   * event cannot go stale.
   *
   * ROLLED PER TURN, NOT PER FRAME. A 2% chance evaluated every frame is 2%
   * sixty times a second, which is a certainty inside a second — one roll per
   * turn is what "2% of the time he jumps at you" actually means.
   *
   * It is also decided BEFORE he starts closing in, so the approach and the
   * take-off are one continuous movement rather than a walk that suddenly
   * turns into a jump.
   */
  takeTurn() {
    /* ⚠️ A SUMMONS ENDS A WANDER. `_stroll` is never reached while he holds the
       token, so without this he would resume the old walk -- towards a place
       chosen for a fight that has since moved -- the moment his turn ended. */
    this.strolling = false;
    this._rollStroll(CONFIG.ENEMY_STROLL || {});
    const c = (CONFIG.enemyLeapChance && CONFIG.enemyLeapChance[this.kind]) || 0;
    this.wantsLeap = !!this.leap && Math.random() < c;
    /* ROLLED ON THE TURN, exactly like the leap and for the same reason: this
       is the one frame the token changes hands, and a per-frame roll would be
       a certainty within a few frames rather than "sometimes he charges".
       Rolled INDEPENDENTLY of the leap because nothing has both -- a roach has
       no jump-in and a cigarette has no charge -- so they can never contend. */
    const cc = (CONFIG.BARATA_CHARGE && CONFIG.BARATA_CHARGE.chance
                && CONFIG.BARATA_CHARGE.chance[this.kind]) || 0;
    this.wantsCharge = !!this.charge && Math.random() < cc;
  }

  /**
   * Curl up. Everything about the charge is fixed HERE, on the last frame he
   * is still a roach, and nothing is re-read once he is rolling.
   *
   * THE DIRECTION IS LATCHED AND NEVER CORRECTED -- the cigarettes' jump-in
   * rule, and the reason the move is answered by stepping out of the lane
   * rather than by outrunning it. He commits to the line the player was
   * standing on when the tell began.
   */
  _startCharge(dx) {
    this.chargeIx = dx >= 0 ? 1 : -1;
    this.facing = this.chargeIx > 0 ? 'right' : 'left';
    this.wantsCharge = false;
    this.ai = 'charge';
    this.aiT = 0;
    this.attack([this.charge], 0);
  }

  /**
   * Take off. Everything about the leap is fixed HERE, on the last frame he is
   * still on the ground, and nothing is re-read while he is in the air.
   *
   * THE SPEED IS DERIVED, NOT A CONSTANT: the distance he has to cover divided
   * by the time he will be airborne, so he lands beside the player instead of
   * at some fixed hop length that only occasionally reaches. He aims at
   * `enemyLeapLandX` rather than at the player, for the same reason the walk-in
   * stops short — landing on top of somebody is a shoving match, not a punch.
   */
  _startLeap(dx) {
    const air = CONFIG.jumpMs / 1000;
    const travel = Math.max(0, Math.abs(dx) - CONFIG.enemyLeapLandX);
    this.leapIx = dx >= 0 ? 1 : -1;
    this.leapScale = Math.min(CONFIG.enemyLeapMaxSpeed,
                              travel / air / CONFIG.walkSpeedX);
    this.facing = this.leapIx > 0 ? 'right' : 'left';
    this.wantsLeap = false;
    this.ai = 'leap';
    this.aiT = 0;
    this.jump();
    this.attack([this.leap], 0);
  }

  update(dt, player, bounds) {
    if (this.showBarT > 0) this.showBarT -= dt;
    this.aiT += dt;

    if (!this.dead && this.state !== 'hurt' && this.state !== 'down') {
      this._think(dt, player, bounds);
    }
    super.update(dt, bounds);
    // AFTER the body has moved, so the burst goes off where the corpse ended up.
    if (this.dead) this._deathBlast();
  }

  /**
   * THE HIT THAT COMES OUT OF A CORPSE — ESPETO's death burst, and the only
   * attack in the game nobody decides to throw. See CONFIG.DEATH_BLAST.
   *
   * ⚠️ IT DOES NOT GO THROUGH `attack()` AND MUST NOT. That path calls
   * `canAct()` (false for a dead fighter, correctly) and, worse, the attack tick
   * that would drive it ENDS by setting `state = 'idle'` — which would stand the
   * corpse back up mid-explosion. So the window is opened and closed here, off
   * the death clock, and `state` is never touched.
   *
   * The shape of `atk` is the ordinary one because two other things read it and
   * neither should need to know where it came from: `hitbox()` wants
   * `phase === 'active'` and `hasHit`, and `combat.crowdHits` writes `hasHit`
   * back after it lands. `hasHit` is also what makes it hit ONCE — an explosion
   * that re-hit every frame of its 300ms would be an instant kill.
   *
   * ⚠️ TIMED OFF `deathT`, WHICH IS THE SAME CLOCK THE DEATH ROW IS DRAWN FROM
   * (`frameStep`). That is the whole reason it lines up with the picture: the
   * spines fly on frame 6 and the box opens at 6 x `POSE_MS.death`. Time it off
   * `stateT` instead and it drifts the moment the knockdown timings are retuned.
   */
  _deathBlast() {
    const B = (CONFIG.DEATH_BLAST || {})[this.kind];
    if (!B || this.blastDone) return;
    /* ⚠️ `atFrame` ASKS THE ANIMATION; `atMs` TELLS IT. The old hand-computed
       920ms was 6 x POSE_MS.death + 140 -- right at the time, and silently wrong
       the moment anything before frame 7 changed duration. The shudder added on
       2026-08-28 is exactly that: it pushes the explosion 800ms later, and a
       fixed `atMs` would have detonated him while he was still trembling. Prefer
       `atFrame`; `atMs` is kept for anything that really does want a raw time. */
    /* ⚠️ `atBoomPeak` MOVES THE DAMAGE ONTO THE BOOM, and it had to once his own
       explosion frames were switched off (DEATH_BURST.hideBurst): "when the
       explosion reaches you" is still the rule, but the explosion is now the
       BOOM rather than a drawing of his. `deathBoomPeakS` finds the widest frame
       in the sheet, so re-cutting the explosion moves the hit with it. */
    const at = B.atBoomPeak ? this.deathBoomPeakS()
             : (B.atFrame != null) ? this.deathFrameStartS(B.atFrame)
                                   : (B.atMs || 0) / 1000;
    if (this.deathT < at) return;
    if (this.deathT >= at + (B.activeMs || 200) / 1000) {
      // Window closed. Clear it so nothing keeps a spent box around, and latch
      // so a corpse cannot explode twice on its way out.
      this.blastDone = true;
      if (this.atk && this.atk.def === B) this.atk = null;
      return;
    }
    if (!this.atk || this.atk.def !== B) {
      this.atk = { def: B, phase: 'active', t: 0, hasHit: false,
                   last: true, lunge: 0, lungeDir: 1,
                   // Keeps Fighter._updateAttack's hands off it -- see the note
                   // there. Without this the corpse stands back up mid-burst.
                   external: true };
    }
  }

  _think(dt, player, bounds) {
    if (this.ai === 'enter') {
      /* The stagger first: `delayMs` holds this one off the screen entirely
         while the ones before it walk on, so a group arrives as a trickle
         rather than as a wall. Then it walks to its entry mark.

         It walks in with NO bounds passed, deliberately: it starts outside
         the arena walls, and clamping it to them would teleport it to the wall
         on its first frame — which is the materialising-in-front-of-the-player
         problem the walk-in exists to avoid, with an extra step. It becomes
         subject to the walls the moment it starts fighting. */
      this.enterT -= dt;
      if (this.enterT > 0) return;
      const target = this.entryX;
      if (target == null || Math.abs(this.x - target) < 12) {
        this.ai = 'approach';
        this.aiT = 0;
        this._face(player);
        return;
      }
      this.walk(dt, target > this.x ? 1 : -1, 0, null, this.speedScale);
      return;
    }

    /* IN THE AIR. This sits ABOVE the mid-swing return because a leap is the
       one attack that has to keep MOVING while it runs: the punch is thrown at
       the end of an arc that is already in flight, and Fighter drives only the
       height. The direction and the speed were fixed at take-off and are not
       re-read, so he cannot steer toward a player who has stepped aside.

       He is released a frame after landing, once the attack's own recovery has
       run out — that recovery is the price of a leap that missed, and handing
       the token on before it has been paid would hide it. */
    if (this.ai === 'leap') {
      if (this.jumping) {
        this.walk(dt, this.leapIx, 0, bounds, this.leapScale);
        return;
      }
      if (this.atk) return;
      this.ai = 'approach';
      this.aiT = 0;
      this.hasToken = false;
      return;
    }

    /* THE CHARGE, and it sits above the mid-swing return for the leap's
       reason: it is an attack that has to keep MOVING while it runs. Fighter
       drives the tell, the hitbox and the drawing; this drives only where he
       goes.

       THREE BEATS, AND THE ORDER MATTERS. While the attack is in `startup` he
       is curled and STANDING STILL -- that is the tell, and a tell that already
       moves is not one. Once it is `active` he rolls, ignoring `bounds`
       entirely, because the walls are what he is leaving. The moment he is
       clear of them he is `gone`: the attack is dropped, the token handed back,
       and he stops being part of the fight. */
    if (this.ai === 'charge') {
      const C = CONFIG.BARATA_CHARGE;
      const margin = (C && C.exitMarginPx) || 180;
      const out = bounds
        && (this.x < bounds.minX - margin || this.x > bounds.maxX + margin);

      if (out) {
        /* GONE. The attack is dropped here rather than left to time out: its
           `activeMs` is a ceiling for a roll that never crossed, and leaving it
           running would keep a live hitbox on a fighter nobody can see. */
        this.atk = null;
        this.ai = 'gone';
        this.aiT = 0;
        this.hasToken = false;
        this.returnT = (((C && C.returnMs) || {})[this.kind] || 1600) / 1000;
        this.exitSide = this.chargeIx;
        return;
      }

      /* ⚠️ PUNCHED OUT OF THE ROLL. `Fighter.hurt` clears `atk`, so losing the
         attack while still on screen means he was interrupted -- and without
         this he would fall through to the exit above and be teleported
         off-screen by a jab. The charge is answerable by hitting him during
         it, which is worth keeping: the tell is long, and a player who reads it
         and steps IN deserves the counter as much as one who steps aside. */
      if (!this.atk) {
        this.ai = 'approach';
        this.aiT = 0;
        this.hasToken = false;
        return;
      }

      // The tell. Curled and STILL -- a tell that already moves is not one.
      if (this.atk.phase === 'startup') return;
      // Rolling. No `bounds`: the walls are the thing he is leaving.
      this.walk(dt, this.chargeIx, 0, null, (C && C.speed) || 3.4);
      return;
    }

    /* OFF-SCREEN, AND OUT OF THE FIGHT. This is the charge's real cost to him:
       the crowd is one shorter for as long as it lasts, and `Crowd` will not
       hand a token to something it cannot see.

       HE COMES BACK THE WAY HE WENT, which is the whole point of remembering
       `exitSide` -- reappearing on the far side would read as a second roach
       rather than the same one returning. The walk back in is the SPAWN walk,
       reused: `enter` already knows how to bring a fighter in from off-screen
       to a mark, so a charge ends by handing him to the code that started him. */
    if (this.ai === 'gone') {
      this.returnT -= dt;
      if (this.returnT > 0) return;
      const b = bounds;
      const margin = ((CONFIG.BARATA_CHARGE && CONFIG.BARATA_CHARGE.exitMarginPx) || 180);
      if (b) {
        this.x = this.exitSide > 0 ? b.maxX + margin : b.minX - margin;
        this.entryX = this.exitSide > 0 ? b.maxX - 60 : b.minX + 60;
      } else {
        this.entryX = this.x;
      }
      this.facing = this.exitSide > 0 ? 'left' : 'right';
      this.enterT = 0;
      this.ai = 'enter';
      this.aiT = 0;
      return;
    }

    if (this.atk) return;      // mid-swing; Fighter is driving

    /* BETWEEN THE HITS OF A STRING. Fighter clears `atk` at the end of each
       hit's recovery, so this runs on the first frame the enemy is free again:
       throw the next hit, or end the string and hand the token on.

       IT DOES NOT RE-CHECK RANGE. A committed string that stopped when the
       player stepped out of it would be a fighter that can never be made to
       miss, and the recovery on the last hit — the whole punish for throwing
       one — would never be paid. Whiffing into empty air is the point.

       Nothing here has to unwind the string on an interruption: being hit,
       knocked down or killed all clear `atk` through `hurt()`, which puts the
       ai back to 'approach', and this branch is not reached at all. */
    if (this.ai === 'combo') {
      this.chainStep++;
      if (this.chainStep < this.chainLen
          && this.attack(this.combo, this.chainStep)) return;
      this.ai = 'approach';
      this.aiT = 0;
      this.hasToken = false;
    }

    const dx = player.x - this.x;
    const dz = player.z - this.z;

    /* The stand-off. Enemies that walk to the player's exact position end up
       standing INSIDE them, and two fighters in one pixel is a shoving match
       rather than a fight. So the target is a spot beside the player, on
       whichever side this enemy is already on — approaching from behind by
       walking through them would be worse than not approaching at all. */
    const side = dx >= 0 ? -1 : 1;         // stand on the near side
    const wantX = player.x + side * CONFIG.enemyStandoffX;
    const wantZ = player.z;

    const atX = Math.abs(this.x - wantX) < 14;
    const atZ = Math.abs(dz) < CONFIG.enemyStandoffZ;

    if (this.ai === 'wind') {
      this.windT -= dt;
      this._face(player);
      if (this.windT <= 0) {
        // Swing. If the player has moved out of reach in the meantime it will
        // simply miss, which is correct — the wind-up is the tell, and a tell
        // you can walk out of is the whole point of having one.
        this.chainStep = 0;
        this.chainLen = this._rollChain();
        this.attack(this.combo, 0);
        /* THE TOKEN IS HELD FOR THE WHOLE STRING, not just the first hit. It
           is a reservation on the right to be attacking the player, and an
           enemy three punches into a combo is more obviously using it than one
           that has just started. Released above, when the string ends. */
        this.ai = 'combo';
        this.aiT = 0;
      }
      return;
    }

    /* THE JUMP-IN IS AN APPROACH, WHICH IS WHY IT IS TESTED BEFORE THE WIND-UP
       AND BEFORE CLOSING IN. It is the way he covers the last stretch of ground
       — a fighter who walks all the way into range and only then decides to
       jump has nothing left to jump over. He must already be lined up in DEPTH:
       the leap is along x only, so stepping out of his lane is the answer to it
       and he has to commit to a lane before leaving the floor. */
    if (this.wantsLeap && this.hasToken && !this.jumping
        && Math.abs(dz) < CONFIG.enemyLeapMaxZ
        && Math.abs(dx) > CONFIG.enemyLeapMinX
        && Math.abs(dx) < CONFIG.enemyLeapMaxX) {
      this._startLeap(dx);
      return;
    }

    /* THE CHARGE, decided here beside the leap and on the same terms: he must
       hold the token, and he must be inside the band the move reads well from.

       ⚠️ THERE IS NO `dz` TEST, and that is the difference between this and the
       jump-in. The leap checks depth because it is aimed AT the player and
       would otherwise be thrown at somebody standing in another lane. The
       charge is not aimed -- it is a line down the lane he is already in, and
       the player's job is to leave that lane. Adding a depth condition here
       would quietly turn it into a homing attack that only fires when it is
       already going to hit. */
    const CB = CONFIG.BARATA_CHARGE;
    if (this.wantsCharge && this.charge && this.hasToken && CB
        && Math.abs(dx) > CB.minX && Math.abs(dx) < CB.maxX) {
      this._startCharge(dx);
      return;
    }

    if (this.hasToken && atX && atZ) {
      this.ai = 'wind';
      const lo = CONFIG.enemyWindupMinMs, hi = CONFIG.enemyWindupMaxMs;
      this.windT = (lo + Math.random() * (hi - lo)) / 1000;
      this._face(player);
      return;
    }

    if (this.hasToken) {
      // Close in.
      const ix = Math.abs(this.x - wantX) < 6 ? 0 : (wantX > this.x ? 1 : -1);
      const iz = Math.abs(dz) < 8 ? 0 : (wantZ > this.z ? 1 : -1);
      this.walk(dt, ix, iz, bounds, this.speedScale);
      this.ai = 'approach';
    } else {
      /* No token: ORBIT. Hanging back at a radius, drifting round the player,
         is what makes a crowd read as alive rather than as a queue. It also
         keeps the un-committed enemies visibly present and threatening, which
         is the pressure the token system would otherwise remove.

         ⚠️ THE DIRECTION IS `orbitDir`, FIXED AT SPAWN, AND NOT `this.z >
         player.z`. See the constructor: deriving it from live position made it
         oscillate the moment an enemy sat on the player's depth line.

         ⚠️ AND THERE ARE TWO RADII. The nearest enemy without a turn is the
         UNDERSTUDY and waits close enough to step straight in when a slot
         frees; everyone else keeps well back. A single radius meant the whole
         crowd sat at arm's length and a freed slot took a walk to fill. */
      /* ⚠️ THE OUTER RING WANDERS OFF, and the understudy never does -- his
         whole job is to be near. See CONFIG.ENEMY_STROLL. Handled before the
         orbit because a stroller is not orbiting at all; it returns. */
      const ST = CONFIG.ENEMY_STROLL || {};
      if (ST.on === false || this.ready) {
        /* Re-rolled every frame it is NOT allowed to wander, so the moment it
           is demoted out of the understudy slot it gets a full delay rather
           than an expired clock left over from before its promotion. */
        this.strolling = false;
        this._rollStroll(ST);
      }
      else if (this._stroll(dt, player, bounds, ST)) { this.ai = 'stroll'; return; }

      this.orbit += CONFIG.enemyCircleSpeed * dt * this.orbitDir
                  * (this.ready ? (CONFIG.enemyReadySpeedRel || 0.5) : 1);
      /* ⚠️ THE RADIUS IS EASED, NOT SWITCHED, and that is deliberate belt AND
         braces. Read fresh each frame, becoming the understudy teleports the
         target 30px inward -- so the moment the flag changed, for any reason,
         the enemy lurched between two circles. Held as state and eased, a
         promotion is a step in, and a flag that ever DID flicker could not
         produce more than a wobble of a fraction of a pixel. The bug this file
         has produced three times is a value read fresh from something that
         moves; this is the same class, removed rather than guarded. */
      const wantR = this.ready ? (CONFIG.enemyReadyRadius || 180)
                              : CONFIG.enemyCircleRadius;
      this.ringR += (wantR - this.ringR)
                  * Math.min(1, dt * (CONFIG.enemyRingEase || 3));
      const r = this.ringR;
      const tx = player.x + Math.cos(this.orbit) * r;
      const tz = player.z + Math.sin(this.orbit) * r * 0.35;
      this._seek(dt, tx, tz, bounds, this.speedScale * 0.8);
      this.ai = 'circle';
      // Keep looking at the player even while sidling — an enemy that faces the
      // way it is walking reads as having lost interest.
      this._face(player);
    }
  }

  /**
   * One frame of wandering off and coming back. Returns true while it is
   * walking somewhere and the orbit should be skipped.
   *
   * ⚠️ THE DESTINATION IS READ ONCE. `strollX` is the far end of the walkable
   * span from where the PLAYER was standing at the moment this began, and it is
   * never re-read. Recomputing it per frame would be the bug this file has
   * already produced twice -- a destination derived from a live quantity that
   * walking towards it changes -- and here it would be worse than a jiggle: an
   * enemy would turn round every time the player crossed the middle.
   *
   * ⚠️ AND IT ENDS THREE WAYS, all of them here: it arrives, it runs out of
   * `maxMs`, or the crowd hands it a turn -- which never reaches this code at
   * all, because `hasToken` is tested one branch up. A stroller answering a
   * summons is the "coming back to check the fight" half of the request and it
   * needs no case of its own.
   */
  _stroll(dt, player, bounds, ST) {
    this.strollT -= dt;
    if (this.strolling) {
      if (this.strollT <= 0 || Math.abs(this.strollX - this.x) < (ST.arrivePx || 46)) {
        this.strolling = false;
        this._rollStroll(ST);
        return false;
      }
      const ix = this.strollX > this.x ? 1 : -1;
      this.walk(dt, ix, 0, bounds, this.speedScale * (ST.speedRel || 0.85));
      /* STILL WATCHING THE FIGHT WHILE HE WALKS AWAY FROM IT. An enemy that
         faced the way it was strolling would read as having left. */
      this._face(player);
      return true;
    }
    if (this.strollT > 0) return false;
    /* OFF HE GOES. The far end from the player, so it is a real crossing rather
       than a shuffle -- and `bounds` is the arena's own walls, which is what
       makes "the other end of the screen" mean the screen. */
    const pad = ST.padPx || 110;
    const mid = (bounds ? (bounds.minX + bounds.maxX) : 0) / 2;
    this.strollX = bounds
      ? (player.x < mid ? bounds.maxX - pad : bounds.minX + pad)
      : this.x;
    this.strolling = true;
    this.strollT = (ST.maxMs || 4000) / 1000;
    return true;
  }

  /**
   * Walk toward a point, at whatever speed actually reaches it -- and stop
   * exactly on it rather than in a band around it.
   *
   * ⚠️ THIS EXISTS BECAUSE A FIGHTER CAN ONLY WALK AT ONE SPEED, AND THAT WAS
   * THE LAST OF THE WIGGLE. `walk()` takes a direction of -1/0/1, so tracking a
   * moving point with a deadzone means moving at FULL speed or not at all. The
   * orbit target moves at `enemyCircleSpeed * radius`:
   *
   *     outer ring   189 px/s   against a walk of 192  -- near enough matched,
   *                             so it walks continuously and looks smooth
   *     understudy    81 px/s   against the same 192   -- it sat inside the
   *                             10px deadzone for seven frames, jerked 3.2px,
   *                             and sat still again
   *
   * That is why the understudy was the one still twitching after the orbit
   * direction and the sticky flag were both fixed: his target is the SLOWEST,
   * so he spent the most time unable to move at all. **A deadzone does not
   * smooth a follow; it quantises it.**
   *
   * So there is no deadzone. The step is scaled down to exactly close the gap
   * when the gap is smaller than a full step, which both removes the overshoot
   * the deadzone was there to prevent AND lets him move at 81px/s.
   *
   * ⚠️ THE ARRIVE THRESHOLD IS 0.05px, AND IT WAS 1px, AND THAT ONE PIXEL WAS
   * ITS OWN BUG. A threshold is a deadzone by another name, and it fails the
   * same way: it has to be smaller than the SLOWEST step the target ever takes.
   * The orbit is an ELLIPSE, so the target's speed varies around it --
   *
   *     side of the ellipse   1.35 px/frame   fine
   *     end of the ellipse    0.47 px/frame   BELOW a 1px threshold
   *
   * -- so at the two ends the understudy stopped dead, the target crept past
   * 1px, he took one step onto it and stopped again. Twice per orbit, and only
   * him, because his ring turns at half speed and his target is the slowest
   * thing on screen. Reported as "stuck between two loops": those two points
   * are exactly the ends of the x sweep, where he looks caught between going
   * one way round and the other.
   *
   * 0.05 is small enough that no target in this game can hide under it, and it
   * exists only to keep `gap` out of the divisor below. The sub-pixel `ix`
   * churn it used to guard against cannot happen either: this passes the RAW
   * delta, and the orbit branch overwrites `facing` with `_face(player)`.
   */
  _seek(dt, tx, tz, bounds, base) {
    const dx = tx - this.x, dz = tz - this.z;
    const gap = Math.hypot(dx, dz);
    if (gap < 0.05) return;
    /* ⚠️ THE RAW DELTA IS PASSED, NOT ITS SIGN. `walk()` normalises whatever it
       is given, so `(dx, dz)` is a PROPORTIONAL direction -- which is the
       difference between "walk northeast" and "walk mostly east". Handed
       `(±1, ±1)` a fighter one pixel out in depth walks a full diagonal, sails
       past in z, and flips back next frame: a second wiggle, at right angles to
       the one this method was written to remove. */
    const ux = dx / gap, uz = dz / gap;
    // What `walk` will actually cover this frame along that direction -- read
    // the way it moves (x and z have different speeds) or the scale is a guess.
    const full = Math.hypot(ux * CONFIG.walkSpeedX, uz * CONFIG.walkSpeedZ) * base * dt;
    this.walk(dt, dx, dz, bounds, full > gap ? base * (gap / full) : base);
  }

  /** How long until this one gets bored again. */
  _rollStroll(ST) {
    const lo = (ST.everyMinMs || 4200), hi = (ST.everyMaxMs || 9000);
    this.strollT = (lo + Math.random() * Math.max(0, hi - lo)) / 1000;
  }

  _face(player) {
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    this.facing = facingFor(dx, Math.abs(dz) > 40 ? dz : 0, this.facing);
  }
}

/**
 * Crowd — owns the enemies of the current fight and hands out the attack token.
 *
 * Kept separate from the enemies themselves because the token is a property of
 * the GROUP, not of any member: no enemy can decide on its own whether it is
 * allowed to attack without knowing what the others are doing, and giving each
 * one a reference to all the others is the same thing with more places to get
 * it wrong.
 */
class Crowd {
  constructor() { this.list = []; }

  /**
   * ⚠️ AND IT DEALS OUT THE ORBIT DIRECTION, ALTERNATING. Which way an enemy
   * circles is a property of the GROUP for the same reason the attack token is:
   * what matters is that a wave splits BOTH ways, and no enemy can know that on
   * its own. Seeding it from the spawn position was tried and clumped -- all
   * five of the first arena's cigarettes came out identical, which is the
   * queue-shaped crowd the orbit exists to avoid. Index parity cannot.
   */
  add(e) {
    e.orbitDir = (this.list.length % 2) ? 1 : -1;
    this.list.push(e);
  }
  /** Everything, corpses included. For a HARD reset only -- a run beginning or
      ending, or a room swap behind the fade's black. Never mid-level: it cuts
      whatever was still fading. Use clearLiving() there. */
  clear() { this.list.length = 0; }

  /**
   * Take the LIVING out and leave the dead to finish fading.
   *
   * ⚠️ THIS EXISTS BECAUSE `clear()` MID-LEVEL IS THE SAME BUG SIX TIMES OVER.
   * A body fades for `corpseFadeDelayS + corpseFadeS` (0.8s) after it lands,
   * and the gap between one arena clearing and the next spawning can be as
   * little as `scrollMinWalkPx / walkSpeedX` -- 0.87s. So a straight clear at
   * spawn time deletes a body the player is still watching, and the camera is
   * following the player away from it, which keeps it on screen while it goes.
   *
   * In practice it removes nothing at all: an arena only hands over once
   * `cleared()` is true. It is a safety net for a segment entered with somebody
   * still standing, and it is deliberately not a `clear()`.
   */
  clearLiving() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].dead) this.list.splice(i, 1);
    }
  }

  /** Everyone still standing. A dead one lies where it fell and is skipped. */
  alive() { return this.list.filter(e => !e.dead); }
  cleared() { return this.alive().length === 0; }

  /**
   * Is anyone of these KINDS alive and within the shot? The whistle layer asks
   * this -- see `whistleGate()` in game.js.
   *
   * ⚠️ ALIVE, NOT MERELY PRESENT. A corpse fading on the floor is not an enemy
   * on screen; gating a sound on `list` would keep it up for the 0.8s a body
   * takes to go, which is a sound that outlives its reason.
   *
   * ⚠️ AND THE MARGIN IS NOT SLOP. Enemies WALK IN from off the edge, so a test
   * against the bare screen would snap on somewhere in the middle of an
   * arrival. One `marginPx` either side means whatever is watching starts when
   * they do.
   */
  anyOnScreen(kinds, camX, marginPx) {
    const m = marginPx || 0;
    const lo = camX - m, hi = camX + CONFIG.GAME_W + m;
    for (const e of this.list) {
      if (e.dead || kinds.indexOf(e.kind) < 0) continue;
      if (e.x >= lo && e.x <= hi) return true;
    }
    return false;
  }

  /* ⚠️ `sheets` IS NEW AND THE REAPER NEEDS IT. A corpse may not be removed
     before its death ROW has finished playing (see Fighter.corpseGone), and how
     long that takes is a property of the drawings -- so the thing that decides
     when a body goes has to be able to ask them. Optional: without it the reaper
     falls back to the fade clock alone, which is what it always did. */
  update(dt, player, bounds, sheets) {
    /* ===== THE ATTACK TOKEN =====================================================
       Count who is currently committed — winding up or mid-swing. If that is
       under the cap, hand the token to the CLOSEST eligible enemy that does not
       already have one.

       Closest, rather than longest-waiting, on purpose: the enemy in the
       player's face is the one the player is watching, so it is the one whose
       attack they have a chance of reading. Awarding it by patience instead
       would routinely have someone swing from behind while the player is
       occupied with the one in front, which is the exact unfairness the token
       exists to prevent.

       Enemies still walking in, stunned, knocked down or dead are not eligible
       and cannot hold it — which is also what releases the token when the
       player hits whoever had it, so the turn passes immediately rather than
       stalling the crowd for the length of a stun. */
    /* THE COUNT IS OF TOKEN HOLDERS, NOT OF SWINGING ENEMIES. A token is a
       RESERVATION taken at the moment an enemy starts closing in, and it is
       held all the way through the approach, the wind-up and the swing. Counting
       only the ones visibly attacking would hand fresh tokens to everybody still
       walking — and then they would all arrive together and all swing at once,
       which is precisely the pile-on this exists to prevent, only delayed by the
       length of a walk. */
    let committed = 0;
    for (const e of this.list) {
      if (e.dead) { e.hasToken = false; continue; }
      /* `combo` counts as busy for the same reason `wind` does: between two
         hits of a string `atk` is momentarily null, and an enemy that stopped
         counting for that one frame could have its turn handed to somebody
         else while it is still visibly punching. */
      const busy = e.ai === 'wind' || e.ai === 'combo' || e.ai === 'leap'
                || e.ai === 'charge' || !!e.atk;
      if (!busy && (e.state === 'hurt' || e.state === 'down' || e.ai === 'enter')) {
        e.hasToken = false;
      }
      if (e.hasToken || busy) committed++;
    }

    if (committed < CONFIG.maxAttackers) {
      let best = null, bestD = Infinity;
      for (const e of this.list) {
        /* `gone` IS SKIPPED FOR THE SAME REASON `enter` IS: he is not on the
           screen. Without this the token can be handed to a roach that has
           charged off the side, and it sits with him -- unspendable, because
           his branch only counts down -- while the enemies still in the fight
           wait for a turn that is not coming. */
        if (e.dead || e.hasToken || e.ai === 'enter' || e.ai === 'gone') continue;
        if (e.state === 'hurt' || e.state === 'down' || e.atk) continue;
        const d = Math.hypot(e.x - player.x, (e.z - player.z) * 2);
        if (d < bestD) { bestD = d; best = e; }
      }
      /* ⚠️ THE ONE PLACE A TURN BEGINS, which is why the enemy is TOLD about it
         here rather than left to notice `hasToken` change under it. Three
         different places release the token, at three different points of the
         frame, so no snapshot of last frame's value can see every hand-over —
         see `Enemy.takeTurn()` for what that cost. */
      if (best) {
        best.hasToken = true;
        best.takeTurn();
      }
    }

    /* THE UNDERSTUDY: one enemy without a turn waits CLOSE (see the orbit branch
       in Enemy) so that a slot freeing is filled immediately rather than after a
       walk across the arena.

       ⚠️ IT IS STICKY, AND THE FIRST VERSION WAS NOT -- WHICH PUT THE JIGGLE
       BACK. Rechosen every frame by distance, the flag ping-ponged between the
       two nearest candidates whenever they were about equally far: being the
       understudy changes your target radius by 80px, so the pair lurched
       between 130 and 210 on alternate frames. That is the SAME SHAPE as the
       orbit-direction bug this replaced -- a decision derived from a live
       quantity that the decision itself moves -- reintroduced one function
       away, an hour later, in the fix for it.

       ⚠️ SO THE RULE IS: HOLD IT UNTIL IT STOPS BEING ELIGIBLE. Taking a turn,
       being hit, going down or dying ends the job; nothing else does. And it
       cannot go stale in the way "not sticky" was written to prevent, because
       being the understudy pulls an enemy IN -- it can only get nearer, never
       drift to the back while still holding the flag.

       ⚠️ AND IT IS SET BEFORE `update`, so an enemy reads the flag on the same
       frame it is decided rather than acting on last frame's answer. */
    const eligible = (e) => !e.dead && !e.hasToken
      && e.ai !== 'enter' && e.ai !== 'gone'
      && e.state !== 'hurt' && e.state !== 'down';
    let ready = null;
    for (const e of this.list) if (e.ready && eligible(e)) { ready = e; break; }
    if (!ready) {
      let readyD = Infinity;
      for (const e of this.list) {
        if (!eligible(e)) continue;
        const d = Math.hypot(e.x - player.x, (e.z - player.z) * 2);
        if (d < readyD) { readyD = d; ready = e; }
      }
    }
    for (const e of this.list) e.ready = (e === ready);

    for (const e of this.list) e.update(dt, player, bounds);

    /* REAP THE BODIES THAT HAVE FINISHED FADING, and nothing before that.
       Corpses used to stay in this list forever at alpha 0, so the only thing
       that ever removed one was `crowd.clear()` at a segment boundary -- which
       meant a hand-over fired mid-fade DELETED bodies the player was still
       watching. That is what made the last wave vanish the instant HIPÓLITO
       arrived. Removing them here, on their own clock, means a segment can hand
       over whenever it likes and the dead still leave the way they were drawn
       to. `corpseGone()` is the same arithmetic the fade uses. */
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].corpseGone && this.list[i].corpseGone(sheets)) this.list.splice(i, 1);
    }
  }
}
