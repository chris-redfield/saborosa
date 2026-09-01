/**
 * letters.js — the hand-lettered front end.
 *
 * ONE SHEET FOR EVERY WORD THE GAME SHOWS OUTSIDE A FIGHT: the title and its
 * English gloss, the three menu items, the select prompt and the coconut names,
 * a drawn coconut for each life, six fighter names for under the health bars,
 * the options screen with its two meters, and the credits. Cut by
 * `tools/build-letter-pack.py`; keys are that tool's `PACK` table.
 *
 * Asked for 2026-09-01, as seven numbered jobs off one delivery of art. All of
 * it used to be TYPE set in Futura, or did not exist at all.
 *
 * ⚠️ ONE SCALE FOR THE WHOLE PACK, AND IT IS THE POINT OF THIS FILE. `k(W)` is
 * derived from the TITLE -- how much of the canvas width `BATIDÃO DE CÔCO`
 * spans -- and every other frame is drawn at that same px-per-source ratio. The
 * artist drew the title 1363px wide in the pack and a fighter name 124px, so a
 * single ratio reproduces the hierarchy they drew: the title dominates, the menu
 * sits under it, the HUD names are small. Giving each element its own `wRel`
 * would be eleven numbers that have to be kept in proportion by hand, and the
 * first one nudged would break a relationship the artist had already settled.
 *
 * ⚠️ SO THERE IS EXACTLY ONE SIZE KNOB (`LETTERS.titleWRel`) AND EVERYTHING
 * MOVES WITH IT. That is a feature until it isn't: if one element has to change
 * size on its own, it takes a per-call `scale`, which is what the menu's 10%
 * selection bump already uses.
 *
 * ⚠️ NOTHING HERE DECIDES WHERE ANYTHING GOES. Callers pass a centre in pixels.
 * A layout table in this file would put the title screen's composition in the
 * same place as the HUD's, and they have nothing to do with each other.
 *
 * ⚠️ AND EVERY DRAW IS A NO-OP IF THE PACK IS MISSING. The screens that use it
 * each keep their old typed path as a fallback; see `has()`.
 */
class Letters {
  constructor(assets) { this.assets = assets; }

  _cfg() { return CONFIG.LETTERS || {}; }

  /** The sheet and its rects, or null. */
  pack() {
    const img = this.assets.getDrawable('letters');
    const defs = this.assets.getJSON('letters');
    return (img && defs && defs.frames) ? { img, frames: defs.frames } : null;
  }

  /** Is the hand-lettering available at all? */
  has(key) {
    const p = this.pack();
    return !!(p && (key == null || p.frames[key]));
  }

  frame(key) {
    const p = this.pack();
    return (p && p.frames[key]) || null;
  }

  /**
   * The pack's one scale at canvas width `W`: px on screen per px in the sheet.
   *
   * ⚠️ TAKEN OFF THE TITLE FRAME rather than stored as a number, so a recut
   * sheet at a different resolution cannot silently change the size of the whole
   * front end. The ratio is between two things the artist controls.
   */
  k(W) {
    const p = this.pack();
    if (!p || !p.frames.title) return 0;
    return W * (this._cfg().titleWRel || 0.72) / p.frames.title.w;
  }

  /** The drawn size of a frame, or null. `mul` is a per-call multiplier. */
  size(key, W, mul) {
    const f = this.frame(key);
    if (!f) return null;
    const k = this.k(W) * (mul == null ? 1 : mul);
    return { w: f.w * k, h: f.h * k };
  }

  /**
   * Draw a frame CENTRED on (cx, cy).
   *
   * `o.mul`   multiplies the pack scale -- the menu's selected item is 1.10.
   * `o.alpha` multiplies the current globalAlpha.
   * `o.cut`   for the option meters: draw only the first `cut` px of the frame,
   *           which is how a meter shows n bars. See `cutFor`.
   *
   * ⚠️ A CUT FRAME IS STILL CENTRED ON THE WHOLE FRAME, not on the piece drawn.
   * Otherwise turning the volume down would slide the word VOLUME across the
   * screen, and the meter would read as one thing moving rather than as bars
   * going out.
   */
  draw(ctx, key, cx, cy, o) {
    const p = this.pack();
    const f = p && p.frames[key];
    if (!f) return false;
    const opt = o || {};
    const k = this.k(ctx.canvas ? ctx.canvas.width : CONFIG.GAME_W)
            * (opt.mul == null ? 1 : opt.mul);
    const sw = (opt.cut != null) ? Math.max(1, Math.min(f.w, opt.cut)) : f.w;
    ctx.save();
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(p.img, f.x, f.y, sw, f.h,
                  cx - f.w * k / 2, cy - f.h * k / 2, sw * k, f.h * k);
    ctx.restore();
    return true;
  }

  /**
   * How wide to draw an option row to show `n` of its bars.
   *
   * The cutter recorded the x of every bar's right edge, so this is a lookup
   * rather than arithmetic: the bars are spaced the way they were DRAWN, and
   * n=0 is the word with its meter empty.
   */
  cutFor(key, n) {
    const f = this.frame(key);
    if (!f || !f.cuts || !f.cuts.length) return null;
    const i = Math.max(0, Math.min(f.cuts.length - 1, Math.round(n)));
    return f.cuts[i];
  }

  /**
   * The pack key for a fighter's `name`, or null if the sheet has no such word.
   *
   * ⚠️ DERIVED FROM THE NAME RATHER THAN LOOKED UP IN A TABLE. `NARUTÃO` ->
   * `nameNARUTAO`, `MISTER STOP` -> `nameMISTERSTOP`: strip the accents, drop
   * everything that is not a letter or a digit, and prefix. A table would be a
   * third place that has to know the cast -- `CONFIG.CHARACTERS` and
   * `MOSCA_NAME` are already two -- and the one that would silently go stale is
   * this one, because a boss with no art here simply draws nothing.
   *
   * ⚠️ SO A NEW FIGHTER GETS ITS LETTERING BY BEING DRAWN ON THE SHEET UNDER THE
   * NAME IT ALREADY DECLARES. Nothing in code changes. That is how HORÁCIO and
   * MISTER STOP are already cut and waiting: they are in the pack, no fighter
   * answers to those names yet, and the day one does its bar is lettered.
   */
  nameKey(name) {
    if (!name) return null;
    const k = 'name' + String(name).normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    return this.has(k) ? k : null;
  }

  /** How many bars an option row was drawn with. */
  bars(key) {
    const f = this.frame(key);
    return (f && f.cuts) ? f.cuts.length - 1 : 0;
  }
}
