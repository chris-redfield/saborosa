/**
 * Elevador — the hand-drawn lift, and the ONE place that knows how to draw it.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE A SECOND USER TURNED UP, NOT BECAUSE SHARING IS
 * TIDY. The art landed for level 3's shelf-climb and lived inside level3.js,
 * which was right while the bookcase was the only room with a lift in it. On
 * 2026-09-04 HIPÓLITO's room got one too — the player rides out of the boss
 * fight on it and arrives in the library on it — and the alternative was
 * `Level3.drawSlab(...)` being called from the boss room's cutscene. That is
 * exactly backwards: level 3's standing rule is that it REPLACES shared systems
 * for itself and touches nothing else, and a room reaching INTO it is the same
 * coupling wearing the other coat.
 *
 * So the drawing moved out and level 3 kept everything that is about level 3:
 * where its lifts stand in world x, which of them are on screen, and the boil
 * clock driven by its own camera. What came here is the part that was never
 * about the bookcase — how to turn "the front lip's centre is at this point on
 * screen, this wide" into pixels.
 *
 * ⚠️ THE ANCHOR IS THE FRONT LIP'S CENTRE, NOT THE IMAGE'S BOTTOM. The cutter
 * (tools/build-beat-elevador-defs.py) measures the near lip and writes `ax`/`ay`
 * to it, because the front FACE hangs below that line the way a body hangs
 * above it. Anchoring on the image's bottom sinks the slab by its own thickness
 * and puts the rider's feet in mid-air.
 *
 * ⚠️ ONE KNOB, AND EVERY OTHER PROPORTION COMES OUT OF THE DRAWING. `widthPx` is
 * how wide the near lip is on screen; the scale follows from it and the pack's
 * own `frontW`. An illustrated slab already HAS a perspective — do not add one.
 */
const Elevador = {
  _art: null,

  /**
   * The pack, once the loader has it. Null until then, which is a REAL state
   * and not an error: callers draw NOTHING rather than falling back to a shape.
   *
   * ⚠️ A MISS IS NOT CACHED, and that is the point of the guard rather than a
   * style choice. This is first asked on the frame a room is drawn, which can be
   * before the loader has the pack; caching the null would answer "there is no
   * elevator" for the rest of the run and every lift in the game would be
   * invisible with nothing in the log.
   */
  art(assets) {
    if (this._art) return this._art;
    const d = (assets && assets.getJSON) ? assets.getJSON('elevador') : null;
    if (d && d.frames && d.frames.length) this._art = d;
    return this._art || null;
  },

  /** How many boil frames the pack has. 0 while it is still loading. */
  frameCount(assets) {
    const A = this.art(assets);
    return A ? A.frames.length : 0;
  },

  /**
   * The slab's geometry from where its front lip's centre sits ON SCREEN.
   *
   * `cx`/`y` are screen pixels and deliberately so: what varies between the two
   * users is how they arrive at that point — level 3 subtracts its own camera
   * from a world x, the ride cutscene lifts it off the belt line — and neither
   * of those is this file's business.
   */
  rect(assets, cx, y, widthPx) {
    const A = this.art(assets);
    const w = widthPx || 1010;
    return { cx: cx, y: y, wFront: w, scale: A ? w / A.frontW : 1 };
  },

  /** One slab, at a rect from `rect()`. Draws nothing until the pack is in. */
  draw(ctx, assets, f, r) {
    const A = this.art(assets);
    const img = (assets && assets.getDrawable) ? assets.getDrawable('elevador') : null;
    if (!A || !img || !r) return;
    const fr = A.frames[f] || A.frames[0];
    const w = fr.w * r.scale, h = fr.h * r.scale;
    const x = Math.round(r.cx - A.ax * r.scale);
    const y = Math.round(r.y - A.ay * r.scale);
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, x, y, Math.round(w), Math.round(h));
  },
};
