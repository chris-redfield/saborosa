/**
 * LifeBar — the player's health, drawn with STILL LIFE's hand-drawn bar.
 *
 * The same asset the flying dungeon's boss fights use
 * (assets-v2/flying-dungeon/saborosa-hustlebar.webp, built by that game's
 * tools/build-hustlebar.py from the hand-inked master). Read IN PLACE rather
 * than copied, exactly like the shared gamepad mapping: one file, no second
 * copy to drift, and a re-run of that tool updates both games.
 *
 * IT IS NOT A METER THAT GETS SHORTER. Every state is its own drawing — 23
 * of them — and this picks one. That is the whole reason it looks hand-made
 * rather than generated:
 *
 *     frame 0      empty white   — and empty means DEAD
 *     frames 1-10  yellow rising from the BOTTOM
 *     frame 11     solid yellow  — the changeover
 *     frames 12-21 red descending from the TOP
 *     frame 22     solid red     — full health
 *
 * STATELESS, like the flying dungeon's BossBar: render() is handed a health
 * fraction and derives everything from it. There is no update() to keep in step
 * with the fight and nothing to reset between runs.
 *
 * THE SQUARES ARE DRAWN SQUARE, so the bar must never be stretched. Width is
 * a fraction of the canvas and the height follows from the cell's own aspect.
 */
class LifeBar {
  constructor(assets) { this.assets = assets; }

  /**
   * Health fraction (0..1) → frame.
   *
   * Rounded rather than floored so the bar tracks the middle of each step, but
   * clamped to at least 1 while the player is alive: frame 0 is the empty bar
   * and an empty bar means dead. Showing it one hit early would call the run
   * over while the player was still standing.
   */
  frameFor(frac) {
    const n = CONFIG.BAR_FRAMES - 1;
    if (frac <= 0) return 0;
    return Math.max(1, Math.min(n, Math.round(frac * n)));
  }

  /**
   * `layout` overrides where and how big. Omitted, it draws the player's bar
   * top-left; the Mosca Boss passes its own to put the SAME bar top-centre and
   * wider, which is how the flying dungeon stages a boss too. One drawing
   * routine either way — a second copy would be a second thing to keep in step
   * with the sheet.
   */
  render(ctx, frac, layout) {
    const sheet = this.assets.getDrawable('lifeBar');
    if (!sheet) return null;
    const k = this.frameFor(frac);
    const L = layout || {};

    const dw = CONFIG.GAME_W * (L.wRel != null ? L.wRel : CONFIG.lifeBarWRel);
    const dh = dw * (CONFIG.BAR_CELL_H / CONFIG.BAR_CELL_W);
    // `centre` is what a boss bar wants; a left edge is what the player's does.
    const x = L.centre ? Math.round((CONFIG.GAME_W - dw) / 2)
                       : (L.left != null ? L.left : CONFIG.lifeBarLeft);
    const y = L.top != null ? L.top : CONFIG.lifeBarTop;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    // Frame k is (0, k*CELL_H) — the sheet is a COLUMN, not a row. 333px-wide
    // frames in a row would have made a 7659x50 texture.
    ctx.drawImage(sheet,
      0, k * CONFIG.BAR_CELL_H, CONFIG.BAR_CELL_W, CONFIG.BAR_CELL_H,
      Math.round(x), Math.round(y), dw, dh);
    ctx.restore();
    // Handed back so the caller can hang the name and the lives count off the
    // bar's real footprint rather than re-deriving it from the same config.
    return { x, y, w: dw, h: dh };
  }
}
