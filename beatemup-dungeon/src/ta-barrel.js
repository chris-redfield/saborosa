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
   * How wide the BARREL IS DRAWN, at this scale.
   *
   * ⚠️ NOT `boxes()[0].w`, AND THE DIFFERENCE IS THE WHOLE POINT OF HAVING
   * THIS. The box is inset to `barrelHitWRel` (0.85) because a hitbox should
   * forgive the drawing's margin -- so clearing the screen edge by the box
   * would pop 15% of a barrel into existence on screen, and drop the same
   * sliver off the other end. The edge cares about the picture.
   */
  drawnW() { return this._size(TaBarrel.POSE, 0).w; }

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

  /** Can the machine gun destroy this one? ⚠️ The dark ones cannot be. */
  isBreakable() { return this.isWhole() && !this.hard; }

  /** Done with: smashed and finished, or off the left of the screen. */
  isGone() { return this.gone; }

  /**
   * Break it open. Idempotent, and that matters: the beam runs every frame and
   * the touch test runs every frame, so this is reached repeatedly on the frame
   * a barrel dies. Restarting the smash clock on the second call would freeze
   * it on frame 0 for as long as whatever was breaking it kept doing so.
   */
  smash() {
    if (this.breakT < 0) this.breakT = 0;
  }

  /** @param {number} dt milliseconds. */
  update(dt) {
    if (this.gone) return;
    const s = dt / 1000;
    this.t += dt;
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
    return [{ x: this.x - w / 2, y: this.y - h / 2, w, h }];
  }

  render(ctx) {
    if (this.gone) return;
    const o = { scale: this._scale() };
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
}
