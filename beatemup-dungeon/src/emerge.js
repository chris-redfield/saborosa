/**
 * emerge.js — the hole an enemy climbs out of, for enemies that arrive from
 * UNDER the desert floor instead of walking on from the side.
 *
 * WHY THIS EXISTS. Asked for 2026-08-31: *"make the enemies come out of the pile
 * of cigarettes, like make them come out of the ground"*, with the improvisation
 * stated in the same breath -- **there is no art for it**. No burrow row, no dig
 * pose, nothing in any pack that shows a body half-buried. So the arrival is
 * built out of two things:
 *
 *   the HOLE   a dark ellipse in the floor, drawn UNDER the body. This file.
 *   the BODY   drawn below its own ground point with everything under the floor
 *              line SCISSORED AWAY, so it is revealed head-first as it rises.
 *              That is in Fighter.draw; this file never sees the fighter.
 *
 * ⚠️ IT WAS THREE THINGS AND THE OTHER TWO ARE DELETED. The first build also had
 * a RIM -- one drift out of the desert's own floor pack drawn over his feet, to
 * hide the scissor line -- and DEBRIS, the same drifts shrunk and thrown in the
 * air. Both were refused on sight, 2026-08-31: *"I don't like these effects with
 * the tiny cigarettes being thrown in the air. Also the small cigarettes that
 * appear in the feet of the enemy are not good as well."* They are gone rather
 * than switched off, which is what this project does with a look that was
 * refused. **Do not re-propose either of them.** If the scissor line ever needs
 * covering, the answer is the hole -- it is drawn behind him and its top half
 * already surrounds the cut -- not a second pile of butts on a floor made of
 * butts.
 *
 * ⚠️ AND THAT DELETION TOOK A DEPENDENCY WITH IT. This file used to borrow the
 * scenery pack, which quietly tied the whole arrival to `SCENERY.on`. It now
 * draws one ellipse and needs no art at all, so a digger works in any room, on
 * any floor, whatever is or is not loaded.
 *
 * ⚠️ IT IS ANCHORED TO THE WORLD, NOT TO THE FIGHTER. `start()` takes the spot
 * and keeps it. The body walks away the moment it is out and the hole has to
 * stay where it was dug -- reading the fighter's live x/z would drag the hole
 * along behind him like a shadow.
 */
class Emerge {
  constructor(cfg, index, waveSeed) {
    this.cfg = cfg || {};
    /* WHICH ONE OF THE WAVE THIS IS -- Stage._spawn's loop index -- and a seed
       SHARED BY THE WHOLE WAVE. Together they are here for one thing: the
       diggers of a wave are DEALT different planes rather than each rolling one.
       ⚠️ The seed has to be the wave's and not the enemy's, or the deal stops
       stepping cleanly and two of three collide again. See pickPlane. */
    this.index = index || 0;
    this.waveSeed = waveSeed || 0;
    /* ⚠️ THE CLOCK DOES NOT RUN UNTIL `start()`. An enemy's `delayMs` holds it
       off before anything happens, and a hole that opened during that stagger
       would announce the arrival a second or two before it happens -- which is
       the one thing the stagger exists to spend.

       ⚠️ BUT "NOT STARTED" IS NOT "FINISHED", AND CONFUSING THE TWO IS A BUG
       THAT HAS ALREADY HAPPENED HERE. `sunk` answers 1 before the clock runs, so
       a fighter waiting his turn is UNDER the floor, not standing on it. See the
       note in Fighter.draw. */
    this.started = false;
    this.t = 0;
    this.x = 0;
    this.z = 0;
    /* WHICH PLANE OF THE FLOOR HE COMES UP BEHIND. An insertion index into the
       scenery's bands: `plane` means "draw him after bands below this one and
       before the rest", so a smaller number puts more of the cigarette field in
       front of him. Set by `pickPlane()` once the room's band count is known --
       this file cannot know it, and the effect is built before the enemy is
       ever drawn. `null` = the ordinary fighter plane, in front of all of it.
       `planeSet` is separate because `null` is a real answer, not "not asked". */
    this.plane = null;
    this.planeSet = false;
  }

  /**
   * Roll which planes of the floor cover him, once, for a room with `bands` of
   * them. Asked for 2026-08-31: first as *"behind the 3 first layers"* and then
   * relaxed to *"maybe we don't have to hard code it, just make them spawn
   * between some layers randomly"* -- so it is a range, and 3 is inside it.
   *
   * ⚠️ DEALT, NOT ROLLED, AND THAT IS A BUG FIX RATHER THAN a preference. It was
   * a hash of the spawn position, and the range is small -- one to three planes
   * in front -- so with the first arena's three placements it collided: all
   * THREE enemies of the wave the user would actually look at came up behind
   * exactly the same plane, which is the one outcome that makes the feature look
   * like it is not there. Stepping the index through the range instead
   * GUARANTEES a wave of three shows three different depths, which is the point
   * of the randomness that was asked for.
   *
   * ⚠️ AND IT IS STILL NOT `Math.random`. Same rule the enemy's orbit direction
   * follows: a room that lays itself out differently on every attempt cannot be
   * judged, and "did that look right?" stops being answerable when the thing you
   * saw cannot be seen again. A hash of the WAVE's seed survives as where the
   * deal starts, so the three arenas deal in different orders and the desert
   * does not read as the same trick three times.
   */
  pickPlane(bands) {
    this.planeSet = true;
    if (!bands || bands < 1) { this.plane = null; return; }
    const lo = Math.max(1, this.cfg.minBandsInFront != null ? this.cfg.minBandsInFront : 1);
    const hi = Math.min(bands, this.cfg.maxBandsInFront != null
                                 ? this.cfg.maxBandsInFront : bands);
    if (hi < lo) { this.plane = null; return; }
    const span = hi - lo + 1;
    const h = Math.sin(this.waveSeed * 0.0137 + 311.7) * 43758.5453;
    const off = Math.floor((h - Math.floor(h)) * span);
    const inFront = lo + ((this.index + off) % span);
    /* `bands - inFront` planes are drawn behind him, the rest in front.

       ⚠️ FLOORED AT 1, NOT AT 0, AND THAT IS NOT A TASTE CALL. Plane 0 means
       "behind every belt band", which puts the split between the dead-area sixth
       layer (band -1) and band 0 -- and those two DO interleave in z (the back
       layer sits at z 95 and 171, band 0's rows at 129 and 187). Splitting there
       pulls the sixth layer ahead of a belt row it currently draws behind, so
       the floor itself changes while a digger is climbing. Measured: every other
       plane leaves the floor's draw order byte-for-byte identical; only 0 does
       not. `minBandsInFront: 1` already keeps it out of range, but a config is
       not a guarantee -- this is. */
    this.plane = Math.max(1, bands - inFront);
  }

  /* The three phases, in seconds. Read as durations, never as absolute times:
     `released` and `done` below are the only two anyone outside asks about. */
  get _heave()  { return (this.cfg.heaveMs  != null ? this.cfg.heaveMs  : 380) / 1000; }
  get _rise()   { return (this.cfg.riseMs   != null ? this.cfg.riseMs   : 560) / 1000; }
  get _settle() { return (this.cfg.settleMs != null ? this.cfg.settleMs : 420) / 1000; }

  /** Start the clock, with the hole at (x, z). */
  start(x, z) {
    this.started = true;
    this.t = 0;
    this.x = x;
    this.z = z;
  }

  /**
   * Is he currently to be drawn among the scenery rather than with the crowd?
   *
   * ⚠️ IT ENDS AT `released`, NOT AT `done`. The moment he is out he is a fighter
   * like any other and must sort by z with everyone else -- an enemy still
   * occluded by a mound while he is walking and swinging reads as a draw bug,
   * not as depth. The hole finishes closing on the ordinary plane; it is a
   * shrinking ellipse on the floor and nothing stands between it and the camera.
   */
  behindScenery() { return this.plane != null && this.started && !this.released; }

  update(dt) { if (this.started) this.t += dt; }

  /** Has the body finished climbing out? The enemy's AI waits on exactly this. */
  get released() { return this.started && this.t >= this._heave + this._rise; }

  /** Is the whole thing -- hole and all -- over? The enemy drops it on this. */
  get done() {
    return this.started && this.t >= this._heave + this._rise + this._settle;
  }

  /**
   * How far the body is still underground, 1 (buried) .. 0 (standing).
   *
   * ⚠️ EASED OUT, NOT LINEAR. A constant climb reads as a lift, not as something
   * pulling itself out: the last third of the travel is where the effect lives,
   * because that is the part where a whole body is visible and still moving.
   */
  get sunk() {
    if (!this.started) return 1;
    if (this.t < this._heave) return 1;
    const u = Math.min(1, (this.t - this._heave) / Math.max(0.001, this._rise));
    return 1 - (1 - (1 - u) * (1 - u));   // ease-out quad
  }

  /**
   * HOW FAR OPEN THE GROUND IS, 0 .. 1. It grows while the ground heaves, holds
   * for the whole climb, and closes over the settle -- so the floor is at its
   * most broken exactly while there is a body coming through it, and has healed
   * by the time anyone looks back at the spot.
   */
  get grow() {
    if (!this.started) return 0;
    if (this.t < this._heave) {
      const u = Math.min(1, this.t / Math.max(0.001, this._heave));
      return u * u * (1.12 - 0.12 * u);            // a small overshoot
    }
    if (!this.released) return 1;
    const u = Math.min(1, (this.t - this._heave - this._rise)
                          / Math.max(0.001, this._settle));
    return 1 - u * u;
  }

  /**
   * The hole. ⚠️ CALLED BEFORE THE SPRITE, and that is the whole of the draw
   * order: the ground opens UNDER him, so he climbs up out of it. Called after,
   * it paints the gap over the fighter coming through it.
   *
   * ⚠️ THIS IS WHAT MAKES THE ARRIVAL VISIBLE AT ALL, and it was added only after
   * the effect was rendered against the real desert floor. That floor is a
   * carpet of pale cigarette butts at 90% coverage; anything drawn ON it in the
   * same art is a floor tile on a floor. What the eye catches is a DARK GAP, and
   * then a body coming up out of it.
   *
   * It is the same shape and the same idea as the ground shadow game.js already
   * draws under every fighter -- a plain filled ellipse -- which is what keeps it
   * in the same visual language as the rest of the game.
   *
   * `scale` is the fighter's own `depthScale()`: the hole belongs to a body
   * standing at a depth, so it shrinks with him and a far arrival is not a near
   * one drawn small.
   */
  draw(ctx, camX, scale) {
    if (!this.started) return;
    const g = this.grow;
    if (g <= 0.001) return;
    const a = (this.cfg.holeAlpha != null ? this.cfg.holeAlpha : 0.62) * g;
    if (a <= 0.001) return;
    const dsc = scale || 1;
    const sx = this.x - camX;
    const sy = Belt.topY + this.z;
    const rw = (this.cfg.holeW != null ? this.cfg.holeW : 52) * dsc * g;
    const rh = (this.cfg.holeH != null ? this.cfg.holeH : 17) * dsc * g;
    ctx.save();
    ctx.fillStyle = this.cfg.holeColor || '#241609';
    /* TWO ELLIPSES RATHER THAN ONE, and it is the cheapest softening there is: a
       wide faint one under a narrow solid one reads as a gap with disturbed
       ground round it instead of as a sticker. A real gradient would want
       `createRadialGradient`, which is one more canvas API for one ellipse. */
    ctx.globalAlpha = a * 0.45;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rw * 1.4, rh * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
