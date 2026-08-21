/**
 * HitFX — the impact burst, read out of the effects atlas.
 *
 * A tiny sibling of sheets.js rather than a mode inside it, because almost
 * nothing sheets.js does applies here. A fighter has a FACING (so its art is
 * mirrored to match the way it walks), a POSE table, and a GROUND LINE (its
 * anchor is the bottom of its body, because it stands on the belt). A burst has
 * none of the three: it is centred on the point of impact, it expands around
 * that point, and which way it "faces" is meaningless. Bolting a fourth format
 * onto the pack reader to share a drawImage call would have cost more than this
 * whole file.
 *
 * WHAT THE ART IS. tools/build-beat-fx-defs.py cuts effects-porrada-01.png into
 * SIX four-frame animations -- three hand-drawn stars, each in yellow and in
 * red -- and each one dissipates as it plays: solid star, hollow outline,
 * broken outline, a scatter of dots, growing about 40% across the four. Read
 * that tool's header for how the sheet is cut and why.
 *
 * THE VARIANT IS CHOSEN ONCE PER HIT, NOT PER FRAME. That is the whole reason
 * six of them exist -- a five-punch combo stamping the identical mark five
 * times is what the code-drawn placeholder did wrong -- but the choice has to
 * be made when the blow lands and then remembered. Re-rolling inside draw()
 * would strobe through all six inside a fifth of a second and read as noise.
 * So Combat stores the pick on the impact EVENT and hands it back here.
 *
 * THE ANIMATION IS DRIVEN BY THE EVENT'S OWN CLOCK, not by a frame counter of
 * its own. Combat already ages every impact event, and that ageing STOPS during
 * hitstop (game.js does not tick the simulation while frozen) -- which means
 * the solid first frame is held for exactly as long as the picture is held, and
 * then the burst breaks up. That is free, and it is better than either half
 * would be alone: the frozen frame is the one with the most ink in it.
 */
class HitFX {
  constructor(assets) {
    this.assets = assets;
    this.img = null;
    this.defs = null;
    this.names = [];     // every animation, for the random pick
    this.byColour = {};  // 'yellow' | 'red' -> the names in that colour
  }

  /** Read the pack once, after loading. Safe to call again; safe to never call
      successfully -- everything below no-ops without art, so a missing effects
      file costs the effect and not the game. */
  build() {
    const key = 'hitfx';
    this.img = this.assets.getDrawable(key);
    this.defs = this.assets.getJSON(key);
    if (!this.img || !this.defs) { this.img = null; this.defs = null; return false; }
    this.names = Object.keys(this.defs.anims);
    this.byColour = {};
    for (const n of this.names) {
      const c = n.replace(/[0-9]+$/, '');
      (this.byColour[c] || (this.byColour[c] = [])).push(n);
    }
    return true;
  }

  ready() { return !!this.img; }

  /**
   * Pick one of the six at random.
   *
   * `colour` narrows it to one block when the caller wants the colour to MEAN
   * something (see CONFIG.HIT_FX.colorByRole); passed nothing, all six are in
   * the draw, which is what the art was asked for.
   */
  pick(colour) {
    const pool = (colour && this.byColour[colour]) || this.names;
    if (!pool.length) return null;
    return pool[(Math.random() * pool.length) | 0];
  }

  /**
   * Draw one burst.
   *
   *   name    an animation from pick()
   *   p       0..1 through the burst; picks the frame
   *   x, y    screen position of the point of impact -- the burst is CENTRED
   *           here, which is what the cutter's centre anchor is for
   *   size    the reference size for the WHOLE pack. Every frame of every
   *           variant is drawn at `size / baseSize`, one shared factor, so both
   *           the growth across a burst and the size differences the artist drew
   *           between the three stars arrive on screen intact.
   *
   *           ⚠️ DO NOT MAKE THIS PER-VARIANT. It was, briefly, so that all
   *           three stars read at one apparent mass. The drawing is the
   *           drawing: art is wired as drawn, and evening it out is a
   *           conversation about the art, not something done on the way in.
   *   mirror  flip horizontally. Free extra variety: the stars are hand-drawn
   *           and asymmetric enough that a mirrored one does not read as the
   *           same drawing, so six animations cover twelve marks.
   */
  draw(ctx, name, p, x, y, size, mirror, alpha) {
    if (!this.img) return;
    const seq = this.defs.anims[name];
    if (!seq) return;
    /* Clamped rather than wrapped: a burst plays once and stops. `p` can arrive
       at exactly 1 on the last frame of the event's life, and a wrap would show
       the solid star again for one frame at the very end of the dissipation. */
    const i = Math.min(seq.length - 1, Math.max(0, (p * seq.length) | 0));
    const f = this.defs.frames[seq[i]];
    const s = size / this.defs.baseSize;
    const w = f.w * s, h = f.h * s;
    ctx.save();
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    /* NOT rounded. sheets.js translates fighters to the raw float ground point,
       and a burst that snapped to whole pixels while the fighter it is stamped
       on did not would crawl against him by half a pixel as the camera moves --
       the jitter that cost the main game a debugging session once already. One
       convention, everywhere. */
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(this.img, f.x, f.y, f.w, f.h,
                  -f.ax * s, -f.ay * s, w, h);
    ctx.restore();
  }
}
