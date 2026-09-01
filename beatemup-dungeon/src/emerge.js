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

  /** Is there dust to draw? Asked by the entity pass so it can skip cheaply. */
  get booming() {
    if (!this.started) return false;
    const rects = CONFIG.BOOM_RECTS || [];
    const from = Math.max(0, this.cfg.boomFrom != null ? this.cfg.boomFrom : 5);
    const ms = (this.cfg.boomMs != null ? this.cfg.boomMs : CONFIG.boomMs) || 71;
    const st = Math.max(1, Math.round(this.cfg.boomStride != null
      ? this.cfg.boomStride : 2));
    const since = (this.t - this._boomAtS) * 1000;
    /* The strided tail runs ceil(n / st) frames of st x ms each -- longer than
       n x ms when n does not divide evenly, which is why this is computed and
       not assumed. */
    const n = rects.length - from;
    return since >= 0 && since < Math.ceil(n / st) * st * ms;
  }

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
  /**
   * The rise's progress, 0..1, QUANTISED INTO `steps` POSITIONS.
   *
   * Asked for 2026-09-01: *"the jump and the explosion animation, make it choppy
   * in the same way we did it when picking up the barrel, consider like its few
   * frames."*
   *
   * ⚠️ IT IS THE SAME ARITHMETIC THE BARREL PICKUP USES, which is
   * `floor(t * n)` over a small n -- the pickup reads chunky not because anybody
   * chose a stutter but because its ROW has few frames and each one therefore
   * owns a visible slice of the action. There is no dig-out row at all here, so
   * the same look has to be asked for directly: the climb is one held drawing,
   * and quantising the MOVEMENT is the only thing left to quantise.
   *
   * ⚠️ ONE QUANTISER FOR ALL THREE OF `sunk`, `hop` AND `travel`. They are three
   * views of one movement -- coming up, going over, going forward -- and if they
   * stepped on different grids the body would come apart: the forward step
   * landing between two heights, the hop peaking a frame after the rise finished.
   * Quantise the SOURCE, not each output.
   *
   * ⚠️ AND THE LAST STEP LANDS EXACTLY ON 1 (`/(steps - 1)`, not `/steps`). The
   * pickup can afford to stop a frame short of its end because the next state
   * takes over the drawing; a digger cannot -- he would land permanently a
   * fraction of a step below the floor.
   */
  _riseU() {
    const raw = Math.min(1, (this.t - this._heave) / Math.max(0.001, this._rise));
    const n = Math.round(this.cfg.steps != null ? this.cfg.steps : 6);
    if (n < 2) return raw;
    return Math.min(1, Math.floor(raw * n) / (n - 1));
  }

  get sunk() {
    if (!this.started) return 1;
    if (this.t < this._heave) return 1;
    /* ⚠️ HE IS OUT BEFORE THE RISE IS OVER, and the rest of it is the hop. Until
       2026-09-01 this ran to 0 at the very end, which meant the climb finished
       exactly at standing height -- an elevator. `clearAt` is the fraction of
       the rise spent coming through the floor; everything after it is airborne
       and belongs to `hop`. Same curve, compressed, so the reveal reads the way
       it always did and only stops earlier. */
    const c = Math.min(0.95, Math.max(0.05,
      this.cfg.clearAt != null ? this.cfg.clearAt : 0.55));
    const v = Math.min(1, this._riseU() / c);
    return (1 - v) * (1 - v);             // ease-out quad, on the stepped clock
  }

  /**
   * HOW FAR ABOVE THE GROUND HE IS, 0 .. 1 .. 0 -- the airborne half of the
   * climb. Asked for 2026-09-01: *"don't make him like come to the ground level,
   * make him pass the ground level, and then come back, to simulate a jump."*
   *
   * ⚠️ IT IS THE PART OF THE RISE AFTER `clearAt`, NOT A CLOCK OF ITS OWN. The
   * launch, the apex and the landing are one movement, and `released` still
   * fires at the end of the rise -- so he touches down on the exact frame the AI
   * takes him over. A separate duration would let the two disagree, and the way
   * that reads is a fighter who starts walking in mid-air.
   *
   * ⚠️ A SINE, NOT AN EASE. Up and down have to be one curve with a smooth top;
   * an ease-out to the apex and an ease-in back down is two moves with a stop
   * between them, which reads as hanging. `sin(pi w)` is 0 at both ends and 1 in
   * the middle, which is exactly the shape of a hop and costs one call.
   */
  get hop() {
    if (!this.started || this.released) return 0;
    if (this.t < this._heave) return 0;
    const c = Math.min(0.95, Math.max(0.05,
      this.cfg.clearAt != null ? this.cfg.clearAt : 0.55));
    const u = this._riseU();
    if (u <= c) return 0;
    return Math.sin(Math.PI * (u - c) / (1 - c));
  }

  /**
   * HOW FAR THROUGH THE FORWARD STEP HE IS, 0 .. 1 across the whole rise.
   *
   * ⚠️ LINEAR, AND IT IS THE ONE THING HERE THAT IS. A jump carries its
   * horizontal speed all the way to the landing -- nothing slows it down in the
   * air -- so easing it would put him nearly at his mark before the apex and
   * drifting the last few px on the way down.
   *
   * ⚠️ AND IT IS NOT `1 - sunk` ANY MORE. It was, and that was fine while the
   * climb ended at ground level; now `sunk` reaches 0 at `clearAt`, so the step
   * would have finished at 55% and left him hanging in the air going nowhere.
   */
  get travel() {
    if (!this.started || this.t < this._heave) return 0;
    return this._riseU();
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
  /**
   * WHEN THE BURST GOES OFF: the frame he breaks the surface.
   *
   * ⚠️ NOT AT THE START OF THE RISE, WHICH IS WHERE A "SPAWN EFFECT" WOULD GO.
   * He spends the first `clearAt` of the rise still coming up THROUGH the floor,
   * and a burst there would go off over a closed hole with a body somewhere
   * under it.
   *
   * ⚠️ AND NOT AT `clearAt` EITHER, WHICH IS WHERE IT WENT FIRST. That is the
   * frame his HEAD clears the line, not the frame there is a body to see:
   * *"its starting too early... it blows before the enemy even becomes visible
   * but in a bad way."* `boomDelayMs` holds it off until he is most of the way
   * through his hop. **The instant a thing STARTS is not the instant it reads**
   * -- the burst has to punctuate an arrival the player can already see, or it
   * is a puff of dust over nothing that he then walks out of.
   */
  get _boomAtS() {
    const c = Math.min(0.95, Math.max(0.05,
      this.cfg.clearAt != null ? this.cfg.clearAt : 0.55));
    const d = (this.cfg.boomDelayMs != null ? this.cfg.boomDelayMs : 200) / 1000;
    return this._heave + this._rise * c + d;
  }

  /**
   * The dust, over the hole and under the body.
   *
   * ⚠️ IT IS THE MAIN GAME'S HOLE-FALL EXPLOSION, NOT THE DEATH ONE, AND THE
   * DIFFERENCE IS WHICH FRAMES PLAY. Asked for 2026-09-01: *"its not the regular
   * explosion, its the explosion for when you are falling at a hole in the main
   * game, so it omits some frames."* Measured rather than guessed: that game's
   * `assets-v2/saborosa-boom.json` -- the defs its `startDungeonFall` loads --
   * is frames 5..11 of the same twelve this game already carries as
   * `CONFIG.BOOM_RECTS`, and its `saborosa-boom-full.json` is all twelve. So the
   * hole version is the TAIL: no grow-in, no peak, just the dispersing half. It
   * opens already large and thins out, which is what dust kicked up by something
   * else looks like -- where the full string opens small and blooms, which is
   * what a thing detonating looks like.
   *
   * ⚠️ SO THIS IS `boomFrom`, AN INDEX, NOT A SECOND SHEET OR A SECOND DEFS
   * FILE. The two games already share the art; what they disagree about is where
   * to start reading it.
   *
   * ⚠️ IT IS ITS OWN PASS AND NOT PART OF `draw()`, WHICH IS THE WHOLE POINT OF
   * SPLITTING IT OUT. Asked for 2026-09-01: *"should render on top of everything
   * but the player, so it should appear in front of the background (the enemy
   * doesn't, and that is on purpose)."* A digger is drawn INSIDE the scenery --
   * injected between two bands of the cigarette floor, which is what makes him
   * look like he is coming through it -- and while the dust travelled with him
   * it inherited that plane and got covered by the same mounds. The body has to
   * be behind the floor; the dust it throws up does not. So `game.js` calls this
   * from the entity pass instead, and `draw()` no longer touches it.
   *
   * ⚠️ WHICH MEANS THE HOLE AND THE DUST ARE NOW DRAWN AT DIFFERENT DEPTHS ON
   * PURPOSE. The hole is a mark on the floor and belongs under everything; the
   * dust is in the air.
   */
  drawBoom(ctx, img, camX, dsc) {
    if (!img) return;
    const rects = CONFIG.BOOM_RECTS || [];
    const from = Math.max(0, this.cfg.boomFrom != null ? this.cfg.boomFrom : 5);
    const n = rects.length - from;
    if (n <= 0) return;
    const ms = (this.cfg.boomMs != null ? this.cfg.boomMs : CONFIG.boomMs) || 71;
    const since = (this.t - this._boomAtS) * 1000;
    if (since < 0) return;
    /* ⚠️ EVERY `stride`-TH FRAME, EACH HELD `stride` TIMES AS LONG -- the same
       "few frames" ask as the climb, and the cheapest honest way to give a
       finished animation fewer of them. Dropping frames rather than slowing the
       rate is what keeps the burst's LENGTH roughly where it was, which matters:
       the tail has to finish inside the hole's own life. */
    const st = Math.max(1, Math.round(this.cfg.boomStride != null
      ? this.cfg.boomStride : 2));
    const i = Math.floor(since / (ms * st)) * st;
    if (i >= n) return;
    const f = rects[from + i];
    /* ⚠️ SIZED IN THE SAME UNIT THE DEATH BLASTS USE, so the two are comparable
       at a glance instead of one being a ratio and the other a width. `Booms
       .draw` scales by `size / peak` where `peak` is the WIDEST frame of the
       sheet -- not the first, which with the full twelve is the blast still
       growing -- and this does the identical arithmetic off the identical
       rects. Asked for 2026-09-01: *"make the explosion of they spawning the
       same size as the explosion of the enemies that explode."* */
    let peak = 1;
    for (const r of rects) if (r[2] > peak) peak = r[2];
    const size = this.cfg.boomSizePx != null ? this.cfg.boomSizePx : 200;
    const k = (size / peak) * dsc;
    const dw = f[2] * k, dh = f[3] * k;
    ctx.drawImage(img, f[0], f[1], f[2], f[3],
                  (this.x - camX) - dw / 2,
                  (Belt.topY + this.z) - dh / 2, dw, dh);
  }

  draw(ctx, camX, scale) {
    if (!this.started) return;
    const dsc = scale || 1;
    const g = this.grow;
    const a = (this.cfg.holeAlpha != null ? this.cfg.holeAlpha : 0.62) * g;
    /* ⚠️ THE HOLE MAY BE GONE WHILE THE DUST IS NOT -- `grow` closes over the
       settle and the burst can still be playing. That used to matter here, when
       the two were drawn together and an early return cut the dust off; they are
       separate passes now, and this note survives because the pairing is the
       kind of thing somebody will try to re-merge. */
    if (g > 0.001 && a > 0.001) this._drawEllipses(ctx, camX, dsc, g, a);
  }

  _drawEllipses(ctx, camX, dsc, g, a) {
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
