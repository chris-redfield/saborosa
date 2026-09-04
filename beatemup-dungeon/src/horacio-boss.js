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
 *           4 armoured_hit . 5 exposed_hit . 6 naked_hit (level 0 only)
 *   FACING  8 drawn rotations, front / 45 / side / 135 / back and the mirrors
 *
 * ⚠️ AND THERE IS NOT ONE ANIMATION FRAME IN IT. No idle, no walk cycle, no
 * boil: every combination is a SINGLE drawing. So his motion is translation,
 * turning through the eight facings, and changing level or state -- never a
 * played row. Do not fake a cycle by alternating armoured/exposed; those are a
 * well body and a hurt one, and flipping between them reads as a bug.
 *
 * ⚠️ SO THE THREE `_hit` STATES ARE THE ONE EXCEPTION, AND THEY ARE NOT A ROW
 * EITHER. 4/5/6 are the RECOIL of bodies 0/1/3 -- eyes screwed shut, gritted
 * teeth -- and each is one drawing held for the length of `hurtT`, then
 * dropped. Not a cycle, an interruption: `_drawState` swaps the body out for
 * its recoil for the duration of the blink and puts it straight back.
 *
 * ⚠️ THERE IS NO RECOIL FOR THE BALL and there should not be: a tucked ball has
 * no face. He is punchable while balled -- the peek is the fight's one reliable
 * opening -- and there the blink alone says it, as it did everywhere before the
 * recoils arrived.
 *
 * ⚠️ WHICH IS ALSO WHY `hurt` HAS REAL ART HERE AND THE HORSE'S DOES NOT. TWO
 * kinds of it, and they say different things and must not be confused. The
 * DAMAGE TIER (exposed, then naked) is durable and reads as how far through the
 * fight he is; the RECOIL is 300ms and reads as *that punch*. `_bodyState`
 * answers the first, `_drawState` layers the second on top.
 *
 * THE FIGHT, as specified. All nine beats:
 *
 *   1. the screen stops, he comes out of the ground jumping, at level 1   BUILT
 *   2. the spike theatre, and the life bar appears                        BUILT
 *   3. back into the ground, becomes a ball, roams "looking for a place"  BUILT
 *   4. head out, looks around, submerges, surfaces somewhere else         BUILT
 *   5. he can travel horizontally while balled                            BUILT
 *   6. the CHARGE, in one of three z lanes, either direction              BUILT
 *   7. sometimes he surfaces and walks, or laughs                         HALF *
 *   8. he signals and a WALL of charutobis crosses the screen             BUILT
 *   9. he surfaces next to you and stabs with the spikes                  BUILT
 *
 *   * ONE MISSING DRAWING, DOWN FROM TWO. ⚠️ THE POINTING POSE ARRIVED
 *     2026-09-04 and beat 8 runs on the real gesture now -- seven
 *     `-especial-` masters, one per (level, body), picked off his health by
 *     `SUMMON_STATE`; see `_summon`. ⚠️ THE LAUGH IS STILL UNBUILT: 7's WALKING
 *     half exists because walking is translation, and the laugh is waiting on
 *     art that has not been drawn ("nao tem ele rindo").
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

    /* HE GOES UP RATHER THAN DOWN, like the other two bosses. Asked for
       2026-09-03: *"when he dies, he needs to blow up like the other bosses
       with lots of explosion animations"*.

       ⚠️ THE SAME `Booms` BOTH OTHERS USE, not a third copy. It was lifted out
       of horse-boss.js the day the Mosca wanted the same death, and everything
       that differs between the three -- how many, how far apart, how big -- is
       already config. So this is one field, one `arm()` and one `draw()`, and
       `CONFIG.HORACIO_BOSS.DEATH_BOOM` is the whole of his version.

       ⚠️ AND THE PATTERN IS ROLLED AT THE MOMENT OF DEATH, not per frame. That
       is `Booms`'s own rule and the most repeated mistake in this codebase's
       effects; it is stated here because the temptation is to arm it in `draw`
       where the sheet is, and `draw` runs sixty times a second. */
    this.booms = new Booms();

    /* HOW LONG HE STILL OWES THE FRONT POSE, in seconds -- see `_rise` and the
       facing block in `update`. 0 = he is looking wherever the fight says. */
    this._faceHoldT = 0;

    /* WHERE HE STARTED THE SURFACING FROM -- see `_rise`. Null means the phase
       has not begun; it is a captured value rather than a constant because he
       surfaces from the peek (0.55) and from a full roam (0.86) and the climb
       has to look the same length either way. */
    this._riseFrom = null;

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
   * ⚠️ `bodyLevel()`, NOT `this.level`. Below `nakedAt` the shell is off and he
   * IS the joaninha whatever the phase asked for -- see `bodyLevel`.
   *
   * ⚠️ THE FALLBACK IS NOT DEFENSIVE, IT IS THE DATA. Only level 0 has a naked
   * drawing -- a creature with no shell has no spike level -- so `index` holds
   * null at [level>0][3] and a blind lookup would draw nothing at all rather
   * than fail loudly. Falling back to armoured keeps a body on screen.
   */
  _frame(d, state) {
    const lv = d.index[this.bodyLevel()] || d.index[0];
    const st = (lv && lv[state != null ? state : this.state]) || lv[0];
    const id = st ? st[this.facing] : null;
    return (id == null) ? null : d.frames[id];
  }

  /**
   * WHICH DRAWING IS ON SCREEN THIS FRAME -- the whole resolution, in one place.
   *
   * Three things decide it and they are layered, not mixed:
   *
   *   his HEALTH  picks the body -- armoured / exposed / naked. `_bodyState`.
   *   the PHASE   owns `this.state`, and the only thing it really insists on is
   *               the BALL -- balled is a posture, not a wound. ⚠️ EXCEPT ONCE
   *               THE SHELL IS OFF: see below.
   *   the LAST PUNCH  swaps that body for its recoil while `hurtT` runs.
   *
   * ⚠️ THE NAKED BODY BEATS THE BALL, AND IT IS THE ONE PLACE THE HEALTH WINS.
   * Asked for 2026-09-04: *"when he is doing the ball attack, or submerged, do
   * not use the sprites from F3, because they have the helmet. For this stage,
   * just use his regular sprites."* Every ball drawing in the pack -- including
   * the joaninha's -- is a body tucked INTO its shell, so at the tier whose
   * whole point is that the shell is gone the ball puts it straight back on.
   *
   * ⚠️ WRITTEN AS `st !== 3` RATHER THAN AS `_shellGone()`, AND THAT MATTERS.
   * The test is "did a naked drawing actually come out of `_bodyState`", not
   * "is his health low" -- so if the tier is ever turned off at the level he is
   * in (`nakedLevel: null`, or a re-cut that loses the frame) `_bodyState`
   * falls back to the EXPOSED body and the ball correctly wins again. Gating on
   * the health would have drawn him standing up mid-charge with no naked art to
   * show for it.
   *
   * ⚠️ IT RESOLVES AT DRAW TIME AND WRITES NOTHING BACK. It used to be done by
   * assigning `this.state`, drawing, and assigning it back -- which worked, and
   * meant every phase had a field that was true for one statement in a method
   * it does not call. Anything reading `state` between those two lines saw a
   * value no phase had set.
   *
   * ⚠️ AND THE RECOIL IS CHECKED AGAINST THE DATA BEFORE IT IS USED. There is no
   * hit ball at any level and no hit naked above level 0, so the lookup falls
   * back to the body it was going to draw anyway rather than to a blank.
   */
  _drawState(d) {
    let st = this._bodyState(d);
    if (this.state === 2 && st !== 3) st = 2;
    else if (this.state === HoracioBoss.SUMMON) {
      /* ⚠️ MAPPED THROUGH THE BODY, NOT SUBSTITUTED FOR IT. The summon is a
         pose, so a wounded HORACIO must summon in his wounded body -- exactly
         what `HIT_STATE` does for the recoil, and the reason both are tables
         rather than constants. Checked against the data first: level 3 has no
         summon drawing at all and no level has a summoning ball, so a blind
         lookup would draw nothing where the fallback draws the ordinary body
         and merely loses the gesture. */
      const su = HoracioBoss.SUMMON_STATE[st];
      const lv = d.index[this.bodyLevel()];
      if (su != null && lv && lv[su] && lv[su][this.facing] != null) st = su;
    }
    if (!this._recoiling()) return st;
    const hit = HoracioBoss.HIT_STATE[st];
    if (hit == null) return st;
    const lv = d.index[this.bodyLevel()];
    return (lv && lv[hit] && lv[hit][this.facing] != null) ? hit : st;
  }

  /**
   * IS HE STILL WEARING THE FACE HE MADE WHEN THE PUNCH LANDED?
   *
   * ⚠️ OFF `hurtT`, WHICH COUNTS DOWN, so the elapsed time is `hurtMs` minus
   * what is left -- getting that backwards holds the pose for everything BUT
   * the moment of the hit. `hitPoseMs: null` means "as long as the blink", the
   * default and the honest one: the recoil and the flicker then say the same
   * thing over the same 300ms instead of two overlapping windows. A number here
   * shortens (or lengthens) the pose alone.
   *
   * ⚠️ IT RUNS THROUGH THE FIRST 300ms OF HIS DEATH, deliberately, and that is
   * the opposite of what the blink does. `hurtT` is set by the killing blow
   * like any other and keeps ticking while `dead`; the blink is suppressed
   * there because two flickers on different beats over one body is noise, and a
   * held grimace under the death flash is not a flicker at all -- it is the
   * blow that did it, still on his face.
   */
  _recoiling() {
    if (this.hurtT <= 0) return false;
    const ms = CONFIG.HORACIO_BOSS.hitPoseMs;
    if (ms == null) return true;
    return ((CONFIG.hurtMs || 300) - this.hurtT * 1000) < ms;
  }

  // --- the shared boss interface -------------------------------------------

  /** Has he finished arriving? The life bar is gated on this -- see hud.js. */
  arrived() { return this.phase !== 'emerge'; }

  /**
   * WHICH BODY HIS HEALTH PUTS HIM IN.
   *
   * Asked for 2026-09-02: *"When he has full health, he has the red armor.
   * After he is at less than half the HP, he has the almost full armor, the one
   * that is not completely red. And when his HP is near 0, he should use the
   * other one with almost no armor?"*
   *
   * ⚠️ THE THIRD TIER IS ONLY HALF PRESENT IN THE ART, and this is the honest
   * report rather than a silent substitution. Every spike level has TWO bodies:
   *
   *     armoured  the red shell over a red body        -- full health
   *     exposed   the red shell over a BEIGE body      -- under `hurtAt`
   *
   * The third, `naked` -- the beige creature with NO shell at all -- was drawn
   * for the JOANINHA ONLY (master 001). Levels 1, 2 and 3 have no naked
   * drawing, because a creature with no shell has no spike level.
   *
   * ⚠️ THE TIER IS NOW ON (`nakedAt: 0.25`) AND THE LOOK DECISION IS MADE --
   * asked for 2026-09-03: *"this file is supposed to be used when the boss has
   * 25% or less of HP"*. Of the two ways out this note used to list, the naked
   * body was never going to be DRAWN for the other three levels, so the other
   * one is what shipped: **HE DROPS TO LEVEL 0 AT THAT THRESHOLD, so losing the
   * last of his health IS losing his spikes.** That is `bodyLevel()`, and
   * without it this tier could not appear at all -- `index[level>0][3]` is null,
   * so turning `nakedAt` on by itself would have fallen straight back to the
   * armoured body and looked like a knob that does nothing. This project's own
   * recurring trap, one layer up from the `||` version below.
   *
   * ⚠️ AND THIS REPLACED `hurt` AS THE USER OF THE EXPOSED DRAWING. It used to
   * flash on `hurtT`, which read as him flickering between well and wounded
   * several times a second. The hit is now said by the BLINK alone (see `draw`)
   * and the exposed body means something durable instead.
   */
  _bodyState(d) {
    const C = CONFIG.HORACIO_BOSS;
    const f = this.maxHp ? this.hp / this.maxHp : 1;
    if (f > (C.hurtAt != null ? C.hurtAt : 0.5)) return 0;
    if (this._shellGone()) {
      /* STILL GUARDED, EVEN THOUGH `bodyLevel()` HAS ALREADY PUT HIM SOMEWHERE
         THE DRAWING EXISTS. `nakedLevel` is a knob and a future value of it --
         or a re-cut that loses the frame -- must fall back to the exposed body
         rather than to a blank. Cheap, and it is the check that would have
         caught the null index the first time. */
      const lv = d.index[this.bodyLevel()];
      if (lv && lv[3] && lv[3][this.facing] != null) return 3;
    }
    return 1;
  }

  /**
   * IS THE SHELL OFF? The bottom damage tier, as one predicate, because THREE
   * things ask it now -- the drawing (`_bodyState`), the level he wears
   * (`bodyLevel`) and through that his size and hurtbox (`sizePx`) -- and they
   * have to agree on the same frame or he is drawn as one body and punched as
   * another.
   *
   * ⚠️ `nakedAt: null` MEANS OFF, AND IT IS READ THAT WAY EXPLICITLY. Written
   * as `C.nakedAt != null ? C.nakedAt : 0.25` -- which is how the rest of this
   * file reads its defaults -- switching the tier off by setting it to null
   * would fall through to the default and leave the feature running. That is
   * this project's own recurring trap: a knob set to a disabling value that
   * does nothing, because the READ SITE has a `||` behind it. Off is checked
   * before any default is applied.
   */
  _shellGone() {
    const C = CONFIG.HORACIO_BOSS;
    if (C.nakedAt == null) return false;
    return (this.maxHp ? this.hp / this.maxHp : 1) <= C.nakedAt;
  }

  /**
   * THE LEVEL HIS BODY IS IN, as opposed to the one the FIGHT put him in.
   *
   * `this.level` is the phase's business -- the theatre walks it 0/3/0/3/1 and
   * the stab pops him to the grandao -- and for the whole fight above 25% the
   * two are the same value. Below it they part: the shell is gone, and a
   * creature with no shell has no spike level, so he is the joaninha (0) no
   * matter what the phase asked for. THE ART SAYS THIS, it is not a taste call:
   * master 001 is the only one with an F4.
   *
   * ⚠️ SO THE STAB LOSES ITS SPIKES DOWN HERE. Beat 9 sets level 3 "because the
   * grandao does the stabbing" and at low health it will draw as the naked
   * joaninha lunging. That is the honest read of losing your armour and it is
   * what `nakedLevel` is for -- set it to null and the tier goes inert again
   * rather than half-applying.
   *
   * ⚠️ AND `sizePx()` GOES THROUGH HERE TOO, WHICH IS THE POINT. The joaninha
   * is 324 tall against level 1's 354, and a body that shrinks on screen while
   * its hurtbox stays the old size is the bug where punches connect with air
   * beside him. One resolver, both users.
   */
  bodyLevel() {
    const C = CONFIG.HORACIO_BOSS;
    if (C.nakedLevel != null && this._shellGone()) return C.nakedLevel;
    return this.level;
  }

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
  scenPlane(scenery) {
    if (!scenery || !scenery.bands) return null;
    /* ⚠️ BY DEPTH, NOT DEALT AT RANDOM, AND THE RANDOM VERSION WAS THE BUG. A
       digger gets a random seam because it is BURIED while it uses one -- which
       of them it comes up through is variety, and nothing of it is visible
       enough for the depth to matter. HORACIO is the opposite: he rolls across
       the room in the open at a lane he chose, so the plane has to be where he
       actually IS. Dealt at random it put him at the far lane with only the
       NEAREST band over him, whose mounds are at the bottom of the screen and
       never touched him -- *"it looks like he is on top of all cigarette
       layers"*, while the sunken states looked right because the clip was doing
       the work instead.

       ⚠️ AND IT IS RE-ASKED EVERY FRAME rather than cached: his z changes when
       he picks a charge lane and when he surfaces at the player's depth, and a
       plane cached from the last time he went under is a plane for a depth he
       has since left. It is a comparison against `bands` numbers, so there is
       nothing to save. */
    if (scenery.planeForZ) {
      const p = scenery.planeForZ(this.z);
      if (p != null) return p;
    }
    return Math.max(1, scenery.bands - 1);
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
    /* ⚠️ `bodyLevel()`. The hurtbox has to measure the body that is DRAWN, and
       below `nakedAt` that is the joaninha whatever the phase set. */
    return (C.sizeByLevel && C.sizeByLevel[this.bodyLevel()]) || C.sizePx;
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
      /* ⚠️ ARMED HERE, ON THE BLOW, AND NOWHERE ELSE. `Booms.arm` rolls the
         scatter once and stores it; calling it from `draw` would re-roll it
         every frame, which is not an explosion, it is static. `sizePx()` and
         not `CONFIG.sizePx` so the spread follows whichever body he died in --
         he can die as the joaninha mid-theatre or as the grandao mid-stab, and
         a fixed reference would scatter a 449px body's blasts across a 324px
         one. */
      this.booms.arm(CONFIG.HORACIO_BOSS.DEATH_BOOM, this.sizePx());
      /* ⚠️ AND THE HOP IS ABANDONED. He can be killed mid-`_rise`, and `jumpY`
         is only ever zeroed by the phase that raised it -- a corpse left in the
         air explodes a body-height above the ground. Same family as every other
         bug in this file: a thing left running after the state that owned it. */
      this.jumpY = 0;
      this._riseFrom = null;
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
         player along the charge rather than into it.

         ⚠️ AND IT IS NOT `halfZ()`, WHICH IS WHAT IT WAS UNTIL 2026-09-03:
         *"when he is doing the ball attack like charging, the collisions are
         wrong, they are too low for his helmet position."* Measured off the
         drawing rather than argued about -- at level 1, with `CHARGE.sunk`
         applied, the ball's ink runs from 234px ABOVE his ground point down to
         48px below it, and its widest row (the equator, under the helmet) is
         116px above. `halfZ()` is 26. So the live box was a 52px band around his
         FEET, sitting entirely under a ball 280px tall: the player was hit by
         the floor beneath him and walked through the helmet untouched.

         ⚠️ IT GROWS UPWARD AND KEEPS ITS FLOOR, which is the whole shape of the
         fix. Extending the top can only ADD contacts, so nothing that connected
         before stops connecting; centring the box on the helmet instead would
         have moved it off the ground line entirely, and at the BACK lane (z 68)
         a box centred 116px above that is at z -48, off the belt, unreachable by
         any player -- a charge that could never hit anyone. **A box on a belt is
         a depth, and a sprite's height is not depth.**

         ⚠️ SO THE NUMBERS ARE FRACTIONS OF `sizePx()`, NOT PIXELS, and they are
         read off the ball's MASS rather than its silhouette: the rows at least
         half as wide as the equator span 199px above the ground point to 33px
         below it, which is the sphere without the outermost spike tips. Taking
         the tips too (0.66 up) is defensible and is a bigger box; it is a look
         call and this is the conservative half of it. ⚠️ THEY SCALE WITH HIM
         because `sizePx()` does -- he charges at `enterLevel` today, but the
         grandao would want a bigger box and would get one. */
      const hw = this.halfW();
      const sz = this.sizePx();
      const up = sz * (C.CHARGE.hitUpRel != null ? C.CHARGE.hitUpRel : 0.562);
      const down = sz * (C.CHARGE.hitDownRel != null ? C.CHARGE.hitDownRel : 0.093);
      return { x0: this.x - hw, x1: this.x + hw,
               z0: this.z - up, z1: this.z + down,
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

  /**
   * ⚠️ THIS WAITS FOR THE WHOLE DEATH, NOT FOR `dead`, and with the blasts in it
   * that is load-bearing rather than tidy. The room advances on this, and
   * advancing while a blast is still alight cuts it off mid-frame -- the same
   * failure that once hung the horse's corpse in mid-air through its outro.
   * `dieMs` has to cover `Booms.spanMs(DEATH_BOOM)`; the note on it in config
   * carries the sum and the warning to redo it.
   */
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
    /* ⚠️ AND THE FRONT POSE OUTLASTS THE JUMP. Reported 2026-09-03: *"when he
       jumps, it works, he is looking forward, BUT for very small time, right
       afterwards he already looks at the player."* Holding it only for the
       `rise` phase meant `_faceToward` took the facing back on the very frame he
       landed, so the pose the player was meant to read was over the moment the
       movement was. `RISE.holdMs` buys the landing its own beat.

       ⚠️ IT IS A DEBT CARRIED ACROSS THE PHASE CHANGE, not a longer rise. The
       rise has to end when the MOVEMENT ends -- stab, summon and walk all start
       their own clocks from it -- so padding `surfaceMs` would have left him
       hanging in the air instead. This is the facing alone outliving the phase
       that set it.

       ⚠️ AND IT IS SAFE ON THE STAB, WHICH LOOKS LIKE IT SHOULD NOT BE: that
       attack's box is `x +/- reachX`, symmetric, so it reaches both ways
       whatever he is facing. The facing there is cosmetic. If a directional
       attack is ever added after a rise, THIS is the thing to check first. */
    if (this._faceHoldT > 0) {
      this._faceHoldT -= dt;
      this.facing = (CONFIG.HORACIO_BOSS.outFacing != null)
        ? CONFIG.HORACIO_BOSS.outFacing : 0;
    } else if (this.phase !== 'emerge' && this.phase !== 'theatre') {
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
    if (this.phase === 'summon') return this._summon(dt, bounds);
    if (this.phase === 'walk') return this._walk(dt, player, bounds);
  }

  /**
   * Beat 8. *"ele faz um sinal com a mãozinha e sai varios charutobis te
   * atacando, uma wave que atravessa a tela, que voce tem que pular por cima. o
   * socar um e fugir. A ideia é ter um muro de charutobis, um ataque bomba."*
   *
   * ⚠️ HE DOES NOT SPAWN THEM HIMSELF. A boss is `stage.boss` and has no crowd
   * to add to -- the same reason his dust and his scenery plane had to be
   * handed out rather than drawn from inside. He raises a REQUEST and stage.js
   * performs it, so the one place that knows how to put an enemy in the world
   * stays the one place that does it.
   *
   * ⚠️ THE POINTING DRAWING LANDED 2026-09-04 and the stand-in is gone. Asked
   * for as *"use the frame we have been using right now (facing front), then add
   * this new frame, then hold this new frame for 1 second, then go back to
   * whatever he did afterwards"* -- so the beat is two poses, not one:
   *
   *     0 .. signalMs      `signalState` -- the ordinary front body, winding up
   *     signalMs           the arm goes up AND the wall leaves, on one beat
   *     .. + recoverMs     he holds the summon pose (600ms, was asked at 1s
   *                        and cut to 0.6 once it could be seen)
   *     then               submerge, as before
   *
   * ⚠️ THE POSE IS NOT `signalState`'S REPLACEMENT, IT IS WHAT FOLLOWS IT. The
   * old note here said the drawing would "replace signalState and nothing else
   * changes"; it does not, because the ask was for the gesture to be a CHANGE
   * the eye can catch. A pose held from the first frame of the phase is a
   * different beat from an arm that goes up.
   *
   * ⚠️ AND `state` HOLDS A MARKER, NOT THE DRAWING. `_drawState` maps it onto
   * whichever body his health has him in, so a wounded HORACIO summons in his
   * wounded body and a level with no summon art keeps the ordinary one.
   */
  _summon(dt, bounds) {
    const S = CONFIG.HORACIO_BOSS.SUMMON;
    const signalMs = (S.signalMs != null) ? S.signalMs : 420;
    const raised = this.t * 1000 >= signalMs;
    this.state = raised ? HoracioBoss.SUMMON
                        : ((S.signalState != null) ? S.signalState : 0);
    this.facing = (S.signalFacing != null) ? S.signalFacing : 0;
    this._sunk = 0;
    /* THE WAVE LEAVES ON THE SIGNAL'S BEAT, not on the phase's first frame, so
       the gesture reads as causing it -- and now the gesture IS the beat, since
       the arm goes up on the same tick. Raised once -- `_summonReq` is cleared
       by whoever takes it. */
    if (!this._summonSent && raised) {
      this._summonSent = true;
      const lim = this._limits(bounds);
      const dir = (this._player && this._player.x < this.x) ? -1 : 1;
      this._summonReq = {
        kind: S.kind || 'charutobi',
        count: S.count || 7,
        dir,
        /* THE WALL SPANS THE BELT. They are spread across z, which is what
           makes it a wall rather than a queue -- a line of them at one depth is
           something you walk around. */
        z0: Belt.depth * (S.zFrom != null ? S.zFrom : 0.12),
        z1: Belt.depth * (S.zTo != null ? S.zTo : 0.95),
        fromX: dir > 0 ? lim.lo - (S.offscreenPx || 260)
                       : lim.hi + (S.offscreenPx || 260),
        endX: dir > 0 ? lim.hi + (S.offscreenPx || 260)
                      : lim.lo - (S.offscreenPx || 260),
        /* null = "whatever speed he chases you at" -- resolved in enemy.js off
           his own SUICIDE_RUSH entry, not duplicated here. */
        speed: (S.speed != null) ? S.speed : null,
        clearY: S.clearY || 40,
        triggerX: S.triggerX, triggerZ: S.triggerZ,
        jitterZ: Belt.depth * (S.jitterZRel || 0),
        jitterX: S.jitterXPx || 0,
        stagger: S.staggerMs || 0,
      };
    }
    if (this.t * 1000 >= signalMs + (S.recoverMs != null ? S.recoverMs : 600)) {
      this._to('submerge');
    }
  }

  /**
   * Hand the pending wave to whoever can spawn it, once. ⚠️ TAKE-AND-CLEAR
   * rather than a flag someone else resets: a request that survived being read
   * would spawn a wall every frame until the phase ended.
   */
  takeSummon() {
    const r = this._summonReq;
    this._summonReq = null;
    return r;
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

  /**
   * Beats 7 and 9's opening: he comes all the way out -- AND JUMPS OUT, since
   * 2026-09-03. *"when he leaves the ground, he is just popping out, we want him
   * to leave like the other enemies, like giving a little jump outside of the
   * ground... only when he is like leaving entirely from the ground and standing
   * after."*
   *
   * ⚠️ THIS PHASE IS THE WHOLE OF "LEAVING ENTIRELY", WHICH IS WHY THE HOP GOES
   * HERE AND NOWHERE ELSE. Every other time he changes depth he is staying in
   * the ground: the peek stops at `peekSunk` with his head out, the roam holds
   * `roamSunk`, and the charge holds `CHARGE.sunk` for its whole crossing. This
   * is the only phase that ends with him standing on the floor, and its three
   * exits (stab, summon, walk) are exactly the "standing after" in the ask.
   *
   * ⚠️ IT IS THE SAME SHAPE AS `Emerge`'s, NOT THE SAME CODE, and that is a
   * deliberate exception to how his ARRIVAL was built. Beat 1 reuses `Emerge`
   * outright because it is a digger coming out of a hole; this is a body already
   * halfway out of the floor moving the rest of the way, with no hole to open,
   * no heave and no dust. What it borrows is the part that matters -- the split
   * (`clearAt`), the stepped movement and the sine arc -- so the two hops read
   * as one creature doing one thing twice, and `RISE.steps` defaults to
   * `EMERGE.steps` rather than repeating the number.
   *
   * ⚠️ THE TWO HALVES SPLIT ONE DURATION, THEY DO NOT ADD ONE -- `Emerge`'s rule
   * and it holds here for a different reason. He must be OUT before he is in the
   * air: run the climb and then a hop with its own clock, and the arc starts
   * from a body still sunk in the floor, which reads as him being winched.
   *
   * ⚠️ AND HE UNBALLS AT THE START, NOT AT THE END. This used to hold the ball
   * for the whole climb and flip to the standing body on the last frame -- a
   * change of body at the one moment he is fully visible, which is the loudest
   * possible place to put it and is half of what "just popping out" was. Coming
   * up as the body he is going to be leaves nothing to pop. `RISE.unballAtStart:
   * false` restores the old order.
   */
  _rise(dt, player) {
    const B = CONFIG.HORACIO_BOSS.BALL;
    const R = CONFIG.HORACIO_BOSS.RISE || {};
    /* ⚠️ CAPTURED, NOT ASSUMED TO BE 1. He surfaces from the peek (0.55) and,
       if the peek is ever skipped, from a full roam (0.86) -- easing from a
       constant would make one of the two start with a jump. */
    if (this._riseFrom == null) {
      this._riseFrom = this._sunk;
      if (R.unballAtStart !== false) this.state = 0;
    }
    /* ⚠️ HE COMES OUT FACING THE CAMERA, and this is written every frame rather
       than once on entry because `update` calls `_faceToward(player)` before it
       dispatches to this phase. Setting it once would be overwritten on the very
       next frame -- which is exactly the bug the theatre hit ("he played the
       whole thing in profile"), and the reason `_summon` sets its pose here too.

       Asked for 2026-09-03: *"he should always spawn (jump from the ground)
       looking to the front... right now he spawns looking to the front when he
       is calling the charutobis, so copy that behavior."* So it is literally the
       summon's value, `outFacing`.

       ⚠️ AND IT OUTLASTS THE PHASE BY `RISE.holdMs`. It used to end on the frame
       he landed -- *"he is looking forward, BUT for very small time, right
       afterwards he already looks at the player"* -- because `_faceToward` runs
       for every phase but the emerge and the theatre. The debt is paid down in
       `update`; see the note there. */
    this.facing = (CONFIG.HORACIO_BOSS.outFacing != null)
      ? CONFIG.HORACIO_BOSS.outFacing : 0;
    const ms = Math.max(1, B.surfaceMs || 560);
    let u = Math.min(1, (this.t * 1000) / ms);
    /* THE SAME QUANTISER THE MOOKS CLIMB ON. He owns no animation frames at all,
       so -- exactly as with a digger holding one drawing -- the MOVEMENT is the
       only thing there is to make choppy. ⚠️ The last step has to land on 1: a
       hop that stops a frame short leaves him permanently a few px in the air.
       0 or 1 = smooth. */
    const steps = R.steps != null ? R.steps
                : ((CONFIG.EMERGE && CONFIG.EMERGE.steps) || 0);
    if (steps > 1) u = Math.round(u * (steps - 1)) / (steps - 1);

    const c = Math.min(0.95, Math.max(0.05, R.clearAt != null ? R.clearAt : 0.55));
    if (u < c) {
      /* Coming through the floor. `jumpY` stays 0 -- the clip is at `groundY()`
         and lifting him here would raise the floor line with him. */
      this._sunk = this._riseFrom * (1 - u / c);
      this.jumpY = 0;
    } else {
      /* Airborne. One sine, so there is no hang at the top -- `Emerge`'s curve
         and its reason. Scaled by depth like everything else he does, so a hop
         at the back of the belt is not a near one drawn small. */
      this._sunk = 0;
      const k = (u - c) / (1 - c);
      this.jumpY = Math.sin(Math.PI * k)
                 * (R.hopPx != null ? R.hopPx : 67) * this.depthScale();
    }

    if (u >= 1) {
      this.jumpY = 0;
      this._sunk = 0;
      this.state = 0;                  // armoured again -- the shell reopens
      this._riseFrom = null;
      /* ...and he keeps looking at the camera for a moment after landing. See
         the facing block in `update` for why this is a debt rather than a
         longer phase. */
      this._faceHoldT = (R.holdMs != null ? R.holdMs : 500) / 1000;
      this._to(this.next === 'stab' ? 'stab'
             : this.next === 'summon' ? 'summon' : 'walk');
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
    const w = C.WEIGHTS || { charge: 0.4, stab: 0.22, summon: 0.22, walk: 0.16 };
    this.next = (r < w.charge) ? 'charge'
              : (r < w.charge + w.stab) ? 'stab'
              : (r < w.charge + w.stab + w.summon) ? 'summon' : 'walk';
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
    if (this.next === 'summon') {
      this._summonSent = false;
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
    /* ⚠️ FRONT, NOT SIDE-ON AT THE PLAYER, SINCE 2026-09-03. This used to be
       `(player && player.x < this.x) ? 6 : 2` -- "he comes up facing whoever he
       came up at" -- and it was the other half of *"he is only spawning to his
       side."* It also meant his very first appearance turned through 90 degrees
       the instant the arrival finished, because the theatre sets the front pose
       below: a snap that nobody had reported but that this removes for free.
       One rule for both ways he leaves the ground -- see `outFacing`. */
    this.facing = (CONFIG.HORACIO_BOSS.outFacing != null)
      ? CONFIG.HORACIO_BOSS.outFacing : 0;
    if (this.emerge.done) {
      this.emerge = null;
      /* ⚠️ HAND THE DEPTH OVER, AND FORGETTING THIS MADE HIM VANISH. `_sunk`
         starts at 1 and `Emerge` drives the arrival through its OWN value, so
         the frame the arrival was dropped `sunkNow()` fell back to a `_sunk`
         nobody had ever written -- still 1, fully buried. He appeared, finished
         his theatre, and then blinked out of existence mid-screen, coming back
         later already sunken: *"he just vanishes... that is ugly"*. The comment
         in `draw` said the arrival owns the value "only while it is running"; it
         did not say who takes it afterwards, which is the whole bug. He is OUT
         when the arrival finishes, so it is 0, and every sink after this is an
         eased phase rather than a jump. */
      this._sunk = 0;
      /* ...and holds the front for the show. Written even though the arrival
         already leaves him there: the theatre is performed AT THE CAMERA and
         that is its own requirement, not a side effect of how he arrived. */
      this.facing = 0;
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

    /* THE DRAWING IS THE PHASE, THE HEALTH AND THE LAST PUNCH TOGETHER, and all
       three are resolved here at the last moment so that no phase has to
       remember any of them -- see `_drawState`. */
    const f = this._frame(d, this._drawState(d));

    const dsc = this.depthScale();
    const gx = this.groundX(camX);
    const gy = this.groundY();
    /* ⚠️ ONE TEXTURE PER LEVEL, so the frame says which. See manifest.js for
       why the pack is split at all. A level whose atlas has not loaded draws
       nothing rather than drawing out of the wrong sheet. */
    const img = f ? assets.getDrawable('horacio' + (f.sheet || 0)) : null;

    /* ⚠️ THE TWO `return`s THAT USED TO BE HERE ARE NOW A GUARD ROUND THE BODY,
       AND THAT IS BECAUSE OF THE DEATH BLASTS. A missing frame or an unloaded
       atlas used to abandon the whole method, which was harmless while the body
       was the only thing it drew -- and would now take the explosions with it,
       so a boss whose art hiccupped on the frame he died would simply vanish.
       Same correction `Emerge.draw` needed the day it gained the dust: **an
       effect that outlives the thing it happens to has to re-read every early
       return above it.** */
    if (f && img) this._drawBody(ctx, f, img, dsc, gx, gy);

    /* THE HOLE, and only the hole. It is a mark on the FLOOR and belongs under
       everything, in his own plane -- which is where this method is drawn from
       whenever he is in the ground. ⚠️ THE DUST THAT COMES OUT OF IT IS NOT
       HERE ANY MORE; see `drawFX`. */
    if (this.emerge) this.emerge.draw(ctx, camX, dsc);
  }

  /**
   * HIS EXPLOSIONS -- the arrival's dust and the death's string -- drawn in
   * their own pass, over the floor.
   *
   * ⚠️ THEY CANNOT LIVE IN `draw()`, AND THIS IS THE BUG THAT MOVED THEM
   * (2026-09-03). Whenever he is in the ground `behindScenery()` is true and
   * game.js paints him BETWEEN two bands of the cigarette floor -- that
   * injection is what makes him look like he is coming through it. Anything
   * drawn from inside `draw()` inherits that plane, so his arrival dust was
   * being painted under the mounds, and the death blasts would have been too:
   * he is killed at the PEEK more often than anywhere else (it is the fight's
   * one reliable opening, at `peekSunk` 0.55), which is exactly the state that
   * buries them. **A body under the floor is the effect; an explosion under the
   * floor is a bug** -- the identical correction `Emerge.drawBoom` needed on
   * 2026-09-01, for the identical reason, one level up.
   *
   * ⚠️ THE HOLE STAYS BEHIND. It is a mark on the floor and belongs under the
   * mounds; only the things in the AIR move out. Same split as the mooks'.
   *
   * ⚠️ AND game.js CALLS THIS LAST, after the whole entity pass, rather than in
   * the diggers' dust pass. That pass anchors its effects to the PLAYER's slot
   * in the z sort, which works for a digger because a digger is always behind
   * the floor; HE IS DRAWN FROM TWO DIFFERENT PASSES depending on his depth, so
   * any fixed slot leaves one of the two cases with his own body painted over
   * his own explosions.
   *
   * ⚠️ AND IT IS OUTSIDE THE GROUND CLIP `draw()` SETS, which is the second half
   * of the same problem: blasts inside that scissor would be cut off at the
   * floor line they are supposed to be blowing apart.
   *
   * ⚠️ THE DEATH STRING RUNS ON `dieT`, THE SAME CLOCK `finished()` READS, so
   * the fade, the blasts and the room advancing cannot drift apart when `dieMs`
   * is retuned. A missing sheet costs the effect and nothing else.
   */
  drawFX(ctx, assets, camX) {
    const img = assets && assets.getDrawable('boom');
    if (!img) return;
    const dsc = this.depthScale();
    if (this.emerge && this.emerge.booming) {
      this.emerge.drawBoom(ctx, img, camX, dsc);
    }
    if (this.dead && this.booms.armed) {
      this.booms.draw(ctx, img, this.groundX(camX), this.groundY(), this.dieT);
    }
  }

  /**
   * THE FUSE: the red flash between his health hitting 0 and the first blast.
   *
   * Asked for 2026-09-03: *"before he dies, when his HP reaches 0, make him blow
   * up like the charutobi, so make him flash red, and them he blows up with the
   * several explosions."*
   *
   * ⚠️ IT IS THE CHARUTOBI'S BLINK, NOT A NEW ONE -- the same filter string
   * (which is the bomb's panic red), the same 40ms rate, the same ONE BEAT LIT
   * IN THREE. Copied rather than aliased for the reason his own note gives:
   * these are different objects that want the same colour today, and sharing a
   * constant would tie this death to a future retune of the bomb.
   *
   * ⚠️ AND IT IS ONLY THE TINT, BECAUSE HE HAS NOTHING TO TREMBLE WITH. The
   * charutobi's shudder is two things -- a red flash AND two borrowed drawings
   * swapped on the same beat. There is not one animation frame anywhere in
   * HORACIO's pack, so the drawing half has nothing to play; faking it by
   * alternating armoured and exposed would flip between a well body and a
   * wounded one, which this file's header already forbids. **Take the half of a
   * borrowed effect the art can support, and do not invent the other half.**
   *
   * ⚠️ ITS LENGTH IS `DEATH_BOOM.startMs`, ASKED RATHER THAN TYPED. The flash
   * runs until the first blast fires, which is what "and then he blows up"
   * means; a second number would be a second thing to keep in step, and the two
   * drifting apart is either a silent gap of a dead boss standing still or a
   * flash that carries on through his own explosion.
   */
  _fuseTint() {
    if (!this.dead) return null;
    const C = CONFIG.HORACIO_BOSS;
    const B = C.DEATH_BOOM, F = C.DEATH_FUSE;
    if (!F || !F.tint || !B || !B.on) return null;
    const until = (B.startMs || 0) / 1000;
    if (until <= 0 || this.dieT >= until) return null;
    const ms = F.ms || 40;
    const lit = (this.dieT * 1000) % (ms * 3) < ms;
    return lit ? { tint: F.tint,
                   tintAlpha: F.tintAlpha != null ? F.tintAlpha : 0.85 } : null;
  }

  /**
   * WHEN THE BODY IS TAKEN AWAY, in seconds from the death. `Infinity` with the
   * blasts off, which leaves the plain fade in `_drawBody` as the only death.
   *
   * ⚠️ THE DEFAULT IS "WHEN THE LAST BLAST STARTS", ASKED RATHER THAN TYPED.
   * *"let him be there during the explosion, but then he vanishes."* By that
   * frame every blast in the string is alight and the earliest ones are near
   * their widest, so the screen where he is standing is full of explosion -- he
   * goes UNDER the detonation and it is gone before it is, which is the shape
   * the ask describes. Deriving it from `startMs`, `count` and `everyMs` means
   * retuning the string moves the vanish with it instead of stranding it at a
   * time that used to be the peak.
   *
   * ⚠️ A RAW `vanishAt` IN MS STILL WINS -- the `atFrame`-vs-`atMs` bargain this
   * file makes everywhere. Later than this and he stands in the thinning tail;
   * earlier and he is gone before the explosion has grown enough to hide him,
   * which is the failure that produced this method.
   */
  _vanishAtS() {
    const B = CONFIG.HORACIO_BOSS.DEATH_BOOM;
    if (!B || !B.on) return Infinity;
    const ms = (B.vanishAt != null)
      ? B.vanishAt
      : (B.startMs || 0) + Math.max(0, (B.count || 7) - 1) * (B.everyMs || 180);
    return ms / 1000;
  }

  /**
   * The body itself. Split out of `draw` on 2026-09-03 so that a missing frame
   * cannot skip the death blasts -- it has no other reason to exist and nothing
   * else calls it.
   */
  _drawBody(ctx, f, img, dsc, gx, gy) {
    const C = CONFIG.HORACIO_BOSS;
    const B = C.DEATH_BOOM;

    /* ⚠️ HE IS NOT DRAWN AT ALL PAST `vanishAtS()` -- no fade, no strobe, he is
       simply not there. Asked for 2026-09-03: *"remove the stroboscopic thing,
       but also remove the fading, we want it to look like he is blowing up, and
       we haven't achieved that effect, can you make him blow and vanish at
       once?"*

       ⚠️ AND THE MOMENT IS NOT `startMs`, WHICH IS WHERE IT WENT FIRST. Removing
       him on the frame the first blast FIRES was reported straight back: *"its
       vanishing too fast now, even before the explosion effects, let him be
       there during the explosion, but then he vanishes."* The reason it read
       that way is in the sheet: `BOOM_RECTS` frame 0 is the blast still GROWING,
       barely wider than nothing, so at `startMs` there is a boss one frame and a
       spark the next, with the explosion arriving after he has already gone.
       **An explosion has to cover a thing before it can replace it.** See
       `_vanishAtS`.

       ⚠️ BOTH OF THE THINGS THIS REPLACES ARE DELETED RATHER THAN SWITCHED OFF,
       which is what this project does with a look that was refused (see the
       emerge rim, the film filter). There is no `fadeMs` and no `fadeStrobeMs`
       any more: a linear ramp made him a ghost, and a shrinking duty made him a
       ghost with a flicker. **Neither is an explosion, because an explosion does
       not make a body TRANSPARENT -- it replaces it.**

       ⚠️ WITH THE BLASTS OFF (`DEATH_BOOM.on: false`) the plain fade over
       `dieMs` is still down below -- that is the death this had before any of
       this, and it is one flag away. */
    if (this.dead && this.dieT >= this._vanishAtS()) return;

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
    /* THE HIT BLINK. ⚠️ NOT WHILE HE IS DEAD, and that is new with the fuse: the
       killing blow sets `hurtT` like any other, so its 60ms half-alpha flicker
       used to run through the first 300ms of the red flash -- two blinks on
       different beats over the same body, which reads as noise rather than as
       either of them. The flash already says a blow landed, and it says the
       bigger thing. */
    if (this.hurtT > 0 && !this.dead) {
      const period = (CONFIG.hurtBlinkMs || 60) / 1000;
      alpha = (Math.floor(this.hurtT / period) % 2) ? 0.55 : 1;
    }
    /* THE ONLY DEATH LEFT THAT TOUCHES OPACITY, and it is the one WITHOUT the
       explosions -- the plain fade this boss had before them, kept as the
       fallback behind `DEATH_BOOM.on`. While the blasts are on, the guard at the
       top of this method has already returned and nothing here runs. */
    if (this.dead && !(B && B.on)) {
      alpha *= 1 - Math.min(1, this.dieT / ((C.dieMs || 900) / 1000));
    }
    const dx = Math.round(gx - f.ax * dsc);
    const dy = Math.round(gy - f.ay * dsc + sunk * h);
    const dw = Math.round(f.w * dsc), dh = Math.round(h);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);

    /* THE FUSE'S RED, AS A SECOND BLIT THROUGH A FILTER over the first -- the
       arrangement sheets.js uses for the charutobi, copied down to the order.
       ⚠️ IT IS THE SAME FOUR NUMBERS, NOT A RE-DERIVED PLACEMENT. A tint drawn
       from its own arithmetic lines up while the body is still and slides off it
       the moment anything moves the sprite -- the bug the bomb's panic tint hit,
       which is why that one re-blits through the same closure. Here the
       destination rect is computed once above and both passes use it.
       ⚠️ AND THE FILTER OPENS WITH `brightness(0)`: hue and saturate are no-ops
       on dark ink, so the recipe crushes to black first and builds the colour
       back up. An unsupported `filter` makes this a plain redraw -- invisible,
       not broken. */
    const ft = this._fuseTint();
    if (ft) {
      ctx.filter = ft.tint;
      ctx.globalAlpha = alpha * ft.tintAlpha;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    }
    /* ⚠️ AND `restore()` IS WHAT CLEARS `filter`. It is canvas state like the
       clip and the alpha, so leaving it set would tint the next thing anybody
       draws this frame. */
    ctx.restore();
  }
}

/**
 * BODY -> ITS RECOIL. The one place the pairing is written, and it mirrors
 * `HIT_STATE` in tools/build-beat-horacio-defs.py -- if the cutter's state
 * order ever changes, these two move together or he grimaces in the wrong body.
 *
 * ⚠️ THE BALL (2) IS ABSENT ON PURPOSE, NOT MISSING. `_drawState` reads a
 * missing key as "no recoil for this body" and leaves the drawing alone, which
 * is exactly what a tucked ball with no face wants.
 */
HoracioBoss.HIT_STATE = { 0: 4, 1: 5, 3: 6 };
/* THE POSE HE HOLDS WHILE HE CALLS THEM -- body -> its summoning drawing.
   ⚠️ THE SAME SHAPE AS `HIT_STATE` AND FOR THE SAME REASON: the summon is a
   pose the BODY takes, not a body, so it composes with the health tier instead
   of replacing it. There is no entry for 2 because a tucked ball has no hand to
   raise, exactly as it has no face to screw up. */
HoracioBoss.SUMMON_STATE = { 0: 7, 1: 8, 3: 9 };
/* WHAT `this.state` HOLDS WHILE THE ARM IS UP. Any of the three summon states
   would do as the marker -- `_drawState` picks the right one off the body -- so
   it is the armoured one by convention, the way 0 is the resting body. */
HoracioBoss.SUMMON = 7;
