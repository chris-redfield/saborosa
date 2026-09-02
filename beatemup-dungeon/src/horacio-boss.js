/**
 * HoracioBoss — the DESERT's boss, and the third thing in this game that fights
 * without being a Fighter.
 *
 * Like HorseBoss and FlyBoss it answers `vulnerable()`, `overlaps()`, `hurt()`,
 * `hitbox()`, `update()`, `draw()` and `finished()`, so combat.js needs no
 * branch for it. That interface is the contract; everything below is its own.
 *
 * ⚠️ THE ART IS SHAPED UNLIKE ANY OTHER PACK IN THIS GAME, and every decision
 * here follows from it. `tools/build-beat-horacio-defs.py` cuts
 * LEVEL x STATE x FACING:
 *
 *   LEVEL   0 joaninha (no spikes) . 1 small . 2 medium . 3 grandao
 *   STATE   0 armoured . 1 exposed (beige body) . 2 ball . 3 naked (level 0 only)
 *   FACING  8 drawn rotations, front / 45 / side / 135 / back and the mirrors
 *
 * ⚠️ AND THERE IS NOT ONE ANIMATION FRAME IN IT. No idle, no walk cycle, no
 * boil: every combination is a SINGLE drawing. So his motion is translation,
 * turning through the eight facings, and changing level or state -- never a
 * played row. Do not fake a cycle by alternating armoured/exposed; those are a
 * well body and a hurt one, and flipping between them reads as a bug.
 *
 * ⚠️ WHICH IS ALSO WHY `hurt` HAS REAL ART HERE AND THE HORSE'S DOES NOT. The
 * exposed drawing IS the hurt pose -- the shell stays and the creature under it
 * shows -- so he does not need the Mosca's blink to say a hit landed. He gets
 * the blink too, but the state change is the message.
 *
 * THE FIGHT, as specified. Nine beats; the ones marked --- are not built yet:
 *
 *   1. the screen stops, he comes out of the ground jumping, at level 1   BUILT
 *   2. the spike theatre, and the life bar appears                        BUILT
 *   3. back into the ground, becomes a ball, roams "looking for a place"  ---
 *   4. head out, looks around, submerges, surfaces somewhere else         ---
 *   5. he can travel horizontally while balled                            ---
 *   6. the CHARGE, in one of three z lanes, either direction              ---
 *   7. sometimes he surfaces and walks, or laughs                         --- *
 *   8. he signals and a WALL of charutobis crosses the screen             ---
 *   9. he surfaces next to you and stabs with the spikes                  ---
 *
 *   * ⚠️ 7 IS HALF-BLOCKED ON ART and 8 is fully blocked on it: there is no
 *     laughing drawing and no pointing drawing ("nos sprites que temos até o
 *     momento, nao tem ele rindo, nem ele apontando"). The WALKING half of 7 is
 *     buildable now because walking is translation. The laugh is not.
 */
class HoracioBoss {
  /* RAW `assets`, NOT `sheets`. His pack is level x state x facing and carries
     no `anims`, so `sheets.build()` has nothing to do with it -- it would find
     no idle to measure its scale against. The Mosca declares the same for the
     same kind of reason. See the note in prop.js. */
  get usesSheets() { return false; }

  constructor(x, z, camX) {
    const C = CONFIG.HORACIO_BOSS;
    this.kind = 'horacio';
    /* ⚠️ HIS NAME IS WRITTEN HERE, NOT READ FROM `CONFIG.CHARACTERS`, because
       he has no entry there -- he is not a sheets pack. Same as the Mosca and
       the opposite of the horse; hud.js already expects each boss to answer
       with its own name however it gets one.

       AND IT COSTS NOTHING TO LETTER: HORACIO was cut into the hand-drawn
       letter pack on 2026-09-01 and wired to nothing. `Letters.nameKey` derives
       the frame from whatever name a fighter declares, so his bar comes up
       lettered by hand with no code change -- the reason that cut was made. */
    this.name = C.name;
    this.x = x;
    this.z = z;
    this.jumpY = 0;
    this.hp = C.health;
    this.maxHp = C.health;
    this.hurtT = 0;
    this.dead = false;
    this.dieT = 0;
    /* ⚠️ NO GROUND SHADOW, ON REQUEST 2026-09-02 ("remove the shadow of this
       boss, the shadow is bad"). A shadow is load-bearing for a fighter -- an
       ellipse on the floor is the only way to read where a jump lands and who
       is in front -- but it is actively wrong for HIPOLITO's reason AND one of
       his own: he spends most of the fight IN the ground, and an ellipse
       painted crisply on top of the floor under a body that is halfway through
       it says the floor is above him and below him at once. `noShadow` is the
       shared opt-out game.js already honours. */
    this.noShadow = CONFIG.HORACIO_BOSS.shadow === false;
    /* HIS BLOWS BURST YELLOW, not the red every other enemy's do. Read by
       combat._impact, which lets an attacker override the role rule. */
    this.fxColour = CONFIG.HORACIO_BOSS.fxColour || null;

    this.level = C.enterLevel;
    this.state = 0;                 // armoured
    this.facing = 0;                // index into the eight drawings
    this.phase = 'emerge';
    this.t = 0;
    this.step = 0;                  // where we are in the theatre script

    /* HOW FAR INTO THE GROUND HE IS: 1 buried, 0 stood on it. The arrival hands
       this over from `Emerge`; after that his own phases drive it, which is
       what beats 3-6 are made of. ⚠️ IT IS ALSO HIS DEFENCE -- see
       `vulnerable()`: underground and mid-charge he cannot be hit. */
    this._sunk = 1;
    this._bobT = 0;                 // the float's own clock -- see `_bob()`
    this.goalX = x;                 // where he is travelling to while buried
    this.lane = 1;                  // which of the three charge lanes
    this.chargeDir = 1;
    this.lookT = 0;
    this.hasHit = false;            // combat.bossHits writes this -- see hitbox()

    /* THE SAME ARRIVAL THE DESERT'S MOOKS USE, deliberately: *"Ele sai pulando
       igual o resto da galera"*. Reusing `Emerge` rather than writing a rise
       here is what makes that literally true -- the heave, the step count, the
       hop past the ground line and the dust are the numbers that were tuned
       over six rounds on 2026-08-31, and a second implementation would drift
       from them the first time either was touched.

       ⚠️ HE HAS NO JUMP ROW, so the hop is POSITIONAL ONLY. The mooks hold
       frame 2 of a drawn jump while they climb; he has no such drawing and does
       not get a faked one. */
    this._anchorX = x;
    this.goalZ = z;
    this.next = 'charge';
    this.lookFlip = false;
    this.emerge = (CONFIG.EMERGE && CONFIG.EMERGE.on)
      ? new Emerge(CONFIG.EMERGE, 0, 0) : null;
    this._defs = null;
  }

  // --- the pack ------------------------------------------------------------

  /** The defs, once loaded. Null is a real state on the first frames. */
  _packs(assets) {
    if (this._defs) return this._defs;
    const d = (assets && assets.getJSON) ? assets.getJSON('horacio') : null;
    if (d && d.frames && d.index) this._defs = d;
    return this._defs || null;
  }

  /**
   * The one drawing for the current level, state and facing.
   *
   * ⚠️ THE FALLBACK IS NOT DEFENSIVE, IT IS THE DATA. Only level 0 has a naked
   * drawing -- a creature with no shell has no spike level -- so `index` holds
   * null at [level>0][3] and a blind lookup would draw nothing at all rather
   * than fail loudly. Falling back to armoured keeps a body on screen.
   */
  _frame(d) {
    const lv = d.index[this.level] || d.index[0];
    const st = (lv && lv[this.state]) || lv[0];
    const id = st ? st[this.facing] : null;
    return (id == null) ? null : d.frames[id];
  }

  // --- the shared boss interface -------------------------------------------

  /** Has he finished arriving? The life bar is gated on this -- see hud.js. */
  arrived() { return this.phase !== 'emerge'; }

  /** How far into the ground he is right now, wherever that is driven from. */
  sunkNow() {
    return (this.emerge && this.emerge.started) ? this.emerge.sunk : this._sunk;
  }

  /**
   * THE FLOAT: a slow rise and fall while he is in the ground, *"as like he was
   * floating in water"*.
   *
   * ⚠️ IT IS A DRAWING OFFSET AND NOTHING ELSE. It is deliberately NOT added to
   * `_sunk`, because `_sunk` is also what `vulnerable()` reads -- folding the
   * bob into it would make him hittable or not on the swell, so a punch would
   * land or whiff depending on where in a 1.5s sine he happened to be. That is
   * the kind of bug nobody diagnoses; they just say the hit detection feels bad.
   *
   * ⚠️ AND IT IS OFF ONCE HE IS OUT. A body standing on the floor that gently
   * rises and falls is not floating, it is hovering.
   */
  _bob() {
    const B = CONFIG.HORACIO_BOSS.BALL || {};
    if (this.sunkNow() <= 0.02) return 0;
    const ms = B.bobMs || 1500;
    return Math.sin(this._bobT * 2 * Math.PI * 1000 / ms) * (B.bobAmp || 0.035);
  }

  /**
   * ⚠️ HE IS PAINTED BETWEEN THE CIGARETTE LAYERS WHENEVER HE IS IN THE GROUND,
   * not only while arriving. Asked for 2026-09-02 in two halves -- *"when the
   * boss is coming out of the ground, use the same trick we use for the other
   * enemies"* and, of the rolling ball, *"burry him a little bit to the ground,
   * in a way similar that you are already doing (and also in between the
   * layers)"*. A digger only needs this until he is released; HORACIO is in and
   * out of the floor for the whole fight, so the test is his DEPTH rather than
   * a phase.
   *
   * ⚠️ AND game.js HAS TO ASK, because the interleave pass walks `crowd.list`
   * and a boss is `stage.boss` -- the same reason his emerge dust had to be
   * drawn by himself.
   */
  behindScenery() { return this.sunkNow() > 0.02; }

  /**
   * Which gap in the mounds he comes up through. Re-rolled every time he goes
   * under, so he does not surface through the same seam all fight.
   *
   * ⚠️ FLOORED AT 1 FOR THE REASON Emerge.pickPlane GIVES: plane 0 means
   * "behind every belt band", which reorders the floor against itself while he
   * is climbing. Copied rather than reasoned about again.
   */
  scenPlane(bands) {
    if (!bands || bands < 1) return null;
    if (this._plane == null || this._planeBands !== bands) {
      this._planeBands = bands;
      const E = CONFIG.EMERGE || {};
      const lo = Math.max(1, E.minBandsInFront != null ? E.minBandsInFront : 1);
      const hi = Math.min(bands, E.maxBandsInFront != null ? E.maxBandsInFront : bands);
      const inFront = (hi < lo) ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
      this._plane = Math.max(1, bands - inFront);
    }
    return this._plane;
  }

  /**
   * ⚠️ HE IS NOT ALWAYS HITTABLE, AND THAT IS THE FIGHT. Underground he is not
   * there to hit, and mid-charge he is a ball of spikes travelling at speed --
   * punching that should not be the answer to it. The openings are the PEEK and
   * the times he surfaces, which is what makes beats 4 and 7 the parts of his
   * loop the player is waiting for rather than filler between attacks.
   */
  vulnerable() {
    if (this.dead || !this.arrived()) return false;
    if (this.phase === 'charge') return false;
    return this._sunk < (CONFIG.HORACIO_BOSS.hittableSunk || 0.6);
  }

  sizePx() {
    const C = CONFIG.HORACIO_BOSS;
    return (C.sizeByLevel && C.sizeByLevel[this.level]) || C.sizePx;
  }
  halfW() { return this.sizePx() * CONFIG.HORACIO_BOSS.hitWRel / 2; }
  halfZ() { return CONFIG.HORACIO_BOSS.hitZ / 2; }
  bodyHeight() { return this.sizePx(); }

  groundX(camX) { return this.x - camX; }
  groundY() { return Belt.topY + this.z - this.jumpY; }

  depthScale() {
    const t = Belt.depth ? this.z / Belt.depth : 1;
    return CONFIG.beltFarScale + (1 - CONFIG.beltFarScale) * t;
  }

  /**
   * ⚠️ HIS HURTBOX GROWS WITH HIM, which is the whole reason `sizePx` is a
   * function rather than a constant. He is 230px at level 1 and 291 as the
   * grandao, so a fixed box would either let punches pass through the big body
   * or let them connect with air around the small one.
   */
  overlaps(box) {
    if (!box || !this.vulnerable()) return false;
    /* ⚠️ A HITBOX IS A SPAN (`x0,x1,z0,z1`), NOT A CENTRE AND A HALF-WIDTH, and
       getting that wrong is what made him INVINCIBLE on his first outing --
       *"my punches are not connecting with him, there is no punch animation
       feedback and his HP won't go down"*. Reading `box.x`/`box.hw` off a span
       gives `undefined`, every comparison became NaN, and NaN is false: he was
       not resisting damage, he was never being tested. It fails SILENTLY and in
       the direction that looks like a design decision, which is why it survived
       a review of the fight's logic. Copy this predicate from HorseBoss rather
       than reconstructing it. */
    const hw = this.halfW(), hz = this.halfZ();
    return box.x1 >= this.x - hw && box.x0 <= this.x + hw
        && box.z1 >= this.z - hz && box.z0 <= this.z + hz;
  }

  hurt(dmg) {
    if (!this.vulnerable()) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtT = (CONFIG.hurtMs || 300) / 1000;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.dieT = 0;
      this.phase = 'die';
    }
  }

  /**
   * The live contact box, or null.
   *
   * ⚠️ THE SPENT FLAG IS `this.hasHit` ON THE BOSS, not on the attack. That is
   * combat.bossHits()'s contract and not a choice -- it writes `boss.hasHit`
   * directly after a connect. Gate this on anything else and the charge damages
   * the player on EVERY frame it overlaps them, which is the bug the horse's
   * header warns about in the same words.
   */
  hitbox() {
    if (this.dead || this.hasHit) return null;
    const C = CONFIG.HORACIO_BOSS;
    if (this.phase === 'charge') {
      /* THE WHOLE BALL IS THE ATTACK -- there is no reach, he simply is
         dangerous where he is. So the box is his body, not a swing in front of
         it, and `dir` is which way he is rolling so the knockback throws the
         player along the charge rather than into it. */
      const hw = this.halfW(), hz = this.halfZ();
      return { x0: this.x - hw, x1: this.x + hw,
               z0: this.z - hz, z1: this.z + hz,
               def: C.CHARGE, dir: this.chargeDir };
    }
    if (this.phase === 'stab' && this.t * 1000 >= (C.STAB.riseMs || 0)
        && this.t * 1000 < (C.STAB.riseMs || 0) + (C.STAB.activeMs || 0)) {
      const S = C.STAB;
      return { x0: this.x - S.reachX, x1: this.x + S.reachX,
               z0: this.z - S.reachZ, z1: this.z + S.reachZ,
               def: S, dir: this.chargeDir };
    }
    return null;
  }

  /* The overlay's box, and it is THE SAME GEOMETRY the resolver uses -- built by
     calling `hitbox()` rather than re-deriving it here. A debug view that draws
     from its own copy can agree with a bug; see debug.js's header. The flags say
     the non-geometric half: whether this pass has already spent itself. */
  debugHitbox() {
    const g = this.hitbox();
    if (!g) return null;
    g.spent = !!this.hasHit;
    g.live = true;
    return g;
  }

  finished() {
    return this.dead && this.dieT >= (CONFIG.HORACIO_BOSS.dieMs || 900) / 1000;
  }

  // --- the fight -----------------------------------------------------------

  _to(phase) { this.phase = phase; this.t = 0; }

  update(dt, player, bounds) {
    this.t += dt;
    /* KEPT so `_pickGoal` can choose a destination inside the arena. It runs at
       the END of a submerge rather than from `update`, and picking a spot the
       walls forbid would send him tunnelling into a corner and stalling there
       until `roamMaxMs` bailed him out. */
    this._bounds = bounds || this._bounds;
    this._player = player || this._player;
    this._bobT += dt;
    if (this.hurtT > 0) this.hurtT -= dt;

    if (this.dead) { this.dieT += dt; return; }

    /* FACE THE PLAYER while he has nothing better to do. Eight drawings means
       this is a lookup rather than a mirror -- see `_faceToward`.

       ⚠️ NOT DURING THE THEATRE, AND THIS WAS A BUG BEFORE IT WAS A RULE. The
       show is performed at the CAMERA -- `_emerge` turns him to the front on its
       last frame -- and tracking the player overwrote that on the very next
       one, so he played the whole thing in profile. A scripted display is not a
       state in which he is paying attention to anybody. */
    if (this.phase !== 'emerge' && this.phase !== 'theatre') {
      this._faceToward(player);
    }

    if (this.phase === 'emerge') return this._emerge(dt, player);
    if (this.phase === 'theatre') return this._theatre(dt);
    if (this.phase === 'submerge') return this._submerge(dt);
    if (this.phase === 'roam') return this._roam(dt, player, bounds);
    if (this.phase === 'peek') return this._peek(dt, player);
    if (this.phase === 'rise') return this._rise(dt, player);
    if (this.phase === 'charge') return this._charge(dt, bounds);
    if (this.phase === 'stab') return this._stab(dt);
    if (this.phase === 'walk') return this._walk(dt, player, bounds);
  }

  /**
   * Ease the body through the floor. ⚠️ ONE MOVER FOR EVERY PHASE THAT DIGS OR
   * SURFACES, rather than a bespoke curve in each: `_sunk` is read by the draw,
   * by `vulnerable()` and by nothing else, and three hand-rolled ramps would be
   * three chances for one of them to stop at 0.98 and leave him permanently a
   * sliver underground -- or permanently untouchable.
   */
  _easeSunk(dt, target, ms) {
    const rate = dt / Math.max(0.001, ms / 1000);
    if (this._sunk < target) this._sunk = Math.min(target, this._sunk + rate);
    else this._sunk = Math.max(target, this._sunk - rate);
    return this._sunk === target;
  }

  /** Beat 3, first half: he goes back into the ground and balls up. */
  _submerge(dt) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    this.state = 2;                    // the ball drawing, at his current level
    this._plane = null;                // a different seam every time he goes under
    const target = (B.roamSunk != null) ? B.roamSunk : 0.88;
    if (this._easeSunk(dt, target, B.digMs)) this._pickGoal();
  }

  /**
   * Beat 3/5: travelling underground. *"fica passeando pela tela, procurando um
   * lugar"*, and *"só movimentos horizontais"* -- so z only changes when he has
   * committed to a charge lane, never while wandering.
   *
   * ⚠️ NOTHING IS DRAWN WHILE HE DOES THIS and that is the specified behaviour,
   * not an oversight: he *"submerge totalmente e sai em outro ponto"*. The PEEK
   * is the cue that says where he went, which is why it is a phase of its own
   * rather than a flourish on the front of the next attack.
   */
  _roam(dt, player, bounds) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    this.state = 2;
    /* ⚠️ NOT 1, AND NOT "INVISIBLE". At a flat 1 the anchor arithmetic already
       left a sliver of one spike above the ground line -- and the user asked for
       MORE of it, not less: *"make him appear a little bit more, like a little
       bit more of the spike"*. So the tip travelling through the cigarettes is
       deliberate now rather than a rounding artefact, and it is also the only
       cue to where he is while he hunts. ⚠️ IT MUST STAY ABOVE `hittableSunk`
       (0.6) or roaming becomes a free window on him. */
    this._sunk = (B.roamSunk != null) ? B.roamSunk : 0.88;
    const dir = Math.sign(this.goalX - this.x) || 1;
    this.x += dir * B.roamSpeed * dt;
    if (this.z !== this.goalZ) {
      const dz = Math.sign(this.goalZ - this.z) || 1;
      this.z += dz * B.roamSpeed * 0.6 * dt;
      if (Math.abs(this.goalZ - this.z) < 4) this.z = this.goalZ;
    }
    const there = Math.abs(this.goalX - this.x) < 8;
    if (there || this.t * 1000 > B.roamMaxMs) {
      this.x = there ? this.goalX : this.x;
      this._to(this.next === 'charge' ? 'charge' : 'peek');
      if (this.next === 'charge') this._beginCharge();
    }
  }

  /**
   * Beat 4: the head comes out and he looks about, then decides.
   *
   * ⚠️ THIS IS THE FIGHT'S ONE RELIABLE OPENING -- `vulnerable()` turns on here
   * because `_sunk` comes up past `hittableSunk`. Shorten `peekMs` and you are
   * not trimming a flourish, you are taking away the window the whole fight is
   * built around.
   */
  _peek(dt, player) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    this.state = 2;
    this._easeSunk(dt, B.peekSunk, B.peekRiseMs);
    /* Looking side to side: the two profile drawings, alternating. Not a cycle
       of the pack -- there is no such row -- but two frames swapped on a timer,
       which is all "olhando pros lados" needs. */
    this.lookT += dt;
    if (this.lookT * 1000 >= B.lookMs) { this.lookT = 0; this.lookFlip = !this.lookFlip; }
    this.facing = this.lookFlip ? 2 : 6;
    if (this.t * 1000 >= B.peekMs) this._decide(player);
  }

  /** Beats 7 and 9's opening: he comes all the way out. */
  _rise(dt, player) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    if (this._easeSunk(dt, 0, B.surfaceMs)) {
      this.state = 0;                  // armoured again -- the shell reopens
      this._to(this.next === 'stab' ? 'stab' : 'walk');
    }
  }

  /**
   * Beat 6. *"o charge vai ser em 3 pontos diferentes da tela, em cima, em
   * baixo ou no meio. e ele pode vir da direita pra esquerda ou da esquerda pra
   * direita."*
   *
   * ⚠️ HE COMES OUT OF THE GROUND ALREADY MOVING. The lane and the side are
   * chosen while he is still buried (`_beginCharge`, off the roam) so the
   * player's warning is the ball surfacing at the edge of the screen, not a
   * wind-up next to them. `hasHit` is cleared per pass, which is what makes it
   * one hit per charge rather than one per frame of contact.
   */
  _beginCharge() {
    this.state = 2;
    this._sunk = (CONFIG.HORACIO_BOSS.CHARGE.sunk != null)
      ? CONFIG.HORACIO_BOSS.CHARGE.sunk : 0.26;
    this.hasHit = false;
    this.facing = this.chargeDir > 0 ? 2 : 6;
  }

  _charge(dt, bounds) {
    const C = CONFIG.HORACIO_BOSS;
    this.state = 2;
    /* ⚠️ NOT 0. A ball resting exactly on the ground line reads as FLOATING --
       reported 2026-09-02 -- because nothing overlaps its bottom edge and a
       sphere has no feet to plant it. Sinking it a little puts the floor in
       front of that edge, and with `behindScenery()` true at any depth the
       cigarette mounds are painted over it too, which is what actually sells it
       as ploughing through the ground. */
    this._sunk = (C.CHARGE.sunk != null) ? C.CHARGE.sunk : 0.26;
    this.x += this.chargeDir * C.CHARGE.speed * dt;
    const lim = this._limits(bounds);
    if ((this.chargeDir > 0 && this.x >= lim.hi) || (this.chargeDir < 0 && this.x <= lim.lo)) {
      this._to('submerge');
    }
  }

  /** Beat 9: up next to the player, spikes out. */
  _stab(dt) {
    const S = CONFIG.HORACIO_BOSS.STAB;
    this.level = (S.level != null) ? S.level : 3;   // the grandao does the stabbing
    this.state = 0;
    this._sunk = 0;
    if (this.t * 1000 >= S.riseMs + S.activeMs + S.recoverMs) {
      this.level = CONFIG.HORACIO_BOSS.enterLevel;
      this._to('submerge');
    }
  }

  /** Beat 7, the half the art supports: he surfaces and walks about. */
  _walk(dt, player, bounds) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    this.state = 0;
    this._sunk = 0;
    const lim = this._limits(bounds);
    const dir = Math.sign(this.goalX - this.x) || 1;
    this.x = Math.max(lim.lo, Math.min(lim.hi, this.x + dir * B.walkSpeed * dt));
    if (this.t * 1000 >= B.walkMs) this._to('submerge');
  }

  _limits(bounds) {
    const o = CONFIG.HORACIO_BOSS.CHARGE.overrun || 0;
    const lo = (bounds && bounds.minX != null) ? bounds.minX : 0;
    const hi = (bounds && bounds.maxX != null) ? bounds.maxX : CONFIG.GAME_W;
    return { lo: lo - o, hi: hi + o };
  }

  /** Where he tunnels to next, and what he does when he gets there. */
  _pickGoal() {
    const C = CONFIG.HORACIO_BOSS, B = C.BALL;
    const W = CONFIG.GAME_W;
    const r = Math.random();
    const w = C.WEIGHTS || { charge: 0.5, stab: 0.3, walk: 0.2 };
    this.next = (r < w.charge) ? 'charge' : (r < w.charge + w.stab) ? 'stab' : 'walk';
    if (this.next === 'charge') {
      /* THE THREE LANES ARE FRACTIONS OF THE BELT -- back, middle, front -- and
         the side is a coin flip, so the same lane can be run either way. */
      const lanes = C.LANES || [0.18, 0.5, 0.86];
      this.lane = Math.floor(Math.random() * lanes.length);
      this.goalZ = Belt.depth * lanes[this.lane];
      this.chargeDir = Math.random() < 0.5 ? 1 : -1;
      /* He must surface OFF the screen he is about to cross, so the goal is the
         far edge plus the run-up, not a point inside the arena. */
      this.goalX = this._anchorX + (this.chargeDir > 0 ? -1 : 1) * (W * 0.5 + C.CHARGE.startPad);
    } else {
      /* ⚠️ COME BACK TO A DEPTH THE PLAYER CAN REACH. Holding `this.z` here left
         him at whatever lane his last charge used -- a back-lane run at z 68 and
         he peeked, walked and dug at z 68 for the rest of the fight, drifting
         out of the player's reach permanently. Surfacing at their depth puts him
         back in the fight instead of parked at the top of the belt. */
      const pz = (this._player && this._player.z != null) ? this._player.z : this.z;
      this.goalZ = Math.max(0, Math.min(Belt.depth, pz));
      /* ⚠️ HE MUST COME UP SOMEWHERE ELSE, and the first cut of this did not
         guarantee it: the goal was a free draw around the anchor, so it could
         land within a few px of where he already was. `_roam` then completed on
         its first frame and he surfaced in the same spot he had just left --
         twice in a row in the trace, which reads as him teleporting nowhere
         rather than hunting. `roamMinPx` is the whole fix: pick a side, then a
         distance at least that far, and clamp it to the walls. */
      const lim = this._limits(this._bounds);
      const min = B.roamMinPx || 260;
      const span = Math.max(min, W * 0.32);
      let side = Math.random() < 0.5 ? -1 : 1;
      let g = this.x + side * (min + Math.random() * (span - min));
      if (g < lim.lo || g > lim.hi) g = this.x - side * (min + Math.random() * (span - min));
      this.goalX = Math.max(lim.lo, Math.min(lim.hi, g));
      /* And if the walls leave nowhere far enough, go to the far one rather
         than settle for standing still. */
      if (Math.abs(this.goalX - this.x) < min) {
        this.goalX = (this.x - lim.lo > lim.hi - this.x) ? lim.lo : lim.hi;
      }
    }
    this._to('roam');
  }

  /**
   * Pick the next move once he has had his look round.
   *
   * ⚠️ THE STAB GOES TO THE PLAYER, so its destination is read HERE and not at
   * `_pickGoal` time -- a target chosen before a second of roaming is a target
   * the player has already walked away from, and the attack would land where
   * they used to be.
   */
  _decide(player) {
    const C = CONFIG.HORACIO_BOSS;
    if (this.next === 'stab' && player) {
      const side = (player.x >= this.x) ? 1 : -1;
      this.x = player.x - side * (C.STAB.standOff || 90);
      this.z = player.z;
      this.chargeDir = side;
      this.facing = side > 0 ? 2 : 6;
      this.hasHit = false;
      this._to('rise');
      return;
    }
    if (this.next === 'walk') { this._to('rise'); return; }
    this._to('submerge');
  }

  /**
   * Beat 1. Out of the ground, jumping, at level 1 with the small spikes.
   *
   * ⚠️ THE PHASE ENDS ON `Emerge`'s OWN CLOCK, never on a duration written
   * here. This game's recurring bug family is a thing being deleted or advanced
   * while something else is still mid-state, and the arrival owns a heave, a
   * stepped rise, a hop and a landing whose total is the sum of several config
   * numbers. Asking it whether it is done is the only version that cannot drift
   * when one of those is retuned.
   */
  _emerge(dt, player) {
    if (!this.emerge) { this._to('theatre'); return; }
    if (!this.emerge.started) this.emerge.start(this.x, this.z);
    this.emerge.update(dt);
    // He comes up facing whoever he came up at.
    this.facing = (player && player.x < this.x) ? 6 : 2;
    if (this.emerge.done) {
      this.emerge = null;
      this.facing = 0;              // and turns to the front for the show
      /* WHERE THE FIGHT IS. Every later goal is measured from the spot he
         arrived at rather than from wherever he happens to be, so a run of
         charges cannot walk the whole fight off down the room. */
      this._anchorX = this.x;
      this._to('theatre');
    }
  }

  /**
   * Beat 2. The spike theatre, and the life bar comes up with it.
   *
   * The script, as given: *"o spike pequeno entra, ele fica como joaninha por 1
   * segundo, daí sai o máximo 2 vezes, sai grandao, joaninha e sai grandao, daí
   * no final ele volta pro nível 1."* So level 1 retracts to the joaninha, held
   * a second, then the maximum twice with a joaninha between, then back to 1 --
   * which is `CONFIG.HORACIO_BOSS.THEATRE`, written out as levels and holds
   * rather than coded here so the timing can be judged by eye and retuned
   * without touching this file.
   *
   * ⚠️ HE IS NOT VULNERABLE-BUT-IDLE HERE, HE IS PERFORMING, and the life bar
   * appearing is the cue that the fight has started. If this ever needs to be
   * unhittable, it is `vulnerable()` that changes, not this.
   */
  _theatre(dt) {
    const script = CONFIG.HORACIO_BOSS.THEATRE || [];
    if (!script.length) { this._to('submerge'); return; }
    const cur = script[this.step];
    this.level = cur.level;
    if (this.t * 1000 >= cur.ms) {
      this.step++;
      this.t = 0;
      if (this.step >= script.length) {
        this.level = CONFIG.HORACIO_BOSS.enterLevel;
        /* AND STRAIGHT INTO THE GROUND. The show is over, beat 3 begins:
           *"Ele entra de volta pra dentro do chão, vira fase de bolinha"*. He
           used to stop here, which is what *"he just stays in the middle of the
           map looking at the player"* was -- the placeholder, not a bug in the
           theatre. */
        this._to('submerge');
      }
    }
  }

  /**
   * Which of the eight drawings faces the player.
   *
   * ⚠️ THE MAP IS DATA, AND IT IS THE FIRST THING TO SUSPECT if he looks the
   * wrong way. `FACING_DEG` gives each drawing's direction with 0 pointing at
   * the camera and 90 pointing screen-RIGHT, read off the sheet by eye; the
   * telephone enemy in the main game had exactly this table mirrored and it
   * took a session to notice, because a creature facing the wrong way still
   * looks like a creature. Flip the sign of the 90/270 entries to correct it.
   */
  _faceToward(player) {
    if (!player) return;
    const C = CONFIG.HORACIO_BOSS;
    const degs = C.FACING_DEG || [0, 45, 90, 135, 180, 225, 270, 315];
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    /* ⚠️ `+dz` AND NOT `-dz`, AND THIS WAS THE BUG. z grows TOWARD the camera,
       so a player at a GREATER z is nearer the viewer and the drawing that
       faces them is the front one, 0 degrees. Negating it swapped exactly that
       axis and nothing else -- reported as *"when the player is above him, he
       looks down; when the player is below him, he looks up"*, which is the
       front/back pair inverted while left and right stayed correct.
       ⚠️ NOTE THE FAILURE WAS ON THE AXIS I DID NOT WARN ABOUT: the comment
       below still says to suspect the 90/270 entries, and the mistake was in
       the 0/180 ones. Suspect the whole table. */
    let want = Math.atan2(dx, dz) * 180 / Math.PI;
    if (want < 0) want += 360;
    let best = 0, bestD = 1e9;
    for (let i = 0; i < degs.length; i++) {
      let d = Math.abs(((degs[i] - want + 540) % 360) - 180);
      if (d < bestD) { bestD = d; best = i; }
    }
    this.facing = best;
  }

  // --- drawing -------------------------------------------------------------

  draw(ctx, assets, camX) {
    const d = this._packs(assets);
    if (!d) return;
    const C = CONFIG.HORACIO_BOSS;

    /* THE HURT DRAWING IS THE EXPOSED BODY. See the header: he is the one boss
       in this game with real art for being hit, so the state carries it and the
       blink is only the garnish. */
    const wasState = this.state;
    if (this.hurtT > 0 && this.phase !== 'emerge') this.state = 1;
    const f = this._frame(d);
    this.state = wasState;
    if (!f) return;

    const dsc = this.depthScale();
    const gx = this.groundX(camX);
    const gy = this.groundY();
    /* ⚠️ ONE TEXTURE PER LEVEL, so the frame says which. See manifest.js for
       why the pack is split at all. A level whose atlas has not loaded draws
       nothing rather than drawing out of the wrong sheet. */
    const img = assets.getDrawable('horacio' + (f.sheet || 0));
    if (!img) return;

    /* HOW FAR HE IS STILL IN THE GROUND. `Emerge.sunk` is 1 while buried and 0
       once he is out, and it is applied as a DOWNWARD OFFSET under a clip at
       the ground line -- which is what makes him come THROUGH the floor rather
       than fade in on top of it. */
    /* ⚠️ THE ARRIVAL OWNS THIS ONLY WHILE IT IS RUNNING (`sunkNow`). `Emerge`
       drives the dig up; every phase after it drives `_sunk` itself, and reading
       the dead arrival forever would pin him at 0 and delete the ball phase.
       The float is added HERE, to the drawn depth only -- see `_bob()`. */
    const sunk = Math.max(0, Math.min(1, this.sunkNow() + this._bob()));
    const h = f.h * dsc;

    ctx.save();
    if (sunk > 0) {
      ctx.beginPath();
      ctx.rect(0, 0, CONFIG.GAME_W, gy);
      ctx.clip();
    }
    let alpha = 1;
    if (this.hurtT > 0) {
      const period = (CONFIG.hurtBlinkMs || 60) / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.55 : 1;
    }
    if (this.dead) {
      const p = Math.min(1, this.dieT / ((C.dieMs || 900) / 1000));
      alpha *= 1 - p;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, f.x, f.y, f.w, f.h,
                  Math.round(gx - f.ax * dsc),
                  Math.round(gy - f.ay * dsc + sunk * h),
                  Math.round(f.w * dsc), Math.round(h));
    ctx.restore();

    /* THE HOLE AND THE DUST, drawn by the arrival itself. ⚠️ THE BOSS HAS TO DO
       THIS ITSELF: game.js's dust pass walks `crowd.list`, and a boss is not in
       the crowd -- it is `stage.boss`. A missing burst sheet costs the dust and
       nothing else, which is the standing rule for a borrowed asset here. */
    if (this.emerge) {
      this.emerge.draw(ctx, camX, dsc);
      const boom = assets.getDrawable('boom');
      if (boom && this.emerge.booming) {
        this.emerge.drawBoom(ctx, boom, camX, dsc);
      }
    }
  }
}
