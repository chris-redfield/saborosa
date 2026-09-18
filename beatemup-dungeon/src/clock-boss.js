/**
 * ClockBoss — MISTER STOP, the furious alarm clock, brought over from STILL
 * LIFE and re-taught to fight on a belt.
 *
 * The art is that game's exactly: `enemy-sheets/saborosa-boss-time*.png`, read
 * IN PLACE out of the flying dungeon's asset folder rather than copied — the
 * same deal the Mosca gets, and for the same reason: one copy, one truth.
 *
 * THE SHEET IS A TURN, NOT A WALK CYCLE — 7 poses sweeping profile-left (0)
 * through full-front (3) to profile-right (6). The widths give it away: 120px
 * in profile, 269px face-on, symmetric about the middle. So `facing` is a
 * CONTINUOUS 0..1 and the pose is just that value quantised; he is never
 * "playing an animation", he is simply pointed somewhere.
 *
 * ⚠️ AND THAT COUPLING IS HIS WHOLE CHARACTER, SO IT IS KEPT VERBATIM.
 * Velocity is `stalkSpeed × (facing×2−1)`, which means at either profile he
 * travels flat out and face-on he is STATIONARY. Turning to look at you IS
 * setting off after you. He decelerates as he swings through front-on, hangs
 * there the instant he is square to the camera, and accelerates away the other
 * way — with no acceleration code anywhere. Replacing this with "move toward
 * the player at speed S" would be fewer lines and would throw away the reason
 * he reads as a wind-up toy rather than a homing missile.
 *
 * EVERY FRAME SHARES TOP y=79 on the sheet, which is why the draw hangs them
 * from a common top: it is exact, and the 4px the front-facing frames gain is
 * the stance widening at the feet, which belongs downward rather than centred
 * away.
 *
 * HE FLOATS, AND THAT WAS THE ASK (2026-09-18) — *"faça ele flutuar, como ele
 * já flutua no still life, achamos que vai ser mais fácil"*. It is also the
 * thing that makes the fight legible, because of how reach works here:
 *
 *   HOVER — high, at `hoverY`, bobbing and stalking. Out of reach of a standing
 *           punch (Combat tests `|e.jumpY − player.jumpY| > box.reachY`), so
 *           the player cannot stand under him and mash. Reachable at the apex
 *           of a jump, which is the skill window.
 *   CAST  — he DROPS to `castY` to throw the lightning. That is the whole
 *           bargain: the only moment he is easy to punch is the moment he is
 *           dangerous. Same patience the Mosca's swoop asks for.
 *
 * THE SPECIAL IS HIS, AND IT IS TWO WAVES: an upright cross, a gap, then the
 * same four arms swung 45°. `saborosa-boss-time-golpe.png` is the SAME 7 poses
 * with his fists up, so it swaps in against the same rect table with no second
 * table to keep in step; the four fire sheets are a LOOP, not a build-up, and
 * cycle for as long as a bolt is on screen.
 *
 * ⚠️ A BOLT IS AN ARM ROOTED AT THE ORIGIN, AND THE ROOT IS THE SPRITE'S RIGHT
 * EDGE. Laid across him instead, half of every bolt runs the wrong way and
 * reads as lightning converging on him. That is Still Life's finding, inherited
 * whole — see `_drawBolt()` for the one flip that expresses it.
 *
 * ⚠️ NO `musicKey`, AND THAT IS NOT AN OVERSIGHT. README assigns MISTER STOP
 * "Cumbia Corazon" — which is already `musicLevel3`, the library's own bed,
 * since the 2026-09-17 swap with the TIME ATTACK. A boss shares its room's song
 * by declaring NOTHING (`bossMusic()` only switches for a boss carrying a key),
 * so the song he is supposed to arrive with is the song already playing, and a
 * key here would buy a fade from Cumbia to Cumbia. If he is ever given a track
 * of his own, this field is the entire wiring.
 *
 * Dependencies are the file's globals (CONFIG, Belt, Booms), like every other
 * fighter here. No DOM.
 */
class ClockBoss {
  constructor(x, z, camX) {
    const C = CONFIG.CLOCK_BOSS;
    this.kind = 'mrstop';
    /* The nameplate under his bar. Carried by the boss rather than branched on
       by the HUD, so a fourth one declares this and the HUD needs no case. */
    this.name = (C && C.name) || '';
    this.musicKey = null;          // see the header

    this.x = x;
    this.z = z;
    this.jumpY = C.enterFromY;     // he floats DOWN into the room

    this.maxHp = C.health;
    this.hp = this.maxHp;
    this.dead = false;
    this.fleeing = false;          // he never breaks off; the interface wants it

    this.facing = 0.5;             // 0 = profile left · 0.5 = front · 1 = right
    this.faceTarget = 0.5;
    this.vx = 0;                   // knockback only; stalking is facing-driven

    this.hurtT = 0;
    this.flash = 0;
    this.showBarT = 0;
    this.hasHit = false;           // one hit per wave, like every other boss

    this.phase = 'enter';
    this.t = 0;
    this.bobT = 0;
    this.castT = this._nextCastDelay();

    /* WHICH CAST COMES NEXT. An INDEX that advances every time, not a random
       pick: a boss whose next move is a coin flip cannot be learned, and
       learning the pattern is the fight. Only the timing between casts is
       salted. */
    this.castIx = 0;
    this._aim = null;              // the position this cast was aimed at

    /* HIS SHOTS, and they outlive the phase that fired them: a salvo still in
       the air when he goes back to hovering is the whole point of a salvo. */
    this.shots = [];
    this.shotT = this._nextShotDelay();
    this._hitShot = null;          // the shot Combat is about to be told about

    this.waveIndex = 0;            // which row of CONFIG.CLOCK_BOSS.WAVES is out
    this.booms = new Booms();
  }

  // --- The small interface Combat and the renderer need ---------------------

  /** Only a fight once he has floated down — nobody gets a bar off an entrance. */
  arrived() { return this.phase !== 'enter'; }

  vulnerable() {
    return !this.dead && this.arrived() && this.hurtT <= 0;
  }

  halfW() { return CONFIG.CLOCK_BOSS.sizePx * CONFIG.CLOCK_BOSS.hitWRel / 2; }
  halfZ() { return CONFIG.CLOCK_BOSS.hitZ / 2; }
  bodyHeight() { return CONFIG.CLOCK_BOSS.sizePx; }

  groundX(camX) { return this.x - camX; }
  groundY() { return Belt.topY + this.z - this.jumpY; }
  depthScale() {
    const t = Belt.depth ? this.z / Belt.depth : 1;
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
    this.hurtT = CONFIG.CLOCK_BOSS.hurtMs / 1000;
    /* Shoved a LITTLE, and never out of a cast. He outweighs a fighter, and a
       punch that cancelled a wave already on screen would make the pattern
       something the player can simply switch off — and the pattern is the
       fight. Compare Fighter.hurt(), which does interrupt, because a mook's
       swing is meant to be beatable. */
    this.vx = dir * CONFIG.CLOCK_BOSS.knockback;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.phase = 'die';
      /* ⚠️ THE VOLLEY DIES WITH HIM. The shots are drawn from HIS draw(), and
         `stage.boss` is nulled the moment `finished()` is true -- a ball left in
         the list would simply stop being rendered while still being tested, an
         invisible thing that damages you after the fight is over. */
      this.shots.length = 0;
      this.booms.arm(CONFIG.CLOCK_BOSS.deathBoom, CONFIG.CLOCK_BOSS.sizePx);
      this.t = 0;
      return true;
    }
    return true;
  }

  /** Is a wave of bolts on screen this frame? */
  _boltsLive() {
    return this.phase === 'wave1' || this.phase === 'wave2';
  }

  /** The bolt angles currently out, in degrees, or null. */
  _liveAngles() {
    if (!this._boltsLive()) return null;
    const W = CONFIG.CLOCK_BOSS.WAVES;
    return W[Math.min(W.length - 1, this.waveIndex)] || null;
  }

  /**
   * His attack: THE LIGHTNING, and nothing else in this pass — contact is
   * harmless, because he is a caster and not a rammer (that is the Mosca's job,
   * and duplicating it would make two bosses with one move).
   *
   * ⚠️ THE GEOMETRY IS SCREEN-SPACE AND RADIAL, WHICH IS NOT A SHAPE THE
   * RESOLVER SPEAKS. Combat wants one belt-space {x0,x1,z0,z1} box; four arms
   * radiating from a point are not that, and an axis-aligned box big enough to
   * contain them would kill the player standing in the gaps between the bolts —
   * which are most of the attack.
   *
   * So the test is done HERE, where the arms actually are (`_boltHitsPlayer`),
   * against the same numbers `draw()` uses, and the box handed back is simply
   * the delivery envelope for a hit that has already been decided. Wrong box,
   * right answer — and the alternative is teaching Combat about polar shapes for
   * one attack in the game. The debug view draws the ARMS, not this box, so
   * nothing about the overlay is made to agree with a lie.
   */
  hitbox() {
    if (this.dead || this.hasHit || !this._player) return null;
    const C = CONFIG.CLOCK_BOSS;

    /* A BALL FIRST, because it is the thing that can be on you during a phase
       that has no bolts at all. `_hitShot` is remembered so `update()` can retire
       exactly the one that landed -- see the note there. */
    const shot = this._shotOnPlayer(this._player);
    if (shot) {
      this._hitShot = shot;
      const S = C.SHOT || {};
      const r = S.hitPx || 30;
      return {
        x0: this._player.x - r, x1: this._player.x + r,
        z0: this._player.z - r, z1: this._player.z + r,
        def: {
          damage: S.damage != null ? S.damage : 8,
          knockback: S.knockback || 210,
          lift: 0, knockdown: false, pose: 'straight',
        },
        dir: (shot.vx >= 0) ? 1 : -1,
      };
    }
    this._hitShot = null;

    if (!this._boltsLive()) return null;
    if (!this._boltHitsPlayer(this._player)) return null;
    const hw = this.halfW(), hz = this.halfZ();
    return {
      // Centred on the PLAYER, so the overlap Combat re-tests cannot disagree
      // with the radial test that already passed.
      x0: this._player.x - hw, x1: this._player.x + hw,
      z0: this._player.z - hz, z1: this._player.z + hz,
      def: {
        damage: C.damage,
        knockback: C.touchKnockback,
        lift: 0,
        knockdown: false,
        pose: 'straight',
      },
      dir: (this._player.x >= this.x) ? 1 : -1,
    };
  }

  /**
   * Is the player standing on a bolt?
   *
   * Point-to-SEGMENT distance in screen space, against every live arm. The arm
   * is rooted at his chest and runs `armPx` outward at its angle; `hitPx` is the
   * trunk of the drawn bolt and NOT its drawn width — see the config note. A
   * player clipped by a wisp at the edge of a fork would be indefensible.
   */
  _boltHitsPlayer(player) {
    const angles = this._liveAngles();
    if (!angles) return false;
    const C = CONFIG.CLOCK_BOSS;
    const s = this.depthScale();
    const ox = this.x, oy = this._chestY();
    const len = C.armPx * s;
    const r = C.hitPx * s;

    /* ⚠️ THE PLAYER IS A BODY, NOT A POINT, AND TESTING THE POINT MADE THE
       CROSS HARMLESS. The bolts are rooted at his CHEST, so the two horizontal
       arms of the upright cross run at about head height — and measured against
       the player's GROUND point they missed by ~180px every time, which is to
       say the first of his two waves could not hit anyone standing up. It
       looked entirely correct on screen, because the drawing was right and only
       the measurement was wrong. That is the shape of bug a preview confirms
       rather than catches, so this one is measured, not eyeballed.

       So the test is SEGMENT TO SEGMENT: the arm against the player's standing
       body, feet to head, in the same (world x, screen y) frame the bolts are
       drawn in. `jumpY` comes along for free, which is what makes jumping into
       a bolt connect and clearing a low one work. */
    const px = player.x;
    const feetY = Belt.topY + player.z - (player.jumpY || 0);
    const bodyH = player.bodyHeight ? player.bodyHeight() : (CONFIG.bodySizePx || 152);
    const headY = feetY - bodyH;

    for (const a of angles) {
      const rad = a * Math.PI / 180;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      if (this._segToSeg(px, feetY, px, headY, ox, oy, ex, ey) <= r) return true;
    }
    return false;
  }

  /** Shortest distance between two segments — zero when they cross. */
  _segToSeg(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    /* Crossing segments are distance 0, and the endpoint scan below would
       otherwise report the (non-zero) distance between their nearest ENDS —
       which for a bolt run clean through a body is the wrong answer. */
    const d = (bx1 - bx0) * (ay1 - ay0) - (by1 - by0) * (ax1 - ax0);
    if (d !== 0) {
      const ua = ((by1 - by0) * (ax0 - bx0) - (bx1 - bx0) * (ay0 - by0)) / d;
      const ub = ((ay1 - ay0) * (ax0 - bx0) - (ax1 - ax0) * (ay0 - by0)) / d;
      if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) return 0;
    }
    return Math.min(
      this._distToSeg(ax0, ay0, bx0, by0, bx1, by1),
      this._distToSeg(ax1, ay1, bx0, by0, bx1, by1),
      this._distToSeg(bx0, by0, ax0, ay0, ax1, ay1),
      this._distToSeg(bx1, by1, ax0, ay0, ax1, ay1));
  }


  /** Where the bolts are rooted: his middle, not his feet. */
  _chestY() {
    return this.groundY() - CONFIG.CLOCK_BOSS.sizePx * this.depthScale() * 0.5;
  }

  _distToSeg(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = x0 + dx * t, qy = y0 + dy * t;
    return Math.hypot(px - qx, py - qy);
  }

  /** The contact shape for the debug view: the ARMS, which is what actually hits. */
  debugHitbox() {
    if (this.dead || !this._boltsLive()) return null;
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
    this._bounds = bounds;
    /* Stashed because `hitbox()` is called by Combat WITHOUT arguments and the
       radial test needs someone to measure against. Written every frame rather
       than once, so it cannot go stale across a room change. */
    this._player = player;

    /* ⚠️ A SHOT THAT LANDED HAS TO BE RETIRED HERE, because Combat does not know
       there are several of them: it sets `hasHit` on the BOSS, which would then
       gate every remaining shot in the salvo behind the first one to connect.
       So the shot that produced the hit is killed and the flag is cleared. The
       player's own i-frames are what stop the rest of the volley double-dipping
       in the same instant -- `bossHits` already tests `player.vulnerable()`. */
    if (this.hasHit && this._hitShot) {
      this._hitShot.dead = true;
      this._hitShot = null;
      this.hasHit = false;
    }

    this.t += dt;
    this.bobT += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.showBarT > 0) this.showBarT -= dt;

    // Knockback bleeds off wherever he is; it never steers the stalk.
    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.max(0, 1 - 6 * dt);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    switch (this.phase) {
      case 'enter':   this._enter(dt, player); break;
      case 'hover':   this._hover(dt, player); break;
      case 'settle':  this._settle(dt, player); break;
      case 'tell':    this._tell(dt, player);  break;
      case 'salvo':   this._salvo(dt, player); break;
      case 'wave1':   this._wave(dt, 0);       break;
      case 'gap':     this._gap(dt);           break;
      case 'wave2':   this._wave(dt, 1);       break;
      case 'recover': this._recover(dt);       break;
      case 'die':     break;
    }

    this._tickShots(dt, player);

    if (bounds) {
      const m = 40;
      this.x = Math.max(bounds.minX + m, Math.min(bounds.maxX - m, this.x));
    }
  }

  _to(phase) {
    this.phase = phase;
    this.t = 0;
    this.hasHit = false;
    /* Reset HERE rather than when the salvo ends, so a volley cut short -- he
       dies mid-sequence, the leg reloads -- cannot leave the counter part-way
       and make the NEXT salvo fire two balls instead of five. */
    if (phase === 'salvo') this._fired = 0;
  }

  _nextCastDelay() {
    const C = CONFIG.CLOCK_BOSS;
    return (C.castEveryMs + Math.random() * C.castSaltMs) / 1000;
  }

  _bob() {
    return Math.sin(this.bobT * CONFIG.CLOCK_BOSS.bobFreq) * CONFIG.CLOCK_BOSS.bobAmp;
  }

  /** Ease the float toward a height; he never falls and never lands. */
  _ride(dt, want) {
    this.jumpY += (want - this.jumpY) * Math.min(1, CONFIG.CLOCK_BOSS.riseRate * dt);
  }

  /** Turn toward a target facing at the rate `turnMs` sets. */
  _turn(dt) {
    const rate = 1 / (CONFIG.CLOCK_BOSS.turnMs / 1000);
    const d = this.faceTarget - this.facing;
    const step = rate * dt;
    this.facing += Math.abs(d) <= step ? d : Math.sign(d) * step;
    this.facing = Math.max(0, Math.min(1, this.facing));
  }

  /**
   * Point him at the player. Continuous: a small offset barely turns him, a big
   * one puts him in full profile — and because facing IS velocity, that is also
   * how hard he comes after you.
   */
  _look(player) {
    const dx = player.x - this.x;
    const span = CONFIG.CLOCK_BOSS.faceSpanX;
    this.faceTarget = 0.5 + Math.max(-0.5, Math.min(0.5, dx / span * 0.5));
  }

  /** −1 at profile-left, 0 front-on, +1 at profile-right. */
  _drive() { return this.facing * 2 - 1; }

  _enter(dt, player) {
    const C = CONFIG.CLOCK_BOSS;
    this._ride(dt, C.hoverY + this._bob());
    this._look(player);
    this._turn(dt);
    // Down far enough to read as arrived, and he is only then punchable.
    if (this.jumpY < C.hoverY + 30) this._to('hover');
  }

  _hover(dt, player) {
    const C = CONFIG.CLOCK_BOSS;
    this._ride(dt, C.hoverY + this._bob());
    this._look(player);
    this._turn(dt);
    // THE COUPLING: turning to look at you is setting off after you.
    this.x += C.stalkSpeed * this._drive() * dt;
    /* Depth is the one thing the turn does NOT give him, so it is a plain
       drift — slower than the stalk, so closing the lane is something he does
       eventually rather than something he wins instantly. */
    const dz = player.z - this.z;
    if (Math.abs(dz) > 20) this.z += Math.sign(dz) * C.stalkSpeed * 0.35 * dt;

    /* ⚠️ THE LOOSE SHOT FIRES IN THE HOVER AND NOWHERE ELSE, by choice
       (2026-09-18). Ticking it through the cast would land a ball on the player
       in the same frame they are threading the cross's four arms -- damage they
       were given no way to read. Confining it here also gives the hover a job:
       it used to be the rest beat, and now standing off and waiting costs. */
    this.shotT -= dt;
    if (this.shotT <= 0) { this._fire(player); this.shotT = this._nextShotDelay(); }

    this.castT -= dt;
    if (this.castT <= 0) { this._aim = null; this._to('settle'); }
  }

  /**
   * WHICH OF THE THREE CASTS THIS IS. Rotated, never rolled — see `castIx`.
   *
   *   ground  he drops to the floor where he stands and throws it point blank.
   *           The cross's DOWN arm buries itself and the diagonals do the work.
   *   air     he stays up, over the player, and throws it from out of reach.
   *           Nothing about it can be punished; it is the one you only dodge.
   *   corner  he backs off to the far edge of the arena, MATCHES THE PLAYER'S
   *           DEPTH, and throws it across the whole belt. See `_aimFor()`.
   */
  _mode() {
    const M = CONFIG.CLOCK_BOSS.CAST_MODES || ['ground'];
    return M[this.castIx % M.length];
  }

  /** The float height this cast is thrown from. */
  _castY() {
    const C = CONFIG.CLOCK_BOSS;
    const m = this._mode();
    // The salvo is thrown from the air like the `air` cast -- he flies to the
    // corner and stays up there, which is what makes it a different threat from
    // the corner LIGHTNING, thrown from the floor of the same corner.
    return (m === 'air' || m === 'salvo') ? C.airCastY : C.castY;
  }

  /**
   * Where he has to be standing before the fists go up.
   *
   * ⚠️ THE CORNER CAST IS AIMED WITH `z`, NOT WITH `y`, AND THAT IS THE WHOLE
   * TRICK. Its target is the upright cross's HORIZONTAL arm, which runs across
   * the frame at his chest. Two bodies on a belt share a screen row when they
   * share a DEPTH, so matching the player's z is what puts that arm through
   * them — from the far side of the arena, where nothing else of his reaches.
   *
   * He does NOT need a special height for it: at `castY` his chest lands about
   * 13px above a matched-depth player's head, which is inside `hitPx`. Reaching
   * for a second height knob here would be tuning around a number that is
   * already right, and would come apart the moment `sizePx` moved.
   *
   * ⚠️ AND IT IS AIMED ONCE, HERE, AND NEVER CORRECTED. A cast that tracked the
   * player through its own wind-up could not be dodged by moving, which is the
   * only defence any of these three have.
   */
  _aimFor(player) {
    const C = CONFIG.CLOCK_BOSS;
    const b = this._bounds;
    const mode = this._mode();
    if (mode === 'air') {
      return { x: player.x, z: player.z, y: this._castY() };
    }
    if ((mode === 'corner' || mode === 'salvo') && b) {
      /* ⚠️ AS FAR AWAY AS THE ARM STILL REACHES -- NOT the literal corner, which
         is the first thing this did and it MISSED. The arena is 1280 wide and
         the arm is `armPx` (720) scaled by depth, so parking him on the edge put
         the player 836px away from a bolt that stops at ~670: he lined up
         perfectly, threw it, and nothing happened. The cast looked magnificent
         and could not connect, which is the worst kind of wrong.

         So the mark is derived from the REACH rather than from the room: back
         off to `reachFrac` of the arm's length, then clamp into the arena. That
         keeps the whole point of the move -- he is across the belt, not on top
         of you -- and it cannot come apart again if `armPx` or `sizePx` moves,
         because both are in the number it is derived from. */
      const zAt = player.z;
      const t = Belt.depth ? zAt / Belt.depth : 1;
      const scaleAtZ = CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
      const reach = C.armPx * scaleAtZ * (C.cornerReachFrac || 0.85);
      const left = Math.max(b.minX + C.cornerInsetPx, player.x - reach);
      const right = Math.min(b.maxX - C.cornerInsetPx, player.x + reach);
      // whichever side leaves him further from the player
      const x = (Math.abs(player.x - left) >= Math.abs(player.x - right)) ? left : right;
      return { x: x, z: zAt, y: this._castY() };
    }
    // ground, and the fallback when there are no bounds to find a corner in
    return { x: this.x, z: this.z, y: this._castY() };
  }

  /**
   * Take up position for this cast.
   *
   * He is moved DIRECTLY here rather than through `facing`, because the turn is
   * a stalk and this is a manoeuvre: a corner run steered by the thing that
   * points him at the player would curve back into them. He keeps LOOKING at
   * the player the whole way, which is why backing off to a corner reads as him
   * squaring up rather than fleeing.
   */
  _settle(dt, player) {
    const C = CONFIG.CLOCK_BOSS;
    if (!this._aim) this._aim = this._aimFor(player);
    const a = this._aim;

    const dx = a.x - this.x;
    const stepX = C.settleSpeed * dt;
    this.x += Math.abs(dx) <= stepX ? dx : Math.sign(dx) * stepX;

    const dz = a.z - this.z;
    const stepZ = C.settleZSpeed * dt;
    this.z += Math.abs(dz) <= stepZ ? dz : Math.sign(dz) * stepZ;

    this._ride(dt, a.y);
    this._look(player);
    this._turn(dt);

    /* ⚠️ THE TIMEOUT IS NOT PADDING. This phase is the only thing standing
       between the hover and the cast, and every way of never arriving -- a
       speed knob at zero, an arena narrower than the inset, a player who cannot
       be reached in depth -- would hang him in a fight nobody can end, with
       nothing visibly wrong. He throws it from wherever he got to. */
    const near = Math.abs(dx) <= C.settleReachPx && Math.abs(dz) <= C.settleReachPx;
    if (near || this.t >= C.settleMaxMs / 1000) { this.waveIndex = 0; this._to('tell'); }
  }

  /** Fists up, holding the mark he settled on — the only warning the player gets. */
  _tell(dt, player) {
    const C = CONFIG.CLOCK_BOSS;
    this._ride(dt, this._castY());
    this._look(player);
    this._turn(dt);
    if (this.t >= C.telegraphMs / 1000) {
      this.waveIndex = 0;
      // The salvo replaces the lightning entirely -- it is the other thing he
      // does from a corner, not a garnish on top of the cross.
      this._to(this._mode() === 'salvo' ? 'salvo' : 'wave1');
    }
  }

  _wave(dt, index) {
    const C = CONFIG.CLOCK_BOSS;
    this.waveIndex = index;
    this._ride(dt, this._castY());
    // He is planted while casting: no stalk, no turn. The bolts are the move.
    if (this.t >= C.holdMs / 1000) this._to(index === 0 ? 'gap' : 'recover');
  }

  _gap(dt) {
    const C = CONFIG.CLOCK_BOSS;
    this._ride(dt, this._castY());
    if (this.t >= C.betweenMs / 1000) { this.waveIndex = 1; this._to('wave2'); }
  }

  _recover(dt) {
    const C = CONFIG.CLOCK_BOSS;
    /* ⚠️ HE STAYS DOWN THROUGH THE RECOVERY, and that is the punish window the
       whole fight is built around. Climbing the instant the last bolt cleared
       would mean the only moment he is reachable is the moment he is lethal,
       which is not a window, it is a coin flip. */
    this._ride(dt, this._castY());
    if (this.t >= C.holdMs / 1000) {
      this.castT = this._nextCastDelay();
      this.castIx++;            // the next cast is the next MODE
      this._aim = null;
      this._to('hover');
    }
  }

  /**
   * THE SALVO: five balls in sequence from a corner, each aimed where the
   * player WAS when it left him.
   *
   * ⚠️ THE SPREAD IS NOT AUTHORED, IT IS THE SEQUENCE. Because they are fired
   * `salvoGapMs` apart and each one aims fresh, a player who is moving makes the
   * fan open by himself -- and a player who is standing still gets all five in
   * the same place. That is the whole design: it asks for movement rather than
   * for a dodge, which is what was asked for.
   */
  _salvo(dt, player) {
    const C = CONFIG.CLOCK_BOSS, S = C.SHOT || {};
    this._ride(dt, this._castY());
    this._look(player);
    this._turn(dt);

    const gap = Math.max(1, S.salvoGapMs || 240) / 1000;
    const want = Math.min(S.salvoCount || 5, Math.floor(this.t / gap) + 1);
    this._fired = this._fired || 0;
    while (this._fired < want) { this._fire(player, this._fired); this._fired++; }

    if (this._fired >= (S.salvoCount || 5) && this.t >= want * gap) {
      this._fired = 0;
      this._to('recover');
    }
  }

  _nextShotDelay() {
    const S = (CONFIG.CLOCK_BOSS && CONFIG.CLOCK_BOSS.SHOT) || {};
    return ((S.everyMs || 1700) + Math.random() * (S.saltMs || 0)) / 1000;
  }

  /** His chest, in the (x, z, jumpY) space the shots fly through. */
  _chestJumpY() {
    return this.jumpY + CONFIG.CLOCK_BOSS.sizePx * this.depthScale() * 0.5;
  }

  /**
   * WHERE THE i-TH BALL OF A SALVO IS BORN: a point of a five-pointed star laid
   * over his clock face, rather than all five out of the same spot.
   *
   * ⚠️ `starStep` 2 IS WHAT MAKES IT A PENTAGRAM RATHER THAN A PENTAGON. Taking
   * every SECOND vertex is the star polygon {5/2} — the figure you draw without
   * lifting the pen — so because the balls leave in sequence, the spawn point
   * jumps across the face and the sequence TRACES the star. Stepping 1 would use
   * the same five points and merely walk round them, which is a ring.
   *
   * ⚠️ AND THE AIM FALLS OUT OF IT FOR FREE. `_fire` takes its direction from the
   * spawn point to the player, so five different origins are already five
   * slightly different headings — extra spread that costs no code and that gets
   * wider the closer he is.
   *
   * The star sits on the FACE (`starCentreRel`), not at the body's middle: he is
   * a clock with legs, and a star centred on his height would hang half of
   * itself around his feet.
   */
  _starSpawn(i) {
    const C = CONFIG.CLOCK_BOSS, S = C.SHOT || {};
    const n = Math.max(3, S.starPoints || 5);
    const step = S.starStep || 2;
    const sc = this.depthScale();
    const r = (S.starRadiusRel != null ? S.starRadiusRel : 0.30) * C.sizePx * sc;
    const centre = this.jumpY
      + C.sizePx * sc * (S.starCentreRel != null ? S.starCentreRel : 0.62);
    const k = (i * step) % n;
    // First point UP, then round the star. jumpY is up-positive, so +sin lifts.
    const a = Math.PI / 2 + (2 * Math.PI * k) / n;

    /* ⚠️ THE STAR FORESHORTENS WITH THE DIAL, because it is ON the dial. His
       turn sheet is 269px wide face-on and 120px in profile, and the salvo is
       thrown from a corner -- which is exactly when he is most side-on. Without
       this the two side points spawn off the edge of his body, which is the
       original complaint (balls not coming from him) wearing a different hat.
       Taken from the rect table, so it cannot drift from the art. */
    const rects = C.RECTS || [];
    let widest = 1;
    for (const rc of rects) if (rc[2] > widest) widest = rc[2];
    const cur = rects[this.poseIndex()];
    const squash = cur ? cur[2] / widest : 1;

    return { x: this.x + Math.cos(a) * r * squash,
             z: this.z,
             y: centre + Math.sin(a) * r };
  }

  /** Where a shot wants to end up: the middle of the player, not his feet. */
  _aimPoint(player) {
    const bh = player.bodyHeight ? player.bodyHeight() : (CONFIG.bodySizePx || 152);
    return { x: player.x, z: player.z, y: (player.jumpY || 0) + bh * 0.5 };
  }

  /**
   * One ball, aimed at the player and launched at a constant speed.
   *
   * ⚠️ `speed` IS CONSTANT AND HOMING ONLY STEERS. A shot that accelerated
   * toward the player could not be outrun, and outrunning it is the answer the
   * attack is asking for.
   */
  _fire(player, starIx) {
    const S = CONFIG.CLOCK_BOSS.SHOT || {};
    if (S.on === false || !player) return;
    /* The loose hover shot passes no index and comes out of his middle — it is
       one ball and has no figure to draw. Only a salvo takes star points. */
    const p = (starIx == null)
      ? { x: this.x, z: this.z, y: this._chestJumpY() }
      : this._starSpawn(starIx);
    const a = this._aimPoint(player);
    const dx = a.x - p.x, dz = a.z - p.z, dy = a.y - p.y;
    const len = Math.hypot(dx, dz, dy) || 1;
    const sp = S.speed || 360;
    this.shots.push({
      x: p.x, z: p.z, y: p.y,
      vx: dx / len * sp, vz: dz / len * sp, vy: dy / len * sp,
      t: 0, dead: false, scale: this.depthScale(),
    });
  }

  /**
   * Fly them, steer them, retire them. Run EVERY frame and in every phase --
   * a salvo still in the air when he goes back to hovering has to keep flying.
   */
  _tickShots(dt, player) {
    const S = CONFIG.CLOCK_BOSS.SHOT || {};
    if (!this.shots.length) return;
    const life = (S.lifeMs || 3000) / 1000;
    const homeFor = (S.homingMs || 1400) / 1000;
    const sp = S.speed || 360;

    for (const s of this.shots) {
      s.t += dt;
      /* ⚠️ THE HOMING EXPIRES, and that is what makes the attack finite. A ball
         that steered for its whole life would eventually corner anybody; after
         `homingMs` it commits to a heading and can simply be walked away from.
         The early steer is what stops standing still from working. */
      if (player && s.t < homeFor) {
        const a = this._aimPoint(player);
        const dx = a.x - s.x, dz = a.z - s.z, dy = a.y - s.y;
        const len = Math.hypot(dx, dz, dy) || 1;
        const k = Math.min(1, (S.homing || 1.5) * dt);
        s.vx += (dx / len * sp - s.vx) * k;
        s.vz += (dz / len * sp - s.vz) * k;
        s.vy += (dy / len * sp - s.vy) * k;
        // Re-normalised, so steering never buys or costs speed.
        const vl = Math.hypot(s.vx, s.vz, s.vy) || 1;
        s.vx = s.vx / vl * sp; s.vz = s.vz / vl * sp; s.vy = s.vy / vl * sp;
      }
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.y += s.vy * dt;
      if (s.t >= life || s.y < -60) s.dead = true;
    }
    this.shots = this.shots.filter(s => !s.dead);
  }

  /** Is this ball on the player? Belt space, like everything else that hits. */
  _shotHitsPlayer(s, player) {
    const S = CONFIG.CLOCK_BOSS.SHOT || {};
    const bh = player.bodyHeight ? player.bodyHeight() : (CONFIG.bodySizePx || 152);
    const r = (S.hitPx || 30);
    if (Math.abs(s.x - player.x) > r) return false;
    if (Math.abs(s.z - player.z) > (S.hitZ || 34)) return false;
    const mid = (player.jumpY || 0) + bh * 0.5;
    return Math.abs(s.y - mid) <= bh * 0.5 + r;
  }

  /** The first live ball touching the player, or null. */
  _shotOnPlayer(player) {
    if (!player) return null;
    for (const s of this.shots) if (!s.dead && this._shotHitsPlayer(s, player)) return s;
    return null;
  }

  _drawShots(ctx, assets, camX) {
    const S = CONFIG.CLOCK_BOSS.SHOT || {};
    if (!this.shots.length) return;
    const img = assets.getDrawable('mrstopShot');
    if (!img) return;
    const cell = S.cell || 216, n = S.frames || 5;
    for (const s of this.shots) {
      const k = Math.floor(s.t * 1000 / (S.holdMs || 100)) % n;
      const d = (S.sizePx || 76) * s.scale;
      const gx = s.x - camX;
      const gy = Belt.topY + s.z - s.y;
      ctx.drawImage(img, k * cell, 0, cell, cell, gx - d / 2, gy - d / 2, d, d);
    }
  }

  // --- Draw ----------------------------------------------------------------

  /**
   * Which of the 7 turn poses the current facing quantises to.
   *
   * The isFinite guard is not padding: with `turnMs` missing the rate is NaN,
   * facing goes NaN, RECTS[NaN] is undefined and draw() bails — while the
   * health bar, which never reads facing, carries on as though nothing were
   * wrong. An invisible boss with a working bar is a miserable thing to debug.
   * Falling back to head-on turns that into "he does not turn", which is
   * visible and points straight at the cause.
   */
  poseIndex() {
    const n = CONFIG.CLOCK_BOSS.RECTS.length;
    const f = isFinite(this.facing) ? this.facing : 0.5;
    return Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))));
  }

  /** Fists go up on the tell and stay up until the recovery is over. */
  _fistsUp() {
    return this.phase === 'tell' || this._boltsLive() || this.phase === 'gap'
        || this.phase === 'salvo' || this.phase === 'recover';
  }

  draw(ctx, assets, camX) {
    const C = CONFIG.CLOCK_BOSS;
    const img = assets.getDrawable(this._fistsUp() ? 'mrstopGolpe' : 'mrstop');
    if (!img) return;
    const rect = C.RECTS[this.poseIndex()];
    if (!rect) return;

    const s = (C.sizePx / C.refH) * this.depthScale();
    const w = rect[2] * s, h = rect[3] * s;
    const gx = this.groundX(camX);
    const gy = this.groundY();

    let alpha = 1;
    if (this.hurtT > 0) {
      const period = CONFIG.hurtBlinkMs / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.4 : 1;
    }
    if (this.dead) {
      const B = C.deathBoom;
      alpha *= Math.max(0, 1 - this.t / (((B && B.fadeMs) || 620) / 1000));
    }

    // The bolts go UNDER him, so the arms read as coming out of his back as
    // well as his front rather than being pasted over his face.
    if (this._boltsLive()) this._drawBolts(ctx, assets, gx, s);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(gx, gy);
    ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -w / 2, -h, w, h);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 0.5);
      ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -w / 2, -h, w, h);
    }
    ctx.restore();

    // Over him, and outside his transform: a ball is a thing in the room, not
    // a decal on his body.
    this._drawShots(ctx, assets, camX);

    /* Outside the transform above — blasts drawn inside it would inherit the
       translate and swing around with the corpse. */
    this.booms.draw(ctx, assets.getDrawable('boom'), gx, gy, this.t);
  }

  _drawBolts(ctx, assets, gx, s) {
    const C = CONFIG.CLOCK_BOSS;
    const angles = this._liveAngles();
    if (!angles) return;
    // The crackle: the four fire sheets are a LOOP, cycled on their own clock
    // for as long as a bolt is out — not a build-up, so it never "finishes".
    const k = Math.floor(this.t * 1000 / C.frameMs) % C.FIRE.length;
    const img = assets.getDrawable('mrstopFire' + k);
    if (!img) return;
    const cy = this._chestY();
    const len = C.armPx * s;
    const h = img.height * s * (len / (img.width * s));  // keep the arm's ratio
    for (const a of angles) this._drawBolt(ctx, img, gx, cy, a, len, h);
  }

  /**
   * One arm, rooted at his chest and pointing at `deg`.
   *
   * ⚠️ THE ROOT IS THE SPRITE'S RIGHT EDGE. Drawn the natural way — left edge at
   * the origin — every bolt runs the wrong way and the whole cast reads as
   * lightning converging ON him instead of out of him. The `scale(-1, 1)` is
   * that entire finding: it puts the right edge at the origin and lets the body
   * extend outward along +x, which `rotate()` then aims.
   */
  _drawBolt(ctx, img, gx, gy, deg, len, h) {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(deg * Math.PI / 180);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -len, -h / 2, len, h);
    ctx.restore();
  }

  /**
   * True once the death has played out and he can be cleared away.
   *
   * ⚠️ IT WAITS FOR THE BLASTS, NOT FOR THE FADE. The leg advances on this, and
   * advancing while a blast is still on screen cuts it off mid-frame — the same
   * bug shape that once hung a corpse in mid-air through an outro.
   */
  finished() {
    if (!this.dead) return false;
    const span = this.booms.armed ? Booms.spanMs(CONFIG.CLOCK_BOSS.deathBoom) / 1000 : 0;
    return this.t > Math.max(2.0, span);
  }
}
