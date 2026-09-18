/**
 * ta-barrel.js — the barrels that cross TIME ATTACK from right to left.
 *
 * Asked for 2026-09-18: *"add the barrels to it, the barrels will be objects
 * that the player must avoid, they come from the right to the left, they break
 * up if they hit you, the player takes a hit if he collides with the barrels.
 * make some barrels slighly darker (15%), these darker ones will be unbreakable
 * from the machine gun, the others will be breakable."*
 *
 * ⚠️⚠️ THIS IS THE ONE THING IN THE MODE THAT IS **NOT ON THE TORUS**, AND IT
 * IS THE WHOLE REASON IT IS A NEW CLASS RATHER THAN A FOURTH PORT.
 * `TaFly` and `TaCoin` came from Still Life, whose world wraps: they take a
 * `worldW`, do `x = ((x % worldW) + worldW) % worldW`, and `render` draws the
 * ±worldW ghost copies so a thing leaving one edge is already arriving at the
 * other. That is why "the flies are all stuck in the left" happened — spawning
 * one at `GAME_W + 90` wrapped it to 90 on its first update — and it is why the
 * mode has no off-screen cull anywhere else: **on a torus, nothing is ever off
 * the left edge, so such a test can never fire.**
 *
 * A barrel is the opposite shape. It arrives, it crosses, it is GONE — the ask
 * says "from the right to the left", which is a one-way trip. So this class
 * takes no `worldW`, never wraps, draws no ghosts, and owns the cull that the
 * others correctly do not have. ⚠️ **Do not "make it consistent" with its three
 * neighbours by handing it a `worldW`**: a wrapping barrel would come back
 * round and hit the player from behind, forever.
 *
 * ⚠️ AND IT SPEAKS MILLISECONDS INWARD, like every other entity here. The mode
 * converts the host's seconds once, at the boundary in `TimeAttack.update`, and
 * everything below that line is ms — the bug that ran this whole mode 1000x too
 * slow was a `dt` crossing that boundary unconverted. Speeds are px/SECOND
 * (`flySpeed`, `coinSpeed` and `barrelSpeed` all are), so the division is here.
 *
 * ⚠️ HALF OF THEM TUMBLE (2026-09-18, the pass after the first): *"make the
 * some (50%) barrels also spin on its own axis, like the earth, no, better
 * analogy: like a knife when it's thrown."* ⚠️ **THE SECOND ANALOGY IS THE
 * SPEC AND IT IS NOT THE SAME AS THE FIRST.** The earth turns on a fixed axis at
 * a fixed place; a thrown knife turns END OVER END *while it travels*, and the
 * turn is coupled to the flight. So the spin is a rotation about the barrel's
 * own CENTRE, its direction is derived from `vx` rather than typed, and it runs
 * off the same clock as the travel -- a barrel cannot be seen spinning one way
 * and flying the other.
 *
 * ⚠️ IT TAKES `sheets`, NOT `assets`, WHICH IS THE OTHER DIFFERENCE FROM ITS
 * NEIGHBOURS. The plane, the fly and the coin carry their own rect tables in
 * `CONFIG.TIME_ATTACK` because they came from another game. The barrel is the
 * main game's OWN prop pack (`barril`, already in CHARACTERS, already built at
 * boot, already in the manifest) — so it is drawn through `sheets.draw` like
 * every barrel on the street was, and nothing new is cut, loaded or packaged.
 */
class TaBarrel {
  /* THE TWO POSES, AND THEY ARE A MATCHED PAIR. The pack holds an upright
     barrel (`idle`/`smash`) and one lying on its side (`side`/`smashSide`).
     A barrel travelling horizontally through the air is the one on its side,
     and its smash is the one drawn to burst sideways — taking `side` and
     `smash` would break an upright barrel out of a horizontal one. */
  static POSE = 'side';
  static BREAK = 'smashSide';

  /**
   * @param {Sheets}  sheets  the game's own pack table — `barril` is in it
   * @param {object}  cfg     CONFIG.TIME_ATTACK
   * @param {number}  x,y     the CENTRE of the barrel, in canvas px
   * @param {boolean} hard    the darker one: unbreakable by the gun
   */
  constructor(sheets, cfg, x, y, hard) {
    this.sheets = sheets;
    this.cfg = cfg || {};
    const c = this.cfg;
    this.x = x;
    this.y = y;
    this.hard = !!hard;
    /* LEFTWARD, ALWAYS. The sign is here and not at the call site so nothing
       can spawn one that drifts the wrong way off the right of the screen. */
    const base = c.barrelSpeed != null ? c.barrelSpeed : 260;
    const varr = c.barrelSpeedVar != null ? c.barrelSpeedVar : 70;
    this.vx = -(base + (Math.random() * 2 - 1) * varr);
    this.t = 0;              // ms alive — drives the boil
    /* ms into the smash, or -1 while he is whole. ⚠️ -1 RATHER THAN 0, because
       0 is a real value here: the frame a barrel breaks is a frame it must
       already be drawing its first smash frame and must already have stopped
       colliding. A `breakT` of 0 tested as falsy would give it one more frame
       of being a solid barrel, which is the frame the player is inside it. */
    this.breakT = -1;
    this.gone = false;
    /* ⚠⚠ IT TAKES TWO HITS, AND THE I-FRAMES ARE NOT A DETAIL OF THAT -- THEY
       ARE WHAT MAKES IT TRUE. Asked for 2026-09-18: *"the barrels take 1 hit
       and already explode, I want them to explode only with 2 hits. Don't
       forget that they need to have some [invulnerability] after the first hit,
       like the flyes, otherwise a single scan of the machine gun will be able
       to destroy them."* The beam is a hitscan line re-tested EVERY FRAME while
       fire is held, so 2 health with no rate limit is two hits in 33ms --
       arithmetically two and indistinguishable from one on screen. `hurtT` is
       the limit, exactly as `flyHurtMs` and `coinHurtMs` are for the other two.

       ⚠️ AND THIS REVERSES A NOTE I WROTE IN THIS FILE THIS MORNING, which said
       a barrel should have no health because "i-frames on an obstacle" was what
       turned one clock into 35 seconds of payout, and a barrel pays nothing so
       there is nothing to rate-limit. **That conflated two jobs.** The clock's
       bug was paying out PER DAMAGE TICK -- i-frames were the wrong tool for a
       payout policy. Rate-limiting DAMAGE is the only thing they were ever for,
       and it is exactly what a two-hit barrel needs. The note is gone rather
       than qualified. */
    this.hp = c.barrelHealth != null ? c.barrelHealth : 2;
    this.hurtT = 0;             // ms of immunity left after a connected hit
    /* {x, y, t} -- the impact puff, or null. ⚠️ PINNED WHERE THE SHOT CONNECTED
       AND NOT CARRIED ON THE BARREL, which is TaCoin's reasoning and matters
       more here than it does there: this barrel is crossing at 312px/s, so a
       puff dragged along with it would travel 87px during its own 280ms and
       read as part of the barrel rather than as the moment of impact. */
    this.hitFx = null;
    /* HALF OF THEM TUMBLE. ⚠️ ROLLED AT BIRTH AND KEPT, like the bomb's variant
       and unlike anything read per frame: a barrel that decided every frame
       whether it was spinning would stutter. */
    this.spin = Math.random() < (c.barrelSpinChance != null ? c.barrelSpinChance : 0.5);
    /* RADIANS PER MILLISECOND, SIGNED. ⚠️ THE SIGN COMES OFF `vx`, WHICH IS THE
       KNIFE HALF OF THE ASK. A thrown knife's turn belongs to its flight, so
       this is derived and never typed -- it reads as the barrel ROLLING along
       its own path. Travelling left, that is anticlockwise, which is a NEGATIVE
       angle on a canvas whose y points down: the top of the barrel goes the way
       the barrel is going. Reverse the travel one day and the tumble follows on
       its own.
       ⚠️ AND IT IS ms, NOT SECONDS, because `update` is handed ms like every
       other entity in this mode -- see the header. A period in ms divided into
       2*PI is the whole conversion and it lives here. */
    const turn = c.barrelSpinMs != null ? c.barrelSpinMs : 620;
    const turnVar = c.barrelSpinVarMs != null ? c.barrelSpinVarMs : 160;
    const ms = Math.max(60, turn + (Math.random() * 2 - 1) * turnVar);
    this.spinRate = (this.vx < 0 ? -1 : 1) * (Math.PI * 2) / ms;
    /* THE ANGLE THE SMASH IS FROZEN AT. ⚠️ NULL WHILE HE IS WHOLE, and see
       `angle()`: a debris cloud that went on spinning would be a spinning cloud,
       and one that snapped back to level would POP on the frame it burst. It
       bursts at whatever angle it was at, which is the only reading that
       matches the barrel the player was just looking at. */
    this._brokeAt = null;
    /* ⚠️ THE VERTICAL ANCHOR IS FROZEN AT BIRTH, OFF THE WHOLE BARREL, AND THE
       SMASH DELIBERATELY DOES NOT GET ITS OWN. Every frame in this pack is
       bottom-anchored (`ay` == the frame height, for the smash as much as for
       the barrel) because in the main game a barrel breaks on the FLOOR. Draw
       both poses at one `gy` and their bottoms line up, so the splinters spread
       up and out of where the barrel was — which is the art as drawn. Recentre
       the smash on the barrel's middle instead and it JUMPS half a barrel
       upward on the frame it bursts, in a change nobody asked for. */
    this._gy = y + this._size(TaBarrel.POSE, 0).h / 2;
  }

  /** The pack scale multiplier — `barrelScale` 1 is the barrel at prop size. */
  _scale() {
    return this.cfg.barrelScale != null ? this.cfg.barrelScale : 1;
  }

  /** The drawn size of one frame, at this barrel's scale. */
  _size(pose, step) {
    const z = this.sheets.size('barril', pose, step);
    const s = this._scale();
    return { w: z.w * s, h: z.h * s };
  }

  /**
   * How wide the BARREL REACHES, at this scale -- what the screen edges care
   * about, for spawning it clear of one and dropping it past the other.
   *
   * ⚠️ NOT `boxes()[0].w`, AND THE DIFFERENCE IS THE WHOLE POINT OF HAVING
   * THIS. The box is inset to `barrelHitWRel` (0.85) because a hitbox should
   * forgive the drawing's margin -- so clearing the screen edge by the box
   * would pop 15% of a barrel into existence on screen, and drop the same
   * sliver off the other end. The edge cares about the picture.
   *
   * ⚠️ AND A SPINNER'S REACH IS ITS DIAGONAL, NOT ITS WIDTH. Over one turn it
   * presents every angle, so the widest it ever is is corner to corner (146px
   * against 117 at `barrelScale` 0.75). Measuring the un-turned width would pop
   * a corner into view at the right edge and clip one off at the left -- and
   * only on half the barrels, and only at some angles, which is the shape of a
   * bug nobody can reproduce. ONE number for both edges, so they cannot
   * disagree.
   */
  drawnW() {
    const z = this._size(TaBarrel.POSE, 0);
    return this.spin ? Math.hypot(z.w, z.h) : z.w;
  }

  /**
   * Which way up it is, in radians. 0 for the barrels that do not tumble.
   *
   * ⚠️ OFF `t`, THE SAME CLOCK THE BOIL RUNS ON, so the drawing and the turn
   * cannot drift apart -- and `t` stops advancing the moment it breaks, which
   * is what `_brokeAt` then holds still.
   */
  angle() {
    if (!this.spin) return 0;
    if (this._brokeAt != null) return this._brokeAt;
    return this.spinRate * this.t;
  }

  pose() { return this.breakT >= 0 ? TaBarrel.BREAK : TaBarrel.POSE; }

  /** Which drawing of the current pose. The boil loops; the smash does not. */
  step() {
    const n = Math.max(1, this.sheets.poseLength('barril', this.pose()));
    if (this.breakT < 0) {
      const ms = this.cfg.barrelBoilMs != null ? this.cfg.barrelBoilMs : 110;
      return Math.floor(this.t / Math.max(1, ms)) % n;
    }
    /* ⚠️ CLAMPED, NOT WRAPPED. The smash is three drawings played ONCE — a
       modulo here would loop a barrel bursting over and over for as long as
       the mode let it live, and `isGone()` below is what ends it instead. */
    const total = this.cfg.barrelBreakMs != null ? this.cfg.barrelBreakMs : 260;
    const i = Math.floor(this.breakT / Math.max(1, total / n));
    return Math.max(0, Math.min(n - 1, i));
  }

  /** Is it still a barrel — solid, and worth shooting at? */
  isWhole() { return this.breakT < 0 && !this.gone; }

  /** Can the machine gun damage this one at all? ⚠️ The dark ones cannot be. */
  isBreakable() { return this.isWhole() && !this.hard; }

  /** Inside the window a connected hit bought it. */
  isHurt() { return this.hurtT > 0; }

  /**
   * A shot connected. Returns whether it actually landed.
   *
   * ⚠️ THE `false` IS THE RATE LIMIT AND IT IS THE WHOLE POINT -- the same
   * shape as `TaCoin.hit` and `TaFly.hit`, deliberately, because the beam is
   * re-tested every frame while fire is held. Without the rejection a
   * three-hit barrel dies in three frames.
   *
   * ⚠⚠ **THE DARK ONES TAKE HITS TOO, THEY JUST NEVER BREAK** (2026-09-18):
   * *"add the puffs to the unbreakable barrels, they just don't break."* So
   * this is gated on `isWhole()` and NOT on `isBreakable()`, and the hardness
   * is tested one line lower, around the HEALTH only. Getting that boundary
   * wrong in either direction is the whole of this method: gate the puff on
   * breakable and a dark barrel is inert under fire; gate the damage on whole
   * and a dark barrel breaks.
   *
   * ⚠️ AND A DARK BARREL NEEDS THE I-FRAMES AS MUCH AS A BREAKABLE ONE, even
   * though nothing about it can change. Without them a held beam re-pins
   * `hitFx` at t = 0 every frame, so the puff never advances past its first
   * drawing -- a spark frozen mid-burst for as long as the trigger is down.
   * **The rate limit is on the FEEDBACK here, not on the damage**, which is
   * the same mechanism doing a second job and is why it sits above the
   * hardness test rather than inside it.
   */
  hit(dmg) {
    if (!this.isWhole() || this.hurtT > 0) return false;
    this.hurtT = this.cfg.barrelHurtMs != null ? this.cfg.barrelHurtMs : 180;
    /* ⚠️ THE ONE THING HARDNESS DECIDES. Everything else about being shot --
       the immunity window, the puff, the `true` -- is the same for both kinds,
       because from the player's side both kinds ARE being shot. */
    if (!this.hard) {
      this.hp -= (dmg === undefined ? 1 : dmg);
      /* ⚠️ `smash()` CLEARS `hurtT` AND `hitFx` ITSELF, so returning here
         leaves no puff behind on the lethal hit -- the burst supersedes it,
         which is TaCoin's rule. That is why the order is hurtT, then damage,
         then puff: the kill path exits between the second and the third. */
      if (this.hp <= 0) { this.smash(); return true; }
    }
    this.hitFx = { x: this.x, y: this.y, t: 0 };
    return true;
  }

  /** Done with: smashed and finished, or off the left of the screen. */
  isGone() { return this.gone; }

  /**
   * Break it open. Idempotent, and that matters: the beam runs every frame and
   * the touch test runs every frame, so this is reached repeatedly on the frame
   * a barrel dies. Restarting the smash clock on the second call would freeze
   * it on frame 0 for as long as whatever was breaking it kept doing so.
   */
  smash() {
    if (this.breakT >= 0) return;
    /* ⚠️ THE BURST SUPERSEDES THE LAST HIT'S PUFF, which is TaCoin's rule in
       `_explode` and the same reason: two impact effects on one object, one of
       them reporting a hit that has just been overtaken by the thing that
       killed it, reads as noise. The i-frames go too -- nothing can be immune
       once it has stopped existing, and leaving `hurtT` running would be a
       field no state owns.
       ⚠️ AND THIS RUNS FOR THE PLAYER COLLISION TOO, which is NOT a `hit()`:
       hitting the plane destroys a barrel outright whatever its health and
       whether or not it is dark. Health is what the GUN has to get through. */
    this.hitFx = null;
    this.hurtT = 0;
    /* ⚠️ THE ANGLE IS CAPTURED HERE, ON THE EVENT, AND NOT DERIVED LATER.
       Same rule as the clock's punch and the impact burst's random pick: freeze
       an effect on the frame that caused it. Reading `spinRate * t` from inside
       the smash would need `t` to stop advancing, which is a second thing to
       keep true; one assignment here cannot be got wrong. */
    this._brokeAt = this.angle();
    this.breakT = 0;
  }

  /** @param {number} dt milliseconds. */
  update(dt) {
    if (this.gone) return;
    const s = dt / 1000;
    this.t += dt;
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    /* ⚠️ THE PUFF OUTLIVES THE I-FRAMES AND THAT IS CORRECT, not a mismatch to
       tidy up: 4 frames x 70ms = 280ms of effect over a 180ms immune window, so
       the feedback is still on screen when the barrel becomes shootable again.
       The coin's are 280 against 160 for the same reason. */
    if (this.hitFx) {
      const c = this.cfg;
      this.hitFx.t += dt;
      if (this.hitFx.t >= (c.coinHitFxFrames || 4) * (c.coinHitFxMs || 70)) {
        this.hitFx = null;
      }
    }
    if (this.breakT >= 0) {
      /* ⚠️ THE DEBRIS STOPS DEAD RATHER THAN CARRYING ON LEFT, and that is the
         drawing's decision and not a physics one: the smash frames are a spray
         that grows out of one point, so sliding that point sideways under a
         spreading cloud reads as the cloud being dragged. It is over in
         `barrelBreakMs` either way. */
      this.breakT += dt;
      const total = this.cfg.barrelBreakMs != null ? this.cfg.barrelBreakMs : 260;
      if (this.breakT >= total) this.gone = true;
      return;
    }
    this.x += this.vx * s;
    /* THE CULL THAT THE FLIES AND THE CLOCKS CANNOT HAVE. See the header: this
       is the only thing in the mode that can actually leave. Measured off the
       drawing's own half-width so a barrel is never removed while a strip of it
       is still on screen. */
    const m = this.cfg.barrelCullPx != null ? this.cfg.barrelCullPx : 40;
    if (this.x + this.drawnW() / 2 + m < 0) this.gone = true;
  }

  /**
   * The hitbox, in the `{x, y, w, h}` form every other box in this mode uses.
   *
   * ⚠️ `{x, y, w, h}` AND NOT `{x0, y0, x1, y1}`, and it is worth stating
   * rather than assuming: the one function of this port that was retyped from
   * memory instead of copied read the corner form against these, every
   * comparison became `undefined > number`, and the guard inverted so the beam
   * hit everything on screen for a session. A missing property is not an error
   * — it quietly makes a boolean say yes.
   *
   * ⚠️ AN ARRAY OF ONE, because `TaFly` returns several (body and wings) and the
   * two call sites loop. A barrel needs one box and still answers the interface.
   */
  boxes() {
    if (!this.isWhole()) return [];
    const z = this._size(TaBarrel.POSE, this.step());
    const c = this.cfg;
    /* INSET, LIKE THE PLANE'S OWN BOX IS. `planeHitWRel`/`planeHitHRel` cut the
       plane's box to 0.35 x 0.5 of its drawing because a wing tip is not a
       fuselage; a barrel is very nearly a solid rectangle, so it is inset only
       enough to forgive the drawing's own margin. */
    const rw = c.barrelHitWRel != null ? c.barrelHitWRel : 0.85;
    const rh = c.barrelHitHRel != null ? c.barrelHitHRel : 0.85;
    const w = z.w * rw, h = z.h * rh;
    /* ⚠⚠ THE BOX TURNS WITH THE DRAWING, AND LEAVING IT STILL WOULD HAVE BEEN
       A VISIBLE UNFAIRNESS RATHER THAN A ROUNDING ERROR. A spinning barrel is
       117x86 on its side and 86x117 on its end; a fixed box would let the
       player fly clean under a barrel standing upright and be hit by the air
       36% of a barrel out to its left. This is the axis-aligned extent of the
       turned rectangle -- the standard `|w cos| + |h sin|` -- recomputed every
       frame off the same `angle()` the blit uses, which is the rule this
       project has for a debug view and is just as true of a hitbox: **the thing
       that decides must be the thing that draws.**

       ⚠️ AND IT WAS MEASURED, NOT ASSUMED -- the first version of this note
       said the opposite. The worry was that this is the box of a RECTANGLE
       while a barrel is a rounded shape, so the corners would stick out into
       empty space at the diagonal. Rotating the real frame and reading its
       alpha bbox says otherwise (box vs true ink, at `barrelScale` 0.75):

           deg      true ink      this box     box / ink
             0     117 x  86     99 x  73     0.85  0.85
            30     125 x 114    123 x 113     0.98  0.99
            45     122 x 122    122 x 122     1.00  1.00
            60     113 x 124    113 x 123     1.00  0.99
            90      86 x 117     73 x  99     0.85  0.85

       **It is never bigger than the barrel's own silhouette.** The 0.85 inset
       takes back more than the rectangle's corners add, and the two happen to
       cancel almost exactly at the diagonals. So a spinner is TIGHTEST at 45
       and 60 degrees -- the box is the ink -- and as forgiving as a still
       barrel end-on. That is the honest way round (it hits when the picture
       hits), but it does mean a tumbling barrel is marginally harder to slip
       past mid-turn. Lower `barrelHitWRel`/`barrelHitHRel` if that reads as
       unfair; they move the whole table together. */
    const a = this.angle();
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    const bw = w * ca + h * sa, bh = w * sa + h * ca;
    return [{ x: this.x - bw / 2, y: this.y - bh / 2, w: bw, h: bh }];
  }

  render(ctx) {
    if (this.gone) return;
    const o = { scale: this._scale() };
    /* THE TUMBLE. ⚠️ `pivotY` IS DRAWN PX **ABOVE THE GROUND POINT**, which is
       sheets.js's convention and the one thing here that is easy to get wrong:
       without it every rotation in this game happens about the ground point,
       and a barrel would swing around its own base like a felled tree instead
       of turning end over end. `_gy - y` IS half the barrel's drawn height by
       construction (see the constructor), so this is the same arithmetic
       prop.js does for the hoist, arrived at from the other end.

       ⚠️ AND THE SMASH INHERITS THE PIVOT. The debris shares the barrel's `_gy`
       and turns about the barrel's old centre, so a burst frozen at 90 degrees
       is a burst off a barrel that WAS at 90 degrees -- which is the frame the
       player just saw. */
    const a = this.angle();
    if (a) { o.rotate = a; o.pivotY = this._gy - this.y; }
    if (this.hard) {
      /* THE 15%. ⚠️ IT IS `sheets.draw`'s TINT PASS USED AS A DARKEN, WHICH IS
         NOT WHAT THAT PASS WAS BUILT FOR AND IS EXACTLY WHY IT WORKS HERE. The
         pass exists for the bomb's panic red and its recipe opens with
         `brightness(0)` because hue and saturate are no-ops on black ink; this
         one is a plain `brightness(0.85)` over a fully opaque redraw of the
         same sprite through the same closure, so the darker barrel is the
         barrel, 15% down, and not a coloured shape sitting on top of it.

         ⚠️ THE ALTERNATIVE WAS A FILTER ON THE BASE BLIT, AND IT WAS REJECTED:
         that is a new option on `sheets.draw`, which every character in the
         game goes through, for one caller. Drawing twice costs one blit on at
         most a couple of barrels and touches nothing shared.

         ⚠️ WHAT IT COSTS: the sprite's ANTI-ALIASED EDGE is composited twice,
         so the 1px outline ends up marginally darker and more opaque than a
         true single-pass darken. Invisible on this pack — the art is a heavy
         black line — and it is the reason this is a tint and not a re-cut.

         ⚠️ AN UNSUPPORTED `filter` MAKES THIS A PLAIN REDRAW, i.e. the barrel
         at full brightness. It fails to "looks breakable", not to "invisible"
         — worth knowing, because then the only tell left is the gun. */
      o.tint = this.cfg.barrelHardFilter || 'brightness(0.85)';
      o.tintAlpha = 1;
    }
    /* `'right'` IS THE PACK'S OWN NATIVE FACING, so nothing is mirrored. The
       barrel is symmetric and the smash is not, and flipping the smash would
       throw away the drawing the illustrator made. */
    this.sheets.draw(ctx, 'barril', 'right', this.pose(), this.step(),
                     this.x, this._gy, o);
  }

  /**
   * THE IMPACT PUFF -- the small black burst a non-lethal hit puts on a coin.
   *
   * Asked for by name 2026-09-18: *"when they take a hit, add the same effect
   * that the coin has right now (the small black explosion)"*.
   *
   * ⚠⚠ IT REACHES INTO THE **FLY** SHEET, WHICH LOOKS WRONG AND IS THE POINT.
   * `FLY_RECTS[1..4]` are the fly's burst frames; `TaCoin._blitHitFx` plays
   * those verbatim, and its own comment says why -- it is meant to be *the very
   * same effect*, so it shares the art and the rate rather than owning a
   * near-copy that could drift. The ask here was "the same effect that the coin
   * has", so this shares them in turn. **Three objects, one puff, one place to
   * retune it.** Anything that changes `coinHitFxFrames` / `coinHitFxMs` moves
   * all three together, which is the behaviour the ask asked for.
   *
   * ⚠️ AND IT IS DRAWN AT THE COIN'S SIZE BY DEFAULT, NOT THE BARREL'S.
   * `barrelHitFxSize` is in the same units as `coinHitFxSize` (a multiple of
   * `coinSizePx`) and falls back to it, so out of the box it is the same puff at
   * the same size -- "the SAME effect", and "the SMALL black explosion". Scaling
   * it up to the barrel would have made it a different, bigger effect that
   * merely shared an atlas.
   *
   * ⚠️ ITS OWN PASS, NOT THE TAIL OF `render()`. The coins do the same
   * (`renderBurst`) and for the same reason: drawn inside the sprite pass, one
   * barrel's puff can be painted under the next barrel. The shell runs this
   * after every barrel is down.
   *
   * ⚠️ NO TORUS LOOP. `TaCoin._blit` stamps the +/-`worldW` ghost copies
   * because a coin lives on a wrap-around world; a barrel does not (see the
   * header), so this is one blit and the ghosts would be two copies of a puff
   * in empty space.
   */
  renderBurst(ctx) {
    const fx = this.hitFx;
    if (!fx) return;
    const c = this.cfg;
    const assets = this.sheets && this.sheets.assets;
    const sheet = assets && assets.getDrawable(c.keyFly || 'fly');
    if (!sheet || !c.FLY_RECTS) return;
    const n = c.coinHitFxFrames || 4;
    const i = Math.min(n - 1, Math.floor(fx.t / (c.coinHitFxMs || 70)));
    const r = c.FLY_RECTS[1 + i];        // 0 is the live fly; 1..4 are the burst
    if (!r) return;
    /* ONE SCALE OFF THE **WIDEST** BURST FRAME, which is TaCoin's arithmetic
       copied rather than re-derived. The frames grow, so anchoring on the first
       would blow the whole puff up; anchoring on the widest makes the size knob
       mean "how big the peak is", which is the thing anyone would want to dial. */
    let widest = 1;
    for (let k = 1; k < c.FLY_RECTS.length; k++) {
      if (c.FLY_RECTS[k][2] > widest) widest = c.FLY_RECTS[k][2];
    }
    /* ⚠️ `!= null` TWICE, NOT `||`, AND THE SECOND ONE IS THE ONE THAT MATTERS.
       `size || 1.3` reads a deliberate 0 as "unset" and falls through to the
       default -- so setting `barrelHitFxSize: 0` to switch the puff off would
       have drawn it at full size instead. This project's own recurring trap;
       0 here means a puff of no size, which is what 0 means. */
    const size = c.barrelHitFxSize != null ? c.barrelHitFxSize
               : (c.coinHitFxSize != null ? c.coinHitFxSize : 1.3);
    const sc = ((c.coinSizePx || 76) * size) / widest;
    const dw = r[2] * sc, dh = r[3] * sc;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(fx.x, fx.y);
    ctx.drawImage(sheet, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}
