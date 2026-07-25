/**
 * BossBar — the Time Boss's health, top-centre (PORTABLE CORE).
 *
 * A hand-drawn 11-square bar (assets-v2/saborosa-hustlebar-1-low.png, recut by
 * tools/build-hustlebar.py). It is not a meter that gets shorter: every state is
 * its own drawing, 23 of them, and this picks one. Frame 22 is solid red, frame
 * 11 is solid yellow, frame 0 is empty white — and empty means dead, which is
 * why it is drawn right through the death blast rather than being switched off
 * with the boss.
 *
 * STATELESS, like game-over.js: render() is handed the health fraction and
 * derives everything from it. There is no update() to keep in step with the
 * fight, and nothing to reset between runs.
 *
 * ⚠️ It CANNOT live in hud.js. The whole HUD is hidden in no-time mode — which
 * is precisely when the boss fight happens — so a bar behind that flag would
 * never be seen. That is the entire reason this is its own file.
 *
 * Drawn AFTER the film pass, for the same reason the HUD is: the vignette
 * darkens the frame edge it sits against and the gate weave shakes the scene,
 * and a readout fixed to the camera should do neither.
 */
class BossBar {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
  }

  /* Health fraction (0..1) → frame. Rounded rather than floored so the bar
     tracks the middle of each step, but clamped to at least 1 while the boss is
     alive: frame 0 is the empty bar, and an empty bar means dead. Showing it a
     hit early would call the fight before it was over.

     bossHealth is deliberately 2× (BAR_FRAMES − 1), so this works out at
     exactly two hits per square with nothing left over. */
  frameFor(frac) {
    const n = this.cfg.BAR_FRAMES - 1;
    if (frac <= 0) return 0;
    return Math.max(1, Math.min(n, Math.round(frac * n)));
  }

  render(ctx, W, H, frac) {
    const c = this.cfg;
    const sheet = this.assets.getDrawable('bossBar');
    if (!sheet) return;
    const k = this.frameFor(frac);

    // Sized off the canvas WIDTH so it keeps its proportion of the frame, with
    // the height following from the cell's own aspect — the bar must never be
    // stretched, the squares are drawn square.
    const dw = W * c.bossBarWRel;
    const dh = dw * (c.BAR_CELL_H / c.BAR_CELL_W);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sheet,
      0, k * c.BAR_CELL_H, c.BAR_CELL_W, c.BAR_CELL_H,
      Math.round((W - dw) / 2), c.bossBarTop, dw, dh);
    ctx.restore();
  }
}
